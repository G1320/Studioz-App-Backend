import express from 'express';
import {searchItems,searchStudios,searchStudiosAndItems,searchUsers} from '../handlers/searchHandler.js';

const router = express.Router();

router.get('/all', searchStudiosAndItems);
router.get('/items', searchItems);
router.get('/studios', searchStudios);
router.get('/users', searchUsers);

export default router;
