/*
 * Minha conta (opcional, sem senha): "Entrar com Google" ou código de 6 números no e-mail.
 * - O botão do topo só aparece quando o servidor confirma que o login está configurado.
 * - Logado: o checkout já vem preenchido (nome, WhatsApp, e-mail, CEP/número) e cada pedido
 *   entra em "Meus pedidos" da conta (app.js manda a sessão junto com o pedido).
 * - A sessão é um token aleatório guardado só neste aparelho (localStorage).
 */
(function () {
  'use strict';

  var CONFIG = window.AKYLLA_CONFIG || {};
  var api = String(CONFIG.paymentApiUrl || '').replace(/\/+$/, '');
  var SESSION_KEY = 'akylla-session';
  var CUSTOMER_KEY = 'akylla-customer';
  var CFG_KEY = 'akylla-auth-cfg';

  var state = { cfg: null, session: '', account: null, orders: [], email: '' };

  function $(id) { return document.getElementById(id); }
  function read(key, store) {
    try { return (store || window.localStorage).getItem(key) || ''; } catch (e) { return ''; }
  }
  function write(key, value, store) {
    try {
      if (value) (store || window.localStorage).setItem(key, value);
      else (store || window.localStorage).removeItem(key);
    } catch (e) { /* sem armazenamento: a conta vale só nesta aba */ }
  }

  state.session = /^[0-9a-f]{64}$/.test(read(SESSION_KEY)) ? read(SESSION_KEY) : '';

  window.AkyllaConta = {
    session: function () { return state.session; },
    account: function () { return state.account; }
  };

  function request(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (state.session) headers.Authorization = 'Bearer ' + state.session;
    return fetch(api + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || 'Não foi possível concluir agora. Tente de novo.');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    }, function () {
      throw new Error('Sem conexão com a loja. Confira sua internet e tente de novo.');
    });
  }

  function show(el, on) { if (el) el.hidden = !on; }
  function message(el, text, ok) {
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || '';
    el.classList.toggle('is-ok', !!ok);
  }
  function busy(button, on, label) {
    if (!button) return;
    if (on) { button.dataset.label = button.textContent; button.textContent = label; }
    else if (button.dataset.label) button.textContent = button.dataset.label;
    button.disabled = !!on;
  }

  function formatPhone(d) {
    d = String(d || '').replace(/\D/g, '');
    if (d.length === 13 && d.indexOf('55') === 0) d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return d;
  }
  function formatCep(d) {
    d = String(d || '').replace(/\D/g, '').slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  }
  function brl(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
  }
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

  /* --------------------------- topo e checkout --------------------------- */

  function renderHeader() {
    var label = $('accountLabel');
    var btn = $('accountOpen');
    if (!btn || !label) return;
    var name = state.account ? firstName(state.account.name) : '';
    label.textContent = state.account ? (name ? 'Olá, ' + name : 'Minha conta') : 'Entrar';
    btn.classList.toggle('is-logged', !!state.account);
    btn.setAttribute('aria-label', state.account ? 'Minha conta' : 'Entrar ou criar conta');
  }

  /* Preenche só campos vazios: nunca apaga o que o cliente digitou. */
  function fillCheckout() {
    var a = state.account;
    if (!a) return;
    var addr = a.address || {};
    [
      ['mpName', a.name], ['manualName', a.name],
      ['mpPhone', formatPhone(a.phone)], ['manualPhone', formatPhone(a.phone)],
      ['mpEmail', a.email], ['manualEmail', a.email],
      ['deliveryCep', formatCep(addr.cep)], ['deliveryNumber', addr.number], ['deliveryComplement', addr.complement]
    ].forEach(function (pair) {
      var el = $(pair[0]);
      if (el && !el.value && pair[1]) el.value = pair[1];
    });
    /* "Meus pedidos" (pedido.html) usa o WhatsApp salvo para abrir o pedido direto */
    if (a.phone) {
      try {
        var c = JSON.parse(read(CUSTOMER_KEY) || '{}');
        if (!c.phone) {
          c.phone = formatPhone(a.phone);
          c.name = c.name || a.name || '';
          c.email = c.email || a.email || '';
          write(CUSTOMER_KEY, JSON.stringify(c));
        }
      } catch (e) { /* ok */ }
    }
  }

  /* --------------------------------- janela --------------------------------- */

  function openAccount() {
    var dialog = $('accountDialog');
    if (!dialog) return;
    render();
    if (window.AkyllaUI) window.AkyllaUI.openDialog(dialog);
    else if (dialog.showModal) dialog.showModal();
    if (state.account) refresh();
  }

  function render() {
    var logged = !!state.account;
    show($('accountLogin'), !logged);
    show($('accountPanel'), logged);
    if (logged) renderPanel();
    else renderLogin();
  }

  function renderLogin() {
    var cfg = state.cfg || {};
    show($('googleWrap'), !!cfg.google);
    show($('accountOr'), !!cfg.google && !!cfg.email);
    var codeStep = !!state.email;
    show($('emailForm'), !!cfg.email && !codeStep);
    show($('codeForm'), !!cfg.email && codeStep);
    message($('loginMsg'), '');
    if (cfg.google) loadGoogle();
  }

  function renderPanel() {
    var a = state.account;
    var name = firstName(a.name);
    $('accountHello').textContent = name ? 'Olá, ' + name + '!' : 'Olá!';
    $('accountEmail').textContent = 'Conectado como ' + a.email + (a.via === 'google' ? ' (Google)' : '');
    $('profileName').value = a.name || '';
    $('profilePhone').value = formatPhone(a.phone);
    $('profileCep').value = formatCep((a.address || {}).cep);
    $('profileNumber').value = (a.address || {}).number || '';
    $('profileComplement').value = (a.address || {}).complement || '';
    $('profileOptIn').checked = !!a.optIn;
    message($('profileMsg'), '');
    renderOrders();
  }

  var STATUS = {
    pending: 'Aguardando pagamento', awaiting: 'Conferindo pagamento', review: 'Pagamento em conferência',
    paid: 'Pago', canceled: 'Cancelado', expired: 'Expirado'
  };
  var STAGE = { separando: 'Separando', pronto: 'Pronto para retirada', enviado: 'Saiu para entrega', entregue: 'Entregue' };

  function renderOrders() {
    var box = $('accountOrders');
    if (!box) return;
    box.textContent = '';
    if (!state.orders.length) {
      var p = document.createElement('p');
      p.className = 'account-empty';
      p.textContent = 'Os pedidos que você fizer com a conta aparecem aqui.';
      box.appendChild(p);
      return;
    }
    state.orders.forEach(function (o) {
      var a = document.createElement('a');
      a.className = 'account-order';
      a.href = 'pedido.html?id=' + encodeURIComponent(o.id);
      var status = o.status === 'paid' && o.stage ? STAGE[o.stage] || 'Pago' : STATUS[o.status] || o.status;
      var top = document.createElement('span');
      top.className = 'account-order-top';
      var id = document.createElement('strong');
      id.textContent = o.id;
      var badge = document.createElement('span');
      badge.className = 'account-order-status is-' + (o.status === 'paid' ? 'paid' : /canceled|expired/.test(o.status) ? 'canceled' : 'waiting');
      badge.textContent = status;
      top.appendChild(id);
      top.appendChild(badge);
      var items = document.createElement('span');
      items.className = 'account-order-items';
      items.textContent = (o.items || []).map(function (i) { return (i.qty > 1 ? i.qty + '× ' : '') + i.name; }).join(', ');
      var foot = document.createElement('span');
      foot.className = 'account-order-foot';
      foot.textContent = new Date(o.createdAt).toLocaleDateString('pt-BR') + ' · ' + brl(o.total);
      a.appendChild(top);
      a.appendChild(items);
      a.appendChild(foot);
      box.appendChild(a);
    });
  }

  /* ------------------------------- sessão ------------------------------- */

  function setSession(data) {
    state.session = data.session;
    write(SESSION_KEY, data.session);
    state.account = data.account;
    state.orders = [];
    state.email = '';
    renderHeader();
    fillCheckout();
    render();
    refresh();
  }

  function clearSession() {
    state.session = '';
    state.account = null;
    state.orders = [];
    write(SESSION_KEY, '');
    renderHeader();
  }

  function refresh() {
    if (!state.session) return Promise.resolve();
    return request('/api/account').then(function (data) {
      state.account = data.account;
      state.orders = data.orders || [];
      renderHeader();
      fillCheckout();
      var dialog = $('accountDialog');
      if (dialog && dialog.open) render();
    }, function (err) {
      if (err.status === 401) { clearSession(); var d = $('accountDialog'); if (d && d.open) render(); }
    });
  }

  /* ------------------------------- Google ------------------------------- */

  var googleLoading = false;
  function loadGoogle() {
    if (window.google && window.google.accounts && window.google.accounts.id) { renderGoogle(); return; }
    if (googleLoading) return;
    googleLoading = true;
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = renderGoogle;
    s.onerror = function () { googleLoading = false; show($('googleWrap'), false); show($('accountOr'), false); };
    document.head.appendChild(s);
  }

  function renderGoogle() {
    var el = $('googleButton');
    if (!el || !window.google || !window.google.accounts) return;
    window.google.accounts.id.initialize({ client_id: state.cfg.google, callback: onGoogle, ux_mode: 'popup', auto_select: false });
    el.textContent = '';
    window.google.accounts.id.renderButton(el, {
      theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'pt-BR',
      width: Math.min(320, Math.max(220, el.parentNode.clientWidth || 300))
    });
  }

  function onGoogle(response) {
    message($('loginMsg'), 'Entrando…', true);
    request('/api/auth/google', { method: 'POST', body: { credential: response && response.credential } })
      .then(setSession, function (err) { message($('loginMsg'), err.message); });
  }

  /* ------------------------------- eventos ------------------------------- */

  function setup() {
    var btn = $('accountOpen');
    if (btn) btn.addEventListener('click', openAccount);

    var emailForm = $('emailForm');
    if (emailForm) emailForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('loginEmail').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { message($('loginMsg'), 'Digite um e-mail válido.'); $('loginEmail').focus(); return; }
      busy($('emailSend'), true, 'Enviando…');
      request('/api/auth/email/start', { method: 'POST', body: { email: email } }).then(function (data) {
        state.email = email;
        renderLogin();
        $('codeHint').textContent = 'Enviamos um código de 6 números para ' + email + '. Confira também o spam.';
        if (data.devCode) $('loginCode').value = data.devCode; // só no modo de teste do servidor
        $('loginCode').focus();
      }, function (err) {
        message($('loginMsg'), err.message);
      }).then(function () { busy($('emailSend'), false); });
    });

    var codeForm = $('codeForm');
    if (codeForm) codeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = $('loginCode').value.replace(/\D/g, '');
      if (code.length !== 6) { message($('loginMsg'), 'O código tem 6 números.'); $('loginCode').focus(); return; }
      busy($('codeSend'), true, 'Entrando…');
      request('/api/auth/email/verify', { method: 'POST', body: { email: state.email, code: code } })
        .then(function (data) { $('loginCode').value = ''; setSession(data); }, function (err) {
          message($('loginMsg'), err.message);
          if (err.status === 410 || err.status === 429) { state.email = ''; renderLogin(); message($('loginMsg'), err.message); }
        }).then(function () { busy($('codeSend'), false); });
    });

    var back = $('codeBack');
    if (back) back.addEventListener('click', function () { state.email = ''; renderLogin(); $('loginEmail').focus(); });

    var code = $('loginCode');
    if (code) code.addEventListener('input', function () { code.value = code.value.replace(/\D/g, '').slice(0, 6); });
    var cep = $('profileCep');
    if (cep) cep.addEventListener('input', function () { cep.value = formatCep(cep.value); });

    var profile = $('profileForm');
    if (profile) profile.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = $('profilePhone').value.replace(/\D/g, '');
      if (phone && (phone.length < 10 || phone.length > 13)) { message($('profileMsg'), 'WhatsApp com DDD: 10 ou 11 números.'); $('profilePhone').focus(); return; }
      busy($('profileSave'), true, 'Salvando…');
      request('/api/account', {
        method: 'POST',
        body: {
          name: $('profileName').value,
          phone: phone,
          address: { cep: $('profileCep').value, number: $('profileNumber').value, complement: $('profileComplement').value },
          optIn: $('profileOptIn').checked
        }
      }).then(function (data) {
        state.account = data.account;
        renderHeader();
        fillCheckout();
        var name = firstName(data.account.name);
        $('accountHello').textContent = name ? 'Olá, ' + name + '!' : 'Olá!';
        $('profilePhone').value = formatPhone(data.account.phone);
        message($('profileMsg'), 'Dados salvos. Eles já aparecem no checkout.', true);
      }, function (err) {
        if (err.status === 401) { clearSession(); render(); }
        message($('profileMsg'), err.message);
      }).then(function () { busy($('profileSave'), false); });
    });

    var logout = $('accountLogout');
    if (logout) logout.addEventListener('click', function () {
      request('/api/auth/logout', { method: 'POST' }).catch(function () { /* sai mesmo sem internet */ });
      if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect();
      clearSession();
      render();
    });

    var del = $('accountDelete');
    if (del) del.addEventListener('click', function () {
      if (!window.confirm('Excluir sua conta? Seus dados salvos serão apagados. Os pedidos já feitos continuam no histórico da loja.')) return;
      request('/api/account/delete', { method: 'POST' }).then(function () {
        clearSession();
        render();
        message($('loginMsg'), 'Conta excluída.', true);
      }, function (err) { message($('profileMsg'), err.message); });
    });
  }

  function init() {
    setup();
    if (!api) return;
    var cached = read(CFG_KEY, window.sessionStorage);
    var load = cached ? Promise.resolve(JSON.parse(cached)) : request('/api/auth/config').then(function (cfg) {
      write(CFG_KEY, JSON.stringify(cfg), window.sessionStorage);
      return cfg;
    });
    load.then(function (cfg) {
      state.cfg = cfg || {};
      var available = !!(state.cfg.google || state.cfg.email);
      show($('accountOpen'), available || !!state.session);
      renderHeader();
      if (state.session) refresh();
    }, function () { /* servidor fora do ar: a loja funciona sem conta */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
