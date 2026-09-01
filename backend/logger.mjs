const REDACTED_KEY = /(authorization|cookie|password|secret|token|credential|data_url)/i;

function safeMetadata(value, depth = 0) {
  if (depth > 3) return '[limite de profundidade]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 20).map(item => safeMetadata(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [
      key,
      REDACTED_KEY.test(key) ? '[redigido]' : safeMetadata(item, depth + 1),
    ]));
  }
  return String(value).slice(0, 500);
}

export function structuredError(event, error, metadata = {}, { clock = () => new Date(), includeStack = process.env.NODE_ENV !== 'production' } = {}) {
  const source = error instanceof Error ? error : new Error(String(error || 'Erro desconhecido'));
  const payload = {
    timestamp: clock().toISOString(),
    level: 'error',
    event: String(event || 'backend_error').trim().replace(/\s+/g, '_').toLowerCase().slice(0, 100),
    message: String(source.message || 'Erro desconhecido').slice(0, 1000),
    ...safeMetadata(metadata),
  };
  if (source.code) payload.code = String(source.code).slice(0, 100);
  if (includeStack && source.stack) payload.stack = String(source.stack).slice(0, 8000);
  return payload;
}

export function createStructuredLogger({ write = line => process.stderr.write(`${line}\n`), clock, includeStack } = {}) {
  return {
    error(event, error, metadata = {}) {
      const payload = structuredError(event, error, metadata, { clock, includeStack });
      write(JSON.stringify(payload));
      return payload;
    },
  };
}
