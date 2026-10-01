import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4300';
const email = process.env.AUDIT_EMAIL;
const password = process.env.AUDIT_PASSWORD;
const publicAudit = process.env.AUDIT_PUBLIC === '1';
const routes = String(process.env.AUDIT_ROUTES || '').split(',').map(value => value.trim()).filter(Boolean);
const sizes = [
  [320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932], [480, 800],
  [600, 960], [768, 1024], [800, 1280], [834, 1112], [1024, 768], [1280, 800],
  [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440],
  [568, 320], [640, 360], [667, 375], [844, 390], [915, 412], [932, 430], [960, 600],
];

if ((!publicAudit && (!email || !password)) || !routes.length) {
  console.error('Defina AUDIT_EMAIL, AUDIT_PASSWORD e AUDIT_ROUTES, ou use AUDIT_PUBLIC=1 com AUDIT_ROUTES.');
  process.exit(2);
}

const profile = await mkdtemp(join(tmpdir(), 'aprendiz-responsive-'));
const port = 9334 + Math.floor(Math.random() * 500);
const browser = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,800', 'about:blank',
], { stdio: 'ignore' });

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
};

let socket;
let commandId = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++commandId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

try {
  let endpoint;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { endpoint = await fetchJson(`http://127.0.0.1:${port}/json/version`); break; }
    catch { await wait(100); }
  }
  if (!endpoint) throw new Error('Chrome não iniciou a interface de auditoria.');
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}/login`)}`, { method: 'PUT' });
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  await Promise.all([send('Page.enable'), send('Runtime.enable')]);

  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Falha ao avaliar a página.');
    return result.result.value;
  };
  const navigate = async path => {
    await send('Page.navigate', { url: `${baseUrl}${path}` });
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await wait(75);
      if (await evaluate('document.readyState === "complete"')) break;
    }
    await wait(250);
    if (process.env.AUDIT_KEEP_DIALOGS !== '1') {
      await evaluate(`document.querySelector('.app-modal-dialog button[aria-label="Fechar janela"]')?.click()`);
      await wait(50);
    }
  };

  if (!publicAudit) {
    await navigate('/login');
    await evaluate(`(() => {
      const setValue=(element,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));};
      setValue(document.querySelector('input[name="email"]'),${JSON.stringify(email)});
      setValue(document.querySelector('input[name="password"]'),${JSON.stringify(password)});
      document.querySelector('button[type="submit"]').click();
    })()`);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await wait(100);
      if (!(await evaluate('location.pathname')).includes('/login')) break;
    }
    if ((await evaluate('location.pathname')) === '/login') throw new Error(`Falha no login de auditoria: ${await evaluate('document.querySelector("[role=alert]")?.textContent || "sem mensagem"')}`);
  }

  const findings = [];
  for (const route of routes) {
    await navigate(route);
    for (const [width, height] of sizes) {
      // CSS/layout viewport audit. Keeping desktop metrics avoids Chromium's
      // separate mobile layout viewport, while the supplied width still
      // exercises every responsive breakpoint deterministically.
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await wait(80);
      const metrics = await evaluate(`(() => {
        const viewport=document.documentElement.clientWidth;
        const visible=element=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<viewport&&!element.closest('[inert]');};
        const overflow=[...document.body.querySelectorAll('*')].filter(element=>{if(!visible(element)||element.closest('#sidebar')||element.closest('[role="menu"]')||element instanceof SVGElement)return false;const scrollNav=element.closest('nav');if(scrollNav&&['auto','scroll'].includes(getComputedStyle(scrollNav).overflowX))return false;const rect=element.getBoundingClientRect(),style=getComputedStyle(element);if(style.position==='fixed'&&rect.left>=viewport)return false;return rect.right>viewport+2||rect.left< -2||rect.width>viewport+2;}).slice(0,10).map(element=>({tag:element.tagName,classes:String(element.className||'').slice(0,120),text:String(element.textContent||'').trim().slice(0,60),rect:[Math.round(element.getBoundingClientRect().left),Math.round(element.getBoundingClientRect().right),Math.round(element.getBoundingClientRect().width)]}));
        const smallTargets=[...document.querySelectorAll('button,input,select,textarea,[role="button"],[role="tab"],a.sidebar-link')].filter(element=>{if(!visible(element)||element.matches('input[type="file"],input[type="hidden"]'))return false;if(element.matches('input[type="checkbox"],input[type="radio"]')&&element.closest('label'))return false;if(element.closest('.react-select__control')||element.classList.contains('react-select__input'))return false;const rect=element.getBoundingClientRect();return rect.width<42||rect.height<42;}).slice(0,10).map(element=>({tag:element.tagName,text:String(element.textContent||element.getAttribute('aria-label')||'').trim().slice(0,60),size:[Math.round(element.getBoundingClientRect().width),Math.round(element.getBoundingClientRect().height)]}));
        const main=document.querySelector('.app-main-scroll');
        const authPage=document.querySelector('.auth-page');
        const authClipped=Boolean(authPage&&getComputedStyle(authPage).overflowY==='hidden'&&authPage.scrollHeight>authPage.clientHeight+1);
        return {pathname:location.pathname,documentOverflow:document.documentElement.scrollWidth>viewport+1,mainOverflow:Boolean(main&&main.scrollWidth>main.clientWidth+1),authClipped,overflow,smallTargets};
      })()`);
      if (metrics.pathname !== route || metrics.documentOverflow || metrics.mainOverflow || metrics.authClipped || metrics.overflow.length || metrics.smallTargets.length) findings.push({ route, width, height, ...metrics });
    }
  }
  const routeSummary = routes.map(route => {
    const routeFindings = findings.filter(finding => finding.route === route);
    return {
      route,
      affectedViewports: routeFindings.length,
      documentOverflow: routeFindings.filter(finding => finding.documentOverflow).map(finding => finding.width),
      mainOverflow: routeFindings.filter(finding => finding.mainOverflow).map(finding => finding.width),
      authClipped: routeFindings.filter(finding => finding.authClipped).map(finding => `${finding.width}x${finding.height}`),
      elementOverflow: [...new Set(routeFindings.filter(finding => finding.overflow.length).map(finding => finding.width))],
      smallTargets: [...new Set(routeFindings.filter(finding => finding.smallTargets.length).map(finding => finding.width))],
    };
  });
  const report = { viewports: sizes.length, routes: routes.length, checks: sizes.length * routes.length, routeSummary };
  if (process.env.AUDIT_DETAILS === '1') {
    report.examples = routes.flatMap(route => findings
      .filter(finding => finding.route === route && (finding.documentOverflow || finding.mainOverflow || finding.authClipped || finding.overflow.length || finding.smallTargets.length))
      .slice(0, 5));
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket?.close();
  browser.kill();
  await Promise.race([once(browser, 'exit'), wait(2_000)]).catch(() => {});
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
