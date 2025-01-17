import express from 'express';
const router = express.Router();

import { generateAccessToken } from '../../handlers/paypalHandlers/authHandler.js';

router.get('/get-access-token', async (req, res) => {
    try {
        return await generateAccessToken();
    } catch (error) {
        console.error('Error getting access token:', error);
    }
  }
)

export default router;
