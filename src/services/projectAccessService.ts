import ExpressError from '../utils/expressError.js';
import type { RemoteProject } from '../types/remoteProject.js';

export type ProjectSide = 'customer' | 'vendor';

export type ProjectAccessAction =
  | 'view'
  | 'chat'
  | 'files'
  | 'customer_workflow'
  | 'vendor_workflow'
  | 'update_metadata'
  | 'invite'
  | 'pay';

export type ProjectSenderRole =
  | 'customer'
  | 'vendor'
  | 'customer_collaborator'
  | 'vendor_collaborator';

export interface ProjectAccess {
  userId: string;
  side: ProjectSide;
  isPrimary: boolean;
  isCollaborator: boolean;
  senderRole: ProjectSenderRole;
  canView: boolean;
  canChat: boolean;
  canFiles: boolean;
  canCustomerWorkflow: boolean;
  canVendorWorkflow: boolean;
  canUpdateMetadata: boolean;
  canInvite: boolean;
  canPay: boolean;
}

type ProjectLike = Pick<RemoteProject, 'customerId' | 'vendorId'> & {
  collaborators?: Array<{
    userId: string | { toString(): string };
    side: ProjectSide;
    status?: 'active' | 'removed';
  }>;
};

function idStr(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

/** Active collaborator entry for this user, if any. */
export function findActiveCollaborator(project: ProjectLike, userId: string) {
  const uid = String(userId);
  return (project.collaborators || []).find(
    (c) => c.status !== 'removed' && idStr(c.userId) === uid
  );
}

/** Resolve access for a user on a project. Throws 403 if not a participant. */
export function resolveProjectAccess(project: ProjectLike, userId: string): ProjectAccess {
  if (!userId) {
    throw new ExpressError('Unauthorized', 401);
  }

  const uid = String(userId);
  const customerId = idStr(project.customerId);
  const vendorId = idStr(project.vendorId);

  if (uid === customerId) {
    return {
      userId: uid,
      side: 'customer',
      isPrimary: true,
      isCollaborator: false,
      senderRole: 'customer',
      canView: true,
      canChat: true,
      canFiles: true,
      canCustomerWorkflow: true,
      canVendorWorkflow: false,
      canUpdateMetadata: false,
      canInvite: true,
      canPay: true
    };
  }

  if (uid === vendorId) {
    return {
      userId: uid,
      side: 'vendor',
      isPrimary: true,
      isCollaborator: false,
      senderRole: 'vendor',
      canView: true,
      canChat: true,
      canFiles: true,
      canCustomerWorkflow: false,
      canVendorWorkflow: true,
      canUpdateMetadata: true,
      canInvite: true,
      canPay: false
    };
  }

  const collab = findActiveCollaborator(project, uid);
  if (collab) {
    const side = collab.side;
    const isCustomerSide = side === 'customer';
    return {
      userId: uid,
      side,
      isPrimary: false,
      isCollaborator: true,
      senderRole: isCustomerSide ? 'customer_collaborator' : 'vendor_collaborator',
      canView: true,
      canChat: true,
      canFiles: true,
      canCustomerWorkflow: isCustomerSide,
      canVendorWorkflow: !isCustomerSide,
      canUpdateMetadata: !isCustomerSide,
      canInvite: false,
      canPay: false
    };
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
    (action === 'customer_workflow' && access.canCustomerWorkflow) ||
    (action === 'vendor_workflow' && access.canVendorWorkflow) ||
    (action === 'update_metadata' && access.canUpdateMetadata) ||
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
    if (c.status !== 'removed') {
      const cid = idStr(c.userId);
      if (cid) ids.add(cid);
    }
  }
  return [...ids];
}

/** Opposite party roles used when marking messages read. */
export function oppositeSenderRoles(side: ProjectSide): ProjectSenderRole[] {
  if (side === 'customer') {
    return ['vendor', 'vendor_collaborator'];
  }
  return ['customer', 'customer_collaborator'];
}

/** Roles that count as "other party" for unread counts. */
export function sameSideSenderRoles(side: ProjectSide): ProjectSenderRole[] {
  if (side === 'customer') {
    return ['customer', 'customer_collaborator'];
  }
  return ['vendor', 'vendor_collaborator'];
}

export const COLLABORATOR_CAP_PER_SIDE = 10;
export const INVITE_TTL_DAYS = 14;
