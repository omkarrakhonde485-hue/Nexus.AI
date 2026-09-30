# Central Gemini AI Agent & Tool Calling Architecture

## Overview
Block 5 integrates Google Gemini (via `@google/genai`) into the NEXUS AI Operations Control Center. Rather than a standalone chat interface, Gemini acts as an autonomous operations agent that invokes registered backend tools with strict argument validation, role-based authorization (RBAC), and deterministic execution through the Block 4 Workflow Engine.

---

## Core Architecture

```
                    USER
                      │
                      ↓
             POST /api/ai/agent
                      │
                      ↓
              AI Agent Controller
                      │
                      ↓
               Context Builder
                      │
                      ↓
                  Gemini
                      │
               Function Call
                      │
                      ↓
                Tool Registry
                      │
                      ↓
               Tool Executor
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
 Authorization     Validation      Policy
       │              │              │
       └──────────────┼──────────────┘
                      ↓
               Internal Tool
                      │
                      ↓
              Workflow Engine
                      │
                      ↓
                  Supabase
                      │
                      ↓
                 Tool Result
                      │
                      ↓
                  Gemini
                      │
                      ↓
             Final AI Response
```

---

## Tool Categories & Risk Levels

| Tool Name | Risk Level | Required Permission | Description |
|-----------|------------|---------------------|-------------|
| `get_user_profile` | `read_only` | None (Auth) | Fetch user/colleague profile and manager info |
| `get_team_members` | `read_only` | None (Auth) | Fetch department or direct report list |
| `get_workflow` | `read_only` | `workflow.read` | Inspect existing workflow state, SLA, and active steps |
| `search_workflows` | `read_only` | `workflow.read` | Scoped workflow search with filters |
| `get_tasks` | `read_only` | `task.read` | Fetch assigned open tasks for current user |
| `get_company_policy` | `read_only` | None (Auth) | Query official company policies from `company_policies` |
| `get_dashboard_metrics`| `read_only` | None (Auth) | Operations center active workflow & alert metrics |
| `create_workflow` | `internal_write` | `workflow.create` | Instantiate one of 7 workflow types in engine |
| `create_task` | `internal_write` | `task.create` | Create an action item linked to a workflow |
| `update_task` | `internal_write` | `task.update` | Update status of an authorized task |
| `create_approval` | `internal_write` | `workflow.create` | Add human approval checkpoint to a workflow |

---

## Financial Safety & Approval Rules

- **Zero Autonomous Financial Approval**: Gemini is strictly prohibited from approving money operations (`expense`, `invoice`, `procurement`, financial `approval`).
- **Human In The Loop**: Financial requests are created in state `awaiting_approval` and must be approved by designated human managers through `POST /api/approvals/:id/approve`.
- **Self-Approval Prevention**: The backend verifies `requester.id !== approver.id`.

---

## Tool Execution & Validation Pipeline

1. **Tool Registry Lookup**: Confirms tool exists and is registered.
2. **Permission Check**: Verifies authenticated user's role has `requiredPermission` via `permissionService`.
3. **Zod Validation**: Validates all arguments against strict Zod schemas (`toolSchemas.js`).
4. **Execution Timeout**: Protected by 8000ms timeout race.
5. **Deterministic Engine Invocation**: Internal tools execute via `workflowEngine`, `taskService`, `approvalService`, and Supabase.
6. **AI Audit Logging**: Writes an event to `activity_logs` with `actor_type = 'ai'` and `action = 'ai_called_tool'`.
7. **Loop Control**: Maximum 5 sequential tool iterations per request.

---

## API Endpoints

- `POST /api/ai/agent`: Protected agent turn endpoint taking `{ message, workflowId?, context? }`.
- `GET /api/ai/history`: Fetches recent AI tool audit history for current user.
- `GET /api/health/ai`: Reports AI provider configuration status, model, and tool-calling capability.
