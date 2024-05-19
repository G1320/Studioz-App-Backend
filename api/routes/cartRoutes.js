const express = require('express');
const router = express.Router();
const itemHandler = require('../handlers/cartHandler');
const { verifyTokenMw } = require('../../middleware');

router.get('/:userId', itemHandler.getUserCart);
router.post('/:userId/add-to-cart/:itemId', itemHandler.addItemToCart);
router.post('/:userId/add-items-to-cart', itemHandler.addItemsToCart);
router.delete('/:userId/remove-from-cart/:itemId', itemHandler.removeItemFromCart);
router.delete('/:userId/remove-items-from-cart', itemHandler.removeItemsFromCart);
router.delete('/:userId/delete-cart', itemHandler.deleteUserCart);
router.put('/:userId/update-cart', itemHandler.updateUserCart);
router.post('/:userId/checkout', itemHandler.checkout);

module.exports = router;
