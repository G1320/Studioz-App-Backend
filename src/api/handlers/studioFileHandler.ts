import { Request } from 'express';
import mongoose from 'mongoose';
import { StudioFileModel } from '../../models/studioFileModel.js';
import { StudioModel } from '../../models/studioModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import {
  generateStudioPortfolioStorageKey,
  getUploadUrl as getStorageUploadUrl,
  getDownloadUrl as getStorageDownloadUrl,
  deleteFile as deleteStorageFile,
  isStorageConfigured,
} from '../../services/storageService.js';
import { parseAudioMetaFromStorage } from '../../services/audioMetaService.js';
import {
  STUDIO_PORTFOLIO_ACCEPTED_FILE_TYPES,
  STUDIO_PORTFOLIO_MAX_FILE_SIZE_MB,
  STUDIO_PORTFOLIO_MAX_FILES,
} from '../../constants/studioPortfolioFileLimits.js';

interface AuthRequest extends Request {
  decodedJwt?: { _id?: string; userId?: string };
}

function getAuthUserId(req: AuthRequest): string {
  const userId = req.decodedJwt?._id || req.decodedJwt?.userId;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }
  return String(userId);
}

async function requireStudio(studioId: string) {
  const studio = await StudioModel.findById(studioId);
  if (!studio) {
    throw new ExpressError('Studio not found', 404);
  }
  return studio;
}

async function requireStudioOwner(studioId: string, userId: string) {
  const studio = await requireStudio(studioId);
  if (studio.createdBy?.toString() !== userId) {
    throw new ExpressError('You do not have permission to manage this studio portfolio', 403);
  }
  return studio;
}

function assertAcceptedExtension(fileName: string) {
  const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase();
  if (!(STUDIO_PORTFOLIO_ACCEPTED_FILE_TYPES as readonly string[]).includes(fileExtension)) {
    throw new ExpressError(
      `File type not allowed. Accepted types: ${STUDIO_PORTFOLIO_ACCEPTED_FILE_TYPES.join(', ')}`,
      400
    );
  }
}

/**
 * POST /api/studios/:studioId/files/upload-url
 */
const getUploadUrl = handleRequest(async (req: AuthRequest) => {
  const { studioId } = req.params;
  const { fileName, fileSize, mimeType } = req.body;
  const userId = getAuthUserId(req);

  if (!isStorageConfigured()) {
    throw new ExpressError('File storage is not configured', 503);
  }

  if (!fileName) throw new ExpressError('File name is required', 400);
  if (!fileSize) throw new ExpressError('File size is required', 400);
  if (!mimeType) throw new ExpressError('MIME type is required', 400);

  await requireStudioOwner(studioId, userId);
  assertAcceptedExtension(fileName);

  const maxBytes = STUDIO_PORTFOLIO_MAX_FILE_SIZE_MB * 1024 * 1024;
  if (fileSize > maxBytes) {
    throw new ExpressError(
      `File size exceeds maximum allowed (${STUDIO_PORTFOLIO_MAX_FILE_SIZE_MB}MB)`,
      400
    );
  }

  const currentFileCount = await StudioFileModel.countDocuments({ studioId });
  if (currentFileCount >= STUDIO_PORTFOLIO_MAX_FILES) {
    throw new ExpressError(
      `Maximum file limit reached (${STUDIO_PORTFOLIO_MAX_FILES} files)`,
      400
    );
  }

  const fileId = new mongoose.Types.ObjectId().toString();
  const storageKey = generateStudioPortfolioStorageKey(studioId, fileName, fileId);
  const { uploadUrl } = await getStorageUploadUrl(storageKey, mimeType, fileSize);

  return {
    uploadUrl,
    storageKey,
    fileId,
    expiresIn: 3600,
  };
});

/**
 * POST /api/studios/:studioId/files
 */
const registerFile = handleRequest(async (req: AuthRequest) => {
  const { studioId } = req.params;
  const { fileId, fileName, fileSize, mimeType, storageKey } = req.body;
  const userId = getAuthUserId(req);

  if (!fileName) throw new ExpressError('File name is required', 400);
  if (!fileSize) throw new ExpressError('File size is required', 400);
  if (!mimeType) throw new ExpressError('MIME type is required', 400);
  if (!storageKey) throw new ExpressError('Storage key is required', 400);

  await requireStudioOwner(studioId, userId);
  assertAcceptedExtension(fileName);

  const expectedPrefix = `studios/${studioId}/portfolio/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    throw new ExpressError('Invalid storage key', 400);
  }

  const file = new StudioFileModel({
    _id: fileId ? new mongoose.Types.ObjectId(fileId) : new mongoose.Types.ObjectId(),
    studioId,
    uploadedBy: userId,
    fileName,
    fileSize,
    mimeType,
    storageKey,
  });

  await file.save();
  return file;
});

/**
 * GET /api/studios/:studioId/files (public — portfolio playback)
 */
const getStudioFiles = handleRequest(async (req: Request) => {
  const { studioId } = req.params;
  await requireStudio(studioId);

  const files = await StudioFileModel.find({ studioId }).sort({ createdAt: -1 });
  return { files };
});

/**
 * GET /api/studios/:studioId/files/:fileId/download (public)
 */
const getDownloadUrl = handleRequest(async (req: Request) => {
  const { studioId, fileId } = req.params;

  if (!isStorageConfigured()) {
    throw new ExpressError('File storage is not configured', 503);
  }

  const file = await StudioFileModel.findOne({ _id: fileId, studioId });
  if (!file) throw new ExpressError('File not found', 404);

  const downloadUrl = await getStorageDownloadUrl(file.storageKey);

  return {
    downloadUrl,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    expiresIn: 86400,
  };
});

/**
 * GET /api/studios/:studioId/files/:fileId/audio-meta (public)
 */
const getAudioMeta = handleRequest(async (req: Request) => {
  const { studioId, fileId } = req.params;

  if (!isStorageConfigured()) {
    throw new ExpressError('File storage is not configured', 503);
  }

  const file = await StudioFileModel.findOne({ _id: fileId, studioId });
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
    ...meta,
  };
});

/**
 * DELETE /api/studios/:studioId/files/:fileId
 */
const deleteFile = handleRequest(async (req: AuthRequest) => {
  const { studioId, fileId } = req.params;
  const userId = getAuthUserId(req);

  await requireStudioOwner(studioId, userId);

  const file = await StudioFileModel.findOne({ _id: fileId, studioId });
  if (!file) throw new ExpressError('File not found', 404);

  if (isStorageConfigured()) {
    try {
      await deleteStorageFile(file.storageKey);
    } catch (error) {
      console.error('Error deleting studio portfolio file from R2:', error);
    }
  }

  await StudioFileModel.deleteOne({ _id: fileId });
  return null;
});

export default {
  getUploadUrl,
  registerFile,
  getStudioFiles,
  getDownloadUrl,
  getAudioMeta,
  deleteFile,
};
