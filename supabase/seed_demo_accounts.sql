-- seed_demo_accounts.sql
-- Template for linking Supabase Auth users to Nexus AI Profile records.
-- Executed during Block 3 (Auth/RBAC) once Auth accounts are registered.

/*
DEMO IDENTITIES ROSTER:
1. Aarav Sharma   | aarav@nexusai.internal   | admin       | Administration
2. Priya Patel    | priya@nexusai.internal   | manager     | Engineering
3. Neha Gupta     | neha@nexusai.internal    | finance     | Finance
4. Ananya Desai   | ananya@nexusai.internal  | hr          | Human Resources
5. Vikram Singh   | vikram@nexusai.internal  | it_support   | IT
6. Rohan Verma    | rohan@nexusai.internal   | procurement | Procurement
7. Omkar Dev      | omkar@nexusai.internal   | employee    | Engineering
8. Rahul Rao      | rahul@nexusai.internal   | employee    | Engineering

SAMPLE MAPPING LOGIC (FOR BLOCK 3):
INSERT INTO public.profiles (id, full_name, email, role, department, is_active)
VALUES
  ('<AUTH_USER_ID_AARAV>', 'Aarav Sharma', 'aarav@nexusai.internal', 'admin', 'Administration', TRUE),
  ('<AUTH_USER_ID_PRIYA>', 'Priya Patel', 'priya@nexusai.internal', 'manager', 'Engineering', TRUE),
  ('<AUTH_USER_ID_NEHA>', 'Neha Gupta', 'neha@nexusai.internal', 'finance', 'Finance', TRUE),
  ('<AUTH_USER_ID_ANANYA>', 'Ananya Desai', 'ananya@nexusai.internal', 'hr', 'Human Resources', TRUE),
  ('<AUTH_USER_ID_VIKRAM>', 'Vikram Singh', 'vikram@nexusai.internal', 'it_support', 'IT', TRUE),
  ('<AUTH_USER_ID_ROHAN>', 'Rohan Verma', 'rohan@nexusai.internal', 'procurement', 'Procurement', TRUE),
  ('<AUTH_USER_ID_OMKAR>', 'Omkar Dev', 'omkar@nexusai.internal', 'employee', 'Engineering', TRUE),
  ('<AUTH_USER_ID_RAHUL>', 'Rahul Rao', 'rahul@nexusai.internal', 'employee', 'Engineering', TRUE)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;
*/
