import express from 'express';
import notificationHandler from '../handlers/notificationHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

// All notification routes require authentication
router.use(verifyTokenMw);

router.get('/', notificationHandler.getNotifications);
router.get('/unread-count', notificationHandler.getUnreadNotificationCount);
router.patch('/:id/read', notificationHandler.markNotificationAsRead);
router.patch('/read-all', notificationHandler.markAllNotificationsAsRead);
router.delete('/:id', notificationHandler.deleteNotificationById);

export default router;

