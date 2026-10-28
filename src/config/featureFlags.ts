/**
 * Reserved for watermarked/lossy preview streams of locked deliverables
 * (see docs/brainstorm-crm-and-remote-projects.md). No preview pipeline exists yet, so this
 * flag currently changes nothing: every stream serves the original lossless upload and access
 * is controlled through download permissions + the deliverable download lock.
 * A future preview pipeline must check this flag and stay off by default.
 */
export const WATERMARKED_PREVIEWS_ENABLED = process.env.WATERMARKED_PREVIEWS_ENABLED === 'true';
