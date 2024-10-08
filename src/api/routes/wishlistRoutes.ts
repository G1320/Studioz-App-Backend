import express from 'express';
import wishlistHandler from '../handlers/wishlistHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();
router.post('/create/:userId', wishlistHandler.createWishlistAndAddToUser);
router.put('/add-studio/:wishlistId', wishlistHandler.addStudioToWishlist);
router.put('/add-item/:wishlistId', wishlistHandler.addItemToWishlist);
router.get('/:userId', wishlistHandler.getUserWishlists);
router.get('/:userId/get-wishlist/:wishlistId', wishlistHandler.getUserWishlistById);
router.put('/update-wishlist/:wishlistId', wishlistHandler.updateUserWishlist);
router.delete('/delete-wishlist/:userId/:wishlistId', wishlistHandler.deleteUserWishlist);

export default router;
