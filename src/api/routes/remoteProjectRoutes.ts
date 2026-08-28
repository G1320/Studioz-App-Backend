import express from 'express';
import remoteProjectHandler from '../handlers/remoteProjectHandler.js';
import projectFileHandler from '../handlers/projectFileHandler.js';
import projectMessageHandler from '../handlers/projectMessageHandler.js';
import projectCollaboratorHandler from '../handlers/projectCollaboratorHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

// Public invite preview (no auth) — accept still requires login
router.get('/invites/:token', projectCollaboratorHandler.getInviteByToken);

// All other remote project routes require authentication
router.use(verifyTokenMw);

router.get('/invites/pending', projectCollaboratorHandler.listPendingInvitesForUser);
router.post('/invites/:token/accept', projectCollaboratorHandler.acceptInvite);

// Remote Project CRUD
router.post('/', remoteProjectHandler.createProject);
router.get('/', remoteProjectHandler.getProjects);
router.get('/:projectId', remoteProjectHandler.getProjectById);
router.patch('/:projectId', remoteProjectHandler.updateProject);

// Collaborators
router.post('/:projectId/collaborators/invite', projectCollaboratorHandler.inviteCollaborator);
router.get('/:projectId/collaborators', projectCollaboratorHandler.listCollaborators);
router.delete('/:projectId/collaborators/:userId', projectCollaboratorHandler.removeCollaborator);
router.post(
  '/:projectId/collaborators/invites/:inviteId/revoke',
  projectCollaboratorHandler.revokeInvite
);

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
router.get('/:projectId/files/:fileId/audio-meta', projectFileHandler.getAudioMeta);
router.delete('/:projectId/files/:fileId', projectFileHandler.deleteFile);

// Project Messages
router.get('/:projectId/messages', projectMessageHandler.getMessages);
router.post('/:projectId/messages', projectMessageHandler.sendMessage);
router.patch('/:projectId/messages/read', projectMessageHandler.markAsRead);

export default router;
