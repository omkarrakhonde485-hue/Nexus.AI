# Workflow Contract

## Workflow Types

- `approval`
- `invoice`
- `expense`
- `procurement`
- `onboarding`
- `helpdesk`
- `meeting`

## Workflow States

- `draft`
- `submitted`
- `ai_analyzing`
- `needs_information`
- `awaiting_approval`
- `approved`
- `processing`
- `blocked`
- `escalated`
- `completed`
- `rejected`
- `failed`
- `cancelled`

## Generic Workflow Structure & State Transition Principles

- Every workflow begins in a `draft` or `submitted` state.
- Transitions must be explicitly requested and authorized by the backend.
- Actions requiring human review transition to `awaiting_approval`.
- All transitions generate an audit log.
