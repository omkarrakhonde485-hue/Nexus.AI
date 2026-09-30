// backend/src/services/taskService.js
// Task creation, status updates, and workflow advancement integration

import { taskRepository } from '../repositories/taskRepository.js';
import { createActivityLog } from './activityService.js';
import { workflowEngine } from '../workflows/workflowEngine.js';

export const taskService = {
  async createTask(taskData, actorContext = { type: 'system', id: null }) {
    const task = await taskRepository.create({
      workflow_id: taskData.workflowId,
      title: taskData.title,
      description: taskData.description || null,
      assignee_id: taskData.assigneeId || null,
      assignee_role: taskData.assigneeRole || null,
      status: taskData.status || 'pending',
      priority: taskData.priority || 'normal',
      due_at: taskData.dueAt || null,
      created_by: taskData.createdBy || actorContext.id || null,
      metadata: taskData.metadata || {},
    });

    await createActivityLog({
      workflowId: task.workflow_id,
      actorType: actorContext.type || 'system',
      actorId: actorContext.id || null,
      action: 'task_created',
      description: `Task created: ${task.title} (Assignee Role: ${task.assignee_role || 'Unassigned'})`,
      metadata: { taskId: task.id, assigneeId: task.assignee_id },
    });

    return task;
  },

  async getTaskById(taskId) {
    return taskRepository.findById(taskId);
  },

  async listTasks(filters) {
    return taskRepository.list(filters);
  },

  async updateTaskStatus(taskId, newStatus, actorContext = { id: null, fullName: 'User' }, extraMetadata = {}) {
    const existing = await taskRepository.findById(taskId);
    if (!existing) {
      throw new Error(`Task with ID ${taskId} not found.`);
    }

    const updates = { status: newStatus, metadata: { ...existing.metadata, ...extraMetadata } };

    if (newStatus === 'completed') {
      updates.completed_by = actorContext.id || null;
      updates.completed_at = new Date().toISOString();
    }

    const updatedTask = await taskRepository.update(taskId, updates);

    await createActivityLog({
      workflowId: updatedTask.workflow_id,
      actorType: actorContext.id ? 'user' : 'system',
      actorId: actorContext.id || null,
      action: newStatus === 'completed' ? 'task_completed' : 'task_updated',
      description: `Task "${updatedTask.title}" status changed to ${newStatus} by ${actorContext.fullName || 'system'}`,
      metadata: { taskId, previousStatus: existing.status, newStatus },
    });

    // When task is completed, advance the parent workflow lifecycle!
    if (newStatus === 'completed') {
      await workflowEngine.advanceWorkflow(updatedTask.workflow_id, actorContext);
    }

    return updatedTask;
  },
};
