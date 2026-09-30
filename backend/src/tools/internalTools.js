// backend/src/tools/internalTools.js
// Internal tools implementation for NEXUS operations

import { supabase } from '../config/supabase.js';
import { workflowEngine } from '../workflows/workflowEngine.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
import { taskService } from '../services/taskService.js';
import { approvalService } from '../services/approvalService.js';
import { canReadWorkflow, canManageTask } from '../services/permissionService.js';

export const internalTools = {
  // 1. Get User Profile
  async get_user_profile(args, context) {
    const targetUserId = args.userId || context.user.id;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department, manager_id')
      .eq('id', targetUserId)
      .single();

    if (error || !profile) {
      return { success: false, error: 'User profile not found' };
    }

    // Include manager name if available
    let managerName = null;
    if (profile.manager_id) {
      const { data: mgr } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', profile.manager_id)
        .single();
      managerName = mgr?.full_name || null;
    }

    return {
      success: true,
      user: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
        department: profile.department,
        managerName,
      },
    };
  },

  // 2. Get Team Members
  async get_team_members(args, context) {
    let query = supabase.from('profiles').select('id, full_name, email, role, department');

    if (context.user.role === 'manager') {
      query = query.eq('manager_id', context.user.id);
    } else if (args.department) {
      query = query.eq('department', args.department);
    } else {
      query = query.eq('department', context.user.department);
    }

    const { data: members, error } = await query.limit(20);
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      members: (members || []).map(m => ({
        id: m.id,
        name: m.full_name,
        role: m.role,
        department: m.department,
      })),
    };
  },

  // 3. Get Workflow Details
  async get_workflow(args, context) {
    const workflow = await workflowRepository.findById(args.workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow ${args.workflowId} not found` };
    }

    const requester = (await supabase.from('profiles').select('manager_id').eq('id', workflow.created_by).single()).data;

    // Check resource-level read authorization
    if (!canReadWorkflow(context.user, workflow, requester)) {
      return { success: false, error: 'Access denied: You do not have permission to view this workflow.' };
    }

    const steps = await workflowRepository.findStepsByWorkflowId(workflow.id);
    const slaStatus = workflowEngine.getSlaStatus(workflow);

    return {
      success: true,
      workflow: {
        id: workflow.id,
        type: workflow.workflow_type,
        title: workflow.title,
        status: workflow.status,
        priority: workflow.priority,
        department: workflow.department,
        aiData: workflow.ai_data,
        slaStatus,
        slaDueAt: workflow.sla_due_at,
        currentStep: steps.find(s => s.status === 'in_progress')?.name || null,
        stepsSummary: steps.map(s => `${s.name} (${s.status})`),
      },
    };
  },

  // 4. Search Workflows
  async search_workflows(args, context) {
    let query = supabase.from('workflows').select('id, workflow_type, title, status, priority, created_by, created_at');

    // Role-based scoping
    if (context.user.role === 'employee') {
      query = query.eq('created_by', context.user.id);
    } else if (context.user.role === 'manager') {
      // Find team IDs
      const { data: team } = await supabase.from('profiles').select('id').eq('manager_id', context.user.id);
      const teamIds = [context.user.id, ...(team || []).map(t => t.id)];
      query = query.in('created_by', teamIds);
    }

    if (args.status) query = query.eq('status', args.status);
    if (args.workflowType) query = query.eq('workflow_type', args.workflowType);
    if (args.priority) query = query.eq('priority', args.priority);

    const { data: workflows, error } = await query.order('created_at', { ascending: false }).limit(10);
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      workflows: (workflows || []).map(w => ({
        id: w.id,
        type: w.workflow_type,
        title: w.title,
        status: w.status,
        priority: w.priority,
      })),
    };
  },

  // 5. Get Tasks
  async get_tasks(args, context) {
    let query = supabase.from('tasks').select('id, workflow_id, title, status, priority, due_at, assignee_role, assignee_id');

    if (context.user.role === 'employee') {
      query = query.eq('assignee_id', context.user.id);
    }

    if (args.status) query = query.eq('status', args.status);
    if (args.priority) query = query.eq('priority', args.priority);
    if (args.workflowId) query = query.eq('workflow_id', args.workflowId);

    const { data: tasks, error } = await query.order('created_at', { ascending: false }).limit(15);
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      tasks: (tasks || []).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueAt: t.due_at,
        role: t.assignee_role,
      })),
    };
  },

  // 6. Get Company Policy
  async get_company_policy(args) {
    let { data: policy, error } = await supabase
      .from('company_policies')
      .select('policy_key, policy_name, policy_type, config, is_active')
      .eq('policy_key', args.policyKey)
      .single();

    if (error || !policy) {
      // Fallback: search by policy_type or partial match
      const { data: typePolicies } = await supabase
        .from('company_policies')
        .select('policy_key, policy_name, policy_type, config, is_active')
        .ilike('policy_type', `%${args.policyKey.split('.')[0]}%`)
        .limit(3);

      if (typePolicies && typePolicies.length > 0) {
        policy = typePolicies[0];
      } else {
        return { success: false, error: `No active policy found for key "${args.policyKey}".` };
      }
    }

    return {
      success: true,
      policy: {
        key: policy.policy_key,
        name: policy.policy_name,
        type: policy.policy_type,
        rules: policy.config,
      },
    };
  },

  // 7. Get Dashboard Metrics
  async get_dashboard_metrics(args, context) {
    const { count: pendingWorkflows } = await supabase
      .from('workflows')
      .select('*', { count: 'exact', head: true })
      .in('status', ['submitted', 'awaiting_approval', 'processing']);

    const { count: openAlerts } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    return {
      success: true,
      metrics: {
        activeWorkflows: pendingWorkflows || 0,
        openAlerts: openAlerts || 0,
        currentUserRole: context.user.role,
        department: context.user.department,
      },
    };
  },

  // 8. Create Workflow (Internal Write)
  async create_workflow(args, context) {
    const requester = {
      id: context.user.id,
      fullName: context.user.fullName || context.user.email,
      managerId: context.user.manager_id,
      department: context.user.department,
    };

    const workflow = await workflowEngine.createWorkflow({
      workflowType: args.workflowType,
      title: args.title,
      summary: args.summary || args.title,
      priority: args.priority || 'normal',
      department: args.department || context.user.department || 'General',
      aiData: args.aiData || {},
    }, requester);

    return {
      success: true,
      workflow: {
        id: workflow.id,
        type: workflow.workflow_type,
        title: workflow.title,
        status: workflow.status,
        priority: workflow.priority,
        slaDueAt: workflow.sla_due_at,
      },
      summary: `Created ${workflow.workflow_type} workflow "${workflow.title}" with status ${workflow.status}.`,
    };
  },

  // 9. Create Task (Internal Write)
  async create_task(args, context) {
    let dueAt = null;
    if (args.dueOffsetDays) {
      dueAt = new Date(Date.now() + args.dueOffsetDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const task = await taskService.createTask({
      workflowId: args.workflowId,
      title: args.title,
      description: args.description || null,
      assigneeId: args.assigneeId || null,
      assigneeRole: args.assigneeRole || null,
      priority: args.priority || 'normal',
      dueAt,
      createdBy: context.user.id,
    }, { type: 'ai', id: context.user.id });

    return {
      success: true,
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        assigneeRole: task.assignee_role,
      },
      summary: `Task "${task.title}" created successfully.`,
    };
  },

  // 10. Update Task (Internal Write)
  async update_task(args, context) {
    const existing = await taskService.getTaskById(args.taskId);
    if (!existing) return { success: false, error: 'Task not found' };

    if (!canManageTask(context.user, existing)) {
      return { success: false, error: 'Access denied: You are not authorized to update this task.' };
    }

    const updated = await taskService.updateTaskStatus(
      args.taskId,
      args.status,
      { id: context.user.id, fullName: context.user.fullName },
      { aiNotes: args.notes || null }
    );

    return {
      success: true,
      task: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
      },
      summary: `Task "${updated.title}" updated to status ${updated.status}.`,
    };
  },

  // 11. Create Approval (Internal Write)
  async create_approval(args, context) {
    const approval = await approvalService.createApproval({
      workflowId: args.workflowId,
      approverId: args.approverId,
      comments: args.comments || 'AI requested approval',
    }, { type: 'ai', id: context.user.id });

    return {
      success: true,
      approval: {
        id: approval.id,
        status: approval.status,
        approverId: approval.approver_id,
      },
      summary: `Approval request created for approver ID: ${approval.approver_id}.`,
    };
  },
};
