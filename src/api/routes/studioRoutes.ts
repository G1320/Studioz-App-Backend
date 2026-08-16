import express from 'express';
import studioHandler from '../handlers/studioHandler.js';
import studioFileHandler from '../handlers/studioFileHandler.js';
import { validateStudio, verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();


router.get('/', studioHandler.getStudios);

// Portfolio exhibit files (list/download/meta are public for in-page playback)
router.get('/:studioId/files', studioFileHandler.getStudioFiles);
router.get('/:studioId/files/:fileId/download', studioFileHandler.getDownloadUrl);
router.get('/:studioId/files/:fileId/audio-meta', studioFileHandler.getAudioMeta);
router.post('/:studioId/files/upload-url', verifyTokenMw, studioFileHandler.getUploadUrl);
router.post('/:studioId/files', verifyTokenMw, studioFileHandler.registerFile);
router.delete('/:studioId/files/:fileId', verifyTokenMw, studioFileHandler.deleteFile);

router.get('/:studioId', studioHandler.getStudioById);
router.post('/:userId/create-studio', validateStudio, studioHandler.createStudio);
router.put('/:studioId', validateStudio, studioHandler.updateStudioById);
router.put('/:studioId/items', studioHandler.updateStudioItem);
router.patch('/:studioId', studioHandler.patchStudio);
router.patch('/:studioId/items/:itemId', studioHandler.patchItem);
router.delete('/:studioId', studioHandler.deleteStudioById);

export default router;
