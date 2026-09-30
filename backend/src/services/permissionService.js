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

export const canReadWorkflow = (user, workflow, requester) => {
  if (!user || !workflow) return false;
  if (user.role === 'admin') return true;

  // Creator can read
  if (workflow.created_by === user.id) return true;

  // Current assignee can read
  if (workflow.current_assignee_id === user.id) return true;

  // Manager of requester can read
  const managerId = requester?.manager_id || requester?.managerId;
  if (user.role === 'manager' && managerId === user.id) return true;

  // Department roles can read department-relevant workflows
  const wfType = workflow.workflow_type;
  if (user.role === 'finance' && (wfType === 'expense' || wfType === 'invoice')) return true;
  if (user.role === 'hr' && wfType === 'onboarding') return true;
  if (user.role === 'it_support' && wfType === 'helpdesk') return true;
  if (user.role === 'procurement' && wfType === 'procurement') return true;

  return false;
};

export const canManageTask = (user, task) => {
  if (!user || !task) return false;
  if (user.role === 'admin') return true;
  if (task.assignee_id === user.id) return true;
  if (task.created_by === user.id) return true;
  if (task.assignee_role && task.assignee_role === user.role) return true;
  if (user.role === 'manager') return true;
  return false;
};
