# API Contract

## Namespaces

- `/api/auth`
- `/api/profile`
- `/api/ai`
- `/api/workflows`
- `/api/tasks`
- `/api/approvals`
- `/api/dashboard`
- `/api/monitor`
- `/api/reports`
- `/api/integrations`

## Primary Routes

### `POST /api/ai/agent`

Primary endpoint for AI interactions. Takes user context and messages and returns the final response after performing the necessary backend-validated tool calls.
