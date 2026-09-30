// backend/src/middleware/authorization.js
// Authorization middleware enforcing RBAC permission and role checks

import { hasPermission } from '../services/permissionService.js';

export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required for this resource.',
        },
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires permission: ${permission}`,
        },
      });
    }

    next();
  };
};

export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required for this resource.',
        },
      });
    }

    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!rolesArray.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Allowed roles: ${rolesArray.join(', ')}`,
        },
      });
    }

    next();
  };
};
