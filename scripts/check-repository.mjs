import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
const problems = [];
const forbidden = /(^|\/)(?:node_modules|dist|build|\.wrangler|tmp|output|coverage|test-results|playwright-report|\.migration-worker|\.tmp-[^/]*|\.qa-[^/]*)\/|(?:^|\/)\.env(?:\.|$)|(?:^|\/)\.dev\.vars(?:\.|$)|\.(?:db(?:-wal|-shm)?|sqlite3?|pem|key|dump|sql\.gz)$/i;
const secrets = /\bsb_secret_[a-zA-Z0-9_-]{20,}|\bgh[pousr]_[a-zA-Z0-9]{30,}|\bsk-[a-zA-Z0-9_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;

for (const file of files) {
  if (file !== '.env.example' && forbidden.test(file)) problems.push(`${file}: arquivo local ou gerado não deve ser versionado`);
  if (!/\.(?:[cm]?js|jsx|jsonc?|ya?ml|md|sql|html|css|txt)$/.test(file) && file !== '.env.example') continue;
  let source;
  try { source = await readFile(resolve(root, file), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  source.split('\n').forEach((line, index) => {
    if (secrets.test(line)) problems.push(`${file}:${index + 1}: possível segredo; conteúdo omitido`);
  });
  if (file.endsWith('.md') && !file.startsWith('docs/releases/')) {
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1].replace(/^<|>$/g, '').split('#')[0];
      if (!link || /^(?:[a-z]+:|\/\/|\/)/i.test(link)) continue;
      try { await readFile(resolve(root, dirname(file), decodeURIComponent(link))); }
      catch (error) { if (error.code !== 'EISDIR') problems.push(`${file}: link local inexistente: ${link}`); }
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log(`Repositório verificado: ${files.length} arquivos; nenhum artefato proibido, segredo reconhecido ou link local inválido.`);
