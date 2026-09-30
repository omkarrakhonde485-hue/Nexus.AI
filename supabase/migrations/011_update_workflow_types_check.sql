-- 011_update_workflow_types_check.sql
-- Updates workflows_workflow_type_check constraint to include all 7 supported workflow types:
-- approval, invoice, expense, procurement, onboarding, helpdesk, meeting

ALTER TABLE public.workflows DROP CONSTRAINT IF EXISTS workflows_workflow_type_check;

ALTER TABLE public.workflows ADD CONSTRAINT workflows_workflow_type_check CHECK (workflow_type IN (
  'approval',
  'invoice',
  'expense',
  'procurement',
  'onboarding',
  'helpdesk',
  'meeting'
));

NOTIFY pgrst, 'reload schema';
