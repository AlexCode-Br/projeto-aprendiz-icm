// Links are stored and opened by the browser; the server never follows redirects.
export function googleMapsLink(value) {
  if (typeof value !== 'string' || value.length > 2000) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
    const host = url.hostname.toLowerCase();
    const allowed = (host === 'maps.app.goo.gl' && url.pathname.length > 1)
      || (host === 'goo.gl' && url.pathname.startsWith('/maps/'))
      || (['google.com', 'www.google.com', 'google.com.br', 'www.google.com.br'].includes(host) && /^\/maps(?:\/|$)/.test(url.pathname))
      || ['maps.google.com', 'maps.google.com.br'].includes(host);
    return allowed ? url.href : '';
  } catch { return ''; }
}
