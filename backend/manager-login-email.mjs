import { describeDevice } from '../shared/device-info.mjs';

const unavailable = 'Não disponível';
const singleLine = (value, max = 120) => typeof value === 'string'
  ? value.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

function countryName(value) {
  const code = singleLine(value, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(code);
}

export function managerDeviceEmail({ name, connectedAt, request, securityUrl }) {
  const location = request?.clientLocation || {};
  const place = [singleLine(location.city), singleLine(location.region), countryName(location.country)]
    .filter(Boolean).join(', ') || unavailable;
  const agent = singleLine(request?.headers?.['user-agent'], 500);
  const device = describeDevice(agent);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(connectedAt);
  const browser = device.browser === 'Navegador' ? 'Não identificado' : device.browser;
  const system = device.system === 'Dispositivo' ? 'Não identificado' : device.system;
  return `Olá, ${singleLine(name)}.

Identificamos um novo acesso à sua conta de gestor.

Data e hora (Brasília): ${time}
Sistema e navegador: ${system}, ${browser}
Localização aproximada: ${place}

Se foi você, pode desconsiderar este e-mail.

Não reconhece o acesso? Revise suas sessões e altere sua senha.
${securityUrl}`;
}
