import mongoose, { Model, Document } from 'mongoose';
import { StudioFile } from '../types/studioFile.js';

const StudioFileSchema = new mongoose.Schema(
  {
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Studio',
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    storageKey: { type: String, required: true },
  },
  { timestamps: true }
);

StudioFileSchema.index({ studioId: 1, createdAt: -1 });
StudioFileSchema.index({ studioId: 1, storageKey: 1 }, { unique: true });

const StudioFileModel: Model<StudioFile & Document> =
  mongoose.models.StudioFile ||
  mongoose.model<StudioFile & Document>('StudioFile', StudioFileSchema);

export { StudioFileModel };
