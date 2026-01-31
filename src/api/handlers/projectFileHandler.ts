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
  isStorageConfigured,
} from '../../services/storageService.js';

// Default file constraints
const DEFAULT_MAX_FILE_SIZE = 500; // MB
const DEFAULT_MAX_FILES_PER_PROJECT = 50;
const DEFAULT_ACCEPTED_TYPES = ['.wav', '.aif', '.aiff', '.mp3', '.flac', '.ogg', '.m4a', '.zip'];

/**
 * Get a presigned URL for uploading a file
 * POST /api/remote-projects/:projectId/files/upload-url
 */
const getUploadUrl = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { fileName, fileSize, mimeType, type, description } = req.body;

  if (!isStorageConfigured()) {
    throw new ExpressError('File storage is not configured', 503);
  }

  if (!fileName) throw new ExpressError('File name is required', 400);
  if (!fileSize) throw new ExpressError('File size is required', 400);
  if (!mimeType) throw new ExpressError('MIME type is required', 400);
  if (!type || !['source', 'deliverable', 'revision'].includes(type)) {
    throw new ExpressError('Valid file type (source, deliverable, revision) is required', 400);
  }

  // Validate project exists and is in valid state
  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  // Get file constraints from item or use defaults
  const item = await ItemModel.findById(project.itemId);
  const maxFileSize = (item?.maxFileSize || DEFAULT_MAX_FILE_SIZE) * 1024 * 1024; // Convert MB to bytes
  const maxFilesPerProject = item?.maxFilesPerProject || DEFAULT_MAX_FILES_PER_PROJECT;
  const acceptedFileTypes = item?.acceptedFileTypes || DEFAULT_ACCEPTED_TYPES;

  // Validate file size
  if (fileSize > maxFileSize) {
    throw new ExpressError(
      `File size exceeds maximum allowed (${item?.maxFileSize || DEFAULT_MAX_FILE_SIZE}MB)`,
      400
    );
  }

  // Validate file extension
  const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase();
  if (!acceptedFileTypes.includes(fileExtension)) {
    throw new ExpressError(
      `File type not allowed. Accepted types: ${acceptedFileTypes.join(', ')}`,
      400
    );
  }

  // Check file count limit
  const currentFileCount = await ProjectFileModel.countDocuments({ projectId });
  if (currentFileCount >= maxFilesPerProject) {
    throw new ExpressError(
      `Maximum file limit reached (${maxFilesPerProject} files)`,
      400
    );
  }

  // Generate a unique file ID
  const fileId = new mongoose.Types.ObjectId().toString();

  // Generate storage key
  const storageKey = generateStorageKey(projectId, type, fileName, fileId);

  // Get presigned upload URL from R2
  const { uploadUrl } = await getStorageUploadUrl(storageKey, mimeType, fileSize);

  return {
    uploadUrl,
    storageKey,
    fileId,
    expiresIn: 3600, // 1 hour
  };
});

/**
 * Register a file after successful upload
 * POST /api/remote-projects/:projectId/files
 */
const registerFile = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { fileId, fileName, fileSize, mimeType, storageKey, type, description, revisionNumber } = req.body;

  if (!fileName) throw new ExpressError('File name is required', 400);
  if (!fileSize) throw new ExpressError('File size is required', 400);
  if (!mimeType) throw new ExpressError('MIME type is required', 400);
  if (!storageKey) throw new ExpressError('Storage key is required', 400);
  if (!type || !['source', 'deliverable', 'revision'].includes(type)) {
    throw new ExpressError('Valid file type is required', 400);
  }

  // Validate project exists
  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  // Determine uploadedBy based on file type
  // source files = customer, deliverable/revision = vendor
  const uploadedBy = type === 'source' ? project.customerId : project.vendorId;

  // Create file record
  const file = new ProjectFileModel({
    _id: fileId ? new mongoose.Types.ObjectId(fileId) : new mongoose.Types.ObjectId(),
    projectId,
    uploadedBy,
    type,
    fileName,
    fileSize,
    mimeType,
    storageKey,
    description,
    revisionNumber: type === 'revision' ? revisionNumber || project.revisionsUsed : undefined,
  });

  await file.save();

  // TODO: Send notification about new file upload

  return file;
});

/**
 * Get all files for a project
 * GET /api/remote-projects/:projectId/files
 */
const getProjectFiles = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { type } = req.query;

  // Validate project exists
  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  // Build filter
  const filter: Record<string, unknown> = { projectId };
  if (type && ['source', 'deliverable', 'revision'].includes(type as string)) {
    filter.type = type;
  }

  const files = await ProjectFileModel.find(filter)
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name');

  return { files };
});

/**
 * Get a presigned download URL for a file
 * GET /api/remote-projects/:projectId/files/:fileId/download
 */
const getDownloadUrl = handleRequest(async (req: Request) => {
  const { projectId, fileId } = req.params;

  if (!isStorageConfigured()) {
    throw new ExpressError('File storage is not configured', 503);
  }

  // Validate file exists and belongs to project
  const file = await ProjectFileModel.findOne({
    _id: fileId,
    projectId,
  });

  if (!file) throw new ExpressError('File not found', 404);

  // Generate presigned download URL
  const downloadUrl = await getStorageDownloadUrl(file.storageKey);

  return {
    downloadUrl,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    expiresIn: 86400, // 24 hours
  };
});

/**
 * Delete a file
 * DELETE /api/remote-projects/:projectId/files/:fileId
 */
const deleteFile = handleRequest(async (req: Request) => {
  const { projectId, fileId } = req.params;

  // Validate file exists and belongs to project
  const file = await ProjectFileModel.findOne({
    _id: fileId,
    projectId,
  });

  if (!file) throw new ExpressError('File not found', 404);

  // Delete from R2 storage
  if (isStorageConfigured()) {
    try {
      await deleteStorageFile(file.storageKey);
    } catch (error) {
      console.error('Error deleting file from R2:', error);
      // Continue with database deletion even if R2 deletion fails
    }
  }

  // Delete from database
  await ProjectFileModel.deleteOne({ _id: fileId });

  return null; // Returns 204 No Content
});

export default {
  getUploadUrl,
  registerFile,
  getProjectFiles,
  getDownloadUrl,
  deleteFile,
};
