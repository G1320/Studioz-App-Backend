import express from 'express';
import studioHandler from '../handlers/studioHandler.js';
import reviewHandler from '../handlers/reviewHandler.js';
import { validateStudio, validateReview, verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();


router.get('/', studioHandler.getStudios);
router.get('/:studioId/reviews', reviewHandler.getStudioReviews);
router.post('/:studioId/reviews', verifyTokenMw, validateReview, reviewHandler.upsertReview);
router.get('/:studioId', studioHandler.getStudioById);
router.post('/:userId/create-studio', validateStudio, studioHandler.createStudio);
router.put('/:studioId', validateStudio, studioHandler.updateStudioById);
router.put('/:studioId/items', studioHandler.updateStudioItem);
router.delete('/:studioId', studioHandler.deleteStudioById);

export default router;
