export function requireLocalTestDatabase(value) {
  const target = new URL(value);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !/test/i.test(target.pathname)) {
    throw new Error('Testes PostgreSQL exigem loopback e um banco cujo nome contenha test. Não use produção.');
  }
  return value;
}
