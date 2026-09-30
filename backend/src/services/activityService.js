// backend/src/services/activityService.js
// Permanent audit logging service

import { supabase } from '../config/supabase.js';

export const createActivityLog = async ({ workflowId, actorType = 'system', actorId = null, action, description, metadata = {} }) => {
  const allowedActorTypes = ['user', 'ai', 'system', 'google'];
  const safeActorType = allowedActorTypes.includes(actorType) ? actorType : 'system';

  // Sanitize metadata to exclude any token or secret properties
  const { password, token, refresh_token, secret, authorization, ...safeMetadata } = metadata;

  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      workflow_id: workflowId || null,
      actor_type: safeActorType,
      actor_id: actorId || null,
      action,
      description,
      metadata: safeMetadata,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Activity log creation failed:', error.message);
  }
  return data;
};

export const getActivityLogsByWorkflowId = async (workflowId) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Fetch activity logs failed: ${error.message}`);
  return data || [];
};
