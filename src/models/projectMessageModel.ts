import mongoose, { Model, Schema, Document } from 'mongoose';
import { ProjectMessage } from '../types/remoteProject.js';

const ProjectMessageSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RemoteProject',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['customer', 'vendor', 'customer_collaborator', 'vendor_collaborator'],
      required: true,
    },

    message: { type: String, required: true },
    attachmentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProjectFile',
      },
    ],
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectFile',
      required: false,
    },
    offsetSeconds: { type: Number, required: false, min: 0 },

    // Threaded reply to another comment on the same track
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectMessage',
      required: false,
    },

    // Review workflow: a track comment can be marked as resolved
    resolvedAt: { type: Date, required: false },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    readAt: { type: Date, required: false },
  },
  { timestamps: true }
);

// Database indexes for query performance
ProjectMessageSchema.index({ projectId: 1 });
ProjectMessageSchema.index({ senderId: 1 });
ProjectMessageSchema.index({ projectId: 1, createdAt: 1 });
ProjectMessageSchema.index({ projectId: 1, fileId: 1, createdAt: 1 });
ProjectMessageSchema.index({ parentId: 1 });

const ProjectMessageModel: Model<ProjectMessage & Document> =
  mongoose.models.ProjectMessage ||
  mongoose.model<ProjectMessage & Document>(
    'ProjectMessage',
    ProjectMessageSchema
  );

export { ProjectMessageModel };
