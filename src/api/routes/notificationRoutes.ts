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
router.get('/preferences', notificationHandler.getNotificationPreferences);
router.put('/preferences', notificationHandler.updateNotificationPreferences);
router.get('/push/public-key', notificationHandler.getPushPublicKey);
router.post('/push/subscribe', notificationHandler.subscribePush);
router.post('/push/unsubscribe', notificationHandler.unsubscribePush);
router.delete('/read', notificationHandler.deleteAllReadNotifications);
router.delete('/:id', notificationHandler.deleteNotificationById);

export default router;

