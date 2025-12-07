import express from 'express';
import addOnHandler from '../handlers/addOnHandler.js';

const router = express.Router();

router.post('/', addOnHandler.createAddOn);
router.get('/', addOnHandler.getAddOns);
router.get('/item/:itemId', addOnHandler.getAddOnsByItemId);
router.get('/:addOnId', addOnHandler.getAddOnById);
router.put('/:addOnId', addOnHandler.updateAddOnById);
router.delete('/:addOnId', addOnHandler.deleteAddOnById);

export default router;

