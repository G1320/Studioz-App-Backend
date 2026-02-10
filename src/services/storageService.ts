import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 Configuration
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'studios-remote-projects';

// URL expiry times (in seconds)
const UPLOAD_URL_EXPIRY = parseInt(process.env.R2_UPLOAD_URL_EXPIRY || '3600', 10); // 1 hour
const DOWNLOAD_URL_EXPIRY = parseInt(process.env.R2_DOWNLOAD_URL_EXPIRY || '86400', 10); // 24 hours

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
  // Disable SDK checksums for R2 compatibility (prevents CORS issues)
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

/**
 * Check if R2 storage is configured
 */
export function isStorageConfigured(): boolean {
  return !!(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

/**
 * Generate a storage key for a project file
 * @param projectId - The project ID
 * @param fileType - 'source' | 'deliverable' | 'revision'
 * @param fileName - Original file name
 * @param fileId - Unique file ID (generated before calling this)
 */
export function generateStorageKey(
  projectId: string,
  fileType: 'source' | 'deliverable' | 'revision',
  fileName: string,
  fileId: string
): string {
  // Sanitize filename for URL safety
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const folder = fileType === 'source' ? 'source' : 'deliverables';
  return `${projectId}/${folder}/${fileId}-${sanitizedName}`;
}

/**
 * Generate a presigned URL for uploading a file directly to R2
 * Client can use this URL to upload the file via PUT request
 */
export async function getUploadUrl(
  storageKey: string,
  contentType: string,
  contentLength?: number
): Promise<{ uploadUrl: string; storageKey: string }> {
  if (!isStorageConfigured()) {
    throw new Error('R2 storage is not configured');
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
    ContentType: contentType,
    ...(contentLength && { ContentLength: contentLength }),
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: UPLOAD_URL_EXPIRY,
  });

  return { uploadUrl, storageKey };
}

/**
 * Generate a presigned URL for downloading a file from R2
 */
export async function getDownloadUrl(storageKey: string): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error('R2 storage is not configured');
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
  });

  const downloadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: DOWNLOAD_URL_EXPIRY,
  });

  return downloadUrl;
}

/**
 * Check if a file exists in R2
 */
export async function fileExists(storageKey: string): Promise<boolean> {
  if (!isStorageConfigured()) {
    throw new Error('R2 storage is not configured');
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
    });
    await r2Client.send(command);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFile(storageKey: string): Promise<void> {
  if (!isStorageConfigured()) {
    throw new Error('R2 storage is not configured');
  }

  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
  });

  await r2Client.send(command);
}

/**
 * Delete all files for a project from R2 (cleanup on project deletion).
 * Caller is responsible for deleting ProjectFile records from the database.
 */
export async function deleteProjectFiles(projectId: string): Promise<void> {
  if (!isStorageConfigured()) {
    throw new Error('R2 storage is not configured');
  }

  const prefix = `${projectId}/`;
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await r2Client.send(command);
    const objects = response.Contents || [];

    for (const obj of objects) {
      if (obj.Key) {
        await deleteFile(obj.Key);
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
}

/**
 * Get file metadata from R2
 */
export async function getFileMetadata(
  storageKey: string
): Promise<{ contentLength: number; contentType: string } | null> {
  if (!isStorageConfigured()) {
    throw new Error('R2 storage is not configured');
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
    });
    const response = await r2Client.send(command);
    return {
      contentLength: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      return null;
    }
    throw error;
  }
}

// Export for use in tests
export { r2Client, R2_BUCKET_NAME };
