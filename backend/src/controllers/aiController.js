// backend/src/controllers/aiController.js
// Express controller for NEXUS AI Agent routes

import { processAgentRequest } from '../agents/nexusAgent.js';
import { aiAuditService } from '../services/aiAuditService.js';

export async function handleAgentTurn(req, res, next) {
  try {
    const { message, workflowId = null, context = {} } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Message string is required.' },
      });
    }

    const result = await processAgentRequest({
      user: req.user,
      message,
      workflowId,
      extraContext: context,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.message?.includes('RESOURCE_EXHAUSTED') || err.status === 429) {
      return res.status(502).json({
        success: false,
        error: { code: 'AI_SERVICE_UNAVAILABLE', message: 'Gemini service is currently rate limited. Please try again shortly.' },
      });
    }
    next(err);
  }
}

export async function getAiHistory(req, res, next) {
  try {
    const history = await aiAuditService.getUserAiHistory(req.user.id);
    return res.status(200).json({
      success: true,
      data: { history },
    });
  } catch (err) {
    next(err);
  }
}
