import { Request } from 'express';
import { StudioModel } from '../../models/studioModel.js';
import { Item, Studio } from '../../types/index.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { UserModel } from '../../models/userModel.js';
import { emitAvailabilityUpdate } from '../../webSockets/socket.js';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface AuthRequest extends Request {
  decodedJwt?: { _id?: string; userId?: string };
}

function getAuthUserId(req: Request): string {
  const authReq = req as AuthRequest;
  const userId = authReq.decodedJwt?._id || authReq.decodedJwt?.userId;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }
  return String(userId);
}

async function assertStudioOwner(studioId: string, userId: string) {
  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);
  if (studio.createdBy?.toString() !== userId) {
    throw new ExpressError('You do not have permission to manage this studio', 403);
  }
  return studio;
}

const createStudio = handleRequest(async (req: Request) => {
  const { userId } = req.params;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const authUserId = getAuthUserId(req);
  if (authUserId !== userId) {
    throw new ExpressError('You can only create studios for your own account', 403);
  }

  const user = await UserModel.findById(userId);

  // Prevent duplicate studio names (English or Hebrew, case-insensitive)
  const nameEn = req.body?.name?.en?.trim();
  const nameHe = req.body?.name?.he?.trim();

  const nameQueries = [];
  if (nameEn) {
    nameQueries.push({ 'name.en': { $regex: `^${escapeRegex(nameEn)}$`, $options: 'i' } });
  }
  if (nameHe) {
    nameQueries.push({ 'name.he': { $regex: `^${escapeRegex(nameHe)}$`, $options: 'i' } });
  }

  if (nameQueries.length) {
    const existingStudio = await StudioModel.findOne({ $or: nameQueries });
    if (existingStudio) {
      throw new ExpressError('Studio name already exists', 409);
    }
  }

  const studio = new StudioModel(req.body);
  studio.createdBy = userId;

  // Auto-enable payments if user has completed vendor onboarding (has Sumit credentials)
  if (user?.sumitCompanyId && user?.sumitApiKey) {
    studio.paymentEnabled = true;
  }

  if (user && studio) {
    if (!user.studios) user.studios = [];
    user.studios.push(studio._id);
  }

  await studio.save();
  await user?.save();

  return studio;
});

const getStudios = handleRequest(async (req: Request) => {
  let query = StudioModel.find();
  if (req.query.name) {
    query = query.where('name', new RegExp(escapeRegex(req.query.name as string), 'i'));
  }
  if (req.query.someOtherField) {
    query = query.where('someOtherField', req.query.someOtherField);
  }
  if (req.query.sortBy) {
    const order = req.query.order || 'asc';
    query = query.sort({ [req.query.sortBy as string]: order === 'asc' ? 1 : -1 });
  }
  query.collation({ locale: 'en', strength: 2 });
  const studios = await query.exec();

  return studios;
});

const getStudioById = handleRequest(async (req: Request) => {
  const { studioId } = req.params;

  const currStudio = await StudioModel.findById(studioId);
  if (!currStudio) throw new ExpressError('Studio not found', 404);

  const prevStudio = await StudioModel.findOne({ _id: { $lt: studioId } })
    .sort({ _id: -1 })
    .limit(1);

  const nextStudio = await StudioModel.findOne({ _id: { $gt: studioId } })
    .sort({ _id: 1 })
    .limit(1);

  // Get vendor's Sumit public credentials for payment form
  let vendorCredentials = null;
  if (currStudio.paymentEnabled && currStudio.createdBy) {
    const owner = await UserModel.findById(currStudio.createdBy);
    if (owner?.sumitCompanyId && owner?.sumitApiPublicKey) {
      vendorCredentials = {
        companyId: owner.sumitCompanyId.toString(),
        publicKey: owner.sumitApiPublicKey
      };
    }
  }

  return { currStudio, prevStudio, nextStudio, vendorCredentials };
});

const updateStudioItem = handleRequest(async (req: Request) => {
  const { studioId } = req.params;
  if (!studioId) throw new ExpressError('Studio ID not found', 404);

  const authUserId = getAuthUserId(req);
  const studio = await assertStudioOwner(studioId, authUserId);

  const { items } = req.body;
  if (!items || !Array.isArray(items)) throw new ExpressError('Invalid request body', 400);

  if (studio.items) studio.items = [];

  const updatedItems = await ItemModel.find({ _id: { $in: items } }).select('_id');
  const updatedItemIds = updatedItems.map((item: Item) => item._id).filter((id) => id !== undefined);

  // Update the items for the studio
  studio.items = updatedItemIds as [];

  await studio.save();

  return studio.items;
});

const updateStudioById = handleRequest(async (req: Request) => {
  const { studioId } = req.params;
  const authUserId = getAuthUserId(req);
  await assertStudioOwner(studioId, authUserId);

  // Never allow ownership / server fields to be overwritten via client PUT
  const {
    createdBy: _createdBy,
    active: _active,
    averageRating: _ar,
    reviewCount: _rc,
    totalBookings: _tb,
    __v: _v,
    ...safeBody
  } = req.body || {};
  void _createdBy;
  void _active;
  void _ar;
  void _rc;
  void _tb;
  void _v;

  // Strip nested Mongo subdoc _ids so GET→PUT echoes never poison availability
  if (safeBody.studioAvailability && typeof safeBody.studioAvailability === 'object') {
    const avail = safeBody.studioAvailability as {
      days?: string[];
      times?: Array<{ start?: string; end?: string; _id?: string }>;
    };
    safeBody.studioAvailability = {
      days: avail.days,
      times: (avail.times || []).map(({ start, end }) => ({ start, end }))
    };
  }

  const updatedStudio = await StudioModel.findByIdAndUpdate(studioId, safeBody, {
    new: true
  });
  return updatedStudio;
});

const deleteStudioById = handleRequest(async (req: Request) => {
  const { studioId } = req.params;
  const authUserId = getAuthUserId(req);
  await assertStudioOwner(studioId, authUserId);

  await StudioModel.findByIdAndDelete(studioId);
  return null;
});

const patchStudio = handleRequest(async (req: Request) => {
  const { studioId } = req.params;
  const authUserId = getAuthUserId(req);
  await assertStudioOwner(studioId, authUserId);

  // Manage-hub section saves + status toggle — whitelist only, never ownership fields
  const allowedFields = [
    'active',
    'name',
    'subtitle',
    'description',
    'studioAvailability',
    'is24Hours',
    'coverImage',
    'galleryImages',
    'coverAudioFile',
    'galleryAudioFiles',
    'categories',
    'subCategories',
    'genres',
    'amenities',
    'equipment',
    'maxOccupancy',
    'size',
    'isSmokingAllowed',
    'city',
    'address',
    'phone',
    'website',
    'socials',
    'lat',
    'lng',
    'isWheelchairAccessible',
    'isSelfService',
    'parking',
    'arrivalInstructions',
    'cancellationPolicy',
    'portfolio',
    'socialLinks',
    'paymentEnabled'
  ];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  // Drop empty optional strings that create-Joi rejects and that mean "clear"
  for (const key of ['coverAudioFile', 'website', 'address', 'phone', 'arrivalInstructions'] as const) {
    if (updateData[key] === '') {
      updateData[key] = null;
    }
  }
  if (Array.isArray(updateData.galleryAudioFiles)) {
    updateData.galleryAudioFiles = (updateData.galleryAudioFiles as unknown[]).filter(
      (u) => typeof u === 'string' && u.trim() !== ''
    );
  }
  if (Array.isArray(updateData.portfolio)) {
    updateData.portfolio = (updateData.portfolio as Array<Record<string, unknown>>).map((item) => ({
      ...item,
      artist: item.artist == null || item.artist === '' ? '—' : item.artist
    }));
  }

  if (updateData.studioAvailability && typeof updateData.studioAvailability === 'object') {
    const avail = updateData.studioAvailability as {
      days?: string[];
      times?: Array<{ start?: string; end?: string; _id?: string }>;
    };
    updateData.studioAvailability = {
      days: avail.days,
      times: (avail.times || []).map(({ start, end }) => ({ start, end }))
    };
  }

  if (Object.keys(updateData).length === 0) {
    throw new ExpressError('No valid fields to update', 400);
  }

  const updatedStudio = await StudioModel.findByIdAndUpdate(studioId, updateData, { new: true });

  // Emit availability update for all items in the studio when active status changes
  if (updateData.active !== undefined) {
    const studioItems = await ItemModel.find({ studioId });
    for (const item of studioItems) {
      emitAvailabilityUpdate(item._id.toString());
    }
  }

  // Hours change should refresh bookable slots for all items
  if (updateData.studioAvailability !== undefined || updateData.is24Hours !== undefined) {
    const studioItems = await ItemModel.find({ studioId });
    for (const item of studioItems) {
      emitAvailabilityUpdate(item._id.toString());
    }
  }

  return updatedStudio;
});

const patchItem = handleRequest(async (req: Request) => {
  const { studioId, itemId } = req.params;
  const authUserId = getAuthUserId(req);
  const existingStudio = await assertStudioOwner(studioId, authUserId);

  const existingItem = await ItemModel.findById(itemId);
  if (!existingItem) throw new ExpressError('Item not found', 404);

  // Only allow patching specific fields (like active status)
  const allowedFields = ['active'];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new ExpressError('No valid fields to update', 400);
  }

  // Block publishing items with non-positive prices
  if (updateData.active === true) {
    const effective =
      existingItem.remoteService || existingItem.remoteWorkType === 'project'
        ? existingItem.projectPricing?.basePrice ?? existingItem.price
        : existingItem.price;
    if (effective == null || !(Number(effective) > 0)) {
      throw new ExpressError('Cannot publish a service with an invalid price', 400);
    }
  }

  // Update the Item document
  const updatedItem = await ItemModel.findByIdAndUpdate(itemId, updateData, { new: true });

  // Also update the embedded item in the studio's items array
  if (existingStudio.items && existingStudio.items.length > 0) {
    await StudioModel.updateOne(
      { _id: studioId, 'items.itemId': itemId },
      { $set: { 'items.$.active': req.body.active } }
    );
  }

  // Emit availability update for the item when active status changes
  if (updateData.active !== undefined) {
    emitAvailabilityUpdate(itemId);
  }

  return updatedItem;
});

export default {
  createStudio,
  getStudios,
  getStudioById,
  updateStudioItem,
  updateStudioById,
  deleteStudioById,
  patchStudio,
  patchItem,
};
