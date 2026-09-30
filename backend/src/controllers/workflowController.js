// backend/src/controllers/workflowController.js
// Express controllers for Workflow endpoints

import { workflowEngine } from '../workflows/workflowEngine.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
import { getActivityLogsByWorkflowId } from '../services/activityService.js';
import { supabase } from '../config/supabase.js';

export const workflowController = {
  async create(req, res, next) {
    try {
      const { workflowType, title, summary, department, priority, aiData } = req.body;

      const workflow = await workflowEngine.createWorkflow(
        { workflowType, title, summary, department, priority, aiData },
        req.user
      );

      res.status(201).json({
        success: true,
        data: { workflow },
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const { status, workflow_type, priority, assignee, created_by, limit = 50, offset = 0 } = req.query;

      // Scoped listing based on user role
      let createdByFilter = created_by;
      let assigneeFilter = assignee === 'me' ? req.user.id : assignee;

      if (req.user.role === 'employee') {
        // Employees can only view their own workflows or workflows assigned to them
        if (!createdByFilter && !assigneeFilter) {
          createdByFilter = req.user.id;
        }
      } else if (req.user.role === 'manager') {
        // Managers can view team workflows (direct reports)
        const { data: team } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', req.user.id);
        const teamIds = (team || []).map(t => t.id).concat(req.user.id);

        if (!createdByFilter) {
          // If no specific createdBy requested, scope to team
          const result = await workflowRepository.list({
            status,
            workflowType: workflow_type,
            priority,
            assigneeId: assigneeFilter,
            limit: Number(limit),
            offset: Number(offset),
          });
          // Filter in memory for manager team if needed
          const filtered = result.workflows.filter(w => teamIds.includes(w.created_by) || w.current_assignee_id === req.user.id);
          return res.status(200).json({ success: true, data: { workflows: filtered, total: filtered.length } });
        }
      }

      const result = await workflowRepository.list({
        status,
        workflowType: workflow_type,
        priority,
        createdBy: createdByFilter,
        assigneeId: assigneeFilter,
        limit: Number(limit),
        offset: Number(offset),
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const workflow = await workflowRepository.findById(id);

      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Workflow ${id} not found.` },
        });
      }

      // Resource-level authorization check
      if (req.user.role === 'employee' && workflow.created_by !== req.user.id && workflow.current_assignee_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not authorized to view this workflow.' },
        });
      }

      const slaStatus = workflowEngine.getSlaStatus(workflow);

      res.status(200).json({
        success: true,
        data: { workflow, slaStatus },
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { title, summary, priority, department, aiData } = req.body;

      const workflow = await workflowRepository.findById(id);
      if (!workflow) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Workflow ${id} not found.` } });
      }

      if (req.user.role === 'employee' && workflow.created_by !== req.user.id) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized.' } });
      }

      const updates = {};
      if (title) updates.title = title;
      if (summary !== undefined) updates.summary = summary;
      if (priority) updates.priority = priority;
      if (department) updates.department = department;
      if (aiData) updates.ai_data = { ...workflow.ai_data, ...aiData };

      const updated = await workflowRepository.update(id, updates);

      res.status(200).json({
        success: true,
        data: { workflow: updated },
      });
    } catch (err) {
      next(err);
    }
  },

  async cancel(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const cancelled = await workflowEngine.cancelWorkflow(id, req.user, reason);

      res.status(200).json({
        success: true,
        data: { workflow: cancelled },
      });
    } catch (err) {
      next(err);
    }
  },

  async getSteps(req, res, next) {
    try {
      const { id } = req.params;
      const steps = await workflowRepository.findStepsByWorkflowId(id);

      res.status(200).json({
        success: true,
        data: { steps },
      });
    } catch (err) {
      next(err);
    }
  },

  async getActivity(req, res, next) {
    try {
      const { id } = req.params;
      const activity = await getActivityLogsByWorkflowId(id);

      res.status(200).json({
        success: true,
        data: { activity },
      });
    } catch (err) {
      next(err);
    }
  },
};
