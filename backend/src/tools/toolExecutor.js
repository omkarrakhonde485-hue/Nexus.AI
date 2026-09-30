// backend/src/tools/toolExecutor.js
// Validates arguments, verifies RBAC permissions, executes tools with timeout, and logs audit events

import { toolRegistry } from './toolRegistry.js';
import { hasPermission } from '../services/permissionService.js';
import { aiAuditService } from '../services/aiAuditService.js';

const TOOL_TIMEOUT_MS = 8000;

export async function executeToolCall(toolName, args, userContext) {
  const startTime = Date.now();
  const tool = toolRegistry[toolName];

  // 1. Tool Existence Check
  if (!tool) {
    const errorMsg = `Tool "${toolName}" is not registered in NEXUS tool registry.`;
    await aiAuditService.logToolExecution({
      actorId: userContext.id,
      toolName,
      status: 'not_found',
      summary: errorMsg,
      metadata: { args },
    });
    return { success: false, error: errorMsg };
  }

  // 2. Permission Check
  if (tool.requiredPermission && !hasPermission(userContext.role, tool.requiredPermission)) {
    const errorMsg = `Permission Denied: Role "${userContext.role}" cannot execute tool "${toolName}".`;
    await aiAuditService.logToolExecution({
      actorId: userContext.id,
      toolName,
      status: 'forbidden',
      summary: errorMsg,
      metadata: { role: userContext.role, requiredPermission: tool.requiredPermission },
    });
    return { success: false, error: errorMsg, code: 'FORBIDDEN' };
  }

  // 3. Zod Argument Schema Validation
  if (tool.schema) {
    const validationResult = tool.schema.safeParse(args);
    if (!validationResult.success) {
      const issues = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      const errorMsg = `Tool Argument Validation Failed: ${issues}`;
      await aiAuditService.logToolExecution({
        actorId: userContext.id,
        toolName,
        status: 'validation_error',
        summary: errorMsg,
        metadata: { validationErrors: validationResult.error.errors, args },
      });
      return { success: false, error: errorMsg, code: 'VALIDATION_FAILED' };
    }
    // Use cleaned/parsed arguments
    args = validationResult.data;
  }

  // 4. Execution with Timeout
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tool execution timed out after ${TOOL_TIMEOUT_MS}ms`)), TOOL_TIMEOUT_MS)
    );

    const executionPromise = tool.execute(args, { user: userContext });
    const result = await Promise.race([executionPromise, timeoutPromise]);
    const executionTimeMs = Date.now() - startTime;

    // 5. Audit Log Success
    const workflowId = result.workflow?.id || result.workflowId || args.workflowId || null;
    await aiAuditService.logToolExecution({
      workflowId,
      actorId: userContext.id,
      toolName,
      status: result.success !== false ? 'success' : 'failed',
      summary: result.summary || (result.success !== false ? 'Executed successfully' : result.error),
      metadata: { executionTimeMs, args },
    });

    return result;
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    const errorMsg = `Tool Execution Error: ${err.message}`;
    console.error(`[Tool Executor Error] ${toolName}:`, err);

    await aiAuditService.logToolExecution({
      workflowId: args.workflowId || null,
      actorId: userContext.id,
      toolName,
      status: 'error',
      summary: errorMsg,
      metadata: { executionTimeMs, error: err.message, args },
    });

    return { success: false, error: errorMsg };
  }
}
