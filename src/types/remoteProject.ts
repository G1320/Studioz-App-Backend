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

export type RemoteProjectPaymentStatus =
  | 'pending'
  | 'deposit_paid'
  | 'fully_paid'
  | 'refunded';

export interface RemoteProject {
  _id: string;

  // References
  itemId: string;
  studioId: string;
  customerId: string;
  vendorId: string;

  // Project Details
  title: string;
  brief: string;
  referenceLinks?: string[];

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

  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProjectMessage {
  _id: string;
  projectId: string;
  senderId: string;
  senderRole: 'customer' | 'vendor';

  message: string;
  attachmentIds?: string[];

  readAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
