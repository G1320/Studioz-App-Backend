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
      enum: ['customer', 'vendor'],
      required: true,
    },

    message: { type: String, required: true },
    attachmentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProjectFile',
      },
    ],

    readAt: { type: Date, required: false },
  },
  { timestamps: true }
);

// Database indexes for query performance
ProjectMessageSchema.index({ projectId: 1 });
ProjectMessageSchema.index({ senderId: 1 });
ProjectMessageSchema.index({ projectId: 1, createdAt: 1 });

const ProjectMessageModel: Model<ProjectMessage & Document> =
  mongoose.models.ProjectMessage ||
  mongoose.model<ProjectMessage & Document>(
    'ProjectMessage',
    ProjectMessageSchema
  );

export { ProjectMessageModel };
