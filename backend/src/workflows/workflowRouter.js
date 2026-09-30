// backend/src/workflows/workflowRouter.js
// Centralized assignee resolution engine

import { supabase } from '../config/supabase.js';

export const resolveAssignee = async (rule, context = {}) => {
  if (!rule) return { assigneeId: null, assigneeRole: null };

  // Rule: requester
  if (rule === 'requester') {
    return {
      assigneeId: context.requesterId || null,
      assigneeRole: 'employee',
    };
  }

  // Rule: requester_manager
  if (rule === 'requester_manager') {
    if (context.requesterManagerId) {
      return {
        assigneeId: context.requesterManagerId,
        assigneeRole: 'manager',
      };
    }

    // Fallback if requester has no manager configured
    const adminFallback = await getFirstActiveUserByRole('admin');
    if (adminFallback) {
      return {
        assigneeId: adminFallback.id,
        assigneeRole: 'admin',
        isFallback: true,
      };
    }

    return { assigneeId: null, assigneeRole: 'manager', missingManager: true };
  }

  // Rule: role:hr, role:finance, role:it_support, role:procurement
  if (rule.startsWith('role:')) {
    const targetRole = rule.split(':')[1];
    const user = await getFirstActiveUserByRole(targetRole);

    if (user) {
      return {
        assigneeId: user.id,
        assigneeRole: targetRole,
      };
    }

    // Admin fallback if role user not found
    const adminFallback = await getFirstActiveUserByRole('admin');
    return {
      assigneeId: adminFallback ? adminFallback.id : null,
      assigneeRole: targetRole,
      isFallback: true,
    };
  }

  // Rule: admin_fallback
  if (rule === 'admin_fallback') {
    const adminUser = await getFirstActiveUserByRole('admin');
    return {
      assigneeId: adminUser ? adminUser.id : null,
      assigneeRole: 'admin',
    };
  }

  // Specific user rule
  if (typeof rule === 'object' && rule.targetUserId) {
    return {
      assigneeId: rule.targetUserId,
      assigneeRole: rule.targetRole || null,
    };
  }

  return { assigneeId: null, assigneeRole: null };
};

// Helper: Query active user matching specified role
async function getFirstActiveUserByRole(role) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('role', role)
    .eq('is_active', true)
    .limit(1);

  return data && data.length > 0 ? data[0] : null;
}
