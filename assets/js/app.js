/*
 * Akylla Shop — interações da landing page
 * Catálogo, filtros, sacola local e checkout PIX.
 */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var CONFIG = window.AKYLLA_CONFIG || {};
  /* Produtos marcados como ocultos no painel (`hidden: true`) não aparecem no site. */
  var PRODUCTS = (window.AKYLLA_PRODUCTS || []).filter(function (product) {
    return product && !product.hidden;
  });
  var CATEGORIES = window.AKYLLA_CATEGORIES || [];
  var Pix = window.AkyllaPix || {};
  var qrFactory = window.qrcode;
  var STORAGE_KEY = 'akylla-cart-v1';
  var PAGE_SIZE = 12;

  var productMap = new Map(PRODUCTS.map(function (product) {
    return [product.id, product];
  }));

  var state = {
    filter: 'todos',
    query: '',
    sort: 'featured',
    visibleCount: PAGE_SIZE,
    cart: [],
    order: null,
    pixPayload: '',
    /* Entrega escolhida no checkout: mode 'pickup' | 'delivery' | null; quote = cotação do frete. */
    delivery: { mode: null, quote: null, complement: '', loading: false },
    /* PIX automático (Mercado Pago): pedido no servidor, assinatura do pedido, polling. */
    mp: { order: null, signature: '', timer: null, countdown: null, busy: false, error: '', manual: false, done: false }
  };

  var els = {
    header: document.querySelector('.site-header'),
    productGrid: document.getElementById('productGrid'),
    catalogEmpty: document.getElementById('catalogEmpty'),
    clearFilters: document.getElementById('clearFilters'),
    resultCount: document.getElementById('resultCount'),
    loadMore: document.getElementById('loadMore'),
    filterRow: document.getElementById('filterRow'),
    searchInput: document.getElementById('searchInput'),
    searchShortcut: document.getElementById('searchShortcut'),
    sortSelect: document.getElementById('sortSelect'),
    cartOpen: document.getElementById('cartOpen'),
    cartDrawer: document.getElementById('cartDrawer'),
    cartItems: document.getElementById('cartItems'),
    cartEmpty: document.getElementById('cartEmpty'),
    cartFoot: document.getElementById('cartFoot'),
    cartTotal: document.getElementById('cartTotal'),
    cartCount: document.getElementById('cartCount'),
    cartBar: document.getElementById('cartBar'),
    cartBarCount: document.getElementById('cartBarCount'),
    cartBarTotal: document.getElementById('cartBarTotal'),
    checkoutBtn: document.getElementById('checkoutBtn'),
    emptyBrowse: document.getElementById('emptyBrowse'),
    mobileMenu: document.getElementById('mobileMenu'),
    menuToggle: document.getElementById('menuToggle'),
    productDialog: document.getElementById('productDialog'),
    productDialogMedia: document.getElementById('productDialogMedia'),
    productDialogImg: document.getElementById('productDialogImg'),
    productDialogFallback: document.getElementById('productDialogFallback'),
    productDialogBrand: document.getElementById('productDialogBrand'),
    productDialogName: document.getElementById('productDialogName'),
    productDialogCode: document.getElementById('productDialogCode'),
    productDialogDesc: document.getElementById('productDialogDesc'),
    productDialogSpecs: document.getElementById('productDialogSpecs'),
    productDialogPrice: document.getElementById('productDialogPrice'),
    productDialogAdd: document.getElementById('productDialogAdd'),
    productDialogBuy: document.getElementById('productDialogBuy'),
    productDialogStock: document.getElementById('productDialogStock'),
    productDialogOld: document.getElementById('productDialogOld'),
    productDialogUntil: document.getElementById('productDialogUntil'),
    productDialogThumbs: document.getElementById('productDialogThumbs'),
    productDialogWa: document.getElementById('productDialogWa'),
    productDialogNote: document.getElementById('productDialogNote'),
    checkoutDialog: document.getElementById('checkoutDialog'),
    checkoutItems: document.getElementById('checkoutItems'),
    checkoutTotal: document.getElementById('checkoutTotal'),
    orderId: document.getElementById('orderId'),
    pixTotal: document.getElementById('pixTotal'),
    pixKey: document.getElementById('pixKey'),
    pixPayloadPreview: document.getElementById('pixPayloadPreview'),
    pixQr: document.getElementById('pixQr'),
    copyKey: document.getElementById('copyKey'),
    copyPix: document.getElementById('copyPix'),
    deliveryBox: document.getElementById('deliveryBox'),
    deliveryForm: document.getElementById('deliveryForm'),
    deliveryCep: document.getElementById('deliveryCep'),
    deliveryNumber: document.getElementById('deliveryNumber'),
    deliveryComplement: document.getElementById('deliveryComplement'),
    deliveryCalc: document.getElementById('deliveryCalc'),
    deliveryResult: document.getElementById('deliveryResult'),
    pickupOption: document.getElementById('pickupOption'),
    pickupNote: document.getElementById('pickupNote'),
    pixBox: document.getElementById('pixBox'),
    mpBox: document.getElementById('mpBox'),
    mpStart: document.getElementById('mpStart'),
    mpEmail: document.getElementById('mpEmail'),
    mpName: document.getElementById('mpName'),
    mpPhone: document.getElementById('mpPhone'),
    mpCreate: document.getElementById('mpCreate'),
    mpPay: document.getElementById('mpPay'),
    mpQr: document.getElementById('mpQr'),
    mpTotal: document.getElementById('mpTotal'),
    mpStatus: document.getElementById('mpStatus'),
    mpCode: document.getElementById('mpCode'),
    mpCopy: document.getElementById('mpCopy'),
    mpExpire: document.getElementById('mpExpire'),
    mpCancel: document.getElementById('mpCancel'),
    mpDone: document.getElementById('mpDone'),
    mpDoneText: document.getElementById('mpDoneText'),
    mpWhats: document.getElementById('mpWhats'),
    mpError: document.getElementById('mpError'),
    mpErrorText: document.getElementById('mpErrorText'),
    mpManual: document.getElementById('mpManual'),
    checkoutSteps: document.getElementById('checkoutSteps'),
    manualCustomer: document.getElementById('manualCustomer'),
    manualName: document.getElementById('manualName'),
    cardBox: document.getElementById('cardBox'),
    restockNote: document.getElementById('restockNote'),
    resumeBar: document.getElementById('resumeBar'),
    resumeText: document.getElementById('resumeText'),
    resumePay: document.getElementById('resumePay'),
    resumeCancel: document.getElementById('resumeCancel'),
    resumePix: document.getElementById('resumePix'),
    ordersDot: document.getElementById('ordersDot'),
    cardPrice: document.getElementById('cardPrice'),
    cardNote: document.getElementById('cardNote'),
    cardPay: document.getElementById('cardPay'),
    cardError: document.getElementById('cardError'),
    mpTrack: document.getElementById('mpTrack'),
    manualPhone: document.getElementById('manualPhone'),
    manualError: document.getElementById('manualError'),
    pixLocked: document.getElementById('pixLocked'),
    checkoutSubtotal: document.getElementById('checkoutSubtotal'),
    checkoutShipping: document.getElementById('checkoutShipping'),
    downloadQr: document.getElementById('downloadQr'),
    sendProof: document.getElementById('sendProof'),
    backToCart: document.getElementById('backToCart'),
    toast: document.getElementById('toast'),
    pixHolder: document.querySelector('.pix-holder strong')
  };

  var toastTimer = null;
  var searchTimer = null;
  var activeProductId = null;

  /* ----------------------------- utilidades ----------------------------- */

  /* Preço de venda agora (com promoção ativa, se houver) — ver assets/js/promo.js. */
  function priceInfo(product) {
    if (window.AkyllaPromo) return window.AkyllaPromo.priceFor(product, CONFIG);
    return { price: product.price, original: product.price, percent: 0, until: '', active: false };
  }

  function salePrice(product) {
    return priceInfo(product).price;
  }

  function percentText(percent) {
    return String(percent).replace('.', ',') + '%';
  }

  function promoUntilText(info) {
    var day = info.until && window.AkyllaPromo ? window.AkyllaPromo.formatDay(info.until) : '';
    return day ? 'até ' + day : '';
  }

  /* Bloco de preço (card): preço normal riscado + preço com desconto + selo. */
  function priceHTML(product, compact) {
    var info = priceInfo(product);
    if (!info.active) {
      return '        <span class="price">' + formatBRL(info.price) + '</span>';
    }
    return [
      '        <span class="price-old"><span class="sr-only">De </span><s>' + formatBRL(info.original) + '</s>',
      '          <span class="discount-badge">-' + percentText(info.percent) + '</span></span>',
      '        <span class="price"><span class="sr-only">Por </span>' + formatBRL(info.price) + '</span>',
      !compact && promoUntilText(info) ? '        <span class="price-until">Promoção ' + escapeHTML(promoUntilText(info)) + '</span>' : ''
    ].join('\n');
  }

  function formatBRL(cents) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(cents || 0) / 100);
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function whatsappLink(message) {
    var number = String(CONFIG.whatsapp || '').replace(/\D/g, '');
    var text = message || CONFIG.whatsappMessage || '';
    return 'https://wa.me/' + number + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  var reducedMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function scrollToSection(target) {
    if (!target) return;
    target.scrollIntoView({
      behavior: reducedMotionQuery && reducedMotionQuery.matches ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  function categoryLabel(categoryId) {
    var category = CATEGORIES.find(function (item) {
      return item.id === categoryId;
    });
    return category ? category.label : categoryId;
  }

  function productById(id) {
    return productMap.get(id) || null;
  }

  function wireImageFallback(image) {
    if (!image) return;
    var media = image.closest('[data-media]');

    function fallback() {
      image.hidden = true;
      if (media) media.classList.add('is-fallback');
    }

    image.addEventListener('error', fallback);
    if (image.complete && image.naturalWidth === 0) fallback();
  }

  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('is-visible');
    }, 2800);
  }

  function syncBodyLock() {
    var hasOpenDialog = [els.mobileMenu, els.cartDrawer, els.checkoutDialog, els.productDialog].some(function (dialog) {
      return dialog && dialog.open;
    });
    document.body.classList.toggle('is-locked', hasOpenDialog);

    if (els.cartOpen) {
      els.cartOpen.setAttribute('aria-expanded', els.cartDrawer && els.cartDrawer.open ? 'true' : 'false');
    }
    if (els.menuToggle) {
      els.menuToggle.setAttribute('aria-expanded', els.mobileMenu && els.mobileMenu.open ? 'true' : 'false');
    }
  }

  /* Botão "voltar" do celular/navegador fecha a janela aberta (produto, sacola, checkout, menu) em vez de sair do site. */
  var dialogHistory = false;
  function anyDialogOpen() {
    return Array.prototype.some.call(document.querySelectorAll('dialog'), function (d) { return d.open; });
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    if (!dialogHistory && window.history && history.pushState) {
      try { history.pushState({ akDialog: true }, ''); dialogHistory = true; } catch (e) { /* ok */ }
    }
    syncBodyLock();
  }

  /* fechou pelo X, Esc ou clique fora: tira a entrada extra do histórico (se ela ainda for a atual) */
  function dialogClosed() {
    syncBodyLock();
    if (!dialogHistory || anyDialogOpen()) return;
    dialogHistory = false;
    if (history.state && history.state.akDialog) history.back();
  }

  window.addEventListener('popstate', function () {
    if (!dialogHistory) return;
    dialogHistory = false;
    Array.prototype.filter.call(document.querySelectorAll('dialog'), function (d) { return d.open; }).forEach(function (d) { closeDialog(d); });
  });

  function closeDialog(dialog) {
    if (!dialog) return;
    if (dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      syncBodyLock();
    }
  }

  /* ------------------------------- sacola ------------------------------- */

  function loadCart() {
    try {
      var raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];

      var seen = new Set();
      return raw.reduce(function (cart, entry) {
        var id = String(entry && entry.id ? entry.id : '');
        if (!id || seen.has(id) || !productById(id)) return cart;
        var limit = maxQty(productById(id));
        if (limit < 1) return cart;
        var quantity = Math.max(1, Math.min(limit, parseInt(entry.qty, 10) || 1));
        seen.add(id);
        cart.push({ id: id, qty: quantity });
        return cart;
      }, []);
    } catch (error) {
      return [];
    }
  }

  function saveCart() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
    } catch (error) {
      /* Modo privado ou armazenamento indisponível: a sacola continua na sessão. */
    }
  }

  function getCartItems() {
    return state.cart.reduce(function (items, entry) {
      var product = productById(entry.id);
      if (product) items.push({ product: product, qty: entry.qty });
      return items;
    }, []);
  }

  function cartQuantity() {
    return state.cart.reduce(function (total, entry) {
      return total + entry.qty;
    }, 0);
  }

  /* Quanto dá para vender: estoque físico + reposição pelo fornecedor (regra em promo.js). */
  function maxQty(product) {
    if (!product) return 99;
    return window.AkyllaPromo ? window.AkyllaPromo.available(product, CONFIG) : (typeof product.stock === 'number' ? Math.max(0, Math.min(99, product.stock)) : 99);
  }

  function restockOn(product) {
    return !!(window.AkyllaPromo && window.AkyllaPromo.restockLimit(product, CONFIG) > 0);
  }

  function stockInfo(product) {
    var stock = maxQty(product);
    if (typeof product.stock !== 'number') return null;
    if (stock <= 0) return { text: 'Esgotado', tone: 'out' };
    if (restockOn(product)) return { text: 'Em estoque', tone: 'ok' };
    if (stock === 1) return { text: 'Última unidade', tone: 'low' };
    if (stock <= 3) return { text: 'Restam ' + stock + ' unidades', tone: 'low' };
    return { text: 'Em estoque', tone: 'ok' };
  }

  /* Itens da sacola que passam do estoque físico (vêm do fornecedor). */
  function supplierItems() {
    return getCartItems().filter(function (item) {
      return typeof item.product.stock === 'number' && item.qty > Math.max(0, item.product.stock);
    });
  }

  function stockBadge(product, extraClass) {
    var info = stockInfo(product);
    if (!info) return '';
    return '<span class="stock-badge stock-badge--' + info.tone + (extraClass ? ' ' + extraClass : '') + '">' + escapeHTML(info.text) + '</span>';
  }

  function cardBadges(product) {
    var html = '';
    if (product.bestseller) html += '<span class="stock-badge stock-badge--best">Mais vendido</span>';
    var info = stockInfo(product);
    if (info && (info.tone === 'out' || (maxQty(product) === 1 && !restockOn(product)))) html += stockBadge(product);
    return html ? '    <div class="card-badges">' + html + '</div>' : '';
  }

  function cartTotal() {
    return getCartItems().reduce(function (total, item) {
      return total + salePrice(item.product) * item.qty;
    }, 0);
  }

  function addToCart(id) {
    var product = productById(id);
    if (!product) return;

    var entry = state.cart.find(function (item) {
      return item.id === id;
    });

    var limit = maxQty(product);
    if (limit < 1) {
      toast(product.shortName + ' está esgotado no momento.');
      return;
    }
    if (entry && entry.qty >= limit) {
      toast('Temos só ' + limit + (limit === 1 ? ' unidade' : ' unidades') + ' de ' + product.shortName + '.');
      return;
    }

    if (entry) {
      entry.qty += 1;
    } else {
      state.cart.push({ id: id, qty: 1 });
    }

    saveCart();
    renderCart();
    toast(product.shortName + ' adicionado à sacola.');
  }

  function changeQuantity(id, delta) {
    var entry = state.cart.find(function (item) {
      return item.id === id;
    });
    if (!entry) return;

    entry.qty += delta;
    if (entry.qty < 1) {
      state.cart = state.cart.filter(function (item) {
        return item.id !== id;
      });
    } else {
      entry.qty = Math.min(maxQty(productById(id)), entry.qty);
    }

    saveCart();
    renderCart();
  }

  function removeFromCart(id) {
    var product = productById(id);
    state.cart = state.cart.filter(function (item) {
      return item.id !== id;
    });
    saveCart();
    renderCart();
    if (product) toast(product.shortName + ' removido da sacola.');
  }

  function renderCart() {
    var items = getCartItems();
    var quantity = cartQuantity();
    var total = cartTotal();
    var isEmpty = items.length === 0;

    if (els.cartCount) {
      els.cartCount.textContent = String(quantity);
      els.cartCount.setAttribute('aria-label', quantity + (quantity === 1 ? ' item no carrinho' : ' itens no carrinho'));
    }

    if (els.cartTotal) els.cartTotal.textContent = formatBRL(total);
    if (els.cartBar) {
      els.cartBar.hidden = isEmpty;
      document.body.classList.toggle('has-cart-bar', !isEmpty);
      els.cartBarCount.textContent = quantity + (quantity === 1 ? ' item' : ' itens');
      els.cartBarTotal.textContent = formatBRL(total);
    }
    if (els.cartFoot) els.cartFoot.hidden = isEmpty;
    if (els.cartEmpty) els.cartEmpty.hidden = !isEmpty;
    if (els.cartItems) els.cartItems.hidden = isEmpty;

    if (!els.cartItems) return;

    if (isEmpty) {
      els.cartItems.innerHTML = '';
      return;
    }

    els.cartItems.innerHTML = items.map(function (item, index) {
      var product = item.product;
      var lineTotal = salePrice(product) * item.qty;
      return [
        '<article class="cart-item" data-id="' + escapeHTML(product.id) + '">',
        '  <div class="cart-thumb visual--' + escapeHTML(product.visual) + (product.image ? '' : ' is-fallback') + '" aria-hidden="true" data-media>',
        product.image ? '    <img class="cart-thumb-photo" src="' + escapeHTML(product.image) + '" alt="" loading="lazy" decoding="async" width="700" height="700" data-photo>' : '',
        '    <svg viewBox="0 0 64 64"><use href="#icon-' + escapeHTML(product.visual) + '"></use></svg>',
        '  </div>',
        '  <div class="cart-item-main">',
        '    <h3>' + escapeHTML(product.shortName) + '</h3>',
        '    <p class="cart-item-code">Cód. ' + escapeHTML(product.code) + ' • ' + escapeHTML(product.brand) + '</p>',
        '    <div class="cart-item-controls">',
        '      <div class="qty-control" role="group" aria-label="Quantidade de ' + escapeHTML(product.shortName) + '">',
        '        <button type="button" data-qty="-1" data-id="' + escapeHTML(product.id) + '" aria-label="Diminuir quantidade"' + (item.qty <= 1 ? ' disabled' : '') + '>',
        '          <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-minus"></use></svg>',
        '        </button>',
        '        <span class="qty-value">' + item.qty + '</span>',
        '        <button type="button" data-qty="1" data-id="' + escapeHTML(product.id) + '" aria-label="Aumentar quantidade"' + (item.qty >= maxQty(product) ? ' disabled' : '') + '>',
        '          <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-plus"></use></svg>',
        '        </button>',
        '      </div>',
        '      <button class="remove-item" type="button" data-remove="' + escapeHTML(product.id) + '" aria-label="Remover ' + escapeHTML(product.shortName) + ' da sacola">',
        '        <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-trash"></use></svg>',
        '      </button>',
        '    </div>',
        '  </div>',
        '  <strong class="cart-item-price">' + formatBRL(lineTotal) + '</strong>',
        '</article>'
      ].join('\n');
    }).join('');

    Array.prototype.forEach.call(els.cartItems.querySelectorAll('img[data-photo]'), wireImageFallback);

    if (els.cartItems.firstElementChild) {
      els.cartItems.firstElementChild.style.setProperty('--i', '0');
    }
  }

  /* --------------------------- detalhes do produto --------------------------- */

  function renderProductDialog(product) {
    if (!product) return;
    activeProductId = product.id;

    if (els.productDialogBrand) {
      els.productDialogBrand.textContent = product.brand + ' • ' + categoryLabel(product.category);
    }
    if (els.productDialogName) els.productDialogName.textContent = product.name;
    if (els.productDialogCode) {
      els.productDialogCode.textContent = 'Cód. ' + product.code + ' • Modelo ' + product.model;
    }
    if (els.productDialogDesc) els.productDialogDesc.textContent = product.description;
    var dialogInfo = priceInfo(product);
    if (els.productDialogPrice) els.productDialogPrice.textContent = formatBRL(dialogInfo.price);
    if (els.productDialogOld) {
      els.productDialogOld.hidden = !dialogInfo.active;
      if (dialogInfo.active) {
        els.productDialogOld.querySelector('s').textContent = formatBRL(dialogInfo.original);
        els.productDialogOld.querySelector('.discount-badge').textContent = '-' + percentText(dialogInfo.percent);
      }
    }
    if (els.productDialogUntil) {
      var untilText = dialogInfo.active ? promoUntilText(dialogInfo) : '';
      els.productDialogUntil.hidden = !untilText;
      els.productDialogUntil.textContent = untilText ? 'Promoção ' + untilText : '';
    }
    if (els.productDialogStock) {
      var info = stockInfo(product);
      els.productDialogStock.hidden = !info;
      els.productDialogStock.className = 'stock-badge' + (info ? ' stock-badge--' + info.tone : '');
      els.productDialogStock.textContent = info ? info.text : '';
    }
    if (els.productDialogAdd) {
      var soldOut = maxQty(product) < 1;
      els.productDialogAdd.disabled = soldOut;
      if (els.productDialogBuy) {
        els.productDialogBuy.disabled = soldOut;
        els.productDialogBuy.textContent = soldOut ? 'Esgotado' : 'Comprar agora';
      }
    }

    if (els.productDialogSpecs) {
      els.productDialogSpecs.innerHTML = (product.specs || []).map(function (spec) {
        return [
          '<div class="spec-row">',
          '  <dt>' + escapeHTML(spec.label) + '</dt>',
          '  <dd>' + escapeHTML(spec.value) + '</dd>',
          '</div>'
        ].join('');
      }).join('');
    }

    if (els.productDialogFallback) {
      var use = els.productDialogFallback.querySelector('use');
      if (use) use.setAttribute('href', '#icon-' + product.visual);
    }

    if (els.productDialogImg) {
      els.productDialogImg.hidden = false;
      els.productDialogImg.alt = product.imageAlt || product.name;
      if (els.productDialogMedia) els.productDialogMedia.classList.remove('is-fallback');

      if (product.image) {
        els.productDialogImg.src = product.image;
        renderDialogThumbs(product);
      } else {
        els.productDialogImg.removeAttribute('src');
        els.productDialogImg.hidden = true;
        if (els.productDialogMedia) els.productDialogMedia.classList.add('is-fallback');
      }
    }

    if (els.productDialogNote) els.productDialogNote.hidden = !product.illustrative;

    if (els.productDialogWa) {
      els.productDialogWa.href = whatsappLink(
        'Olá! Tenho uma dúvida sobre ' + product.name + ' (cód. ' + product.code + ').'
      );
    }
  }

  /* Galeria: foto principal + `gallery` do produto, trocadas pelas miniaturas. */
  function productPhotos(product) {
    return [product.image].concat(product.gallery || []).filter(Boolean);
  }

  function showDialogPhoto(product, index) {
    var photos = productPhotos(product);
    if (!photos[index] || !els.productDialogImg) return;
    els.productDialogImg.hidden = false;
    if (els.productDialogMedia) els.productDialogMedia.classList.remove('is-fallback');
    els.productDialogImg.src = photos[index];
    els.productDialogImg.alt = (product.imageAlt || product.name) + (photos.length > 1 ? ' — foto ' + (index + 1) + ' de ' + photos.length : '');
    if (els.productDialogThumbs) {
      Array.prototype.forEach.call(els.productDialogThumbs.children, function (thumb, i) {
        thumb.setAttribute('aria-pressed', i === index ? 'true' : 'false');
      });
    }
  }

  function renderDialogThumbs(product) {
    if (!els.productDialogThumbs) return;
    var photos = productPhotos(product);
    var multiple = photos.length > 1;
    els.productDialogThumbs.hidden = !multiple;
    if (els.productDialogMedia) els.productDialogMedia.classList.toggle('has-thumbs', multiple);
    els.productDialogThumbs.innerHTML = multiple ? photos.map(function (src, i) {
      return '<button type="button" class="product-dialog-thumb" data-photo-index="' + i + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '" aria-label="Ver foto ' + (i + 1) + ' de ' + photos.length + '">' +
        '<img src="' + escapeHTML(src) + '" alt="" width="64" height="64" decoding="async"></button>';
    }).join('') : '';
    if (multiple) showDialogPhoto(product, 0);
  }

  function openProductDialog(id) {
    var product = productById(id);
    if (!product) return;
    renderProductDialog(product);
    openDialog(els.productDialog);

    /* Sempre abre no topo (no celular quem rola é o .product-dialog-shell). */
    var shell = els.productDialog && els.productDialog.querySelector('.product-dialog-shell');
    if (shell) shell.scrollTop = 0;
    if (els.productDialog) els.productDialog.scrollTop = 0;
  }

  function currentPhotoIndex() {
    if (!els.productDialogThumbs) return 0;
    var active = els.productDialogThumbs.querySelector('[aria-pressed="true"]');
    return active ? Number(active.getAttribute('data-photo-index')) : 0;
  }

  /* Avança/volta na galeria (com volta ao início). */
  function stepDialogPhoto(delta) {
    var product = productById(activeProductId);
    if (!product) return;
    var total = productPhotos(product).length;
    if (total < 2) return;
    var next = (currentPhotoIndex() + delta + total) % total;
    showDialogPhoto(product, next);
    var thumb = els.productDialogThumbs && els.productDialogThumbs.children[next];
    if (thumb && thumb.scrollIntoView) thumb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function setupProductDialog() {
    if (!els.productDialog) return;

    if (els.productDialogImg) {
      els.productDialogImg.addEventListener('error', function () {
        els.productDialogImg.hidden = true;
        if (els.productDialogMedia) els.productDialogMedia.classList.add('is-fallback');
      });
    }

    /* Arrastar a foto para o lado troca de imagem (celular). */
    if (els.productDialogMedia) {
      var touchX = null;
      var touchY = null;
      els.productDialogMedia.addEventListener('touchstart', function (event) {
        if (event.touches.length !== 1) return;
        touchX = event.touches[0].clientX;
        touchY = event.touches[0].clientY;
      }, { passive: true });
      els.productDialogMedia.addEventListener('touchend', function (event) {
        if (touchX == null) return;
        var dx = event.changedTouches[0].clientX - touchX;
        var dy = event.changedTouches[0].clientY - touchY;
        touchX = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) stepDialogPhoto(dx < 0 ? 1 : -1);
      });
    }

    /* Setas do teclado trocam a foto quando o foco está na galeria. */
    if (els.productDialogThumbs) {
      els.productDialogThumbs.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        stepDialogPhoto(event.key === 'ArrowRight' ? 1 : -1);
        var active = els.productDialogThumbs.querySelector('[aria-pressed="true"]');
        if (active) active.focus();
      });
    }

    if (els.productDialogThumbs) {
      els.productDialogThumbs.addEventListener('click', function (event) {
        var thumb = event.target.closest('[data-photo-index]');
        var product = productById(activeProductId);
        if (thumb && product) showDialogPhoto(product, Number(thumb.getAttribute('data-photo-index')));
      });
    }

    if (els.productDialogAdd) {
      els.productDialogAdd.addEventListener('click', function () {
        if (!activeProductId) return;
        addToCart(activeProductId);
        closeDialog(els.productDialog);
      });
    }

    /* "Comprar agora": garante o produto na sacola e vai direto para o checkout (entrega + pagamento). */
    if (els.productDialogBuy) {
      els.productDialogBuy.addEventListener('click', function () {
        if (!activeProductId) return;
        var product = productById(activeProductId);
        if (!product || maxQty(product) < 1) {
          toast((product ? product.shortName : 'Produto') + ' está esgotado no momento.');
          return;
        }
        var inCart = state.cart.some(function (item) { return item.id === activeProductId; });
        if (!inCart) {
          state.cart.push({ id: activeProductId, qty: 1 });
          saveCart();
          renderCart();
        }
        closeDialog(els.productDialog);
        openCheckout();
      });
    }
  }

  /* ------------------------------ catálogo ------------------------------ */

  function filteredProducts() {
    var query = normalizeText(state.query.trim());
    var list = PRODUCTS.filter(function (product) {
      if (state.filter !== 'todos' && product.category !== state.filter) return false;
      if (!query) return true;

      var haystack = normalizeText([
        product.name,
        product.shortName,
        product.brand,
        product.model,
        product.code,
        product.summary,
        product.description,
        (product.specs || []).map(function (spec) { return spec.label + ' ' + spec.value; }).join(' '),
        categoryLabel(product.category)
      ].join(' '));

      return haystack.indexOf(query) !== -1;
    });

    if (state.sort === 'price-asc') {
      list.sort(function (a, b) { return salePrice(a) - salePrice(b); });
    } else if (state.sort === 'price-desc') {
      list.sort(function (a, b) { return salePrice(b) - salePrice(a); });
    } else if (state.sort === 'name-asc') {
      list.sort(function (a, b) {
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
    }

    return list;
  }

  function productCard(product, index) {
    var category = categoryLabel(product.category);
    var productName = escapeHTML(product.name);
    var mediaLabel = 'Ver detalhes de ' + product.name + ' — ' + product.brand + ' ' + product.model + (product.illustrative ? '. Imagem ilustrativa' : '');
    return [
      '<article class="product-card" style="--i:' + index + '">',
      '  <button class="product-media visual--' + escapeHTML(product.visual) + (product.image ? '' : ' is-fallback') + '" type="button" data-view="' + escapeHTML(product.id) + '" data-media aria-label="' + escapeHTML(mediaLabel) + '">',
      '    <span class="product-brand" aria-hidden="true">' + escapeHTML(product.brand) + '</span>',
      product.image ? '    <img class="product-photo" src="' + escapeHTML(product.image) + '" alt="' + escapeHTML(product.imageAlt || product.name) + '" loading="lazy" decoding="async" width="700" height="700" data-photo>' : '',
      '    <svg class="product-icon" viewBox="0 0 64 64" aria-hidden="true"><use href="#icon-' + escapeHTML(product.visual) + '"></use></svg>',
      '    <span class="product-model" aria-hidden="true">' + escapeHTML(product.model) + '</span>',
      product.illustrative ? '    <span class="media-note" aria-hidden="true">Imagem ilustrativa</span>' : '',
      '  </button>',
      '  <div class="product-body">',
      '    <p class="product-kicker">' + escapeHTML(category) + ' • Cód. ' + escapeHTML(product.code) + '</p>',
      cardBadges(product),
      '    <h3><button class="product-name" type="button" data-view="' + escapeHTML(product.id) + '">' + productName + '</button></h3>',
      '    <p class="product-desc">' + escapeHTML(product.summary || product.description) + '</p>',
      '    <button class="details-link" type="button" data-view="' + escapeHTML(product.id) + '">',
      '      Ver detalhes',
      '      <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-arrow-right"></use></svg>',
      '    </button>',
      '    <div class="product-bottom">',
      '      <span class="price-wrap">',
      '        <span class="price-label">à vista no PIX</span>',
      priceHTML(product, true),
      '      </span>',
      '      <button class="add-btn" type="button" data-add="' + escapeHTML(product.id) + '" aria-label="' + (maxQty(product) < 1 ? productName + ' esgotado' : 'Adicionar ' + productName + ' à sacola') + '"' + (maxQty(product) < 1 ? ' disabled' : '') + '>',
      '        <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-plus"></use></svg>',
      '      </button>',
      '    </div>',
      '  </div>',
      '</article>'
    ].join('\n');
  }

  function renderProducts() {
    if (!els.productGrid) return;

    var list = filteredProducts();
    var visible = list.slice(0, state.visibleCount);

    els.productGrid.innerHTML = visible.map(productCard).join('');
    Array.prototype.forEach.call(els.productGrid.querySelectorAll('img[data-photo]'), wireImageFallback);

    if (els.catalogEmpty) els.catalogEmpty.hidden = list.length !== 0;
    if (els.loadMore) els.loadMore.hidden = list.length <= visible.length;

    if (els.resultCount) {
      if (!list.length) {
        els.resultCount.textContent = 'Nenhum produto encontrado.';
      } else {
        var filterSuffix = state.filter === 'todos' ? '' : ' em ' + categoryLabel(state.filter);
        if (visible.length < list.length) {
          els.resultCount.textContent = 'Mostrando ' + visible.length + ' de ' + list.length + ' produtos' + filterSuffix + '.';
        } else {
          els.resultCount.textContent = list.length + (list.length === 1 ? ' produto' : ' produtos') + filterSuffix + '.';
        }
      }
    }
  }

  function setFilter(filterId, shouldScroll) {
    var exists = CATEGORIES.some(function (category) {
      return category.id === filterId;
    });
    if (!exists) return;

    state.filter = filterId;
    state.visibleCount = PAGE_SIZE;

    if (els.filterRow) {
      Array.prototype.forEach.call(els.filterRow.querySelectorAll('[data-filter]'), function (chip) {
        var active = chip.dataset.filter === filterId;
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    renderProducts();

    if (shouldScroll) {
      window.setTimeout(function () {
        scrollToSection(document.getElementById('produtos'));
      }, 30);
    }
  }

  function clearFilters() {
    state.filter = 'todos';
    state.query = '';
    state.sort = 'featured';
    state.visibleCount = PAGE_SIZE;

    if (els.searchInput) els.searchInput.value = '';
    if (els.sortSelect) els.sortSelect.value = 'featured';

    if (els.filterRow) {
      Array.prototype.forEach.call(els.filterRow.querySelectorAll('[data-filter]'), function (chip) {
        var active = chip.dataset.filter === 'todos';
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    renderProducts();
    toast('Busca e filtros limpos.');
  }

  /* ------------------------------- checkout ----------------------------- */

  function createOrderId() {
    var random = '';
    var bytes = window.crypto && window.crypto.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(6)) : null;
    for (var i = 0; i < 6; i += 1) random += ((bytes ? bytes[i] : Math.floor(Math.random() * 1e9)) % 36).toString(36);
    return ('AK-' + Date.now().toString(36).slice(-6) + random).toUpperCase();
  }

  function createTxid() {
    return ('AK' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5))
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 25);
  }

  function buildProofMessage(order, customer, registered) {
    var lines = order.items.map(function (item) {
      return '• ' + item.qty + 'x ' + item.product.shortName + ' (cód. ' + item.product.code + ') — ' + formatBRL(item.unit * item.qty);
    });
    var c = customer || {};
    var when = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    return [
      registered ? '🧾 NOVO PEDIDO — Akylla Shop' : 'Olá! Fiz um pedido na Akylla Shop.',
      '',
      'Pedido: ' + order.id,
      'Data: ' + when,
      c.name ? 'Cliente: ' + c.name + (c.phone ? ' · WhatsApp ' + c.phone : '') : '',
      '',
      lines.join('\n'),
      '',
      'Subtotal: ' + formatBRL(order.subtotal),
      order.savings > 0 ? 'Desconto da promoção: ' + formatBRL(order.savings) : '',
      deliveryMessageLines().join('\n'),
      'Total: ' + formatBRL(order.total),
      '',
      registered ? 'Paguei o PIX e vou enviar o comprovante agora. (Pedido registrado no site — produto separado aguardando a confirmação.)\nAcompanhar: ' + trackUrl(order.id) : 'Vou enviar o comprovante do PIX agora.'
    ].filter(function (line, i, all) { return line !== '' || all[i - 1] !== ''; }).join('\n');
  }

  function renderQrCode(payload) {
    if (!els.pixQr) return;

    if (typeof qrFactory !== 'function') {
      els.pixQr.innerHTML = '<p class="pix-qr-fallback">QR indisponível. Use o código copia e cola.</p>';
      return;
    }

    try {
      var qr = qrFactory(0, 'M');
      qr.addData(payload);
      qr.make();
      els.pixQr.innerHTML = qr.createSvgTag({
        cellSize: 4,
        margin: 4,
        scalable: true,
        alt: { text: 'QR Code PIX do pedido ' + (state.order ? state.order.id : '') },
        title: { text: 'PIX Akylla Shop' }
      });
    } catch (error) {
      els.pixQr.innerHTML = '<p class="pix-qr-fallback">Não foi possível gerar o QR. Use o código copia e cola.</p>';
      console.error('Falha ao gerar o QR Code PIX:', error);
    }
  }

  function renderCheckout() {
    var order = state.order;
    if (!order) return;

    var shipping = deliveryFee();
    order.shipping = shipping || 0;
    order.total = order.subtotal + order.shipping;
    var ready = deliveryReady();

    if (els.orderId) els.orderId.textContent = order.id;
    if (els.pixTotal) els.pixTotal.textContent = formatBRL(order.total);
    if (els.checkoutTotal) els.checkoutTotal.textContent = formatBRL(order.total);
    if (els.checkoutSubtotal) els.checkoutSubtotal.textContent = formatBRL(order.subtotal);
    if (els.checkoutShipping) els.checkoutShipping.textContent = shippingSummaryText();
    renderDelivery();
    if (els.restockNote) {
      var later = supplierItems();
      var days = (CONFIG.restock && CONFIG.restock.days) || 2;
      els.restockNote.hidden = !later.length;
      els.restockNote.textContent = later.length ? '📦 ' + later.map(function (i) { return i.product.shortName; }).join(', ') +
        (later.length === 1 ? ' é enviado' : ' são enviados') + ' em até ' + days + (days === 1 ? ' dia útil' : ' dias úteis') + ' (reposição do fornecedor).' : '';
    }
    var auto = mpEnabled();
    if (els.pixBox) els.pixBox.hidden = !ready || auto;
    if (els.pixLocked) els.pixLocked.hidden = ready;
    if (els.mpBox) els.mpBox.hidden = !ready || !auto;
    if (els.manualCustomer) els.manualCustomer.hidden = !ready || auto || !!state.manualSent;
    if (auto) renderMercadoPago(ready);
    renderCard(ready);

    if (els.checkoutItems) {
      els.checkoutItems.innerHTML = order.items.map(function (item) {
        return [
          '<li class="summary-item">',
          '  <div>',
          '    <p class="summary-item-name">' + escapeHTML(item.product.shortName) + '</p>',
          '    <p class="summary-item-meta">' + item.qty + 'x • ' + formatBRL(item.unit) + ' cada' + (item.original > item.unit ? ' <s>' + formatBRL(item.original) + '</s>' : '') + '</p>',
          '    <div class="summary-item-controls">',
          '      <div class="summary-qty" role="group" aria-label="Quantidade de ' + escapeHTML(item.product.shortName) + '">',
          '        <button type="button" data-co-qty="-1" data-id="' + escapeHTML(item.product.id) + '" aria-label="Diminuir quantidade de ' + escapeHTML(item.product.shortName) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-minus"></use></svg></button>',
          '        <span aria-live="polite">' + item.qty + '</span>',
          '        <button type="button" data-co-qty="1" data-id="' + escapeHTML(item.product.id) + '" aria-label="Aumentar quantidade de ' + escapeHTML(item.product.shortName) + '"' + (item.qty >= maxQty(item.product) ? ' disabled' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-plus"></use></svg></button>',
          '      </div>',
          '      <button type="button" class="summary-remove" data-co-remove="' + escapeHTML(item.product.id) + '" aria-label="Remover ' + escapeHTML(item.product.shortName) + ' do pedido"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-trash"></use></svg> Remover</button>',
          '    </div>',
          '  </div>',
          '  <span class="summary-item-price">' + formatBRL(item.unit * item.qty) + '</span>',
          '</li>'
        ].join('\n');
      }).join('');
    }

    if (els.sendProof) {
      els.sendProof.href = whatsappLink(buildProofMessage(order));
      els.sendProof.hidden = auto;
      els.sendProof.setAttribute('aria-disabled', ready ? 'false' : 'true');
      if (ready) els.sendProof.removeAttribute('tabindex'); else els.sendProof.setAttribute('tabindex', '-1');
    }

    if (els.pixKey) els.pixKey.textContent = CONFIG.pixKey || '';
    if (els.pixHolder) els.pixHolder.textContent = CONFIG.pixHolder || '';

    if (!ready || auto) {
      state.pixPayload = '';
      return;
    }

    try {
      state.pixPayload = Pix.buildPixPayload({
        key: CONFIG.pixKey,
        merchantName: CONFIG.pixMerchantName,
        city: CONFIG.pixCity,
        amountCents: order.total,
        txid: order.txid,
        description: 'Pedido ' + order.id
      });

      if (els.pixPayloadPreview) els.pixPayloadPreview.textContent = state.pixPayload;
      renderQrCode(state.pixPayload);
    } catch (error) {
      state.pixPayload = '';
      if (els.pixPayloadPreview) els.pixPayloadPreview.textContent = 'Não foi possível gerar o código PIX.';
      if (els.pixQr) {
        els.pixQr.innerHTML = '<p class="pix-qr-fallback">Use a chave PIX ao lado e informe o valor do pedido.</p>';
      }
      console.error('Falha ao montar o payload PIX:', error);
    }
  }

  /* ------------------------------- entrega ------------------------------ */

  var Frete = window.AkyllaFrete;

  function shippingSettings() {
    return Frete ? Frete.settings(CONFIG) : { enabled: false, pickup: true };
  }

  /* Valor do frete (centavos) já definido, ou null se ainda não há valor. */
  function deliveryFee() {
    var d = state.delivery;
    if (d.mode === 'pickup') return 0;
    if (d.mode === 'delivery' && d.quote && (d.quote.kind === 'distance' || d.quote.kind === 'fixed')) return d.quote.fee;
    return null;
  }

  /* Pode gerar o PIX? Retirada, frete calculado ou frete "a combinar" (PIX só dos produtos). */
  function deliveryReady() {
    var d = state.delivery;
    if (d.mode === 'pickup') return true;
    if (d.mode !== 'delivery' || !d.quote) return false;
    return d.quote.kind === 'distance' || d.quote.kind === 'fixed' || d.quote.kind === 'negotiable' || d.quote.kind === 'carrier';
  }

  function shippingSummaryText() {
    var d = state.delivery;
    if (d.mode === 'pickup') return 'Retirada grátis';
    if (d.mode === 'delivery' && d.quote) {
      if (d.quote.kind === 'negotiable') return 'A combinar';
      if (d.quote.kind === 'carrier') return 'Transportadora (a cotar)';
      if (d.quote.fee != null) return formatBRL(d.quote.fee);
    }
    return '—';
  }

  function addressText(a, complement) {
    if (!a) return '';
    return [a.street, a.number].filter(Boolean).join(', ') + (complement ? ' — ' + complement : '') +
      ' · ' + [a.district, a.city + '/' + a.uf].filter(Boolean).join(', ') + ' · CEP ' + a.cep;
  }

  function deliveryMessageLines() {
    var d = state.delivery;
    if (d.mode === 'pickup') return ['Entrega: retirada na loja (grátis)'];
    if (d.mode !== 'delivery' || !d.quote) return [];
    var q = d.quote;
    var lines = ['Entrega: ' + addressText(q.address, d.complement)];
    if (q.kind === 'distance') lines.push('Frete: ' + formatBRL(q.fee) + ' (' + String(q.km).replace('.', ',') + ' km de ida' + (q.precision !== 'endereço' ? ', aproximado pela ' + q.precision : '') + ')');
    else if (q.kind === 'fixed') lines.push('Frete: ' + formatBRL(q.fee) + ' (' + q.address.city + ')');
    else if (q.kind === 'negotiable') lines.push('Frete: a combinar (' + q.address.city + ') — paguei só os produtos');
    else if (q.kind === 'carrier') lines.push('Frete: transportadora — aguardo a cotação (frete + ' + ((shippingSettings().carrier || {}).feePercent || 0) + '% de taxa administrativa); paguei só os produtos');
    return lines;
  }

  function renderDelivery() {
    var s = shippingSettings();
    var d = state.delivery;
    if (!els.deliveryBox) return;
    if (els.pickupOption) els.pickupOption.hidden = !s.pickup;
    if (els.pickupNote) els.pickupNote.textContent = 'Grátis · ' + (s.pickupNote || '');
    Array.prototype.forEach.call(els.deliveryBox.querySelectorAll('input[name="deliveryMode"]'), function (input) {
      input.checked = input.value === d.mode;
      var option = input.closest('.delivery-option');
      if (option) option.classList.toggle('is-active', input.value === d.mode);
    });
    if (els.deliveryForm) els.deliveryForm.hidden = d.mode !== 'delivery';
    if (els.deliveryCalc) {
      els.deliveryCalc.disabled = d.loading;
      els.deliveryCalc.textContent = d.loading ? 'Calculando…' : (d.quote ? 'Recalcular frete' : 'Calcular frete');
    }
    if (!els.deliveryResult) return;
    var result = els.deliveryResult;
    if (d.mode !== 'delivery' || (!d.quote && !d.error && !d.loading)) { result.hidden = true; return; }
    result.hidden = false;
    result.className = 'delivery-result';
    if (d.loading) { result.textContent = 'Buscando o endereço e calculando a rota…'; return; }
    if (d.error) { result.classList.add('is-error'); result.textContent = d.error; return; }
    var q = d.quote;
    var title = q.kind === 'distance' ? 'Frete: ' + formatBRL(q.fee) + ' · ' + String(q.km).replace('.', ',') + ' km'
      : q.kind === 'fixed' ? 'Frete: ' + formatBRL(q.fee)
      : q.kind === 'negotiable' ? 'Frete a combinar'
      : q.kind === 'carrier' ? 'Envio por transportadora'
      : 'Fora da área de entrega';
    if (q.kind === 'outside') result.classList.add('is-error');
    if (q.kind === 'negotiable' || q.kind === 'carrier') result.classList.add('is-warn');
    result.innerHTML = '<strong>' + escapeHTML(title) + '</strong><span>' + escapeHTML(addressText(q.address, d.complement)) + '</span>' +
      (q.kind === 'negotiable' || q.kind === 'carrier' ? '<span>O PIX abaixo é só dos produtos. O frete é informado e pago à parte pelo WhatsApp, antes do envio.</span>' : '') +
      (q.message ? '<span>' + escapeHTML(q.message) + '</span>' : '');
  }

  function setDeliveryMode(mode) {
    state.delivery.mode = mode;
    state.delivery.error = '';
    renderCheckout();
    if (mode === 'delivery' && els.deliveryCep && !state.delivery.quote) els.deliveryCep.focus();
  }

  function calculateShipping(event) {
    if (event) event.preventDefault();
    if (!Frete) return;
    var cep = els.deliveryCep ? els.deliveryCep.value : '';
    var number = els.deliveryNumber ? els.deliveryNumber.value.trim() : '';
    state.delivery.complement = els.deliveryComplement ? els.deliveryComplement.value.trim() : '';
    if (String(cep).replace(/\D/g, '').length !== 8) { state.delivery.error = 'Digite o CEP com 8 números.'; state.delivery.quote = null; renderCheckout(); return; }
    if (!number) { state.delivery.error = 'Informe o número (ou quadra/lote) do endereço.'; state.delivery.quote = null; renderCheckout(); return; }
    state.delivery.loading = true;
    state.delivery.error = '';
    state.delivery.quote = null;
    renderCheckout();
    Frete.quote({ cep: cep, number: number }, CONFIG).then(function (quote) {
      state.delivery.quote = quote;
    }).catch(function (error) {
      state.delivery.error = (error && error.message && !/HTTP|fetch|rota|Failed/i.test(error.message))
        ? error.message
        : 'Não conseguimos calcular agora. Tente de novo ou combine o frete pelo WhatsApp.';
    }).finally(function () {
      state.delivery.loading = false;
      renderCheckout();
    });
  }

  /* Tabela de fretes da seção "Envio e entrega" (gerada da configuração). */
  function renderShippingTable() {
    if (!Frete) return;
    var s = shippingSettings();
    Array.prototype.forEach.call(document.querySelectorAll('[data-shipping-table] tbody'), function (body) {
      var rows = [];
      var prev = 0;
      var until = s.promoUntil ? s.promoUntil.slice(8, 10) + '/' + s.promoUntil.slice(5, 7) : '';
      s.bands.forEach(function (b) {
        var now = Frete.bandPrice(b, CONFIG);
        var price = now !== b.price ? formatBRL(now) + ' até ' + until + ' (depois ' + formatBRL(b.price) + ')' : formatBRL(b.price);
        rows.push([(prev ? 'Acima de ' + prev + ' até ' : 'Até ') + b.upToKm + ' km (Goiânia)', price]);
        prev = b.upToKm;
      });
      if (prev) rows.push(['Acima de ' + prev + ' km', '+ ' + formatBRL(s.extraStepPrice) + ' a cada ' + s.extraStepKm + ' km']);
      s.cities.forEach(function (c) {
        rows.push([c.name, c.price == null ? 'A combinar' : formatBRL(c.price)]);
      });
      if (s.carrier && s.carrier.enabled) rows.push(['Interior e outras regiões (transportadora)', 'Cotação + ' + s.carrier.feePercent + '% de taxa']);
      if (s.pickup) rows.push(['Retirada na loja', 'Grátis']);
      body.innerHTML = rows.map(function (r) {
        return '<tr><td>' + escapeHTML(r[0]) + '</td><td>' + escapeHTML(r[1]) + '</td></tr>';
      }).join('');
    });
  }

  function setupDelivery() {
    renderShippingTable();
    if (!els.deliveryBox) return;
    var s = shippingSettings();
    if (!s.enabled) {
      state.delivery.mode = 'pickup';
      els.deliveryBox.hidden = true;
    }
    els.deliveryBox.addEventListener('change', function (event) {
      if (event.target.name === 'deliveryMode') setDeliveryMode(event.target.value);
    });
    if (els.deliveryForm) els.deliveryForm.addEventListener('submit', calculateShipping);
    if (els.deliveryCep) {
      els.deliveryCep.addEventListener('input', function () {
        var digits = els.deliveryCep.value.replace(/\D/g, '').slice(0, 8);
        els.deliveryCep.value = digits.length > 5 ? digits.slice(0, 5) + '-' + digits.slice(5) : digits;
      });
    }
    if (els.deliveryComplement) {
      els.deliveryComplement.addEventListener('change', function () {
        state.delivery.complement = els.deliveryComplement.value.trim();
        if (state.order) renderCheckout();
      });
    }
  }

  /* ------------------------- cliente: lembrar dados e pedidos ------------------------- */

  var CUSTOMER_KEY = 'akylla-customer';
  var MY_ORDERS_KEY = 'akylla-my-orders';
  var CARD_PENDING_KEY = 'akylla-card-pending';

  function readLocal(key, fallback) {
    try { var v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function writeLocal(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* sem armazenamento */ }
  }

  /* Preenche nome/WhatsApp/e-mail com o que o cliente usou da última vez neste aparelho. */
  function fillCustomer() {
    var c = readLocal(CUSTOMER_KEY, {});
    [[els.mpName, c.name], [els.manualName, c.name], [els.mpPhone, c.phone], [els.manualPhone, c.phone], [els.mpEmail, c.email]].forEach(function (pair) {
      if (pair[0] && !pair[0].value && pair[1]) pair[0].value = pair[1];
    });
  }
  function rememberCustomer(c) {
    var prev = readLocal(CUSTOMER_KEY, {});
    writeLocal(CUSTOMER_KEY, { name: c.name || prev.name || '', phone: c.phone || prev.phone || '', email: c.email || prev.email || '' });
  }
  function rememberOrder(id, phone, total) {
    var mine = readLocal(MY_ORDERS_KEY, []).filter(function (o) { return o.id !== id; });
    mine.unshift({ id: id, phone: phone || '', total: total || 0, at: Date.now() });
    writeLocal(MY_ORDERS_KEY, mine.slice(0, 10));
  }
  function trackUrl(id) {
    return 'https://akyllashop.com/pedido.html?id=' + encodeURIComponent(id);
  }

  /* Dados do cliente: do bloco visível (PIX automático ou manual). */
  function customerFields() {
    var auto = mpEnabled();
    var name = (auto ? els.mpName : els.manualName) || els.mpName || els.manualName;
    var phone = (auto ? els.mpPhone : els.manualPhone) || els.mpPhone || els.manualPhone;
    return {
      nameInput: name,
      name: name ? name.value.replace(/\s+/g, ' ').trim() : '',
      phone: phone ? phone.value.trim() : '',
      email: auto && els.mpEmail ? els.mpEmail.value.trim() : ''
    };
  }

  /* ------------------------- cartão de crédito (Mercado Pago) ------------------------- */

  function cardConfig() {
    var c = CONFIG.card || {};
    return {
      enabled: !!c.enabled && !!CONFIG.paymentApiUrl,
      max: Math.min(12, Math.max(1, Math.floor(Number(c.maxInstallments) || 12))),
      fee: Math.min(20, Math.max(0, Number(c.feePercent) || 0))
    };
  }
  function cardTotalFor(base) {
    return Math.ceil(base / (1 - cardConfig().fee / 100)); // a loja recebe o preço do PIX

  }

  var cardBusy = false;
  function renderCard(ready) {
    if (!els.cardBox) return;
    var cfg = cardConfig();
    var paying = state.mp && state.mp.order && state.mp.order.status === 'pending';
    var done = (state.mp && state.mp.done) || !!state.manualSent;
    els.cardBox.hidden = !cfg.enabled || !ready || paying || done || !state.order;
    if (els.cardBox.hidden) return;
    var total = cardTotalFor(state.order.total);
    if (els.cardPrice) els.cardPrice.textContent = formatBRL(total) + ' em até ' + cfg.max + 'x no cartão';
    if (els.cardNote) {
      els.cardNote.textContent = 'Pagamento na página segura do Mercado Pago. ' +
        (cfg.fee ? 'No cartão o valor tem acréscimo de ' + (Math.round((1 / (1 - cfg.fee / 100) - 1) * 10000) / 100).toLocaleString('pt-BR') + '% (no PIX sai ' + formatBRL(state.order.total) + '). ' : '') +
        'Os juros do parcelamento são do cartão e aparecem antes de você confirmar.';
    }
    if (els.cardPay) {
      els.cardPay.disabled = cardBusy;
      els.cardPay.textContent = cardBusy ? 'Abrindo o Mercado Pago…' : 'Pagar ' + formatBRL(total) + ' no cartão';
    }
  }

  function cardFail(message) {
    if (!els.cardError) return;
    els.cardError.textContent = message;
    els.cardError.hidden = !message;
  }

  function payWithCard() {
    if (cardBusy || !state.order) return;
    var c = customerFields();
    if (c.name.length < 3) {
      cardFail('Informe seu nome completo (logo acima) para pagar no cartão.');
      if (c.nameInput) c.nameInput.focus();
      return;
    }
    cardFail('');
    var d = state.delivery;
    cardBusy = true;
    renderCheckout();
    cancelOpenCard().then(function () { return mpApi('/api/card-orders', {
      method: 'POST',
      body: {
        items: state.cart.map(function (i) { return { id: i.id, qty: i.qty }; }),
        delivery: d.mode === 'pickup' ? { mode: 'pickup' } : {
          mode: 'delivery',
          cep: d.quote ? d.quote.address.cep : '',
          number: d.quote ? d.quote.address.number : '',
          complement: d.complement || ''
        },
        email: c.email,
        customer: { name: c.name, phone: c.phone }
      }
    }); }).then(function (order) {
      rememberCustomer(c);
      rememberOrder(order.id, c.phone, order.total);
      writeLocal(CARD_PENDING_KEY, order.id);
      /* passa pela página do pedido: assim a seta "voltar" do navegador, na página do Mercado Pago, cai no pedido (concluir, trocar para PIX ou cancelar) */
      try { window.sessionStorage.setItem('akylla-go', order.checkoutUrl); } catch (e) { window.location.href = order.checkoutUrl; return; }
      cardBusy = false;
      window.location.href = 'pedido.html?id=' + encodeURIComponent(order.id);
    }).catch(function (error) {
      cardBusy = false;
      cardFail(error.status ? error.message : 'Não conseguimos abrir o pagamento no cartão agora. Tente de novo ou pague no PIX.');
      renderCheckout();
    });
  }

  /* ------------------------- PIX automático (Mercado Pago) ------------------------- */

  function mpEnabled() {
    return !state.mp.manual && CONFIG.paymentProvider === 'mercadopago' && !!CONFIG.paymentApiUrl;
  }

  function mpApi(path, options) {
    var base = String(CONFIG.paymentApiUrl || '').replace(/\/+$/, '');
    var opts = options || {};
    return fetch(base + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var error = new Error(data.error || 'Erro ' + res.status);
          error.status = res.status;
          throw error;
        }
        return data;
      });
    });
  }

  /* O que define o pedido no servidor: itens + entrega. Mudou → precisa de novo PIX. */
  function mpSignature() {
    var d = state.delivery;
    return JSON.stringify({
      items: state.cart.map(function (i) { return [i.id, i.qty]; }),
      mode: d.mode,
      cep: d.mode === 'delivery' && d.quote ? d.quote.address.cep : '',
      number: d.mode === 'delivery' && d.quote ? d.quote.address.number : ''
    });
  }

  function mpStopTimers() {
    clearInterval(state.mp.timer);
    clearInterval(state.mp.countdown);
    state.mp.timer = null;
    state.mp.countdown = null;
  }

  function mpReset(message) {
    var order = state.mp.order;
    mpStopTimers();
    if (order && order.status === 'pending') {
      mpApi('/api/orders/' + order.id + '/cancel', { method: 'POST' }).catch(function () {});
    }
    state.mp.order = null;
    state.mp.signature = '';
    state.mp.error = message || '';
  }

  function renderMercadoPago(ready) {
    var mp = state.mp;
    if (mp.order && mp.order.status === 'pending' && mp.signature !== mpSignature() && !mp.done) {
      mpReset('Seu pedido mudou. Gere um novo PIX com o valor atualizado.');
    }
    var order = mp.order;
    var paying = !!order && order.status === 'pending';
    if (els.mpStart) els.mpStart.hidden = !ready || paying || mp.done;
    if (els.mpPay) els.mpPay.hidden = !paying || mp.done;
    if (els.mpDone) els.mpDone.hidden = !mp.done;
    if (els.mpCreate) {
      els.mpCreate.disabled = mp.busy;
      els.mpCreate.textContent = mp.busy ? 'Gerando PIX…' : 'Gerar PIX de ' + formatBRL(state.order ? state.order.total : 0);
    }
    if (els.mpError) els.mpError.hidden = !mp.error;
    if (els.mpErrorText) els.mpErrorText.textContent = mp.error || '';
    if (els.checkoutDialog) els.checkoutDialog.classList.toggle('is-paying', paying || mp.done);
    if (els.checkoutSteps) {
      els.checkoutSteps.innerHTML = '<li><span>1</span> Gere o PIX e pague no app do seu banco.</li>' +
        '<li><span>2</span> A confirmação é automática (Mercado Pago) e o estoque é baixado na hora.</li>' +
        '<li><span>3</span> Envie o pedido no WhatsApp para combinarmos a entrega ou a retirada.</li>';
    }
    if (paying) {
      if (els.mpQr && order.pix && order.pix.image) els.mpQr.src = order.pix.image;
      if (els.mpCode) els.mpCode.textContent = (order.pix && order.pix.code) || '';
      if (els.mpTotal) els.mpTotal.textContent = formatBRL(order.total);
    }
  }

  function mpCreate() {
    if (state.mp.busy || !state.order) return;
    var name = els.mpName ? els.mpName.value.replace(/\s+/g, ' ').trim() : '';
    if (name.length < 3) {
      state.mp.error = 'Informe seu nome completo para gerar o PIX.';
      renderCheckout();
      if (els.mpName) els.mpName.focus();
      return;
    }
    var d = state.delivery;
    state.mp.busy = true;
    state.mp.error = '';
    renderCheckout();
    var delivery = d.mode === 'pickup' ? { mode: 'pickup' } : {
      mode: 'delivery',
      cep: d.quote ? d.quote.address.cep : '',
      number: d.quote ? d.quote.address.number : '',
      complement: d.complement || ''
    };
    mpApi('/api/orders', {
      method: 'POST',
      body: {
        items: state.cart.map(function (i) { return { id: i.id, qty: i.qty }; }),
        delivery: delivery,
        email: els.mpEmail ? els.mpEmail.value.trim() : '',
        customer: { name: name, phone: els.mpPhone ? els.mpPhone.value : '' }
      }
    }).then(function (order) {
      rememberCustomer({ name: name, phone: els.mpPhone ? els.mpPhone.value.trim() : '', email: els.mpEmail ? els.mpEmail.value.trim() : '' });
      rememberOrder(order.id, els.mpPhone ? els.mpPhone.value.trim() : '', order.total);
      state.mp.order = order;
      state.mp.signature = mpSignature();
      if (state.order && order.total !== state.order.total) {
        toast('Valor confirmado pelo servidor: ' + formatBRL(order.total) + '.');
      }
      mpStartPolling();
    }).catch(function (error) {
      var offline = !error.status;
      state.mp.error = offline
        ? 'Não conseguimos gerar o PIX automático agora. Tente de novo ou pague com o PIX manual (confirmação pelo WhatsApp).'
        : error.message;
      if (els.mpManual) els.mpManual.hidden = !offline && error.status !== 500;
    }).finally(function () {
      state.mp.busy = false;
      renderCheckout();
    });
  }

  function mpStartPolling() {
    mpStopTimers();
    var tick = function () {
      var order = state.mp.order;
      if (!order) return;
      var left = Math.max(0, order.expiresAt - Date.now());
      var min = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
      if (els.mpExpire) els.mpExpire.textContent = left ? 'O PIX vale por mais ' + min + ':' + String(sec).padStart(2, '0') + ' min.' : 'PIX expirado.';
    };
    tick();
    state.mp.countdown = setInterval(tick, 1000);
    state.mp.timer = setInterval(mpCheck, 4000);
  }

  function mpCheck() {
    var order = state.mp.order;
    if (!order) return;
    mpApi('/api/orders/' + order.id).then(function (fresh) {
      if (!state.mp.order || state.mp.order.id !== fresh.id) return;
      if (fresh.status === 'paid') {
        mpStopTimers();
        state.mp.order = fresh;
        mpPaid(fresh);
      } else if (fresh.status === 'expired') {
        mpStopTimers();
        state.mp.order = null;
        state.mp.error = 'O PIX expirou sem pagamento. Gere um novo para continuar.';
        renderCheckout();
      } else if (fresh.status === 'review') {
        mpStopTimers();
        state.mp.error = 'Recebemos um pagamento que precisa de conferência. Fale com a gente no WhatsApp informando o pedido ' + fresh.id + '.';
        renderCheckout();
      }
    }).catch(function () { /* rede instável: tenta de novo no próximo ciclo */ });
  }

  function mpPaid(order) {
    state.mp.done = true;
    var lines = order.lines.map(function (l) { return '• ' + l.qty + 'x ' + l.name + ' (cód. ' + l.code + ') — ' + formatBRL(l.unit * l.qty); });
    var d = order.delivery || {};
    var deliveryLine = d.mode === 'pickup' ? 'Entrega: retirada na loja'
      : 'Entrega: ' + [d.address && d.address.street, d.address && d.address.number].filter(Boolean).join(', ') + (d.complement ? ' — ' + d.complement : '') +
        (d.address ? ' · ' + d.address.district + ', ' + d.address.city + '/' + d.address.uf + ' · CEP ' + d.address.cep : '') +
        (d.kind === 'carrier' ? '\nFrete: transportadora — aguardo a cotação' : d.kind === 'negotiable' ? '\nFrete: a combinar' : '\nFrete: ' + formatBRL(order.shipping));
    var message = ['Olá! Meu pagamento foi confirmado na Akylla Shop ✅', '', 'Pedido: ' + order.id, '', lines.join('\n'), '',
      deliveryLine, 'Total pago: ' + formatBRL(order.total) + ' (Mercado Pago #' + order.paymentId + ')'].join('\n');
    if (els.mpWhats) els.mpWhats.href = whatsappLink(message + '\nAcompanhar: ' + trackUrl(order.id));
    if (els.mpTrack) els.mpTrack.href = 'pedido.html?id=' + encodeURIComponent(order.id);
    if (els.mpDoneText) els.mpDoneText.textContent = 'Pedido ' + order.id + ' · ' + formatBRL(order.total) + '. Agora é só enviar o pedido no WhatsApp para combinarmos a ' + (d.mode === 'pickup' ? 'retirada.' : 'entrega.');
    state.cart = [];
    saveCart();
    renderCart();
    renderCheckout();
    toast('Pagamento confirmado! Obrigado pela compra.');
  }

  /* Pedido no cartão deixado em aberto neste aparelho (cliente voltou sem pagar). */
  function openCard() {
    var id = readLocal(CARD_PENDING_KEY, '');
    if (!id) return null;
    var mine = readLocal(MY_ORDERS_KEY, []).find(function (o) { return o.id === id; }) || {};
    return { id: id, phone: mine.phone || '' };
  }

  function forgetOpenCard() {
    try { window.localStorage.removeItem(CARD_PENDING_KEY); } catch (e) { /* ok */ }
    if (els.resumeBar) els.resumeBar.hidden = true;
    if (els.ordersDot) els.ordersDot.hidden = true;
  }

  function cancelOpenCard() {
    var open = openCard();
    if (!open || !CONFIG.paymentApiUrl) return Promise.resolve();
    return mpApi('/api/track/cancel', { method: 'POST', body: { id: open.id, phone: open.phone } })
      .catch(function () { return null; })
      .then(function () { forgetOpenCard(); });
  }

  function checkOpenCard() {
    var open = openCard();
    if (!open || !CONFIG.paymentApiUrl) return;
    mpApi('/api/track?id=' + encodeURIComponent(open.id) + '&phone=' + encodeURIComponent(open.phone)).then(function (o) {
      if (o.status === 'paid') {
        state.cart = [];
        saveCart();
        renderCart();
        forgetOpenCard();
        toast('Pagamento do pedido ' + o.id + ' confirmado! Acompanhe em Meus pedidos.');
        return;
      }
      if (o.status !== 'pending' || !o.checkoutUrl) { forgetOpenCard(); return; }
      if (els.ordersDot) els.ordersDot.hidden = false;
      if (!els.resumeBar) return;
      els.resumeText.textContent = '— pedido ' + o.id + ', ' + formatBRL(o.total) + '. O produto fica reservado até ' +
        new Date(o.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.';
      els.resumePay.href = o.checkoutUrl;
      els.resumeBar.hidden = false;
    }).catch(function (err) { if (err.status === 404) forgetOpenCard(); });
  }

  function setupCard() {
    if (els.resumeCancel) {
      els.resumeCancel.addEventListener('click', function () {
        if (!window.confirm('Cancelar este pedido? Os produtos continuam na sua sacola para você pagar de outro jeito.')) return;
        cancelOpenCard().then(function () { toast('Pedido cancelado. Os produtos continuam na sua sacola.'); });
      });
    }
    if (els.resumePix) {
      els.resumePix.addEventListener('click', function () {
        cancelOpenCard().then(function () { openCheckout(); toast('Pedido no cartão cancelado. Escolha a entrega e pague no PIX.'); });
      });
    }
    checkOpenCard();
    var cfg = cardConfig();
    Array.prototype.forEach.call(document.querySelectorAll('[data-card-only]'), function (n) { n.hidden = !cfg.enabled; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-card-max]'), function (n) { n.textContent = String(cfg.max); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-card-label]'), function (n) { n.textContent = 'Cartão em até ' + cfg.max + 'x'; });
    if (els.cardPay) els.cardPay.addEventListener('click', payWithCard);
    fillCustomer();
  }

  function setupMercadoPago() {
    if (els.mpCreate) els.mpCreate.addEventListener('click', mpCreate);
    if (els.mpCopy) els.mpCopy.addEventListener('click', function () {
      if (state.mp.order && state.mp.order.pix) copyText(state.mp.order.pix.code, 'Código PIX copiado. Cole no app do seu banco.');
    });
    if (els.mpCancel) els.mpCancel.addEventListener('click', function () {
      mpReset('PIX cancelado. Altere o pedido e gere um novo PIX.');
      renderCheckout();
    });
    if (els.mpManual) els.mpManual.addEventListener('click', function () {
      state.mp.manual = true;
      state.mp.error = '';
      renderCheckout();
    });
  }

  function refreshOrderFromCart() {
    if (state.mp.done || state.manualSent) return;
    var items = getCartItems();
    if (!items.length) {
      state.order = null;
      closeDialog(els.checkoutDialog);
      renderCart();
      toast('Seu pedido ficou vazio. Escolha um produto para continuar.');
      return;
    }
    items = items.map(function (item) {
      var info = priceInfo(item.product);
      return { product: item.product, qty: item.qty, unit: info.price, original: info.original };
    });
    state.order.items = items;
    state.order.subtotal = items.reduce(function (total, item) { return total + item.unit * item.qty; }, 0);
    state.order.savings = items.reduce(function (total, item) { return total + (item.original - item.unit) * item.qty; }, 0);
    renderCheckout();
  }

  function openCheckout() {
    if (state.manualSent) {
      state.manualSent = '';
      if (els.pixLocked) {
        els.pixLocked.classList.remove('is-sent');
        els.pixLocked.textContent = 'Escolha a retirada ou calcule o frete acima para ver as formas de pagamento com o valor certo.';
      }
      if (els.checkoutDialog) els.checkoutDialog.classList.remove('is-paying');
    }
    if (state.mp.done) {
      state.mp = { order: null, signature: '', timer: null, countdown: null, busy: false, error: '', manual: false, done: false };
      state.delivery.quote = state.delivery.mode === 'delivery' ? state.delivery.quote : null;
    }
    var items = getCartItems();
    if (!items.length) {
      toast('Sua sacola está vazia. Escolha um produto primeiro.');
      return;
    }

    items = items.map(function (item) {
      var info = priceInfo(item.product);
      return { product: item.product, qty: item.qty, unit: info.price, original: info.original };
    });

    state.order = {
      id: createOrderId(),
      txid: createTxid(),
      items: items,
      subtotal: items.reduce(function (total, item) {
        return total + item.unit * item.qty;
      }, 0),
      shipping: 0,
      total: 0,
      savings: items.reduce(function (total, item) {
        return total + (item.original - item.unit) * item.qty;
      }, 0)
    };

    if (!state.order.subtotal) {
      state.order = null;
      toast('Não foi possível montar o pedido. Tente novamente.');
      return;
    }

    renderCheckout();

    closeDialog(els.cartDrawer);
    openDialog(els.checkoutDialog);

    if (els.checkoutDialog) {
      els.checkoutDialog.scrollTop = 0;
    }
  }

  /* ------------------------------ clipboard ----------------------------- */

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();

    var copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }

    area.remove();
    return copied;
  }

  function copyText(text, successMessage) {
    if (!text) {
      toast('O código ainda não foi gerado.');
      return;
    }

    var fallback = function () {
      var copied = fallbackCopy(text);
      toast(copied ? successMessage : 'Não foi possível copiar. Selecione o código manualmente.');
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        toast(successMessage);
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  /* ------------------------------- download ----------------------------- */

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function downloadQrCode() {
    var svg = els.pixQr ? els.pixQr.querySelector('svg') : null;
    if (!svg) {
      toast('O QR Code ainda não está disponível.');
      return;
    }

    // O SVG renderizado é escalável (sem width/height); rasterizadores precisam
    // de dimensões intrínsecas, senão o PNG sai em branco em alguns navegadores.
    var sizedSvg = svg.cloneNode(true);
    var viewBox = svg.getAttribute('viewBox') || '';
    var intrinsicSize = Number(viewBox.split(/\s+/)[2]) || 0;
    if (intrinsicSize) {
      sizedSvg.setAttribute('width', String(intrinsicSize));
      sizedSvg.setAttribute('height', String(intrinsicSize));
    }

    var serialized = new XMLSerializer().serializeToString(sizedSvg);
    var svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    var svgUrl = URL.createObjectURL(svgBlob);
    var filenameBase = 'akylla-pix-' + (state.order ? state.order.id : 'pedido');

    var image = new Image();
    image.onload = function () {
      var size = 800;
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var context = canvas.getContext('2d');

      if (!context) {
        URL.revokeObjectURL(svgUrl);
        triggerDownload(svgBlob, filenameBase + '.svg');
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      URL.revokeObjectURL(svgUrl);

      canvas.toBlob(function (pngBlob) {
        if (pngBlob) {
          triggerDownload(pngBlob, filenameBase + '.png');
          toast('QR Code baixado em PNG.');
        } else {
          triggerDownload(svgBlob, filenameBase + '.svg');
        }
      }, 'image/png');
    };

    image.onerror = function () {
      URL.revokeObjectURL(svgUrl);
      triggerDownload(svgBlob, filenameBase + '.svg');
      toast('QR Code baixado em SVG.');
    };

    image.src = svgUrl;
  }

  /* -------------------------------- eventos ----------------------------- */

  function setupCatalog() {
    if (els.searchInput) {
      els.searchInput.addEventListener('input', function () {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(function () {
          state.query = els.searchInput.value;
          state.visibleCount = PAGE_SIZE;
          renderProducts();
        }, 140);
      });
    }

    if (els.clearFilters) {
      els.clearFilters.addEventListener('click', clearFilters);
    }

    if (els.sortSelect) {
      els.sortSelect.addEventListener('change', function () {
        state.sort = els.sortSelect.value;
        state.visibleCount = PAGE_SIZE;
        renderProducts();
      });
    }

    if (els.filterRow) {
      els.filterRow.addEventListener('click', function (event) {
        var chip = event.target.closest('[data-filter]');
        if (!chip) return;
        setFilter(chip.dataset.filter, false);
      });
    }

    if (els.loadMore) {
      els.loadMore.addEventListener('click', function () {
        state.visibleCount += PAGE_SIZE;
        renderProducts();

        if (els.loadMore.hidden === false) {
          var focusTarget = els.productGrid.querySelector('.product-card:nth-child(' + (state.visibleCount - PAGE_SIZE + 1) + ')');
          if (focusTarget) {
            focusTarget.setAttribute('tabindex', '-1');
            focusTarget.focus({ preventScroll: true });
          }
        }
      });
    }

    if (els.productGrid) {
      els.productGrid.addEventListener('click', function (event) {
        var viewButton = event.target.closest('[data-view]');
        if (viewButton) {
          openProductDialog(viewButton.dataset.view);
          return;
        }

        var button = event.target.closest('[data-add]');
        if (!button) return;

        addToCart(button.dataset.add);

        var original = button.innerHTML;
        button.classList.add('is-added');
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-check"></use></svg>';
        window.setTimeout(function () {
          if (!button.isConnected) return;
          button.classList.remove('is-added');
          button.innerHTML = original;
        }, 1100);
      });
    }

    var filterLinks = document.querySelectorAll('[data-filter-link]');
    Array.prototype.forEach.call(filterLinks, function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        var menu = link.closest('dialog');
        if (menu && menu.open) closeDialog(menu);
        setFilter(link.dataset.filterLink, true);
      });
    });

    if (els.searchShortcut) {
      els.searchShortcut.addEventListener('click', function () {
        scrollToSection(document.getElementById('produtos'));
        window.setTimeout(function () {
          if (els.searchInput) els.searchInput.focus({ preventScroll: true });
        }, 420);
      });
    }
  }

  function setupCart() {
    var barOpen = document.getElementById('cartBarOpen');
    var barCheckout = document.getElementById('cartBarCheckout');
    if (barOpen) barOpen.addEventListener('click', function () { renderCart(); openDialog(els.cartDrawer); });
    if (barCheckout) barCheckout.addEventListener('click', function () { openCheckout(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-open-shipping]'), function (link) {
      link.addEventListener('click', function () {
        var box = document.getElementById('tabela-frete');
        if (box) box.open = true;
      });
    });

    if (els.cartOpen) {
      els.cartOpen.addEventListener('click', function () {
        renderCart();
        openDialog(els.cartDrawer);
      });
    }

    if (els.cartItems) {
      els.cartItems.addEventListener('click', function (event) {
        var quantityButton = event.target.closest('[data-qty]');
        if (quantityButton) {
          changeQuantity(quantityButton.dataset.id, Number(quantityButton.dataset.qty));
          return;
        }

        var removeButton = event.target.closest('[data-remove]');
        if (removeButton) {
          removeFromCart(removeButton.dataset.remove);
        }
      });
    }

    if (els.checkoutBtn) {
      els.checkoutBtn.addEventListener('click', openCheckout);
    }

    if (els.emptyBrowse) {
      els.emptyBrowse.addEventListener('click', function () {
        closeDialog(els.cartDrawer);
        window.setTimeout(function () {
          scrollToSection(document.getElementById('produtos'));
        }, 60);
      });
    }
  }

  function manualFail(message) {
    if (els.manualError) {
      els.manualError.textContent = message;
      els.manualError.hidden = !message;
    }
  }

  function finishManual(id, link, win) {
    var c = customerFields();
    rememberCustomer(c);
    rememberOrder(id, c.phone, state.order ? state.order.total : 0);
    if (win && !win.closed) win.location.href = link; else window.location.href = link;
    state.manualSent = id;
    state.cart = [];
    saveCart();
    renderCart();
    showManualSent(id);
  }

  var sendingManual = false;
  function sendManualOrder() {
    if (sendingManual || !state.order) return;
    var name = els.manualName ? els.manualName.value.replace(/\s+/g, ' ').trim() : '';
    var phone = els.manualPhone ? els.manualPhone.value.trim() : '';
    if (name.length < 3) {
      manualFail('Informe seu nome completo para registrarmos o pedido.');
      if (els.manualName) els.manualName.focus();
      return;
    }
    manualFail('');
    var customer = { name: name, phone: phone };
    var order = state.order;
    var api = String(CONFIG.paymentApiUrl || '').replace(/\/+$/, '');
    if (!api) {
      finishManual(order.id, whatsappLink(buildProofMessage(order, customer, false)), null);
      return;
    }

    /* abre a aba já no clique (o navegador bloqueia janelas abertas depois de esperar a internet) */
    var win = window.open('', '_blank');
    var d = state.delivery;
    sendingManual = true;
    if (els.sendProof) els.sendProof.setAttribute('aria-busy', 'true');
    fetch(api + '/api/manual-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        items: state.cart.map(function (i) { return { id: i.id, qty: i.qty }; }),
        delivery: d.mode === 'pickup' ? { mode: 'pickup' } : {
          mode: 'delivery',
          cep: d.quote ? d.quote.address.cep : '',
          number: d.quote ? d.quote.address.number : '',
          complement: d.complement || ''
        },
        customer: customer
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var e = new Error(data.error || 'Erro ' + res.status); e.status = res.status; throw e; }
        return data;
      });
    }).then(function (saved) {
      if (saved.id && saved.id !== order.id) order.id = saved.id;
      if (saved.total && saved.total !== order.total) {
        toast('Valor conferido pelo sistema: ' + formatBRL(saved.total) + '.');
      }
      finishManual(order.id, whatsappLink(buildProofMessage(order, customer, true)), win);
    }).catch(function (error) {
      if (error.status === 409 || error.status === 429 || error.status === 400) {
        if (win) win.close();
        manualFail(error.message);
        return;
      }
      /* servidor fora do ar: o pedido segue pelo WhatsApp mesmo assim (a loja ajusta o estoque no painel) */
      finishManual(order.id, whatsappLink(buildProofMessage(order, customer, false)), win);
    }).finally(function () {
      sendingManual = false;
      if (els.sendProof) els.sendProof.removeAttribute('aria-busy');
    });
  }

  function showManualSent(id) {
    if (els.pixBox) els.pixBox.hidden = true;
    if (els.pixLocked) {
      els.pixLocked.hidden = false;
      els.pixLocked.classList.add('is-sent');
      els.pixLocked.textContent = 'Pedido ' + id + ' registrado e produto separado para você! Envie o comprovante na conversa do WhatsApp que abriu. Vamos conferir o pagamento e responder para combinar a ' +
        (state.delivery.mode === 'pickup' ? 'retirada.' : 'entrega.');
    }
    if (els.checkoutDialog) els.checkoutDialog.classList.add('is-paying');
    if (els.sendProof) els.sendProof.hidden = true;
  }

  function setupCheckout() {
    if (els.checkoutItems) {
      els.checkoutItems.addEventListener('click', function (event) {
        var qty = event.target.closest('[data-co-qty]');
        var remove = event.target.closest('[data-co-remove]');
        if (qty) {
          changeQuantity(qty.getAttribute('data-id'), Number(qty.getAttribute('data-co-qty')));
          refreshOrderFromCart();
        } else if (remove) {
          removeFromCart(remove.getAttribute('data-co-remove'));
          refreshOrderFromCart();
        }
      });
    }

    if (els.sendProof) {
      els.sendProof.addEventListener('click', function (event) {
        if (els.sendProof.getAttribute('aria-disabled') === 'true') {
          event.preventDefault();
          toast('Escolha a retirada ou calcule o frete primeiro.');
          return;
        }
        /* PIX manual: registra o pedido no servidor (o estoque fica reservado até a loja confirmar)
           e abre o WhatsApp da loja com o pedido completo. */
        event.preventDefault();
        sendManualOrder();
      });
    }

    if (els.copyKey) {
      els.copyKey.addEventListener('click', function () {
        copyText(CONFIG.pixKey, 'Chave PIX copiada.');
      });
    }

    if (els.copyPix) {
      els.copyPix.addEventListener('click', function () {
        copyText(state.pixPayload, 'Código PIX copiado. Cole no app do seu banco.');
      });
    }

    if (els.downloadQr) {
      els.downloadQr.addEventListener('click', downloadQrCode);
    }

    if (els.backToCart) {
      els.backToCart.addEventListener('click', function () {
        closeDialog(els.checkoutDialog);
        renderCart();
        openDialog(els.cartDrawer);
      });
    }
  }

  function setupDialogs() {
    if (els.menuToggle) {
      els.menuToggle.addEventListener('click', function () {
        openDialog(els.mobileMenu);
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) closeDialog(dialog);
      });
      dialog.addEventListener('close', dialogClosed);
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-close-dialog]'), function (button) {
      button.addEventListener('click', function () {
        var dialog = document.getElementById(button.dataset.closeDialog);
        closeDialog(dialog);
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-close-mobile]'), function (link) {
      link.addEventListener('click', function () {
        if (els.mobileMenu && els.mobileMenu.open) closeDialog(els.mobileMenu);
      });
    });
  }

  function setupReveal() {
    var elements = document.querySelectorAll([
      '.section-head',
      '.about-copy',
      '.about-stats',
      '.step-card',
      '.policy-card',
      '.faq-intro',
      '.faq-list',
      '.cta-final-copy'
    ].join(','));

    Array.prototype.forEach.call(elements, function (element) {
      element.classList.add('reveal');
    });

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(elements, function (element) {
        element.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 14% 0px' });

    Array.prototype.forEach.call(elements, function (element) {
      observer.observe(element);
    });
  }

  function setupGlobalLinks() {
    var defaultLink = whatsappLink(CONFIG.whatsappMessage);
    Array.prototype.forEach.call(document.querySelectorAll('a[data-whatsapp]'), function (link) {
      link.href = defaultLink;
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (element) {
      element.textContent = String(CONFIG.year || new Date().getFullYear());
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-whatsapp-display]'), function (element) {
      element.textContent = CONFIG.whatsappDisplay || '';
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-catalog-count]'), function (element) {
      element.textContent = String(PRODUCTS.length);
    });

    /* Preços citados fora do catálogo (ex.: cards do hero) vêm do products.js. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-price-of]'), function (element) {
      var product = productById(element.getAttribute('data-price-of'));
      if (product) element.textContent = formatBRL(salePrice(product));
    });

    if (els.pixKey) els.pixKey.textContent = CONFIG.pixKey || '';
    if (els.pixHolder) els.pixHolder.textContent = CONFIG.pixHolder || '';
    renderPromoBanners();
  }

  /* Faixas da promoção no topo e no catálogo (somem se não houver promoção ativa). */
  function renderPromoBanners() {
    var info = window.AkyllaPromo ? window.AkyllaPromo.summary(PRODUCTS, CONFIG) : { active: false };
    var day = info.active && info.until ? window.AkyllaPromo.formatDay(info.until) : '';
    var pct = info.active ? percentText(info.maxPercent) + ' OFF' : '';
    var scope = info.count === info.total ? 'em todos os produtos' : 'em ' + info.count + ' produtos';
    var detail = info.active ? (info.uniform ? pct : 'até ' + pct) + ' ' + scope + (day ? ' · válido até ' + day : '') : '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-promo-banner]'), function (banner) {
      banner.hidden = !info.active;
      if (!info.active) return;
      var title = banner.querySelector('[data-promo-title]');
      var text = banner.querySelector('[data-promo-detail]');
      if (title) title.textContent = info.text || 'Promoção';
      if (text) text.textContent = detail;
    });
  }

  /* --------------------------------- init ------------------------------- */

  state.cart = loadCart();
  setupGlobalLinks();
  renderProducts();
  renderCart();
  setupCatalog();
  setupCart();
  setupProductDialog();
  setupCheckout();
  setupDelivery();
  setupMercadoPago();
  setupCard();
  setupDialogs();
  setupReveal();

  /* veio da página do pedido ("Prefiro pagar no PIX"): abre o checkout com a sacola */
  if (/[?&]pagar=pix/.test(window.location.search)) {
    try { history.replaceState(null, '', window.location.pathname); } catch (e) { /* ok */ }
    if (state.cart.length) openCheckout();
  }

  /* voltou para a loja pela seta do navegador (página guardada em cache): destrava o botão do cartão e confere o pedido aberto */
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    cardBusy = false;
    if (state.order) renderCheckout();
    checkOpenCard();
  });

  if (els.header) {
    var updateHeader = function () {
      els.header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    state.cart = loadCart();
    renderCart();
  });
})();
