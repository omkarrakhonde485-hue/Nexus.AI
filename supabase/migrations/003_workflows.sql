-- 003_workflows.sql
-- Establishes the generic workflow model capable of handling all 7 operations flows

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

-- Trigger for workflows updated_at
DROP TRIGGER IF EXISTS trg_workflows_updated_at ON public.workflows;
CREATE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
