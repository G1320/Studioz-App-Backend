const express = require('express');
const authHandler = require('../handlers/authHandler');
const { validateUser, verifyTokenMw } = require('../../middleware');

const router = express.Router();

router.post('/register', validateUser, authHandler.createAndRegisterUser);
router.post('/login', authHandler.loginUser);
router.post('/refresh-token', authHandler.refreshAccessToken);
// router.get('/me', verifyTokenMw, authHandler.getUserDetails);
router.post('/logout', authHandler.logoutUser);

module.exports = router;
