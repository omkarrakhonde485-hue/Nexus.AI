# Roles and Permissions

## Roles

- `admin`
- `manager`
- `employee`
- `finance`
- `hr`
- `it_support`
- `procurement`

## Permissions

### `admin`
- **Read**: All resources
- **Write**: All resources
- **Approve**: All approvals
- **Invoke Tools**: All tools

### `manager`
- **Read**: Department resources, direct reports' data
- **Write**: Department-specific workflows
- **Approve**: Approvals up to a designated threshold
- **Invoke Tools**: Department-specific and general tools

### `employee`
- **Read**: Own profile, own workflows, public docs
- **Write**: Submit personal workflows (expenses, leaves)
- **Approve**: None
- **Invoke Tools**: Basic read-only or low-risk personal tools

### `finance`
- **Read**: All financial workflows and invoices
- **Write**: Update invoice states, financial records
- **Approve**: Financial approvals, invoices, expenses
- **Invoke Tools**: Financial read/write tools

### `hr`
- **Read**: Employee profiles, onboarding workflows
- **Write**: Update employee records, manage onboarding
- **Approve**: HR-related requests (leaves, onboarding)
- **Invoke Tools**: HR-related tools

### `it_support`
- **Read**: Helpdesk tickets, system statuses
- **Write**: Update tickets
- **Approve**: Equipment procurement requests (within limits)
- **Invoke Tools**: IT support tools

### `procurement`
- **Read**: Procurement requests
- **Write**: Update procurement workflows
- **Approve**: Procurement requests
- **Invoke Tools**: Procurement and inventory tools
