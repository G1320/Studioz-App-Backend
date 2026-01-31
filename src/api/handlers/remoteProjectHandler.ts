import { Request } from 'express';
import mongoose from 'mongoose';
import { RemoteProjectModel } from '../../models/remoteProjectModel.js';
import { ItemModel } from '../../models/itemModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { ProjectFileModel } from '../../models/projectFileModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';

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

  // Create the project
  const project = new RemoteProjectModel({
    itemId: item._id,
    studioId: studio._id,
    customerId,
    vendorId: item.sellerId || studio.createdBy,

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

  await project.save();

  // TODO: Send notification to vendor about new project request

  return project;
});

/**
 * Get remote projects (filtered by role - customer or vendor)
 * GET /api/remote-projects
 */
const getProjects = handleRequest(async (req: Request) => {
  const {
    customerId,
    vendorId,
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
  if (customerId) filter.customerId = customerId;
  if (vendorId) filter.vendorId = vendorId;
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

  // Set deadline based on estimated delivery days
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + project.estimatedDeliveryDays);

  project.status = PROJECT_STATUS.ACCEPTED;
  project.acceptedAt = new Date();
  project.deadline = deadline;
  await project.save();

  // TODO: Send notification to customer that project was accepted

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

  project.status = PROJECT_STATUS.DECLINED;
  await project.save();

  // TODO: Send notification to customer that project was declined (with reason)
  // TODO: If deposit was paid, process refund

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

  // TODO: Send notification to customer that deliverables are ready

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

  // Check revision limits
  if (project.revisionsUsed >= project.revisionsIncluded) {
    // Customer would need to pay for additional revision
    // For now, we'll allow it but could add payment logic here
    // throw new ExpressError('No free revisions remaining. Additional revision fee applies.', 402);
  }

  project.status = PROJECT_STATUS.REVISION_REQUESTED;
  project.revisionsUsed += 1;
  await project.save();

  // TODO: Send notification to vendor about revision request with feedback
  // TODO: Create a ProjectMessage with the revision feedback

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

  project.status = PROJECT_STATUS.COMPLETED;
  project.completedAt = new Date();
  project.finalPaid = true; // TODO: Integrate with actual payment
  await project.save();

  // TODO: Send notification to vendor that project is completed
  // TODO: Process final payment if not already done

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

  project.status = PROJECT_STATUS.CANCELLED;
  await project.save();

  // TODO: Handle refund logic based on project stage
  // - If requested but not accepted: full refund
  // - If accepted but no work done: partial refund
  // - If work in progress: negotiate or no refund

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
};
