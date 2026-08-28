import mongoose, { Model, Schema, Document } from 'mongoose';
import type { ProjectInvite } from '../types/remoteProject.js';

const ProjectInviteSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RemoteProject',
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    side: {
      type: String,
      enum: ['customer', 'vendor'],
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenHash: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'revoked', 'expired'],
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    acceptedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

// One pending invite per email per project
ProjectInviteSchema.index(
  { projectId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);
ProjectInviteSchema.index({ email: 1, status: 1 });

const ProjectInviteModel: Model<ProjectInvite & Document> =
  mongoose.models.ProjectInvite ||
  mongoose.model<ProjectInvite & Document>('ProjectInvite', ProjectInviteSchema);

export { ProjectInviteModel };
