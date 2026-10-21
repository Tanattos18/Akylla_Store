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
  var PAGE_SIZE = 8;

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
    pixPayload: ''
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
  function priceHTML(product) {
    var info = priceInfo(product);
    if (!info.active) {
      return '        <span class="price">' + formatBRL(info.price) + '</span>';
    }
    return [
      '        <span class="price-old"><span class="sr-only">De </span><s>' + formatBRL(info.original) + '</s>',
      '          <span class="discount-badge">-' + percentText(info.percent) + '</span></span>',
      '        <span class="price"><span class="sr-only">Por </span>' + formatBRL(info.price) + '</span>',
      promoUntilText(info) ? '        <span class="price-until">Promoção ' + escapeHTML(promoUntilText(info)) + '</span>' : ''
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

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    syncBodyLock();
  }

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

  /* Estoque vem da planilha (campo `stock`). Sem o campo, não limita. */
  function maxQty(product) {
    return product && typeof product.stock === 'number' ? Math.max(0, Math.min(99, product.stock)) : 99;
  }

  function stockInfo(product) {
    var stock = maxQty(product);
    if (typeof product.stock !== 'number') return null;
    if (stock <= 0) return { text: 'Esgotado', tone: 'out' };
    if (stock === 1) return { text: 'Última unidade', tone: 'low' };
    if (stock <= 3) return { text: 'Restam ' + stock + ' unidades', tone: 'low' };
    return { text: 'Em estoque', tone: 'ok' };
  }

  function stockBadge(product, extraClass) {
    var info = stockInfo(product);
    if (!info) return '';
    return '<span class="stock-badge stock-badge--' + info.tone + (extraClass ? ' ' + extraClass : '') + '">' + escapeHTML(info.text) + '</span>';
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
      els.productDialogAdd.lastChild.textContent = soldOut ? ' Esgotado' : ' Adicionar à sacola';
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
      stockBadge(product),
      '    <h3><button class="product-name" type="button" data-view="' + escapeHTML(product.id) + '">' + productName + '</button></h3>',
      '    <p class="product-desc">' + escapeHTML(product.summary || product.description) + '</p>',
      '    <button class="details-link" type="button" data-view="' + escapeHTML(product.id) + '">',
      '      Ver detalhes',
      '      <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-arrow-right"></use></svg>',
      '    </button>',
      '    <div class="product-bottom">',
      '      <span class="price-wrap">',
      '        <span class="price-label">à vista no PIX</span>',
      priceHTML(product),
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
    var random = Math.random().toString(36).slice(2, 5).padEnd(3, '0');
    return ('AK-' + Date.now().toString(36).slice(-6) + random).toUpperCase();
  }

  function createTxid() {
    return ('AK' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5))
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 25);
  }

  function buildProofMessage(order) {
    var lines = order.items.map(function (item) {
      return '• ' + item.qty + 'x ' + item.product.shortName + ' (cód. ' + item.product.code + ') — ' + formatBRL(item.unit * item.qty);
    });

    return [
      'Olá! Fiz um pedido na Akylla Shop.',
      '',
      'Pedido: ' + order.id,
      '',
      lines.join('\n'),
      '',
      'Total: ' + formatBRL(order.total),
      order.savings > 0 ? 'Desconto da promoção: ' + formatBRL(order.savings) : '',
      '',
      'Vou enviar o comprovante do PIX agora.'
    ].join('\n');
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

    if (els.orderId) els.orderId.textContent = order.id;
    if (els.pixTotal) els.pixTotal.textContent = formatBRL(order.total);
    if (els.checkoutTotal) els.checkoutTotal.textContent = formatBRL(order.total);

    if (els.checkoutItems) {
      els.checkoutItems.innerHTML = order.items.map(function (item) {
        return [
          '<li class="summary-item">',
          '  <div>',
          '    <p class="summary-item-name">' + escapeHTML(item.product.shortName) + '</p>',
          '    <p class="summary-item-meta">' + item.qty + 'x • ' + formatBRL(item.unit) + ' cada' + (item.original > item.unit ? ' <s>' + formatBRL(item.original) + '</s>' : '') + '</p>',
          '  </div>',
          '  <span class="summary-item-price">' + formatBRL(item.unit * item.qty) + '</span>',
          '</li>'
        ].join('\n');
      }).join('');
    }

    if (els.sendProof) {
      els.sendProof.href = whatsappLink(buildProofMessage(order));
    }

    if (els.pixKey) els.pixKey.textContent = CONFIG.pixKey || '';
    if (els.pixHolder) els.pixHolder.textContent = CONFIG.pixHolder || '';

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

  function openCheckout() {
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
      total: items.reduce(function (total, item) {
        return total + item.unit * item.qty;
      }, 0),
      savings: items.reduce(function (total, item) {
        return total + (item.original - item.unit) * item.qty;
      }, 0)
    };

    if (!state.order.total) {
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

  function setupCheckout() {
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
      dialog.addEventListener('close', syncBodyLock);
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
  setupDialogs();
  setupReveal();

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
