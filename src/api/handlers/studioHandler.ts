import { Request } from 'express';
import { StudioModel } from '../../models/studioModel.js';
import { Item, Studio } from '../../types/index.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { UserModel } from '../../models/userModel.js';
import { emitAvailabilityUpdate } from '../../webSockets/socket.js';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createStudio = handleRequest(async (req: Request) => {
  const { userId } = req.params;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const user = await UserModel.findById(userId)

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

  if (user && studio){
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

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);

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

  const existingStudio = await StudioModel.findById(studioId);
  if (!existingStudio) throw new ExpressError('Studio not found', 404);
  
  const updatedStudio = await StudioModel.findByIdAndUpdate(studioId, req.body, {
    new: true
  });
  return updatedStudio;
});

const deleteStudioById = handleRequest(async (req: Request) => {
  const { studioId } = req.params;

  const existingStudio = await StudioModel.findById(studioId);
  if (!existingStudio) throw new ExpressError('Studio not found', 404);

  await StudioModel.findByIdAndDelete(studioId);
  return null;
});

const patchStudio = handleRequest(async (req: Request) => {
  const { studioId } = req.params;

  const existingStudio = await StudioModel.findById(studioId);
  if (!existingStudio) throw new ExpressError('Studio not found', 404);

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

  const updatedStudio = await StudioModel.findByIdAndUpdate(studioId, updateData, { new: true });

  // Emit availability update for all items in the studio when active status changes
  if (updateData.active !== undefined) {
    const studioItems = await ItemModel.find({ studioId });
    for (const item of studioItems) {
      emitAvailabilityUpdate(item._id.toString());
    }
  }

  return updatedStudio;
});

const patchItem = handleRequest(async (req: Request) => {
  const { studioId, itemId } = req.params;

  const existingStudio = await StudioModel.findById(studioId);
  if (!existingStudio) throw new ExpressError('Studio not found', 404);

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
