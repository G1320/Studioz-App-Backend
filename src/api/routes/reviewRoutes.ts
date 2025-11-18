import express from 'express';
import reviewHandler from '../handlers/reviewHandler.js';
import { validateReview, verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

router.put('/:reviewId', verifyTokenMw, validateReview, reviewHandler.updateReviewById);
router.delete('/:reviewId', verifyTokenMw, reviewHandler.deleteReviewById);

export default router;

