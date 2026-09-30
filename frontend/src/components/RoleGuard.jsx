// frontend/src/components/RoleGuard.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function RoleGuard({ allowedRoles = [], requiredPermission, fallback, children }) {
  const { profile, hasPermission } = useAuth();

  const isRoleAllowed = allowedRoles.length === 0 || (profile?.role && allowedRoles.includes(profile.role));
  const isPermissionAllowed = !requiredPermission || hasPermission(requiredPermission);

  if (!isRoleAllowed || !isPermissionAllowed) {
    if (fallback) return fallback;
    return (
      <div style={{ padding: '1.5rem', background: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', color: '#fca5a5' }}>
        <strong>Access Restricted: </strong>
        Your role ({profile?.role || 'Guest'}) does not have permission to access this component.
      </div>
    );
  }

  return children;
}
