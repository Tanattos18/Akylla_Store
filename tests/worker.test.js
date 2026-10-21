/*
 * Testes do servidor de pagamentos (worker/) com Mercado Pago, GitHub e KV simulados.
 * Rode com: node --test "tests/*.test.js"
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var F = require('../admin/formato.js');

function kvMock() {
  var store = new Map();
  return {
    store: store,
    /* stale: imita a Cloudflare, onde outro servidor pode ler o pedido antigo por alguns segundos */
    stale: null,
    get: async function (k, type) { var v = (this.stale && this.stale.has(k)) ? this.stale.get(k) : store.get(k); if (!v) return null; return type === 'json' ? JSON.parse(v.value) : v.value; },
    put: async function (k, value, opts) { store.set(k, { value: value, metadata: opts && opts.metadata }); },
    delete: async function (k) { store.delete(k); },
    list: async function (opts) {
      return { keys: Array.from(store.entries()).filter(function (e) { return e[0].indexOf(opts.prefix) === 0; }).map(function (e) { return { name: e[0], metadata: e[1].metadata }; }) };
    }
  };
}

/* Cenário: GitHub com o catálogo real (estoque controlado), Mercado Pago simulado. */
function scenario() {
  var catalog = F.parseProducts(fs.readFileSync(path.join(ROOT, 'assets/js/products.js'), 'utf8'));
  var config = F.parseConfig(fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8'));
  config.promo = { active: true, text: 'Teste', percent: 10, until: '2099-12-31' };
  catalog.products.forEach(function (p) { p.stock = 2; });
  var files = {
    'assets/js/products.js': { text: F.serializeProducts(catalog.categories, catalog.products), sha: 'p1' },
    'assets/js/config.js': { text: F.serializeConfig(config), sha: 'c1' }
  };
  var payments = {};
  var commits = [];
  var nextPay = 1000;
  var notices = [];
  var b64 = function (t) { return Buffer.from(t, 'utf8').toString('base64'); };
  var res = function (data, status) { return Promise.resolve(new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } })); };

  var fakeFetch = function (url, opts) {
    opts = opts || {};
    var u = new URL(url);
    if (u.host === 'api.github.com') {
      if (/\/commits$/.test(u.pathname)) return res(commits.slice().reverse().map(function (m) { return { commit: { message: m } }; }));
      if (/^\/repos\/[^/]+\/[^/]+$/.test(u.pathname)) return res({ full_name: 'Tanattos18/Akylla_Store', permissions: { push: (opts.headers.Authorization || '') === 'Bearer gh-admin' || (opts.headers.Authorization || '') === 'Bearer gh-worker' } });
      var m = u.pathname.match(/\/contents\/(.+)$/);
      if (m && (!opts.method || opts.method === 'GET')) return res({ content: b64(files[m[1]].text), sha: files[m[1]].sha });
      if (m && opts.method === 'PUT') {
        var body = JSON.parse(opts.body);
        if (body.sha !== files[m[1]].sha) return res({ message: 'conflict' }, 409);
        files[m[1]] = { text: Buffer.from(body.content, 'base64').toString('utf8'), sha: 'p' + (commits.length + 2) };
        commits.push(body.message);
        return res({ content: { sha: files[m[1]].sha } });
      }
    }
    if (u.host === 'api.callmebot.com') { notices.push(u.searchParams.get('text')); return res({ ok: true }); }
    if (u.host === 'api.mercadopago.com') {
      if (u.pathname === '/v1/orders' && opts.method === 'POST') {
        var ob = JSON.parse(opts.body);
        var oid = 'ORD' + (nextPay++);
        payments[oid] = { id: oid, status: 'action_required', status_detail: 'waiting_transfer', total_amount: ob.total_amount, external_reference: ob.external_reference, request: ob };
        return res({ id: oid, status: 'action_required', transactions: { payments: [{ id: 'PAY' + oid, payment_method: { id: 'pix', type: 'bank_transfer', qr_code: '000201PIXMP' + oid, qr_code_base64: 'iVBOR', ticket_url: 'https://mp/t/' + oid } }] } }, 201);
      }
      var om = u.pathname.match(/^\/v1\/orders\/(ORD\d+)(\/cancel)?$/);
      if (om && om[2]) { payments[om[1]].status = 'canceled'; payments[om[1]].status_detail = 'canceled'; return res(payments[om[1]]); }
      if (om) return res(payments[om[1]]);
      if (u.pathname === '/v1/payments' && opts.method === 'POST') {
        var b = JSON.parse(opts.body);
        var id = nextPay++;
        payments[id] = { id: id, status: 'pending', transaction_amount: b.transaction_amount, external_reference: b.external_reference, request: b };
        return res({ id: id, status: 'pending', point_of_interaction: { transaction_data: { qr_code: '000201PIXMP' + id, qr_code_base64: 'iVBOR', ticket_url: 'https://mp/t/' + id } } }, 201);
      }
      var pm = u.pathname.match(/^\/v1\/payments\/(\d+)$/);
      if (pm && opts.method === 'PUT') { payments[pm[1]].status = JSON.parse(opts.body).status; return res(payments[pm[1]]); }
      if (pm) return res(payments[pm[1]]);
    }
    return Promise.reject(new Error('fetch inesperado: ' + url));
  };
  var env = {
    MP_ACCESS_TOKEN: 'mp-test', GITHUB_TOKEN: 'gh-worker', GITHUB_REPO: 'Tanattos18/Akylla_Store', GITHUB_BRANCH: 'main',
    ALLOWED_ORIGINS: 'https://akyllashop.com', PAYMENT_MINUTES: '30', ORDERS: kvMock(),
    CALLMEBOT_APIKEY: 'cmb-test', STORE_WHATSAPP: '556281517002'
  };
  return { env: env, fetch: fakeFetch, files: files, payments: payments, commits: commits, catalog: catalog, notices: notices };
}

async function call(worker, env, method, pathname, body, headers) {
  var res = await worker.fetch(new Request('https://api.test' + pathname, {
    method: method,
    headers: Object.assign({ 'Content-Type': 'application/json', Origin: 'https://akyllashop.com' }, headers || {}),
    body: body ? JSON.stringify(body) : undefined
  }), env);
  return { status: res.status, data: await res.json(), headers: res.headers };
}

test('servidor: compra completa — PIX do Mercado Pago, aprovação e baixa automática do estoque', async function () {
  var s = scenario();
  var realFetch = global.fetch;
  global.fetch = s.fetch;
  try {
    var worker = (await import('../worker/src/index.js')).default;
    var w34 = s.catalog.products.find(function (p) { return p.id === 'w34-plus'; });

    // o cliente tenta mandar preço falso: o servidor ignora e usa o catálogo
    var created = await call(worker, s.env, 'POST', '/api/orders', { items: [{ id: 'w34-plus', qty: 2, price: 1 }], delivery: { mode: 'pickup' }, customer: { name: 'Maria Teste', phone: '(62) 99999-0000' } });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    var order = created.data;
    var expectedUnit = Math.floor(Math.round(w34.price * 90) / 100 / 10) * 10;
    assert.equal(order.total, expectedUnit * 2, 'preço do servidor com 10% de promoção');
    assert.equal(s.payments[order.paymentId].total_amount, (order.total / 100).toFixed(2), 'valor enviado como texto com 2 casas');
    assert.equal(s.payments[order.paymentId].request.transactions.payments[0].payment_method.id, 'pix');
    assert.match(s.payments[order.paymentId].request.transactions.payments[0].expiration_time, /^PT\d+M$/);
    assert.ok(order.pix.code && order.pix.image, 'QR do Mercado Pago');
    assert.equal(created.headers.get('access-control-allow-origin'), 'https://akyllashop.com');

    // reserva: com 2 em estoque e 2 reservados, outro cliente não consegue comprar
    var second = await call(worker, s.env, 'POST', '/api/orders', { items: [{ id: 'w34-plus', qty: 1 }], delivery: { mode: 'pickup' }, customer: { name: 'Maria Teste', phone: '(62) 99999-0000' } });
    assert.equal(second.status, 409);
    assert.match(second.data.error, /esgotar|disponíve/);

    // ainda não pago
    var pending = await call(worker, s.env, 'GET', '/api/orders/' + order.id);
    assert.equal(pending.data.status, 'pending');

    // Mercado Pago aprova e avisa o servidor
    s.payments[order.paymentId].status = 'processed';
    s.payments[order.paymentId].status_detail = 'accredited';
    var hook = await call(worker, s.env, 'POST', '/api/webhook', { type: 'order', action: 'order.processed', data: { id: String(order.paymentId) } });
    assert.equal(hook.data.status, 'paid');
    assert.equal(s.notices.length, 1, 'aviso de venda enviado ao WhatsApp da loja');
    var notice = s.notices[0];
    ['NOVA VENDA', order.id, 'Maria Teste', '62999990000', 'cód. ' + w34.code, 'Retirada na loja', 'TOTAL PAGO', 'Data: '].forEach(function (part) {
      assert.ok(notice.indexOf(part) >= 0, 'mensagem sem: ' + part + ' | ' + notice);
    });
    var stock = F.parseProducts(s.files['assets/js/products.js'].text).products.find(function (p) { return p.id === 'w34-plus'; }).stock;
    assert.equal(stock, 0, 'estoque baixou de 2 para 0');
    assert.equal(s.commits.length, 1);
    assert.match(s.commits[0], /venda: pedido AK-/);

    // aviso repetido não baixa o estoque de novo
    await call(worker, s.env, 'POST', '/api/webhook', { type: 'order', action: 'order.processed', data: { id: String(order.paymentId) } });
    assert.equal(s.commits.length, 1, 'idempotente');

    var paid = await call(worker, s.env, 'GET', '/api/orders/' + order.id);
    assert.equal(paid.data.status, 'paid');
    assert.equal(paid.data.pix, undefined, 'QR não é mais exposto depois de pago');

    // painel: lista de pedidos exige a chave do GitHub com permissão
    assert.equal((await call(worker, s.env, 'GET', '/api/admin/orders')).status, 401);
    var admin = await call(worker, s.env, 'GET', '/api/admin/orders', null, { Authorization: 'Bearer gh-admin' });
    assert.equal(admin.data.orders.length, 1);
    assert.equal(admin.data.orders[0].stockUpdated, true);
  } finally {
    global.fetch = realFetch;
  }
});

test('servidor: pagamento com valor diferente vai para revisão e não baixa estoque; cancelamento libera a reserva', async function () {
  var s = scenario();
  var realFetch = global.fetch;
  global.fetch = s.fetch;
  try {
    var worker = (await import('../worker/src/index.js')).default;
    var a = (await call(worker, s.env, 'POST', '/api/orders', { items: [{ id: 'hw8-pro-max', qty: 1 }], delivery: { mode: 'pickup' }, customer: { name: 'Maria Teste', phone: '(62) 99999-0000' } })).data;
    s.payments[a.paymentId].status = 'processed';
    s.payments[a.paymentId].status_detail = 'accredited';
    s.payments[a.paymentId].total_amount = '1.00';
    var hook = await call(worker, s.env, 'POST', '/api/webhook', { type: 'order', data: { id: String(a.paymentId) } });
    assert.equal(hook.data.status, 'review');
    assert.equal(s.commits.length, 0);

    var b = (await call(worker, s.env, 'POST', '/api/orders', { items: [{ id: 'w69-ultra', qty: 2 }], delivery: { mode: 'pickup' }, customer: { name: 'Maria Teste', phone: '(62) 99999-0000' } })).data;
    var cancel = await call(worker, s.env, 'POST', '/api/orders/' + b.id + '/cancel');
    assert.equal(cancel.data.status, 'expired');
    assert.equal(s.payments[b.paymentId].status, 'canceled');
    var again = await call(worker, s.env, 'POST', '/api/orders', { items: [{ id: 'w69-ultra', qty: 2 }], delivery: { mode: 'pickup' }, customer: { name: 'Maria Teste', phone: '(62) 99999-0000' } });
    assert.equal(again.status, 201, 'reserva liberada após cancelamento');

    var bad = await call(worker, s.env, 'POST', '/api/orders', { items: [{ id: 'nao-existe', qty: 1 }], delivery: { mode: 'pickup' }, customer: { name: 'Maria Teste', phone: '(62) 99999-0000' } });
    assert.equal(bad.status, 409);
    var noName = await call(worker, s.env, 'POST', '/api/orders', { items: [{ id: 'w31-pro-max', qty: 1 }], delivery: { mode: 'pickup' } });
    assert.equal(noName.status, 400);
    assert.match(noName.data.error, /nome/);
    var noDelivery = await call(worker, s.env, 'POST', '/api/orders', { items: [{ id: 'w31-pro-max', qty: 1 }], customer: { name: 'Ana Lima' } });
    assert.equal(noDelivery.status, 400);
  } finally {
    global.fetch = realFetch;
  }
});

test('PIX manual: reserva baixa o estoque, painel confirma ou cancela (devolve), automático em 48 h', async function () {
  var s = scenario();
  var realFetch = global.fetch;
  global.fetch = s.fetch;
  var stockOf = function (id) { return F.parseProducts(s.files['assets/js/products.js'].text).products.find(function (p) { return p.id === id; }).stock; };
  try {
    var mod = await import('../worker/src/index.js');
    var worker = mod.default;
    var cust = { name: 'Joana Cliente', phone: '62988887777' };

    // 1) pedido registrado ao enviar o comprovante: estoque baixa na hora (2 → 1)
    var a = await call(worker, s.env, 'POST', '/api/manual-orders', { orderId: 'AK-MANUAL001', items: [{ id: 'w34-plus', qty: 1 }], delivery: { mode: 'pickup' }, customer: cust });
    assert.equal(a.status, 201, JSON.stringify(a.data));
    assert.equal(a.data.id, 'AK-MANUAL001', 'usa o número do PIX do cliente');
    assert.equal(a.data.status, 'awaiting');
    assert.equal(stockOf('w34-plus'), 1);
    assert.match(s.commits[0], /^reserva: pedido AK-MANUAL001/);
    assert.ok(s.notices[0].indexOf('PIX A CONFERIR') >= 0 && s.notices[0].indexOf('Joana Cliente') >= 0, 'alerta para a loja');

    // 2) pedido acima do estoque é recusado
    var tooMuch = await call(worker, s.env, 'POST', '/api/manual-orders', { items: [{ id: 'w34-plus', qty: 2 }], delivery: { mode: 'pickup' }, customer: cust });
    assert.equal(tooMuch.status, 409);

    // 3) só o dono (chave do GitHub com permissão) confirma/cancela
    assert.equal((await call(worker, s.env, 'POST', '/api/admin/orders/AK-MANUAL001/confirm')).status, 401);
    var ok = await call(worker, s.env, 'POST', '/api/admin/orders/AK-MANUAL001/confirm', null, { Authorization: 'Bearer gh-admin' });
    assert.equal(ok.data.status, 'paid');
    assert.equal(stockOf('w34-plus'), 1, 'confirmado: a baixa continua');
    var again = await call(worker, s.env, 'POST', '/api/admin/orders/AK-MANUAL001/cancel', null, { Authorization: 'Bearer gh-admin' });
    assert.equal(again.status, 409, 'pedido confirmado não pode ser cancelado por engano');

    // 4) cancelado no painel: estoque volta
    var b = (await call(worker, s.env, 'POST', '/api/manual-orders', { items: [{ id: 'hw8-pro-max', qty: 2 }], delivery: { mode: 'pickup' }, customer: cust })).data;
    assert.equal(stockOf('hw8-pro-max'), 0);
    var canceled = await call(worker, s.env, 'POST', '/api/admin/orders/' + b.id + '/cancel', null, { Authorization: 'Bearer gh-admin' });
    assert.equal(canceled.data.status, 'canceled');
    assert.equal(stockOf('hw8-pro-max'), 2, 'cancelado: estoque devolvido');
    assert.ok(s.commits.some(function (m) { return /^estoque devolvido: pedido /.test(m); }));

    // 5) sem confirmação em 48 h: cancela sozinho e devolve
    var c = (await call(worker, s.env, 'POST', '/api/manual-orders', { items: [{ id: 'w69-ultra', qty: 1 }], delivery: { mode: 'pickup' }, customer: cust })).data;
    assert.equal(stockOf('w69-ultra'), 1);
    var entry = s.env.ORDERS.store.get('order:' + c.id);
    entry.metadata.createdAt -= 49 * 3600 * 1000;
    assert.equal(await mod.autoCancel(s.env), 1);
    assert.equal(stockOf('w69-ultra'), 2);
    assert.equal((await s.env.ORDERS.get('order:' + c.id, 'json')).status, 'canceled');

    // 6) limite de pedidos por aparelho (5 por hora)
    var last;
    for (var i = 0; i < 3; i += 1) last = await call(worker, s.env, 'POST', '/api/manual-orders', { items: [{ id: 'w31-pro-max', qty: 1 }], delivery: { mode: 'pickup' }, customer: cust });
    assert.equal(last.status, 429);
  } finally {
    global.fetch = realFetch;
  }
});

/* ------------------------- avisos push do painel ------------------------- */

/* Faz o papel do navegador: descriptografa a mensagem (RFC 8291) com a chave do aparelho. */
async function browserDecrypt(body, uaPair, authSecret) {
  var subtle = globalThis.crypto.subtle;
  var salt = body.slice(0, 16);
  var idlen = body[20];
  var asPublic = body.slice(21, 21 + idlen);
  var cipher = body.slice(21 + idlen);
  var hm = async function (key, data) {
    var k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await subtle.sign('HMAC', k, data));
  };
  var cat = function () { return Uint8Array.from(Buffer.concat(Array.from(arguments).map(function (a) { return Buffer.from(a); }))); };
  var te = new TextEncoder();
  var uaPublic = new Uint8Array(await subtle.exportKey('raw', uaPair.publicKey));
  var asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  var shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPair.privateKey, 256));
  var ikm = await hm(await hm(authSecret, shared), cat(te.encode('WebPush: info\0'), uaPublic, asPublic, [1]));
  var prk = await hm(salt, ikm);
  var cek = (await hm(prk, cat(te.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
  var nonce = (await hm(prk, cat(te.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
  var aes = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  var plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, cipher));
  assert.equal(plain[plain.length - 1], 2, 'delimitador do último registro');
  return JSON.parse(new TextDecoder().decode(plain.slice(0, -1)));
}

test('avisos push: aparelho cadastrado recebe o pedido novo, criptografado e assinado (VAPID)', async function () {
  var s = scenario();
  var push = await import('../worker/src/push.js');
  var subtle = globalThis.crypto.subtle;
  var uaPair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  var authSecret = globalThis.crypto.getRandomValues(new Uint8Array(16));
  var subscription = { endpoint: 'https://push.test/send/abc', keys: { p256dh: push.b64url(await subtle.exportKey('raw', uaPair.publicKey)), auth: push.b64url(authSecret) } };
  var delivered = [];
  var gone = false;
  var realFetch = global.fetch;
  global.fetch = function (url, opts) {
    if (String(url).indexOf('https://push.test/') === 0) {
      delivered.push({ url: url, opts: opts });
      return Promise.resolve(new Response(null, { status: gone ? 410 : 201 }));
    }
    return s.fetch(url, opts);
  };
  try {
    var worker = (await import('../worker/src/index.js')).default;
    var key = await call(worker, s.env, 'GET', '/api/push/key');
    assert.equal(push.fromB64url(key.data.publicKey).length, 65, 'chave pública P-256');

    var denied = await call(worker, s.env, 'POST', '/api/admin/push/subscribe', { subscription: subscription }, { Authorization: 'Bearer outro' });
    assert.equal(denied.status, 403, 'só o dono da loja cadastra aparelhos');
    var ok = await call(worker, s.env, 'POST', '/api/admin/push/subscribe', { subscription: subscription, label: 'Celular' }, { Authorization: 'Bearer gh-admin' });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));

    var created = await call(worker, s.env, 'POST', '/api/manual-orders', { items: [{ id: 'w34-plus', qty: 1 }], delivery: { mode: 'pickup' }, customer: { name: 'Ana Push', phone: '62999990000' } });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal(delivered.length, 1, 'aviso enviado ao aparelho');
    var changes = await call(worker, s.env, 'GET', '/api/admin/orders/changes', null, { Authorization: 'Bearer gh-admin' });
    assert.equal(changes.data.id, created.data.id, 'marcador de mudança aponta o pedido novo');
    assert.equal((await call(worker, s.env, 'GET', '/api/admin/orders/changes', null, { Authorization: 'Bearer outro' })).status, 403);

    var h = delivered[0].opts.headers;
    assert.equal(h['Content-Encoding'], 'aes128gcm');
    var m = h.Authorization.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
    assert.ok(m, 'cabeçalho VAPID');
    assert.equal(m[4], key.data.publicKey);
    var claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
    assert.equal(claims.aud, 'https://push.test');
    var vapidPub = await subtle.importKey('raw', push.fromB64url(m[4]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vapidPub, push.fromB64url(m[3]), new TextEncoder().encode(m[1] + '.' + m[2])), 'assinatura VAPID válida');

    var msg = await browserDecrypt(new Uint8Array(delivered[0].opts.body), uaPair, authSecret);
    assert.match(msg.title, new RegExp('Novo pedido ' + created.data.id));
    assert.match(msg.body, /Ana Push · 1 item · R\$ \d+,\d{2} — aguardando confirmação do PIX/);
    assert.equal(msg.url, '/admin/#pedidos');

    // aparelho desinstalado (410): o servidor apaga a assinatura
    gone = true;
    var t = await call(worker, s.env, 'POST', '/api/admin/push/test', {}, { Authorization: 'Bearer gh-admin' });
    assert.equal(t.data.sent, 0);
    assert.equal((await s.env.ORDERS.list({ prefix: 'push:' })).keys.length, 0, 'assinatura removida');
  } finally {
    global.fetch = realFetch;
  }
});

test('servidor: aviso do Mercado Pago repetido + consulta do site ao mesmo tempo baixam o estoque UMA vez só', async function () {
  var s = scenario();
  var realFetch = global.fetch;
  global.fetch = s.fetch;
  try {
    var worker = (await import('../worker/src/index.js')).default;
    var created = await call(worker, s.env, 'POST', '/api/orders', { items: [{ id: 'w69-ultra', qty: 1 }], delivery: { mode: 'pickup' }, customer: { name: 'Teste Duplo', phone: '62999990000' } });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    var order = created.data;
    s.payments[order.paymentId].status = 'processed';
    s.payments[order.paymentId].status_detail = 'accredited';
    var hook = { type: 'order', action: 'order.processed', data: { id: String(order.paymentId) } };
    s.env.ORDERS.stale = new Map([['order:' + order.id, s.env.ORDERS.store.get('order:' + order.id)]]); // todos leem 'pendente'
    // o Mercado Pago manda o aviso duas vezes e o site consulta junto — tudo ao mesmo tempo
    var results = await Promise.all([
      call(worker, s.env, 'POST', '/api/webhook', hook),
      call(worker, s.env, 'POST', '/api/webhook', hook),
      call(worker, s.env, 'GET', '/api/orders/' + order.id)
    ]);
    results.forEach(function (r) { assert.equal(r.status, 200, JSON.stringify(r.data)); });
    var sales = s.commits.filter(function (m) { return m.indexOf('venda: pedido ' + order.id + ' (') === 0; });
    assert.equal(sales.length, 1, 'um único commit de venda: ' + JSON.stringify(s.commits));
    var stock = F.parseProducts(s.files['assets/js/products.js'].text).products.find(function (p) { return p.id === 'w69-ultra'; }).stock;
    assert.equal(stock, 1, 'estoque 2 → 1 (não 0)');
    var paidNotices = s.notices.filter(function (n) { return n.indexOf(order.id) >= 0; });
    assert.equal(paidNotices.length, 1, 'um único aviso de venda no WhatsApp');
  } finally {
    global.fetch = realFetch;
  }
});
