import express from 'express';
import bookingHandler from '../handlers/bookingHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();
router.post('/book-item/:userId?', bookingHandler.bookStudioItem);


export default router;
