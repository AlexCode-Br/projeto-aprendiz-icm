import api from './api';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

function decodeApplicationServerKey(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function sameKey(left, right) {
  if (!left || !right) return false;
  const a = new Uint8Array(left);
  const b = right instanceof Uint8Array ? right : new Uint8Array(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function pushCapability() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { supported, requiresInstall: isIos() && !isStandalone(), permission: supported ? Notification.permission : 'unsupported' };
}

export async function readPushState() {
  const capability = pushCapability();
  if (!capability.supported) return { ...capability, configured: false, active: false, subscriptions: 0 };
  const [{ data }, registration] = await Promise.all([api.get('/api/account/push'), navigator.serviceWorker.ready]);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && data.publicKey && !sameKey(subscription.options?.applicationServerKey, decodeApplicationServerKey(data.publicKey))) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (subscription) await api.post('/api/account/push/subscribe', { subscription: subscription.toJSON() });
  return { ...capability, ...data, active: Boolean(subscription), permission: Notification.permission };
}

export async function syncExistingPushSubscription() {
  const capability = pushCapability();
  if (!capability.supported || capability.permission !== 'granted' || capability.requiresInstall) return false;
  const [{ data }, registration] = await Promise.all([api.get('/api/account/push'), navigator.serviceWorker.ready]);
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription || !data.publicKey || !sameKey(subscription.options?.applicationServerKey, decodeApplicationServerKey(data.publicKey))) return false;
  await api.post('/api/account/push/subscribe', { subscription: subscription.toJSON() });
  return true;
}

export async function enablePushNotifications() {
  const capability = pushCapability();
  if (!capability.supported) throw new Error('Este navegador não oferece notificações web.');
  if (capability.requiresInstall) throw new Error('No iPhone, adicione o Projeto Aprendiz à Tela de Início antes de ativar as notificações.');
  const { data } = await api.get('/api/account/push');
  if (!data.configured || !data.publicKey) throw new Error('As notificações ainda não estão configuradas no servidor.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'A permissão foi bloqueada. Libere as notificações nas configurações do navegador.' : 'A permissão para notificações não foi concedida.');
  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = decodeApplicationServerKey(data.publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options?.applicationServerKey, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  await api.post('/api/account/push/subscribe', { subscription: subscription.toJSON() });
  return subscription;
}

export async function disablePushNotifications() {
  if (!pushCapability().supported) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await subscription.unsubscribe();
  await api.post('/api/account/push/unsubscribe', { endpoint: subscription.endpoint });
}

export async function testPushNotifications() {
  return api.post('/api/account/push/test', {});
}
