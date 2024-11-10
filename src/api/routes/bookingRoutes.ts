import express from 'express';
import bookingHandler from '../handlers/bookingHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();
router.post('/reserve-time-slots/:userId?', bookingHandler.reserveItemTimeSlots);
router.post('/reserve-time-slot/:userId?', bookingHandler.reserveNextItemTimeSlot);
router.delete('/release-time-slot', bookingHandler.releaseLastItemTimeSlot);
router.delete('/release-time-slots', bookingHandler.releaseItemTimeSlots);


export default router;
