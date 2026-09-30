// backend/src/workflows/workflowRules.js
// Business rules and mandatory approval guardrails

import { WORKFLOW_TYPES } from './workflowDefinitions.js';

export const isMoneyOperation = (workflowType, aiData = {}) => {
  const moneyTypes = [
    WORKFLOW_TYPES.EXPENSE,
    WORKFLOW_TYPES.INVOICE,
    WORKFLOW_TYPES.PROCUREMENT,
  ];

  if (moneyTypes.includes(workflowType)) return true;

  if (workflowType === WORKFLOW_TYPES.APPROVAL && aiData.amount && Number(aiData.amount) > 0) {
    return true;
  }

  return false;
};

export const requiresHumanApproval = (workflowType, aiData = {}) => {
  // CRITICAL RULE 10: Money operations REQUIRE human approval.
  // The engine must NEVER auto-approve financial operations based on AI recommendations alone.
  if (isMoneyOperation(workflowType, aiData)) {
    return true;
  }
  return false;
};

export const validateSelfApproval = (requesterId, approverId) => {
  if (!requesterId || !approverId) return true;
  // Requester MUST NOT be the approver
  return requesterId !== approverId;
};
