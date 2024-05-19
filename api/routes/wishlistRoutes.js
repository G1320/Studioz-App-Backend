const express = require('express');
const wishlistHandler = require('../handlers/wishlistHandler');
const { verifyTokenMw } = require('../../middleware');

const router = express.Router();
router.post('/create/:userId', wishlistHandler.createWishlistAndAddToUser);
router.put('/add-studio/:wishlistId', wishlistHandler.addStudioToWishlist);
router.put('/add-item/:wishlistId', wishlistHandler.addItemToWishlist);
router.get('/:userId', wishlistHandler.getUserWishlists);
router.get('/:userId/get-wishlist/:wishlistId', wishlistHandler.getUserWishlistById);
router.put('/update-wishlist/:wishlistId', wishlistHandler.updateUserWishlist);
router.delete('/delete-wishlist/:userId/:wishlistId', wishlistHandler.deleteUserWishlist);

module.exports = router;
