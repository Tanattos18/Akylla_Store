/*
 * Aky, o mascote ajudante da compra.
 * Fica num canto da tela, dá a dica do passo atual (sacola → entrega → pagamento) e destaca com um brilho
 * laranja onde o cliente deve tocar. Só observa a página (não mexe no pedido). O cliente pode fechar o balão
 * (volta no próximo passo) ou desligar o ajudante (fica desligado neste aparelho).
 */
(function () {
  'use strict';

  var OFF_KEY = 'akylla-aky-off';
  var $ = function (id) { return document.getElementById(id); };
  var root, bubble, text, current = null, target = null, closedStep = null, timer = null, talkTimer = null;
  /* popover: fica por cima até das janelas abertas (sacola, checkout), preso à tela */
  var POPOVER = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
  var lastDialog = null;

  function off() { try { return localStorage.getItem(OFF_KEY) === '1'; } catch (e) { return false; } }

  function visible(el) {
    if (!el || el.hidden) return false;
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hidden || (n.tagName === 'DIALOG' && !n.open)) return false;
    }
    return el.getClientRects().length > 0;
  }
  function openDialog() {
    var list = document.querySelectorAll('dialog[open]');
    return list.length ? list[list.length - 1] : null;
  }
  function deliveryMode() {
    var r = document.querySelector('input[name="deliveryMode"]:checked');
    return r ? r.value : '';
  }

  /* Qual é o passo agora: { id, say, el } */
  function step() {
    var dlg = openDialog();
    if (dlg && dlg.id === 'checkoutDialog') {
      if (visible($('mpDone'))) return { id: 'paid', say: 'Pagamento confirmado! 🎉 Agora é só mandar o pedido no WhatsApp pra combinar a entrega.', el: $('mpWhats') };
      if (visible($('mpPay'))) return { id: 'pix-pay', say: 'Copie o código PIX e pague no app do seu banco. Eu confirmo aqui sozinho, não feche esta tela!', el: $('mpCopy') };
      var mode = deliveryMode();
      if (!mode) return { id: 'delivery', say: 'Primeiro: vai retirar na loja (grátis) ou quer receber em casa? Escolha aqui.', el: document.querySelector('.delivery-options') };
      if (mode === 'delivery' && !visible($('deliveryResult'))) {
        var cep = $('deliveryCep');
        return cep && String(cep.value).replace(/\D/g, '').length < 8
          ? { id: 'cep', say: 'Digite seu CEP e o número da casa pra eu calcular o frete.', el: cep }
          : { id: 'calc', say: 'Agora toque em Calcular frete.', el: $('deliveryCalc') };
      }
      if (visible($('mpBox'))) {
        var name = $('mpName');
        if (name && name.value.trim().length < 3) return { id: 'name', say: 'Coloque seu nome completo. O WhatsApp ajuda a gente a te avisar da entrega.', el: name };
        return { id: 'pix', say: 'Toque em Gerar PIX: é à vista e sai mais barato! Prefere parcelar? Logo abaixo tem o cartão em até 12x.', el: $('mpCreate') };
      }
      if (visible($('pixBox'))) {
        var mn = $('manualName');
        if (visible(mn) && mn.value.trim().length < 3) return { id: 'manual-name', say: 'Pague o PIX no app do banco e depois coloque seu nome e WhatsApp aqui.', el: mn };
        return { id: 'manual-send', say: 'Pagou? Toque aqui pra enviar o comprovante no WhatsApp. O produto fica separado pra você!', el: $('sendProof') };
      }
      return null;
    }
    if (dlg && dlg.id === 'cartDrawer') {
      if (visible($('checkoutBtn'))) return { id: 'cart', say: 'Tudo certo na sacola? Toque em Finalizar pra escolher a entrega e o pagamento.', el: $('checkoutBtn') };
      return null;
    }
    if (dlg) return null; // produto ou menu abertos: não atrapalha
    if (visible($('cartBarCheckout'))) return { id: 'bar', say: 'Quando terminar de escolher, toque em Finalizar compra aqui embaixo 👇', el: $('cartBarCheckout') };
    var cartCount = document.querySelector('.cart-count');
    if (cartCount && Number(cartCount.textContent) > 0 && visible($('cartOpen'))) return { id: 'bag', say: 'Seus produtos estão na sacola. Toque em Sacola, lá em cima ↗, pra finalizar a compra!', el: $('cartOpen') };
    return null;
  }

  function fixedEl(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true;
    return false;
  }

  function hint(el) {
    if (!el || fixedEl(el)) return '';
    var r = el.getBoundingClientRect();
    if (r.bottom < 10) return ' 👆 (suba um pouco)';
    if (r.top > window.innerHeight - 10) return ' 👇 (desça um pouco)';
    return '';
  }

  function setTarget(el) {
    if (target === el) return;
    if (target) target.classList.remove('aky-target');
    target = el || null;
    if (target) target.classList.add('aky-target');
  }

  function talk() {
    root.classList.add('is-talking');
    clearTimeout(talkTimer);
    talkTimer = setTimeout(function () { root.classList.remove('is-talking'); }, 2200);
  }

  function update() {
    timer = null;
    if (!root) return;
    var dlg = openDialog();
    if (off()) { showRoot(false); setTarget(null); return; }
    var s = step();
    if (!POPOVER) {
      /* navegador antigo: fica dentro da janela aberta, senão a janela cobre o mascote */
      var host = dlg || document.body;
      if (root.parentElement !== host) host.appendChild(root);
      root.classList.toggle('in-dialog', host !== document.body);
    }
    root.classList.toggle('above-bar', !dlg && visible($('cartBar')));
    if (!s) { showRoot(false); setTarget(null); current = null; lastDialog = dlg; return; }
    showRoot(true, dlg);
    lastDialog = dlg;
    var changed = !current || current.id !== s.id;
    if (changed) { closedStep = null; talk(); }
    current = s;
    var show = closedStep !== s.id;
    set(bubble, 'hidden', !show);
    set(text, 'textContent', s.say + hint(s.el));
    setTarget(show ? s.el : null);
    /* não cobrir o que ele está mostrando: se o alvo está na metade de baixo, o mascote sobe para o topo */
    var r = s.el && !fixedEl(s.el) ? s.el.getBoundingClientRect() : null;
    root.classList.toggle('at-top', !!(r && r.top + r.height / 2 > window.innerHeight * 0.55 && r.top < window.innerHeight));
  }

  function schedule(records) {
    /* ignora mudanças feitas pelo próprio mascote (evita ficar se atualizando sem parar) */
    if (records && records.length && records.every(function (r) { return root && (root === r.target || root.contains(r.target)) || (r.attributeName === 'class'); })) return;
    if (!timer) timer = setTimeout(update, 120);
  }
  function set(el, prop, value) { if (el[prop] !== value) el[prop] = value; }

  function showRoot(on, dlg) {
    if (!POPOVER) { set(root, 'hidden', !on); return; }
    var open = root.matches(':popover-open');
    if (!on) { if (open) root.hidePopover(); return; }
    /* janela nova abriu por cima: mostra de novo para ficar na frente */
    if (open && lastDialog !== dlg) root.hidePopover();
    if (!root.matches(':popover-open')) root.showPopover();
  }

  function build() {
    root = document.createElement('div');
    root.className = 'aky';
    if (POPOVER) root.setAttribute('popover', 'manual'); else root.hidden = true;
    root.innerHTML =
      '<div class="aky-bubble" role="status" aria-live="polite">' +
        '<button class="aky-close" type="button" aria-label="Fechar dica">✕</button>' +
        '<p class="aky-text"></p>' +
        '<button class="aky-off" type="button">Desligar ajudante</button>' +
      '</div>' +
      '<button class="aky-bot" type="button" aria-label="Aky, ajudante da compra: mostrar a dica">' +
        '<svg viewBox="0 0 120 130" aria-hidden="true">' +
          '<line x1="60" y1="22" x2="60" y2="8" class="aky-antenna"/>' +
          '<circle cx="60" cy="7" r="6" class="aky-ball"/>' +
          '<rect x="34" y="88" width="52" height="38" rx="14" class="aky-body"/>' +
          '<rect x="12" y="22" width="96" height="72" rx="26" class="aky-head"/>' +
          '<rect x="22" y="32" width="76" height="52" rx="18" class="aky-face"/>' +
          '<g class="aky-eyes"><rect x="38" y="44" width="12" height="15" rx="6"/><rect x="70" y="44" width="12" height="15" rx="6"/></g>' +
          '<rect x="49" y="66" width="22" height="6" rx="3" class="aky-mouth"/>' +
          '<line x1="86" y1="98" x2="104" y2="80" class="aky-arm"/>' +
          '<circle cx="105" cy="78" r="7" class="aky-hand"/>' +
        '</svg>' +
      '</button>';
    bubble = root.querySelector('.aky-bubble');
    text = root.querySelector('.aky-text');
    root.querySelector('.aky-close').addEventListener('click', function () {
      if (current) closedStep = current.id;
      update();
    });
    root.querySelector('.aky-off').addEventListener('click', function () {
      try { localStorage.setItem(OFF_KEY, '1'); } catch (e) { /* sem armazenamento */ }
      update();
    });
    root.querySelector('.aky-bot').addEventListener('click', function () {
      closedStep = closedStep && current && closedStep === current.id ? null : current && current.id;
      if (!closedStep) talk();
      update();
    });
    document.body.appendChild(root);
  }

  function init() {
    if (!window.MutationObserver) return;
    build();
    new MutationObserver(schedule).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'open'], childList: true });
    ['input', 'change', 'click', 'scroll', 'resize'].forEach(function (ev) { window.addEventListener(ev, function () { schedule(); }, { passive: true, capture: true }); });
    setTimeout(update, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
