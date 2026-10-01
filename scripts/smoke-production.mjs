const base = 'https://aprendizicm.com.br';
for (const [path, expected] of [['/login', 200], ['/api/health', 200], ['/api/auth/me', 401]]) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  if (response.status !== expected) throw new Error(`${path}: esperado ${expected}, recebido ${response.status}`);
  if (path === '/api/health') {
    const data = await response.json();
    if (data.status !== 'ok') throw new Error('API de saúde não confirmou o estado esperado.');
  } else await response.arrayBuffer();
  console.log(`${path}: ${expected}`);
}
const redirect = await fetch('https://www.aprendizicm.com.br/login', { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
if (redirect.status !== 308 || redirect.headers.get('location') !== `${base}/login`) throw new Error('Redirecionamento www inválido.');
console.log('www: 308');
