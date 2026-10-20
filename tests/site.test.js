/*
 * Testes automáticos do site (sem dependências).
 * Rode com: node --test "tests/*.test.js"
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* Carrega os scripts do site num "window" isolado, como o navegador faria. */
function loadScripts(files) {
  var sandbox = { window: {} };
  vm.createContext(sandbox);
  files.forEach(function (file) {
    vm.runInContext(read(file), sandbox, { filename: file });
  });
  return sandbox.window;
}

var win = loadScripts(['assets/js/config.js', 'assets/js/products.js', 'assets/js/pix.js']);
var CONFIG = win.AKYLLA_CONFIG;
var PRODUCTS = win.AKYLLA_PRODUCTS;
var CATEGORIES = win.AKYLLA_CATEGORIES;
var Pix = win.AkyllaPix;

/* -------------------------------- catálogo -------------------------------- */

test('catálogo tem produtos', function () {
  assert.ok(Array.isArray(PRODUCTS) && PRODUCTS.length > 0);
});

test('id, código e nome curto são únicos', function () {
  ['id', 'code', 'shortName'].forEach(function (field) {
    var values = PRODUCTS.map(function (p) { return p[field]; });
    var repeated = values.filter(function (v, i) { return values.indexOf(v) !== i; });
    assert.equal(repeated.length, 0, field + ' repetido: ' + repeated.join(', '));
  });
});

test('preços são inteiros positivos em centavos', function () {
  PRODUCTS.forEach(function (p) {
    assert.ok(Number.isInteger(p.price) && p.price > 0, p.id + ': preço inválido (' + p.price + ')');
  });
});

test('categoria, ícone e foto de cada produto existem', function () {
  var categories = CATEGORIES.map(function (c) { return c.id; });
  var html = read('index.html');
  PRODUCTS.forEach(function (p) {
    assert.ok(categories.indexOf(p.category) >= 0, p.id + ': categoria inexistente ' + p.category);
    assert.ok(html.indexOf('id="icon-' + p.visual + '"') >= 0, p.id + ': ícone inexistente ' + p.visual);
    if (p.image) assert.ok(fs.existsSync(path.join(ROOT, p.image)), p.id + ': foto não encontrada ' + p.image);
  });
});

test('preços citados na página apontam para produtos existentes', function () {
  var html = read('index.html');
  var ids = [];
  html.replace(/data-price-of="([^"]+)"/g, function (_, id) { ids.push(id); });
  assert.ok(ids.length > 0);
  ids.forEach(function (id) {
    assert.ok(PRODUCTS.some(function (p) { return p.id === id; }), 'produto inexistente no hero: ' + id);
  });
});

test('preços batem com a planilha (quando ela está na pasta)', function (t) {
  var sheet = path.join(ROOT, 'Planilha_Precificacao_Produtos.xlsx');
  if (!fs.existsSync(sheet)) {
    t.skip('planilha não versionada — teste só roda localmente');
    return;
  }
  var prices = require('../scripts/atualizar-precos.js').pricesFromSheet(sheet).prices;
  PRODUCTS.forEach(function (p) {
    assert.equal(p.price, prices[p.code], p.code + ' ' + p.shortName + ': preço diferente da planilha');
  });
});

/* ----------------------------------- PIX ----------------------------------- */

test('CRC16 do PIX confere com o valor de referência', function () {
  assert.equal(Pix.crc16('123456789'), '29B1');
});

test('payload PIX do maior pedido possível é válido', function () {
  var total = PRODUCTS.reduce(function (sum, p) { return sum + p.price * 99; }, 0);
  var payload = Pix.buildPixPayload({
    key: CONFIG.pixKey,
    merchantName: CONFIG.pixMerchantName,
    city: CONFIG.pixCity,
    amountCents: total,
    txid: 'AKTESTE123456789ABCDEFGHI',
    description: 'Pedido AK-ABCDEFGHI'
  });
  var result = Pix.validatePixPayload(payload);
  assert.equal(result.valid, true);
  assert.equal(result.fields['54'], (total / 100).toFixed(2));
  assert.equal(result.fields['53'], '986');
});

test('dados do PIX respeitam os limites do BR Code', function () {
  assert.ok(CONFIG.pixKey, 'chave PIX vazia');
  assert.ok(CONFIG.pixMerchantName.length <= 25, 'nome do recebedor > 25 caracteres');
  assert.ok(CONFIG.pixCity.length <= 15, 'cidade > 15 caracteres');
  assert.match(CONFIG.whatsapp, /^\d{12,13}$/);
});

/* --------------------------------- páginas --------------------------------- */

test('páginas identificam o vendedor e não dependem do Google Fonts', function () {
  ['index.html', 'privacidade.html', 'termos.html'].forEach(function (file) {
    var html = read(file);
    assert.match(html, /CPF \d{3}\.\d{3}\.\d{3}-\d{2}/, file + ': sem identificação do vendedor');
    assert.match(html, /CEP \d{5}-\d{3}/, file + ': sem endereço do vendedor');
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/, file + ': ainda carrega Google Fonts');
  });
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/fonts/dm-sans-latin.woff2')));
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/fonts/sora-latin.woff2')));
});

test('scripts e estilos referenciados existem', function () {
  ['index.html', 'privacidade.html', 'termos.html'].forEach(function (file) {
    read(file).replace(/(?:src|href)="((?:assets\/)[^"?#]+)/g, function (_, ref) {
      assert.ok(fs.existsSync(path.join(ROOT, ref)), file + ': arquivo não encontrado ' + ref);
    });
  });
});
