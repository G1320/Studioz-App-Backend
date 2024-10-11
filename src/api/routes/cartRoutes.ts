import express from 'express';
import itemHandler from '../handlers/cartHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

router.get('/:userId', verifyTokenMw, itemHandler.getUserCart);
router.post('/:userId/add-to-cart/:itemId', verifyTokenMw, itemHandler.addItemToCart);
router.post('/:userId/add-items-to-cart', verifyTokenMw, itemHandler.addItemsToCart);
router.delete('/:userId/remove-from-cart/:itemId', verifyTokenMw, itemHandler.removeItemFromCart);
router.delete('/:userId/remove-items-from-cart', verifyTokenMw, itemHandler.removeItemsFromCart);
router.delete('/:userId/delete-cart', verifyTokenMw, itemHandler.deleteUserCart);
router.put('/:userId/update-cart', verifyTokenMw, itemHandler.updateUserCart);
router.post('/:userId/checkout', verifyTokenMw, itemHandler.checkout);

export default router;
