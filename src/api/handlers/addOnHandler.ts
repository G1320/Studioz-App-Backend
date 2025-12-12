import { Request } from 'express';
import { AddOnModel } from '../../models/addOnModel.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';

const createAddOn = handleRequest(async (req: Request) => {
  const { itemId } = req.body;
  
  if (!itemId) throw new ExpressError('Item ID not provided', 400);

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('Item not found', 404);

  const addOn = new AddOnModel(req.body);
  addOn.updatedAt = new Date();
  await addOn.save();

  // Add the add-on ID to the item's addOnIds array
  if (!item.addOnIds) {
    item.addOnIds = [];
  }
  if (!item.addOnIds.includes(addOn._id)) {
    item.addOnIds.push(addOn._id);
    item.updatedAt = new Date();
    await item.save();
  }

  return addOn;
});

const getAddOns = handleRequest(async (req: Request) => {
  const { itemId, isActive } = req.query;
  
  let query = AddOnModel.find();
  
  if (itemId) {
    query = query.where('itemId', itemId);
  }
  
  if (isActive !== undefined) {
    query = query.where('isActive', isActive === 'true');
  }
  
  // Sort by idx if available, then by createdAt
  query = query.sort({ idx: 1, createdAt: -1 });
  
  const addOns = await query.exec();
  return addOns;
});

const getAddOnById = handleRequest(async (req: Request) => {
  const { addOnId } = req.params;
  if (!addOnId) throw new ExpressError('Add-on ID not provided', 400);

  const addOn = await AddOnModel.findById(addOnId);
  if (!addOn) throw new ExpressError('Add-on not found', 404);

  return addOn;
});

const getAddOnsByItemId = handleRequest(async (req: Request) => {
  const { itemId } = req.params;
  if (!itemId) throw new ExpressError('Item ID not provided', 400);

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('Item not found', 404);

  const addOns = await AddOnModel.find({ itemId, isActive: true })
    .sort({ idx: 1, createdAt: -1 });
  
  return addOns;
});

const updateAddOnById = handleRequest(async (req: Request) => {
  const { addOnId } = req.params;
  if (!addOnId) throw new ExpressError('Add-on ID not provided', 400);

  const addOn = await AddOnModel.findByIdAndUpdate(
    addOnId,
    { ...req.body, updatedAt: new Date() },
    { new: true }
  );
  
  if (!addOn) throw new ExpressError('Add-on not found', 404);

  return addOn;
});

const deleteAddOnById = handleRequest(async (req: Request) => {
  const { addOnId } = req.params;
  if (!addOnId) throw new ExpressError('Add-on ID not provided', 400);

  const addOn = await AddOnModel.findById(addOnId);
  if (!addOn) throw new ExpressError('Add-on not found', 404);

  // Remove the add-on ID from the item's addOnIds array
  if (addOn.itemId) {
    const item = await ItemModel.findById(addOn.itemId);
    if (item && item.addOnIds) {
      item.addOnIds = item.addOnIds.filter(
        (id) => id.toString() !== addOnId.toString()
      );
      item.updatedAt = new Date();
      await item.save();
    }
  }

  await AddOnModel.findByIdAndDelete(addOnId);

  return addOn;
});

const createAddOnsBatch = handleRequest(async (req: Request) => {
  const { itemId, addOns } = req.body;
  
  if (!itemId) throw new ExpressError('Item ID not provided', 400);
  if (!addOns || !Array.isArray(addOns) || addOns.length === 0) {
    throw new ExpressError('Add-ons array is required and must not be empty', 400);
  }

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('Item not found', 404);

  // Validate each add-on has required fields
  for (const addOnData of addOns) {
    if (!addOnData.name?.en) {
      throw new ExpressError('Add-on must have a name (en)', 400);
    }
    if (addOnData.price === undefined || addOnData.price === null) {
      throw new ExpressError('Add-on must have a price', 400);
    }
  }

  // Initialize item's addOnIds array if it doesn't exist
  if (!item.addOnIds) {
    item.addOnIds = [];
  }

  // Create all add-ons
  const createdAddOns = [];
  for (const addOnData of addOns) {
    // Remove _id if present (Mongoose will generate it)
    const { _id, ...addOnFields } = addOnData;
    const addOn = new AddOnModel({
      ...addOnFields,
      itemId,
      updatedAt: new Date()
    });
    await addOn.save();
    createdAddOns.push(addOn);

    // Add the add-on ID to the item's addOnIds array
    if (!item.addOnIds.includes(addOn._id)) {
      item.addOnIds.push(addOn._id);
    }
  }

  // Update item with all add-on IDs
  item.updatedAt = new Date();
  await item.save();

  return createdAddOns;
});

export default {
  createAddOn,
  createAddOnsBatch,
  getAddOns,
  getAddOnById,
  getAddOnsByItemId,
  updateAddOnById,
  deleteAddOnById,
};

