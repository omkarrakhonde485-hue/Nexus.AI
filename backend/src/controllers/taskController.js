// backend/src/controllers/taskController.js
// Express controllers for Task management

import { taskService } from '../services/taskService.js';

export const taskController = {
  async list(req, res, next) {
    try {
      const { workflow_id, assignee_id, status, limit = 50, offset = 0 } = req.query;

      let assigneeFilter = assignee_id;
      if (req.user.role === 'employee' && !assigneeFilter) {
        assigneeFilter = req.user.id;
      }

      const result = await taskService.listTasks({
        workflowId: workflow_id,
        assigneeId: assigneeFilter,
        status,
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
      const task = await taskService.getTaskById(id);

      if (!task) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Task ${id} not found.` } });
      }

      res.status(200).json({
        success: true,
        data: { task },
      });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const { workflowId, title, description, assigneeId, assigneeRole, priority, dueAt, metadata } = req.body;

      const task = await taskService.createTask(
        { workflowId, title, description, assigneeId, assigneeRole, priority, dueAt, metadata },
        req.user
      );

      res.status(201).json({
        success: true,
        data: { task },
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { status, metadata } = req.body;

      const task = await taskService.getTaskById(id);
      if (!task) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Task ${id} not found.` } });
      }

      // Employee task assignment authorization check
      if (req.user.role === 'employee' && task.assignee_id && task.assignee_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only update tasks assigned to you.' },
        });
      }

      const updated = await taskService.updateTaskStatus(id, status, req.user, metadata || {});

      res.status(200).json({
        success: true,
        data: { task: updated },
      });
    } catch (err) {
      next(err);
    }
  },
};
