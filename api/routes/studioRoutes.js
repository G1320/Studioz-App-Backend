const express = require('express');
const router = express.Router();

const studioHandler = require('../handlers/studioHandler');
const { validateStudio, verifyTokenMw } = require('../../middleware');

router.get('/', studioHandler.getStudios);
router.get('/:studioId', studioHandler.getStudioById);
router.post(
  '/:userId/create-studio',

  validateStudio,
  studioHandler.createStudio
);
router.put('/:studioId', validateStudio, studioHandler.updateStudioById);
router.get('/:studioId/items', studioHandler.getStudioItems);
router.put('/:studioId/items', studioHandler.updateStudioItem);
router.delete('/:studioId', studioHandler.deleteStudioById);

module.exports = router;
