-- 007_indexes.sql
-- Optimizes critical lookup paths for dashboards, status polling, and assignment queries

-- Workflows indexes
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_workflow_type ON public.workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON public.workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_workflows_current_assignee_id ON public.workflows(current_assignee_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON public.workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_workflows_sla_due_at ON public.workflows(sla_due_at);

-- Workflow Steps indexes
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON public.workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_assignee_id ON public.workflow_steps(assignee_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON public.workflow_steps(status);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON public.tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks(due_at);

-- Approvals indexes
CREATE INDEX IF NOT EXISTS idx_approvals_workflow_id ON public.approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver_id ON public.approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals(status);

-- Activity Logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_workflow_id ON public.activity_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_workflow_id ON public.alerts(workflow_id);

-- External Actions indexes
CREATE INDEX IF NOT EXISTS idx_external_actions_workflow_id ON public.external_actions(workflow_id);

-- Google Connections indexes
CREATE INDEX IF NOT EXISTS idx_google_connections_user_id ON public.google_connections(user_id);
