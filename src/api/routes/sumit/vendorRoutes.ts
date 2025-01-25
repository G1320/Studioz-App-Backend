import express from 'express';
import vendorHandler from '../../handlers/sumit/vendorHandler.js';

const router = express.Router();

router.post('/create', vendorHandler.createVendor);

export default router;