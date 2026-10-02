import assert from 'node:assert/strict';
import test from 'node:test';
import { managerDeviceEmail } from './manager-login-email.mjs';
import { createEmailService } from './email.mjs';
import { invokeApi } from '../cloudflare/http-bridge.mjs';

const connectedAt = new Date('2026-10-02T15:04:05Z');
const browser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';

test('alerta compacto usa localização da borda, identifica navegador e preserva texto/HTML seguro', async () => {
  const edgeRequest = new Request('https://example.com/api/auth/login', {
    method: 'POST', headers: {
      'cf-connecting-ip': '2001:db8::1', 'x-forwarded-for': '192.0.2.99',
      'user-agent': browser, 'cf-ipcity': 'Cidade forjada', 'x-client-location': 'Local forjado',
    },
  });
  Object.defineProperty(edgeRequest, 'cf', { value: {
    city: 'Salvador', region: 'Bahia', country: 'BR', asOrganization: 'Rede <teste>',
    latitude: '-12.9', longitude: '-38.5',
  } });
  let payload;
  const { sendEmail } = createEmailService({
    db: {}, isProduction: true, env: { RESEND_API_KEY: 're_test' },
    fetchImpl: async (_url, options) => {
      payload = JSON.parse(options.body);
      return { ok: true, json: async () => ({ id: 'test-email' }) };
    },
  });
  await invokeApi(edgeRequest, async (request, response) => {
    assert.equal(request.clientLocation.latitude, undefined);
    const body = managerDeviceEmail({
      name: 'Gestor <teste>', connectedAt,
      ip: request.socket.remoteAddress, request, securityUrl: 'https://example.com/configuracoes',
    });
    await sendEmail('gestor@example.com', 'Novo dispositivo conectado — Projeto Aprendiz', body);
    response.writeHead(202);
    response.end('{}');
  });
  assert.match(payload.text, /Identificamos um novo acesso/);
  assert.doesNotMatch(payload.text, /código de verificação é|012345/);
  assert.match(payload.html, /Não fui eu/);
  assert.match(payload.html, /href="https:\/\/example.com\/configuracoes"/);
  assert.equal((payload.html.match(/href="https:\/\/example.com\/configuracoes"/g) || []).length, 1);
  assert.doesNotMatch(payload.html, /ignore este e-mail/);
  assert.match(payload.text, /2 de outubro de 2026.*12:04/);
  assert.match(payload.text, /Data e hora \(Brasília\):/);
  assert.match(payload.text, /Salvador, Bahia, Brasil/);
  assert.match(payload.text, /Sistema e navegador: Windows, Edge/);
  assert.match(payload.text, /Revise suas sessões e altere sua senha/);
  assert.doesNotMatch(payload.text, /Endereço IP|Rede:|Tipo de dispositivo|VPNs|cookies|2001:db8::1/);
  assert.doesNotMatch(payload.text, /forjad|192\.0\.2\.99|-12\.9|-38\.5/);
  assert.match(payload.html, /Gestor &lt;teste&gt;/);
  assert.match(payload.html, /Localização aproximada/);
  assert.doesNotMatch(payload.html, /<teste>/);
});

test('dados ausentes ou inválidos não inventam localização, IP ou dispositivo', () => {
  const body = managerDeviceEmail({
    name: 'Gestor', connectedAt, ip: 'unknown', securityUrl: 'https://example.com/configuracoes',
    request: { headers: { 'cf-ipcountry': 'BR', 'cf-ipcity': 'Cidade forjada' } },
  });
  assert.match(body, /Localização aproximada: Não disponível/);
  assert.match(body, /Sistema e navegador: Não identificado, Não identificado/);
  assert.doesNotMatch(body, /Cidade forjada|Brasil/);
  const mobile = managerDeviceEmail({
    name: 'Gestor', connectedAt, ip: '192.0.2.1', securityUrl: 'https://example.com/configuracoes',
    request: {
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1' },
      clientLocation: { city: 'Cidade\nforjada', country: '12', network: 'Rede\r\nNavegador: Falso' },
    },
  });
  assert.match(mobile, /Sistema e navegador: iOS, Safari/);
  assert.match(mobile, /Localização aproximada: Cidade forjada\n/);
  assert.doesNotMatch(mobile, /Rede Navegador: Falso|192\.0\.2\.1/);
});
