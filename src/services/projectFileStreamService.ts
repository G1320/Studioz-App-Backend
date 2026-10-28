import type { ProjectFile } from '../types/remoteProject.js';
import { audioContentTypeForFileName, getDownloadUrl } from './storageService.js';
import { lookupWaveform } from './waveformService.js';

/**
 * Restricted (non-downloadable) streams get inline-only URLs that outlive a listening session,
 * so a leaked URL dies the same day; the player renews them while paused or after an expiry error.
 */
export const RESTRICTED_STREAM_URL_EXPIRY = 2 * 60 * 60;
export const DEFAULT_FILE_URL_EXPIRY = 86400;

type StreamableFile = Pick<ProjectFile, 'storageKey' | 'fileName'>;

/**
 * Signed URL for the original uploaded bytes — never a transcode — so playback is always
 * lossless. Users without download rights get a shorter-lived inline URL instead.
 */
export async function getOriginalStreamUrl(
  file: StreamableFile,
  options: { restricted: boolean }
): Promise<{ downloadUrl: string; expiresIn: number; quality: 'original' }> {
  const expiresIn = options.restricted ? RESTRICTED_STREAM_URL_EXPIRY : DEFAULT_FILE_URL_EXPIRY;
  const downloadUrl = await getDownloadUrl(file.storageKey, {
    expiresIn,
    inline: options.restricted,
    contentType: audioContentTypeForFileName(file.fileName)
  });
  return { downloadUrl, expiresIn, quality: 'original' };
}

export function buildWaveformResponse(
  file: Parameters<typeof lookupWaveform>[0],
  extra: Record<string, unknown> = {}
) {
  const result = lookupWaveform(file);
  if (result.status === 'ready') {
    return {
      fileId: file._id,
      status: 'ready' as const,
      peaks: result.waveform.peaks,
      durationMs: result.waveform.durationMs ?? null,
      sampleRate: result.waveform.sampleRate ?? null,
      channels: result.waveform.channels ?? null,
      version: result.waveform.version
    };
  }

  return {
    fileId: file._id,
    status: result.status,
    reason: 'reason' in result ? result.reason : undefined,
    ...extra
  };
}
