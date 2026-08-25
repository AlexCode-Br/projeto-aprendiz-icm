import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabasePublishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

export const usesSupabaseAuth = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = usesSupabaseAuth
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: 'projeto-aprendiz-auth',
      },
    })
  : null;

export function friendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (message.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (message.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (message.includes('password should be')) return 'A senha não atende aos requisitos de segurança.';
  return 'Não foi possível concluir a autenticação. Tente novamente.';
}
