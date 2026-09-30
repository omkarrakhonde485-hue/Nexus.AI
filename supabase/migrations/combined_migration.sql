-- ==============================================================================
-- NEXUS AI — COMPLETE COMBINED DATABASE MIGRATION (BLOCK 2)
-- Generates all 12 tables, triggers, constraints, indexes, and RLS policies
-- ==============================================================================

-- 1. EXTENSIONS & HELPERS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'admin',
    'manager',
    'employee',
    'finance',
    'hr',
    'it_support',
    'procurement'
  )),
  department TEXT,
  manager_id UUID REFERENCES public.profiles(id),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_not_self_managed CHECK (manager_id <> id)
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. WORKFLOWS (GENERIC MODEL FOR ALL 7 OPERATIONS FLOWS)
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  workflow_type TEXT NOT NULL CHECK (workflow_type IN (
    'approval',
    'invoice',
    'expense',
    'procurement',
    'onboarding',
    'helpdesk',
    'meeting'
  )),
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'submitted',
    'ai_analyzing',
    'needs_information',
    'awaiting_approval',
    'approved',
    'processing',
    'blocked',
    'escalated',
    'completed',
    'rejected',
    'failed',
    'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'low',
    'normal',
    'high',
    'critical'
  )),
  department TEXT,
  current_assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ai_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
  sla_due_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_workflows_updated_at ON public.workflows;
CREATE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. WORKFLOW STEPS
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  step_type TEXT NOT NULL CHECK (step_type IN (
    'ai_analysis',
    'task',
    'approval',
    'notification',
    'external_action',
    'processing'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'blocked',
    'skipped',
    'failed'
  )),
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_role TEXT,
  due_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS trg_workflow_steps_updated_at ON public.workflow_steps;
CREATE TRIGGER trg_workflow_steps_updated_at
  BEFORE UPDATE ON public.workflow_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_role TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'blocked',
    'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'low',
    'normal',
    'high',
    'critical'
  )),
  due_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. APPROVALS
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  workflow_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  approver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'rejected',
    'cancelled'
  )),
  comments TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_approvals_updated_at ON public.approvals;
CREATE TRIGGER trg_approvals_updated_at
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. ACTIVITY LOGS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'ai', 'system', 'google')),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ALERTS (MONITORING)
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  assigned_role TEXT,
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 9. GOOGLE CONNECTIONS
CREATE TABLE IF NOT EXISTS public.google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN (
    'connected',
    'reauthorization_required',
    'disconnected',
    'error'
  )),
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_google_connections_updated_at ON public.google_connections;
CREATE TRIGGER trg_google_connections_updated_at
  BEFORE UPDATE ON public.google_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 10. OAUTH STATES
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
  state_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. EXTERNAL ACTIONS (IDEMPOTENCY & AUDIT)
CREATE TABLE IF NOT EXISTS public.external_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  action_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_external_actions_updated_at ON public.external_actions;
CREATE TRIGGER trg_external_actions_updated_at
  BEFORE UPDATE ON public.external_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 12. ATTACHMENTS
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'google_drive',
  external_file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. COMPANY POLICIES
CREATE TABLE IF NOT EXISTS public.company_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  policy_name TEXT NOT NULL,
  policy_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_company_policies_updated_at ON public.company_policies;
CREATE TRIGGER trg_company_policies_updated_at
  BEFORE UPDATE ON public.company_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial policy
INSERT INTO public.company_policies (policy_key, policy_name, policy_type, config, is_active)
VALUES (
  'expense.default',
  'Standard Expense Approval Policy',
  'expense',
  '{"receipt_required_above": 500, "manager_approval_above": 1000, "finance_review_above": 10000}'::jsonb,
  TRUE
) ON CONFLICT (policy_key) DO NOTHING;

-- 14. INDEXES
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_workflow_type ON public.workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON public.workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_workflows_current_assignee_id ON public.workflows(current_assignee_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON public.workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_workflows_sla_due_at ON public.workflows(sla_due_at);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON public.workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_assignee_id ON public.workflow_steps(assignee_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON public.workflow_steps(status);

CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON public.tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks(due_at);

CREATE INDEX IF NOT EXISTS idx_approvals_workflow_id ON public.approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver_id ON public.approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals(status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_workflow_id ON public.activity_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_workflow_id ON public.alerts(workflow_id);

CREATE INDEX IF NOT EXISTS idx_external_actions_workflow_id ON public.external_actions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_google_connections_user_id ON public.google_connections(user_id);

-- 15. ROW LEVEL SECURITY (RLS) & PRIVILEGES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_policies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

REVOKE SELECT (refresh_token_encrypted) ON public.google_connections FROM anon, authenticated;

-- RLS Policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "workflows_select_scoped" ON public.workflows;
CREATE POLICY "workflows_select_scoped" ON public.workflows FOR SELECT TO authenticated USING (created_by = auth.uid() OR current_assignee_id = auth.uid());

DROP POLICY IF EXISTS "workflows_insert_own" ON public.workflows;
CREATE POLICY "workflows_insert_own" ON public.workflows FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "workflows_update_own_draft" ON public.workflows;
CREATE POLICY "workflows_update_own_draft" ON public.workflows FOR UPDATE TO authenticated USING (created_by = auth.uid() AND status IN ('draft', 'submitted')) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "workflow_steps_select_scoped" ON public.workflow_steps;
CREATE POLICY "workflow_steps_select_scoped" ON public.workflow_steps FOR SELECT TO authenticated USING (
  assignee_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.id = workflow_steps.workflow_id
      AND (w.created_by = auth.uid() OR w.current_assignee_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "tasks_select_scoped" ON public.tasks;
CREATE POLICY "tasks_select_scoped" ON public.tasks FOR SELECT TO authenticated USING (
  assignee_id = auth.uid() OR
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.id = tasks.workflow_id AND w.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "tasks_update_assigned" ON public.tasks;
CREATE POLICY "tasks_update_assigned" ON public.tasks FOR UPDATE TO authenticated USING (assignee_id = auth.uid()) WITH CHECK (assignee_id = auth.uid());

DROP POLICY IF EXISTS "approvals_select_scoped" ON public.approvals;
CREATE POLICY "approvals_select_scoped" ON public.approvals FOR SELECT TO authenticated USING (
  approver_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.id = approvals.workflow_id AND w.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "activity_logs_select_scoped" ON public.activity_logs;
CREATE POLICY "activity_logs_select_scoped" ON public.activity_logs FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.id = activity_logs.workflow_id
      AND (w.created_by = auth.uid() OR w.current_assignee_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "alerts_select_scoped" ON public.alerts;
CREATE POLICY "alerts_select_scoped" ON public.alerts FOR SELECT TO authenticated USING (assigned_user_id = auth.uid());

DROP POLICY IF EXISTS "google_connections_select_own" ON public.google_connections;
CREATE POLICY "google_connections_select_own" ON public.google_connections FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "external_actions_select_scoped" ON public.external_actions;
CREATE POLICY "external_actions_select_scoped" ON public.external_actions FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.id = external_actions.workflow_id AND w.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "attachments_select_scoped" ON public.attachments;
CREATE POLICY "attachments_select_scoped" ON public.attachments FOR SELECT TO authenticated USING (
  uploaded_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.id = attachments.workflow_id AND w.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "company_policies_select_active" ON public.company_policies;
CREATE POLICY "company_policies_select_active" ON public.company_policies FOR SELECT TO authenticated USING (is_active = TRUE);
