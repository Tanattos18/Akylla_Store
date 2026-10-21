/*
 * Notificação push (Web Push) para o painel — avisa de pedido novo no celular e no PC,
 * mesmo com o painel fechado.
 *
 * - Chaves VAPID: geradas pelo próprio servidor na primeira vez e guardadas no KV (ninguém precisa copiar chave).
 * - Criptografia da mensagem: RFC 8291 (aes128gcm); assinatura: RFC 8292 (VAPID, ES256).
 * Tudo com WebCrypto (funciona no Cloudflare Workers e no Node 18+).
 */

const enc = new TextEncoder();

export function b64url(bytes) {
  let bin = '';
  new Uint8Array(bytes).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(text) {
  const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  parts.forEach((p) => { out.set(p, at); at += p.length; });
  return out;
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/* Chaves VAPID do servidor (criadas uma vez e guardadas no KV). */
export async function vapidKeys(kv) {
  const saved = await kv.get('push-vapid', 'json');
  if (saved) return saved;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const keys = {
    publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey)
  };
  await kv.put('push-vapid', JSON.stringify(keys));
  return keys;
}

async function vapidHeader(endpoint, keys, subject) {
  const aud = new URL(endpoint).origin;
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(header + '.' + claims));
  return 'vapid t=' + header + '.' + claims + '.' + b64url(sig) + ', k=' + keys.publicKey;
}

/* Criptografa a mensagem para a assinatura do navegador (RFC 8291). */
export async function encryptPayload(subscription, text) {
  const uaPublic = fromB64url(subscription.keys.p256dh);
  const authSecret = fromB64url(subscription.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));

  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21);
  head.set(salt, 0);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPublic.length;
  return concat(head, asPublic, cipher);
}

/* Envia uma notificação. Devolve o status HTTP (201 = entregue; 404/410 = assinatura não existe mais). */
export async function sendPush(subscription, message, keys, subject) {
  const body = await encryptPayload(subscription, JSON.stringify(message));
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(subscription.endpoint, keys, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high'
    },
    body
  });
  return res.status;
}

export async function subscriptionId(endpoint) {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(endpoint));
  return 'push:' + b64url(hash).slice(0, 32);
}
