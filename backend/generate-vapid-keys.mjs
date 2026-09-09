import { webPushInternals } from './web-push.mjs';

const keys = await webPushInternals.generateVapidKeys(globalThis.crypto);
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
