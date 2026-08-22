import { Router } from 'express';
import { createKeywordController } from '../controllers/keyword.controller.js';

const router = Router();

router.post('/keywords', createKeywordController);

export default router;