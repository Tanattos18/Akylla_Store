/*
 * Painel Akylla — edita catálogo, estoque, fotos e configurações do site e
 * publica tudo num único commit pela API do GitHub (sem servidor).
 *
 * Fluxo: entrar com a chave (fine-grained token, só Contents: read/write deste
 * repositório) → editar (fica pendente, só neste aparelho) → Publicar.
 */
(function () {
  'use strict';

  var OWNER = 'Tanattos18';
  var REPO = 'Akylla_Store';
  var BRANCH = 'main';
  var PRODUCTS_PATH = 'assets/js/products.js';
  var CONFIG_PATH = 'assets/js/config.js';
  var PHOTO_DIR = 'assets/img/products/';
  var VITRINE = { big: 'assets/img/vitrine.jpg', small: 'assets/img/vitrine-640.jpg' };
  var TOKEN_KEY = 'akylla-admin-token';
  var F = window.AkyllaFormato;

  var state = {
    token: '',
    login: '',
    headSha: '',
    original: null,      // { categories, products, config, productsText, configText, productsSha, configSha }
    products: [],
    config: {},
    uploads: {},         // caminho -> { blob, url }
    editing: null        // { index, draft, photos: [caminho...] } | null
  };

  /* ------------------------------ utilidades ------------------------------ */

  function $(sel) { return document.querySelector(sel); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, value);
    });
    [].concat(children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function brl(cents) {
    return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function parseMoney(text) {
    var clean = String(text || '').replace(/[^\d,.-]/g, '');
    if (clean.indexOf(',') >= 0) clean = clean.replace(/\./g, '').replace(',', '.');
    var value = Number(clean);
    return Number.isFinite(value) ? Math.round(value * 100) : NaN;
  }

  function moneyInput(cents) {
    return (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
  }

  function slug(text) {
    return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'produto';
  }

  var toastTimer = null;
  function toast(message, ms) {
    var box = $('#toast');
    box.textContent = message;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, ms || 3200);
  }

  function busy(text) {
    $('#busy').hidden = !text;
    if (text) $('#busyText').textContent = text;
  }

  function utf8ToBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }

  function base64ToUtf8(b64) {
    var binary = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /* Endereço de uma foto para pré-visualização (pendente → blob; publicada → raw do GitHub). */
  function photoUrl(path) {
    if (!path) return '';
    if (state.uploads[path]) return state.uploads[path].url;
    return 'https://raw.githubusercontent.com/' + repoFullName + '/' + (state.headSha || BRANCH) + '/' + path;
  }

  /* ------------------------------ GitHub API ------------------------------ */

  function gh(path, options) {
    var opts = options || {};
    var headers = {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + state.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch('https://api.github.com' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    }).then(function (res) {
      if (res.ok) return res.status === 204 ? null : res.json();
      return res.json().catch(function () { return {}; }).then(function (data) {
        var error = new Error(data.message || ('Erro ' + res.status));
        error.status = res.status;
        throw error;
      });
    });
  }

  /* Nome completo do repositório ("dono/nome"). Atualizado ao entrar: se o repositório
     for renomeado no GitHub (ex.: Akylla_Store → Akylla_Shop), o painel segue funcionando. */
  var repoFullName = OWNER + '/' + REPO;

  function repoPath(rest) { return '/repos/' + repoFullName + rest; }

  function readFile(path, ref) {
    return gh(repoPath('/contents/' + path + '?ref=' + encodeURIComponent(ref || BRANCH))).then(function (data) {
      return { text: base64ToUtf8(data.content), sha: data.sha };
    });
  }

  function friendlyError(error) {
    if (error.status === 401) return 'Chave inválida ou vencida. Gere outra no GitHub.';
    if (error.status === 403) return 'A chave não tem permissão de escrita (Contents: Read and write) neste repositório.';
    if (error.status === 404) return 'Repositório não encontrado para esta chave. Confira se ela dá acesso ao repositório da loja.';
    if (error.status === 409 || error.status === 422) return 'O site mudou enquanto você editava. Recarregue o painel e tente de novo.';
    if (!navigator.onLine) return 'Sem internet. Suas alterações continuam aqui; tente publicar de novo.';
    return error.message || 'Erro inesperado.';
  }

  /* -------------------------------- login -------------------------------- */

  function storedToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function saveToken(token, remember) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      if (remember) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* armazenamento bloqueado: vale só nesta aba */ }
  }

  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function connect(token) {
    state.token = token;
    busy('Conferindo a chave…');
    return gh(repoPath('')).then(function (repo) {
      if (repo.full_name) repoFullName = repo.full_name;
      if (!repo.permissions || !repo.permissions.push) {
        var error = new Error('no-push'); error.status = 403; throw error;
      }
      return gh('/user').then(function (user) { state.login = user.login; }, function () { state.login = OWNER; });
    }).then(loadData).then(function () {
      $('#loginView').hidden = true;
      $('#appView').hidden = false;
      $('#topActions').hidden = false;
      $('#whoami').textContent = 'Conectado como ' + state.login;
      renderAll();
      startAlerts();
    }).finally(function () { busy(''); });
  }

  /* ------------------------------ carregar ------------------------------ */

  function loadData() {
    busy('Carregando o catálogo…');
    return gh(repoPath('/git/ref/heads/' + BRANCH)).then(function (ref) {
      state.headSha = ref.object.sha;
      return Promise.all([readFile(PRODUCTS_PATH, state.headSha), readFile(CONFIG_PATH, state.headSha)]);
    }).then(function (files) {
      var catalog = F.parseProducts(files[0].text);
      var config = F.parseConfig(files[1].text);
      state.original = {
        categories: catalog.categories,
        products: catalog.products,
        config: config,
        productsText: files[0].text,
        configText: files[1].text,
        productsSha: files[0].sha,
        configSha: files[1].sha
      };
      state.products = clone(catalog.products);
      state.config = clone(config);
      Object.keys(state.uploads).forEach(function (p) { URL.revokeObjectURL(state.uploads[p].url); });
      state.uploads = {};
    });
  }

  /* ---------------------------- alterações ---------------------------- */

  function productsText() { return F.serializeProducts(state.original.categories, state.products); }
  function configText() { return F.serializeConfig(state.config); }

  function referencedPhotos(products) {
    var set = {};
    products.forEach(function (p) {
      [p.image].concat(p.gallery || []).forEach(function (src) { if (src) set[src] = true; });
    });
    return set;
  }

  /* Fotos de produto que deixaram de ser usadas → apagar do repositório. */
  function photosToDelete() {
    var before = referencedPhotos(state.original.products);
    var now = referencedPhotos(state.products);
    return Object.keys(before).filter(function (src) { return !now[src] && src.indexOf(PHOTO_DIR) === 0; });
  }

  function changeList() {
    var list = [];
    if (!state.original) return list;
    var before = {};
    state.original.products.forEach(function (p) { before[p.id] = p; });
    var now = {};
    state.products.forEach(function (p) {
      now[p.id] = p;
      var old = before[p.id];
      if (!old) { list.push('novo produto: ' + p.shortName); return; }
      if (old.stock !== p.stock) list.push(p.shortName + ': estoque ' + old.stock + ' → ' + p.stock);
      if (old.price !== p.price) list.push(p.shortName + ': preço ' + brl(old.price) + ' → ' + brl(p.price));
      if (!!old.hidden !== !!p.hidden) list.push(p.shortName + (p.hidden ? ': ocultado' : ': voltou ao site'));
      if (JSON.stringify(old.promo || null) !== JSON.stringify(p.promo || null)) list.push(p.shortName + ': promoção ' + promoLabel(p));
      var rest = function (x) { var c = clone(x); delete c.stock; delete c.price; delete c.hidden; delete c.promo; return JSON.stringify(c); };
      if (rest(old) !== rest(p)) list.push(p.shortName + ': dados/fotos editados');
    });
    state.original.products.forEach(function (p) { if (!now[p.id]) list.push('excluído: ' + p.shortName); });
    var cfgOld = clone(state.original.config), cfgNow = clone(state.config);
    if (JSON.stringify(cfgOld.promo || null) !== JSON.stringify(cfgNow.promo || null)) list.push('promoção geral');
    if (JSON.stringify(cfgOld.shipping || null) !== JSON.stringify(cfgNow.shipping || null)) list.push('frete');
    delete cfgOld.promo; delete cfgNow.promo; delete cfgOld.shipping; delete cfgNow.shipping;
    if (JSON.stringify(cfgOld) !== JSON.stringify(cfgNow)) list.push('configurações da loja');
    if (state.uploads[VITRINE.big]) list.push('nova foto da vitrine');
    return list;
  }

  function hasProductChanges() { return state.original && productsText() !== state.original.productsText; }
  function hasConfigChanges() { return state.original && configText() !== state.original.configText; }

  function refreshPending() {
    var changes = changeList();
    var n = changes.length;
    $('#pendingCount').textContent = String(n);
    $('#publishBtn').disabled = n === 0;
    $('#pendingBar').hidden = n === 0;
    $('#pendingText').textContent = n === 1 ? '1 alteração não publicada: ' + changes[0] + '.' :
      n + ' alterações não publicadas.';
  }

  function isChanged(product) {
    var old = state.original.products.find(function (p) { return p.id === product.id; });
    return !old || JSON.stringify(old) !== JSON.stringify(product);
  }

  /* ------------------------------ fotos ------------------------------ */

  function loadImage(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); });
    }
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Não consegui abrir a imagem.')); };
      img.src = URL.createObjectURL(file);
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
  }

  /* Produto: quadrado 700×700, fundo branco, imagem inteira (sem cortar). */
  function productPhoto(file) {
    return loadImage(file).then(function (img) {
      var size = 700;
      var canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
      var scale = Math.min(size / img.width, size / img.height, 1.6);
      var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
      return canvasBlob(canvas, 'image/webp', 0.82).then(function (blob) {
        if (blob && blob.type === 'image/webp') return { blob: blob, ext: 'webp' };
        return canvasBlob(canvas, 'image/jpeg', 0.85).then(function (jpg) { return { blob: jpg, ext: 'jpg' }; });
      });
    });
  }

  /* Vitrine: corte quadrado central em JPG (1000 e 640 px). */
  function vitrinePhotos(file) {
    return loadImage(file).then(function (img) {
      var side = Math.min(img.width, img.height);
      var sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      return Promise.all([1000, 640].map(function (size) {
        var canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        return canvasBlob(canvas, 'image/jpeg', 0.84);
      }));
    });
  }

  function addUpload(path, blob) {
    if (state.uploads[path]) URL.revokeObjectURL(state.uploads[path].url);
    state.uploads[path] = { blob: blob, url: URL.createObjectURL(blob) };
  }

  /* ------------------------------ render ------------------------------ */

  function stockBadge(p) {
    if (p.hidden) return el('span', { class: 'badge', text: 'Oculto' });
    if (!(p.stock > 0)) return el('span', { class: 'badge out', text: 'Esgotado' });
    if (p.stock <= 3) return el('span', { class: 'badge low', text: p.stock === 1 ? 'Última unidade' : 'Restam ' + p.stock });
    return el('span', { class: 'badge ok', text: 'Em estoque' });
  }

  function matches(p, query) {
    if (!query) return true;
    var text = [p.name, p.shortName, p.code, p.brand, p.model].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return text.indexOf(query) >= 0;
  }

  function normQuery(input) {
    return input.value.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function renderStock() {
    var list = $('#stockList');
    var query = normQuery($('#stockSearch'));
    list.innerHTML = '';
    var units = 0, out = 0;
    state.products.forEach(function (p, index) {
      units += p.stock > 0 ? p.stock : 0;
      if (!(p.stock > 0)) out += 1;
      if (!matches(p, query)) return;

      var qty = el('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', value: String(p.stock || 0), 'aria-label': 'Estoque de ' + p.shortName });
      qty.addEventListener('change', function () { setStock(index, parseInt(qty.value, 10)); });
      var price = el('input', { inputmode: 'decimal', value: moneyInput(p.price), 'aria-label': 'Preço de ' + p.shortName });
      price.addEventListener('change', function () {
        var cents = parseMoney(price.value);
        if (!(cents > 0)) { toast('Preço inválido.'); price.value = moneyInput(p.price); return; }
        state.products[index].price = cents;
        renderStock(); refreshPending();
      });

      list.appendChild(el('li', { class: 'stock-item' + (isChanged(p) ? ' is-changed' : '') }, [
        el('img', { class: 'thumb', src: photoUrl(p.image), alt: '', loading: 'lazy', width: '56', height: '56' }),
        el('div', { class: 'item-main' }, [
          el('strong', { text: p.shortName }),
          el('small', { text: 'Cód. ' + p.code + saleHint(p) }),
          el('div', { class: 'badges' }, [stockBadge(p)])
        ]),
        el('div', { class: 'stock-controls' }, [
          el('label', { class: 'stock-price' }, ['R$', price]),
          el('div', { class: 'stepper' }, [
            el('button', { type: 'button', 'aria-label': 'Tirar 1 (vendi)', text: '−', onclick: function () { setStock(index, (p.stock || 0) - 1); } }),
            qty,
            el('button', { type: 'button', 'aria-label': 'Somar 1 (repus)', text: '+', onclick: function () { setStock(index, (p.stock || 0) + 1); } })
          ])
        ])
      ]));
    });
    $('#stockSummary').textContent = state.products.length + ' produtos · ' + units + ' unidades · ' + out + ' esgotado(s)';
  }

  /* " · na promo R$ 68,00" quando o produto está com desconto hoje. */
  function saleHint(p) {
    var info = window.AkyllaPromo ? window.AkyllaPromo.priceFor(p, state.config) : null;
    return info && info.active ? ' · na promo ' + brl(info.price) : '';
  }

  function setStock(index, value) {
    var n = Math.max(0, Math.min(9999, Number.isFinite(value) ? value : 0));
    state.products[index].stock = n;
    renderStock(); renderProducts(); refreshPending();
  }

  function renderProducts() {
    var list = $('#productList');
    var query = normQuery($('#productSearch'));
    list.innerHTML = '';
    state.products.forEach(function (p, index) {
      if (!matches(p, query)) return;
      list.appendChild(el('li', { class: 'product-item' + (isChanged(p) ? ' is-changed' : '') }, [
        el('img', { class: 'thumb', src: photoUrl(p.image), alt: '', loading: 'lazy', width: '56', height: '56' }),
        el('div', { class: 'item-main' }, [
          el('strong', { text: p.shortName }),
          el('small', { text: brl(p.price) + saleHint(p) + ' · Cód. ' + p.code + ' · ' + (1 + (p.gallery || []).length) + ' foto(s)' }),
          el('div', { class: 'badges' }, [stockBadge(p), p.illustrative ? el('span', { class: 'badge', text: 'Foto ilustrativa' }) : null])
        ]),
        el('div', { class: 'item-actions' }, [
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Duplicar', onclick: function () { duplicateProduct(index); } }),
          el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Editar', onclick: function () { openEditor(index); } })
        ])
      ]));
    });
  }

  function renderConfig() {
    var form = $('#configForm');
    Array.prototype.forEach.call(form.elements, function (input) {
      if (!input.name) return;
      input.value = state.config[input.name] == null ? '' : state.config[input.name];
    });
    $('#vitrinePreview').src = photoUrl(VITRINE.big);
  }

  /* ------------------------------ promoção ------------------------------ */

  var Promo = window.AkyllaPromo;

  function generalPromo() {
    if (!state.config.promo) state.config.promo = { active: false, text: 'Descontos de inauguração', percent: 10, until: '' };
    return state.config.promo;
  }

  function promoMode(p) {
    if (!p.promo) return 'geral';
    return Number(p.promo.percent) === 0 ? 'fora' : 'propria';
  }

  function promoLabel(p) {
    var mode = promoMode(p);
    if (mode === 'fora') return 'fora';
    if (mode === 'geral') return 'segue a geral';
    return p.promo.percent + '%' + (p.promo.until ? ' até ' + Promo.formatDay(p.promo.until) : '');
  }

  /* Status do produto hoje: "Ativa: R$ 68,00 (-10% até 31/10)", "Vencida", "Fora"… */
  function promoStatus(p) {
    var info = Promo.priceFor(p, state.config);
    if (info.active) {
      return { tone: 'ok', text: brl(info.price) + ' (-' + info.percent + '%' + (info.until ? ' até ' + Promo.formatDay(info.until) : '') + ')' };
    }
    if (!generalPromo().active) return { tone: '', text: 'Promoção geral desligada' };
    if (promoMode(p) === 'fora') return { tone: '', text: 'Fora da promoção' };
    return { tone: 'out', text: 'Vencida ou sem desconto' };
  }

  function renderPromoForm() {
    var promo = generalPromo();
    var form = $('#promoForm');
    form.elements.active.checked = !!promo.active;
    form.elements.text.value = promo.text || '';
    form.elements.percent.value = promo.percent == null ? '' : promo.percent;
    form.elements.until.value = promo.until || '';
    form.elements.marginPercent.value = String(state.config.marginPercent || 30);
    updatePromoWarn();
  }

  function updatePromoWarn() {
    var promo = generalPromo();
    var max = Number(promo.percent) || 0;
    state.products.forEach(function (p) { if (promoMode(p) === 'propria') max = Math.max(max, Number(p.promo.percent) || 0); });
    var warns = [];
    /* Lucro que sobra: preço = custo ÷ (1 − margem); com desconto d → margem final = 1 − (1 − margem) ÷ (1 − d). */
    var margin = (Number(state.config.marginPercent) || 30) / 100;
    var left = max > 0 ? 1 - (1 - margin) / (1 - max / 100) : margin;
    if (max > 0 && left <= 0) warns.push('Com a margem de ' + Math.round(margin * 100) + '% da planilha, um desconto de ' + max + '% vende ABAIXO DO CUSTO.');
    else if (max > 0 && left < 0.1) warns.push('Com a margem de ' + Math.round(margin * 100) + '%, o desconto de ' + max + '% deixa só ~' + Math.round(left * 100) + '% de lucro.');
    else if (max > 0) warns.push('Lucro estimado com o maior desconto (' + max + '%): ~' + Math.round(left * 100) + '% do preço de venda.');

    if (promo.active && promo.until && promo.until < Promo.toDay()) warns.push('A data da promoção geral já passou: os produtos que seguem a geral estão sem desconto.');
    var warn = warns.join(' ');
    $('#promoWarn').textContent = warn;
    $('#promoWarn').hidden = !warn;
  }

  function renderPromoList() {
    var list = $('#promoList');
    var query = normQuery($('#promoSearch'));
    var active = 0;
    list.innerHTML = '';
    state.products.forEach(function (p, index) {
      if (Promo.priceFor(p, state.config).active) active += 1;
      if (!matches(p, query)) return;
      var mode = promoMode(p);
      var status = promoStatus(p);

      var select = el('select', { 'aria-label': 'Promoção de ' + p.shortName }, [
        el('option', { value: 'geral', text: 'Segue a promoção geral', selected: mode === 'geral' }),
        el('option', { value: 'propria', text: 'Promoção própria', selected: mode === 'propria' }),
        el('option', { value: 'fora', text: 'Fora da promoção', selected: mode === 'fora' })
      ]);
      select.addEventListener('change', function () {
        var product = state.products[index];
        if (select.value === 'geral') delete product.promo;
        else if (select.value === 'fora') product.promo = { percent: 0 };
        else product.promo = { percent: Number(generalPromo().percent) || 10, until: generalPromo().until || '' };
        afterPromoChange();
      });

      var own = null;
      if (mode === 'propria') {
        var pct = el('input', { type: 'number', min: '1', max: String(Promo.MAX_PERCENT), step: '0.5', inputmode: 'decimal', value: String(p.promo.percent), 'aria-label': 'Desconto (%) de ' + p.shortName });
        var until = el('input', { type: 'date', value: p.promo.until || '', 'aria-label': 'Promoção de ' + p.shortName + ' válida até' });
        pct.addEventListener('change', function () {
          var v = Math.max(1, Math.min(Promo.MAX_PERCENT, Number(String(pct.value).replace(',', '.')) || 0));
          state.products[index].promo.percent = v;
          afterPromoChange();
        });
        until.addEventListener('change', function () {
          if (until.value) state.products[index].promo.until = until.value; else delete state.products[index].promo.until;
          afterPromoChange();
        });
        own = el('div', { class: 'promo-own' }, [
          el('label', {}, ['Desconto (%)', pct]),
          el('label', {}, ['Até', until])
        ]);
      }

      list.appendChild(el('li', { class: 'promo-item' + (isChanged(p) ? ' is-changed' : '') }, [
        el('img', { class: 'thumb', src: photoUrl(p.image), alt: '', loading: 'lazy', width: '48', height: '48' }),
        el('div', { class: 'item-main' }, [
          el('strong', { text: p.shortName }),
          el('small', { text: 'Preço normal ' + brl(p.price) }),
          el('div', { class: 'badges' }, [el('span', { class: 'badge ' + status.tone, text: status.text })])
        ]),
        el('div', { class: 'promo-controls' }, [select, own])
      ]));
    });
    $('#promoSummary').textContent = active + ' de ' + state.products.length + ' produtos com desconto hoje';
  }

  function afterPromoChange() {
    updatePromoWarn();
    renderPromoList(); renderStock(); renderProducts(); refreshPending();
  }

  function handlePromoForm(event) {
    var input = event.target;
    var promo = generalPromo();
    if (input.name === 'active') promo.active = input.checked;
    else if (input.name === 'text') promo.text = input.value;
    else if (input.name === 'percent') promo.percent = Math.max(0, Math.min(Promo.MAX_PERCENT, Number(String(input.value).replace(',', '.')) || 0));
    else if (input.name === 'until') promo.until = input.value;
    else if (input.name === 'marginPercent') state.config.marginPercent = Math.max(1, Math.min(95, Number(String(input.value).replace(',', '.')) || 30));
    else return;
    afterPromoChange();
  }

  /* -------------------------------- frete -------------------------------- */

  var Frete = window.AkyllaFrete;

  function ship() {
    if (!state.config.shipping) state.config.shipping = clone(Frete.DEFAULTS);
    return state.config.shipping;
  }

  function renderShipForm() {
    var s = ship();
    var form = $('#shipForm');
    form.elements.enabled.checked = s.enabled !== false;
    form.elements.pickup.checked = s.pickup !== false;
    form.elements.pickupNote.value = s.pickupNote || '';
    form.elements.extraStepKm.value = String(s.extraStepKm || 5);
    form.elements.extraStepPrice.value = moneyInput(s.extraStepPrice || 0);
    form.elements.originLabel.value = s.originLabel || '';
    var carrier = s.carrier || { enabled: true, feePercent: 30 };
    form.elements.carrierEnabled.checked = carrier.enabled !== false;
    form.elements.carrierFee.value = String(carrier.feePercent == null ? 30 : carrier.feePercent);
    form.elements.originLat.value = s.origin ? String(s.origin.lat) : '';
    form.elements.originLon.value = s.origin ? String(s.origin.lon) : '';
    renderBands();
    renderCities();
  }

  function renderBands() {
    var list = $('#bandList');
    var s = ship();
    list.innerHTML = '';
    var prev = 0;
    s.bands.forEach(function (band, i) {
      var km = el('input', { type: 'number', min: '1', step: '0.5', inputmode: 'decimal', value: String(band.upToKm), 'aria-label': 'Até quantos km' });
      var price = el('input', { inputmode: 'decimal', value: moneyInput(band.price), 'aria-label': 'Valor da faixa' });
      km.addEventListener('change', function () {
        var v = Number(String(km.value).replace(',', '.'));
        if (!(v > 0)) { toast('Distância inválida.'); km.value = String(band.upToKm); return; }
        band.upToKm = v;
        s.bands.sort(function (a, b) { return a.upToKm - b.upToKm; });
        renderBands(); refreshPending();
      });
      price.addEventListener('change', function () {
        var c = parseMoney(price.value);
        if (!(c >= 0)) { toast('Valor inválido.'); price.value = moneyInput(band.price); return; }
        band.price = c; refreshPending();
      });
      list.appendChild(el('li', {}, [
        el('span', { class: 'band-from', text: prev ? 'acima de ' + prev + ' até' : 'até' }),
        km, el('span', { class: 'band-unit', text: 'km → R$' }), price,
        el('button', { type: 'button', 'aria-label': 'Remover faixa', text: '✕', onclick: function () {
          if (s.bands.length <= 1) { toast('Deixe pelo menos uma faixa.'); return; }
          s.bands.splice(i, 1); renderBands(); refreshPending();
        } })
      ]));
      prev = band.upToKm;
    });
  }

  function renderCities() {
    var list = $('#cityList');
    var s = ship();
    list.innerHTML = '';
    s.cities.forEach(function (city, i) {
      var name = el('input', { value: city.name, 'aria-label': 'Nome da cidade' });
      var price = el('input', { inputmode: 'decimal', value: city.price == null ? '' : moneyInput(city.price), placeholder: 'a combinar', 'aria-label': 'Valor (vazio = a combinar)' });
      name.addEventListener('change', function () { city.name = name.value.trim(); refreshPending(); });
      price.addEventListener('change', function () {
        if (!price.value.trim()) { city.price = null; refreshPending(); return; }
        var c = parseMoney(price.value);
        if (!(c >= 0)) { toast('Valor inválido.'); price.value = city.price == null ? '' : moneyInput(city.price); return; }
        city.price = c; refreshPending();
      });
      list.appendChild(el('li', { class: 'city-row' }, [
        name, el('span', { class: 'band-unit', text: 'R$' }), price,
        el('button', { type: 'button', 'aria-label': 'Remover cidade', text: '✕', onclick: function () { s.cities.splice(i, 1); renderCities(); refreshPending(); } })
      ]));
    });
  }

  function handleShipForm(event) {
    var input = event.target;
    var s = ship();
    if (input.name === 'enabled') s.enabled = input.checked;
    else if (input.name === 'pickup') s.pickup = input.checked;
    else if (input.name === 'pickupNote') s.pickupNote = input.value;
    else if (input.name === 'originLabel') s.originLabel = input.value;
    else if (input.name === 'carrierEnabled') { s.carrier = s.carrier || { feePercent: 30 }; s.carrier.enabled = input.checked; }
    else if (input.name === 'carrierFee') { s.carrier = s.carrier || { enabled: true }; s.carrier.feePercent = Math.max(0, Math.min(200, Number(input.value) || 0)); }
    else if (input.name === 'extraStepKm') s.extraStepKm = Math.max(1, parseInt(input.value, 10) || 5);
    else if (input.name === 'extraStepPrice') { var c = parseMoney(input.value); if (c >= 0) s.extraStepPrice = c; }
    else if (input.name === 'originLat' || input.name === 'originLon') {
      var v = Number(String(input.value).replace(',', '.'));
      if (!Number.isFinite(v)) { toast('Coordenada inválida.'); return; }
      s.origin = s.origin || {};
      s.origin[input.name === 'originLat' ? 'lat' : 'lon'] = v;
    } else return;
    refreshPending();
  }

  function carrierCalc(event) {
    event.preventDefault();
    var cents = parseMoney($('#carrierFreight').value);
    if (!(cents > 0)) { toast('Digite o valor do frete da transportadora.'); return; }
    var r = Frete.carrierTotal(cents, state.config);
    var rows = [['Frete da transportadora', brl(r.freight)], ['Taxa administrativa (' + r.percent + '%)', brl(r.fee)], ['Total a cobrar do cliente', brl(r.total)]];
    var body = $('#carrierRows');
    body.innerHTML = '';
    rows.forEach(function (row, i) {
      body.appendChild(el('tr', { class: i === 2 ? 'total' : '' }, [el('td', { text: row[0] }), el('td', { text: row[1] })]));
    });
    $('#carrierMessage').value = 'Olá! O valor do frete para envio da sua encomenda por transportadora é de ' + brl(r.freight) +
      ', acrescido de uma taxa administrativa de ' + r.percent + '% (' + brl(r.fee) + '). O valor total do envio fica em ' + brl(r.total) + '.';
    $('#carrierResult').hidden = false;
  }

  function simulate(event) {
    event.preventDefault();
    var out = $('#simResult');
    out.textContent = 'Calculando…';
    Frete.quote({ cep: $('#simCep').value, number: $('#simNumber').value }, state.config).then(function (q) {
      var a = q.address;
      var where = [a.street, a.number].filter(Boolean).join(', ') + ' · ' + a.district + ', ' + a.city + '/' + a.uf;
      if (q.kind === 'distance') out.textContent = brl(q.fee) + ' — ' + String(q.km).replace('.', ',') + ' km de ida (' + q.precision + ') · ' + where;
      else if (q.kind === 'fixed') out.textContent = brl(q.fee) + ' — valor fixo de ' + a.city;
      else if (q.kind === 'negotiable') out.textContent = 'A combinar — ' + a.city;
      else if (q.kind === 'carrier') out.textContent = 'Transportadora (cotação + taxa) — ' + a.city + '/' + a.uf;
      else out.textContent = 'Fora da área — ' + a.city + '/' + a.uf;
    }).catch(function (error) { out.textContent = 'Não foi possível: ' + error.message; });
  }

  /* -------------------------------- pedidos -------------------------------- */

  var STATUS = {
    paid: ['ok', 'Pago'],
    pending: ['low', 'Aguardando PIX'],
    expired: ['', 'Expirado/cancelado'],
    review: ['out', 'Conferir pagamento'],
    awaiting: ['low', 'Aguardando confirmação do PIX'],
    canceled: ['', 'Cancelado (estoque devolvido)']
  };

  function orderAction(id, action) {
    var api = String(state.config.paymentApiUrl || '').replace(/\/+$/, '');
    var question = action === 'confirm'
      ? 'Confirmar que o PIX do pedido ' + id + ' caiu na conta? O produto continua fora do estoque.'
      : 'Cancelar o pedido ' + id + '? O produto VOLTA para o estoque e para a vitrine.';
    if (!confirm(question)) return;
    busy(action === 'confirm' ? 'Confirmando…' : 'Cancelando e devolvendo ao estoque…');
    fetch(api + '/api/admin/orders/' + encodeURIComponent(id) + '/' + action, { method: 'POST', headers: { Authorization: 'Bearer ' + state.token } })
      .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.error || 'Erro ' + res.status); return d; }); })
      .then(function () {
        toast(action === 'confirm' ? 'Pagamento confirmado.' : 'Pedido cancelado e estoque devolvido (o site atualiza em ~1 min).', 5000);
        loadOrders();
        return loadData().then(renderAll);
      })
      .catch(function (err) { toast('Não foi possível: ' + err.message, 6000); })
      .finally(function () { busy(''); });
  }

  function loadOrders() {
    var api = String(state.config.paymentApiUrl || '').replace(/\/+$/, '');
    var list = $('#ordersList');
    if (!api) {
      $('#ordersHint').hidden = false;
      list.innerHTML = '';
      $('#ordersSummary').textContent = '';
      return;
    }
    $('#ordersHint').hidden = true;
    $('#ordersSummary').textContent = 'Carregando…';
    fetch(api + '/api/admin/orders', { headers: { Authorization: 'Bearer ' + state.token }, cache: 'no-store' })
      .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.error || 'Erro ' + res.status); return d; }); })
      .then(function (data) {
        list.innerHTML = '';
        var paid = data.orders.filter(function (o) { return o.status === 'paid'; });
        var waiting = data.orders.filter(function (o) { return o.status === 'awaiting'; }).length;
        var sum = paid.reduce(function (t, o) { return t + o.total; }, 0);
        $('#ordersSummary').textContent = (waiting ? waiting + ' aguardando confirmação · ' : '') + paid.length + ' pago(s) · ' + brl(sum) + ' · ' + data.orders.length + ' no total';
        if (!data.orders.length) list.appendChild(el('li', { class: 'muted', text: 'Nenhum pedido ainda.' }));
        data.orders.forEach(function (o) {
          var st = STATUS[o.status] || ['', o.status];
          var d = o.delivery || {};
          var a = d.address || {};
          var when = new Date(o.createdAt || o.paidAt || o.expiresAt - 30 * 60000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
          var where = d.mode === 'pickup' ? 'Retirada na loja'
            : [a.street, a.number].filter(Boolean).join(', ') + (d.complement ? ' — ' + d.complement : '') + ' · ' + a.district + ', ' + a.city + '/' + a.uf + ' · CEP ' + a.cep;
          var c = o.customer || {};
          list.appendChild(el('li', { class: 'order-item' }, [
            el('div', { class: 'order-head' }, [
              el('strong', { text: o.id }),
              el('span', { class: 'badge ' + st[0], text: st[1] }),
              el('span', { class: 'muted', text: when })
            ]),
            el('p', { text: (c.name || '—') + (c.phone ? ' · ' + c.phone : '') + (o.email ? ' · ' + o.email : '') }),
            el('ul', { class: 'order-lines' }, o.lines.map(function (l) {
              return el('li', { text: l.qty + 'x ' + l.name + ' (cód. ' + l.code + ') — ' + brl(l.unit * l.qty) });
            })),
            el('p', { text: 'Entrega: ' + where + ' · Frete: ' + (d.mode === 'pickup' ? 'grátis' : d.kind === 'carrier' ? 'transportadora (cotar)' : d.kind === 'negotiable' ? 'a combinar' : brl(o.shipping)) }),
            el('p', { class: 'order-total', text: 'Total: ' + brl(o.total) + (o.paymentId ? ' · Mercado Pago #' + o.paymentId : '') }),
            o.status === 'paid' ? el('p', { class: 'muted', text: (o.stockUpdated ? 'Estoque baixado automaticamente.' : 'ATENÇÃO: estoque não atualizado — ' + (o.stockError || '')) + (o.notified ? ' Aviso enviado no WhatsApp.' : '') }) : null,
            o.reviewReason ? el('p', { class: 'warn', text: o.reviewReason }) : null,
            o.cancelReason && o.status === 'canceled' ? el('p', { class: 'muted', text: 'Motivo: ' + o.cancelReason }) : null,
            o.status === 'awaiting' ? el('div', { class: 'order-actions' }, [
              el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: '✓ Confirmar pagamento', onclick: function () { orderAction(o.id, 'confirm'); } }),
              el('button', { type: 'button', class: 'btn btn-danger btn-sm', text: 'Cancelar e devolver ao estoque', onclick: function () { orderAction(o.id, 'cancel'); } })
            ]) : null
          ]));
        });
      })
      .catch(function (err) { $('#ordersSummary').textContent = 'Não foi possível carregar: ' + err.message; });
  }

  /* --------------------------- avisos de pedido --------------------------- */
  /*
   * Dois caminhos:
   * 1) painel aberto (PC ou celular): consulta o servidor a cada 20 s e toca som/vibra/notifica;
   * 2) painel fechado: notificação push do servidor (service worker sw.js), como um app.
   */
  var SEEN_KEY = 'akylla-seen-orders';
  var SOUND_KEY = 'akylla-alert-sound';
  var alerts = { seen: null, timer: 0, ctx: null, unread: 0, title: document.title, pushOn: false };

  function apiBase() { return String(state.config.paymentApiUrl || '').replace(/\/+$/, ''); }
  function soundOn() { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) { return true; } }

  function loadSeen() {
    try { var raw = localStorage.getItem(SEEN_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function saveSeen() {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(alerts.seen.slice(-500))); } catch (e) { /* sem armazenamento: só não lembra entre visitas */ }
  }

  /* O navegador só libera som depois de um toque/clique na página. */
  function unlockAudio() {
    if (alerts.ctx) { if (alerts.ctx.state === 'suspended') alerts.ctx.resume(); return; }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) alerts.ctx = new Ctx();
  }

  function chime() {
    if (!soundOn()) return;
    unlockAudio();
    var ctx = alerts.ctx;
    if (!ctx) return;
    var start = ctx.currentTime + 0.05;
    [0, 0.75].forEach(function (offset) {
      [880, 1175, 1568].forEach(function (freq, i) {
        var t = start + offset + i * 0.16;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    });
  }

  function setUnread(n) {
    alerts.unread = n;
    document.title = n ? '(' + n + ') 🛒 Novo pedido — Painel Akylla' : alerts.title;
    $('#bellCount').hidden = !n;
    $('#bellCount').textContent = String(n);
  }

  function setWaiting(n) {
    $('#ordersBadge').hidden = !n;
    $('#ordersBadge').textContent = String(n);
  }

  /* Só avisa o que é novidade: pedido manual chegando, ou PIX automático pago/para revisar. */
  function alertKey(o) {
    if (o.manual) return o.status === 'awaiting' ? o.id : null;
    return o.status === 'paid' || o.status === 'review' ? o.id + ':' + o.status : null;
  }

  function checkOrders() {
    var api = apiBase();
    if (!api || !state.token) return Promise.resolve();
    return fetch(api + '/api/admin/orders', { headers: { Authorization: 'Bearer ' + state.token }, cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        var orders = data.orders || [];
        setWaiting(orders.filter(function (o) { return o.status === 'awaiting'; }).length);
        var fresh = [];
        var first = !alerts.seen;
        if (first) alerts.seen = [];
        orders.forEach(function (o) {
          var key = alertKey(o);
          if (key && alerts.seen.indexOf(key) < 0) {
            alerts.seen.push(key);
            if (!first) fresh.push(o);
          }
        });
        saveSeen();
        if (fresh.length) announce(fresh);
      })
      .catch(function () { /* sem internet: tenta de novo no próximo ciclo */ });
  }

  function announce(list) {
    setUnread(alerts.unread + list.length);
    chime();
    if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 500]);
    var o = list[0];
    var who = o.customer && o.customer.name ? ' de ' + o.customer.name : '';
    var text = list.length > 1 ? list.length + ' pedidos novos chegaram.' : '🛒 Novo pedido ' + o.id + who + ' — ' + brl(o.total);
    toast(text, 8000);
    if (!$('[data-panel="pedidos"]').hidden) loadOrders();
    if (dash.orders) loadDashboard();
    /* sem push neste aparelho: notificação do próprio painel quando a aba está em segundo plano */
    if (!alerts.pushOn && document.hidden && window.Notification && Notification.permission === 'granted' && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification(list.length > 1 ? list.length + ' pedidos novos' : 'Novo pedido ' + o.id, {
          body: text, tag: o.id, renotify: true, icon: 'icon-192.png', data: { url: '/admin/#pedidos' }
        });
      }).catch(function () {});
    }
  }

  function scheduleCheck() {
    clearTimeout(alerts.timer);
    alerts.timer = setTimeout(function () { checkOrders().then(scheduleCheck); }, document.hidden ? 45000 : 20000);
  }

  function openOrdersTab() {
    var tab = document.querySelector('[data-tab="pedidos"]');
    if (tab) tab.click();
    setUnread(0);
  }

  /* ---------- notificação push (painel fechado) ---------- */

  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function deviceLabel() {
    var ua = navigator.userAgent;
    var kind = /android/i.test(ua) ? 'Android' : isIOS() ? 'iPhone/iPad' : /windows/i.test(ua) ? 'PC Windows' : /mac/i.test(ua) ? 'Mac' : 'Aparelho';
    var browser = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'navegador';
    return kind + ' · ' + browser;
  }
  function keyBytes(b64) {
    var s = b64.replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(s + '==='.slice((s.length + 3) % 4));
    return Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
  }

  function adminPost(path, body) {
    return fetch(apiBase() + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + state.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { if (!res.ok) throw new Error(d.error || 'Erro ' + res.status); return d; }); });
  }

  function currentSubscription() {
    if (!pushSupported()) return Promise.resolve(null);
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).catch(function () { return null; });
  }

  function renderAlerts() {
    var status = $('#alertsStatus');
    var text = $('#alertsText');
    var show = function (enable, test, disable) {
      $('#alertsEnable').hidden = !enable; $('#alertsTest').hidden = !test; $('#alertsDisable').hidden = !disable;
    };
    $('#alertsSound').checked = soundOn();
    if (!apiBase()) {
      status.className = 'badge'; status.textContent = 'Sem servidor';
      text.textContent = 'Preencha o endereço do servidor na aba Loja para receber avisos.';
      show(false, false, false); return;
    }
    if (!pushSupported()) {
      status.className = 'badge low'; status.textContent = 'Só com o painel aberto';
      text.textContent = isIOS() && !isStandalone()
        ? 'No iPhone, para receber aviso com o painel fechado: no Safari toque em Compartilhar → “Adicionar à Tela de Início”, abra o painel pelo ícone novo e ative aqui. Com o painel aberto, o som já funciona.'
        : 'Este navegador não aceita notificações com o painel fechado. Com o painel aberto, o som e o aviso funcionam.';
      show(false, false, false); return;
    }
    if (Notification.permission === 'denied') {
      status.className = 'badge out'; status.textContent = 'Bloqueado';
      text.textContent = 'As notificações estão bloqueadas para este site. Libere em: cadeado ao lado do endereço → Notificações → Permitir. Depois recarregue o painel.';
      show(false, false, false); return;
    }
    currentSubscription().then(function (sub) {
      alerts.pushOn = !!sub;
      if (sub) {
        status.className = 'badge ok'; status.textContent = 'Ativo neste aparelho';
        text.textContent = 'Este aparelho (' + deviceLabel() + ') recebe aviso de pedido novo mesmo com o painel fechado. Com o painel aberto, também toca o som.';
        show(false, true, true);
      } else {
        status.className = 'badge'; status.textContent = 'Desativado';
        text.textContent = 'Ative para receber notificação de pedido novo neste aparelho mesmo com o painel fechado (faça isso no celular e no PC). Com o painel aberto, o som já funciona.';
        show(true, false, false);
      }
    });
  }

  function enablePush() {
    unlockAudio();
    busy('Ativando os avisos…');
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Permissão de notificação negada.');
      return Promise.all([navigator.serviceWorker.ready, fetch(apiBase() + '/api/push/key', { cache: 'no-store' }).then(function (r) { return r.json(); })]);
    }).then(function (res) {
      var reg = res[0];
      var options = { userVisibleOnly: true, applicationServerKey: keyBytes(res[1].publicKey) };
      return reg.pushManager.subscribe(options).catch(function () {
        /* assinatura antiga com outra chave: refaz */
        return reg.pushManager.getSubscription().then(function (old) { return old ? old.unsubscribe() : null; }).then(function () { return reg.pushManager.subscribe(options); });
      });
    }).then(function (sub) {
      return adminPost('/api/admin/push/subscribe', { subscription: sub.toJSON(), label: deviceLabel() });
    }).then(function () {
      toast('Avisos ativados neste aparelho. Use “Enviar aviso de teste” para conferir.', 6000);
    }).catch(function (err) {
      toast('Não foi possível ativar: ' + err.message, 7000);
    }).finally(function () { busy(''); renderAlerts(); });
  }

  function disablePush() {
    currentSubscription().then(function (sub) {
      if (!sub) return null;
      var data = sub.toJSON();
      return sub.unsubscribe().then(function () { return adminPost('/api/admin/push/unsubscribe', { subscription: data }); });
    }).then(function () { toast('Avisos desativados neste aparelho.'); })
      .catch(function (err) { toast('Erro: ' + err.message); })
      .finally(renderAlerts);
  }

  function testPush() {
    adminPost('/api/admin/push/test').then(function (d) {
      toast(d.sent ? 'Aviso de teste enviado para ' + d.sent + ' aparelho(s). Deve aparecer em instantes.' : 'Nenhum aparelho recebeu. Desative e ative de novo neste aparelho.', 7000);
    }).catch(function (err) { toast('Erro: ' + err.message); });
  }

  function startAlerts() {
    alerts.seen = loadSeen();
    renderAlerts();
    /* renova o cadastro deste aparelho no servidor (a assinatura vale 1 ano) */
    currentSubscription().then(function (sub) {
      if (sub && apiBase()) adminPost('/api/admin/push/subscribe', { subscription: sub.toJSON(), label: deviceLabel() }).catch(function () {});
    });
    checkOrders().then(scheduleCheck);
    if (location.hash === '#pedidos') openOrdersTab();
  }

  function setupAlerts() {
    ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, unlockAudio, { passive: true }); });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
      navigator.serviceWorker.addEventListener('message', function (event) {
        var data = event.data || {};
        if (data.type === 'akylla-order') checkOrders();
        if (data.type === 'akylla-open-orders') openOrdersTab();
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.token) { checkOrders(); scheduleCheck(); }
    });
    window.addEventListener('focus', function () { if (!$('[data-panel="pedidos"]').hidden) setUnread(0); });
    $('#alertsEnable').addEventListener('click', enablePush);
    $('#alertsDisable').addEventListener('click', disablePush);
    $('#alertsTest').addEventListener('click', testPush);
    $('#alertsSoundTest').addEventListener('click', function () { unlockAudio(); var was = soundOn(); try { localStorage.setItem(SOUND_KEY, '1'); } catch (e) {} chime(); if (!was) try { localStorage.setItem(SOUND_KEY, '0'); } catch (e) {} });
    $('#alertsSound').addEventListener('change', function () { try { localStorage.setItem(SOUND_KEY, this.checked ? '1' : '0'); } catch (e) {} });
    $('#bellBtn').addEventListener('click', openOrdersTab);
    document.querySelector('[data-tab="pedidos"]').addEventListener('click', function () { setUnread(0); });
  }

  /* ------------------------------- dashboard ------------------------------- */

  var dash = { orders: null, period: '30', loading: false };

  function periodStart(period) {
    var now = new Date();
    if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (period === 'all') return 0;
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - (Number(period) - 1));
    return d.getTime();
  }

  var PERIOD_LABEL = { today: 'hoje', '7': 'últimos 7 dias', '30': 'últimos 30 dias', month: 'este mês', all: 'desde o início' };

  function catLabel(id) {
    var c = state.original && state.original.categories.find(function (x) { return x.id === id; });
    return c ? c.label : 'Outros';
  }

  function dayKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function kpi(label, value, sub, tone) {
    return el('div', { class: 'kpi' + (tone ? ' kpi-' + tone : '') }, [
      el('span', { class: 'kpi-label', text: label }),
      el('strong', { class: 'kpi-value', text: value }),
      sub ? el('span', { class: 'kpi-sub', text: sub }) : null
    ]);
  }

  function fill(id, nodes) {
    var box = $(id);
    box.innerHTML = '';
    nodes.forEach(function (n) { if (n) box.appendChild(n); });
  }

  function table(id, head, rows, empty) {
    var t = $(id);
    t.innerHTML = '';
    var thead = el('thead', {}, [el('tr', {}, head.map(function (c, i) { return el('th', { class: i ? 'num' : '', text: c }); }))]);
    var body = el('tbody', {}, rows.length ? rows.map(function (r) {
      return el('tr', {}, r.map(function (c, i) { return el('td', { class: i ? 'num' : '', text: String(c) }); }));
    }) : [el('tr', {}, [el('td', { colspan: String(head.length), class: 'muted', text: empty || 'Sem dados no período.' })])]);
    t.appendChild(thead);
    t.appendChild(body);
  }

  function loadDashboard() {
    var api = String(state.config.paymentApiUrl || '').replace(/\/+$/, '');
    if (!api) {
      $('#dashNote').textContent = 'Preencha o endereço do servidor na aba Loja para ver as vendas.';
      dash.orders = [];
      renderDashboard();
      return;
    }
    if (dash.loading) return;
    dash.loading = true;
    $('#dashNote').textContent = 'Carregando pedidos…';
    fetch(api + '/api/admin/orders?all=1', { headers: { Authorization: 'Bearer ' + state.token }, cache: 'no-store' })
      .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.error || 'Erro ' + res.status); return d; }); })
      .then(function (data) {
        dash.orders = data.orders || [];
        $('#dashNote').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '. Só pedidos confirmados contam como venda.';
        renderDashboard();
      })
      .catch(function (err) {
        $('#dashNote').textContent = 'Não foi possível carregar os pedidos: ' + err.message;
        dash.orders = dash.orders || [];
        renderDashboard();
      })
      .finally(function () { dash.loading = false; });
  }

  function renderDashboard() {
    if (!state.original) return;
    var orders = dash.orders || [];
    var start = periodStart(dash.period);
    var when = function (o) { return o.paidAt || o.createdAt || 0; };
    var inPeriod = function (o) { return when(o) >= start; };
    var paid = orders.filter(function (o) { return o.status === 'paid' && inPeriod(o); });
    var waiting = orders.filter(function (o) { return o.status === 'awaiting'; });
    var canceled = orders.filter(function (o) { return o.status === 'canceled' && inPeriod(o); });
    $('#dashPeriodLabel').textContent = '· ' + PERIOD_LABEL[dash.period];

    var revenue = 0, products = 0, freight = 0, items = 0, savings = 0;
    var byProduct = {}, byCat = {}, byDay = {}, pickup = 0, delivery = 0;
    var catalogById = {};
    state.products.forEach(function (p) { catalogById[p.id] = p; });

    paid.forEach(function (o) {
      revenue += o.total;
      freight += o.shipping || 0;
      savings += o.savings || 0;
      if (o.delivery && o.delivery.mode === 'delivery') delivery += 1; else pickup += 1;
      var dk = dayKey(when(o));
      byDay[dk] = byDay[dk] || { total: 0, count: 0 };
      byDay[dk].total += o.total;
      byDay[dk].count += 1;
      (o.lines || []).forEach(function (l) {
        var value = l.unit * l.qty;
        products += value;
        items += l.qty;
        var p = catalogById[l.id];
        var cat = p ? p.category : 'outros';
        byProduct[l.id] = byProduct[l.id] || { name: l.name, code: l.code, cat: cat, qty: 0, value: 0, stock: p ? p.stock : '—' };
        byProduct[l.id].qty += l.qty;
        byProduct[l.id].value += value;
        byCat[cat] = byCat[cat] || { qty: 0, value: 0 };
        byCat[cat].qty += l.qty;
        byCat[cat].value += value;
      });
    });

    /* KPIs de vendas */
    var waitValue = waiting.reduce(function (t, o) { return t + o.total; }, 0);
    fill('#kpiSales', [
      kpi('Faturamento', brl(revenue), 'produtos ' + brl(products) + ' · frete ' + brl(freight)),
      kpi('Pedidos confirmados', String(paid.length), items + ' ite' + (items === 1 ? 'm' : 'ns') + ' vendido' + (items === 1 ? '' : 's')),
      kpi('Ticket médio', paid.length ? brl(Math.round(revenue / paid.length)) : '—', savings ? 'descontos de promoção ' + brl(savings) : ''),
      kpi('Aguardando confirmação', String(waiting.length), waiting.length ? brl(waitValue) + ' reservado' : 'nenhum pendente', waiting.length ? 'warn' : ''),
      kpi('Cancelados', String(canceled.length), 'no período')
    ]);

    /* Faturamento por dia (barras, uma cor = quantidade) */
    renderDayChart(byDay, start);

    /* Categorias */
    var cats = Object.keys(byCat).map(function (k) { return { id: k, label: catLabel(k), qty: byCat[k].qty, value: byCat[k].value }; })
      .sort(function (a, b) { return b.value - a.value; });
    var maxCat = cats.reduce(function (m, c) { return Math.max(m, c.value); }, 0);
    fill('#catBars', cats.map(function (c) {
      var pct = maxCat ? Math.max(2, Math.round(c.value / maxCat * 100)) : 0;
      return el('div', { class: 'hbar', title: c.label + ': ' + brl(c.value) + ' · ' + c.qty + ' un.' }, [
        el('span', { class: 'hbar-label', text: c.label }),
        el('span', { class: 'hbar-track' }, [el('span', { class: 'hbar-fill', style: 'width:' + pct + '%' })]),
        el('span', { class: 'hbar-value', text: brl(c.value) })
      ]);
    }));
    table('#catTable', ['Categoria', 'Itens', 'Total', '% das vendas'], cats.map(function (c) {
      return [c.label, c.qty, brl(c.value), products ? Math.round(c.value / products * 100) + '%' : '—'];
    }));

    fill('#kpiDelivery', [
      kpi('Retirada na loja', String(pickup), paid.length ? Math.round(pickup / paid.length * 100) + '% dos pedidos' : ''),
      kpi('Entrega', String(delivery), 'frete recebido ' + brl(freight))
    ]);

    /* Produtos vendidos */
    var prods = Object.keys(byProduct).map(function (k) { byProduct[k].id = k; return byProduct[k]; })
      .sort(function (a, b) { return b.qty - a.qty || b.value - a.value; });
    dash.ranking = prods;
    table('#prodTable', ['Produto', 'Código', 'Categoria', 'Qtde vendida', 'Receita', 'Estoque atual'], prods.map(function (p) {
      return [p.name, p.code, catLabel(p.cat), p.qty, brl(p.value), p.stock];
    }), 'Nenhuma venda confirmada no período.');

    /* Loja agora (catálogo do painel, inclui alterações ainda não publicadas) */
    var active = state.products.filter(function (p) { return !p.hidden; });
    var units = active.reduce(function (t, p) { return t + (p.stock > 0 ? p.stock : 0); }, 0);
    var stockValue = active.reduce(function (t, p) { return t + (p.stock > 0 ? p.stock * p.price : 0); }, 0);
    var out = active.filter(function (p) { return !(p.stock > 0); });
    var low = active.filter(function (p) { return p.stock > 0 && p.stock <= 1; });
    var promo = state.config.promo || {};
    var promoOn = !!promo.active && (!promo.until || promo.until >= Promo.toDay());
    fill('#kpiStore', [
      kpi('Produtos ativos', String(active.length), (state.products.length - active.length) + ' oculto(s)'),
      kpi('Unidades em estoque', String(units), 'valor a preço de venda ' + brl(stockValue)),
      kpi('Esgotados', String(out.length), out.length ? 'repor estoque' : 'nenhum', out.length ? 'warn' : ''),
      kpi('Estoque baixo', String(low.length), 'última unidade', low.length ? 'warn' : ''),
      kpi('Promoção', promoOn ? (promo.percent + '% ligada') : 'desligada', promoOn && promo.until ? 'até ' + Promo.formatDay(promo.until) : ''),
      kpi('Pagamento', state.config.paymentProvider === 'mercadopago' ? 'Mercado Pago' : 'PIX manual', state.config.paymentApiUrl ? 'servidor configurado' : 'sem servidor')
    ]);
    table('#lowTable', ['Produto', 'Código', 'Estoque', 'Situação'], out.concat(low).map(function (p) {
      return [p.shortName, p.code, p.stock || 0, p.stock > 0 ? 'Última unidade' : 'Esgotado'];
    }), 'Tudo com estoque. 👍');
  }

  /* Selo "Mais vendido": os 3 que mais venderam no período escolhido (fica pendente até publicar) */
  function markBestsellers() {
    var top = (dash.ranking || []).filter(function (r) { return state.products.some(function (p) { return p.id === r.id; }); }).slice(0, 3);
    if (!top.length) { toast('Ainda não há vendas confirmadas no período para escolher os mais vendidos.'); return; }
    var ids = top.map(function (r) { return r.id; });
    state.products.forEach(function (p) { if (ids.indexOf(p.id) >= 0) p.bestseller = true; else delete p.bestseller; });
    renderAll();
    toast('Selo aplicado em: ' + top.map(function (r) { return r.name; }).join(', ') + '. Clique em Publicar para ir ao site.', 6000);
  }

  function renderDayChart(byDay, start) {
    var box = $('#dayChart');
    box.innerHTML = '';
    var keys = Object.keys(byDay).sort();
    var first = start || (keys.length ? new Date(keys[0] + 'T12:00:00').getTime() : Date.now());
    var days = [];
    var d = new Date(first);
    d.setHours(12, 0, 0, 0);
    var today = new Date();
    today.setHours(12, 0, 0, 0);
    while (d <= today && days.length < 400) { days.push(dayKey(d.getTime())); d.setDate(d.getDate() + 1); }
    /* períodos longos: agrupa por mês */
    var monthly = days.length > 62;
    var buckets = [];
    days.forEach(function (k) {
      var label = monthly ? k.slice(0, 7) : k;
      var last = buckets[buckets.length - 1];
      if (!last || last.key !== label) { last = { key: label, total: 0, count: 0 }; buckets.push(last); }
      if (byDay[k]) { last.total += byDay[k].total; last.count += byDay[k].count; }
    });
    var max = buckets.reduce(function (m, b) { return Math.max(m, b.total); }, 0);
    if (!max) { box.appendChild(el('p', { class: 'muted chart-empty', text: 'Nenhuma venda confirmada no período.' })); return; }
    var bestIndex = buckets.findIndex(function (b) { return b.total === max; });
    box.appendChild(el('span', { class: 'axis-max', text: brl(max) }));
    var plot = el('div', { class: 'daychart-plot' });
    buckets.forEach(function (b, i) {
      var fmt = monthly ? b.key.split('-').reverse().join('/') : b.key.slice(8, 10) + '/' + b.key.slice(5, 7);
      var col = el('div', { class: 'daybar', tabindex: '0', 'aria-label': fmt + ': ' + brl(b.total) + ', ' + b.count + ' pedido(s)' }, [
        el('span', { class: 'daybar-fill' + (b.total ? '' : ' is-zero'), style: 'height:' + (b.total ? Math.max(3, b.total / max * 100) : 0) + '%' }),
        i === bestIndex ? el('span', { class: 'daybar-label', text: brl(b.total) }) : null
      ]);
      col.addEventListener('pointerenter', function (e) { showTip(e.currentTarget, fmt, b); });
      col.addEventListener('focus', function (e) { showTip(e.currentTarget, fmt, b); });
      col.addEventListener('pointerleave', hideTip);
      col.addEventListener('blur', hideTip);
      plot.appendChild(col);
    });
    box.appendChild(plot);
    var axis = el('div', { class: 'daychart-axis' }, [
      el('span', { text: monthly ? buckets[0].key.split('-').reverse().join('/') : buckets[0].key.slice(8, 10) + '/' + buckets[0].key.slice(5, 7) }),
      el('span', { text: monthly ? 'por mês' : 'hoje' })
    ]);
    box.appendChild(axis);
  }

  function showTip(target, label, b) {
    var tip = $('#chartTip');
    tip.textContent = '';
    tip.appendChild(el('strong', { text: label }));
    tip.appendChild(el('span', { text: brl(b.total) }));
    tip.appendChild(el('span', { class: 'muted', text: b.count + ' pedido' + (b.count === 1 ? '' : 's') }));
    tip.hidden = false;
    var r = target.getBoundingClientRect();
    var host = tip.parentElement.getBoundingClientRect();
    var left = r.left - host.left + r.width / 2 - tip.offsetWidth / 2;
    tip.style.left = Math.max(4, Math.min(host.width - tip.offsetWidth - 4, left)) + 'px';
    tip.style.top = (r.top - host.top - tip.offsetHeight - 6) + 'px';
  }

  function hideTip() { $('#chartTip').hidden = true; }

  function renderAll() {
    renderStock(); renderProducts(); renderConfig(); renderPromoForm(); renderPromoList(); renderShipForm(); refreshPending();
    if (!dash.orders) loadDashboard(); else renderDashboard();
    var select = $('#categorySelect');
    select.innerHTML = '';
    state.original.categories.filter(function (c) { return c.id !== 'todos'; }).forEach(function (c) {
      select.appendChild(el('option', { value: c.id, text: c.label }));
    });
  }

  /* ------------------------------ editor ------------------------------ */

  var FIELDS = ['name', 'shortName', 'code', 'brand', 'model', 'category', 'visual', 'summary', 'description', 'imageAlt'];

  function blankProduct() {
    return {
      id: '', name: '', shortName: '', brand: '', model: '', code: '', category: 'acessorios', visual: 'charger',
      price: 0, stock: 0, summary: '', description: '', image: '', imageAlt: '', specs: []
    };
  }

  function openEditor(index, draft) {
    var product = draft || clone(state.products[index]);
    state.editing = { index: index, draft: product, photos: [product.image].concat(product.gallery || []).filter(Boolean) };
    var form = $('#editorForm');
    FIELDS.forEach(function (name) { form.elements[name].value = product[name] == null ? '' : product[name]; });
    form.elements.price.value = product.price ? moneyInput(product.price) : '';
    form.elements.stock.value = String(product.stock || 0);
    form.elements.illustrative.checked = !!product.illustrative;
    form.elements.hidden.checked = !!product.hidden;
    form.elements.bestseller.checked = !!product.bestseller;
    $('#editorTitle').textContent = index == null ? 'Novo produto' : 'Editar: ' + product.shortName;
    $('#deleteProductBtn').hidden = index == null;
    $('#editorError').hidden = true;
    $('#calcCost').value = ''; $('#calcResult').textContent = '—'; $('#calcApply').disabled = true;
    $('#calcMargin').value = String(state.config.marginPercent || 30);
    renderSpecs(product.specs || []);
    renderPhotos();
    $('#editor').showModal();
    $('#editor .editor-body').scrollTop = 0;
  }

  function closeEditor() {
    state.editing = null;
    if ($('#editor').open) $('#editor').close();
  }

  function renderPhotos() {
    var list = $('#photoList');
    var photos = state.editing.photos;
    list.innerHTML = '';
    photos.forEach(function (src, i) {
      var move = function (to) {
        var item = photos.splice(i, 1)[0];
        photos.splice(to, 0, item);
        renderPhotos();
      };
      list.appendChild(el('li', { class: 'photo' + (i === 0 ? ' is-main' : '') }, [
        el('img', { src: photoUrl(src), alt: 'Foto ' + (i + 1) }),
        i === 0 ? el('span', { class: 'photo-tag', text: 'Principal' }) : null,
        state.uploads[src] ? el('span', { class: 'photo-tag new', text: 'Nova' }) : null,
        el('div', { class: 'photo-actions' }, [
          el('button', { type: 'button', 'aria-label': 'Mover para a esquerda', text: '◀', disabled: i === 0, onclick: function () { move(i - 1); } }),
          el('button', { type: 'button', 'aria-label': 'Tornar principal', text: '★', disabled: i === 0, onclick: function () { move(0); } }),
          el('button', { type: 'button', 'aria-label': 'Remover foto', text: '🗑', onclick: function () {
            photos.splice(i, 1);
            if (state.uploads[src] && !referencedPhotos(state.products)[src]) {
              URL.revokeObjectURL(state.uploads[src].url); delete state.uploads[src];
            }
            renderPhotos();
          } }),
          el('button', { type: 'button', 'aria-label': 'Mover para a direita', text: '▶', disabled: i === photos.length - 1, onclick: function () { move(i + 1); } })
        ])
      ]));
    });
    if (!photos.length) list.appendChild(el('li', { class: 'muted', text: 'Sem fotos: o site mostra o ícone da categoria.' }));
  }

  function renderSpecs(specs) {
    var list = $('#specList');
    list.innerHTML = '';
    specs.forEach(function (spec) { list.appendChild(specRow(spec.label, spec.value)); });
  }

  function specRow(label, value) {
    var li = el('li', {}, [
      el('input', { 'aria-label': 'Nome da especificação', placeholder: 'Ex.: Tela', value: label || '' }),
      el('input', { 'aria-label': 'Valor da especificação', placeholder: 'Ex.: 1,75" HD', value: value || '' }),
      el('button', { type: 'button', 'aria-label': 'Remover especificação', text: '✕', onclick: function () { li.remove(); } })
    ]);
    return li;
  }

  function readSpecs() {
    return Array.prototype.map.call($('#specList').children, function (li) {
      var inputs = li.querySelectorAll('input');
      return { label: inputs[0].value.trim(), value: inputs[1].value.trim() };
    }).filter(function (s) { return s.label && s.value; });
  }

  function applyEditor(event) {
    event.preventDefault();
    var form = $('#editorForm');
    var editing = state.editing;
    var p = editing.draft;
    var error = '';

    FIELDS.forEach(function (name) { p[name] = form.elements[name].value.trim(); });
    p.price = parseMoney(form.elements.price.value);
    p.stock = parseInt(form.elements.stock.value, 10);
    p.specs = readSpecs();
    if (form.elements.illustrative.checked) p.illustrative = true; else delete p.illustrative;
    if (form.elements.hidden.checked) p.hidden = true; else delete p.hidden;
    if (form.elements.bestseller.checked) p.bestseller = true; else delete p.bestseller;
    p.image = editing.photos[0] || '';
    if (editing.photos.length > 1) p.gallery = editing.photos.slice(1); else delete p.gallery;
    if (!p.image) delete p.image;
    if (!p.imageAlt) p.imageAlt = p.name;

    if (!p.name || !p.shortName) error = 'Preencha o nome completo e o nome curto.';
    else if (!(p.price > 0)) error = 'Informe um preço válido (ex.: 75,60).';
    else if (!Number.isInteger(p.stock) || p.stock < 0) error = 'O estoque precisa ser um número inteiro (0 ou mais).';
    else if (!p.code) error = 'Informe o código do produto.';
    else if (state.products.some(function (o, i) { return i !== editing.index && o.code === p.code; })) error = 'Já existe outro produto com o código ' + p.code + '.';
    else if (state.products.some(function (o, i) { return i !== editing.index && o.shortName === p.shortName; })) error = 'Já existe outro produto com o nome curto "' + p.shortName + '".';

    if (error) {
      $('#editorError').textContent = error;
      $('#editorError').hidden = false;
      return;
    }

    if (editing.index == null) {
      var base = slug(p.shortName), id = base, n = 2;
      while (state.products.some(function (o) { return o.id === id; })) id = base + '-' + (n++);
      p.id = id;
      state.products.push(p);
      toast('Produto criado. Lembre de publicar.');
    } else {
      state.products[editing.index] = p;
      toast('Alterações aplicadas. Lembre de publicar.');
    }
    closeEditor();
    renderStock(); renderProducts(); refreshPending();
  }

  function duplicateProduct(index) {
    var copy = clone(state.products[index]);
    copy.id = '';
    copy.code = '';
    copy.shortName = copy.shortName + ' (cópia)';
    copy.stock = 0;
    openEditor(null, copy);
  }

  function deleteProduct() {
    var editing = state.editing;
    if (!editing || editing.index == null) return;
    var p = state.products[editing.index];
    if (!confirm('Excluir "' + p.shortName + '" do site? As fotos dele também serão apagadas ao publicar.\n\nDica: para tirar só por um tempo, use "Ocultar do site".')) return;
    state.products.splice(editing.index, 1);
    closeEditor();
    renderStock(); renderProducts(); refreshPending();
    toast('Produto excluído. Lembre de publicar.');
  }

  function handlePhotoInput(event) {
    var files = Array.prototype.slice.call(event.target.files || []);
    event.target.value = '';
    if (!files.length || !state.editing) return;
    var base = slug(state.editing.draft.id || $('#editorForm').elements.shortName.value || 'produto');
    busy('Preparando ' + files.length + ' foto(s)…');
    files.reduce(function (chain, file, i) {
      return chain.then(function () {
        return productPhoto(file).then(function (out) {
          var path = PHOTO_DIR + base + '-' + Date.now().toString(36) + i + '.' + out.ext;
          addUpload(path, out.blob);
          state.editing.photos.push(path);
        });
      });
    }, Promise.resolve()).then(function () {
      renderPhotos();
    }).catch(function (error) {
      toast('Não consegui usar uma das fotos: ' + error.message, 5000);
    }).finally(function () { busy(''); });
  }

  function updateCalc() {
    var cost = parseMoney($('#calcCost').value);
    var margin = Number(String($('#calcMargin').value).replace(',', '.')) / 100;
    if (!(cost > 0) || !(margin >= 0 && margin < 0.95)) {
      $('#calcResult').textContent = '—'; $('#calcApply').disabled = true; return null;
    }
    /* Mesma regra da planilha: custo ÷ (1 − margem), arredondado para cima em R$ 0,10. */
    var cents = Math.ceil(Math.round(cost / (1 - margin) * 1e6) / 1e6 / 10) * 10;
    $('#calcResult').textContent = brl(cents);
    $('#calcApply').disabled = false;
    return cents;
  }

  /* ------------------------------ loja ------------------------------ */

  function handleConfigInput(event) {
    var input = event.target;
    if (!input.name) return;
    var value = input.value;
    if (input.name === 'year') value = parseInt(value, 10) || new Date().getFullYear();
    if (input.name === 'pixMerchantName' || input.name === 'pixCity') {
      value = value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    }
    state.config[input.name] = value;
    refreshPending();
  }

  function handleVitrineInput(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    busy('Preparando a foto da vitrine…');
    vitrinePhotos(file).then(function (blobs) {
      addUpload(VITRINE.big, blobs[0]);
      addUpload(VITRINE.small, blobs[1]);
      renderConfig(); refreshPending();
      toast('Foto da vitrine pronta. Lembre de publicar.');
    }).catch(function (error) { toast('Não consegui usar a foto: ' + error.message, 5000); })
      .finally(function () { busy(''); });
  }

  /* ------------------------------ publicar ------------------------------ */

  function publish() {
    var changes = changeList();
    if (!changes.length) return;
    var config = state.config;
    if (!/^\d{12,13}$/.test(String(config.whatsapp || ''))) { toast('WhatsApp inválido na aba Loja (só números, com 55 e DDD).', 5000); return; }
    if (!config.pixKey) { toast('A chave PIX não pode ficar vazia.', 5000); return; }
    if (config.pixKey !== state.original.config.pixKey &&
      !confirm('Você mudou a CHAVE PIX. Todos os QR Codes passarão a usar:\n\n' + config.pixKey + '\n\nConfirma?')) return;

    var deletes = photosToDelete();
    var used = referencedPhotos(state.products);
    var uploads = Object.keys(state.uploads).filter(function (path) {
      return used[path] || path === VITRINE.big || path === VITRINE.small;
    });

    busy('Publicando…');
    var headSha, baseTree;
    gh(repoPath('/git/ref/heads/' + BRANCH)).then(function (ref) {
      headSha = ref.object.sha;
      /* Alguém mudou os dados por outro lugar desde que o painel carregou? */
      return Promise.all([readFile(PRODUCTS_PATH, headSha), readFile(CONFIG_PATH, headSha)]);
    }).then(function (files) {
      if ((hasProductChanges() && files[0].sha !== state.original.productsSha) ||
        (hasConfigChanges() && files[1].sha !== state.original.configSha)) {
        var error = new Error('conflito'); error.status = 409; throw error;
      }
      return gh(repoPath('/git/commits/' + headSha));
    }).then(function (commit) {
      baseTree = commit.tree.sha;
      return uploads.reduce(function (chain, path) {
        return chain.then(function (entries) {
          busy('Enviando fotos… (' + (entries.length + 1) + '/' + uploads.length + ')');
          return blobToBase64(state.uploads[path].blob).then(function (b64) {
            return gh(repoPath('/git/blobs'), { method: 'POST', body: { content: b64, encoding: 'base64' } });
          }).then(function (blob) {
            return entries.concat({ path: path, mode: '100644', type: 'blob', sha: blob.sha });
          });
        });
      }, Promise.resolve([]));
    }).then(function (tree) {
      busy('Gravando alterações…');
      if (hasProductChanges()) tree.push({ path: PRODUCTS_PATH, mode: '100644', type: 'blob', content: productsText() });
      if (hasConfigChanges()) tree.push({ path: CONFIG_PATH, mode: '100644', type: 'blob', content: configText() });
      deletes.forEach(function (path) { tree.push({ path: path, mode: '100644', type: 'blob', sha: null }); });
      return gh(repoPath('/git/trees'), { method: 'POST', body: { base_tree: baseTree, tree: tree } });
    }).then(function (tree) {
      var title = changes.length === 1 ? 'painel: ' + changes[0] : 'painel: ' + changes.length + ' alterações';
      var message = title.slice(0, 72) + '\n\n' + changes.map(function (c) { return '- ' + c; }).join('\n') +
        (deletes.length ? '\n- fotos removidas: ' + deletes.length : '') + '\n\nPublicado pelo painel (' + state.login + ').';
      return gh(repoPath('/git/commits'), { method: 'POST', body: { message: message, tree: tree.sha, parents: [headSha] } });
    }).then(function (commit) {
      return gh(repoPath('/git/refs/heads/' + BRANCH), { method: 'PATCH', body: { sha: commit.sha } });
    }).then(function () {
      return loadData();
    }).then(function () {
      renderAll();
      toast('Publicado! O site atualiza em cerca de 1 minuto.', 5000);
    }).catch(function (error) {
      toast(friendlyError(error), 7000);
    }).finally(function () { busy(''); });
  }

  function discard() {
    if (!confirm('Descartar todas as alterações não publicadas?')) return;
    Object.keys(state.uploads).forEach(function (p) { URL.revokeObjectURL(state.uploads[p].url); });
    state.uploads = {};
    state.products = clone(state.original.products);
    state.config = clone(state.original.config);
    renderAll();
    toast('Alterações descartadas.');
  }

  /* ------------------------------ eventos ------------------------------ */

  function setupTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
          var active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function (panel) {
          panel.hidden = panel.getAttribute('data-panel') !== tab.getAttribute('data-tab');
        });
      });
    });
  }

  function init() {
    setupTabs();
    setupAlerts();

    $('#loginForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var token = $('#tokenInput').value.trim();
      $('#loginError').hidden = true;
      connect(token).then(function () {
        saveToken(token, $('#rememberInput').checked);
        $('#tokenInput').value = '';
      }).catch(function (error) {
        state.token = '';
        $('#loginError').textContent = friendlyError(error);
        $('#loginError').hidden = false;
      });
    });

    $('#logoutBtn').addEventListener('click', function () {
      if (changeList().length && !confirm('Há alterações não publicadas. Sair mesmo assim?')) return;
      clearToken();
      location.reload();
    });

    $('#publishBtn').addEventListener('click', publish);
    $('#discardBtn').addEventListener('click', discard);
    $('#stockSearch').addEventListener('input', renderStock);
    $('#productSearch').addEventListener('input', renderProducts);
    $('#newProductBtn').addEventListener('click', function () { openEditor(null, blankProduct()); });
    $('#editorForm').addEventListener('submit', applyEditor);
    Array.prototype.forEach.call(document.querySelectorAll('[data-close-editor]'), function (btn) {
      btn.addEventListener('click', closeEditor);
    });
    $('#editor').addEventListener('cancel', function () { state.editing = null; });
    $('#deleteProductBtn').addEventListener('click', deleteProduct);
    $('#photoInput').addEventListener('change', handlePhotoInput);
    $('#addSpecBtn').addEventListener('click', function () {
      var row = specRow('', '');
      $('#specList').appendChild(row);
      row.querySelector('input').focus();
    });
    $('#calcCost').addEventListener('input', updateCalc);
    $('#calcMargin').addEventListener('input', updateCalc);
    $('#calcApply').addEventListener('click', function () {
      var cents = updateCalc();
      if (cents) $('#editorForm').elements.price.value = moneyInput(cents);
    });
    $('#configForm').addEventListener('input', handleConfigInput);
    $('#promoForm').addEventListener('change', handlePromoForm);
    $('#promoForm').addEventListener('input', function (event) { if (event.target.name === 'text') handlePromoForm(event); });
    $('#promoForm').addEventListener('submit', function (event) { event.preventDefault(); });
    $('#promoSearch').addEventListener('input', renderPromoList);
    $('#ordersReload').addEventListener('click', loadOrders);
    $('#dashReload').addEventListener('click', loadDashboard);
    $('#markBest').addEventListener('click', markBestsellers);
    document.querySelector('[data-tab="dashboard"]').addEventListener('click', loadDashboard);
    Array.prototype.forEach.call(document.querySelectorAll('[data-period]'), function (chip) {
      chip.addEventListener('click', function () {
        dash.period = chip.getAttribute('data-period');
        Array.prototype.forEach.call(document.querySelectorAll('[data-period]'), function (c) { c.classList.toggle('is-active', c === chip); });
        renderDashboard();
      });
    });
    document.querySelector('[data-tab="pedidos"]').addEventListener('click', loadOrders);
    $('#shipForm').addEventListener('change', handleShipForm);
    $('#shipForm').addEventListener('submit', function (event) { event.preventDefault(); });
    $('#addBandBtn').addEventListener('click', function () {
      var s = ship();
      var last = s.bands[s.bands.length - 1] || { upToKm: 0, price: 0 };
      s.bands.push({ upToKm: last.upToKm + (s.extraStepKm || 5), price: last.price + (s.extraStepPrice || 0) });
      renderBands(); refreshPending();
    });
    $('#addCityBtn').addEventListener('click', function () {
      ship().cities.push({ name: 'Nova cidade', price: null });
      renderCities(); refreshPending();
    });
    $('#simForm').addEventListener('submit', simulate);
    $('#carrierForm').addEventListener('submit', carrierCalc);
    $('#carrierCopy').addEventListener('click', function () {
      var text = $('#carrierMessage').value;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () {
        toast('Mensagem copiada.');
      }, function () { $('#carrierMessage').select(); document.execCommand('copy'); toast('Mensagem copiada.'); });
    });
    $('#simCep').addEventListener('input', function () {
      var d = $('#simCep').value.replace(/\D/g, '').slice(0, 8);
      $('#simCep').value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
    });
    $('#promoAllGeneral').addEventListener('click', function () {
      state.products.forEach(function (p) { delete p.promo; });
      afterPromoChange();
      toast('Todos os produtos seguem a promoção geral.');
    });
    $('#promoAllOut').addEventListener('click', function () {
      if (!confirm('Tirar TODOS os produtos da promoção?')) return;
      state.products.forEach(function (p) { p.promo = { percent: 0 }; });
      afterPromoChange();
    });
    $('#configForm').addEventListener('submit', function (event) { event.preventDefault(); });
    $('#vitrineInput').addEventListener('change', handleVitrineInput);

    window.addEventListener('beforeunload', function (event) {
      if (state.original && changeList().length) { event.preventDefault(); event.returnValue = ''; }
    });

    var token = storedToken();
    if (token) {
      connect(token).catch(function (error) {
        clearToken();
        $('#loginError').textContent = friendlyError(error);
        $('#loginError').hidden = false;
      });
    }
  }

  init();
})();
