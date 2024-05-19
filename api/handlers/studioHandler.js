const { StudioModel } = require('../../models/studioModel');
const { ItemModel } = require('../../models/itemModel');
const ExpressError = require('../../utils/expressError');
const handleRequest = require('../../utils/requestHandler');

const createStudio = handleRequest(async (req) => {
  const { userId } = req.params;
  if (!userId) throw new ExpressError('User ID not provided', 400);
  const studio = new StudioModel(req.body);
  studio.createdBy = userId;

  await studio.save();

  return studio;
});

const getStudios = handleRequest(async (req) => {
  let query = StudioModel.find();
  if (req.query.name) {
    query = query.where('name', new RegExp(req.query.name, 'i'));
  }
  if (req.query.someOtherField) {
    query = query.where('someOtherField', req.query.someOtherField);
  }
  if (req.query.sortBy) {
    const order = req.query.order || 'asc';
    query = query.sort({ [req.query.sortBy]: order === 'asc' ? 1 : -1 });
  }
  query.collation({ locale: 'en', strength: 2 });
  const studios = await query.exec();

  return studios;
});

const getStudioById = handleRequest(async (req) => {
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

const getStudioItems = handleRequest(async (req) => {
  const { studioId } = req.params;

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);

  // Sorting the items in the studio based on the idx field then extracting itemIds from the sorted studio.items
  const itemIds = studio.items.sort((a, b) => a.idx - b.idx).map((item) => item.itemId);

  // Retrieving items from the ItemModel based on the sorted itemIds's order
  const items = await ItemModel.aggregate([
    { $match: { _id: { $in: itemIds } } },
    { $addFields: { __order: { $indexOfArray: [itemIds, '$_id'] } } },
    { $sort: { __order: 1 } },
    { $project: { __order: 0 } }, // used to exclude the __order field from the final output.
  ]);
  if (!items) throw new ExpressError('No items found for this studio', 404);

  return items;
});

const updateStudioItem = handleRequest(async (req) => {
  const { studioId } = req.params;
  if (!studioId) throw new ExpressError('Studio ID not found', 404);

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);

  const { items } = req.body;
  if (!items || !Array.isArray(items)) throw new ExpressError('Invalid request body', 400);

  if (studio.items) studio.items = [];

  const updatedItems = await ItemModel.find({ _id: { $in: items } }).select('_id');
  const updatedItemIds = updatedItems.map((item) => item._id);

  // Update the items for the studio
  studio.items = updatedItemIds;

  await studio.save();

  return studio.items;
});

const updateStudioById = handleRequest(async (req) => {
  const { studioId } = req.params;

  const existingStudio = await StudioModel.findById(studioId);
  if (!existingStudio) throw new ExpressError('Studio not found', 404);

  const updatedStudio = await StudioModel.findByIdAndUpdate(studioId, req.body, {
    new: true,
  });
  return updatedStudio;
});

const deleteStudioById = handleRequest(async (req) => {
  const { studioId } = req.params;

  const existingStudio = await StudioModel.findById(studioId);
  if (!existingStudio) throw new ExpressError('Studio not found', 404);

  await StudioModel.findByIdAndDelete(studioId);
  return null;
});

module.exports = {
  createStudio,
  getStudios,
  getStudioById,
  getStudioItems,
  updateStudioItem,
  updateStudioById,
  deleteStudioById,
};
