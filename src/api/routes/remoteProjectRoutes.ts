import express from 'express';
import remoteProjectHandler from '../handlers/remoteProjectHandler.js';
import projectFileHandler from '../handlers/projectFileHandler.js';
import projectMessageHandler from '../handlers/projectMessageHandler.js';

const router = express.Router();

// Remote Project CRUD
router.post('/', remoteProjectHandler.createProject);
router.get('/', remoteProjectHandler.getProjects);
router.get('/:projectId', remoteProjectHandler.getProjectById);

// Project Workflow Actions
router.patch('/:projectId/accept', remoteProjectHandler.acceptProject);
router.patch('/:projectId/decline', remoteProjectHandler.declineProject);
router.patch('/:projectId/start', remoteProjectHandler.startProject);
router.patch('/:projectId/deliver', remoteProjectHandler.deliverProject);
router.patch('/:projectId/request-revision', remoteProjectHandler.requestRevision);
router.patch('/:projectId/complete', remoteProjectHandler.completeProject);
router.patch('/:projectId/cancel', remoteProjectHandler.cancelProject);

// Project Files
router.post('/:projectId/files/upload-url', projectFileHandler.getUploadUrl);
router.post('/:projectId/files', projectFileHandler.registerFile);
router.get('/:projectId/files', projectFileHandler.getProjectFiles);
router.get('/:projectId/files/:fileId/download', projectFileHandler.getDownloadUrl);
router.delete('/:projectId/files/:fileId', projectFileHandler.deleteFile);

// Project Messages
router.get('/:projectId/messages', projectMessageHandler.getMessages);
router.post('/:projectId/messages', projectMessageHandler.sendMessage);
router.patch('/:projectId/messages/read', projectMessageHandler.markAsRead);

export default router;
