// backend/src/workflows/workflowDefinitions.js
// Template definitions for all 7 operations workflow types

export const WORKFLOW_TYPES = {
  APPROVAL: 'approval',
  INVOICE: 'invoice',
  EXPENSE: 'expense',
  PROCUREMENT: 'procurement',
  ONBOARDING: 'onboarding',
  HELPDESK: 'helpdesk',
  MEETING: 'meeting',
};

export const DEMO_SLA_MINUTES = {
  helpdesk: {
    critical: 30,
    high: 120,
    normal: 480,
    low: 1440,
  },
  approval: {
    critical: 120,
    high: 480,
    normal: 1440,
    low: 2880,
  },
  expense: {
    critical: 480,
    high: 1440,
    normal: 2880,
    low: 4320,
  },
  default: 1440, // 24 hours default
};

export const WORKFLOW_DEFINITIONS = {
  approval: {
    type: WORKFLOW_TYPES.APPROVAL,
    name: 'General Approval Flow',
    description: 'Standard multi-level approval process',
    slaMinutes: DEMO_SLA_MINUTES.approval,
    steps: [
      {
        name: 'Manager Approval',
        description: 'Direct manager review and approval',
        type: 'approval',
        assigneeRule: 'requester_manager',
        requiresApproval: true,
        orderIndex: 1,
      },
      {
        name: 'Fulfillment Processing',
        description: 'System and operational fulfillment',
        type: 'processing',
        assigneeRule: 'admin_fallback',
        dependsOn: ['Manager Approval'],
        orderIndex: 2,
      },
    ],
  },

  expense: {
    type: WORKFLOW_TYPES.EXPENSE,
    name: 'AI ExpenseFlow',
    description: 'Expense reimbursement request with manager approval and finance processing',
    slaMinutes: DEMO_SLA_MINUTES.expense,
    requiresHumanApproval: true,
    steps: [
      {
        name: 'Manager Approval',
        description: 'Manager verification of expense purpose and policy bounds',
        type: 'approval',
        assigneeRule: 'requester_manager',
        requiresApproval: true,
        orderIndex: 1,
      },
      {
        name: 'Finance Reimbursement Processing',
        description: 'Finance review and payout processing',
        type: 'task',
        assigneeRule: 'role:finance',
        dependsOn: ['Manager Approval'],
        dueOffsetDays: 2,
        orderIndex: 2,
      },
    ],
  },

  invoice: {
    type: WORKFLOW_TYPES.INVOICE,
    name: 'Vendor Invoice Approval Flow',
    description: 'Accounts payable invoice audit and finance approval',
    slaMinutes: DEMO_SLA_MINUTES.approval,
    requiresHumanApproval: true,
    steps: [
      {
        name: 'Invoice Audit Review',
        description: 'Finance line item audit and receipt matching',
        type: 'task',
        assigneeRule: 'role:finance',
        orderIndex: 1,
      },
      {
        name: 'Finance Manager Approval',
        description: 'Executive finance sign-off on invoice payout',
        type: 'approval',
        assigneeRule: 'role:finance',
        requiresApproval: true,
        dependsOn: ['Invoice Audit Review'],
        orderIndex: 2,
      },
      {
        name: 'Payment Execution',
        description: 'Disbursement and ledger record processing',
        type: 'processing',
        assigneeRule: 'role:finance',
        dependsOn: ['Finance Manager Approval'],
        orderIndex: 3,
      },
    ],
  },

  procurement: {
    type: WORKFLOW_TYPES.PROCUREMENT,
    name: 'Procurement Request Flow',
    description: 'Equipment and software license purchasing workflow',
    slaMinutes: DEMO_SLA_MINUTES.approval,
    requiresHumanApproval: true,
    steps: [
      {
        name: 'Manager Approval',
        description: 'Manager budget authorization',
        type: 'approval',
        assigneeRule: 'requester_manager',
        requiresApproval: true,
        orderIndex: 1,
      },
      {
        name: 'Procurement Sourcing & Fulfillment',
        description: 'Sourcing, vendor order placement, and delivery setup',
        type: 'task',
        assigneeRule: 'role:procurement',
        dependsOn: ['Manager Approval'],
        dueOffsetDays: 3,
        orderIndex: 2,
      },
    ],
  },

  onboarding: {
    type: WORKFLOW_TYPES.ONBOARDING,
    name: 'Employee Onboarding Flow',
    description: 'Parallel department setup for new team members',
    slaMinutes: DEMO_SLA_MINUTES.default,
    steps: [
      {
        name: 'HR Profile & Contract Setup',
        description: 'HR documentation, background checks, and profile activation',
        type: 'task',
        assigneeRule: 'role:hr',
        parallelGroup: 'onboarding_setup',
        dueOffsetDays: 1,
        orderIndex: 1,
      },
      {
        name: 'IT Account & Laptop Provisioning',
        description: 'Workstation configuration, Google Workspace email, and access credentials',
        type: 'task',
        assigneeRule: 'role:it_support',
        parallelGroup: 'onboarding_setup',
        dueOffsetDays: 1,
        orderIndex: 2,
      },
      {
        name: 'Manager Orientation & 30-Day Plan',
        description: 'Team orientation, manager 1-on-1, and goal setting',
        type: 'task',
        assigneeRule: 'requester_manager',
        parallelGroup: 'onboarding_setup',
        dueOffsetDays: 2,
        orderIndex: 3,
      },
    ],
  },

  helpdesk: {
    type: WORKFLOW_TYPES.HELPDESK,
    name: 'IT Helpdesk Ticket Flow',
    description: 'IT support ticket assignment, troubleshooting, and resolution',
    slaMinutes: DEMO_SLA_MINUTES.helpdesk,
    steps: [
      {
        name: 'IT Troubleshooting & Resolution',
        description: 'IT Support technician diagnosis and fix execution',
        type: 'task',
        assigneeRule: 'role:it_support',
        orderIndex: 1,
      },
    ],
  },

  meeting: {
    type: WORKFLOW_TYPES.MEETING,
    name: 'MeetingOps Action Plan Flow',
    description: 'Post-meeting action item tracking and completion',
    slaMinutes: DEMO_SLA_MINUTES.default,
    steps: [
      {
        name: 'Action Items Execution',
        description: 'Complete designated meeting follow-up tasks',
        type: 'task',
        assigneeRule: 'requester',
        orderIndex: 1,
      },
    ],
  },
};
