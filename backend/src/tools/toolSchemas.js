// backend/src/tools/toolSchemas.js
// Zod argument validation schemas for all AI tools

import { z } from 'zod';

export const toolSchemas = {
  get_user_profile: z.object({
    userId: z.string().uuid().optional(),
  }),

  get_team_members: z.object({
    department: z.string().optional(),
  }),

  get_workflow: z.object({
    workflowId: z.string().uuid({ message: 'Valid workflow UUID is required' }),
  }),

  search_workflows: z.object({
    status: z.enum([
      'draft', 'submitted', 'ai_analyzing', 'needs_information', 'awaiting_approval',
      'approved', 'processing', 'blocked', 'escalated', 'completed', 'rejected', 'failed', 'cancelled'
    ]).optional(),
    workflowType: z.enum([
      'approval', 'invoice', 'expense', 'procurement', 'onboarding', 'helpdesk', 'meeting'
    ]).optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
    createdBy: z.string().uuid().optional(),
    assignee: z.string().optional(),
  }),

  get_tasks: z.object({
    status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
    workflowId: z.string().uuid().optional(),
  }),

  get_company_policy: z.object({
    policyKey: z.string().min(1, { message: 'Policy key is required (e.g. expense.default, helpdesk.sla)' }),
  }),

  get_dashboard_metrics: z.object({
    period: z.enum(['today', 'week', 'month']).optional().default('today'),
  }),

  create_workflow: z.object({
    workflowType: z.enum([
      'approval', 'invoice', 'expense', 'procurement', 'onboarding', 'helpdesk', 'meeting'
    ], { message: 'workflowType must be one of the 7 supported types' }),
    title: z.string().min(3, { message: 'Workflow title must be at least 3 characters' }),
    summary: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
    department: z.string().optional(),
    aiData: z.record(z.any()).optional().default({}),
  }),

  create_task: z.object({
    workflowId: z.string().uuid({ message: 'Valid workflow UUID is required' }),
    title: z.string().min(3, { message: 'Task title must be at least 3 characters' }),
    description: z.string().optional(),
    assigneeRole: z.string().optional(),
    assigneeId: z.string().uuid().optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
    dueOffsetDays: z.number().int().min(1).max(30).optional(),
  }),

  update_task: z.object({
    taskId: z.string().uuid({ message: 'Valid task UUID is required' }),
    status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']),
    notes: z.string().optional(),
  }),

  create_approval: z.object({
    workflowId: z.string().uuid({ message: 'Valid workflow UUID is required' }),
    approverId: z.string().uuid({ message: 'Valid approver profile UUID is required' }),
    comments: z.string().optional(),
  }),
};
