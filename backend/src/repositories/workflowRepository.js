// backend/src/repositories/workflowRepository.js
// Database persistence layer for Workflows and Workflow Steps

import { supabase } from '../config/supabase.js';

export const workflowRepository = {
  async create(workflowData) {
    const { data, error } = await supabase
      .from('workflows')
      .insert(workflowData)
      .select('*')
      .single();

    if (error) throw new Error(`Workflow repository create failed: ${error.message}`);
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('workflows')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Workflow repository update failed: ${error.message}`);
    return data;
  },

  async list({ status, workflowType, priority, createdBy, assigneeId, limit = 50, offset = 0 }) {
    let query = supabase.from('workflows').select('*', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (workflowType) query = query.eq('workflow_type', workflowType);
    if (priority) query = query.eq('priority', priority);
    if (createdBy) query = query.eq('created_by', createdBy);
    if (assigneeId) query = query.eq('current_assignee_id', assigneeId);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`Workflow repository list failed: ${error.message}`);
    return { workflows: data || [], total: count || 0 };
  },

  // Steps Persistence
  async createSteps(stepsData) {
    const { data, error } = await supabase
      .from('workflow_steps')
      .insert(stepsData)
      .select('*');

    if (error) throw new Error(`Workflow steps create failed: ${error.message}`);
    return data || [];
  },

  async findStepsByWorkflowId(workflowId) {
    const { data, error } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('order_index', { ascending: true });

    if (error) throw new Error(`Workflow steps query failed: ${error.message}`);
    return data || [];
  },

  async updateStep(stepId, updateData) {
    const { data, error } = await supabase
      .from('workflow_steps')
      .update(updateData)
      .eq('id', stepId)
      .select('*')
      .single();

    if (error) throw new Error(`Workflow step update failed: ${error.message}`);
    return data;
  },
};
