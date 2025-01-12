import { Request } from 'express';
import { StudioModel } from '../../models/studioModel.js';
import { Item, Studio } from '../../types/index.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { UserModel } from '../../models/userModel.js';

const createStudio = handleRequest(async (req: Request) => {
  const { userId } = req.params;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const user = await UserModel.findById(userId)

  const studio = new StudioModel(req.body);
  studio.createdBy = userId;

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
    query = query.where('name', new RegExp(req.query.name as string, 'i'));
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

  return { currStudio, prevStudio, nextStudio };
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



 

export default {
  createStudio,
  getStudios,
  getStudioById,
  updateStudioItem,
  updateStudioById,
  deleteStudioById,
};
