import express from 'express';
import itemHandler from '../handlers/itemHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();
router.post('/', verifyTokenMw, itemHandler.createItem);
router.get('/', itemHandler.getItems);
router.get('/:itemId', itemHandler.getItemById);
router.put('/:itemId', verifyTokenMw, itemHandler.updateItemById);
router.delete('/:itemId', verifyTokenMw, itemHandler.deleteItemById);

router.post('/:studioId/add-to-studio/:itemId', verifyTokenMw, itemHandler.addItemToStudio);
router.delete('/:studioId/remove-from-studio/:itemId', verifyTokenMw, itemHandler.removeItemFromStudio);
router.post('/:wishlistId/add-to-wishlist/:itemId', verifyTokenMw, itemHandler.addItemToWishlist);
router.delete('/:wishlistId/remove-from-wishlist/:itemId', verifyTokenMw, itemHandler.removeItemFromWishlist);

export default router;
