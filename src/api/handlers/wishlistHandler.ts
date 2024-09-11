import { Request } from "../../types/express.js";
import { WishlistModel } from '../../models/wishlistModel.js'
import { UserModel } from '../../models/userModel.js'
import { StudioModel } from '../../models/studioModel.js'
import { ItemModel } from '../../models/itemModel.js'
import handleRequest from '../../utils/requestHandler.js'
import ExpressError from '../../utils/expressError.js'
import Wishlist from "../../types/wishlist.js";

const createWishlistAndAddToUser = handleRequest(async (req:Request) => {
  const userId = req.params.userId;
  const user = await UserModel.findById(userId).populate('wishlists');
  if (!user) throw new ExpressError('User not found', 404);

  const wishlist = new WishlistModel(req.body);

  await wishlist.save();
  user.wishlists?.push(wishlist._id);
  await user.save();

  return wishlist;
});

const addStudioToWishlist = handleRequest(async (req:Request) => {
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

const addItemToWishlist = handleRequest(async (req:Request) => {
  const { wishlistId, itemId } = req.body;

  const wishlist = await WishlistModel.findById(wishlistId);
  if (!wishlist) throw new ExpressError('Wishlist not found', 404);

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('Item not found', 404);

  wishlist.items.push(itemId);
  await wishlist.save();
  return wishlist;
});

const getUserWishlists = handleRequest(async (req:Request) => {
  const user = await UserModel.findById(req.params.userId).populate('wishlists');

  if (!user) throw new ExpressError('User not found', 404);
  if (!user.wishlists) user.wishlists = [];
  return user.wishlists;
});

const getUserWishlistById = handleRequest(async (req: Request) => {
  const user = await UserModel.findById(req.params.userId).populate('wishlists');
  if (!user) throw new ExpressError('User not found', 404);
  if (!user.wishlists) user.wishlists = [];
  console.log('user.wishlists: ', user.wishlists);
  console.log('req.params.wishlistId: ', req.params);
  if (!user._id || !req.params.wishlistId) {
    throw new ExpressError('Invalid request parameters', 400);
  }
  
  const wishlists = user.wishlists ;
  
  const wishlistIndex = wishlists.findIndex(
    (wishlist) => wishlist === req.params.wishlistId
  );
 
  if (wishlistIndex === -1) throw new ExpressError('Wishlist not found', 404);

  // Get the current, previous, and next wishlists using the index
  const currWishlist = user.wishlists[wishlistIndex];
  const prevWishlist = wishlistIndex > 0 ? user.wishlists[wishlistIndex - 1] : null;
  const nextWishlist =
    wishlistIndex < user.wishlists.length - 1 ? user.wishlists[wishlistIndex + 1] : null;

  return { currWishlist, prevWishlist, nextWishlist };
});

const updateUserWishlist = handleRequest(async (req:Request) => {
  const { wishlistId } = req.params;

  const updatedWishlist = await WishlistModel.findByIdAndUpdate(wishlistId, req.body, { new: true });
  if (!updatedWishlist) throw new ExpressError('wishlist not found', 404);
  return updatedWishlist;
});

const deleteUserWishlist = handleRequest(async (req: Request) => {
  const { userId, wishlistId } = req.params;

  const deletedWishlist = await WishlistModel.findByIdAndDelete(wishlistId);
  if (!deletedWishlist) throw new ExpressError('Wishlist not found', 404);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  if (user.wishlists) {
    user.wishlists = user.wishlists.filter(wId => wId.toString() !== wishlistId);
    await user.save();
  }

  return deletedWishlist;
});

export default {
  createWishlistAndAddToUser,
  addStudioToWishlist,
  addItemToWishlist,
  getUserWishlists,
  getUserWishlistById,
  updateUserWishlist,
  deleteUserWishlist,
};
