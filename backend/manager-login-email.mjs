import { isIP } from 'node:net';
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

export function managerDeviceEmail({ name, connectedAt, ip, request, securityUrl }) {
  const location = request?.clientLocation || {};
  const place = [singleLine(location.city), singleLine(location.region), countryName(location.country)]
    .filter(Boolean).join(', ') || unavailable;
  const agent = singleLine(request?.headers?.['user-agent'], 500);
  const device = describeDevice(agent);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'long',
  }).format(connectedAt);
  const address = singleLine(ip, 45);
  const browser = device.browser === 'Navegador' ? 'Não identificado' : device.browser;
  const system = device.system === 'Dispositivo' ? 'Não identificado' : device.system;
  const type = !agent ? 'Não identificado' : device.mobile ? 'Celular ou tablet' : system === 'Não identificado' ? 'Não identificado' : 'Computador';
  return `Olá, ${singleLine(name)}.

Um novo dispositivo entrou na sua conta de gestor do Projeto Aprendiz. O login foi concluído em um navegador que ainda não reconhecíamos.

Detalhes do acesso
Data e horário (Brasília): ${time}
Localização aproximada pelo IP: ${place}
Endereço IP: ${isIP(address) ? address : unavailable}
Navegador: ${browser}
Sistema operacional: ${system}
Tipo de dispositivo: ${type}
Rede: ${singleLine(location.network) || unavailable}

Se foi você, nenhuma ação é necessária.

Não reconhece este acesso? Revise e encerre as outras sessões em Configurações, altere sua senha e avise a administração.
${securityUrl}

A localização é uma estimativa da rede, não a posição exata do dispositivo. VPNs, redes móveis e provedores podem indicar outra cidade. Navegador e sistema são identificados pelas informações enviadas pelo dispositivo.

Outro navegador, janela privada ou limpeza dos cookies pode gerar este aviso no mesmo aparelho. Este e-mail é um alerta de segurança e não contém código de acesso.`;
}
