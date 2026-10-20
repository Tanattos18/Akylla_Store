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
    return 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + (state.headSha || BRANCH) + '/' + path;
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

  function repoPath(rest) { return '/repos/' + OWNER + '/' + REPO + rest; }

  function readFile(path, ref) {
    return gh(repoPath('/contents/' + path + '?ref=' + encodeURIComponent(ref || BRANCH))).then(function (data) {
      return { text: base64ToUtf8(data.content), sha: data.sha };
    });
  }

  function friendlyError(error) {
    if (error.status === 401) return 'Chave inválida ou vencida. Gere outra no GitHub.';
    if (error.status === 403) return 'A chave não tem permissão de escrita (Contents: Read and write) neste repositório.';
    if (error.status === 404) return 'Repositório não encontrado para esta chave. Confira se ela dá acesso ao Akylla_Store.';
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
      var rest = function (x) { var c = clone(x); delete c.stock; delete c.price; delete c.hidden; return JSON.stringify(c); };
      if (rest(old) !== rest(p)) list.push(p.shortName + ': dados/fotos editados');
    });
    state.original.products.forEach(function (p) { if (!now[p.id]) list.push('excluído: ' + p.shortName); });
    if (configText() !== state.original.configText) list.push('configurações da loja');
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
          el('small', { text: 'Cód. ' + p.code }),
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
          el('small', { text: brl(p.price) + ' · Cód. ' + p.code + ' · ' + (1 + (p.gallery || []).length) + ' foto(s)' }),
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

  function renderAll() {
    renderStock(); renderProducts(); renderConfig(); refreshPending();
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
    $('#editorTitle').textContent = index == null ? 'Novo produto' : 'Editar: ' + product.shortName;
    $('#deleteProductBtn').hidden = index == null;
    $('#editorError').hidden = true;
    $('#calcCost').value = ''; $('#calcResult').textContent = '—'; $('#calcApply').disabled = true;
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
