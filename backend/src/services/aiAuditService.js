// backend/src/services/aiAuditService.js
// Audits AI agent operations and tool executions to activity_logs

import { supabase } from '../config/supabase.js';

export const aiAuditService = {
  async logToolExecution({ workflowId = null, actorId, toolName, status, summary, metadata = {} }) {
    try {
      // Sanitize metadata to never leak API keys, system prompts, or secrets
      const safeMetadata = {
        tool: toolName,
        status,
        summary: summary || null,
        executionTimeMs: metadata.executionTimeMs || null,
        argsKeys: metadata.args ? Object.keys(metadata.args) : [],
        error: metadata.error ? String(metadata.error) : null,
      };

      const logPayload = {
        workflow_id: workflowId,
        actor_type: 'ai',
        actor_id: actorId || null,
        action: 'ai_called_tool',
        description: `AI executed tool "${toolName}" [Status: ${status}]: ${summary || 'Executed successfully'}`,
        metadata: safeMetadata,
      };

      const { error } = await supabase.from('activity_logs').insert(logPayload);
      if (error) {
        console.error('Failed to insert AI audit log:', error.message);
      }
    } catch (err) {
      console.error('AI Audit Service Error:', err.message);
    }
  },

  async getUserAiHistory(userId, limit = 20) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('actor_type', 'ai')
      .eq('actor_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch AI history: ${error.message}`);
    return data || [];
  },
};
