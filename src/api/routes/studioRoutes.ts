import express from 'express';
import studioHandler from '../handlers/studioHandler.js';
import { validateStudio, verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

router.get('/', studioHandler.getStudios);
router.get('/:studioId', studioHandler.getStudioById);
router.post('/:userId/create-studio', verifyTokenMw, validateStudio, studioHandler.createStudio);
router.put('/:studioId', verifyTokenMw, validateStudio, studioHandler.updateStudioById);
router.put('/:studioId/items', verifyTokenMw, studioHandler.updateStudioItem);
router.delete('/:studioId', verifyTokenMw, studioHandler.deleteStudioById);

export default router;
