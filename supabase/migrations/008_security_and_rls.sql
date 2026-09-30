-- 008_security_and_rls.sql
-- Adds missing columns, enables Row Level Security (RLS) across all 12 tables and revokes anon access

-- 1. Ensure all table columns match specification
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Enable RLS on all 12 tables
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

-- 3. Revoke anonymous access from all tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- 4. Authenticated & Service Role privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO authenticated;
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT SELECT ON public.alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT SELECT ON public.company_policies TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Google connections & oauth states are strictly backend only
REVOKE ALL ON public.google_connections FROM anon, authenticated;
REVOKE ALL ON public.oauth_states FROM anon, authenticated;

-- 5. RLS POLICIES FOR AUTHENTICATED USERS
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

NOTIFY pgrst, 'reload schema';
