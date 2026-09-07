import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Only public browser configuration belongs in this file. Service-role keys,
// database passwords and Resend credentials must remain Cloudflare secrets.
const publicConfig = JSON.parse(readFileSync(new URL('./frontend.json', import.meta.url), 'utf8'));
const env = {
  ...process.env,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || publicConfig.supabaseUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || publicConfig.supabasePublishableKey,
};
if (!env.VITE_SUPABASE_URL?.startsWith('https://') || !env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
  throw new Error('Configure a URL HTTPS e a chave publicável do Supabase antes de publicar.');
}
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'build'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), env, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
