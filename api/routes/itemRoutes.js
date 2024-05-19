const express = require('express');
const router = express.Router();
const itemHandler = require('../handlers/itemHandler');

// item routes
router.post('/', itemHandler.createItem);
router.get('/', itemHandler.getItems);
router.get('/:itemId', itemHandler.getItemById);
router.put('/:itemId', itemHandler.updateItemById);
router.delete('/:itemId', itemHandler.deleteItemById);

router.post('/:studioId/add-to-studio/:itemId', itemHandler.addItemToStudio);
router.delete('/:studioId/remove-from-studio/:itemId', itemHandler.removeItemFromStudio);
router.post('/:wishlistId/add-to-wishlist/:itemId', itemHandler.addItemToWishlist);
router.delete('/:wishlistId/remove-from-wishlist/:itemId', itemHandler.removeItemFromWishlist);

module.exports = router;
