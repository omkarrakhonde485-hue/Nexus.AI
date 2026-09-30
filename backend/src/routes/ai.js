// backend/src/routes/ai.js
// Protected routes for NEXUS Central AI Agent

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { handleAgentTurn, getAiHistory } from '../controllers/aiController.js';

const router = Router();

// Central AI Agent turn
router.post('/agent', requireAuth, handleAgentTurn);

// AI Activity History
router.get('/history', requireAuth, getAiHistory);

export default router;
