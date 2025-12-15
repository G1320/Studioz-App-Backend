import express from 'express';
import itemHandler from '../handlers/itemHandler.js';
import { verifyTokenMw, validateItem } from '../../middleware/index.js';

const router = express.Router();


router.post('/',  validateItem, itemHandler.createItem);
router.get('/', itemHandler.getItems);
router.get('/:itemId', itemHandler.getItemById);
router.put('/:itemId',  validateItem, itemHandler.updateItemById);
router.delete('/:itemId',  itemHandler.deleteItemById);

router.post('/:studioId/add-to-studio/:itemId',  itemHandler.addItemToStudio);
router.delete('/:studioId/remove-from-studio/:itemId',  itemHandler.removeItemFromStudio);
router.post('/:wishlistId/add-to-wishlist/:itemId',  itemHandler.addItemToWishlist);
router.delete('/:wishlistId/remove-from-wishlist/:itemId',  itemHandler.removeItemFromWishlist);


export default router;
