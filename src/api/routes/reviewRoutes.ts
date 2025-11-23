import express from 'express';
import reviewHandler from '../handlers/reviewHandler.js';
import { validateReview, verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

// GET /api/reviews/studio/:studioId - Get reviews by studio
router.get('/studio/:studioId', reviewHandler.getStudioReviews);

// POST /api/reviews/:studioId - Create review
router.post('/:studioId', verifyTokenMw, validateReview, reviewHandler.upsertReview);

// PUT /api/reviews/:reviewId - Update review
router.put('/:reviewId', verifyTokenMw, validateReview, reviewHandler.updateReviewById);

// DELETE /api/reviews/:reviewId - Delete review
router.delete('/:reviewId', verifyTokenMw, reviewHandler.deleteReviewById);

export default router;

