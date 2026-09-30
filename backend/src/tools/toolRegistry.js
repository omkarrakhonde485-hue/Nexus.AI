// backend/src/tools/toolRegistry.js
// Central tool registry mapping tool declarations, permissions, risk levels, and executors

import { internalTools } from './internalTools.js';
import { toolSchemas } from './toolSchemas.js';

export const TOOL_RISK_LEVELS = {
  READ_ONLY: 'read_only',
  INTERNAL_WRITE: 'internal_write',
  EXTERNAL_WRITE: 'external_write',
  SENSITIVE_EXTERNAL_WRITE: 'sensitive_external_write',
};

export const toolRegistry = {
  // Read Only Tools
  get_user_profile: {
    name: 'get_user_profile',
    description: 'Fetch the authenticated user or another team member profile information (name, role, department, manager).',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: null, // Any authenticated user
    schema: toolSchemas.get_user_profile,
    declaration: {
      name: 'get_user_profile',
      description: 'Fetch profile information for the user or a colleague.',
      parameters: {
        type: 'OBJECT',
        properties: {
          userId: { type: 'STRING', description: 'Optional user UUID. Defaults to current user.' },
        },
      },
    },
    execute: internalTools.get_user_profile,
  },

  get_team_members: {
    name: 'get_team_members',
    description: 'Fetch colleagues or direct reports in a specific department or team.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: null,
    schema: toolSchemas.get_team_members,
    declaration: {
      name: 'get_team_members',
      description: 'Get list of colleagues in a department or direct reports.',
      parameters: {
        type: 'OBJECT',
        properties: {
          department: { type: 'STRING', description: 'Optional department name.' },
        },
      },
    },
    execute: internalTools.get_team_members,
  },

  get_workflow: {
    name: 'get_workflow',
    description: 'Retrieve detailed information, status, active steps, and SLA state for a specific workflow ID.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: null,
    schema: toolSchemas.get_workflow,
    declaration: {
      name: 'get_workflow',
      description: 'Retrieve full status and step details of an existing workflow by its UUID.',
      parameters: {
        type: 'OBJECT',
        properties: {
          workflowId: { type: 'STRING', description: 'The UUID of the workflow to inspect.' },
        },
        required: ['workflowId'],
      },
    },
    execute: internalTools.get_workflow,
  },

  search_workflows: {
    name: 'search_workflows',
    description: 'Search workflows created by or assigned to the user, with filters for status, type, and priority.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: null,
    schema: toolSchemas.search_workflows,
    declaration: {
      name: 'search_workflows',
      description: 'Search for existing company workflows with filters like status, type, and priority.',
      parameters: {
        type: 'OBJECT',
        properties: {
          status: {
            type: 'STRING',
            enum: ['draft', 'submitted', 'ai_analyzing', 'needs_information', 'awaiting_approval', 'approved', 'processing', 'blocked', 'escalated', 'completed', 'rejected', 'failed', 'cancelled'],
          },
          workflowType: {
            type: 'STRING',
            enum: ['approval', 'invoice', 'expense', 'procurement', 'onboarding', 'helpdesk', 'meeting'],
          },
          priority: { type: 'STRING', enum: ['low', 'normal', 'high', 'critical'] },
        },
      },
    },
    execute: internalTools.search_workflows,
  },

  get_tasks: {
    name: 'get_tasks',
    description: 'List active tasks assigned to the user or associated with an authorized workflow.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: null,
    schema: toolSchemas.get_tasks,
    declaration: {
      name: 'get_tasks',
      description: 'Fetch open or assigned tasks for the authenticated user.',
      parameters: {
        type: 'OBJECT',
        properties: {
          status: { type: 'STRING', enum: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'] },
          priority: { type: 'STRING', enum: ['low', 'normal', 'high', 'critical'] },
          workflowId: { type: 'STRING', description: 'Optional workflow UUID filter.' },
        },
      },
    },
    execute: internalTools.get_tasks,
  },

  get_company_policy: {
    name: 'get_company_policy',
    description: 'Look up official company policy limits, rules, and approval thresholds (e.g., expense limits, SLA standards).',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: null,
    schema: toolSchemas.get_company_policy,
    declaration: {
      name: 'get_company_policy',
      description: 'Read real company policies and thresholds from the database.',
      parameters: {
        type: 'OBJECT',
        properties: {
          policyKey: { type: 'STRING', description: 'Policy key or category name (e.g. expense.default, helpdesk.sla, procurement.budget).' },
        },
        required: ['policyKey'],
      },
    },
    execute: internalTools.get_company_policy,
  },

  get_dashboard_metrics: {
    name: 'get_dashboard_metrics',
    description: 'Get high level operations overview (active workflows, open alerts) for the company operations center.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: null,
    schema: toolSchemas.get_dashboard_metrics,
    declaration: {
      name: 'get_dashboard_metrics',
      description: 'Fetch operations dashboard metrics and active workflow counts.',
      parameters: {
        type: 'OBJECT',
        properties: {
          period: { type: 'STRING', enum: ['today', 'week', 'month'] },
        },
      },
    },
    execute: internalTools.get_dashboard_metrics,
  },

  // Internal Write Tools
  create_workflow: {
    name: 'create_workflow',
    description: 'Create a new business workflow (expense, approval, helpdesk, onboarding, procurement, invoice, meeting) in the workflow engine.',
    riskLevel: TOOL_RISK_LEVELS.INTERNAL_WRITE,
    requiredPermission: 'workflow.create',
    schema: toolSchemas.create_workflow,
    declaration: {
      name: 'create_workflow',
      description: 'Creates a new company workflow with automatic routing, steps, and approval generation.',
      parameters: {
        type: 'OBJECT',
        properties: {
          workflowType: {
            type: 'STRING',
            enum: ['approval', 'invoice', 'expense', 'procurement', 'onboarding', 'helpdesk', 'meeting'],
            description: 'The type of workflow to initiate.',
          },
          title: { type: 'STRING', description: 'Clear, descriptive title for the workflow.' },
          summary: { type: 'STRING', description: 'Concise summary of what is requested.' },
          priority: { type: 'STRING', enum: ['low', 'normal', 'high', 'critical'] },
          department: { type: 'STRING', description: 'Department handling or requesting the workflow.' },
          aiData: {
            type: 'OBJECT',
            description: 'Extracted structured payload (e.g. amount, category, purpose, vendor, candidateName).',
          },
        },
        required: ['workflowType', 'title'],
      },
    },
    execute: internalTools.create_workflow,
  },

  create_task: {
    name: 'create_task',
    description: 'Create a specific action task under an existing workflow.',
    riskLevel: TOOL_RISK_LEVELS.INTERNAL_WRITE,
    requiredPermission: 'task.create',
    schema: toolSchemas.create_task,
    declaration: {
      name: 'create_task',
      description: 'Create a task linked to a workflow.',
      parameters: {
        type: 'OBJECT',
        properties: {
          workflowId: { type: 'STRING', description: 'The parent workflow UUID.' },
          title: { type: 'STRING', description: 'Title of the task.' },
          description: { type: 'STRING', description: 'Detailed instructions for the task.' },
          assigneeRole: { type: 'STRING', description: 'Target role (e.g. it_support, finance, hr).' },
          priority: { type: 'STRING', enum: ['low', 'normal', 'high', 'critical'] },
          dueOffsetDays: { type: 'INTEGER', description: 'Due date offset in days from now.' },
        },
        required: ['workflowId', 'title'],
      },
    },
    execute: internalTools.create_task,
  },

  update_task: {
    name: 'update_task',
    description: 'Update the status or progress of an authorized task.',
    riskLevel: TOOL_RISK_LEVELS.INTERNAL_WRITE,
    requiredPermission: 'task.update',
    schema: toolSchemas.update_task,
    declaration: {
      name: 'update_task',
      description: 'Update the status of an existing task.',
      parameters: {
        type: 'OBJECT',
        properties: {
          taskId: { type: 'STRING', description: 'The task UUID.' },
          status: { type: 'STRING', enum: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'] },
          notes: { type: 'STRING', description: 'Optional progress notes.' },
        },
        required: ['taskId', 'status'],
      },
    },
    execute: internalTools.update_task,
  },

  create_approval: {
    name: 'create_approval',
    description: 'Create a human approval requirement on a workflow.',
    riskLevel: TOOL_RISK_LEVELS.INTERNAL_WRITE,
    requiredPermission: 'workflow.create',
    schema: toolSchemas.create_approval,
    declaration: {
      name: 'create_approval',
      description: 'Create an approval checkpoint requiring human decision.',
      parameters: {
        type: 'OBJECT',
        properties: {
          workflowId: { type: 'STRING', description: 'Workflow UUID.' },
          approverId: { type: 'STRING', description: 'User UUID of the designated approver.' },
          comments: { type: 'STRING', description: 'Reason for approval request.' },
        },
        required: ['workflowId', 'approverId'],
      },
    },
    execute: internalTools.create_approval,
  },
};

export function getAvailableToolsDeclarations() {
  return Object.values(toolRegistry).map(t => t.declaration);
}
