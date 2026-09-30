// backend/src/agents/nexusAgent.js
// Central NEXUS AI Agent: Autonomous tool execution loop and operations orchestration

import { buildAgentContext } from './contextBuilder.js';
import { getNexusAgentSystemPrompt } from './agentPrompt.js';
import { formatAgentResponse } from './responseFormatter.js';
import { geminiService } from '../services/geminiService.js';
import { executeToolCall } from '../tools/toolExecutor.js';

const MAX_TOOL_ITERATIONS = 5;

export async function processAgentRequest({ user, message, workflowId = null, extraContext = {} }) {
  if (!message || message.trim() === '') {
    const err = new Error('Message is required for AI agent.');
    err.status = 400;
    throw err;
  }

  // 1. Build minimal required context
  const context = await buildAgentContext({ user, workflowId, extraContext });
  const systemInstruction = getNexusAgentSystemPrompt(context);

  // 2. Initialize conversation contents
  const contents = [
    {
      role: 'user',
      parts: [{ text: message.trim() }],
    },
  ];

  const executedActions = [];
  let finalMessage = '';
  let iterations = 0;

  // 3. Autonomous Tool-Call Loop (Max 5 iterations)
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

    // If no function calls, capture final text and terminate loop
    if (!functionCalls || functionCalls.length === 0) {
      finalMessage = response.text?.trim() || 'Request processed successfully.';
      break;
    }

    // Append model's response turn to conversation history
    if (candidate?.content) {
      contents.push(candidate.content);
    }

    // Execute each requested function call sequentially
    for (const call of functionCalls) {
      const toolName = call.name;
      const toolArgs = call.args || {};

      console.log(`[AI Agent] Executing tool "${toolName}" with args:`, JSON.stringify(toolArgs));

      const toolResult = await executeToolCall(toolName, toolArgs, user);

      executedActions.push({
        tool: toolName,
        args: toolArgs,
        result: toolResult,
        status: toolResult.success !== false ? 'success' : 'failed',
        summary: toolResult.summary || (toolResult.success !== false ? 'Executed successfully' : toolResult.error),
      });

      // Append function response turn to conversation history for Gemini
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

  // 4. Format standardized response
  return formatAgentResponse({
    message: finalMessage,
    executedActions,
    workflowId,
  });
}
