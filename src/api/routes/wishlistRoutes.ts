import express from 'express';
import wishlistHandler from '../handlers/wishlistHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();
router.post('/create/:userId', verifyTokenMw, wishlistHandler.createWishlistAndAddToUser);
router.put('/add-studio/:wishlistId', verifyTokenMw, wishlistHandler.addStudioToWishlist);
router.put('/add-item/:wishlistId', verifyTokenMw, wishlistHandler.addItemToWishlist);
router.get('/:userId', verifyTokenMw, wishlistHandler.getUserWishlists);
router.get('/:userId/get-wishlist/:wishlistId', verifyTokenMw, wishlistHandler.getUserWishlistById);
router.put('/update-wishlist/:wishlistId', verifyTokenMw, wishlistHandler.updateUserWishlist);
router.delete('/delete-wishlist/:userId/:wishlistId', verifyTokenMw, wishlistHandler.deleteUserWishlist);

export default router;
