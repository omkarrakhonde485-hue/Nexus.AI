// backend/src/middleware/auth.js
// Bearer Token verification and profile resolution middleware

import { verifyBearerToken, getProfileByUserId } from '../services/authService.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication token is required.',
        },
      });
    }

    const token = authHeader.split(' ')[1].trim();
    const { user, error: tokenError } = await verifyBearerToken(token);

    if (tokenError || !user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTHENTICATION',
          message: 'Invalid or expired authentication token.',
        },
      });
    }

    const { profile, error: profileError } = await getProfileByUserId(user.id);

    if (profileError || !profile) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_CONFIGURED',
          message: 'User profile is not configured.',
        },
      });
    }

    // Attach sanitized user context to request
    req.user = {
      id: user.id,
      email: user.email,
      fullName: profile.full_name,
      role: profile.role,
      department: profile.department,
      managerId: profile.manager_id,
    };

    next();
  } catch (err) {
    next(err);
  }
};
