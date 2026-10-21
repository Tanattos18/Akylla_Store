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
    (p.gallery || []).forEach(function (src) {
      assert.ok(fs.existsSync(path.join(ROOT, src)), p.id + ': foto da galeria não encontrada ' + src);
    });
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

test('estoque é inteiro e não negativo', function () {
  PRODUCTS.forEach(function (p) {
    if (p.stock == null) return;
    assert.ok(Number.isInteger(p.stock) && p.stock >= 0, p.id + ': estoque inválido (' + p.stock + ')');
  });
});

test('formato do catálogo e da configuração é lido e regravado sem perdas', function () {
  var F = require('../admin/formato.js');
  var catalog = F.parseProducts(read('assets/js/products.js'));
  assert.equal(F.serializeProducts(catalog.categories, catalog.products), read('assets/js/products.js'));
  assert.equal(F.serializeConfig(F.parseConfig(read('assets/js/config.js'))), read('assets/js/config.js'));
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

/* --------------------------------- painel --------------------------------- */

test('painel: arquivos existem, scripts compilam e a política de segurança está ativa', function () {
  ['admin/index.html', 'admin/admin.css', 'admin/admin.js', 'admin/formato.js'].forEach(function (file) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), 'faltando ' + file);
  });
  new vm.Script(read('admin/admin.js'), { filename: 'admin.js' });
  new vm.Script(read('admin/formato.js'), { filename: 'formato.js' });
  var html = read('admin/index.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src https:\/\/api\.github\.com/);
  assert.match(html, /noindex/);
  assert.match(read('robots.txt'), /Disallow: \/admin\//);
  html.replace(/(?:src|href)="(\.\.\/assets\/[^"?#]+|[a-z]+\.(?:js|css))/g, function (_, ref) {
    assert.ok(fs.existsSync(path.join(ROOT, 'admin', ref)), 'admin/index.html: arquivo não encontrado ' + ref);
  });
});

test('produtos ocultos não aparecem na loja', function () {
  assert.match(read('assets/js/app.js'), /!product\.hidden/);
});

/* -------------------------------- promoção -------------------------------- */

test('promoção: desconto real sobre o preço atual, com data de fim e regras por produto', function () {
  var Promo = require('../assets/js/promo.js');
  var cfg = { promo: { active: true, text: 'Inauguração', percent: 10, until: '2026-10-31' } };
  var during = new Date(2026, 9, 20), after = new Date(2026, 10, 1), lastDay = new Date(2026, 9, 31, 23, 59);
  var p = { price: 7560 };

  var info = Promo.priceFor(p, cfg, during);
  assert.equal(info.original, 7560, 'o riscado é o preço atual cadastrado');
  assert.equal(info.price, 6800, '10% de R$ 75,60 = R$ 68,04 → arredonda para baixo: R$ 68,00');
  assert.equal(Promo.priceFor(p, cfg, lastDay).active, true, 'vale até o fim do último dia');
  assert.equal(Promo.priceFor(p, cfg, after).price, 7560, 'depois da data volta ao preço normal');
  assert.equal(Promo.priceFor({ price: 7560, promo: { percent: 0 } }, cfg, during).active, false, 'fora da promoção');
  assert.equal(Promo.priceFor({ price: 10000, promo: { percent: 20, until: '2026-11-15' } }, cfg, after).price, 8000, 'promoção própria com outra data');
  assert.equal(Promo.priceFor(p, { promo: { active: false, percent: 10 } }, during).active, false, 'promoção geral desligada');
  assert.equal(Promo.priceFor({ price: 1000, promo: { percent: 500 } }, cfg, during).price, 100, 'desconto limitado a 90%');
  assert.ok(info.price <= info.original);
});

test('promoção: o catálogo cadastrado não muda e o desconto sempre fica abaixo do preço', function () {
  var Promo = require('../assets/js/promo.js');
  PRODUCTS.forEach(function (p) {
    var info = Promo.priceFor(p, CONFIG, new Date(2026, 9, 20));
    assert.equal(info.original, p.price);
    assert.ok(info.price > 0 && info.price <= p.price, p.id + ': preço promocional inválido');
  });
});

test('promoção: QR do PIX usa o total com desconto', function () {
  var Promo = require('../assets/js/promo.js');
  var cfg = { promo: { active: true, percent: 10, until: '2099-12-31' } };
  var total = Promo.priceFor({ price: 18850 }, cfg).price * 2;
  var payload = Pix.buildPixPayload({ key: CONFIG.pixKey, merchantName: CONFIG.pixMerchantName, city: CONFIG.pixCity, amountCents: total, txid: 'AKTESTE' });
  assert.equal(Pix.validatePixPayload(payload).fields['54'], (total / 100).toFixed(2));
  assert.match(read('assets/js/app.js'), /item\.unit \* item\.qty/);
});

/* ---------------------------------- frete ---------------------------------- */

test('frete: tabela por distância de ida e cidades especiais', function () {
  var Frete = require('../assets/js/frete.js');
  /* tabela fixa de exemplo: os valores reais mudam pelo painel e não devem quebrar o teste */
  var cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.shipping.bands = [[15, 2500], [20, 2800], [25, 3100], [30, 3400], [35, 3700], [40, 4000]].map(function (b) { return { upToKm: b[0], price: b[1] }; });
  cfg.shipping.extraStepKm = 5;
  cfg.shipping.extraStepPrice = 300;
  cfg.shipping.cities = [{ name: 'Senador Canedo', price: 2500 }, { name: 'Aparecida de Goiânia', price: null }, { name: 'Goianira', price: null }, { name: 'Trindade', price: null }];
  var cases = { 0.5: 2500, 15: 2500, 15.1: 2800, 20: 2800, 25: 3100, 30: 3400, 35: 3700, 40: 4000, 40.1: 4300, 45: 4300, 45.1: 4600, 50: 4600 };
  Object.keys(cases).forEach(function (km) {
    assert.equal(Frete.feeForKm(Number(km), cfg), cases[km], km + ' km');
  });
  assert.equal(Frete.cityRule('Senador Canedo', cfg).price, 2500);
  assert.equal(Frete.cityRule('aparecida de goiania', cfg).price, null, 'Aparecida: a combinar');
  assert.equal(Frete.cityRule('Goianira', cfg).price, null);
  assert.equal(Frete.cityRule('Trindade', cfg).price, null);
  assert.equal(Frete.cityRule('Anápolis', cfg), null);
});

test('frete: cotação completa (CEP → mapa → rota) com serviços simulados', async function () {
  var Frete = require('../assets/js/frete.js');
  var realFetch = global.fetch;
  var json = function (data) { return Promise.resolve({ ok: true, json: function () { return Promise.resolve(data); } }); };
  global.fetch = function (url) {
    if (url.indexOf('viacep') >= 0) {
      if (url.indexOf('75250000') >= 0) return json({ cep: '75250-000', logradouro: '', bairro: '', localidade: 'Senador Canedo', uf: 'GO' });
      if (url.indexOf('75000000') >= 0) return json({ cep: '75000-000', logradouro: '', bairro: '', localidade: 'Anápolis', uf: 'GO' });
      return json({ cep: '74230-010', logradouro: 'Rua T-30', bairro: 'Setor Bueno', localidade: 'Goiânia', uf: 'GO' });
    }
    if (url.indexOf('nominatim') >= 0) return json([{ lat: '-16.70', lon: '-49.27' }]);
    if (url.indexOf('osrm') >= 0) return json({ code: 'Ok', routes: [{ distance: 17340 }] });
    return Promise.reject(new Error('url inesperada ' + url));
  };
  try {
    var q = await Frete.quote({ cep: '74230-010', number: '120' }, CONFIG);
    assert.equal(q.kind, 'distance');
    assert.equal(q.km, 17.3);
    assert.equal(q.fee, 2800);
    assert.equal(q.precision, 'endereço');
    assert.equal((await Frete.quote({ cep: '75250-000', number: '1' }, CONFIG)).fee, 2500);
    assert.equal((await Frete.quote({ cep: '75000-000', number: '1' }, CONFIG)).kind, 'carrier', 'interior: transportadora');
    assert.deepEqual(JSON.parse(JSON.stringify(Frete.carrierTotal(4000, CONFIG))), { freight: 4000, fee: 1200, total: 5200, percent: 30 }, 'R$ 40 + 30% = R$ 52');
    await assert.rejects(Frete.quote({ cep: '123', number: '1' }, CONFIG), /8 números/);
  } finally {
    global.fetch = realFetch;
  }
});

test('checkout: itens podem ser alterados/removidos e o PIX só sai com a entrega escolhida', function () {
  var app = read('assets/js/app.js');
  var html = read('index.html');
  assert.match(app, /data-co-qty/);
  assert.match(app, /data-co-remove/);
  assert.match(app, /function refreshOrderFromCart/);
  assert.match(app, /aria-disabled', ready \? 'false' : 'true'/);
  assert.match(html, /id="productDialogBuy"/, 'botão Comprar agora');
});

test('frete promocional: vale até a data (dia de Brasília) e depois volta ao normal sozinho', function () {
  var Frete = require('../assets/js/frete.js');
  var cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.shipping.bands = [{ upToKm: 15, price: 2500, promoPrice: 1500 }, { upToKm: 20, price: 2800 }];
  cfg.shipping.extraStepKm = 5;
  cfg.shipping.extraStepPrice = 500;
  cfg.shipping.promoUntil = '2026-10-31';
  var at = function (iso) { return Date.parse(iso); };
  assert.equal(Frete.feeForKm(10, cfg, at('2026-10-31T12:00:00Z')), 1500, 'promoção valendo');
  assert.equal(Frete.feeForKm(10, cfg, at('2026-11-01T02:59:00Z')), 1500, '31/10 às 23:59 em Brasília');
  assert.equal(Frete.feeForKm(10, cfg, at('2026-11-01T03:00:00Z')), 2500, '01/11 à 00:00 em Brasília: normal');
  assert.equal(Frete.feeForKm(18, cfg, at('2026-10-20T12:00:00Z')), 2800, 'faixa sem promo não muda');
  cfg.shipping.promoUntil = '';
  assert.equal(Frete.feeForKm(10, cfg, at('2026-10-20T12:00:00Z')), 2500, 'sem data, sem promoção');
});
