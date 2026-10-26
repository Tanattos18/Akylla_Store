/*
 * Conta do cliente, sem senha:
 * - "Entrar com Google": o site recebe um token assinado pelo Google (ID token) e o servidor confere
 *   a assinatura, o destinatário (GOOGLE_CLIENT_ID) e a validade.
 * - "Código por e-mail": o servidor manda um código de 6 números (válido por 10 min, 5 tentativas)
 *   pelo Resend (RESEND_API_KEY + EMAIL_FROM).
 * A loja nunca guarda senha. A sessão é um token aleatório guardado no aparelho do cliente;
 * no servidor fica só o hash dele.
 *
 * KV: conta:<e-mail>  ·  sess:<sha256 do token>  ·  otp:<e-mail>  ·  rla:<escopo>:<chave>:<hora>
 */

export class AuthError extends Error {
  constructor(message, status) { super(message); this.status = status || 400; }
}

const SESSION_DAYS = 60;
const OTP_MINUTES = 10;
const OTP_TRIES = 5;
const MAX_ORDERS = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(s, max) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function normEmail(e) { return String(e || '').trim().toLowerCase().slice(0, 120); }
function digits(s, max) { return String(s || '').replace(/\D/g, '').slice(0, max); }

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Limite por hora (por IP ou por e-mail) para não virar fábrica de e-mails. */
async function limit(env, scope, key, max) {
  const k = 'rla:' + scope + ':' + key + ':' + Math.floor(Date.now() / 3600000);
  const n = Number(await env.ORDERS.get(k)) || 0;
  if (n >= max) throw new AuthError('Muitas tentativas. Espere um pouco e tente de novo.', 429);
  await env.ORDERS.put(k, String(n + 1), { expirationTtl: 3700 });
}

function ip(request) { return request.headers.get('CF-Connecting-IP') || 'local'; }

export function authConfig(env) {
  return {
    google: String(env.GOOGLE_CLIENT_ID || ''),
    email: !!(env.RESEND_API_KEY && env.EMAIL_FROM) || env.AUTH_DEV === '1'
  };
}

/* ------------------------------- sessões ------------------------------- */

async function createSession(env, email) {
  const token = randomHex(32);
  await env.ORDERS.put('sess:' + await sha256(token), JSON.stringify({ email, createdAt: Date.now() }), { expirationTtl: SESSION_DAYS * 86400 });
  return token;
}

function tokenFrom(request, body) {
  const h = request.headers.get('Authorization') || '';
  const m = /^Bearer ([0-9a-f]{64})$/.exec(h);
  if (m) return m[1];
  const t = body && body.session;
  return /^[0-9a-f]{64}$/.test(String(t || '')) ? String(t) : '';
}

/* E-mail da sessão (ou '' se não houver sessão válida). */
export async function sessionEmail(env, token) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return '';
  const s = await env.ORDERS.get('sess:' + await sha256(token), 'json');
  return s && s.email ? s.email : '';
}

async function requireSession(request, env, body) {
  const token = tokenFrom(request, body);
  const email = await sessionEmail(env, token);
  if (!email) throw new AuthError('Sua sessão expirou. Entre de novo.', 401);
  return { email, token };
}

/* Cria a conta no primeiro acesso; atualiza nome/último acesso nos seguintes. */
async function touchAccount(env, email, extra) {
  const old = (await env.ORDERS.get('conta:' + email, 'json')) || null;
  const acc = old || { email, name: '', phone: '', address: { cep: '', number: '', complement: '' }, optIn: false, orderIds: [], createdAt: Date.now() };
  if (extra && extra.name && !acc.name) acc.name = clean(extra.name, 80);
  if (extra && extra.via) acc.via = extra.via;
  acc.lastLoginAt = Date.now();
  await env.ORDERS.put('conta:' + email, JSON.stringify(acc));
  return acc;
}

/* --------------------------- código por e-mail --------------------------- */

async function sendCodeEmail(env, email, code) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.AUTH_DEV === '1') return; // testes locais: o código volta na resposta
    throw new AuthError('Entrar por e-mail ainda não está disponível. Use o Google ou finalize sem conta.', 503);
  }
  const html = '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#111726">' +
    '<h2 style="margin:0 0 12px">Seu código da Akylla Shop</h2>' +
    '<p style="margin:0 0 18px">Use o código abaixo para entrar. Ele vale por ' + OTP_MINUTES + ' minutos.</p>' +
    '<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 18px;color:#ff6a00">' + code + '</p>' +
    '<p style="margin:0;color:#5f6878;font-size:13px">Se não foi você, ignore este e-mail. Ninguém da loja vai pedir este código.</p></div>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject: code + ' é o seu código da Akylla Shop', html, text: 'Seu código da Akylla Shop: ' + code + ' (vale ' + OTP_MINUTES + ' min).' })
  });
  if (!res.ok) {
    console.error('resend', res.status, await res.text().catch(() => ''));
    throw new AuthError('Não consegui enviar o e-mail agora. Tente de novo em instantes.', 502);
  }
}

export async function startEmail(request, env) {
  const body = (await request.json().catch(() => null)) || {};
  const email = normEmail(body.email);
  if (!EMAIL_RE.test(email)) throw new AuthError('Digite um e-mail válido.');
  await limit(env, 'ip', ip(request), 10);
  await limit(env, 'mail', await sha256(email), 5);
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  await env.ORDERS.put('otp:' + email, JSON.stringify({ hash: await sha256(email + ':' + code), tries: 0, exp: Date.now() + OTP_MINUTES * 60000 }), { expirationTtl: OTP_MINUTES * 60 + 60 });
  await sendCodeEmail(env, email, code);
  return env.AUTH_DEV === '1' && !env.RESEND_API_KEY ? { ok: true, devCode: code } : { ok: true };
}

export async function verifyEmail(request, env) {
  const body = (await request.json().catch(() => null)) || {};
  const email = normEmail(body.email);
  const code = digits(body.code, 6);
  if (!EMAIL_RE.test(email) || code.length !== 6) throw new AuthError('Digite o código de 6 números.');
  await limit(env, 'vip', ip(request), 30);
  const otp = await env.ORDERS.get('otp:' + email, 'json');
  if (!otp || otp.exp < Date.now()) throw new AuthError('O código expirou. Peça um novo.', 410);
  if (otp.hash !== await sha256(email + ':' + code)) {
    otp.tries = (otp.tries || 0) + 1;
    if (otp.tries >= OTP_TRIES) {
      await env.ORDERS.delete('otp:' + email);
      throw new AuthError('Código errado muitas vezes. Peça um novo.', 429);
    }
    await env.ORDERS.put('otp:' + email, JSON.stringify(otp), { expirationTtl: Math.max(60, Math.ceil((otp.exp - Date.now()) / 1000)) });
    throw new AuthError('Código incorreto. Confira e tente de novo.', 401);
  }
  await env.ORDERS.delete('otp:' + email);
  const acc = await touchAccount(env, email, { via: 'email' });
  return { session: await createSession(env, email), account: publicAccount(acc) };
}

/* --------------------------------- Google --------------------------------- */

let googleKeys = null; // { keys, exp } em memória do servidor

async function googleCerts() {
  if (googleKeys && googleKeys.exp > Date.now()) return googleKeys.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new AuthError('Não consegui falar com o Google agora. Tente de novo.', 502);
  const data = await res.json();
  const age = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') || '');
  googleKeys = { keys: data.keys || [], exp: Date.now() + Math.min(Number(age && age[1]) || 3600, 86400) * 1000 };
  return googleKeys.keys;
}

function b64urlBytes(s) {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

/* Confere o ID token do Google (RS256) e devolve o conteúdo. */
export async function verifyGoogleToken(token, clientId, now) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new AuthError('Login do Google inválido.', 401);
  const header = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[1])));
  if (header.alg !== 'RS256') throw new AuthError('Login do Google inválido.', 401);
  const jwk = (await googleCerts()).find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError('Login do Google inválido.', 401);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  const t = Math.floor((now || Date.now()) / 1000);
  if (!ok) throw new AuthError('Login do Google inválido.', 401);
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') throw new AuthError('Login do Google inválido.', 401);
  if (payload.aud !== clientId) throw new AuthError('Login do Google inválido.', 401);
  if (!(payload.exp > t - 60)) throw new AuthError('O login do Google expirou. Tente de novo.', 401);
  if (payload.email_verified !== true && payload.email_verified !== 'true') throw new AuthError('Seu e-mail do Google não está verificado.', 401);
  return payload;
}

export async function googleLogin(request, env) {
  if (!env.GOOGLE_CLIENT_ID) throw new AuthError('Entrar com Google ainda não está disponível.', 503);
  await limit(env, 'gip', ip(request), 30);
  const body = (await request.json().catch(() => null)) || {};
  const info = await verifyGoogleToken(body.credential, env.GOOGLE_CLIENT_ID);
  const email = normEmail(info.email);
  const acc = await touchAccount(env, email, { name: info.name, via: 'google' });
  return { session: await createSession(env, email), account: publicAccount(acc) };
}

/* --------------------------------- conta --------------------------------- */

function publicAccount(acc) {
  return { email: acc.email, name: acc.name || '', phone: acc.phone || '', address: acc.address || {}, optIn: !!acc.optIn, via: acc.via || '' };
}

/* Resumo do pedido para o cliente (sem dados internos). */
function orderSummary(o) {
  return {
    id: o.id, status: o.status, stage: o.stage || '', createdAt: o.createdAt, total: o.total,
    kind: o.kind || (o.manual ? 'manual' : 'pix'),
    items: (o.lines || []).map((l) => ({ name: l.shortName || l.name, qty: l.qty }))
  };
}

export async function getAccount(request, env) {
  const { email } = await requireSession(request, env);
  const acc = await env.ORDERS.get('conta:' + email, 'json');
  if (!acc) throw new AuthError('Conta não encontrada. Entre de novo.', 401);
  const orders = (await Promise.all((acc.orderIds || []).slice(0, 20).map((id) => env.ORDERS.get('order:' + id, 'json')))).filter(Boolean);
  return { account: publicAccount(acc), orders: orders.map(orderSummary) };
}

export async function saveAccount(request, env) {
  const body = (await request.json().catch(() => null)) || {};
  const { email } = await requireSession(request, env, body);
  const acc = (await env.ORDERS.get('conta:' + email, 'json')) || { email, orderIds: [], createdAt: Date.now() };
  const name = clean(body.name, 80);
  if (name && name.length < 2) throw new AuthError('Digite seu nome.');
  const phone = digits(body.phone, 13);
  if (phone && (phone.length < 10 || phone.length > 13)) throw new AuthError('WhatsApp com DDD: 10 ou 11 números.');
  const a = body.address || {};
  acc.name = name;
  acc.phone = phone;
  acc.address = { cep: digits(a.cep, 8), number: clean(a.number, 20), complement: clean(a.complement, 80) };
  if (!!body.optIn !== !!acc.optIn) { acc.optIn = !!body.optIn; acc.optInAt = Date.now(); }
  acc.updatedAt = Date.now();
  await env.ORDERS.put('conta:' + email, JSON.stringify(acc));
  return { account: publicAccount(acc) };
}

export async function logout(request, env) {
  const token = tokenFrom(request, null);
  if (token) await env.ORDERS.delete('sess:' + await sha256(token));
  return { ok: true };
}

/* LGPD: o cliente apaga a própria conta. Os pedidos ficam no histórico de vendas da loja (obrigação fiscal). */
export async function deleteAccount(request, env) {
  const { email, token } = await requireSession(request, env);
  await env.ORDERS.delete('conta:' + email);
  await env.ORDERS.delete('sess:' + await sha256(token));
  return { ok: true };
}

/* Chamado na criação do pedido: se o cliente estava logado, o pedido entra na conta dele. */
export async function linkOrder(env, token, order) {
  const email = await sessionEmail(env, token);
  if (!email) return '';
  const acc = await env.ORDERS.get('conta:' + email, 'json');
  if (!acc) return '';
  acc.orderIds = [order.id].concat((acc.orderIds || []).filter((id) => id !== order.id)).slice(0, MAX_ORDERS);
  if (!acc.phone && order.customer && order.customer.phone) acc.phone = digits(order.customer.phone, 13);
  if (!acc.name && order.customer && order.customer.name) acc.name = clean(order.customer.name, 80);
  await env.ORDERS.put('conta:' + email, JSON.stringify(acc));
  return email;
}
