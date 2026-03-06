import express from 'express';
import { verifyTokenMw, verifyAdminMw } from '../../middleware/index.js';
import campaignHandler from '../handlers/meta/campaignHandler.js';
import adSetHandler from '../handlers/meta/adSetHandler.js';
import adHandler from '../handlers/meta/adHandler.js';
import creativeHandler from '../handlers/meta/creativeHandler.js';
import audienceHandler from '../handlers/meta/audienceHandler.js';
import insightsHandler from '../handlers/meta/insightsHandler.js';

const router = express.Router();

// All Meta routes require admin authentication
router.use(verifyTokenMw, verifyAdminMw);

// --- Campaigns ---
router.get('/campaigns', campaignHandler.getCampaigns);
router.get('/campaigns/:id', campaignHandler.getCampaignById);
router.post('/campaigns', campaignHandler.createCampaign);
router.put('/campaigns/:id', campaignHandler.updateCampaign);
router.patch('/campaigns/:id/status', campaignHandler.updateCampaignStatus);
router.delete('/campaigns/:id', campaignHandler.deleteCampaign);

// --- Ad Sets ---
router.get('/campaigns/:campaignId/adsets', adSetHandler.getAdSets);
router.get('/adsets/:id', adSetHandler.getAdSetById);
router.post('/adsets', adSetHandler.createAdSet);
router.put('/adsets/:id', adSetHandler.updateAdSet);
router.patch('/adsets/:id/status', adSetHandler.updateAdSetStatus);

// --- Ads ---
router.get('/adsets/:adSetId/ads', adHandler.getAds);
router.get('/ads/:id', adHandler.getAdById);
router.post('/ads', adHandler.createAd);
router.put('/ads/:id', adHandler.updateAd);
router.patch('/ads/:id/status', adHandler.updateAdStatus);

// --- Creatives & Media ---
router.get('/media/images', creativeHandler.getImages);
router.get('/media/videos', creativeHandler.getVideos);
router.post('/media/upload-image', creativeHandler.uploadImage);
router.post('/media/upload-video', creativeHandler.uploadVideo);
router.post('/creatives', creativeHandler.createCreative);

// --- Audiences ---
router.get('/audiences', audienceHandler.getAudiences);
router.get('/audiences/:id', audienceHandler.getAudienceById);
router.post('/audiences', audienceHandler.createAudience);
router.put('/audiences/:id', audienceHandler.updateAudience);
router.delete('/audiences/:id', audienceHandler.deleteAudience);

// --- Insights ---
router.get('/insights/account', insightsHandler.getAccountInsights);
router.get('/insights/campaigns/:id', insightsHandler.getCampaignInsights);
router.get('/insights/adsets/:id', insightsHandler.getAdSetInsights);
router.get('/insights/ads/:id', insightsHandler.getAdInsights);

export default router;
