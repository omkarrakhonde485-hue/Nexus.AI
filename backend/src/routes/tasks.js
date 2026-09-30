// backend/src/routes/tasks.js
// Express routes for Task operations

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { taskController } from '../controllers/taskController.js';

const router = Router();

router.use(requireAuth);

router.get('/', taskController.list);
router.get('/:id', taskController.getById);
router.post('/', requirePermission(PERMISSIONS.TASK_CREATE), taskController.create);
router.patch('/:id', taskController.update);

export default router;
