-- supabase/migrations/012_ai_pending_actions.sql
-- Server-authoritative storage for pending AI actions requiring user confirmation (Block 8)

CREATE TABLE IF NOT EXISTS public.ai_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookup and filtering
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_user_id ON public.ai_pending_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_status ON public.ai_pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_expires_at ON public.ai_pending_actions(expires_at);

-- Row Level Security
ALTER TABLE public.ai_pending_actions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ai_pending_actions TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_pending_actions TO authenticated;

DROP POLICY IF EXISTS "ai_pending_actions_select_own" ON public.ai_pending_actions;
CREATE POLICY "ai_pending_actions_select_own" ON public.ai_pending_actions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_pending_actions_insert_own" ON public.ai_pending_actions;
CREATE POLICY "ai_pending_actions_insert_own" ON public.ai_pending_actions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_pending_actions_update_own" ON public.ai_pending_actions;
CREATE POLICY "ai_pending_actions_update_own" ON public.ai_pending_actions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
