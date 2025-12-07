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

  const addOn = await AddOnModel.findByIdAndDelete(addOnId);
  if (!addOn) throw new ExpressError('Add-on not found', 404);

  return addOn;
});

export default {
  createAddOn,
  getAddOns,
  getAddOnById,
  getAddOnsByItemId,
  updateAddOnById,
  deleteAddOnById,
};

