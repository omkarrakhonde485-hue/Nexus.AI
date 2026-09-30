// backend/src/routes/profile.js
// User profile routes

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { updateProfile } from '../services/authService.js';

const router = Router();

// PUT /api/profile - Update user profile fields (restricted to safe non-administrative fields)
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const { fullName, department, avatarUrl } = req.body;

    const updates = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (department !== undefined) updates.department = department;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

    const updatedProfile = await updateProfile(req.user.id, updates);

    res.status(200).json({
      success: true,
      data: {
        profile: {
          id: updatedProfile.id,
          fullName: updatedProfile.full_name,
          email: updatedProfile.email,
          role: updatedProfile.role,
          department: updatedProfile.department,
          avatarUrl: updatedProfile.avatar_url,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
