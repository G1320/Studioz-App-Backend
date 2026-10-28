import ExpressError from '../utils/expressError.js';
import type { ProjectMessageSenderRole, RemoteProject } from '../types/remoteProject.js';
import {
  LEGACY_COLLABORATOR_ROLE,
  PROJECT_CAPABILITIES,
  ROLE_CAPABILITIES,
  isProjectCapability,
  roleForCapabilities,
  type ProjectCapability,
  type ProjectRoleOrCustom
} from '../constants/projectPermissions.js';

export type ProjectSide = 'customer' | 'vendor';

export type ProjectAccessAction =
  | 'view'
  | 'chat'
  | 'files'
  | 'download'
  | 'upload'
  | 'edit'
  | 'customer_workflow'
  | 'vendor_workflow'
  | 'update_metadata'
  | 'update_artwork'
  | 'invite'
  | 'pay';

export type ProjectSenderRole = 'customer' | 'vendor' | 'customer_collaborator' | 'vendor_collaborator';

export interface ProjectAccess {
  userId: string;
  side: ProjectSide;
  isPrimary: boolean;
  isCollaborator: boolean;
  senderRole: ProjectSenderRole;
  /** `owner` for the primary customer/vendor. */
  role: ProjectRoleOrCustom | 'owner';
  capabilities: ProjectCapability[];
  /** When set, the user only sees these files (plus anything they uploaded). */
  fileScope: string[] | null;
  canView: boolean;
  /** Listen = list + stream files. */
  canFiles: boolean;
  canChat: boolean;
  canDownload: boolean;
  canUpload: boolean;
  canEdit: boolean;
  canCustomerWorkflow: boolean;
  canVendorWorkflow: boolean;
  canUpdateMetadata: boolean;
  canUpdateArtwork: boolean;
  canInvite: boolean;
  canPay: boolean;
}

type IdLike = string | { toString(): string };

export interface CollaboratorLike {
  userId: IdLike;
  side: ProjectSide;
  status?: 'active' | 'removed';
  capabilities?: string[] | null;
  fileIds?: IdLike[] | null;
  expiresAt?: Date | string | null;
}

type ProjectLike = Pick<RemoteProject, 'customerId' | 'vendorId'> & {
  collaborators?: CollaboratorLike[];
};

function idStr(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

export function isCollaboratorExpired(collab: Pick<CollaboratorLike, 'expiresAt'>, now = new Date()): boolean {
  return !!collab.expiresAt && new Date(collab.expiresAt).getTime() <= now.getTime();
}

/** Active, unexpired collaborator entry for this user, if any. */
export function findActiveCollaborator(project: ProjectLike, userId: string) {
  const uid = String(userId);
  return (project.collaborators || []).find(
    (c) => c.status !== 'removed' && idStr(c.userId) === uid && !isCollaboratorExpired(c)
  );
}

/** Stored capabilities, or the legacy full-access preset for collaborators that predate roles. */
export function collaboratorCapabilities(collab: Pick<CollaboratorLike, 'capabilities'>): ProjectCapability[] {
  const stored = (collab.capabilities || []).filter(isProjectCapability);
  if (stored.length === 0) return [...ROLE_CAPABILITIES[LEGACY_COLLABORATOR_ROLE]];
  return PROJECT_CAPABILITIES.filter((c) => c === 'listen' || stored.includes(c));
}

function buildAccess(params: {
  userId: string;
  side: ProjectSide;
  isPrimary: boolean;
  capabilities: ProjectCapability[];
  fileScope: string[] | null;
}): ProjectAccess {
  const { userId, side, isPrimary, capabilities, fileScope } = params;
  const has = (c: ProjectCapability) => capabilities.includes(c);
  const isCustomerSide = side === 'customer';
  const canEdit = has('edit');

  return {
    userId,
    side,
    isPrimary,
    isCollaborator: !isPrimary,
    senderRole: isPrimary ? side : isCustomerSide ? 'customer_collaborator' : 'vendor_collaborator',
    role: isPrimary ? 'owner' : roleForCapabilities(capabilities),
    capabilities,
    fileScope,
    canView: true,
    canFiles: has('listen'),
    canChat: has('comment'),
    canDownload: has('download'),
    canUpload: has('upload'),
    canEdit,
    canCustomerWorkflow: isCustomerSide && canEdit,
    canVendorWorkflow: !isCustomerSide && canEdit,
    canUpdateMetadata: !isCustomerSide && canEdit,
    canUpdateArtwork: canEdit,
    canInvite: isPrimary || canEdit,
    canPay: isPrimary && isCustomerSide
  };
}

/** Resolve access for a user on a project. Throws 403 if not a participant. */
export function resolveProjectAccess(project: ProjectLike, userId: string): ProjectAccess {
  if (!userId) {
    throw new ExpressError('Unauthorized', 401);
  }

  const uid = String(userId);
  const customerId = idStr(project.customerId);
  const vendorId = idStr(project.vendorId);

  if (uid === customerId || uid === vendorId) {
    return buildAccess({
      userId: uid,
      side: uid === customerId ? 'customer' : 'vendor',
      isPrimary: true,
      capabilities: [...PROJECT_CAPABILITIES],
      fileScope: null
    });
  }

  const collab = findActiveCollaborator(project, uid);
  if (collab) {
    const scope = (collab.fileIds || []).map(idStr).filter(Boolean);
    return buildAccess({
      userId: uid,
      side: collab.side,
      isPrimary: false,
      capabilities: collaboratorCapabilities(collab),
      fileScope: scope.length > 0 ? scope : null
    });
  }

  throw new ExpressError('Forbidden', 403);
}

export function assertProjectAccess(
  project: ProjectLike,
  userId: string,
  action: ProjectAccessAction = 'view'
): ProjectAccess {
  const access = resolveProjectAccess(project, userId);

  const allowed =
    (action === 'view' && access.canView) ||
    (action === 'chat' && access.canChat) ||
    (action === 'files' && access.canFiles) ||
    (action === 'download' && access.canDownload) ||
    (action === 'upload' && access.canUpload) ||
    (action === 'edit' && access.canEdit) ||
    (action === 'customer_workflow' && access.canCustomerWorkflow) ||
    (action === 'vendor_workflow' && access.canVendorWorkflow) ||
    (action === 'update_metadata' && access.canUpdateMetadata) ||
    (action === 'update_artwork' && access.canUpdateArtwork) ||
    (action === 'invite' && access.canInvite) ||
    (action === 'pay' && access.canPay);

  if (!allowed) {
    throw new ExpressError('Forbidden', 403);
  }

  return access;
}

/** JWT user id from verifyTokenMw-decoded payload. */
export function getAuthUserId(req: { decodedJwt?: { _id?: string; userId?: string; sub?: string } }): string {
  const jwt = req.decodedJwt;
  const id = jwt?.userId || jwt?._id || jwt?.sub;
  if (!id) throw new ExpressError('Unauthorized', 401);
  return String(id);
}

/** All user IDs that should receive realtime project events. */
export function getProjectParticipantIds(project: ProjectLike): string[] {
  const ids = new Set<string>();
  const customerId = idStr(project.customerId);
  const vendorId = idStr(project.vendorId);
  if (customerId) ids.add(customerId);
  if (vendorId) ids.add(vendorId);
  for (const c of project.collaborators || []) {
    if (c.status !== 'removed' && !isCollaboratorExpired(c)) {
      const cid = idStr(c.userId);
      if (cid) ids.add(cid);
    }
  }
  return [...ids];
}

/** Opposite party roles used when marking messages read. */
export function oppositeSenderRoles(side: ProjectSide): ProjectMessageSenderRole[] {
  if (side === 'customer') {
    return ['vendor', 'vendor_collaborator', 'vendor_guest'];
  }
  return ['customer', 'customer_collaborator', 'customer_guest'];
}

/** Roles that count as "other party" for unread counts. */
export function sameSideSenderRoles(side: ProjectSide): ProjectMessageSenderRole[] {
  if (side === 'customer') {
    return ['customer', 'customer_collaborator', 'customer_guest'];
  }
  return ['vendor', 'vendor_collaborator', 'vendor_guest'];
}

export const COLLABORATOR_CAP_PER_SIDE = 10;
export const INVITE_TTL_DAYS = 14;

// ============================================================
// Deliverable download lock
// ============================================================

type DownloadLockProjectLike = {
  status?: string;
  paymentStatus?: string;
  downloadLock?: { enabled?: boolean; releasedAt?: Date | string | null } | null;
};

/** File types the lock applies to (customer source uploads are never locked). */
export const LOCKABLE_FILE_TYPES = ['deliverable', 'revision'] as const;

/**
 * True while the vendor's lock is in force: enabled, not manually released,
 * and the project has not been approved (completed) or fully paid.
 */
export function isDeliverableDownloadLocked(project: DownloadLockProjectLike): boolean {
  const lock = project.downloadLock;
  if (!lock?.enabled) return false;
  if (lock.releasedAt) return false;
  if (project.status === 'completed') return false;
  if (project.paymentStatus === 'fully_paid') return false;
  return true;
}

/**
 * Whether this user may download a given file. Requires the `download` capability;
 * on top of that, customer-side users are gated on deliverables/revisions while the lock is active.
 */
export function canDownloadProjectFile(
  project: DownloadLockProjectLike,
  access: Pick<ProjectAccess, 'side' | 'canDownload'>,
  fileType: string
): boolean {
  if (!access.canDownload) return false;
  if (access.side === 'vendor') return true;
  if (!(LOCKABLE_FILE_TYPES as readonly string[]).includes(fileType)) return true;
  return !isDeliverableDownloadLocked(project);
}

// ============================================================
// File scope & file-level actions
// ============================================================

type FileLike = { _id: IdLike; uploadedBy?: IdLike | null; type?: string };

/** Files a scoped user can see: the granted set plus anything they uploaded themselves. */
export function isFileInScope(access: Pick<ProjectAccess, 'fileScope' | 'userId'>, file: FileLike): boolean {
  if (!access.fileScope) return true;
  if (file.uploadedBy && idStr(file.uploadedBy) === access.userId) return true;
  return access.fileScope.includes(idStr(file._id));
}

export function assertFileInScope(access: Pick<ProjectAccess, 'fileScope' | 'userId'>, file: FileLike) {
  if (!isFileInScope(access, file)) {
    throw new ExpressError('File not found', 404);
  }
}

/** Mongo filter fragment restricting a ProjectFile query to the user's scope (or `{}`). */
export function fileScopeFilter(access: Pick<ProjectAccess, 'fileScope' | 'userId'>): Record<string, unknown> {
  if (!access.fileScope) return {};
  return { $or: [{ _id: { $in: access.fileScope } }, { uploadedBy: access.userId }] };
}

/** Editors can delete any visible file; uploaders can always remove their own uploads. */
export function canDeleteProjectFile(
  access: Pick<ProjectAccess, 'canEdit' | 'canUpload' | 'userId' | 'fileScope'>,
  file: FileLike
): boolean {
  if (!isFileInScope(access, file)) return false;
  if (access.canEdit) return true;
  return access.canUpload && !!file.uploadedBy && idStr(file.uploadedBy) === access.userId;
}

/** Customers supply sources; the vendor side delivers. */
export function uploadableFileTypesForSide(side: ProjectSide): readonly string[] {
  return side === 'customer' ? ['source'] : ['deliverable', 'revision'];
}
