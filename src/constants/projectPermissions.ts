/**
 * Granular project capabilities shared by invited collaborators and share links.
 * Primary customer/vendor always hold every capability.
 */
export const PROJECT_CAPABILITIES = ['listen', 'comment', 'download', 'upload', 'edit'] as const;
export type ProjectCapability = (typeof PROJECT_CAPABILITIES)[number];

export const PROJECT_ROLES = ['listener', 'reviewer', 'listener_download', 'contributor', 'editor'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** `custom` = capabilities were toggled individually and match no preset. */
export type ProjectRoleOrCustom = ProjectRole | 'custom';

export const ROLE_CAPABILITIES: Record<ProjectRole, readonly ProjectCapability[]> = {
  listener: ['listen'],
  reviewer: ['listen', 'comment'],
  listener_download: ['listen', 'download'],
  contributor: ['listen', 'comment', 'download', 'upload'],
  editor: ['listen', 'comment', 'download', 'upload', 'edit']
};

/** Collaborators created before roles existed keep their previous (full) access. */
export const LEGACY_COLLABORATOR_ROLE: ProjectRole = 'editor';

export const SHARE_LINK_MAX_PER_PROJECT = 25;
export const SHARE_LINK_MAX_EXPIRY_DAYS = 365;

export function isProjectRole(value: unknown): value is ProjectRole {
  return typeof value === 'string' && (PROJECT_ROLES as readonly string[]).includes(value);
}

export function isProjectCapability(value: unknown): value is ProjectCapability {
  return typeof value === 'string' && (PROJECT_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Validated, de-duplicated capability list in canonical order. `listen` is always included:
 * every grant can at least audition the (lossless) audio.
 */
export function normalizeCapabilities(input: unknown): ProjectCapability[] {
  const requested = new Set<ProjectCapability>(['listen']);
  if (Array.isArray(input)) {
    for (const value of input) {
      if (!isProjectCapability(value)) {
        throw new Error(`Unknown capability: ${String(value)}`);
      }
      requested.add(value);
    }
  }
  return PROJECT_CAPABILITIES.filter((c) => requested.has(c));
}

/** Resolve the effective capabilities from a role preset and optional explicit overrides. */
export function resolveGrantCapabilities(role: unknown, capabilities: unknown): ProjectCapability[] {
  if (capabilities !== undefined && capabilities !== null) {
    return normalizeCapabilities(capabilities);
  }
  if (!isProjectRole(role)) {
    throw new Error('A valid role or capabilities list is required');
  }
  return [...ROLE_CAPABILITIES[role]];
}

export function roleForCapabilities(capabilities: readonly ProjectCapability[]): ProjectRoleOrCustom {
  const key = [...capabilities].sort().join(',');
  for (const role of PROJECT_ROLES) {
    if ([...ROLE_CAPABILITIES[role]].sort().join(',') === key) return role;
  }
  return 'custom';
}

/**
 * What a share link can grant without an account (guests comment under a typed name);
 * downloads still obey the deliverable lock.
 */
export const ANONYMOUS_LINK_CAPABILITIES: readonly ProjectCapability[] = ['listen', 'comment', 'download'];

/** Uploading and editing are tied to an account, so the link holder must sign in and join. */
export function capabilitiesRequireLogin(capabilities: readonly ProjectCapability[]): boolean {
  return capabilities.some((c) => !ANONYMOUS_LINK_CAPABILITIES.includes(c));
}
