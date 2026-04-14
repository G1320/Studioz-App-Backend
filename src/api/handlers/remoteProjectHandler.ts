import { Request } from 'express';
import mongoose from 'mongoose';
import { RemoteProjectModel } from '../../models/remoteProjectModel.js';
import { ItemModel } from '../../models/itemModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { ProjectFileModel } from '../../models/projectFileModel.js';
import { UserModel } from '../../models/userModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { paymentService } from '../../services/paymentService.js';
import { platformFeeService } from '../../services/platformFeeService.js';
import { notifyVendorNewProject } from '../../utils/notificationUtils.js';
import { emitProjectStatusUpdate } from '../../webSockets/socket.js';

interface AuthRequest extends Request {
  decodedJwt?: { _id?: string; userId?: string };
}

// Project status constants
export const PROJECT_STATUS = {
  REQUESTED: 'requested',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  REVISION_REQUESTED: 'revision_requested',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DECLINED: 'declined',
} as const;

/**
 * Create a new remote project request
 * POST /api/remote-projects
 */
const createProject = handleRequest(async (req: Request) => {
  const {
    itemId,
    customerId,
    title,
    brief,
    referenceLinks,
    customerName,
    customerEmail,
    customerPhone,
    singleUseToken,
    useSavedCard,
    sumitCustomerId,
  } = req.body;

  if (!itemId) throw new ExpressError('Item ID is required', 400);
  if (!customerId) throw new ExpressError('Customer ID is required', 400);
  if (!title) throw new ExpressError('Project title is required', 400);
  if (!brief) throw new ExpressError('Project brief is required', 400);

  // Fetch the item and validate it's a remote project type
  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('Item not found', 404);
  if (!item.active) throw new ExpressError('Item is not active', 400);
  if (!item.remoteService) throw new ExpressError('Item is not a remote service', 400);
  if (item.remoteWorkType !== 'project') {
    throw new ExpressError('Item is not configured for remote projects', 400);
  }

  // Fetch the studio
  const studio = await StudioModel.findById(item.studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);
  if (!studio.active) throw new ExpressError('Studio is not active', 400);

  // Get pricing from item's projectPricing
  const projectPricing = item.projectPricing;
  if (!projectPricing?.basePrice) {
    throw new ExpressError('Item does not have project pricing configured', 400);
  }

  // Calculate deposit if configured
  const depositAmount = projectPricing.depositPercentage
    ? (projectPricing.basePrice * projectPricing.depositPercentage) / 100
    : undefined;

  const vendorId = item.sellerId || studio.createdBy;

  // Create the project
  const project = new RemoteProjectModel({
    itemId: item._id,
    studioId: studio._id,
    customerId,
    vendorId,

    title,
    brief,
    referenceLinks: referenceLinks || [],

    // Snapshot item/studio names for historical accuracy
    itemName: item.name,
    studioName: studio.name,

    // Pricing
    price: projectPricing.basePrice,
    depositAmount,
    depositPaid: false,
    finalPaid: false,

    // Timeline
    estimatedDeliveryDays: projectPricing.estimatedDeliveryDays || 7,

    // Revisions
    revisionsIncluded: projectPricing.revisionsIncluded || 1,
    revisionsUsed: 0,
    revisionPrice: projectPricing.revisionPrice,

    // Status
    status: PROJECT_STATUS.REQUESTED,

    // Customer info
    customerName,
    customerEmail,
    customerPhone,
  });

  // Handle payment: save card for later charging on vendor accept
  const hasPaymentInfo = singleUseToken || useSavedCard;
  const hasPrice = projectPricing.basePrice > 0;

  if (hasPaymentInfo && hasPrice && vendorId) {
    if (singleUseToken) {
      const paymentResult = await paymentService.handleReservationPayment({
        singleUseToken,
        customerInfo: {
          name: customerName || 'Customer',
          email: customerEmail || '',
          phone: customerPhone || '',
        },
        vendorId: vendorId.toString(),
        userId: customerId,
        amount: depositAmount || projectPricing.basePrice,
        itemName: title,
        instantCharge: false,
        studioId: studio._id?.toString(),
      });

      if (paymentResult) {
        project.paymentStatus = paymentResult.paymentStatus === 'card_saved' ? 'card_saved' : 'pending';
        project.paymentDetails = paymentResult.paymentDetails;
      }
    } else if (useSavedCard && sumitCustomerId) {
      // Reuse a previously saved card — just store the reference
      project.paymentStatus = 'card_saved';
      project.paymentDetails = {
        sumitCustomerId,
        amount: depositAmount || projectPricing.basePrice,
        currency: 'ILS',
        vendorId: vendorId.toString(),
      };
    }
  }

  await project.save();

  await notifyVendorNewProject(project);

  return project;
});

/**
 * Get remote projects (filtered by role - customer or vendor)
 * GET /api/remote-projects
 */
const getProjects = handleRequest(async (req: Request) => {
  const authReq = req as AuthRequest;
  const jwtPayload = authReq.decodedJwt as { _id?: string; userId?: string; sub?: string } | undefined;
  const authUserId = jwtPayload?.userId || jwtPayload?._id || jwtPayload?.sub;

  const {
    customerId,
    vendorId,
    participantId,
    studioId,
    status,
    page: pageStr,
    limit: limitStr,
  } = req.query;

  // Pagination
  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string) || 20));
  const skip = (page - 1) * limit;

  // Build filter
  const filter: Record<string, unknown> = {};
  if (participantId) {
    if (!authUserId || String(participantId) !== String(authUserId)) {
      throw new ExpressError('Forbidden', 403);
    }
    // Projects where user is customer OR vendor (e.g. "My projects" list)
    filter.$or = [{ customerId: participantId }, { vendorId: participantId }];
  } else {
    if (customerId) filter.customerId = customerId;
    if (vendorId) filter.vendorId = vendorId;
  }
  if (studioId) filter.studioId = studioId;
  if (status) filter.status = status;

  const [projects, total] = await Promise.all([
    RemoteProjectModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('itemId', 'name imgUrl')
      .populate('studioId', 'name'),
    RemoteProjectModel.countDocuments(filter),
  ]);

  return {
    projects,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});

/**
 * Get a single remote project by ID
 * GET /api/remote-projects/:projectId
 */
const getProjectById = handleRequest(async (req: Request) => {
  const { projectId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ExpressError('Invalid project ID', 400);
  }

  const project = await RemoteProjectModel.findById(projectId)
    .populate('itemId', 'name imgUrl acceptedFileTypes maxFileSize maxFilesPerProject')
    .populate('studioId', 'name imgUrl')
    .populate('customerId', 'name email phone')
    .populate('vendorId', 'name email');

  if (!project) {
    throw new ExpressError('Project not found', 404);
  }

  // Also get file counts
  const fileCounts = await ProjectFileModel.aggregate([
    { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  const fileCountsByType = fileCounts.reduce(
    (acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    },
    { source: 0, deliverable: 0, revision: 0 }
  );

  return {
    project,
    fileCounts: fileCountsByType,
  };
});

/**
 * Accept a project request (vendor action)
 * PATCH /api/remote-projects/:projectId/accept
 */
const acceptProject = handleRequest(async (req: Request) => {
  const { projectId } = req.params;

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  if (project.status !== PROJECT_STATUS.REQUESTED) {
    throw new ExpressError(
      `Cannot accept project with status: ${project.status}`,
      400
    );
  }

  // Charge deposit if card was saved and there's an amount to charge
  const chargeAmount = project.depositAmount || project.price;
  if (
    project.paymentStatus === 'card_saved' &&
    project.paymentDetails?.sumitCustomerId &&
    chargeAmount > 0
  ) {
    const credentials = await paymentService.getVendorCredentials(project.vendorId.toString());
    if (!credentials) {
      throw new ExpressError('Vendor payment credentials not configured', 402);
    }

    const customer = await UserModel.findById(project.customerId);
    const chargeResult = await paymentService.chargeSavedCard(
      project.paymentDetails.sumitCustomerId,
      chargeAmount,
      `Project deposit: ${project.title}`,
      credentials,
      {
        email: project.customerEmail || customer?.email,
        name: project.customerName || customer?.name,
        phone: project.customerPhone || (customer as any)?.phone,
      }
    );

    if (!chargeResult.success) {
      throw new ExpressError(
        `Deposit charge failed: ${chargeResult.error || 'Payment declined'}`,
        402
      );
    }

    project.paymentStatus = 'deposit_paid';
    project.depositPaid = true;
    project.paymentDetails = {
      ...project.paymentDetails,
      sumitPaymentId: chargeResult.paymentId,
      chargedAt: new Date(),
      amount: chargeAmount,
    } as any;

    platformFeeService.recordFee({
      vendorId: project.vendorId.toString(),
      transactionAmount: chargeAmount,
      transactionType: 'remote_project',
      studioId: project.studioId?.toString(),
      sumitPaymentId: chargeResult.paymentId,
    });
  }

  // Set deadline based on estimated delivery days
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + project.estimatedDeliveryDays);

  project.status = PROJECT_STATUS.ACCEPTED;
  project.acceptedAt = new Date();
  project.deadline = deadline;
  await project.save();

  emitProjectStatusUpdate(
    project.customerId.toString(),
    project.vendorId.toString(),
    projectId,
    project.status
  );

  return project;
});

/**
 * Decline a project request (vendor action)
 * PATCH /api/remote-projects/:projectId/decline
 */
const declineProject = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { reason } = req.body;

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  if (project.status !== PROJECT_STATUS.REQUESTED) {
    throw new ExpressError(
      `Cannot decline project with status: ${project.status}`,
      400
    );
  }

  // Refund deposit if it was charged
  if (
    project.paymentStatus === 'deposit_paid' &&
    project.paymentDetails?.sumitPaymentId &&
    project.paymentDetails?.vendorId
  ) {
    const credentials = await paymentService.getVendorCredentials(
      project.paymentDetails.vendorId.toString()
    );
    if (credentials) {
      const refundResult = await paymentService.refundPayment(
        project.paymentDetails.sumitPaymentId,
        project.paymentDetails.amount || project.depositAmount || 0,
        credentials
      );
      if (refundResult.success) {
        project.paymentStatus = 'refunded';
        project.depositPaid = false;
        project.paymentDetails = {
          ...project.paymentDetails,
          refundId: refundResult.refundId,
          refundedAt: new Date(),
        } as any;

        if (project.paymentDetails?.sumitPaymentId) {
          platformFeeService.creditFee(project.paymentDetails.sumitPaymentId, 'Project declined — deposit refunded');
        }
      }
    }
  }

  project.status = PROJECT_STATUS.DECLINED;
  await project.save();

  emitProjectStatusUpdate(
    project.customerId.toString(),
    project.vendorId.toString(),
    projectId,
    project.status
  );

  return project;
});

/**
 * Start working on a project (vendor action)
 * PATCH /api/remote-projects/:projectId/start
 */
const startProject = handleRequest(async (req: Request) => {
  const { projectId } = req.params;

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  if (project.status !== PROJECT_STATUS.ACCEPTED) {
    throw new ExpressError(
      `Cannot start project with status: ${project.status}`,
      400
    );
  }

  project.status = PROJECT_STATUS.IN_PROGRESS;
  await project.save();

  emitProjectStatusUpdate(
    project.customerId.toString(),
    project.vendorId.toString(),
    projectId,
    project.status
  );

  return project;
});

/**
 * Deliver project work (vendor action)
 * PATCH /api/remote-projects/:projectId/deliver
 */
const deliverProject = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { deliveryNotes } = req.body;

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  const allowedStatuses = [
    PROJECT_STATUS.ACCEPTED,
    PROJECT_STATUS.IN_PROGRESS,
    PROJECT_STATUS.REVISION_REQUESTED,
  ];

  if (!allowedStatuses.includes(project.status as typeof allowedStatuses[number])) {
    throw new ExpressError(
      `Cannot deliver project with status: ${project.status}`,
      400
    );
  }

  // Check that there are deliverable files
  const deliverableCount = await ProjectFileModel.countDocuments({
    projectId: project._id,
    type: { $in: ['deliverable', 'revision'] },
  });

  if (deliverableCount === 0) {
    throw new ExpressError(
      'Please upload deliverable files before marking as delivered',
      400
    );
  }

  project.status = PROJECT_STATUS.DELIVERED;
  project.deliveredAt = new Date();
  await project.save();

  emitProjectStatusUpdate(
    project.customerId.toString(),
    project.vendorId.toString(),
    projectId,
    project.status
  );

  return project;
});

/**
 * Request revision (customer action)
 * PATCH /api/remote-projects/:projectId/request-revision
 */
const requestRevision = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { feedback } = req.body;

  if (!feedback) {
    throw new ExpressError('Revision feedback is required', 400);
  }

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  if (project.status !== PROJECT_STATUS.DELIVERED) {
    throw new ExpressError(
      `Cannot request revision for project with status: ${project.status}`,
      400
    );
  }

  // Paid revision: charge if free revisions are exhausted
  const isPaidRevision = project.revisionsUsed >= project.revisionsIncluded;

  if (isPaidRevision) {
    const revisionPrice = project.revisionPrice;
    if (!revisionPrice || revisionPrice <= 0) {
      throw new ExpressError('No free revisions remaining and no revision price configured', 400);
    }

    const customer = await UserModel.findById(project.customerId);
    const sumitCustomerId =
      project.paymentDetails?.sumitCustomerId || customer?.sumitCustomerId;

    if (!sumitCustomerId) {
      throw new ExpressError('No payment method on file for paid revision', 402);
    }

    const credentials = await paymentService.getVendorCredentials(project.vendorId.toString());
    if (!credentials) {
      throw new ExpressError('Vendor payment credentials not configured', 402);
    }

    const chargeResult = await paymentService.chargeSavedCard(
      sumitCustomerId,
      revisionPrice,
      `Paid revision: ${project.title}`,
      credentials,
      {
        email: project.customerEmail || customer?.email,
        name: project.customerName || customer?.name,
        phone: project.customerPhone || (customer as any)?.phone,
      }
    );

    if (!chargeResult.success) {
      throw new ExpressError(
        `Revision payment failed: ${chargeResult.error || 'Payment declined'}`,
        402
      );
    }

    platformFeeService.recordFee({
      vendorId: project.vendorId.toString(),
      transactionAmount: revisionPrice,
      transactionType: 'remote_project',
      studioId: project.studioId?.toString(),
      sumitPaymentId: chargeResult.paymentId,
    });
  }

  project.status = PROJECT_STATUS.REVISION_REQUESTED;
  project.revisionsUsed += 1;
  await project.save();

  emitProjectStatusUpdate(
    project.customerId.toString(),
    project.vendorId.toString(),
    projectId,
    project.status
  );

  return project;
});

/**
 * Complete project (customer action)
 * PATCH /api/remote-projects/:projectId/complete
 */
const completeProject = handleRequest(async (req: Request) => {
  const { projectId } = req.params;

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  if (project.status !== PROJECT_STATUS.DELIVERED) {
    throw new ExpressError(
      `Cannot complete project with status: ${project.status}`,
      400
    );
  }

  // Charge the remaining balance if deposit was already paid
  if (
    project.paymentStatus === 'deposit_paid' &&
    project.paymentDetails?.sumitCustomerId
  ) {
    const balance = project.price - (project.depositAmount || 0);

    if (balance > 0) {
      const credentials = await paymentService.getVendorCredentials(project.vendorId.toString());
      if (!credentials) {
        throw new ExpressError('Vendor payment credentials not configured', 402);
      }

      const customer = await UserModel.findById(project.customerId);
      const chargeResult = await paymentService.chargeSavedCard(
        project.paymentDetails.sumitCustomerId,
        balance,
        `Project balance: ${project.title}`,
        credentials,
        {
          email: project.customerEmail || customer?.email,
          name: project.customerName || customer?.name,
          phone: project.customerPhone || (customer as any)?.phone,
        }
      );

      if (!chargeResult.success) {
        throw new ExpressError(
          `Balance charge failed: ${chargeResult.error || 'Payment declined'}`,
          402
        );
      }

      project.paymentStatus = 'fully_paid';
      project.finalPaid = true;

      platformFeeService.recordFee({
        vendorId: project.vendorId.toString(),
        transactionAmount: balance,
        transactionType: 'remote_project',
        studioId: project.studioId?.toString(),
        sumitPaymentId: chargeResult.paymentId,
      });
    } else {
      // Deposit covered the full price
      project.paymentStatus = 'fully_paid';
      project.finalPaid = true;
    }
  } else if (!project.paymentDetails?.sumitCustomerId) {
    // No payment was set up (free project or studio without payment)
    project.finalPaid = true;
  }

  project.status = PROJECT_STATUS.COMPLETED;
  project.completedAt = new Date();
  await project.save();

  emitProjectStatusUpdate(
    project.customerId.toString(),
    project.vendorId.toString(),
    projectId,
    project.status
  );

  return project;
});

/**
 * Cancel project (customer or vendor action)
 * PATCH /api/remote-projects/:projectId/cancel
 */
const cancelProject = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { reason, cancelledBy } = req.body;

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  const nonCancellableStatuses = [
    PROJECT_STATUS.COMPLETED,
    PROJECT_STATUS.CANCELLED,
    PROJECT_STATUS.DECLINED,
  ];

  if (nonCancellableStatuses.includes(project.status as typeof nonCancellableStatuses[number])) {
    throw new ExpressError(
      `Cannot cancel project with status: ${project.status}`,
      400
    );
  }

  // Refund deposit if it was charged
  if (
    project.paymentStatus === 'deposit_paid' &&
    project.paymentDetails?.sumitPaymentId &&
    project.paymentDetails?.vendorId
  ) {
    const credentials = await paymentService.getVendorCredentials(
      project.paymentDetails.vendorId.toString()
    );
    if (credentials) {
      const refundResult = await paymentService.refundPayment(
        project.paymentDetails.sumitPaymentId,
        project.paymentDetails.amount || project.depositAmount || 0,
        credentials
      );
      if (refundResult.success) {
        project.paymentStatus = 'refunded';
        project.depositPaid = false;
        project.paymentDetails = {
          ...project.paymentDetails,
          refundId: refundResult.refundId,
          refundedAt: new Date(),
        } as any;

        if (project.paymentDetails?.sumitPaymentId) {
          platformFeeService.creditFee(project.paymentDetails.sumitPaymentId, 'Project cancelled — deposit refunded');
        }
      }
    }
  }

  project.status = PROJECT_STATUS.CANCELLED;
  await project.save();

  emitProjectStatusUpdate(
    project.customerId.toString(),
    project.vendorId.toString(),
    projectId,
    project.status
  );

  return project;
});

const TERMINAL_STATUSES = [
  PROJECT_STATUS.COMPLETED,
  PROJECT_STATUS.CANCELLED,
  PROJECT_STATUS.DECLINED,
] as const;

const MAX_TITLE_LENGTH = 200;
const MAX_REFERENCE_LINKS = 5;
const URL_PATTERN = /^https?:\/\/.+/i;

/**
 * Update project metadata (vendor action)
 * PATCH /api/remote-projects/:projectId
 */
const updateProject = handleRequest(async (req: AuthRequest) => {
  const { projectId } = req.params;
  const userId = req.decodedJwt?._id || req.decodedJwt?.userId;

  if (!userId) throw new ExpressError('Authentication required', 401);

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  if (project.vendorId.toString() !== userId) {
    throw new ExpressError('Only the project vendor can update project details', 403);
  }

  if (TERMINAL_STATUSES.some((s) => s === project.status)) {
    throw new ExpressError(
      `Cannot update project with status: ${project.status}`,
      400
    );
  }

  const { title, referenceLinks } = req.body;

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new ExpressError('Title must be a non-empty string', 400);
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      throw new ExpressError(`Title must be at most ${MAX_TITLE_LENGTH} characters`, 400);
    }
    project.title = title.trim();
  }

  if (referenceLinks !== undefined) {
    if (!Array.isArray(referenceLinks)) {
      throw new ExpressError('referenceLinks must be an array', 400);
    }
    if (referenceLinks.length > MAX_REFERENCE_LINKS) {
      throw new ExpressError(`referenceLinks may contain at most ${MAX_REFERENCE_LINKS} items`, 400);
    }
    for (const link of referenceLinks) {
      if (typeof link !== 'string' || !URL_PATTERN.test(link)) {
        throw new ExpressError(`Invalid URL: ${link}`, 400);
      }
    }
    project.referenceLinks = referenceLinks;
  }

  await project.save();

  return project;
});

export default {
  createProject,
  getProjects,
  getProjectById,
  acceptProject,
  declineProject,
  startProject,
  deliverProject,
  requestRevision,
  completeProject,
  cancelProject,
  updateProject,
};
