import { Router } from 'express';
import { getPublicStatus } from '../handlers/statusHandler.js';

const router = Router();

router.get('/', getPublicStatus);

export default router;
