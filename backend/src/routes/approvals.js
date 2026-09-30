// backend/src/routes/approvals.js
// Express routes for Approval operations

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { approvalController } from '../controllers/approvalController.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission(PERMISSIONS.APPROVAL_READ), approvalController.list);
router.get('/:id', requirePermission(PERMISSIONS.APPROVAL_READ), approvalController.getById);
router.post('/:id/approve', requirePermission(PERMISSIONS.APPROVAL_APPROVE), approvalController.approve);
router.post('/:id/reject', requirePermission(PERMISSIONS.APPROVAL_REJECT), approvalController.reject);

export default router;
