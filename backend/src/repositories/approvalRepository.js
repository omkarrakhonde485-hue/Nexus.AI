// backend/src/repositories/approvalRepository.js
// Database persistence layer for Approvals

import { supabase } from '../config/supabase.js';

export const approvalRepository = {
  async create(approvalData) {
    const { data, error } = await supabase
      .from('approvals')
      .insert(approvalData)
      .select('*')
      .single();

    if (error) throw new Error(`Approval repository create failed: ${error.message}`);
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('approvals')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Approval repository update failed: ${error.message}`);
    return data;
  },

  async list({ workflowId, approverId, status, limit = 50, offset = 0 }) {
    let query = supabase.from('approvals').select('*', { count: 'exact' });

    if (workflowId) query = query.eq('workflow_id', workflowId);
    if (approverId) query = query.eq('approver_id', approverId);
    if (status) query = query.eq('status', status);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`Approval repository list failed: ${error.message}`);
    return { approvals: data || [], total: count || 0 };
  },
};
