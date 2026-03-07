import { Router } from 'express';
import { getStatus } from '../handlers/statusHandler.js';

const router = Router();

// Public — no auth middleware
router.get('/', getStatus);

export default router;
