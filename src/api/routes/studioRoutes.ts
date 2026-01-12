import express from 'express';
import studioHandler from '../handlers/studioHandler.js';
import { validateStudio, verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();


router.get('/', studioHandler.getStudios);
router.get('/:studioId', studioHandler.getStudioById);
router.post('/:userId/create-studio', validateStudio, studioHandler.createStudio);
router.put('/:studioId', validateStudio, studioHandler.updateStudioById);
router.put('/:studioId/items', studioHandler.updateStudioItem);
router.patch('/:studioId', studioHandler.patchStudio);
router.patch('/:studioId/items/:itemId', studioHandler.patchItem);
router.delete('/:studioId', studioHandler.deleteStudioById);

export default router;
