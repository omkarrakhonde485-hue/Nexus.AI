// backend/src/agents/responseFormatter.js
// Standardizes the AI Agent response payload with confirmation support

export function formatAgentResponse({
  message,
  executedActions = [],
  workflowId = null,
  intent = 'general',
  requiresConfirmation = false,
  pendingActionId = null,
  proposal = null,
}) {
  // Determine intent from executed actions or text
  let detectedIntent = intent;
  let primaryWorkflowId = workflowId;

  for (const action of executedActions) {
    if (action.tool === 'create_workflow' || action.tool === 'get_workflow') {
      detectedIntent = action.result?.workflow?.type || detectedIntent;
      if (action.result?.workflow?.id) {
        primaryWorkflowId = action.result.workflow.id;
      }
    }
  }

  const cleanActions = executedActions.map(a => ({
    tool: a.tool,
    status: a.status || (a.result?.success !== false ? 'success' : 'failed'),
    summary: a.result?.summary || a.summary || (a.result?.success !== false ? 'Executed successfully' : a.result?.error || 'Execution failed'),
  }));

  return {
    success: true,
    data: {
      message: message || 'I processed your request.',
      intent: detectedIntent,
      workflowId: primaryWorkflowId,
      actions: cleanActions,
      requiresConfirmation: Boolean(requiresConfirmation),
      pendingActionId: pendingActionId || null,
      proposal: proposal || null,
    },
  };
}
