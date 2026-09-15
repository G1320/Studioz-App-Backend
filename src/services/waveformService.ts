import { ProjectFileModel } from '../models/projectFileModel.js';
import { RemoteProjectModel } from '../models/remoteProjectModel.js';
import type { ProjectFile, ProjectFileWaveform } from '../types/remoteProject.js';
import { getProjectParticipantIds } from './projectAccessService.js';
import { getObjectStream, isStorageConfigured } from './storageService.js';
import {
  PcmStreamAnalyzer,
  StreamingPeakCollector,
  DEFAULT_WAVEFORM_BUCKETS,
  WAVEFORM_VERSION,
  type WaveformPeaksResult
} from './waveform/pcmPeaks.js';
import { emitProjectWaveformReady } from '../webSockets/socket.js';

/** Files above this size are not analysed for compressed formats (decode cost). */
const COMPRESSED_MAX_BYTES = 200 * 1024 * 1024;
/** Hard cap for PCM streams (matches the largest upload we allow). */
const PCM_MAX_BYTES = 2 * 1024 * 1024 * 1024;
/** Max concurrent generations per process. */
const MAX_CONCURRENT = 2;

type WaveformKind = 'pcm' | 'mp3' | 'flac' | null;

export type WaveformLookup =
  | { status: 'ready'; waveform: ProjectFileWaveform }
  | { status: 'processing' }
  | { status: 'unsupported'; reason?: string }
  | { status: 'failed'; reason?: string };

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

export function waveformKindFor(fileName: string, mimeType: string): WaveformKind {
  const ext = extensionOf(fileName);
  if (ext === 'wav' || ext === 'aif' || ext === 'aiff') return 'pcm';
  if (ext === 'mp3') return 'mp3';
  if (ext === 'flac') return 'flac';
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav' || mimeType === 'audio/aiff') return 'pcm';
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'audio/flac' || mimeType === 'audio/x-flac') return 'flac';
  return null;
}

type FileLike = Pick<
  ProjectFile,
  '_id' | 'projectId' | 'fileName' | 'mimeType' | 'fileSize' | 'storageKey' | 'waveformStatus' | 'waveform'
>;

const inFlight = new Map<string, Promise<void>>();
const retriedOnce = new Set<string>();
let running = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  running += 1;
}

function releaseSlot(): void {
  running = Math.max(0, running - 1);
  const next = waiters.shift();
  if (next) next();
}

async function analysePcm(file: FileLike): Promise<WaveformPeaksResult> {
  if (file.fileSize > PCM_MAX_BYTES) throw new Error('File too large to analyse');
  const analyzer = new PcmStreamAnalyzer(file.fileSize, DEFAULT_WAVEFORM_BUCKETS);
  const stream = await getObjectStream(file.storageKey);
  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
    analyzer.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return analyzer.finish();
}

async function analyseCompressed(file: FileLike, format: 'mp3' | 'flac'): Promise<WaveformPeaksResult> {
  if (file.fileSize > COMPRESSED_MAX_BYTES) {
    throw new Error('File too large to analyse');
  }
  const { decodeChunked } = await import('audio-decode');
  const collector = new StreamingPeakCollector(DEFAULT_WAVEFORM_BUCKETS);
  const stream = await getObjectStream(file.storageKey);
  const source = stream as unknown as AsyncIterable<Uint8Array>;
  for await (const pcm of decodeChunked(source, format)) {
    collector.push(pcm.channelData, pcm.sampleRate);
  }
  return collector.finish();
}

async function runGeneration(file: FileLike): Promise<void> {
  const fileId = String(file._id);
  const kind = waveformKindFor(file.fileName, file.mimeType);
  if (!kind) {
    await ProjectFileModel.updateOne(
      { _id: fileId },
      { $set: { waveformStatus: 'unsupported' }, $unset: { waveformError: 1 } }
    );
    return;
  }

  await acquireSlot();
  try {
    await ProjectFileModel.updateOne({ _id: fileId }, { $set: { waveformStatus: 'processing' } });

    const result = kind === 'pcm' ? await analysePcm(file) : await analyseCompressed(file, kind);

    const waveform: ProjectFileWaveform = {
      version: WAVEFORM_VERSION,
      peaks: result.peaks,
      durationMs: result.durationMs,
      sampleRate: result.sampleRate,
      channels: result.channels,
      generatedAt: new Date()
    };

    await ProjectFileModel.updateOne(
      { _id: fileId },
      { $set: { waveformStatus: 'ready', waveform }, $unset: { waveformError: 1 } }
    );

    const project = await RemoteProjectModel.findById(file.projectId).select('customerId vendorId collaborators');
    if (project) {
      emitProjectWaveformReady(getProjectParticipantIds(project), String(file.projectId), fileId);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Waveform generation failed';
    console.error(`Waveform generation failed for ${fileId}:`, reason);
    const tooLarge = /too large/i.test(reason);
    const unsupported = /not supported|Unsupported|Not a WAV|No decoder|Unknown audio format/i.test(reason);
    await ProjectFileModel.updateOne(
      { _id: fileId },
      {
        $set: {
          waveformStatus: tooLarge || unsupported ? 'unsupported' : 'failed',
          waveformError: reason.slice(0, 200)
        }
      }
    ).catch(() => undefined);
  } finally {
    releaseSlot();
  }
}

/**
 * Kick off waveform generation in the background (deduped per file).
 */
export function scheduleWaveformGeneration(file: FileLike): Promise<void> {
  if (!isStorageConfigured()) return Promise.resolve();
  const fileId = String(file._id);
  const existing = inFlight.get(fileId);
  if (existing) return existing;

  const task = runGeneration(file)
    .catch((err) => {
      console.error('Unexpected waveform error', err);
    })
    .finally(() => {
      inFlight.delete(fileId);
    });
  inFlight.set(fileId, task);
  return task;
}

export function isWaveformInFlight(fileId: string): boolean {
  return inFlight.has(String(fileId));
}

/**
 * Resolve the waveform for a file, scheduling generation when missing.
 */
export function lookupWaveform(file: FileLike): WaveformLookup {
  if (file.waveformStatus === 'ready' && file.waveform?.peaks?.length) {
    return { status: 'ready', waveform: file.waveform };
  }

  const kind = waveformKindFor(file.fileName, file.mimeType);
  if (!kind) return { status: 'unsupported', reason: 'not_audio' };

  if (file.waveformStatus === 'unsupported') {
    return { status: 'unsupported', reason: 'format_or_size' };
  }

  if (file.waveformStatus === 'failed' && !isWaveformInFlight(String(file._id))) {
    // One retry per process lifetime: a transient R2 hiccup shouldn't leave a file bare forever.
    if (!retriedOnce.has(String(file._id))) {
      retriedOnce.add(String(file._id));
      void scheduleWaveformGeneration(file);
      return { status: 'processing' };
    }
    return { status: 'failed', reason: 'generation_failed' };
  }

  void scheduleWaveformGeneration(file);
  return { status: 'processing' };
}
