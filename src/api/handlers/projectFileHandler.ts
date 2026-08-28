import { Request } from 'express';
import mongoose from 'mongoose';
import { ProjectFileModel } from '../../models/projectFileModel.js';
import { RemoteProjectModel } from '../../models/remoteProjectModel.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import {
  generateStorageKey,
  getUploadUrl as getStorageUploadUrl,
  getDownloadUrl as getStorageDownloadUrl,
  deleteFile as deleteStorageFile,
  isStorageConfigured
} from '../../services/storageService.js';
import { parseAudioMetaFromStorage } from '../../services/audioMetaService.js';
import { emitProjectFileUpdate } from '../../webSockets/socket.js';
import {
  REMOTE_PROJECT_ACCEPTED_FILE_TYPES,
  REMOTE_PROJECT_MAX_FILE_SIZE_MB,
  REMOTE_PROJECT_MAX_FILES_PER_PROJECT
} from '../../constants/remoteProjectFileLimits.js';
import {
  assertProjectAccess,
  getAuthUserId,
  getProjectParticipantIds
} from '../../services/projectAccessService.js';

interface AuthRequest extends Request {
  decodedJwt?: { _id?: string; userId?: string };
}

const getUploadUrl = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { fileName, fileSize, mimeType, type } = req.body;
  const userId = getAuthUserId(req as AuthRequest);

  if (!isStorageConfigured()) {
    throw new ExpressError('File storage is not configured', 503);
  }

  if (!fileName) throw new ExpressError('File name is required', 400);
  if (!fileSize) throw new ExpressError('File size is required', 400);
  if (!mimeType) throw new ExpressError('MIME type is required', 400);
  if (!type || !['source', 'deliverable', 'revision'].includes(type)) {
    throw new ExpressError('Valid file type (source, deliverable, revision) is required', 400);
  }

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  assertProjectAccess(project, userId, 'files');

  const item = await ItemModel.findById(project.itemId);
  const maxFileSize = (item?.maxFileSize || REMOTE_PROJECT_MAX_FILE_SIZE_MB) * 1024 * 1024;
  const maxFilesPerProject = item?.maxFilesPerProject || REMOTE_PROJECT_MAX_FILES_PER_PROJECT;
  const acceptedFileTypes = item?.acceptedFileTypes || [...REMOTE_PROJECT_ACCEPTED_FILE_TYPES];

  if (fileSize > maxFileSize) {
    throw new ExpressError(
      `File size exceeds maximum allowed (${item?.maxFileSize || REMOTE_PROJECT_MAX_FILE_SIZE_MB}MB)`,
      400
    );
  }

  const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase();
  if (!acceptedFileTypes.includes(fileExtension)) {
    throw new ExpressError(
      `File type not allowed. Accepted types: ${acceptedFileTypes.join(', ')}`,
      400
    );
  }

  const currentFileCount = await ProjectFileModel.countDocuments({ projectId });
  if (currentFileCount >= maxFilesPerProject) {
    throw new ExpressError(`Maximum file limit reached (${maxFilesPerProject} files)`, 400);
  }

  const fileId = new mongoose.Types.ObjectId().toString();
  const storageKey = generateStorageKey(projectId, type, fileName, fileId);
  const { uploadUrl } = await getStorageUploadUrl(storageKey, mimeType, fileSize);

  return {
    uploadUrl,
    storageKey,
    fileId,
    expiresIn: 3600
  };
});

const registerFile = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { fileId, fileName, fileSize, mimeType, storageKey, type, description, revisionNumber } = req.body;
  const userId = getAuthUserId(req as AuthRequest);

  if (!fileName) throw new ExpressError('File name is required', 400);
  if (!fileSize) throw new ExpressError('File size is required', 400);
  if (!mimeType) throw new ExpressError('MIME type is required', 400);
  if (!storageKey) throw new ExpressError('Storage key is required', 400);
  if (!type || !['source', 'deliverable', 'revision'].includes(type)) {
    throw new ExpressError('Valid file type is required', 400);
  }

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  assertProjectAccess(project, userId, 'files');

  const file = new ProjectFileModel({
    _id: fileId ? new mongoose.Types.ObjectId(fileId) : new mongoose.Types.ObjectId(),
    projectId,
    uploadedBy: userId,
    type,
    fileName,
    fileSize,
    mimeType,
    storageKey,
    description,
    revisionNumber: type === 'revision' ? revisionNumber || project.revisionsUsed : undefined
  });

  await file.save();

  emitProjectFileUpdate(getProjectParticipantIds(project), projectId);

  return file;
});

const getProjectFiles = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { type } = req.query;
  const userId = getAuthUserId(req as AuthRequest);

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  assertProjectAccess(project, userId, 'view');

  const filter: Record<string, unknown> = { projectId };
  if (type && ['source', 'deliverable', 'revision'].includes(type as string)) {
    filter.type = type;
  }

  const files = await ProjectFileModel.find(filter).sort({ createdAt: -1 }).populate('uploadedBy', 'name');

  return { files };
});

const getDownloadUrl = handleRequest(async (req: Request) => {
  const { projectId, fileId } = req.params;
  const userId = getAuthUserId(req as AuthRequest);

  if (!isStorageConfigured()) {
    throw new ExpressError('File storage is not configured', 503);
  }

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  assertProjectAccess(project, userId, 'files');

  const file = await ProjectFileModel.findOne({ _id: fileId, projectId });
  if (!file) throw new ExpressError('File not found', 404);

  const downloadUrl = await getStorageDownloadUrl(file.storageKey);

  return {
    downloadUrl,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    expiresIn: 86400
  };
});

const getAudioMeta = handleRequest(async (req: Request) => {
  const { projectId, fileId } = req.params;
  const userId = getAuthUserId(req as AuthRequest);

  if (!isStorageConfigured()) {
    throw new ExpressError('File storage is not configured', 503);
  }

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  assertProjectAccess(project, userId, 'view');

  const file = await ProjectFileModel.findOne({ _id: fileId, projectId });
  if (!file) throw new ExpressError('File not found', 404);

  const meta = await parseAudioMetaFromStorage(
    file.storageKey,
    file.fileName,
    file.mimeType,
    file.fileSize
  );

  if (!meta) {
    throw new ExpressError('Audio metadata is not available for this file type', 422);
  }

  return {
    fileId: file._id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    ...meta
  };
});

const deleteFile = handleRequest(async (req: Request) => {
  const { projectId, fileId } = req.params;
  const userId = getAuthUserId(req as AuthRequest);

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  assertProjectAccess(project, userId, 'files');

  const file = await ProjectFileModel.findOne({ _id: fileId, projectId });
  if (!file) throw new ExpressError('File not found', 404);

  if (isStorageConfigured()) {
    try {
      await deleteStorageFile(file.storageKey);
    } catch (error) {
      console.error('Error deleting file from R2:', error);
    }
  }

  await ProjectFileModel.deleteOne({ _id: fileId });

  emitProjectFileUpdate(getProjectParticipantIds(project), projectId);

  return null;
});

export default {
  getUploadUrl,
  registerFile,
  getProjectFiles,
  getDownloadUrl,
  getAudioMeta,
  deleteFile
};
