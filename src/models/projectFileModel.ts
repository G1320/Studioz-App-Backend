import mongoose, { Model, Schema, Document } from 'mongoose';
import { ProjectFile } from '../types/remoteProject.js';

const ProjectFileSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RemoteProject',
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['source', 'deliverable', 'revision'],
      required: true,
    },

    // File info
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },

    // Storage (Cloudflare R2)
    storageKey: { type: String, required: true },

    // Metadata
    description: { type: String, required: false },
    revisionNumber: { type: Number, required: false },

    // Waveform peaks (0–255, mono max-abs per bucket) rendered by the player
    waveformStatus: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed', 'unsupported'],
      required: false,
    },
    waveform: {
      type: new Schema(
        {
          version: { type: Number, required: true },
          peaks: { type: [Number], required: true },
          durationMs: { type: Number, required: false },
          sampleRate: { type: Number, required: false },
          channels: { type: Number, required: false },
          generatedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      required: false,
    },
    waveformError: { type: String, required: false },
  },
  { timestamps: true }
);

// Database indexes for query performance
ProjectFileSchema.index({ projectId: 1 });
ProjectFileSchema.index({ uploadedBy: 1 });
ProjectFileSchema.index({ type: 1 });
ProjectFileSchema.index({ projectId: 1, type: 1 });

const ProjectFileModel: Model<ProjectFile & Document> =
  mongoose.models.ProjectFile ||
  mongoose.model<ProjectFile & Document>('ProjectFile', ProjectFileSchema);

export { ProjectFileModel };
