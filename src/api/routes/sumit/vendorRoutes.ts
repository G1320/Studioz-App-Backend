import express from 'express';
import vendorHandler from '../../handlers/sumit/vendorHandler.js';
import { verifyTokenMw } from '../../../middleware/index.js';

const router = express.Router();

router.post('/create', vendorHandler.createVendor);
router.post('/save-card', verifyTokenMw, vendorHandler.saveVendorCard);

export default router;