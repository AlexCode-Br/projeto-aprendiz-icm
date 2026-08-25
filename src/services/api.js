import mockApi from './mockApi';

let csrfToken = '';

async function request(method, url, body, options = {}) {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Não foi possível concluir a solicitação.');
    error.response = { status: response.status, data };
    throw error;
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return { data, ...options };
}

const isRealRoute = url => (
  url.startsWith('/api/auth/') ||
  url.startsWith('/api/professores/') ||
  url.startsWith('/api/informativos') ||
  url.startsWith('/api/suporte') ||
  url.startsWith('/api/relatorios') ||
  url.startsWith('/api/account') ||
  url.startsWith('/api/invitations') ||
  url.startsWith('/api/dashboard') ||
  ['/alunos', '/cursos', '/professores', '/frequencia'].some(prefix => url === prefix || url.startsWith(`${prefix}/`))
);

const normalizeBody = body => body instanceof FormData ? Object.fromEntries(body.entries()) : body;
const withQuery = (url, config) => {
  const params = config?.params;
  if (!params) return url;
  const query = new URLSearchParams(Object.entries(params).filter(([,value]) => value !== undefined && value !== null));
  return `${url}?${query}`;
};

const api = {
  defaults: { headers: {} },
  setCsrfToken(value) { csrfToken = value || ''; },
  get(url, config) {
    return isRealRoute(url) ? request('GET', withQuery(url, config)) : mockApi.get(url, config);
  },
  post(url, body, config) {
    return isRealRoute(url) ? request('POST', url, normalizeBody(body), config) : mockApi.post(url, body, config);
  },
  put(url, body, config) { return isRealRoute(url) ? request('PUT', url, normalizeBody(body), config) : mockApi.put(url, body, config); },
  delete(url, config) { return isRealRoute(url) ? request('DELETE', url, undefined, config) : mockApi.delete(url, config); },
};

export default api;
