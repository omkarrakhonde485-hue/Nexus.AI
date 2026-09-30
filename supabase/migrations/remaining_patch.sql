-- remaining_patch.sql
-- Creates trigger function, attachments, company_policies, enables RLS and reloads PostgREST schema cache

-- 1. Ensure function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. ATTACHMENTS
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

-- 3. COMPANY POLICIES
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

-- 4. ENABLE RLS
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_policies ENABLE ROW LEVEL SECURITY;

-- 5. GRANTS & POLICIES
REVOKE ALL ON public.attachments FROM anon;
REVOKE ALL ON public.company_policies FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;

GRANT SELECT ON public.company_policies TO authenticated;
GRANT ALL ON public.company_policies TO service_role;

-- Google connections: backend service_role only
REVOKE ALL ON public.google_connections FROM anon, authenticated;
GRANT ALL ON public.google_connections TO service_role;

-- Attachments policy
DROP POLICY IF EXISTS "attachments_select_scoped" ON public.attachments;
CREATE POLICY "attachments_select_scoped" ON public.attachments FOR SELECT TO authenticated USING (
  uploaded_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.id = attachments.workflow_id AND w.created_by = auth.uid()
  )
);

-- Company policies policy
DROP POLICY IF EXISTS "company_policies_select_active" ON public.company_policies;
CREATE POLICY "company_policies_select_active" ON public.company_policies FOR SELECT TO authenticated USING (is_active = TRUE);

-- 6. Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';
