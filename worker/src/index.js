/*
 * Akylla Shop — servidor de pagamentos (Cloudflare Worker).
 *
 * Rotas — PIX manual com reserva (padrão atual):
 *   POST /api/manual-orders              registra o pedido do PIX manual e RESERVA (baixa) o estoque
 *   POST /api/admin/orders/:id/confirm   painel: pagamento conferido → mantém a baixa
 *   POST /api/admin/orders/:id/cancel    painel: não pago → devolve o estoque
 *   (agendado, de hora em hora)          pedidos sem confirmação há AUTO_CANCEL_HOURS → cancela e devolve
 *
 * Rotas — Mercado Pago automático (opcional, para o futuro):
 *   POST /api/orders              cria o pedido: valida estoque, recalcula preço/frete,
 *                                 reserva o estoque e gera o PIX no Mercado Pago
 *   GET  /api/orders/:id          status do pedido (consulta o Mercado Pago se estiver pendente)
 *   POST /api/orders/:id/cancel   cancela um PIX não pago (libera a reserva)
 *   POST /api/webhook             aviso do Mercado Pago → confere o pagamento → baixa o estoque
 *   GET  /api/admin/orders        lista de pedidos (para o painel; exige a chave do GitHub)
 *   GET  /api/admin/orders/changes  última mudança nos pedidos (o painel consulta a cada 20 s)
 *   GET  /api/health              teste rápido
 *
 * Rotas — cartão de crédito (Checkout Pro do Mercado Pago, até 12x, juros com o cliente):
 *   POST /api/card-orders                cria o pedido, reserva o estoque e devolve o link da página de pagamento
 *   (o aviso do pagamento chega em /api/webhook com type=payment)
 *
 * Rotas — acompanhamento e etapas:
 *   GET  /api/track?id=AK-…&phone=…      cliente acompanha o pedido (confere o WhatsApp do pedido)
 *   POST /api/track/cancel {id, phone}   cliente cancela um pagamento online não concluído (devolve a reserva)
 *   POST /api/admin/orders/:id/stage     painel: separando → pronto/enviado → entregue
 *
 * Rotas — avisos de pedido no painel (Web Push, celular e PC):
 *   GET  /api/push/key                   chave pública VAPID (o servidor cria e guarda no KV)
 *   POST /api/admin/push/subscribe       painel: cadastra este aparelho para receber avisos
 *   POST /api/admin/push/unsubscribe     painel: descadastra este aparelho
 *   POST /api/admin/push/test            painel: manda um aviso de teste para todos os aparelhos
 *
 * Segredos (Cloudflare → Worker → Settings → Variables and Secrets):
 *   MP_ACCESS_TOKEN     Access Token de PRODUÇÃO do Mercado Pago
 *   MP_WEBHOOK_SECRET   assinatura secreta dos webhooks do Mercado Pago
 *   GITHUB_TOKEN        chave fine-grained do GitHub (Contents: Read and write no repositório)
 *   CALLMEBOT_APIKEY    chave do CallMeBot para avisar as vendas no WhatsApp da loja (opcional)
 * Variáveis (wrangler.toml): GITHUB_REPO, GITHUB_BRANCH, ALLOWED_ORIGINS, PAYMENT_MINUTES, STORE_WHATSAPP,
 *   MP_API ("orders" = API de Orders do Mercado Pago, padrão; "payments" = API legada)
 * KV: ORDERS (pedidos e reservas)
 */
import {
  OrderError, brazilNow, newOrderId, reservedByProduct, buildLines, serverShipping,
  applySale, applyReturn, stockShortfall, centsToReais, mpDate, Formato, cleanCustomer, saleMessage
} from './logic.js';
import { vapidKeys, sendPush, subscriptionId } from './push.js';

const PRODUCTS_PATH = 'assets/js/products.js';
const CONFIG_PATH = 'assets/js/config.js';

/* ------------------------------- utilidades ------------------------------- */

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(headers || {}) }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}

function b64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function utf8ToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* --------------------------------- GitHub --------------------------------- */

async function gh(env, path, options) {
  const res = await fetch('https://api.github.com' + path, {
    method: (options && options.method) || 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + env.GITHUB_TOKEN,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'akylla-shop-worker',
      ...(options && options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options && options.body ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error('GitHub ' + res.status + ': ' + (data.message || ''));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* O nome do repositório pode mudar (ex.: Akylla_Store → Akylla_Shop): resolve o atual. */
let repoName = null;
async function repo(env) {
  if (!repoName) {
    const info = await gh(env, '/repos/' + env.GITHUB_REPO);
    repoName = info.full_name;
  }
  return repoName;
}

async function readFile(env, path) {
  const r = await repo(env);
  const data = await gh(env, '/repos/' + r + '/contents/' + path + '?ref=' + encodeURIComponent(env.GITHUB_BRANCH || 'main'));
  return { text: b64ToUtf8(data.content), sha: data.sha };
}

/* Catálogo + configuração atuais (cache curto para não estourar a API). */
let catalogCache = null;
async function loadCatalog(env, fresh) {
  if (!fresh && catalogCache && Date.now() - catalogCache.at < 30000) return catalogCache;
  const [p, c] = await Promise.all([readFile(env, PRODUCTS_PATH), readFile(env, CONFIG_PATH)]);
  const parsed = Formato.parseProducts(p.text);
  catalogCache = { at: Date.now(), products: parsed.products, categories: parsed.categories, config: Formato.parseConfig(c.text), productsSha: p.sha };
  return catalogCache;
}

/*
 * Grava uma mudança de estoque no products.js (com nova tentativa se alguém publicou ao mesmo tempo).
 *   kind 'sale'    → baixa (venda paga pelo Mercado Pago)
 *   kind 'reserve' → baixa (pedido PIX manual aguardando confirmação); recusa se faltar estoque
 *   kind 'return'  → devolve (pedido cancelado)
 */
/* Já existe commit desta mesma operação para este pedido? (evita baixar o estoque duas vezes quando
   o aviso do Mercado Pago e a consulta do site chegam juntos — o GitHub é a fonte de verdade). */
async function alreadyCommitted(env, r, prefix) {
  const list = await gh(env, '/repos/' + r + '/commits?path=' + encodeURIComponent(PRODUCTS_PATH) + '&sha=' + encodeURIComponent(env.GITHUB_BRANCH || 'main') + '&per_page=20');
  return (list || []).some((c) => String((c.commit && c.commit.message) || '').startsWith(prefix));
}

async function commitStock(env, order, kind) {
  const r = await repo(env);
  const prefix = kind === 'reserve' ? 'reserva: pedido ' + order.id + ' aguardando'
    : kind === 'return' ? 'estoque devolvido: pedido ' + order.id + ' cancelado'
    : 'venda: pedido ' + order.id + ' (';
  /* configuração da reposição (para saber quanto dá para vender além do físico) */
  const restockConfig = kind === 'reserve' ? (await loadCatalog(env, true)).config : null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const file = await readFile(env, PRODUCTS_PATH);
    /* confere depois de ler o arquivo: se outra chamada gravou antes, a nossa gravação seria repetida */
    if (await alreadyCommitted(env, r, prefix)) { catalogCache = null; return Object.assign([], { duplicate: true }); }
    const catalog = Formato.parseProducts(file.text);
    if (kind === 'reserve') {
      const missing = stockShortfall(catalog.products, order.lines, restockConfig);
      if (missing.length) throw new OrderError('Sem estoque suficiente agora: ' + missing.join(', ') + '. Atualize a página.', 409);
    }
    const result = kind === 'return' ? applyReturn(catalog.products, order.lines) : applySale(catalog.products, order.lines);
    const supply = result.supply || {};
    const owed = order.lines.filter((l) => supply[l.id]).map((l) => supply[l.id] + 'x ' + l.name);
    const text = Formato.serializeProducts(catalog.categories, result.products);
    const summary = order.lines.map((l) => l.qty + 'x ' + l.name).join(', ');
    const title = kind === 'reserve' ? 'reserva: pedido ' + order.id + ' aguardando confirmação do PIX (' + summary + ')'
      : kind === 'return' ? 'estoque devolvido: pedido ' + order.id + ' cancelado (' + summary + ')'
      : 'venda: pedido ' + order.id + ' (' + summary + ')';
    const detail = kind === 'sale' ? 'Pagamento Mercado Pago ' + order.paymentId + ' aprovado.'
      : kind === 'reserve' ? 'Cliente: ' + ((order.customer && order.customer.name) || '—') + '. Confirmar ou cancelar no painel → Pedidos.'
      : 'Motivo: ' + (order.cancelReason || 'cancelado');
    try {
      await gh(env, '/repos/' + r + '/contents/' + PRODUCTS_PATH, {
        method: 'PUT',
        body: {
          message: title + '\n\n' + detail + '\n' +
            (result.warnings.length ? 'ATENÇÃO: ' + result.warnings.join('; ') + '\n' : '') +
            (owed.length ? 'COMPRAR NO FORNECEDOR: ' + owed.join(', ') + '\n' : '') + '\nAlteração automática de estoque pelo servidor.',
          content: utf8ToB64(text),
          sha: file.sha,
          branch: env.GITHUB_BRANCH || 'main'
        }
      });
      catalogCache = null;
      /* marca no pedido quantas unidades de cada item vêm do fornecedor */
      if (kind !== 'return') order.lines.forEach((l) => { l.fromSupplier = supply[l.id] || 0; });
      return result.warnings;
    } catch (err) {
      if (err.status !== 409 && err.status !== 422) throw err;
      await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
    }
  }
  throw new Error('Não consegui gravar o estoque no GitHub depois de várias tentativas.');
}

function commitSale(env, order) {
  return commitStock(env, order, 'sale');
}

/* ------------------------------ Mercado Pago ------------------------------ */

async function mp(env, path, options) {
  const res = await fetch('https://api.mercadopago.com' + path, {
    method: (options && options.method) || 'GET',
    headers: {
      Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      ...(options && options.idempotency ? { 'X-Idempotency-Key': options.idempotency } : {})
    },
    body: options && options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error('Mercado Pago ' + res.status + ': ' + (data.message || data.error || ''));
    err.status = res.status;
    throw err;
  }
  return data;
}

/*
 * Adaptador do Mercado Pago. Padrão: API de Orders (MP_API = "orders").
 * A API de Payments (legada, será descontinuada) fica disponível com MP_API = "payments".
 * Todas as funções devolvem um formato único:
 *   createPix → { paymentId, code, image, ticketUrl }
 *   readPix   → { state: 'paid' | 'pending' | 'closed', amountCents, ref, raw }
 */
function useOrdersApi(env) {
  return String(env.MP_API || 'orders').toLowerCase() !== 'payments';
}

function reais(cents) {
  return (cents / 100).toFixed(2);
}

async function createPix(env, { id, total, email, expiresAt, workerUrl }) {
  if (useOrdersApi(env)) {
    const minutes = Math.max(30, Math.round((expiresAt - Date.now()) / 60000));
    const order = await mp(env, '/v1/orders', {
      method: 'POST',
      idempotency: id,
      body: {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: reais(total),
        external_reference: id,
        description: 'Akylla Shop - pedido ' + id,
        transactions: {
          payments: [{
            amount: reais(total),
            payment_method: { id: 'pix', type: 'bank_transfer' },
            expiration_time: 'PT' + minutes + 'M'
          }]
        },
        payer: { email }
      }
    });
    const pay = (order.transactions && order.transactions.payments && order.transactions.payments[0]) || {};
    const pm = pay.payment_method || {};
    return { paymentId: String(order.id), code: pm.qr_code, image: pm.qr_code_base64, ticketUrl: pm.ticket_url };
  }
  const payment = await mp(env, '/v1/payments', {
    method: 'POST',
    idempotency: id,
    body: {
      transaction_amount: centsToReais(total),
      description: 'Akylla Shop - pedido ' + id,
      payment_method_id: 'pix',
      external_reference: id,
      notification_url: workerUrl + '/api/webhook',
      date_of_expiration: mpDate(expiresAt),
      payer: { email }
    }
  });
  const tx = (payment.point_of_interaction && payment.point_of_interaction.transaction_data) || {};
  return { paymentId: String(payment.id), code: tx.qr_code, image: tx.qr_code_base64, ticketUrl: tx.ticket_url };
}

function normalizePayment(raw) {
  return {
    state: raw.status === 'approved' ? 'paid' : ['pending', 'in_process', 'authorized'].includes(raw.status) ? 'pending' : 'closed',
    amountCents: Math.round(Number(raw.transaction_amount) * 100),
    ref: String(raw.external_reference || ''),
    id: String(raw.id),
    installments: raw.installments || 1,
    raw
  };
}

/* Pagamento no cartão: procura pelo número do pedido (o cliente pode ter tentado mais de um cartão). */
async function readCardPayment(env, order) {
  const found = await mp(env, '/v1/payments/search?external_reference=' + encodeURIComponent(order.id) + '&sort=date_created&criteria=desc&limit=20');
  const list = (found.results || []).map(normalizePayment);
  return list.find((p) => p.state === 'paid') || list[0] || { state: 'pending', amountCents: 0, ref: order.id, id: '' };
}

function normalize(env, raw) {
  if (useOrdersApi(env)) {
    const paid = raw.status === 'processed' && (raw.status_detail === 'accredited' || !raw.status_detail);
    const open = ['created', 'processing', 'action_required'].includes(raw.status);
    return {
      state: paid ? 'paid' : open ? 'pending' : 'closed',
      amountCents: Math.round(Number(raw.total_amount) * 100),
      ref: String(raw.external_reference || ''),
      id: String(raw.id),
      raw
    };
  }
  return {
    state: raw.status === 'approved' ? 'paid' : ['pending', 'in_process', 'authorized'].includes(raw.status) ? 'pending' : 'closed',
    amountCents: Math.round(Number(raw.transaction_amount) * 100),
    ref: String(raw.external_reference || ''),
    id: String(raw.id),
    raw
  };
}

async function readPix(env, paymentId) {
  const raw = await mp(env, (useOrdersApi(env) ? '/v1/orders/' : '/v1/payments/') + paymentId);
  return normalize(env, raw);
}

async function cancelPix(env, paymentId) {
  if (useOrdersApi(env)) return mp(env, '/v1/orders/' + paymentId + '/cancel', { method: 'POST', idempotency: 'cancel-' + paymentId });
  return mp(env, '/v1/payments/' + paymentId, { method: 'PUT', body: { status: 'cancelled' } });
}

/* Assinatura dos webhooks (x-signature: ts=...,v1=...). */
async function validSignature(request, env, dataId) {
  if (!env.MP_WEBHOOK_SECRET) return true; // sem segredo configurado, confia na consulta ao MP
  const header = request.headers.get('x-signature') || '';
  const requestId = request.headers.get('x-request-id') || '';
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.trim().split('=')));
  if (!parts.ts || !parts.v1) return false;
  const manifest = 'id:' + String(dataId).toLowerCase() + ';request-id:' + requestId + ';ts:' + parts.ts + ';';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.MP_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
  return hex === parts.v1;
}

/* ------------------------- aviso no WhatsApp da loja ------------------------- */

async function notifyStore(env, order) {
  if (!env.CALLMEBOT_APIKEY || !env.STORE_WHATSAPP) return false;
  const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(env.STORE_WHATSAPP) +
    '&text=' + encodeURIComponent(saleMessage(order)) + '&apikey=' + encodeURIComponent(env.CALLMEBOT_APIKEY);
  try {
    const res = await fetch(url);
    return res.ok;
  } catch (err) {
    console.error('aviso WhatsApp falhou', err);
    return false;
  }
}

/* ------------------- aviso push no painel (celular e PC) ------------------- */

const PUSH_SUBJECT = 'https://akyllashop.com';
const PUSH_TTL = 60 * 60 * 24 * 365;

function pushMessage(order) {
  const items = (order.lines || []).reduce((n, l) => n + l.qty, 0);
  const who = order.customer && order.customer.name ? order.customer.name + ' · ' : '';
  const status = order.status === 'paid' ? 'pago' : order.status === 'review' ? 'pagamento para revisar' : 'aguardando confirmação do PIX';
  const owed = (order.lines || []).reduce((n, l) => n + (l.fromSupplier || 0), 0);
  return {
    title: (order.status === 'paid' ? '✅ Venda paga ' : '🛒 Novo pedido ') + order.id,
    body: who + items + (items === 1 ? ' item' : ' itens') + ' · R$ ' + (order.total / 100).toFixed(2).replace('.', ',') + ' — ' + status + (owed ? ' · ' + owed + ' para comprar no fornecedor' : ''),
    tag: order.id,
    url: '/admin/#pedidos'
  };
}

/* Manda o aviso para todos os aparelhos cadastrados; apaga os que não existem mais. */
async function notifyAdmins(env, message) {
  try {
    const list = await env.ORDERS.list({ prefix: 'push:' });
    if (!list.keys.length) return 0;
    const keys = await vapidKeys(env.ORDERS);
    let sent = 0;
    await Promise.all(list.keys.map(async (k) => {
      const sub = await env.ORDERS.get(k.name, 'json');
      if (!sub) return;
      try {
        const status = await sendPush(sub, message, keys, PUSH_SUBJECT);
        if (status === 404 || status === 410) await env.ORDERS.delete(k.name);
        else if (status < 300) sent += 1;
        else console.error('push recusado', status, new URL(sub.endpoint).host);
      } catch (err) {
        console.error('push falhou', err);
      }
    }));
    return sent;
  } catch (err) {
    console.error('avisos push falharam', err);
    return 0;
  }
}

async function pushSubscribe(request, env, remove) {
  await requireAdmin(request, env);
  const body = await request.json().catch(() => null);
  const sub = body && body.subscription;
  if (!sub || !/^https:\/\//.test(String(sub.endpoint || ''))) throw new OrderError('Assinatura inválida.');
  const id = await subscriptionId(sub.endpoint);
  if (remove) {
    await env.ORDERS.delete(id);
    return json({ ok: true });
  }
  if (!sub.keys || !sub.keys.p256dh || !sub.keys.auth) throw new OrderError('Assinatura inválida.');
  const label = String((body && body.label) || '').slice(0, 60);
  await env.ORDERS.put(id, JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, label, at: Date.now() }), { expirationTtl: PUSH_TTL });
  return json({ ok: true });
}

async function pushTest(request, env) {
  await requireAdmin(request, env);
  const sent = await notifyAdmins(env, { title: '🔔 Teste do painel Akylla', body: 'Os avisos de pedido estão funcionando neste aparelho.', tag: 'teste', url: '/admin/#pedidos' });
  return json({ ok: true, sent });
}

/* ---------------------------------- KV ---------------------------------- */

const ORDER_TTL = 60 * 60 * 24 * 120; // pedidos ficam 120 dias

async function getOrder(env, id) {
  return env.ORDERS.get('order:' + id, 'json');
}

async function saveOrder(env, order) {
  /* Vendas confirmadas ficam para sempre (histórico do dashboard); o resto expira em 120 dias. */
  await env.ORDERS.put('order:' + order.id, JSON.stringify(order), {
    ...(order.status === 'paid' ? {} : { expirationTtl: ORDER_TTL }),
    metadata: { status: order.status, total: order.total, createdAt: order.createdAt, manual: !!order.manual }
  });
  /* marcador de "algo mudou": o painel consulta só isto a cada 20 s (leitura simples, barata no plano grátis) */
  await env.ORDERS.put('meta:changed', JSON.stringify({ at: Date.now(), id: order.id, status: order.status }));
}

async function activeReservations(env) {
  const list = await env.ORDERS.list({ prefix: 'res:' });
  const now = Date.now();
  return list.keys
    .filter((k) => k.metadata && k.metadata.expiresAt > now)
    .map((k) => ({ id: k.name.slice(4), items: k.metadata.items }));
}

async function reserve(env, order) {
  const ttl = Math.max(60, Math.ceil((order.expiresAt - Date.now()) / 1000) + 300);
  await env.ORDERS.put('res:' + order.id, '1', {
    expirationTtl: ttl,
    metadata: { expiresAt: order.expiresAt, items: order.lines.map((l) => ({ id: l.id, qty: l.qty })) }
  });
}

async function release(env, id) {
  await env.ORDERS.delete('res:' + id);
}

/* ------------------------------ fluxo do pedido ------------------------------ */

function publicOrder(order) {
  return {
    id: order.id,
    status: order.status,
    subtotal: order.subtotal,
    shipping: order.shipping.fee,
    total: order.total,
    savings: order.savings,
    lines: order.lines,
    delivery: order.shipping,
    expiresAt: order.expiresAt,
    paymentId: order.paymentId,
    pix: order.status === 'pending' ? order.pix : undefined,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    manual: !!order.manual,
    canceledAt: order.canceledAt,
    cancelReason: order.cancelReason,
    customerName: order.customer ? order.customer.name : '',
    kind: order.kind || (order.manual ? 'manual' : 'pix'),
    stage: order.stage || '',
    stageAt: order.stageAt || {},
    baseTotal: order.baseTotal,
    cardFeePercent: order.cardFeePercent,
    installments: order.installments
  };
}

async function createOrder(request, env) {
  /* evita que alguém prenda o estoque gerando PIX em série */
  await rateLimit(env, request, Number(env.PIX_ORDERS_PER_HOUR) || 20, 'rlp');
  const body = await request.json().catch(() => null);
  if (!body) throw new OrderError('Pedido inválido.');
  const catalog = await loadCatalog(env, true);
  const reserved = reservedByProduct(await activeReservations(env));
  const now = Date.now();
  const built = buildLines({ products: catalog.products, config: catalog.config, items: body.items, reserved, now: brazilNow(now) });
  const customer = cleanCustomer(body.customer);
  const shipping = await serverShipping(body.delivery, catalog.config);
  const total = built.subtotal + shipping.fee;

  const minutes = Math.max(10, Number(env.PAYMENT_MINUTES) || 30);
  const id = newOrderId(now);
  const expiresAt = now + minutes * 60 * 1000;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || '')) ? String(body.email).slice(0, 120) : 'pedido+' + id.toLowerCase() + '@akyllashop.com';
  const workerUrl = new URL(request.url).origin;

  const pix = await createPix(env, { id, total, email, expiresAt, workerUrl });
  if (!pix.code) throw new Error('Mercado Pago não devolveu o código PIX.');

  const order = {
    id,
    status: 'pending',
    createdAt: now,
    expiresAt,
    lines: built.lines,
    subtotal: built.subtotal,
    savings: built.savings,
    shipping,
    total,
    email: body.email ? email : '',
    customer,
    paymentId: pix.paymentId,
    pix: { code: pix.code, image: pix.image ? 'data:image/png;base64,' + pix.image : '', ticketUrl: pix.ticketUrl }
  };
  await saveOrder(env, order);
  await reserve(env, order);
  return json(publicOrder(order), 201);
}

/* ------------------------- cartão (Checkout Pro) ------------------------- */

function cardSettings(config) {
  const c = (config && config.card) || {};
  return {
    enabled: !!c.enabled,
    maxInstallments: Math.min(12, Math.max(1, Math.floor(Number(c.maxInstallments) || 12))),
    feePercent: Math.min(20, Math.max(0, Number(c.feePercent) || 0))
  };
}

/* Preço no cartão: a taxa do Mercado Pago (feePercent) é descontada do valor cobrado, então
   cobra-se PIX ÷ (1 − taxa) — assim a loja recebe exatamente o preço do PIX. Juros das parcelas: o cliente. */
function cardTotal(base, feePercent) {
  return Math.ceil(base / (1 - feePercent / 100));
}

function siteUrl(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : (allowed[0] || 'https://akyllashop.com');
}

async function createCardOrder(request, env) {
  if (!env.MP_ACCESS_TOKEN) throw new OrderError('Pagamento com cartão indisponível no momento.', 503);
  await rateLimit(env, request, 20, 'rlc');
  const body = await request.json().catch(() => null);
  if (!body) throw new OrderError('Pedido inválido.');
  const catalog = await loadCatalog(env, true);
  const card = cardSettings(catalog.config);
  if (!card.enabled) throw new OrderError('Pagamento com cartão indisponível no momento.', 409);
  const reserved = reservedByProduct(await activeReservations(env));
  const now = Date.now();
  const built = buildLines({ products: catalog.products, config: catalog.config, items: body.items, reserved, now: brazilNow(now) });
  const customer = cleanCustomer(body.customer);
  const shipping = await serverShipping(body.delivery, catalog.config);
  const base = built.subtotal + shipping.fee;
  const total = cardTotal(base, card.feePercent);
  const id = newOrderId(now);
  const expiresAt = now + 60 * 60 * 1000; // 1 h para concluir no Mercado Pago
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || '')) ? String(body.email).slice(0, 120) : '';
  const site = siteUrl(request, env);
  const back = site + '/pedido.html?id=' + encodeURIComponent(id);
  const summary = built.lines.map((l) => l.qty + 'x ' + l.name).join(', ');

  const pref = await mp(env, '/checkout/preferences', {
    method: 'POST',
    idempotency: 'card-' + id,
    body: {
      items: [{ id, title: 'Akylla Shop - pedido ' + id, description: summary.slice(0, 250), quantity: 1, currency_id: 'BRL', unit_price: Number(reais(total)) }],
      external_reference: id,
      payer: { name: customer.name, ...(email ? { email } : {}) },
      payment_methods: { installments: card.maxInstallments, excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }, { id: 'bank_transfer' }] },
      back_urls: { success: back, pending: back, failure: back },
      auto_return: 'approved',
      binary_mode: true,
      notification_url: new URL(request.url).origin + '/api/webhook?source=card',
      expires: true,
      expiration_date_from: mpDate(now - 60000),
      expiration_date_to: mpDate(expiresAt),
      statement_descriptor: 'AKYLLASHOP'
    }
  });
  if (!pref.init_point) throw new Error('Mercado Pago não devolveu o link de pagamento.');

  const order = {
    id,
    kind: 'card',
    status: 'pending',
    createdAt: now,
    expiresAt,
    lines: built.lines,
    subtotal: built.subtotal,
    savings: built.savings,
    shipping,
    baseTotal: base,
    cardFeePercent: card.feePercent,
    maxInstallments: card.maxInstallments,
    checkoutUrl: pref.init_point,
    total,
    email,
    customer,
    paymentId: '',
    preferenceId: String(pref.id || '')
  };
  await saveOrder(env, order);
  await reserve(env, order);
  return json({ ...publicOrder(order), checkoutUrl: pref.init_point }, 201);
}

/* --------------------- acompanhamento e etapas do pedido --------------------- */

const STAGES = ['separando', 'pronto', 'enviado', 'entregue'];

function digitsTail(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-8);
}

/* Pedido do cliente: confere o número e o WhatsApp da compra (sem WhatsApp no pedido, basta o número). */
async function findTracked(env, rawId, rawPhone) {
  const id = String(rawId || '').trim().toUpperCase();
  if (!/^AK-[A-Z0-9]{6,16}$/.test(id)) throw new OrderError('Número de pedido inválido. Ele começa com AK-.', 400);
  const order = await getOrder(env, id);
  const notFound = new OrderError('Não encontramos esse pedido. Confira o número e o WhatsApp.', 404);
  if (!order) throw notFound;
  const stored = digitsTail(order.customer && order.customer.phone);
  if (stored && stored !== digitsTail(rawPhone)) throw notFound;
  return order;
}

function trackPayload(order) {
  const d = order.shipping || {};
  const a = (d.quote && d.quote.address) || d.address || {};
  const open = order.status === 'pending' && Date.now() < (order.expiresAt || 0);
  return {
    id: order.id,
    status: order.status,
    kind: order.kind || (order.manual ? 'manual' : 'pix'),
    stage: order.stage || '',
    stageAt: order.stageAt || {},
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    canceledAt: order.canceledAt || null,
    cancelReason: order.cancelReason || '',
    expiresAt: order.expiresAt || null,
    firstName: String((order.customer && order.customer.name) || '').split(' ')[0],
    lines: (order.lines || []).map((l) => ({ id: l.id, qty: l.qty, name: l.name })),
    total: order.total,
    installments: order.installments || null,
    /* pagamento no cartão ainda aberto: o cliente pode voltar para concluir ou cancelar */
    checkoutUrl: open && order.kind === 'card' ? order.checkoutUrl || '' : '',
    canCancel: open,
    delivery: d.mode === 'pickup' ? { mode: 'pickup' } : { mode: 'delivery', area: [a.district, a.city].filter(Boolean).join(', ') }
  };
}

/* Limite das consultas de acompanhamento em memória (sem gravar no KV, que tem cota diária de gravações). */
const trackHits = new Map();
function softLimit(request, perMinute) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const minute = Math.floor(Date.now() / 60000);
  const key = ip + ':' + minute;
  const n = (trackHits.get(key) || 0) + 1;
  trackHits.set(key, n);
  if (trackHits.size > 5000) trackHits.clear();
  if (n > perMinute) throw new OrderError('Muitas consultas seguidas. Tente de novo em alguns minutos.', 429);
}

async function trackOrder(request, env) {
  softLimit(request, 40);
  const url = new URL(request.url);
  let order = await findTracked(env, url.searchParams.get('id'), url.searchParams.get('phone'));
  if (order.status === 'pending') order = await syncPayment(env, order).catch(() => order);
  return json(trackPayload(order));
}

/* Cliente desiste de um pagamento online (cartão ou PIX automático) ainda não pago: devolve a reserva na hora. */
async function cancelTracked(request, env) {
  softLimit(request, 10);
  const body = await request.json().catch(() => ({}));
  let order = await findTracked(env, body.id, body.phone);
  if (order.status !== 'pending') return json(trackPayload(order));
  order = await syncPayment(env, order).catch(() => order);
  if (order.status !== 'pending') return json(trackPayload(order)); // pagou (ou já venceu) enquanto isso
  if (order.kind !== 'card' && order.paymentId) await cancelPix(env, order.paymentId).catch(() => null);
  order.status = 'canceled';
  order.canceledAt = Date.now();
  order.cancelReason = 'cancelado pelo cliente (pagamento não concluído)';
  await saveOrder(env, order);
  await release(env, order.id);
  return json(trackPayload(order));
}

async function adminStage(request, env, id) {
  await requireAdmin(request, env);
  const body = await request.json().catch(() => ({}));
  const stage = String(body.stage || '');
  if (!STAGES.includes(stage)) throw new OrderError('Etapa inválida.');
  const order = await getOrder(env, id);
  if (!order) throw new OrderError('Pedido não encontrado.', 404);
  if (order.status !== 'paid') throw new OrderError('Só pedidos pagos avançam de etapa.', 409);
  order.stage = stage;
  order.stageAt = { ...(order.stageAt || {}), [stage]: Date.now() };
  await saveOrder(env, order);
  return json(publicOrder(order));
}

/* Conferência do Access Token sem criar cobrança (GET /users/me). Não expõe dados da conta. */
async function mpCheck(env) {
  if (!env.MP_ACCESS_TOKEN) return { mpToken: 'ausente' };
  try {
    const me = await mp(env, '/users/me');
    return { mpToken: 'válido', mpProduction: !String(env.MP_ACCESS_TOKEN).startsWith('TEST-'), mpTestUser: /^TEST/i.test(String(me.nickname || '')) || (me.tags || []).includes('test_user') };
  } catch (err) {
    return { mpToken: 'inválido', mpError: err.status || 'falha' };
  }
}

/* Confere o pagamento no Mercado Pago e, se aprovado, conclui o pedido (idempotente). */
async function syncPayment(env, order, payment) {
  if (!order || order.status !== 'pending') return order;
  const card = order.kind === 'card';
  const pay = payment || (card ? await readCardPayment(env, order) : await readPix(env, order.paymentId));
  if (card && pay.id) order.paymentId = pay.id;
  if (card && pay.installments) order.installments = pay.installments;
  const amountOk = pay.amountCents === order.total;
  const refOk = pay.ref === order.id;

  if (pay.state === 'paid' && amountOk && refOk) {
    order.status = 'paid';
    order.paidAt = Date.now();
    await saveOrder(env, order); // marca antes de mexer no estoque: evita baixa em dobro
    try {
      order.stockWarnings = await commitSale(env, order);
      order.stockUpdated = true;
    } catch (err) {
      order.stockUpdated = false;
      order.stockError = String(err.message || err);
    }
    /* outra chamada já registrou esta venda: não avisa de novo */
    if (!(order.stockWarnings && order.stockWarnings.duplicate)) {
      order.notified = await notifyStore(env, order);
      order.pushed = await notifyAdmins(env, pushMessage(order));
    }
    await saveOrder(env, order);
    await release(env, order.id);
  } else if (pay.state === 'paid') {
    order.status = 'review';
    order.reviewReason = 'Pagamento aprovado com valor ou referência diferente (R$ ' + (pay.amountCents / 100).toFixed(2) + ').';
    order.notified = await notifyStore(env, order);
    order.pushed = await notifyAdmins(env, pushMessage(order));
    await saveOrder(env, order);
    await release(env, order.id);
  } else if ((pay.state === 'closed' && !card) || Date.now() > order.expiresAt + 5 * 60 * 1000) {
    order.status = 'expired';
    await saveOrder(env, order);
    await release(env, order.id);
  }
  return order;
}

async function orderStatus(env, id) {
  let order = await getOrder(env, id);
  if (!order) throw new OrderError('Pedido não encontrado.', 404);
  if (order.status === 'pending') order = await syncPayment(env, order);
  return json(publicOrder(order));
}

async function cancelOrder(env, id) {
  const order = await getOrder(env, id);
  if (!order) throw new OrderError('Pedido não encontrado.', 404);
  if (order.status === 'pending') {
    const synced = await syncPayment(env, order);
    if (synced.status === 'pending') {
      await cancelPix(env, order.paymentId).catch(() => null);
      synced.status = 'expired';
      await saveOrder(env, synced);
      await release(env, id);
    }
    return json(publicOrder(synced));
  }
  return json(publicOrder(order));
}

async function cardWebhook(request, env, url, dataId) {
  if (!(await validSignature(request, env, url.searchParams.get('data.id') || dataId))) return json({ ok: false, error: 'assinatura inválida' }, 401);
  let pay;
  try {
    pay = normalizePayment(await mp(env, '/v1/payments/' + encodeURIComponent(dataId)));
  } catch (err) {
    if (err.status === 404 || err.status === 400) return json({ ok: true, unknown: true });
    throw err;
  }
  const order = pay.ref ? await getOrder(env, pay.ref) : null;
  if (!order || order.kind !== 'card') return json({ ok: true, unknown: true });
  /* cartão aprovado depois que o pedido foi cancelado/venceu (ex.: a aba do Mercado Pago ficou aberta):
     o dinheiro entrou, então o pedido vai para conferência e a loja é avisada (entregar ou devolver o valor no MP) */
  if ((order.status === 'canceled' || order.status === 'expired') && pay.state === 'paid' && order.latePaymentId !== String(pay.id)) {
    order.status = 'review';
    order.latePaymentId = String(pay.id);
    order.paymentId = pay.id;
    order.reviewReason = 'Cartão aprovado (R$ ' + (pay.amountCents / 100).toFixed(2) + ') depois que o pedido foi cancelado. Confira o estoque e entregue, ou devolva o valor no Mercado Pago.';
    order.notified = await notifyStore(env, order);
    order.pushed = await notifyAdmins(env, pushMessage(order));
    await saveOrder(env, order);
    return json({ ok: true, status: order.status });
  }
  if (order.status !== 'pending') return json({ ok: true, status: order.status });
  if (pay.state !== 'paid') return json({ ok: true, status: 'pending' });
  const result = await syncPayment(env, order, pay);
  return json({ ok: true, status: result.status });
}

async function webhook(request, env) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const type = body.type || url.searchParams.get('type') || url.searchParams.get('topic');
  const dataId = (body.data && body.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id');
  const expected = useOrdersApi(env) ? 'order' : 'payment';
  if (!env.MP_ACCESS_TOKEN) return json({ ok: true, ignored: 'Mercado Pago não configurado' });
  if (type === 'payment' && expected === 'order' && dataId) return cardWebhook(request, env, url, dataId);
  if (type !== expected || !dataId) return json({ ok: true, ignored: true });
  if (!(await validSignature(request, env, url.searchParams.get('data.id') || dataId))) return json({ ok: false, error: 'assinatura inválida' }, 401);

  let pay;
  try {
    pay = await readPix(env, dataId);
  } catch (err) {
    /* notificação de teste do painel do Mercado Pago (id inexistente): responde ok para não ficar reenviando */
    if (err.status === 404 || err.status === 400) return json({ ok: true, unknown: true });
    throw err; // falha temporária: o Mercado Pago tenta de novo
  }
  const id = pay.ref;
  const order = id ? await getOrder(env, id) : null;
  if (!order) return json({ ok: true, unknown: true });
  if (String(order.paymentId) !== pay.id) return json({ ok: true, mismatch: true });
  const result = await syncPayment(env, order, pay);
  return json({ ok: true, status: result.status });
}

/* Quem tem a chave do GitHub com permissão de escrita no repositório = dono da loja. */
async function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw new OrderError('Sem autorização.', 401);
  const check = await fetch('https://api.github.com/repos/' + env.GITHUB_REPO, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'akylla-shop-worker' }
  });
  const info = await check.json().catch(() => ({}));
  if (!check.ok || !info.permissions || !info.permissions.push) throw new OrderError('Chave sem permissão.', 403);
}

/* ------------------------- PIX manual com reserva ------------------------- */

async function rateLimit(env, request, limit, scope) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = (scope || 'rl') + ':' + ip + ':' + Math.floor(Date.now() / 3600000);
  const count = Number(await env.ORDERS.get(key)) || 0;
  if (count >= limit) throw new OrderError(scope === 'rlt' ? 'Muitas consultas seguidas. Tente de novo em alguns minutos.' : 'Muitos pedidos seguidos deste aparelho. Fale com a gente no WhatsApp.', 429);
  await env.ORDERS.put(key, String(count + 1), { expirationTtl: 3700 });
}

async function createManualOrder(request, env) {
  await rateLimit(env, request, Number(env.MANUAL_ORDERS_PER_HOUR) || 5);
  const body = await request.json().catch(() => null);
  if (!body) throw new OrderError('Pedido inválido.');
  const catalog = await loadCatalog(env, true);
  const now = Date.now();
  const built = buildLines({ products: catalog.products, config: catalog.config, items: body.items, reserved: {}, now: brazilNow(now) });
  const customer = cleanCustomer(body.customer);
  const shipping = await serverShipping(body.delivery, catalog.config);

  /* Usa o número que já está no PIX do cliente (txid), se for válido e inédito. */
  let id = /^AK-[A-Z0-9]{6,16}$/.test(String(body.orderId || '')) ? String(body.orderId) : newOrderId(now);
  if (await getOrder(env, id)) id = newOrderId(now);

  const hours = Math.max(1, Number(env.AUTO_CANCEL_HOURS) || 48);
  const order = {
    id,
    manual: true,
    status: 'awaiting',
    createdAt: now,
    autoCancelAt: now + hours * 3600 * 1000,
    lines: built.lines,
    subtotal: built.subtotal,
    savings: built.savings,
    shipping,
    total: built.subtotal + shipping.fee,
    customer,
    paymentId: ''
  };
  await commitStock(env, order, 'reserve');
  order.stockUpdated = true;
  order.notified = await notifyStore(env, order);
  order.pushed = await notifyAdmins(env, pushMessage(order));
  await saveOrder(env, order);
  return json(publicOrder(order), 201);
}

async function cancelManual(env, order, reason) {
  if (order.status !== 'awaiting') return order;
  order.cancelReason = reason;
  await commitStock(env, order, 'return');
  order.status = 'canceled';
  order.canceledAt = Date.now();
  await saveOrder(env, order);
  return order;
}

async function adminAction(request, env, id, action) {
  await requireAdmin(request, env);
  const order = await getOrder(env, id);
  if (!order) throw new OrderError('Pedido não encontrado.', 404);
  if (order.status !== 'awaiting') throw new OrderError('Este pedido já está ' + (order.status === 'paid' ? 'confirmado' : 'cancelado') + '.', 409);
  if (action === 'confirm') {
    order.status = 'paid';
    order.paidAt = Date.now();
    await saveOrder(env, order);
  } else {
    await cancelManual(env, order, 'cancelado no painel (pagamento não confirmado)');
  }
  return json(publicOrder(order));
}

/* Executado de hora em hora: pedidos sem confirmação há muito tempo voltam para o estoque. */
async function autoCancel(env) {
  const list = await env.ORDERS.list({ prefix: 'order:' });
  const now = Date.now();
  const hours = Math.max(1, Number(env.AUTO_CANCEL_HOURS) || 48);
  const due = list.keys.filter((k) => k.metadata && k.metadata.status === 'awaiting' && now - k.metadata.createdAt > hours * 3600 * 1000);
  for (const k of due) {
    const order = await env.ORDERS.get(k.name, 'json');
    if (order) await cancelManual(env, order, 'sem confirmação em ' + hours + ' h (cancelado automaticamente)').catch((err) => console.error(err));
  }
  /* pedidos online (PIX automático/cartão) parados: confere no Mercado Pago e encerra os vencidos */
  const stale = list.keys.filter((k) => k.metadata && k.metadata.status === 'pending' && now - k.metadata.createdAt > 75 * 60 * 1000);
  for (const k of stale) {
    const order = await env.ORDERS.get(k.name, 'json');
    if (order && env.MP_ACCESS_TOKEN) await syncPayment(env, order).catch((err) => console.error(err));
  }
  return due.length;
}

/* Painel: lista pedidos. */
async function adminOrders(request, env) {
  await requireAdmin(request, env);

  /* ?all=1 → todos os pedidos (dashboard); padrão → os 60 mais recentes (aba Pedidos). */
  const all = new URL(request.url).searchParams.get('all') === '1';
  let keysAll = [];
  let cursor;
  do {
    const page = await env.ORDERS.list({ prefix: 'order:', cursor });
    keysAll = keysAll.concat(page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && keysAll.length < 5000);
  const keys = keysAll
    .sort((a, b) => ((b.metadata && b.metadata.createdAt) || 0) - ((a.metadata && a.metadata.createdAt) || 0))
    .slice(0, all ? 5000 : 60);
  const orders = await Promise.all(keys.map((k) => env.ORDERS.get(k.name, 'json')));
  return json({ orders: orders.filter(Boolean).map((o) => ({ ...publicOrder(o), pix: undefined, email: o.email, customer: o.customer, notified: o.notified, stockUpdated: o.stockUpdated, stockError: o.stockError, stockWarnings: o.stockWarnings, reviewReason: o.reviewReason })) });
}

/* --------------------------------- roteador --------------------------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      let response;
      const match = url.pathname.match(/^\/api\/orders\/([A-Z0-9-]{6,40})(\/cancel)?$/);
      const admin = url.pathname.match(/^\/api\/admin\/orders\/([A-Z0-9-]{6,40})\/(confirm|cancel)$/);
      const stage = url.pathname.match(/^\/api\/admin\/orders\/([A-Z0-9-]{6,40})\/stage$/);
      if (url.pathname === '/api/health') response = json({ ok: true, repo: env.GITHUB_REPO, configured: !!env.GITHUB_TOKEN, manual: !!env.GITHUB_TOKEN, mercadopago: !!(env.MP_ACCESS_TOKEN && env.GITHUB_TOKEN), whatsappAlerts: !!env.CALLMEBOT_APIKEY, ...(url.searchParams.get('check') === 'mp' ? await mpCheck(env) : {}) });
      else if (url.pathname === '/api/manual-orders' && request.method === 'POST') response = await createManualOrder(request, env);
      else if (admin && request.method === 'POST') response = await adminAction(request, env, admin[1], admin[2]);
      else if (stage && request.method === 'POST') response = await adminStage(request, env, stage[1]);
      else if (url.pathname === '/api/card-orders' && request.method === 'POST') response = await createCardOrder(request, env);
      else if (url.pathname === '/api/track' && request.method === 'GET') response = await trackOrder(request, env);
      else if (url.pathname === '/api/track/cancel' && request.method === 'POST') response = await cancelTracked(request, env);
      else if (url.pathname === '/api/orders' && request.method === 'POST') response = await createOrder(request, env);
      else if (match && match[2] && request.method === 'POST') response = await cancelOrder(env, match[1]);
      else if (match && request.method === 'GET') response = await orderStatus(env, match[1]);
      else if (url.pathname === '/api/webhook' && request.method === 'POST') response = await webhook(request, env);
      else if (url.pathname === '/api/admin/orders' && request.method === 'GET') response = await adminOrders(request, env);
      else if (url.pathname === '/api/admin/orders/changes' && request.method === 'GET') {
        await requireAdmin(request, env);
        response = json((await env.ORDERS.get('meta:changed', 'json')) || { at: 0 });
      }
      else if (url.pathname === '/api/push/key' && request.method === 'GET') response = json({ publicKey: (await vapidKeys(env.ORDERS)).publicKey });
      else if (url.pathname === '/api/admin/push/subscribe' && request.method === 'POST') response = await pushSubscribe(request, env, false);
      else if (url.pathname === '/api/admin/push/unsubscribe' && request.method === 'POST') response = await pushSubscribe(request, env, true);
      else if (url.pathname === '/api/admin/push/test' && request.method === 'POST') response = await pushTest(request, env);
      else response = json({ error: 'Rota não encontrada.' }, 404);
      for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
      return response;
    } catch (err) {
      const status = err instanceof OrderError ? err.status : 500;
      const message = err instanceof OrderError ? err.message : 'Erro no servidor. Tente de novo em instantes.';
      if (!(err instanceof OrderError)) console.error(err);
      return json({ error: message }, status, cors);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(autoCancel(env));
  }
};

export { autoCancel, notifyAdmins, pushMessage };
