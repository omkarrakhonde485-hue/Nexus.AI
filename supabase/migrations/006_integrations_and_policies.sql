-- 006_integrations_and_policies.sql
-- Creates google_connections, oauth_states, external_actions, attachments, and company_policies

-- 1. Google Connections
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

-- 2. OAuth States (Hashed temporary CSRF tokens)
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
  state_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. External Actions (Idempotency and side-effect auditing)
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

-- 4. Attachments (File metadata)
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

-- 5. Company Policies (Deterministic business rules for AI & workflow execution)
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

-- Seed initial default expense policy
INSERT INTO public.company_policies (policy_key, policy_name, policy_type, config, is_active)
VALUES (
  'expense.default',
  'Standard Expense Approval Policy',
  'expense',
  '{"receipt_required_above": 500, "manager_approval_above": 1000, "finance_review_above": 10000}'::jsonb,
  TRUE
) ON CONFLICT (policy_key) DO NOTHING;
