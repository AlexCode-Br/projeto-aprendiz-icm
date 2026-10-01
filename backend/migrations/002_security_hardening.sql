-- Defense in depth for the private application schema.
-- The web backend connects with the database owner and bypasses RLS; browser
-- roles must never access these tables directly through the Supabase Data API.
REVOKE ALL ON SCHEMA projeto_aprendiz FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA projeto_aprendiz FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA projeto_aprendiz FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA projeto_aprendiz FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA projeto_aprendiz
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA projeto_aprendiz
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA projeto_aprendiz
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

ALTER TABLE projeto_aprendiz.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.dev_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.professor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.professor_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.dropout_events ENABLE ROW LEVEL SECURITY;

-- Keep the legacy public schema intact for recovery, while removing direct
-- browser access that was still exposed through PostgREST/GraphQL.
DO $$
DECLARE legacy_table TEXT;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY['announcement_confirmations','announcements','attendance','courses','enrollments','profiles','students','support_tickets'] LOOP
    IF to_regclass(format('public.%I', legacy_table)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', legacy_table);
    END IF;
  END LOOP;
END $$;

-- SECURITY DEFINER functions are used by a database trigger, not by clients.
-- Revoking client execution does not prevent the trigger from running.
DO $$
BEGIN
  IF to_regprocedure('public.get_user_role(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
