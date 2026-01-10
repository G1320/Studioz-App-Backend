import express from "express";
import reservationHandler from '../handlers/reservationHandler.js';

const router = express.Router();


router.post("/", reservationHandler.createReservation);
router.get("/", reservationHandler.getReservations);
router.get("/studio/:studioId", reservationHandler.getReservationsByStudioId);
router.get("/phone/:phone", reservationHandler.getReservationsByPhone);
router.get("/:reservationId", reservationHandler.getReservationById);
router.put("/:reservationId", reservationHandler.updateReservationById);
// Cancel reservation (was delete)
router.patch("/:reservationId/cancel", reservationHandler.cancelReservationById);
router.delete("/:reservationId", reservationHandler.cancelReservationById); // backward compatibility

// Approve reservation (vendor action - charges saved card if present)
router.patch("/:reservationId/approve", reservationHandler.approveReservation);

export default router;
