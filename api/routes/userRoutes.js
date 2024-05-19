const express = require('express');
const userHandler = require('../handlers/userHandler');
const { validateUser, verifyTokenMw } = require('../../middleware');

const router = express.Router();

router.get('/', userHandler.getAllUsers);
router.get('/:sub', userHandler.getUserBySub);
router.get('/my-studios/:id', userHandler.getUserStudios);
router.post('/', validateUser, userHandler.createUser);
router.put('/:id', validateUser, userHandler.updateUser);
router.delete('/:id', userHandler.deleteUser);

router.post('/:id/add-studio/:studioId', userHandler.addStudioToUser);
router.post('/:id/remove-studio/:studioId', userHandler.removeStudioFromUser);

module.exports = router;
