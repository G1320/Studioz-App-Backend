import { Router } from 'express';
import { verifyTokenMw, verifyAdminMw } from '../../middleware/index.js';
import { triggerCanaryTest, getCanaryHistory, getCanaryConfig, setupCanaryCard } from '../handlers/paymentCanaryHandler.js';

const router = Router();

// All canary routes require admin authentication
router.use(verifyTokenMw, verifyAdminMw);

router.get('/config', getCanaryConfig);
router.post('/run', triggerCanaryTest);
router.get('/history', getCanaryHistory);
router.post('/setup-card', setupCanaryCard);

export default router;
