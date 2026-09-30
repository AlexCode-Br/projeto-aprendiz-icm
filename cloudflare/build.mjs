import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'build'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), env: process.env, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
