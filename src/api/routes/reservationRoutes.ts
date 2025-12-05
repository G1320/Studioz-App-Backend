import express from "express";
import reservationHandler from '../handlers/reservationHandler.js';

const router = express.Router();


router.post("/", reservationHandler.createReservation);
router.get("/", reservationHandler.getReservations);
router.get("/studio/:studioId", reservationHandler.getReservationsByStudioId);
router.get("/phone/:phone", reservationHandler.getReservationsByPhone);
router.get("/:reservationId", reservationHandler.getReservationById);
router.put("/:reservationId", reservationHandler.updateReservationById);
router.delete("/:reservationId", reservationHandler.deleteReservationById);

export default router;
