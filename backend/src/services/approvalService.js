// backend/src/services/approvalService.js
// Human-in-the-loop approval management and validation

import { approvalRepository } from '../repositories/approvalRepository.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
import { createActivityLog } from './activityService.js';
import { canApproveWorkflow } from './permissionService.js';
import { validateSelfApproval } from '../workflows/workflowRules.js';
import { workflowEngine } from '../workflows/workflowEngine.js';

export const approvalService = {
  async createApproval(approvalData, actorContext = { type: 'system', id: null }) {
    // Check idempotency: avoid creating duplicate pending approvals for the same workflow
    if (approvalData.workflowId) {
      const existing = await approvalRepository.list({
        workflowId: approvalData.workflowId,
        status: 'pending',
      });
      if (existing.approvals.length > 0) {
        return existing.approvals[0];
      }
    }

    const approval = await approvalRepository.create({
      workflow_id: approvalData.workflowId,
      approver_id: approvalData.approverId,
      approver_role: approvalData.approverRole || null,
      status: 'pending',
      comments: approvalData.comments || null,
    });

    // Set workflow state to awaiting_approval
    await workflowEngine.transitionWorkflow(
      approvalData.workflowId,
      'awaiting_approval',
      actorContext
    );

    await createActivityLog({
      workflowId: approvalData.workflowId,
      actorType: actorContext.type || 'system',
      actorId: actorContext.id || null,
      action: 'approval_created',
      description: `Approval requested from approver ID: ${approvalData.approverId}`,
      metadata: { approvalId: approval.id, approverId: approvalData.approverId },
    });

    return approval;
  },

  async getApprovalById(approvalId) {
    return approvalRepository.findById(approvalId);
  },

  async listApprovals(filters) {
    return approvalRepository.list(filters);
  },

  async approve(approvalId, userContext, comments = '') {
    const approval = await approvalRepository.findById(approvalId);
    if (!approval) {
      const err = new Error(`Approval record ${approvalId} not found.`);
      err.status = 404;
      throw err;
    }

    if (approval.status !== 'pending') {
      const err = new Error(`Approval ${approvalId} is not pending (current status: ${approval.status}).`);
      err.status = 400;
      throw err;
    }

    const workflow = await workflowRepository.findById(approval.workflow_id);
    if (!workflow) {
      const err = new Error(`Associated workflow ${approval.workflow_id} not found.`);
      err.status = 404;
      throw err;
    }

    // Load requester profile to verify manager relationship
    const requester = await workflowRepository.findById(workflow.created_by) || { manager_id: null };

    // 1. Verify Self Approval Prevention
    if (!validateSelfApproval(workflow.created_by, userContext.id)) {
      const err = new Error('Self-approval blocked: Requester cannot approve their own workflow.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // 2. Verify Approver Identity and Permissions
    const isTargetApprover = approval.approver_id === userContext.id;
    const isAuthorized = canApproveWorkflow(userContext, workflow, requester);

    if (!isTargetApprover && !isAuthorized) {
      const err = new Error('Access denied: You are not authorized to approve this workflow.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // Perform Approval Update
    const updatedApproval = await approvalRepository.update(approvalId, {
      status: 'approved',
      comments: comments || null,
      decided_at: new Date().toISOString(),
    });

    // Locate active approval step and mark completed
    const steps = await workflowRepository.findStepsByWorkflowId(approval.workflow_id);
    const activeStep = steps.find(s => s.status === 'in_progress' && (s.step_type === 'approval' || s.metadata?.requiresApproval));
    if (activeStep) {
      await workflowRepository.updateStep(activeStep.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    }

    await createActivityLog({
      workflowId: workflow.id,
      actorType: 'user',
      actorId: userContext.id,
      action: 'approval_approved',
      description: `Approval approved by ${userContext.fullName || userContext.email}`,
      metadata: { approvalId, comments },
    });

    // Transition workflow to approved state and advance next steps!
    await workflowEngine.transitionWorkflow(workflow.id, 'approved', userContext);
    await workflowEngine.advanceWorkflow(workflow.id, userContext);

    return updatedApproval;
  },

  async reject(approvalId, userContext, comments = '') {
    const approval = await approvalRepository.findById(approvalId);
    if (!approval) {
      const err = new Error(`Approval record ${approvalId} not found.`);
      err.status = 404;
      throw err;
    }

    if (approval.status !== 'pending') {
      const err = new Error(`Approval ${approvalId} is not pending.`);
      err.status = 400;
      throw err;
    }

    const workflow = await workflowRepository.findById(approval.workflow_id);

    // Update Approval
    const updatedApproval = await approvalRepository.update(approvalId, {
      status: 'rejected',
      comments: comments || null,
      decided_at: new Date().toISOString(),
    });

    // Locate active approval step and mark failed
    const steps = await workflowRepository.findStepsByWorkflowId(approval.workflow_id);
    const activeStep = steps.find(s => s.status === 'in_progress' && (s.step_type === 'approval' || s.metadata?.requiresApproval));
    if (activeStep) {
      await workflowRepository.updateStep(activeStep.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
      });
    }

    await createActivityLog({
      workflowId: approval.workflow_id,
      actorType: 'user',
      actorId: userContext.id,
      action: 'approval_rejected',
      description: `Approval rejected by ${userContext.fullName || userContext.email}: ${comments || 'No reason provided'}`,
      metadata: { approvalId, comments },
    });

    // Transition workflow to rejected terminal state
    await workflowEngine.transitionWorkflow(approval.workflow_id, 'rejected', userContext);

    return updatedApproval;
  },
};
