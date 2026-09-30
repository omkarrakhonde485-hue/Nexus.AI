// backend/src/repositories/taskRepository.js
// Database persistence layer for Tasks

import { supabase } from '../config/supabase.js';

export const taskRepository = {
  async create(taskData) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select('*')
      .single();

    if (error) throw new Error(`Task repository create failed: ${error.message}`);
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Task repository update failed: ${error.message}`);
    return data;
  },

  async list({ workflowId, assigneeId, assigneeRole, status, limit = 50, offset = 0 }) {
    let query = supabase.from('tasks').select('*', { count: 'exact' });

    if (workflowId) query = query.eq('workflow_id', workflowId);
    if (assigneeId) query = query.eq('assignee_id', assigneeId);
    if (assigneeRole) query = query.eq('assignee_role', assigneeRole);
    if (status) query = query.eq('status', status);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`Task repository list failed: ${error.message}`);
    return { tasks: data || [], total: count || 0 };
  },
};
