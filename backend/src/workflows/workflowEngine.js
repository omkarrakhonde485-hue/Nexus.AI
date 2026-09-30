// backend/src/workflows/workflowEngine.js
// Core deterministic workflow engine: state transitions, step instantiation, dependency evaluation & SLA tracking

import { workflowRepository } from '../repositories/workflowRepository.js';
import { WORKFLOW_DEFINITIONS, DEMO_SLA_MINUTES } from './workflowDefinitions.js';
import { isValidTransition, isTerminalState } from './workflowStateMachine.js';
import { resolveAssignee } from './workflowRouter.js';
import { requiresHumanApproval } from './workflowRules.js';
import { createActivityLog } from '../services/activityService.js';
import { supabase } from '../config/supabase.js';

export const workflowEngine = {
  // 1. CREATE WORKFLOW
  async createWorkflow(payload, requester = { id: null, fullName: 'User', managerId: null }) {
    const { workflowType, title, summary, department = 'General', priority = 'normal', aiData = {} } = payload;

    // Validate workflow type
    const definition = WORKFLOW_DEFINITIONS[workflowType];
    if (!definition) {
      const err = new Error(`Unsupported workflow type: ${workflowType}`);
      err.status = 400;
      throw err;
    }

    if (!title || title.trim() === '') {
      const err = new Error('Workflow title is required.');
      err.status = 400;
      throw err;
    }

    // Calculate SLA Due Date
    const slaConfig = definition.slaMinutes || DEMO_SLA_MINUTES;
    const minutes = typeof slaConfig === 'number' ? slaConfig : (slaConfig[priority] || DEMO_SLA_MINUTES.default);
    const slaDueAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    // Create workflow record in database (initial state: submitted)
    const workflow = await workflowRepository.create({
      created_by: requester.id,
      workflow_type: workflowType,
      title: title.trim(),
      summary: summary || null,
      status: 'submitted',
      priority,
      department,
      current_assignee_id: null,
      ai_data: aiData || {},
      risk_flags: [],
      missing_information: [],
      sla_due_at: slaDueAt,
      started_at: new Date().toISOString(),
    });

    // Create workflow creation audit log
    await createActivityLog({
      workflowId: workflow.id,
      actorType: 'user',
      actorId: requester.id,
      action: 'workflow_created',
      description: `Workflow created: ${workflow.title} [Type: ${workflow.workflow_type}]`,
      metadata: { workflowType, priority, department, aiData },
    });

    // Instantiate workflow steps from definition template
    const stepsToCreate = definition.steps.map((s, idx) => ({
      workflow_id: workflow.id,
      name: s.name,
      step_type: s.type,
      status: 'pending',
      assignee_role: s.assigneeRule?.startsWith('role:') ? s.assigneeRule.split(':')[1] : null,
      order_index: s.orderIndex || idx + 1,
      metadata: {
        description: s.description || null,
        assigneeRule: s.assigneeRule,
        requiresApproval: s.requiresApproval || false,
        dependsOn: s.dependsOn || [],
        parallelGroup: s.parallelGroup || null,
        dueOffsetDays: s.dueOffsetDays || null,
      },
    }));

    await workflowRepository.createSteps(stepsToCreate);

    // Advance workflow to activate initial step(s)
    await this.advanceWorkflow(workflow.id, requester);

    return workflowRepository.findById(workflow.id);
  },

  // 2. TRANSITION WORKFLOW STATE
  async transitionWorkflow(workflowId, targetState, actorContext = { id: null, fullName: 'System' }) {
    const workflow = await workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow with ID ${workflowId} not found.`);
    }

    if (workflow.status === targetState) {
      return workflow;
    }

    if (!isValidTransition(workflow.status, targetState)) {
      const err = new Error(`Invalid workflow state transition from ${workflow.status} to ${targetState}.`);
      err.status = 400;
      throw err;
    }

    const updates = { status: targetState };
    if (isTerminalState(targetState)) {
      updates.completed_at = new Date().toISOString();
    }

    const updatedWorkflow = await workflowRepository.update(workflowId, updates);

    await createActivityLog({
      workflowId,
      actorType: actorContext.id ? 'user' : 'system',
      actorId: actorContext.id || null,
      action: 'workflow_transitioned',
      description: `Workflow status changed from ${workflow.status} to ${targetState}`,
      metadata: { previousState: workflow.status, newState: targetState },
    });

    return updatedWorkflow;
  },

  // 3. ADVANCE WORKFLOW (STEP & TASK/APPROVAL ACTIVATION)
  async advanceWorkflow(workflowId, actorContext = { id: null, fullName: 'System' }) {
    const workflow = await workflowRepository.findById(workflowId);
    if (!workflow || isTerminalState(workflow.status)) {
      return workflow;
    }

    const steps = await workflowRepository.findStepsByWorkflowId(workflowId);
    if (steps.length === 0) {
      return workflow;
    }

    // Lazy load services to break circular imports
    const { approvalService } = await import('../services/approvalService.js');
    const { taskService } = await import('../services/taskService.js');

    // Load requester details for assignee routing
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('id, manager_id, role, department')
      .eq('id', workflow.created_by)
      .single();

    const routingContext = {
      requesterId: workflow.created_by,
      requesterManagerId: requesterProfile?.manager_id || null,
      department: workflow.department,
    };

    const completedStepNames = new Set(
      steps.filter(s => s.status === 'completed' || s.status === 'skipped').map(s => s.name)
    );

    let anyActive = false;

    for (const step of steps) {
      // Skip already completed/failed/skipped steps
      if (step.status === 'completed' || step.status === 'skipped' || step.status === 'failed') {
        continue;
      }

      // Check step dependencies
      const dependsOn = step.metadata?.dependsOn || [];
      const dependenciesMet = dependsOn.every(depName => completedStepNames.has(depName));

      if (!dependenciesMet) {
        continue; // Wait for dependent step to finish
      }

      // If step is pending, activate it!
      if (step.status === 'pending') {
        const assigneeRule = step.metadata?.assigneeRule;
        const resolution = await resolveAssignee(assigneeRule, routingContext);

        // Handle missing manager failure gracefully
        if (resolution.missingManager) {
          await workflowRepository.updateStep(step.id, { status: 'blocked' });
          await this.transitionWorkflow(workflowId, 'blocked', actorContext);
          await createActivityLog({
            workflowId,
            actorType: 'system',
            action: 'workflow_blocked',
            description: `Blocked: Requester has no manager configured for step "${step.name}".`,
          });

          // Create Alert for Admin
          await supabase.from('alerts').insert({
            workflow_id: workflowId,
            severity: 'high',
            type: 'missing_manager',
            title: 'No Manager Configured',
            message: `Requester ${workflow.created_by} does not have a manager set in profiles.`,
            status: 'open',
          });
          return workflow;
        }

        // Update step status to in_progress & set assignee
        await workflowRepository.updateStep(step.id, {
          status: 'in_progress',
          assignee_id: resolution.assigneeId || null,
          assignee_role: resolution.assigneeRole || null,
        });

        // Update workflow current_assignee_id
        if (resolution.assigneeId) {
          await workflowRepository.update(workflowId, { current_assignee_id: resolution.assigneeId });
        }

        // Instantiation: Create corresponding Approval or Task
        if (step.step_type === 'approval' || step.metadata?.requiresApproval) {
          await approvalService.createApproval({
            workflowId,
            workflowStepId: step.id,
            approverId: resolution.assigneeId,
            comments: `Approval required for step: ${step.name}`,
          }, actorContext);
          anyActive = true;
        } else if (step.step_type === 'task' || step.step_type === 'processing') {
          let dueAt = null;
          if (step.metadata?.dueOffsetDays) {
            dueAt = new Date(Date.now() + step.metadata.dueOffsetDays * 24 * 60 * 60 * 1000).toISOString();
          }

          await taskService.createTask({
            workflowId,
            title: `${workflow.title} - ${step.name}`,
            description: step.metadata?.description || step.description || `Execute task for ${step.name}`,
            assigneeId: resolution.assigneeId,
            assigneeRole: resolution.assigneeRole,
            status: 'pending',
            priority: workflow.priority,
            dueAt,
            createdBy: workflow.created_by,
            metadata: { stepId: step.id, parallelGroup: step.metadata?.parallelGroup || null },
          }, actorContext);

          if (workflow.status !== 'processing' && workflow.status !== 'awaiting_approval') {
            await this.transitionWorkflow(workflowId, 'processing', actorContext);
          }
          anyActive = true;
        }
      } else if (step.status === 'in_progress') {
        anyActive = true;
      }
    }

    // Check if ALL mandatory steps are complete -> Transition Workflow to COMPLETED
    const allCompleted = steps.every(s => s.status === 'completed' || s.status === 'skipped');
    if (allCompleted) {
      await this.transitionWorkflow(workflowId, 'completed', actorContext);
      await createActivityLog({
        workflowId,
        actorType: actorContext.id ? 'user' : 'system',
        actorId: actorContext.id || null,
        action: 'workflow_completed',
        description: `Workflow "${workflow.title}" completed successfully.`,
      });
    }

    return workflowRepository.findById(workflowId);
  },

  // 4. CANCEL WORKFLOW
  async cancelWorkflow(workflowId, actorContext = { id: null, fullName: 'User' }, reason = 'User requested cancellation') {
    const workflow = await workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow with ID ${workflowId} not found.`);
    }

    if (isTerminalState(workflow.status)) {
      const err = new Error(`Cannot cancel workflow in terminal state: ${workflow.status}`);
      err.status = 400;
      throw err;
    }

    // Update workflow to cancelled
    const cancelled = await this.transitionWorkflow(workflowId, 'cancelled', actorContext);

    // Cancel pending steps, tasks, approvals
    const steps = await workflowRepository.findStepsByWorkflowId(workflowId);
    for (const step of steps) {
      if (step.status === 'pending' || step.status === 'in_progress') {
        await workflowRepository.updateStep(step.id, { status: 'skipped' });
      }
    }

    // Cancel pending tasks
    await supabase
      .from('tasks')
      .update({ status: 'cancelled' })
      .eq('workflow_id', workflowId)
      .in('status', ['pending', 'in_progress']);

    // Cancel pending approvals
    await supabase
      .from('approvals')
      .update({ status: 'cancelled' })
      .eq('workflow_id', workflowId)
      .eq('status', 'pending');

    await createActivityLog({
      workflowId,
      actorType: 'user',
      actorId: actorContext.id || null,
      action: 'workflow_cancelled',
      description: `Workflow cancelled: ${reason}`,
    });

    return cancelled;
  },

  // 5. GET SLA STATUS
  getSlaStatus(workflow) {
    if (!workflow || !workflow.sla_due_at) return 'on_track';
    if (isTerminalState(workflow.status)) return 'on_track';

    const now = Date.now();
    const due = new Date(workflow.sla_due_at).getTime();
    const start = new Date(workflow.started_at || workflow.created_at).getTime();

    if (now > due) return 'overdue';

    const totalDuration = due - start;
    const timeRemaining = due - now;

    // Approaching SLA if less than 25% remaining time
    if (timeRemaining < totalDuration * 0.25) {
      return 'approaching';
    }

    return 'on_track';
  },

  // 6. ESCALATE WORKFLOW
  async escalateWorkflow(workflowId, actorContext = { id: null, fullName: 'System' }, reason = 'SLA Overdue') {
    const workflow = await workflowRepository.findById(workflowId);
    if (!workflow || isTerminalState(workflow.status)) return workflow;

    const escalated = await this.transitionWorkflow(workflowId, 'escalated', actorContext);

    await supabase.from('alerts').insert({
      workflow_id: workflowId,
      severity: 'high',
      type: 'sla_overdue',
      title: `SLA Escalation: ${workflow.title}`,
      message: `Workflow SLA has passed deadline (${reason}). Immediate review required.`,
      status: 'open',
    });

    return escalated;
  },
};
