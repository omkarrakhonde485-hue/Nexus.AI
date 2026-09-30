-- 009_fix_it_support_role.sql
-- Standardizes IT role to it_support across profiles and updates check constraint

-- 1. Drop old constraint first
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Update existing rows with 'it' to 'it_support' BEFORE adding new constraint
UPDATE public.profiles SET role = 'it_support' WHERE role = 'it';

-- 3. Add new constraint with it_support
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'admin',
  'manager',
  'employee',
  'finance',
  'hr',
  'it_support',
  'procurement'
));

NOTIFY pgrst, 'reload schema';
