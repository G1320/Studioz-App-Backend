const { WishlistModel } = require('../../models/wishlistModel');
const { UserModel } = require('../../models/userModel');
const { StudioModel } = require('../../models/studioModel');
const { ItemModel } = require('../../models/itemModel');
const handleRequest = require('../../utils/requestHandler');
const ExpressError = require('../../utils/expressError');

const createWishlistAndAddToUser = handleRequest(async (req) => {
  const userId = req.params.userId;
  const user = await UserModel.findById(userId).populate('wishlists');
  if (!user) throw new ExpressError('User not found', 404);

  const wishlist = new WishlistModel(req.body);

  await wishlist.save();
  user.wishlists.push(wishlist._id);
  await user.save();

  return wishlist;
});

const addStudioToWishlist = handleRequest(async (req) => {
  const { wishlistId } = req.params;
  const { studioId } = req.body;

  const wishlist = await WishlistModel.findById(wishlistId);
  if (!wishlist) throw new ExpressError('Wishlist not found', 404);

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);

  wishlist.studios.push(studioId);
  await wishlist.save();
  return wishlist;
});

const addItemToWishlist = handleRequest(async (req) => {
  const { wishlistId, itemId } = req.body;

  const wishlist = await WishlistModel.findById(wishlistId);
  if (!wishlist) throw new ExpressError('Wishlist not found', 404);

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('Item not found', 404);

  wishlist.items.push(itemId);
  await wishlist.save();
  return wishlist;
});

const getUserWishlists = handleRequest(async (req) => {
  const user = await UserModel.findById(req.params.userId).populate('wishlists');

  if (!user) throw new ExpressError('User not found', 404);
  if (!user.wishlists) user.wishlists = [];
  return user.wishlists;
});

const getUserWishlistById = handleRequest(async (req) => {
  const user = await UserModel.findById(req.params.userId).populate('wishlists');
  if (!user) throw new ExpressError('User not found', 404);
  if (!user.wishlists) user.wishlists = [];

  const wishlistIndex = user.wishlists.findIndex(
    (wishlist) => wishlist._id.toString() === req.params.wishlistId
  );
  if (wishlistIndex === -1) throw new ExpressError('Wishlist not found', 404);

  const currWishlist = user.wishlists[wishlistIndex];
  const prevWishlist = wishlistIndex > 0 ? user.wishlists[wishlistIndex - 1] : null;
  const nextWishlist =
    wishlistIndex < user.wishlists.length - 1 ? user.wishlists[wishlistIndex + 1] : null;

  return { currWishlist, prevWishlist, nextWishlist };
});

const updateUserWishlist = handleRequest(async (req) => {
  const { wishlistId } = req.params;

  const updatedWishlist = await WishlistModel.findByIdAndUpdate(wishlistId, req.body, { new: true });
  if (!updatedWishlist) throw new ExpressError('wishlist not found', 404);
  return updatedWishlist;
});

const deleteUserWishlist = handleRequest(async (req) => {
  const { userId, wishlistId } = req.params;

  const deletedWishlist = await WishlistModel.findByIdAndDelete(wishlistId);
  if (!deletedWishlist) throw new ExpressError('wishlist not found', 404);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  user.wishlists.pull(wishlistId);
  await user.save();
  return deletedWishlist;
});

module.exports = {
  createWishlistAndAddToUser,
  addStudioToWishlist,
  addItemToWishlist,
  getUserWishlists,
  getUserWishlistById,
  updateUserWishlist,
  deleteUserWishlist,
};
