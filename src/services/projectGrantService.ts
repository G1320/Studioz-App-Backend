import mongoose from 'mongoose';
import ExpressError from '../utils/expressError.js';
import { ProjectFileModel } from '../models/projectFileModel.js';
import {
  COLLABORATOR_CAP_PER_SIDE,
  isCollaboratorExpired,
  type ProjectAccess,
  type ProjectSide
} from './projectAccessService.js';
import {
  resolveGrantCapabilities,
  roleForCapabilities,
  type ProjectCapability,
  type ProjectRoleOrCustom
} from '../constants/projectPermissions.js';

export interface ProjectGrant {
  capabilities: ProjectCapability[];
  /** Undefined = whole project. */
  fileIds?: mongoose.Types.ObjectId[];
}

/**
 * Validate a `{ role?, capabilities?, fileIds? }` request body into a grant.
 * File IDs must all belong to the project.
 */
export async function parseProjectGrant(
  body: { role?: unknown; capabilities?: unknown; fileIds?: unknown },
  projectId: string
): Promise<ProjectGrant> {
  let capabilities: ProjectCapability[];
  try {
    capabilities = resolveGrantCapabilities(body.role, body.capabilities);
  } catch (err) {
    throw new ExpressError(err instanceof Error ? err.message : 'Invalid permissions', 400);
  }

  if (body.fileIds === undefined || body.fileIds === null) {
    return { capabilities };
  }
  if (!Array.isArray(body.fileIds)) {
    throw new ExpressError('fileIds must be an array', 400);
  }

  const unique = [...new Set(body.fileIds.map(String))];
  if (unique.length === 0) return { capabilities };
  if (!unique.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    throw new ExpressError('Invalid file ID', 400);
  }

  const found = await ProjectFileModel.countDocuments({ _id: { $in: unique }, projectId });
  if (found !== unique.length) {
    throw new ExpressError('Some files do not belong to this project', 400);
  }

  return { capabilities, fileIds: unique.map((id) => new mongoose.Types.ObjectId(id)) };
}

/**
 * Non-owners with invite rights (editors) can only hand out access they hold themselves:
 * no extra capabilities and no files outside their own scope.
 */
export function grantWithinAccess(
  access: Pick<ProjectAccess, 'capabilities' | 'fileScope'>,
  grant: { capabilities?: readonly string[] | null; fileIds?: readonly unknown[] | null }
): boolean {
  const capabilities = grant.capabilities ?? [];
  if (!capabilities.every((c) => (access.capabilities as readonly string[]).includes(c))) return false;
  if (!access.fileScope) return true;
  const fileIds = (grant.fileIds ?? []).map(String);
  if (fileIds.length === 0) return false;
  return fileIds.every((id) => access.fileScope!.includes(id));
}

export function assertGrantWithinAccess(
  access: Pick<ProjectAccess, 'capabilities' | 'fileScope'>,
  grant: { capabilities?: readonly string[] | null; fileIds?: readonly unknown[] | null }
) {
  if (!grantWithinAccess(access, grant)) {
    throw new ExpressError("You can't give more access than you have", 403);
  }
}

type MutableCollaborator = {
  userId: unknown;
  side: ProjectSide;
  invitedBy: unknown;
  joinedAt: Date;
  status: 'active' | 'removed';
  capabilities?: ProjectCapability[];
  fileIds?: unknown[];
  expiresAt?: Date;
  shareLinkId?: unknown;
};

type ProjectWithCollaborators = {
  collaborators?: MutableCollaborator[] | null;
};

export function assertCollaboratorCapacity(project: ProjectWithCollaborators, side: ProjectSide) {
  const activeOnSide = (project.collaborators || []).filter(
    (c) => c.status === 'active' && c.side === side && !isCollaboratorExpired(c)
  ).length;
  if (activeOnSide >= COLLABORATOR_CAP_PER_SIDE) {
    throw new ExpressError(`Maximum ${COLLABORATOR_CAP_PER_SIDE} collaborators per side`, 400);
  }
}

/**
 * Add a collaborator, or re-activate the user's existing (removed/expired) entry with the new grant.
 * Mutates the project document; caller saves.
 */
export function upsertCollaborator(
  project: ProjectWithCollaborators,
  entry: {
    userId: unknown;
    side: ProjectSide;
    invitedBy: unknown;
    capabilities?: ProjectCapability[];
    fileIds?: unknown[];
    expiresAt?: Date;
    shareLinkId?: unknown;
  }
) {
  const uid = String(entry.userId);
  const next: MutableCollaborator = {
    userId: entry.userId,
    side: entry.side,
    invitedBy: entry.invitedBy,
    joinedAt: new Date(),
    status: 'active',
    capabilities: entry.capabilities,
    fileIds: entry.fileIds,
    expiresAt: entry.expiresAt,
    shareLinkId: entry.shareLinkId
  };

  const collaborators = project.collaborators ?? [];
  const existing = collaborators.find((c) => String(c.userId) === uid);
  if (existing) {
    Object.assign(existing, next);
  } else {
    collaborators.push(next);
    project.collaborators = collaborators;
  }
}

/** Public shape of a grant for API responses. */
export function serializeGrant(grant: {
  capabilities?: readonly ProjectCapability[] | null;
  fileIds?: ReadonlyArray<{ toString(): string }> | null;
}, fallbackCapabilities: readonly ProjectCapability[]): {
  role: ProjectRoleOrCustom;
  capabilities: ProjectCapability[];
  fileIds: string[];
} {
  const capabilities = grant.capabilities?.length ? [...grant.capabilities] : [...fallbackCapabilities];
  return {
    role: roleForCapabilities(capabilities),
    capabilities,
    fileIds: (grant.fileIds || []).map(String)
  };
}
