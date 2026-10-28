import crypto from 'crypto';
import { Request } from 'express';
import mongoose from 'mongoose';
import { RemoteProjectModel } from '../../models/remoteProjectModel.js';
import { ProjectFileModel } from '../../models/projectFileModel.js';
import { ProjectMessageModel } from '../../models/projectMessageModel.js';
import { ProjectShareLinkModel } from '../../models/projectShareLinkModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { createAndEmitNotification } from '../../utils/notificationUtils.js';
import {
  assertProjectAccess,
  canDownloadProjectFile,
  findActiveCollaborator,
  getAuthUserId,
  getProjectParticipantIds
} from '../../services/projectAccessService.js';
import {
  assertCollaboratorCapacity,
  assertGrantWithinAccess,
  parseProjectGrant,
  serializeGrant,
  upsertCollaborator
} from '../../services/projectGrantService.js';
import { buildWaveformResponse, getOriginalStreamUrl } from '../../services/projectFileStreamService.js';
import { getDownloadUrl as getStorageDownloadUrl, isStorageConfigured } from '../../services/storageService.js';
import { parseAudioMetaFromStorage } from '../../services/audioMetaService.js';
import {
  createShareAccessKey,
  hashSharePassword,
  verifyShareAccessKey,
  verifySharePassword
} from '../../services/shareLinkSecurityService.js';
import {
  SHARE_GUEST_MESSAGE_MAX_LENGTH,
  parseGuestName,
  parseShareLinkSettings,
  shareLinkStatus,
  type ShareLinkSettings
} from '../../services/shareLinkSettingsService.js';
import { SHARE_LINK_MAX_PER_PROJECT, capabilitiesRequireLogin } from '../../constants/projectPermissions.js';
import { emitProjectMessageUpdate, emitProjectStatusUpdate } from '../../webSockets/socket.js';

interface AuthRequest extends Request {
  decodedJwt?: { _id?: string; userId?: string };
}

const SHARED_FILE_FIELDS = '_id fileName fileSize mimeType type revisionNumber createdAt';

function createShareToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

type ShareLinkDoc = InstanceType<typeof ProjectShareLinkModel>;

function serializeLink(link: ShareLinkDoc) {
  return {
    _id: link._id,
    token: link.token,
    side: link.side,
    label: link.label ?? null,
    expiresAt: link.expiresAt ?? null,
    revokedAt: link.revokedAt ?? null,
    disabledAt: link.disabledAt ?? null,
    hasPassword: Boolean(link.passwordHash),
    maxJoins: link.maxJoins ?? null,
    status: shareLinkStatus(link),
    viewCount: link.viewCount ?? 0,
    joinCount: link.joinCount ?? 0,
    lastAccessedAt: link.lastAccessedAt ?? null,
    createdAt: link.createdAt,
    requiresLogin: capabilitiesRequireLogin(link.capabilities),
    ...serializeGrant(link, link.capabilities)
  };
}

/** Usable link by token, or 404 (no distinction between unknown, revoked, paused, used and expired). */
async function loadUsableLink(token: string | undefined): Promise<ShareLinkDoc> {
  if (!token || token.length > 64) throw new ExpressError('Share link not found', 404);
  const link = await ProjectShareLinkModel.findOne({ token });
  if (!link || shareLinkStatus(link) !== 'active') {
    throw new ExpressError('This share link is no longer available', 404);
  }
  return link;
}

function requestAccessKey(req: Request): unknown {
  return req.query.access ?? (req.body as { access?: unknown } | undefined)?.access;
}

function isLinkUnlocked(link: ShareLinkDoc, req: Request): boolean {
  if (!link.passwordHash) return true;
  return verifyShareAccessKey(String(link._id), link.passwordHash, requestAccessKey(req));
}

/** 403 rather than 401: the web client treats 401 as an expired session. */
function assertLinkUnlocked(link: ShareLinkDoc, req: Request) {
  if (!isLinkUnlocked(link, req)) {
    throw new ExpressError('This link is password protected', 403);
  }
}

async function loadOpenLink(req: Request): Promise<ShareLinkDoc> {
  const link = await loadUsableLink(req.params.token);
  assertLinkUnlocked(link, req);
  return link;
}

function linkFileFilter(link: ShareLinkDoc): Record<string, unknown> {
  const filter: Record<string, unknown> = { projectId: link.projectId };
  if (link.fileIds?.length) filter._id = { $in: link.fileIds };
  return filter;
}

async function loadLinkFile(link: ShareLinkDoc, fileId: unknown) {
  if (typeof fileId !== 'string' || !mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ExpressError('File not found', 404);
  }
  const file = await ProjectFileModel.findOne({ ...linkFileFilter(link), _id: fileId });
  if (!file) throw new ExpressError('File not found', 404);
  return file;
}

const LINK_PROJECT_FIELDS = 'title studioName status paymentStatus downloadLock artworkStorageKey';

async function loadLinkProject(link: ShareLinkDoc) {
  const project = await RemoteProjectModel.findById(link.projectId).select(LINK_PROJECT_FIELDS);
  if (!project) throw new ExpressError('This share link is no longer available', 404);
  return project;
}

type LinkProject = Awaited<ReturnType<typeof loadLinkProject>>;

/** Link downloads follow the same rules as a collaborator on the link's side, including the lock. */
function linkCanDownloadFile(link: ShareLinkDoc, project: LinkProject, fileType: string): boolean {
  return canDownloadProjectFile(
    project,
    { side: link.side, canDownload: link.capabilities.includes('download') },
    fileType
  );
}

function applySettings(link: ShareLinkDoc, settings: ShareLinkSettings) {
  if (settings.label !== undefined) link.label = settings.label ?? undefined;
  if (settings.expiresAt !== undefined) link.expiresAt = settings.expiresAt ?? undefined;
  if (settings.password !== undefined) {
    link.passwordHash = settings.password ? hashSharePassword(settings.password) : undefined;
  }
  if (settings.maxJoins !== undefined) link.maxJoins = settings.maxJoins ?? undefined;
}

async function loadManagedLink(req: Request) {
  const { projectId, linkId } = req.params;
  const userId = getAuthUserId(req as AuthRequest);

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  const access = assertProjectAccess(project, userId, 'invite');

  if (!mongoose.Types.ObjectId.isValid(linkId)) throw new ExpressError('Share link not found', 404);
  const link = await ProjectShareLinkModel.findOne({ _id: linkId, projectId });
  if (!link) throw new ExpressError('Share link not found', 404);
  if (link.side !== access.side) throw new ExpressError('Forbidden', 403);
  assertGrantWithinAccess(access, link);

  return { project, link, userId, projectId, access };
}

// ============================================================
// Owner management (auth)
// ============================================================

/**
 * GET /api/remote-projects/:projectId/share-links
 */
const listShareLinks = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  const access = assertProjectAccess(project, getAuthUserId(req as AuthRequest), 'invite');

  const links = await ProjectShareLinkModel.find({ projectId, side: access.side }).sort({ createdAt: -1 });
  return { shareLinks: links.map(serializeLink) };
});

/**
 * POST /api/remote-projects/:projectId/share-links
 * Body: { role?, capabilities?, fileIds?, label?, expiresAt? | expiresInDays?, password?, maxJoins? }
 */
const createShareLink = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const userId = getAuthUserId(req as AuthRequest);

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  const access = assertProjectAccess(project, userId, 'invite');

  const grant = await parseProjectGrant(req.body, projectId);
  assertGrantWithinAccess(access, grant);
  const settings = parseShareLinkSettings(req.body ?? {});

  const activeCount = await ProjectShareLinkModel.countDocuments({
    projectId,
    revokedAt: { $exists: false },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }]
  });
  if (activeCount >= SHARE_LINK_MAX_PER_PROJECT) {
    throw new ExpressError(`Maximum ${SHARE_LINK_MAX_PER_PROJECT} active share links per project`, 400);
  }

  const link = new ProjectShareLinkModel({
    projectId,
    createdBy: userId,
    side: access.side,
    token: createShareToken(),
    capabilities: grant.capabilities,
    fileIds: grant.fileIds
  });
  applySettings(link, settings);
  await link.save();

  return { shareLink: serializeLink(link) };
});

/**
 * Edit a link's permissions and options. Members who already joined keep their own grant,
 * but follow the link's expiry.
 * PATCH /api/remote-projects/:projectId/share-links/:linkId
 * Body: any of { role?, capabilities?, fileIds?, label?, expiresAt?, password?, maxJoins?, active? }
 */
const updateShareLink = handleRequest(async (req: Request) => {
  const { project, link, projectId, access } = await loadManagedLink(req);
  if (link.revokedAt) throw new ExpressError('Revoked links cannot be edited', 400);

  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.role !== undefined || body.capabilities !== undefined || body.fileIds !== undefined) {
    const grant = await parseProjectGrant(
      {
        role: body.role,
        capabilities: body.capabilities ?? (body.role === undefined ? link.capabilities : undefined),
        fileIds: body.fileIds !== undefined ? body.fileIds : link.fileIds?.map(String)
      },
      projectId
    );
    assertGrantWithinAccess(access, grant);
    link.capabilities = grant.capabilities;
    link.fileIds = grant.fileIds as unknown as typeof link.fileIds;
  }

  const settings = parseShareLinkSettings(body);
  applySettings(link, settings);

  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new ExpressError('active must be a boolean', 400);
    link.disabledAt = body.active ? undefined : (link.disabledAt ?? new Date());
  }

  await link.save();

  if (settings.expiresAt !== undefined) {
    let changed = false;
    for (const collaborator of project.collaborators || []) {
      if (collaborator.status === 'active' && String(collaborator.shareLinkId) === String(link._id)) {
        collaborator.expiresAt = settings.expiresAt ?? undefined;
        changed = true;
      }
    }
    if (changed) {
      await project.save();
      emitProjectStatusUpdate(getProjectParticipantIds(project), projectId, project.status);
    }
  }

  return { shareLink: serializeLink(link) };
});

/**
 * Revoke a link and remove everyone who joined through it.
 * POST /api/remote-projects/:projectId/share-links/:linkId/revoke
 */
const revokeShareLink = handleRequest(async (req: Request) => {
  const { project, link, userId, projectId } = await loadManagedLink(req);

  const participantsBefore = getProjectParticipantIds(project);

  if (!link.revokedAt) {
    link.revokedAt = new Date();
    link.revokedBy = userId;
    await link.save();
  }

  let removedCount = 0;
  for (const collaborator of project.collaborators || []) {
    if (collaborator.status === 'active' && String(collaborator.shareLinkId) === String(link._id)) {
      collaborator.status = 'removed';
      removedCount += 1;
    }
  }
  if (removedCount > 0) await project.save();

  emitProjectStatusUpdate(participantsBefore, projectId, project.status);
  return { revoked: true, removedCollaborators: removedCount };
});

// ============================================================
// Public (no auth) — anyone holding a usable (and unlocked) link
// ============================================================

/**
 * GET /api/remote-projects/share/:token
 * Password-protected links answer `{ passwordRequired: true }` until unlocked.
 */
const getSharedProject = handleRequest(async (req: Request) => {
  const link = await loadUsableLink(req.params.token);
  if (!isLinkUnlocked(link, req)) {
    return { passwordRequired: true, shareLink: { label: link.label ?? null } };
  }
  const project = await loadLinkProject(link);

  const fileDocs = await ProjectFileModel.find(linkFileFilter(link))
    .sort({ createdAt: -1 })
    .select(SHARED_FILE_FIELDS);
  const files = fileDocs.map((file) => ({
    ...file.toObject(),
    downloadable: linkCanDownloadFile(link, project, file.type)
  }));

  let artworkUrl: string | undefined;
  if (project.artworkStorageKey && isStorageConfigured()) {
    try {
      artworkUrl = await getStorageDownloadUrl(project.artworkStorageKey, { inline: true });
    } catch (error) {
      console.error('Failed to sign shared project artwork URL:', error);
    }
  }

  await ProjectShareLinkModel.updateOne(
    { _id: link._id },
    { $inc: { viewCount: 1 }, $set: { lastAccessedAt: new Date() } }
  );

  const { role, capabilities } = serializeGrant(link, link.capabilities);
  const canDownload = capabilities.includes('download');
  return {
    passwordRequired: false,
    shareLink: {
      role,
      capabilities,
      side: link.side,
      label: link.label ?? null,
      expiresAt: link.expiresAt ?? null,
      requiresLogin: capabilitiesRequireLogin(capabilities),
      canDownload,
      canComment: capabilities.includes('comment'),
      downloadsLocked: canDownload && files.some((f) => !f.downloadable)
    },
    project: {
      _id: project._id,
      title: project.title,
      status: project.status,
      studioName: project.studioName,
      artworkUrl
    },
    files
  };
});

/**
 * POST /api/remote-projects/share/:token/unlock  { password }
 */
const unlockSharedProject = handleRequest(async (req: Request) => {
  const link = await loadUsableLink(req.params.token);
  if (!link.passwordHash) return { accessKey: null, expiresIn: null };

  const password = (req.body as { password?: unknown } | undefined)?.password;
  if (typeof password !== 'string' || !verifySharePassword(password, link.passwordHash)) {
    throw new ExpressError('Incorrect password', 403);
  }
  return createShareAccessKey(String(link._id), link.passwordHash);
});

async function signSharedFile(req: Request, intent: 'stream' | 'download') {
  if (!isStorageConfigured()) throw new ExpressError('File storage is not configured', 503);
  const link = await loadOpenLink(req);
  const [project, file] = await Promise.all([loadLinkProject(link), loadLinkFile(link, req.params.fileId)]);
  const downloadable = linkCanDownloadFile(link, project, file.type);

  if (intent === 'download' && !downloadable) {
    throw new ExpressError(
      link.capabilities.includes('download')
        ? 'Downloads are locked until the project is approved or paid'
        : 'This link does not allow downloads',
      403
    );
  }

  const { downloadUrl, expiresIn, quality } = await getOriginalStreamUrl(file, { restricted: !downloadable });
  return {
    downloadUrl,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    expiresIn,
    locked: !downloadable,
    quality,
    intent
  };
}

/**
 * Original-quality stream URL (inline and shorter-lived unless the link may download this file).
 * GET /api/remote-projects/share/:token/files/:fileId/stream
 */
const streamSharedFile = handleRequest(async (req: Request) => signSharedFile(req, 'stream'));

/**
 * GET /api/remote-projects/share/:token/files/:fileId/download
 */
const downloadSharedFile = handleRequest(async (req: Request) => signSharedFile(req, 'download'));

/**
 * GET /api/remote-projects/share/:token/files/:fileId/waveform
 */
const getSharedFileWaveform = handleRequest(async (req: Request) => {
  const link = await loadOpenLink(req);
  const file = await loadLinkFile(link, req.params.fileId);
  if (!isStorageConfigured()) {
    return { fileId: file._id, status: 'unsupported', reason: 'storage_unavailable' };
  }
  return buildWaveformResponse(file);
});

/**
 * GET /api/remote-projects/share/:token/files/:fileId/audio-meta
 */
const getSharedFileAudioMeta = handleRequest(async (req: Request) => {
  if (!isStorageConfigured()) throw new ExpressError('File storage is not configured', 503);
  const link = await loadOpenLink(req);
  const file = await loadLinkFile(link, req.params.fileId);

  const meta = await parseAudioMetaFromStorage(file.storageKey, file.fileName, file.mimeType, file.fileSize);
  if (!meta) throw new ExpressError('Audio metadata is not available for this file type', 422);

  return {
    fileId: file._id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    ...meta
  };
});

// ============================================================
// Guest comments (no auth) — every track comment on the link's files, like a Samply player.
// General project chat stays private to members.
// ============================================================

function assertLinkCanComment(link: ShareLinkDoc) {
  if (!link.capabilities.includes('comment')) {
    throw new ExpressError('This link does not allow comments', 403);
  }
}

/**
 * GET /api/remote-projects/share/:token/messages
 */
const getSharedMessages = handleRequest(async (req: Request) => {
  const link = await loadOpenLink(req);
  assertLinkCanComment(link);

  const visibleFileIds = await ProjectFileModel.find(linkFileFilter(link)).distinct('_id');
  const messages = await ProjectMessageModel.find({
    projectId: link.projectId,
    fileId: { $in: visibleFileIds }
  })
    .sort({ createdAt: 1 })
    .limit(1000)
    .select('-readAt -attachmentIds')
    .populate('senderId', 'name');

  return { messages };
});

/**
 * POST /api/remote-projects/share/:token/messages
 * Body: { guestName, message, fileId?, offsetSeconds?, parentId? }
 */
const sendSharedMessage = handleRequest(async (req: Request) => {
  const link = await loadOpenLink(req);
  assertLinkCanComment(link);

  const body = (req.body ?? {}) as Record<string, unknown>;
  const guestName = parseGuestName(body.guestName);
  const text = typeof body.message === 'string' ? body.message.trim() : '';
  if (!text) throw new ExpressError('Message content is required', 400);
  if (text.length > SHARE_GUEST_MESSAGE_MAX_LENGTH) {
    throw new ExpressError(`Comments can be at most ${SHARE_GUEST_MESSAGE_MAX_LENGTH} characters`, 400);
  }

  let fileId: unknown = body.fileId;
  let offsetSeconds: number | undefined;
  let parentId: mongoose.Types.ObjectId | undefined;

  if (body.parentId !== undefined && body.parentId !== null && body.parentId !== '') {
    if (typeof body.parentId !== 'string' || !mongoose.Types.ObjectId.isValid(body.parentId)) {
      throw new ExpressError('Invalid parent message ID', 400);
    }
    const parent = await ProjectMessageModel.findOne({
      _id: body.parentId,
      projectId: link.projectId,
      parentId: { $exists: false }
    });
    if (!parent?.fileId) throw new ExpressError('Parent comment not found', 404);
    parentId = new mongoose.Types.ObjectId(String(parent._id));
    fileId = String(parent.fileId);
    offsetSeconds = typeof parent.offsetSeconds === 'number' ? parent.offsetSeconds : undefined;
  } else {
    const offset = Number(body.offsetSeconds);
    if (body.offsetSeconds === undefined || !Number.isFinite(offset) || offset < 0) {
      throw new ExpressError('Track comments require an offsetSeconds timestamp', 400);
    }
    offsetSeconds = offset;
  }

  const file = await loadLinkFile(link, fileId);

  const message = await ProjectMessageModel.create({
    projectId: link.projectId,
    senderRole: link.side === 'vendor' ? 'vendor_guest' : 'customer_guest',
    guestName,
    shareLinkId: link._id,
    message: text,
    fileId: file._id,
    ...(offsetSeconds !== undefined ? { offsetSeconds } : {}),
    ...(parentId ? { parentId } : {})
  });

  const project = await RemoteProjectModel.findById(link.projectId);
  if (project) {
    const projectId = String(project._id);
    const participants = getProjectParticipantIds(project);
    emitProjectMessageUpdate(participants, projectId);

    const preview = text.length > 140 ? `${text.slice(0, 137)}…` : text;
    const senderName = `${guestName} (guest)`;
    const messageId = String(message._id);
    const results = await Promise.allSettled(
      participants.map((recipientId) =>
        createAndEmitNotification(
          recipientId,
          parentId ? 'project_comment_reply' : 'project_track_comment',
          parentId ? 'New reply on a track comment' : 'New track comment',
          `${senderName} commented on ${file.fileName}: ${preview}`,
          {
            projectId,
            messageId,
            fileId: String(file._id),
            fileName: file.fileName,
            ...(parentId ? { parentId: String(parentId) } : {}),
            senderName,
            projectTitle: project.title,
            messagePreview: preview
          },
          `/projects/${projectId}?messageId=${messageId}&fileId=${String(file._id)}`
        )
      )
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('Failed to create guest comment notification:', result.reason);
      }
    }
  }

  return message;
});

// ============================================================
// Join (auth) — links that grant uploading or editing
// ============================================================

/**
 * POST /api/remote-projects/share/:token/join
 * Existing participants keep their current access (owners change roles explicitly).
 */
const joinSharedProject = handleRequest(async (req: Request) => {
  const userId = getAuthUserId(req as AuthRequest);
  const link = await loadOpenLink(req);

  if (!capabilitiesRequireLogin(link.capabilities)) {
    throw new ExpressError('This link works without an account and does not grant project membership', 400);
  }

  const project = await RemoteProjectModel.findById(link.projectId);
  if (!project) throw new ExpressError('This share link is no longer available', 404);
  const projectId = String(project._id);

  if (String(project.customerId) === userId || String(project.vendorId) === userId) {
    return { projectId, alreadyMember: true };
  }
  if (findActiveCollaborator(project, userId)) {
    return { projectId, alreadyMember: true };
  }

  assertCollaboratorCapacity(project, link.side);

  // Claim a join slot atomically so a single-use link can't be used twice concurrently.
  const claimed = await ProjectShareLinkModel.findOneAndUpdate(
    {
      _id: link._id,
      $or: [{ maxJoins: { $exists: false } }, { maxJoins: null }, { $expr: { $lt: ['$joinCount', '$maxJoins'] } }]
    },
    { $inc: { joinCount: 1 }, $set: { lastAccessedAt: new Date() } }
  );
  if (!claimed) throw new ExpressError('This link has already been used', 410);

  upsertCollaborator(project, {
    userId: new mongoose.Types.ObjectId(userId),
    side: link.side,
    invitedBy: link.createdBy,
    capabilities: [...link.capabilities],
    fileIds: link.fileIds?.length ? [...link.fileIds] : undefined,
    expiresAt: link.expiresAt ?? undefined,
    shareLinkId: link._id
  });
  try {
    await project.save();
  } catch (error) {
    await ProjectShareLinkModel.updateOne({ _id: link._id }, { $inc: { joinCount: -1 } });
    throw error;
  }

  emitProjectStatusUpdate(getProjectParticipantIds(project), projectId, project.status);

  return { projectId, alreadyMember: false };
});

export default {
  listShareLinks,
  createShareLink,
  updateShareLink,
  revokeShareLink,
  getSharedProject,
  unlockSharedProject,
  streamSharedFile,
  downloadSharedFile,
  getSharedFileWaveform,
  getSharedFileAudioMeta,
  getSharedMessages,
  sendSharedMessage,
  joinSharedProject
};
