import { PaymentDetails, PaymentStatus } from './reservation.js';

export type RemoteProjectStatus =
  | 'requested'
  | 'accepted'
  | 'in_progress'
  | 'delivered'
  | 'revision_requested'
  | 'completed'
  | 'cancelled'
  | 'declined';

export type RemoteProjectPaymentStatus = 'pending' | 'card_saved' | 'deposit_paid' | 'fully_paid' | 'refunded';

export type ProjectSide = 'customer' | 'vendor';

export type ProjectCollaboratorStatus = 'active' | 'removed';

export interface ProjectCollaborator {
  userId: string;
  side: ProjectSide;
  invitedBy: string;
  joinedAt: Date;
  status: ProjectCollaboratorStatus;
}

export type ProjectInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface ProjectInvite {
  _id: string;
  projectId: string;
  email: string;
  side: ProjectSide;
  invitedBy: string;
  tokenHash: string;
  status: ProjectInviteStatus;
  expiresAt: Date;
  acceptedUserId?: string;
  acceptedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProjectDownloadLock {
  /** When true, customer-side downloads of deliverables are gated. */
  enabled: boolean;
  /** Vendor released downloads manually (bypasses the lock while set). */
  releasedAt?: Date;
  releasedBy?: string;
}

export interface RemoteProject {
  _id: string;

  // References
  itemId: string;
  studioId: string;
  customerId: string;
  vendorId: string;
  collaborators?: ProjectCollaborator[];

  // Project Details
  title: string;
  brief: string;
  referenceLinks?: string[];
  artworkStorageKey?: string;
  artworkUrl?: string;

  // Item snapshot (for historical accuracy)
  itemName?: {
    en: string;
    he?: string;
  };
  studioName?: {
    en: string;
    he?: string;
  };

  // Pricing
  price: number;
  depositAmount?: number;
  depositPaid: boolean;
  finalPaid: boolean;

  // Timeline
  estimatedDeliveryDays: number;
  deadline?: Date;
  acceptedAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;

  // Revisions
  revisionsIncluded: number;
  revisionsUsed: number;
  revisionPrice?: number;

  // Status
  status: RemoteProjectStatus;

  // Payment (reuse existing structure from reservations)
  paymentStatus?: RemoteProjectPaymentStatus;
  paymentDetails?: PaymentDetails;

  // Deliverable download lock (vendor-controlled)
  downloadLock?: ProjectDownloadLock;

  // Customer Info
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProjectFile {
  _id: string;
  projectId: string;
  uploadedBy: string;
  type: 'source' | 'deliverable' | 'revision';

  // File info
  fileName: string;
  fileSize: number;
  mimeType: string;

  // Storage (Cloudflare R2)
  storageKey: string;

  // Metadata
  description?: string;
  revisionNumber?: number;

  // Waveform peaks for the player
  waveformStatus?: ProjectFileWaveformStatus;
  waveform?: ProjectFileWaveform;
  waveformError?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type ProjectFileWaveformStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'unsupported';

export interface ProjectFileWaveform {
  version: number;
  /** Normalized peaks, 0–255, one per bucket across the whole track. */
  peaks: number[];
  durationMs?: number;
  sampleRate?: number;
  channels?: number;
  generatedAt: Date;
}

export type ProjectMessageSenderRole = 'customer' | 'vendor' | 'customer_collaborator' | 'vendor_collaborator';

export interface ProjectMessage {
  _id: string;
  projectId: string;
  senderId: string;
  senderRole: ProjectMessageSenderRole;

  message: string;
  attachmentIds?: string[];

  /** Project file this comment belongs to (per-track thread). */
  fileId?: string;
  /** Playback offset in seconds (time-coded comment). */
  offsetSeconds?: number;
  /** Parent comment when this is a threaded reply. */
  parentId?: string;
  /** Set when a track comment has been marked as resolved. */
  resolvedAt?: Date;
  resolvedBy?: string;

  readAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
