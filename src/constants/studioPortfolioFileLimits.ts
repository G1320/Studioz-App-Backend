/** Per-file upload limit for studio portfolio exhibits (MB). */
export const STUDIO_PORTFOLIO_MAX_FILE_SIZE_MB = 200;

/** Max hosted exhibit files per studio. */
export const STUDIO_PORTFOLIO_MAX_FILES = 20;

/** Playable audio formats for in-page portfolio playback. */
export const STUDIO_PORTFOLIO_ACCEPTED_FILE_TYPES = [
  '.wav',
  '.mp3',
  '.aif',
  '.aiff',
  '.flac',
] as const;

/** Skill tags owners can use now; later these map to playlists/categories. */
export const STUDIO_PORTFOLIO_ROLES = [
  'mixed',
  'mastered',
  'recorded',
  'produced',
] as const;

export type StudioPortfolioRole = (typeof STUDIO_PORTFOLIO_ROLES)[number];
