export function canRestoreServerSession({ usesSupabaseAuth, supabaseSession, persistentSession }) {
  return !usesSupabaseAuth || Boolean(supabaseSession) || Boolean(persistentSession);
}
