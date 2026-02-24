import express from 'express';
import bookingHandler from '../handlers/bookingHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();
router.post('/reserve-time-slots/', bookingHandler.reserveItemTimeSlots);
router.post('/reserve-time-slot/', bookingHandler.reserveNextItemTimeSlot);
router.post('/reserve-studio-time-slot/', bookingHandler.reserveStudioTimeSlots);
router.post('/confirm', verifyTokenMw, bookingHandler.confirmBooking);

router.delete('/release-time-slot/', bookingHandler.releaseLastItemTimeSlot);
router.delete('/release-time-slots/', bookingHandler.releaseItemTimeSlots);


export default router;
