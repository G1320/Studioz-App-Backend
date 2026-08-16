export type StudioPortfolioRole = 'mixed' | 'mastered' | 'recorded' | 'produced';

export interface StudioFile {
  _id: string;
  studioId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  role?: StudioPortfolioRole;
  createdAt?: Date;
  updatedAt?: Date;
}
