// backend/src/agents/nexusAgent.js
// Central NEXUS AI Agent: Autonomous tool execution loop and operations orchestration with server-authoritative confirmation gating

import { buildAgentContext } from './contextBuilder.js';
import { getNexusAgentSystemPrompt } from './agentPrompt.js';
import { formatAgentResponse } from './responseFormatter.js';
import { geminiService } from '../services/geminiService.js';
import { executeToolCall } from '../tools/toolExecutor.js';
import { aiPendingActionService } from '../services/aiPendingActionService.js';
import { googleCalendarTools } from '../tools/googleCalendarTools.js';
import { googleClientFactory } from '../integrations/google/googleClientFactory.js';

const MAX_TOOL_ITERATIONS = 5;

/**
 * Check if a text message is an affirmative confirmation
 */
function isAffirmativeConfirmation(text) {
  const normalized = (text || '').trim().toLowerCase().replace(/[^\w\s]/g, '');
  const affirmativeKeywords = [
    'yes', 'yes schedule it', 'yes please', 'confirm', 'schedule it',
    'please schedule', 'go ahead', 'proceed', 'schedule', 'yes do it',
    'do it', 'sure', 'yep', 'yeah', 'ok', 'okay'
  ];
  return affirmativeKeywords.some(kw => normalized === kw || normalized.startsWith('yes ') || normalized.endsWith(' schedule it'));
}

/**
 * Check if a text message is a rejection or cancellation
 */
function isRejectionOrCancellation(text) {
  const normalized = (text || '').trim().toLowerCase().replace(/[^\w\s]/g, '');
  const rejectionKeywords = [
    'no', 'cancel', 'dont schedule', 'not now',
    'nevermind', 'never mind', 'stop', 'reject', 'abort', 'dont do it'
  ];
  return rejectionKeywords.some(kw => normalized === kw || normalized.startsWith('no ') || normalized.startsWith('cancel'));
}

export async function processAgentRequest({ user, message, workflowId = null, extraContext = {}, pendingActionId = null }) {
  if (!message || message.trim() === '') {
    const err = new Error('Message is required for AI agent.');
    err.status = 400;
    throw err;
  }

  const cleanMessage = message.trim();

  // =========================================================================
  // 1. Check for Pending Action Confirmation / Cancellation (Server-Authoritative)
  // =========================================================================
  let pendingRecord = null;
  if (pendingActionId) {
    pendingRecord = await aiPendingActionService.getPendingAction(pendingActionId, user.id);
  }

  // Fallback: If client didn't send pendingActionId but message is clearly affirmative/rejection, check active pending action for user
  if (!pendingRecord && (isAffirmativeConfirmation(cleanMessage) || isRejectionOrCancellation(cleanMessage))) {
    pendingRecord = await aiPendingActionService.getActivePendingActionForUser(user.id);
  }

  if (pendingRecord) {
    // A. Affirmative Confirmation Flow
    if (isAffirmativeConfirmation(cleanMessage)) {
      console.log(`[AI Agent] Resuming stored pending action ${pendingRecord.id} for user ${user.id}`);

      // Check status
      if (pendingRecord.status === 'completed') {
        return formatAgentResponse({
          message: `This meeting has already been scheduled (${pendingRecord.payload?.displayFull || 'earlier'}).`,
          executedActions: [{
            tool: 'create_calendar_event',
            status: 'success',
            summary: `Event already scheduled: ${pendingRecord.payload?.summary}`,
          }],
          workflowId,
          intent: 'meeting',
        });
      }

      if (pendingRecord.status === 'cancelled') {
        return formatAgentResponse({
          message: 'This meeting proposal was previously cancelled. Please request a new slot.',
          executedActions: [],
          workflowId,
          intent: 'meeting',
        });
      }

      if (pendingRecord.status === 'expired' || new Date(pendingRecord.expires_at) <= new Date()) {
        await aiPendingActionService.markExpired(pendingRecord.id);
        return formatAgentResponse({
          message: 'This meeting proposal has expired (proposals are valid for 15 minutes). Please ask again to check available slots.',
          executedActions: [],
          workflowId,
          intent: 'meeting',
        });
      }

      // Check Google connection validity
      try {
        await googleClientFactory.getAuthenticatedGoogleClient(user.id);
      } catch (authErr) {
        return formatAgentResponse({
          message: `Google Workspace connection is not valid: ${authErr.message}. Please reconnect your account in Settings.`,
          executedActions: [],
          workflowId,
          intent: 'meeting',
        });
      }

      // Execute with the exact server-stored payload (Do NOT call Gemini to reinterpret payload!)
      const execResult = await googleCalendarTools.create_calendar_event.execute(
        { pendingActionId: pendingRecord.id },
        { user, isAi: true }
      );

      if (execResult.success) {
        const payload = pendingRecord.payload;
        const attendeeInfo = payload.attendees?.[0] ? `with ${payload.attendees[0]}` : '';
        const timeInfo = execResult.event?.displayFull || payload.displayFull || `${payload.start} IST`;

        return formatAgentResponse({
          message: `Scheduled the meeting ${attendeeInfo} for ${timeInfo}.`.replace(/\s+/g, ' '),
          executedActions: [{
            tool: 'create_calendar_event',
            status: 'success',
            summary: `Scheduled Google Calendar event "${payload.summary}"`,
            result: execResult,
          }],
          workflowId,
          intent: 'meeting',
        });
      } else {
        return formatAgentResponse({
          message: `Failed to schedule calendar event: ${execResult.error}`,
          executedActions: [{
            tool: 'create_calendar_event',
            status: 'failed',
            summary: execResult.error,
          }],
          workflowId,
          intent: 'meeting',
        });
      }
    }

    // B. Rejection / Cancellation Flow
    if (isRejectionOrCancellation(cleanMessage)) {
      console.log(`[AI Agent] User cancelled pending action ${pendingRecord.id}`);
      await aiPendingActionService.markCancelled(pendingRecord.id, user.id);

      return formatAgentResponse({
        message: "Understood, I've cancelled scheduling the meeting. No Google Calendar event was created.",
        executedActions: [{
          tool: 'cancel_pending_action',
          status: 'success',
          summary: `Cancelled pending action ID ${pendingRecord.id}`,
        }],
        workflowId,
        intent: 'meeting',
      });
    }
  }

  // =========================================================================
  // 2. Standard Autonomous Agent Turn (Gemini Tool Loop)
  // =========================================================================
  const context = await buildAgentContext({ user, workflowId, extraContext });
  const systemInstruction = getNexusAgentSystemPrompt(context);

  const contents = [
    {
      role: 'user',
      parts: [{ text: cleanMessage }],
    },
  ];

  const executedActions = [];
  let finalMessage = '';
  let iterations = 0;
  let activePendingProposal = null;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    // Call Gemini with tools enabled
    const response = await geminiService.generateAgentTurn({
      contents,
      systemInstruction,
      enableTools: true,
    });

    const candidate = response.candidates?.[0];
    const functionCalls = response.functionCalls || [];

    if (!functionCalls || functionCalls.length === 0) {
      finalMessage = response.text?.trim() || 'Request processed successfully.';
      break;
    }

    if (candidate?.content) {
      contents.push(candidate.content);
    }

    // Execute each requested function call sequentially
    for (const call of functionCalls) {
      const toolName = call.name;
      const toolArgs = call.args || {};

      console.log(`[AI Agent] Executing tool "${toolName}" with args:`, JSON.stringify(toolArgs));

      const toolResult = await executeToolCall(toolName, toolArgs, user, { currentRequest: cleanMessage });

      // Check if this tool produced a pending proposal (e.g. find_calendar_availability)
      if (toolResult.pendingProposal) {
        activePendingProposal = toolResult.pendingProposal;
      }

      executedActions.push({
        tool: toolName,
        args: toolArgs,
        result: toolResult,
        status: toolResult.success !== false ? 'success' : 'failed',
        summary: toolResult.summary || (toolResult.success !== false ? 'Executed successfully' : toolResult.error),
      });

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: toolName,
              response: toolResult,
              id: call.id || undefined,
            },
          },
        ],
      });
    }
  }

  if (iterations >= MAX_TOOL_ITERATIONS && !finalMessage) {
    finalMessage = 'Maximum operational steps reached while processing your request. Please review current status.';
  }

  // Check if any executed action created a pending proposal requiring confirmation
  if (!activePendingProposal) {
    for (const act of executedActions) {
      if (act.result?.pendingProposal) {
        activePendingProposal = act.result.pendingProposal;
        break;
      }
    }
  }

  // Format response with confirmation fields if a proposal was prepared
  return formatAgentResponse({
    message: finalMessage,
    executedActions,
    workflowId,
    requiresConfirmation: Boolean(activePendingProposal),
    pendingActionId: activePendingProposal ? activePendingProposal.pendingActionId : null,
    proposal: activePendingProposal ? activePendingProposal.proposal : null,
  });
}
