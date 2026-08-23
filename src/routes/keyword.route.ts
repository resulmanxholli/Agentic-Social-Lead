import { Router } from 'express';
import { createKeywordController, getKeywordsController, updateKeywordController } from '../controllers/keyword.controller.js';

const router = Router();

router.post('/keywords', createKeywordController);
router.get('/keywords', getKeywordsController);
router.patch('/keywords/:id', updateKeywordController);

export default router;