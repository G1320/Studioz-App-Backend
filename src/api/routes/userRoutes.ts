import express from 'express';
import userHandler from '../handlers/userHandler.js';
import { validateUser, verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

router.get('/',  userHandler.getAllUsers);
router.get('/:sub', userHandler.getUserBySub);
router.get('/my-studios/:id',  userHandler.getUserStudios);
router.post('/', validateUser, userHandler.createUser);
router.put('/:id',  validateUser, userHandler.updateUser);
router.delete('/:id',  userHandler.deleteUser);

router.post('/:id/add-studio/:studioId',  userHandler.addStudioToUser);
router.post('/:id/remove-studio/:studioId',  userHandler.removeStudioFromUser);

export default router;
