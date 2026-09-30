-- 010_add_workflow_steps_description.sql
-- Adds description column to workflow_steps if not present and reloads schema cache

ALTER TABLE public.workflow_steps 
ADD COLUMN IF NOT EXISTS description TEXT;

NOTIFY pgrst, 'reload schema';
