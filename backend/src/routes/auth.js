// backend/src/routes/auth.js
// Authentication routes

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import { createOrSyncProfile } from '../services/authService.js';
import { getPermissionsForRole } from '../services/permissionService.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// GET /api/auth/me - Retrieve current authenticated user, profile, and permissions
router.get('/me', requireAuth, (req, res) => {
  const permissions = getPermissionsForRole(req.user.role);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
      },
      profile: {
        fullName: req.user.fullName,
        role: req.user.role,
        department: req.user.department,
        managerId: req.user.managerId,
      },
      permissions,
    },
  });
});

// POST /api/auth/profile - Create or sync profile after initial Supabase signup
router.post('/profile', requireAuth, async (req, res, next) => {
  try {
    const { fullName, department } = req.body;

    if (!fullName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'fullName is required.',
        },
      });
    }

    // Default role for ordinary signups is always 'employee'
    const profile = await createOrSyncProfile({
      userId: req.user.id,
      email: req.user.email,
      fullName,
      department: department || 'Engineering',
      role: 'employee',
    });

    res.status(200).json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          fullName: profile.full_name,
          email: profile.email,
          role: profile.role,
          department: profile.department,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/admin-only-test - Test route requiring admin permissions (for authorization verification)
router.get('/admin-only-test', requireAuth, requirePermission(PERMISSIONS.ADMIN_USERS_MANAGE), (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Admin authorization proof verified successfully.',
      actor: req.user,
    },
  });
});

export default router;
