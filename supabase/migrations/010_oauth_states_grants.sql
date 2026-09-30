-- 010_oauth_states_grants.sql
-- Ensure complete table and schema privileges for all operational tables

GRANT ALL ON public.oauth_states TO postgres, service_role, authenticated, anon;
GRANT ALL ON public.google_connections TO postgres, service_role, authenticated, anon;
GRANT ALL ON public.activity_logs TO postgres, service_role, authenticated, anon;
GRANT ALL ON public.alerts TO postgres, service_role, authenticated, anon;

-- Backend permissive policies for background service operations
DROP POLICY IF EXISTS "oauth_states_all_access" ON public.oauth_states;
CREATE POLICY "oauth_states_all_access" ON public.oauth_states FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "google_connections_all_access" ON public.google_connections;
CREATE POLICY "google_connections_all_access" ON public.google_connections FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "activity_logs_service_role" ON public.activity_logs;
CREATE POLICY "activity_logs_service_role" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
