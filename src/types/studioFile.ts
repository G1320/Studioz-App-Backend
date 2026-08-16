export interface StudioFile {
  _id: string;
  studioId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  createdAt?: Date;
  updatedAt?: Date;
}
