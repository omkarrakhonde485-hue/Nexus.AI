// backend/src/agents/contextBuilder.js
// Assembles focused context for the AI agent turn

import { supabase } from '../config/supabase.js';
import { workflowRepository } from '../repositories/workflowRepository.js';

export async function buildAgentContext({ user, workflowId = null, extraContext = {} }) {
  // 1. Fetch user manager details if present
  let managerName = null;
  if (user.manager_id) {
    const { data: mgr } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.manager_id)
      .single();
    managerName = mgr?.full_name || null;
  }

  // 2. Fetch specific workflow if requested
  let workflowContext = null;
  if (workflowId) {
    const wf = await workflowRepository.findById(workflowId);
    if (wf) {
      workflowContext = {
        id: wf.id,
        type: wf.workflow_type,
        title: wf.title,
        status: wf.status,
        priority: wf.priority,
        department: wf.department,
        createdBy: wf.created_by,
      };
    }
  }

  return {
    user: {
      id: user.id,
      fullName: user.fullName || user.email,
      email: user.email,
      role: user.role,
      department: user.department,
      manager_id: user.manager_id,
      managerName,
    },
    workflow: workflowContext,
    extra: extraContext,
  };
}
