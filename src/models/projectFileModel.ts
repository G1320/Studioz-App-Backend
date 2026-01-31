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
