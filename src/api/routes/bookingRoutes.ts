import express from 'express';
import bookingHandler from '../handlers/bookingHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();
router.post('/reserve-time-slot/:userId?', bookingHandler.reserveItemTimeSlots);
router.delete('/release-time-slot', bookingHandler.releaseItemTimeSlots);


export default router;
