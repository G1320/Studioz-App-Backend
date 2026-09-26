import express from 'express';
import itemHandler from '../handlers/itemHandler.js';
import { verifyTokenMw, validateItem, checkListingLimit } from '../../middleware/index.js';

const router = express.Router();

// Create item - requires auth and checks listing limit based on subscription tier
router.post('/', 
  verifyTokenMw, 
  checkListingLimit, 
  validateItem, 
  itemHandler.createItem
);

router.get('/', itemHandler.getItems);
router.get('/:itemId', itemHandler.getItemById);
router.put('/:itemId', verifyTokenMw, validateItem, itemHandler.updateItemById);
router.delete('/:itemId', verifyTokenMw, itemHandler.deleteItemById);

// Add item to studio - also checks listing limit (creating new association)
router.post('/:studioId/add-to-studio/:itemId', 
  verifyTokenMw, 
  checkListingLimit, 
  itemHandler.addItemToStudio
);
router.delete('/:studioId/remove-from-studio/:itemId', verifyTokenMw, itemHandler.removeItemFromStudio);

router.post('/:wishlistId/add-to-wishlist/:itemId', itemHandler.addItemToWishlist);
router.delete('/:wishlistId/remove-from-wishlist/:itemId', itemHandler.removeItemFromWishlist);

export default router;
