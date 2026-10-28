import mongoose, { Model, Document } from 'mongoose';
import type { ProjectAccessRequest } from '../types/remoteProject.js';
import { PROJECT_CAPABILITIES } from '../constants/projectPermissions.js';

/** Someone without access opened a private project link and asked to be let in. */
const ProjectAccessRequestSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RemoteProject',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: { type: String, required: false, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied'],
      default: 'pending',
      required: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    decidedAt: { type: Date, required: false },
    // Grant given on approval (on the approver's side).
    side: { type: String, enum: ['customer', 'vendor'], required: false },
    capabilities: {
      type: [{ type: String, enum: PROJECT_CAPABILITIES }],
      default: undefined,
    },
  },
  { timestamps: true }
);

ProjectAccessRequestSchema.index({ projectId: 1, status: 1, createdAt: -1 });
ProjectAccessRequestSchema.index({ projectId: 1, userId: 1, createdAt: -1 });
// At most one open request per person per project.
ProjectAccessRequestSchema.index(
  { projectId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

const ProjectAccessRequestModel: Model<ProjectAccessRequest & Document> =
  mongoose.models.ProjectAccessRequest ||
  mongoose.model<ProjectAccessRequest & Document>('ProjectAccessRequest', ProjectAccessRequestSchema);

export { ProjectAccessRequestModel };
