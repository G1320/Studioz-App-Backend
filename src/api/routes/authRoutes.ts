import express from 'express';
import  authHandler from '../handlers/authHandler.js';
import { validateUser, verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

router.post('/register', validateUser, authHandler.createAndRegisterUser);
router.post('/login', authHandler.loginUser);
router.post('/refresh-token', authHandler.refreshAccessToken);
// router.get('/me', verifyTokenMw, authHandler.getUserDetails);
router.post('/logout', authHandler.logoutUser);

export default router;