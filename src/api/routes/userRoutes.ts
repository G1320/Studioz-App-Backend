import express from 'express';
import userHandler from '../handlers/userHandler.js';
import { validateUser, verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

router.get('/', verifyTokenMw, userHandler.getAllUsers);
router.get('/:sub', userHandler.getUserBySub);
router.get('/my-studios/:id', verifyTokenMw, userHandler.getUserStudios);
router.post('/', validateUser, userHandler.createUser);
router.put('/:id', verifyTokenMw, validateUser, userHandler.updateUser);
router.delete('/:id', verifyTokenMw, userHandler.deleteUser);

router.post('/:id/add-studio/:studioId', verifyTokenMw, userHandler.addStudioToUser);
router.post('/:id/remove-studio/:studioId', verifyTokenMw, userHandler.removeStudioFromUser);

export default router;
