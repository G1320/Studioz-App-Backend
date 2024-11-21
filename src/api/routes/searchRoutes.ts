import express from 'express';
import {searchItems,searchStudios,searchUsers} from '../handlers/searchHandler.js';

const router = express.Router();

router.get('/items', searchItems);
router.get('/studios', searchStudios);
router.get('/users', searchUsers);

export default router;
