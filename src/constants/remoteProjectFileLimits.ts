/** Per-file upload limit for remote mixing/mastering projects (MB). */
export const REMOTE_PROJECT_MAX_FILE_SIZE_MB = 500;

/**
 * Total files per project — enough for multitrack stems, references, and revisions.
 */
export const REMOTE_PROJECT_MAX_FILES_PER_PROJECT = 50;

/** Standard audio/archive formats accepted for remote mixing services. */
export const REMOTE_PROJECT_ACCEPTED_FILE_TYPES = [
  '.wav',
  '.mp3',
  '.aif',
  '.aiff',
  '.flac',
  '.zip',
  '.mid'
] as const;
