// backend/src/routes/workflows.js
// Express routes for Workflow operations

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { workflowController } from '../controllers/workflowController.js';

const router = Router();

router.use(requireAuth);

router.post('/', requirePermission(PERMISSIONS.WORKFLOW_CREATE), workflowController.create);
router.get('/', workflowController.list);
router.get('/:id', workflowController.getById);
router.patch('/:id', workflowController.update);
router.post('/:id/cancel', workflowController.cancel);
router.get('/:id/steps', workflowController.getSteps);
router.get('/:id/activity', workflowController.getActivity);

export default router;
