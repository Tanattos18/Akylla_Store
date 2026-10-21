/*
 * Acompanhar pedido (pedido.html): o cliente informa o número do pedido e o WhatsApp da compra.
 * O servidor confere o WhatsApp e devolve só a situação, os itens e o total (sem endereço nem telefone).
 * Também recebe a volta da página de pagamento do cartão (Mercado Pago → pedido.html?id=AK-…).
 */
(function () {
  'use strict';

  var CONFIG = window.AKYLLA_CONFIG || {};
  var MY_ORDERS_KEY = 'akylla-my-orders';
  var CUSTOMER_KEY = 'akylla-customer';
  var CARD_PENDING_KEY = 'akylla-card-pending';
  var CART_KEY = 'akylla-cart-v1';
  var api = String(CONFIG.paymentApiUrl || '').replace(/\/+$/, '');
  var $ = function (id) { return document.getElementById(id); };
  var pollTimer = null;
  var pageOpenedAt = Date.now();
  var current = null;

  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* sem armazenamento */ }
  }

  function brl(cents) {
    return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function when(ms) {
    return ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  }
  function text(tag, value, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    n.textContent = value;
    return n;
  }

  function phoneFor(id) {
    var mine = read(MY_ORDERS_KEY, []).find(function (o) { return o.id === id; });
    if (mine && mine.phone) return mine.phone;
    var c = read(CUSTOMER_KEY, {});
    return c.phone || '';
  }

  function renderMine() {
    var mine = read(MY_ORDERS_KEY, []);
    $('trackMine').hidden = !mine.length;
    var list = $('mineList');
    list.innerHTML = '';
    mine.slice(0, 8).forEach(function (o) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'track-mine-item';
      btn.appendChild(text('strong', o.id));
      btn.appendChild(text('span', (o.total ? brl(o.total) + ' · ' : '') + when(o.at)));
      btn.addEventListener('click', function () { $('trackId').value = o.id; $('trackPhone').value = o.phone || ''; search(); });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  var STAGE_LABEL = {
    separando: 'Separando o pedido',
    pronto: 'Pronto para retirada',
    enviado: 'Saiu para entrega',
    entregue: 'Entregue'
  };

  function describe(o) {
    var pickup = o.delivery && o.delivery.mode === 'pickup';
    if (o.status === 'paid') {
      if (o.stage === 'entregue') return ['✅', 'Pedido entregue', 'Obrigado pela compra! Qualquer dúvida, fale com a gente no WhatsApp.'];
      if (o.stage === 'pronto') return ['🏪', 'Pronto para retirada', 'Seu pedido já está separado. Combine o horário da retirada pelo WhatsApp.'];
      if (o.stage === 'enviado') return ['🚚', 'Saiu para entrega', 'Seu pedido está a caminho.'];
      return ['📦', 'Pagamento confirmado', 'Estamos separando o seu pedido. Avisamos pelo WhatsApp quando estiver ' + (pickup ? 'pronto para retirada.' : 'saindo para entrega.')];
    }
    if (o.status === 'awaiting') return ['🧾', 'Recebemos o seu pedido', 'Estamos conferindo o pagamento do PIX. O produto já está separado para você.'];
    if (o.status === 'pending') return o.kind === 'card'
      ? ['💳', 'Aguardando o pagamento no cartão', 'Se você já pagou, a confirmação do Mercado Pago chega em instantes. Esta página atualiza sozinha.']
      : ['⏳', 'Aguardando o pagamento', 'Assim que o pagamento for confirmado, o pedido segue para separação.'];
    if (o.status === 'review') return ['🔎', 'Pagamento em conferência', 'Recebemos um pagamento que precisa de conferência. Fale com a gente no WhatsApp.'];
    if (/cliente/.test(o.cancelReason || '')) return ['✖️', 'Pedido cancelado', 'Você cancelou este pedido e os produtos voltaram para a loja. Quando quiser, é só fazer um novo pedido.'];
    return ['✖️', 'Pedido cancelado', o.kind === 'card' ? 'O pagamento não foi concluído e o pedido foi cancelado. Você pode fazer um novo pedido na loja.' : 'Este pedido foi cancelado. Se tiver dúvida, fale com a gente no WhatsApp.'];
  }

  function steps(o) {
    var pickup = o.delivery && o.delivery.mode === 'pickup';
    var at = o.stageAt || {};
    var paid = o.status === 'paid';
    var order = ['separando', pickup ? 'pronto' : 'enviado', 'entregue'];
    var reached = paid ? Math.max(0, order.indexOf(o.stage || 'separando')) : -1;
    if (paid && o.stage === 'pronto' && !pickup) reached = 1;
    return [
      ['Pedido recebido', when(o.createdAt), true],
      ['Pagamento confirmado', when(o.paidAt), paid],
      [STAGE_LABEL.separando, when(at.separando), paid && reached >= 0],
      [pickup ? STAGE_LABEL.pronto : STAGE_LABEL.enviado, when(at[order[1]]), paid && reached >= 1],
      [STAGE_LABEL.entregue, when(at.entregue), paid && reached >= 2]
    ];
  }

  function render(o) {
    current = o;
    var d = describe(o);
    $('trackResult').hidden = false;
    $('trackStatus').className = 'track-status is-' + (o.status === 'paid' ? 'paid' : o.status === 'canceled' || o.status === 'expired' ? 'canceled' : 'waiting');
    $('trackIco').textContent = d[0];
    $('trackOrderId').textContent = 'Pedido ' + o.id + (o.firstName ? ' · ' + o.firstName : '');
    $('trackHeadline').textContent = d[1];
    $('trackText').textContent = d[2];

    /* pagamento online aberto: concluir (volta ao Mercado Pago) ou cancelar */
    $('trackPending').hidden = !o.canCancel;
    if (o.canCancel) {
      $('trackResume').hidden = !o.checkoutUrl;
      $('trackPix').hidden = o.kind !== 'card';
      if (o.checkoutUrl) $('trackResume').href = o.checkoutUrl;
      $('trackPendingNote').textContent = 'Ainda não recebemos o pagamento. O produto fica reservado para você até ' +
        new Date(o.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '; depois disso o pedido é cancelado sozinho.';
    }
    if (o.status !== 'pending' && read(CARD_PENDING_KEY, '') === o.id && o.status !== 'paid') {
      try { localStorage.removeItem(CARD_PENDING_KEY); } catch (e) { /* ok */ }
    }

    var ol = $('trackSteps');
    ol.innerHTML = '';
    if (o.status !== 'canceled' && o.status !== 'expired') {
      steps(o).forEach(function (s) {
        var li = document.createElement('li');
        li.className = s[2] ? 'is-done' : '';
        li.appendChild(text('strong', s[0]));
        if (s[2] && s[1]) li.appendChild(text('span', s[1]));
        ol.appendChild(li);
      });
    }

    var lines = $('trackLines');
    lines.innerHTML = '';
    (o.lines || []).forEach(function (l) { lines.appendChild(text('li', l.qty + 'x ' + l.name)); });
    $('trackTotal').textContent = brl(o.total);
    var pay = o.kind === 'card' ? 'Cartão de crédito' + (o.installments > 1 ? ' em ' + o.installments + 'x' : '') : 'PIX';
    var place = o.delivery && o.delivery.mode === 'pickup' ? 'Retirada na loja' : 'Entrega' + (o.delivery && o.delivery.area ? ' · ' + o.delivery.area : '');
    $('trackMeta').textContent = pay + ' · ' + place;

    var msg = 'Olá! Quero falar sobre o meu pedido ' + o.id + ' na Akylla Shop.';
    $('trackWhats').href = 'https://wa.me/' + String(CONFIG.whatsapp || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);

    /* voltou do cartão e o pagamento foi aprovado: esvazia a sacola deste aparelho */
    if (o.status === 'paid' && read(CARD_PENDING_KEY, '') === o.id) {
      write(CART_KEY, []);
      try { localStorage.removeItem(CARD_PENDING_KEY); } catch (e) { /* ok */ }
    }

    clearTimeout(pollTimer);
    if (o.status === 'pending' || o.status === 'awaiting') {
      /* logo depois de voltar do pagamento: a cada 5 s por 3 min; depois a cada 30 s; para quando a reserva vence */
      var fresh = Date.now() - pageOpenedAt < 3 * 60000;
      var open = o.status === 'awaiting' || !o.expiresAt || Date.now() < o.expiresAt + 5 * 60000;
      if (open) pollTimer = setTimeout(function () { search(true); }, o.status === 'pending' && fresh ? 5000 : 30000);
    }
  }

  function cancelOrder() {
    if (!current) return;
    if (!window.confirm('Cancelar o pedido ' + current.id + '? Os produtos voltam para a loja.')) return;
    $('trackCancel').disabled = true;
    fetch(api + '/api/track/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: current.id, phone: $('trackPhone').value.trim() })
    })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { if (!res.ok) throw new Error(d.error || 'Erro ' + res.status); return d; }); })
      .then(function (o) { fail(''); render(o); })
      .catch(function (err) { fail(err.message); })
      .finally(function () { $('trackCancel').disabled = false; });
  }

  /* Desiste do cartão e paga no PIX: cancela este pedido (devolve a reserva), garante os itens na sacola e abre o checkout da loja. */
  function switchToPix() {
    if (!current) return;
    if (!window.confirm('Trocar para PIX? Este pedido no cartão será cancelado e você finaliza de novo na loja, já com os produtos na sacola (no PIX sai mais barato).')) return;
    $('trackPix').disabled = true;
    var lines = current.lines || [];
    fetch(api + '/api/track/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: current.id, phone: $('trackPhone').value.trim() })
    })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { if (!res.ok) throw new Error(d.error || 'Erro ' + res.status); return d; }); })
      .then(function (o) {
        if (o.status === 'paid') { render(o); fail('Este pedido já foi pago no cartão — não precisa pagar de novo.'); return; }
        try { localStorage.removeItem(CARD_PENDING_KEY); } catch (e) { /* ok */ }
        var cart = read(CART_KEY, []);
        if (!cart.length) write(CART_KEY, lines.filter(function (l) { return l.id; }).map(function (l) { return { id: l.id, qty: l.qty }; }));
        location.href = 'index.html?pagar=pix';
      })
      .catch(function (err) { fail(err.message); $('trackPix').disabled = false; });
  }

  function fail(message) {
    $('trackError').textContent = message;
    $('trackError').hidden = !message;
  }

  function search(silent) {
    var id = $('trackId').value.trim().toUpperCase();
    var phone = $('trackPhone').value.trim();
    if (!/^AK-[A-Z0-9]{6,16}$/.test(id)) { fail('Digite o número do pedido completo, começando com AK-.'); return; }
    if (!api) { fail('Acompanhamento indisponível no momento. Fale com a gente no WhatsApp.'); return; }
    if (!silent) { fail(''); $('trackBtn').disabled = true; $('trackBtn').textContent = 'Buscando…'; }
    fetch(api + '/api/track?id=' + encodeURIComponent(id) + '&phone=' + encodeURIComponent(phone), { cache: 'no-store' })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { if (!res.ok) throw new Error(d.error || 'Erro ' + res.status); return d; }); })
      .then(function (o) {
        fail('');
        render(o);
        var mine = read(MY_ORDERS_KEY, []);
        if (!mine.some(function (m) { return m.id === o.id; })) {
          mine.unshift({ id: o.id, phone: phone, total: o.total, at: o.createdAt });
          write(MY_ORDERS_KEY, mine.slice(0, 10));
          renderMine();
        }
        if (history.replaceState) history.replaceState(null, '', 'pedido.html?id=' + encodeURIComponent(o.id));
      })
      .catch(function (err) { if (!silent) { $('trackResult').hidden = true; fail(err.message); } })
      .finally(function () { $('trackBtn').disabled = false; $('trackBtn').textContent = 'Ver pedido'; });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) { el.textContent = String(CONFIG.year || new Date().getFullYear()); });
    renderMine();
    $('trackForm').addEventListener('submit', function (e) { e.preventDefault(); search(); });
    $('trackRefresh').addEventListener('click', function () { search(); });
    $('trackCancel').addEventListener('click', cancelOrder);
    $('trackPix').addEventListener('click', switchToPix);
    /* vindo do checkout da loja: abre o Mercado Pago a partir daqui, para a seta "voltar" cair nesta página */
    var go = '';
    try { go = sessionStorage.getItem('akylla-go') || ''; sessionStorage.removeItem('akylla-go'); } catch (e) { /* ok */ }
    if (go && /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?\//.test(go)) {
      setTimeout(function () { location.href = go; }, 50);
    }
    /* voltou do Mercado Pago pela seta do navegador: atualiza a situação */
    window.addEventListener('pageshow', function (e) { if (e.persisted && $('trackId').value) search(true); });
    var id = new URLSearchParams(location.search).get('id');
    if (id) {
      $('trackId').value = id.toUpperCase();
      $('trackPhone').value = phoneFor(id.toUpperCase());
      search();
    } else {
      $('trackPhone').value = read(CUSTOMER_KEY, {}).phone || '';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
