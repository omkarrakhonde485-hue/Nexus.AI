// backend/src/services/permissionService.js
// Centralized authorization checks and helper methods

import { ROLE_PERMISSIONS } from '../config/permissions.js';

export const getPermissionsForRole = (role) => {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.employee;
};

export const hasPermission = (userRole, requiredPermission) => {
  if (!userRole) return false;
  const permissions = getPermissionsForRole(userRole);
  return permissions.includes(requiredPermission);
};

export const canApproveWorkflow = (user, workflow, requester) => {
  // 1. Check if user has approval.approve permission
  if (!hasPermission(user.role, 'approval.approve')) {
    return false;
  }

  // 2. Requester cannot approve their own request
  if (workflow.created_by === user.id) {
    return false;
  }

  // 3. Admin can approve any workflow
  if (user.role === 'admin') {
    return true;
  }

  // 4. Manager approval check: user must be the manager of the requester
  const managerId = requester?.manager_id || requester?.managerId;
  if (user.role === 'manager' && managerId === user.id) {
    return true;
  }

  // 5. Explicit assigned approver
  if (workflow.current_assignee_id === user.id) {
    return true;
  }

  return false;
};
