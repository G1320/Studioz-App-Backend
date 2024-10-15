import { Request } from 'express';
import { StudioItem, WishlistItem } from '../../types/index.js';
import { WishlistModel } from '../../models/wishlistModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';

const createItem = handleRequest(async (req: Request) => {
  const item = new ItemModel(req.body);

  await item.save();

  const studioId = item.studioId;
  if (!studioId) throw new ExpressError('studio ID not provided', 400);

  const itemId = item._id;
  if (!itemId) throw new ExpressError('item ID not provided', 400);

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('studio not found', 404);
  if (!studio.items) studio.items = [];

  if (!item) throw new ExpressError('item not found', 404);

  item.updatedAt = new Date();

  if (!item.studioId) item.studioId = studioId;
  if (studio.coverImage) item.studioImgUrl = studio.coverImage;
  
  await item.save();

  if (studio.items.length > 31) throw new ExpressError('Oops, Studio is full!', 400);
  if (studio.items.some((studioItem: StudioItem) => studioItem.itemId.toString() === item._id.toString())) {
    throw new ExpressError('Studio already includes this item!', 400);
  }

  studio.items.push({
    idx: studio.items.length,
    itemId: item._id,
    studioId,
    studioName: item.studioName
  });
  await studio.save();

  return item;
});

const getItems = handleRequest(async (req: Request) => {
  let query = ItemModel.find();
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
  const items = await query.exec();
  return items;
});

const addItemToStudio = handleRequest(async (req: Request) => {
  const studioId = req.params.studioId;
  if (!studioId) throw new ExpressError('studio ID not provided', 400);

  const itemId = req.params.itemId;
  if (!itemId) throw new ExpressError('item ID not provided', 400);

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('studio not found', 404);
  if (!studio.items) studio.items = [];

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('item not found', 404);

  item.updatedAt = new Date();

  if (!item.studioId) item.studioId = studioId;

  await item.save();

  if (studio.items.length > 31) throw new ExpressError('Oops, Studio is full!', 400);
  if (studio.items.some((studioItem: StudioItem) => studioItem.itemId.toString() === item._id.toString())) {
    throw new ExpressError('Studio already includes this item!', 400);
  }

  studio.items.push({
    idx: studio.items.length,
    itemId: item._id,
    studioId: studioId,
    studioName: studio.name
  });
  await studio.save();

  return item;
});

const removeItemFromStudio = handleRequest(async (req: Request) => {
  const studioId = req.params.studioId;
  if (!studioId) throw new ExpressError('Studio ID not provided', 400);

  const itemIdToRemove = req.params.itemId;
  if (!itemIdToRemove) throw new ExpressError('item ID not provided', 400);

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);

  // Find the index of the item with the specified itemId in studio.items
  const itemIndex = studio.items.findIndex(
    (studioItem: StudioItem) => studioItem.itemId.toString() === itemIdToRemove.toString()
  );

  if (itemIndex === -1) throw new ExpressError('item not found in the studio', 404);

  // Remove the item at the found index
  studio.items.splice(itemIndex, 1);

  // Re-map the idx values for the remaining items
  studio.items.forEach((studioItem: StudioItem, index: number) => (studioItem.idx = index));

  // Save the studio
  await studio.save();

  return itemIdToRemove;
});

const addItemToWishlist = handleRequest(async (req: Request) => {
  const wishlistId = req.params.wishlistId;

  if (!wishlistId) throw new ExpressError('wishlist ID not provided', 400);

  const itemId = req.params.itemId;
  if (!itemId) throw new ExpressError('item ID not provided', 400);

  const wishlist = await WishlistModel.findById(wishlistId);
  if (!wishlist) throw new ExpressError('wishlist not found', 404);
  if (!wishlist.items) wishlist.items = [];

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('item not found', 404);

  item.updatedAt = new Date();

  await item.save();

  if (wishlist.items.length > 31) throw new ExpressError('Oops, Wishlist is full!', 400);
  if (wishlist.items.some((wishlistItem: WishlistItem) => wishlistItem.itemId.toString() === item._id.toString())) {
    throw new ExpressError('Wishlist already includes this item!', 400);
  }
  wishlist.items.push({ idx: wishlist.items.length, itemId: item._id });
  await wishlist.save();

  return item;
});

const removeItemFromWishlist = handleRequest(async (req: Request) => {
  const wishlistId = req.params.wishlistId;
  if (!wishlistId) throw new ExpressError('Wishlist ID not provided', 400);

  const itemIdToRemove = req.params.itemId;
  if (!itemIdToRemove) throw new ExpressError('Item ID not provided', 400);

  const wishlist = await WishlistModel.findById(wishlistId);
  if (!wishlist) throw new ExpressError('Wishlist not found', 404);

  if (!wishlist.items || wishlist.items.length === 0) {
    throw new ExpressError('Wishlist is empty', 404);
  }
  // Find the index of the item with the specified itemId in wishlist.items
  const itemIndex = wishlist.items.findIndex((wishlistItem) => wishlistItem.itemId.toString() === itemIdToRemove);

  if (itemIndex === -1) throw new ExpressError('Item not found in the wishlist', 404);
  wishlist.items.splice(itemIndex, 1);

  // Re-map the idx values for the remaining items
  wishlist.items.forEach((wishlistItem, index) => (wishlistItem.idx = index));

  await wishlist.save();

  return itemIdToRemove;
});

const getItemById = handleRequest(async (req: Request) => {
  const { itemId } = req.params;
  if (!itemId) throw new ExpressError('item ID not provided', 400);

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('item not found', 404);

  return item;
});

const updateItemById = handleRequest(async (req: Request) => {
  const { itemId } = req.params;
  if (!itemId) throw new ExpressError('item ID not provided', 400);

  const item = await ItemModel.findByIdAndUpdate(itemId, req.body, { new: true });
  if (!item) throw new ExpressError('item not found', 404);

  return req.body;
});

const deleteItemById = handleRequest(async (req: Request) => {
  const { itemId } = req.params;
  if (!itemId) throw new ExpressError('item ID not provided', 400);

  const item = await ItemModel.findByIdAndDelete(itemId);
  if (!item) throw new ExpressError('item not found', 404);

  // Remove item references from studios
  await StudioModel.updateMany({ 'items.itemId': itemId }, { $pull: { items: { itemId: itemId } } });
  // Remove item references from wishlists
  await WishlistModel.updateMany({ 'items.itemId': itemId }, { $pull: { items: { itemId: itemId } } });

  return item;
});

export default {
  createItem,
  getItems,
  getItemById,
  addItemToStudio,
  removeItemFromStudio,
  addItemToWishlist,
  removeItemFromWishlist,
  updateItemById,
  deleteItemById
};
