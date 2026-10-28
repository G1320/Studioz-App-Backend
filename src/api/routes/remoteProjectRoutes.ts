import express from 'express';
import rateLimit from 'express-rate-limit';
import remoteProjectHandler from '../handlers/remoteProjectHandler.js';
import projectFileHandler from '../handlers/projectFileHandler.js';
import projectMessageHandler from '../handlers/projectMessageHandler.js';
import projectCollaboratorHandler from '../handlers/projectCollaboratorHandler.js';
import projectShareLinkHandler from '../handlers/projectShareLinkHandler.js';
import projectAccessRequestHandler from '../handlers/projectAccessRequestHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

// Public invite preview (no auth) — accept still requires login
router.get('/invites/:token', projectCollaboratorHandler.getInviteByToken);

// Only failed attempts count, so listeners who know the password are never throttled.
const sharePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { message: 'Too many password attempts. Please try again in 15 minutes.' }
});

const accessRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { message: 'Too many access requests. Please try again later.' }
});

const guestCommentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { message: 'Too many comments. Please wait a few minutes.' }
});

// Public share links (no auth) — anyone with a usable link can listen in original quality
router.get('/share/:token', projectShareLinkHandler.getSharedProject);
router.post('/share/:token/unlock', sharePasswordLimiter, projectShareLinkHandler.unlockSharedProject);
router.get('/share/:token/files/:fileId/stream', projectShareLinkHandler.streamSharedFile);
router.get('/share/:token/files/:fileId/download', projectShareLinkHandler.downloadSharedFile);
router.get('/share/:token/files/:fileId/waveform', projectShareLinkHandler.getSharedFileWaveform);
router.get('/share/:token/files/:fileId/audio-meta', projectShareLinkHandler.getSharedFileAudioMeta);
router.get('/share/:token/messages', projectShareLinkHandler.getSharedMessages);
router.post('/share/:token/messages', guestCommentLimiter, projectShareLinkHandler.sendSharedMessage);

// All other remote project routes require authentication
router.use(verifyTokenMw);

router.get('/invites/pending', projectCollaboratorHandler.listPendingInvitesForUser);
router.post('/invites/:token/accept', projectCollaboratorHandler.acceptInvite);
router.post('/share/:token/join', projectShareLinkHandler.joinSharedProject);

// Remote Project CRUD
router.post('/', remoteProjectHandler.createProject);
router.get('/', remoteProjectHandler.getProjects);
router.get('/:projectId', remoteProjectHandler.getProjectById);
router.patch('/:projectId', remoteProjectHandler.updateProject);
router.post('/:projectId/artwork/upload-url', remoteProjectHandler.getArtworkUploadUrl);
router.patch('/:projectId/artwork', remoteProjectHandler.updateProjectArtwork);

// Collaborators
router.post('/:projectId/collaborators/invite', projectCollaboratorHandler.inviteCollaborator);
router.get('/:projectId/collaborators', projectCollaboratorHandler.listCollaborators);
router.patch('/:projectId/collaborators/:userId', projectCollaboratorHandler.updateCollaborator);
router.delete('/:projectId/collaborators/:userId', projectCollaboratorHandler.removeCollaborator);
router.post('/:projectId/collaborators/invites/:inviteId/revoke', projectCollaboratorHandler.revokeInvite);

// Access requests (non-members who opened a private project link)
router.get('/:projectId/access-requests/me', projectAccessRequestHandler.getMyAccessRequest);
router.post('/:projectId/access-requests', accessRequestLimiter, projectAccessRequestHandler.requestAccess);
router.get('/:projectId/access-requests', projectAccessRequestHandler.listAccessRequests);
router.post('/:projectId/access-requests/:requestId/approve', projectAccessRequestHandler.approveAccessRequest);
router.post('/:projectId/access-requests/:requestId/deny', projectAccessRequestHandler.denyAccessRequest);

// Share links
router.get('/:projectId/share-links', projectShareLinkHandler.listShareLinks);
router.post('/:projectId/share-links', projectShareLinkHandler.createShareLink);
router.patch('/:projectId/share-links/:linkId', projectShareLinkHandler.updateShareLink);
router.post('/:projectId/share-links/:linkId/revoke', projectShareLinkHandler.revokeShareLink);

// Project Workflow Actions
router.patch('/:projectId/accept', remoteProjectHandler.acceptProject);
router.patch('/:projectId/decline', remoteProjectHandler.declineProject);
router.patch('/:projectId/start', remoteProjectHandler.startProject);
router.patch('/:projectId/deliver', remoteProjectHandler.deliverProject);
router.patch('/:projectId/request-revision', remoteProjectHandler.requestRevision);
router.patch('/:projectId/complete', remoteProjectHandler.completeProject);
router.patch('/:projectId/cancel', remoteProjectHandler.cancelProject);

// Deliverable download lock (vendor)
router.patch('/:projectId/download-lock', remoteProjectHandler.setDownloadLock);
router.post('/:projectId/download-lock/release', remoteProjectHandler.releaseDownloads);

// Project Files
router.post('/:projectId/files/upload-url', projectFileHandler.getUploadUrl);
router.post('/:projectId/files', projectFileHandler.registerFile);
router.get('/:projectId/files', projectFileHandler.getProjectFiles);
router.get('/:projectId/files/:fileId/download', projectFileHandler.getDownloadUrl);
router.get('/:projectId/files/:fileId/waveform', projectFileHandler.getWaveform);
router.get('/:projectId/files/:fileId/audio-meta', projectFileHandler.getAudioMeta);
router.delete('/:projectId/files/:fileId', projectFileHandler.deleteFile);

// Project Messages
router.get('/:projectId/messages', projectMessageHandler.getMessages);
router.post('/:projectId/messages', projectMessageHandler.sendMessage);
router.patch('/:projectId/messages/read', projectMessageHandler.markAsRead);
router.patch('/:projectId/messages/:messageId/resolve', projectMessageHandler.setResolved);

export default router;
