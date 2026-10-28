import mongoose, { Model, Document } from 'mongoose';
import type { ProjectShareLink } from '../types/remoteProject.js';
import { PROJECT_CAPABILITIES } from '../constants/projectPermissions.js';

const ProjectShareLinkSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RemoteProject',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Users who join through the link land on the creator's side.
    side: {
      type: String,
      enum: ['customer', 'vendor'],
      required: true,
    },
    label: { type: String, required: false, trim: true, maxlength: 80 },
    // Stored in clear so owners can copy the link again later; it only grants what `capabilities` allow.
    token: { type: String, required: true, unique: true },
    capabilities: {
      type: [{ type: String, enum: PROJECT_CAPABILITIES }],
      required: true,
    },
    // Empty = whole project.
    fileIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProjectFile' }],
      default: undefined,
    },
    expiresAt: { type: Date, required: false },
    // scrypt hash; never serialized.
    passwordHash: { type: String, required: false },
    // Paused links stop working but keep their token, stats and joined members.
    disabledAt: { type: Date, required: false },
    // Join links only: stop accepting new members after this many joins (1 = single use).
    maxJoins: { type: Number, required: false, min: 1 },
    revokedAt: { type: Date, required: false },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    viewCount: { type: Number, default: 0 },
    joinCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

const ProjectShareLinkModel: Model<ProjectShareLink & Document> =
  mongoose.models.ProjectShareLink ||
  mongoose.model<ProjectShareLink & Document>('ProjectShareLink', ProjectShareLinkSchema);

export { ProjectShareLinkModel };
