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

const normalizeBody = body => body instanceof FormData ? Object.fromEntries(body.entries()) : body;
const withQuery = (url, config) => {
  const params = config?.params;
  if (!params) return url;
  const query = new URLSearchParams(Object.entries(params).filter(([,value]) => value !== undefined && value !== null));
  return `${url}?${query}`;
};

const api = {
  setCsrfToken(value) { csrfToken = value || ''; },
  get(url, config) { return request('GET', withQuery(url, config)); },
  post(url, body, config) { return request('POST', url, normalizeBody(body), config); },
  put(url, body, config) { return request('PUT', url, normalizeBody(body), config); },
  delete(url, config) { return request('DELETE', url, undefined, config); },
};

export default api;
