import { parseBuffer } from 'music-metadata';
import { getObjectByteRange, putObject, generateStudioPortfolioCoverKey } from './storageService.js';

/** First ~256KB is enough for WAV/FLAC/AIFF/MP3 headers + duration estimates. */
const HEADER_BYTE_RANGE_END = 262143;

/** Embedded artwork often lives in early ID3/FLAC blocks; 4MB covers typical APIC sizes. */
const COVER_BYTE_RANGE_END = 4 * 1024 * 1024 - 1;

export interface AudioFileMeta {
  codec: string | null;
  sampleRate: number | null;
  bitDepth: number | null;
  channels: number | null;
  durationMs: number | null;
  container: string | null;
}

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function isLikelyAudio(fileName: string, mimeType: string): boolean {
  const ext = extensionOf(fileName);
  if (['wav', 'mp3', 'flac', 'aif', 'aiff'].includes(ext)) return true;
  return mimeType.startsWith('audio/');
}

/**
 * Parse audio fidelity metadata from the start of an R2 object.
 */
export async function parseAudioMetaFromStorage(
  storageKey: string,
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<AudioFileMeta | null> {
  if (!isLikelyAudio(fileName, mimeType)) {
    return null;
  }

  const end = Math.min(HEADER_BYTE_RANGE_END, Math.max(0, fileSize - 1));
  const buffer = await getObjectByteRange(storageKey, 0, end);

  const metadata = await parseBuffer(buffer, {
    mimeType: mimeType || undefined,
    size: fileSize,
  }, { duration: true });

  const codec =
    metadata.format.codec ||
    metadata.format.container ||
    extensionOf(fileName).toUpperCase() ||
    null;

  return {
    codec,
    sampleRate: metadata.format.sampleRate ?? null,
    bitDepth: metadata.format.bitsPerSample ?? null,
    channels: metadata.format.numberOfChannels ?? null,
    durationMs:
      typeof metadata.format.duration === 'number'
        ? Math.round(metadata.format.duration * 1000)
        : null,
    container: metadata.format.container ?? null,
  };
}

function coverExtension(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

/**
 * Read embedded album art from an audio object in R2 and store it as a cover image.
 */
export async function extractAndStoreCoverFromAudio(params: {
  studioId: string;
  fileId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<string | null> {
  if (!isLikelyAudio(params.fileName, params.mimeType)) {
    return null;
  }

  const end = Math.min(COVER_BYTE_RANGE_END, Math.max(0, params.fileSize - 1));
  const buffer = await getObjectByteRange(params.storageKey, 0, end);
  const metadata = await parseBuffer(
    buffer,
    {
      mimeType: params.mimeType || undefined,
      size: params.fileSize,
    },
    { skipCovers: false, duration: false }
  );

  const picture = metadata.common.picture?.[0];
  if (!picture?.data?.length) {
    return null;
  }

  const mimeType = picture.format || 'image/jpeg';
  const ext = coverExtension(mimeType);
  const coverKey = generateStudioPortfolioCoverKey(params.studioId, params.fileId, ext);
  await putObject(coverKey, Buffer.from(picture.data), mimeType);
  return coverKey;
}
