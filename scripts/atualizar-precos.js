#!/usr/bin/env node
/*
 * Compara o catálogo do site (assets/js/products.js) com a planilha local
 * Planilha_Precificacao_Produtos.xlsx (não versionada): preço sugerido pela
 * fórmula e quantidade em estoque. NÃO altera o site — preço e estoque são
 * editados pelo painel (admin/).
 *
 * Uso:
 *   node scripts/atualizar-precos.js            # relatório site × planilha
 *   node scripts/atualizar-precos.js outra.xlsx # usa outra planilha
 *
 * O preço sugerido é sempre recalculado com a fórmula da planilha —
 * (custo + custo extra) ÷ (1 − margem − taxas), arredondado para cima (B7) —
 * em vez de usar o valor salvo pelo Excel (fórmulas quebradas não zeram preços).
 *
 * Sem dependências: lê o .xlsx (zip) com o zlib nativo do Node.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var ROOT = path.resolve(__dirname, '..');
var PRODUCTS_FILE = path.join(ROOT, 'assets', 'js', 'products.js');

/* ------------------------------ leitura do xlsx ------------------------------ */

function readZip(file) {
  var buf = fs.readFileSync(file);
  var eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Arquivo não parece ser um .xlsx válido: ' + file);

  var count = buf.readUInt16LE(eocd + 10);
  var offset = buf.readUInt32LE(eocd + 16);
  var entries = {};

  for (var i = 0; i < count; i += 1) {
    var method = buf.readUInt16LE(offset + 10);
    var size = buf.readUInt32LE(offset + 20);
    var nameLen = buf.readUInt16LE(offset + 28);
    var extraLen = buf.readUInt16LE(offset + 30);
    var commentLen = buf.readUInt16LE(offset + 32);
    var local = buf.readUInt32LE(offset + 42);
    var name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);

    var start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    var data = buf.subarray(start, start + size);
    entries[name] = method === 8 ? zlib.inflateRawSync(data) : data;

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeXml(text) {
  return text
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function readSheet(entries, sheetPath) {
  var shared = [];
  if (entries['xl/sharedStrings.xml']) {
    var ss = entries['xl/sharedStrings.xml'].toString('utf8');
    shared = (ss.match(/<si>[\s\S]*?<\/si>/g) || []).map(function (si) {
      return decodeXml(si.replace(/<[^>]+>/g, ''));
    });
  }

  var xml = entries[sheetPath].toString('utf8');
  var cells = {};
  var re = /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  var m;
  while ((m = re.exec(xml))) {
    var inner = m[3] || '';
    var v = /<v>([\s\S]*?)<\/v>/.exec(inner);
    var inline = /<is>([\s\S]*?)<\/is>/.exec(inner);
    var value = null;
    if (inline) value = decodeXml(inline[1].replace(/<[^>]+>/g, ''));
    else if (v) value = /t="s"/.test(m[2]) ? shared[Number(v[1])] : decodeXml(v[1]);
    cells[m[1]] = { value: value, formula: /<f[\s>]/.test(inner) };
  }
  return cells;
}

/* ------------------------------- precificação ------------------------------- */

function num(cells, ref) {
  var cell = cells[ref];
  if (!cell || cell.value == null || cell.value === '') return null;
  var n = Number(cell.value);
  return Number.isFinite(n) ? n : null;
}

/* Arredonda ruído de ponto flutuante (como o Excel faz com 15 dígitos). */
function clean(n) {
  return Math.round(n * 1e9) / 1e9;
}

function pricesFromSheet(file) {
  var cells = readSheet(readZip(file), 'xl/worksheets/sheet1.xml');
  var margin = num(cells, 'B4') || 0;
  var extra = num(cells, 'B5') || 0;
  var tax = num(cells, 'B6') || 0;
  var step = num(cells, 'B7') || 0;
  var prices = {};
  var stock = {};
  var warnings = [];

  /* Valor digitado na linha (sem fórmula) ou, na falta dele, o valor geral. */
  function typedOr(ref, fallback) {
    var cell = cells[ref];
    if (!cell || cell.formula) return fallback;
    var n = num(cells, ref);
    return n == null ? fallback : n;
  }

  for (var row = 11; row < 1000; row += 1) {
    var code = cells['A' + row] && cells['A' + row].value;
    if (code == null || code === '') {
      if (cells['B' + row] && /TOTAIS/i.test(String(cells['B' + row].value))) break;
      continue;
    }
    code = String(code).trim();

    var cost = num(cells, 'D' + row);
    if (cost == null || cost <= 0) {
      throw new Error('Linha ' + row + ' (cód. ' + code + ') sem custo unitário válido na coluna D.');
    }
    var rowMargin = typedOr('H' + row, margin);
    var rowTax = typedOr('I' + row, tax);
    if (rowMargin + rowTax >= 1) throw new Error('Linha ' + row + ': margem + taxas ≥ 100%.');

    var price = clean((cost + typedOr('E' + row, extra)) / (1 - rowMargin - rowTax));
    if (step > 0) price = Math.ceil(clean(price / step)) * step;
    var cents = Math.round(clean(price) * 100);
    if (!(cents > 0)) throw new Error('Linha ' + row + ' (cód. ' + code + '): preço calculado inválido.');
    prices[code] = cents;

    /* Avisa quando o que o Excel mostra na coluna K não bate com a fórmula. */
    var excel = cells['K' + row] && cells['K' + row].value;
    if (excel != null && excel !== '' && Math.round(Number(excel) * 100) !== cents) {
      var shown = Number.isFinite(Number(excel)) ? brl(Math.round(Number(excel) * 100)) : String(excel);
      warnings.push(code + ': o Excel mostra ' + shown + ', a fórmula dá ' + brl(cents));
    }

    var qty = num(cells, 'C' + row);
    if (qty != null) stock[code] = Math.max(0, Math.round(qty));
  }

  return { prices: prices, stock: stock, warnings: warnings, margin: margin, tax: tax, step: step };
}

/* ---------------------------------- main ---------------------------------- */

function brl(cents) {
  return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
}

function main() {
  var args = process.argv.slice(2);
  var sheet = args.filter(function (a) { return a.indexOf('--') !== 0; })[0] ||
    path.join(ROOT, 'Planilha_Precificacao_Produtos.xlsx');

  if (!fs.existsSync(sheet)) {
    console.error('Planilha não encontrada: ' + sheet);
    process.exit(2);
  }

  var result = pricesFromSheet(sheet);
  var catalog = require(path.join(ROOT, 'admin', 'formato.js')).parseProducts(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  var diffs = [];
  var seen = {};

  catalog.products.forEach(function (p) {
    seen[p.code] = true;
    var price = result.prices[p.code];
    if (price != null && price !== p.price) diffs.push('  ' + p.code.padEnd(6) + ' ' + p.shortName.padEnd(26) + ' preço   site ' + brl(p.price) + ' · planilha sugere ' + brl(price));
    var qty = result.stock[p.code];
    if (qty != null && qty !== p.stock) diffs.push('  ' + p.code.padEnd(6) + ' ' + p.shortName.padEnd(26) + ' estoque site ' + p.stock + ' · planilha ' + qty);
  });

  console.log('Planilha: ' + path.basename(sheet) + ' — margem ' + Math.round(result.margin * 100) +
    '%, taxas ' + Math.round(result.tax * 100) + '%, arredondamento ' + brl(Math.round(result.step * 100)));
  console.log('O painel (admin/) é quem manda no preço e no estoque. Este relatório só compara com a planilha.');

  if (result.warnings.length) {
    console.log('Atenção: o Excel mostra preços diferentes da fórmula (confira a coluna E — use $B$5):');
    result.warnings.forEach(function (w) { console.log('  ' + w); });
  }
  var missing = Object.keys(result.prices).filter(function (code) { return !seen[code]; });
  if (missing.length) console.log('Na planilha, mas fora do site: ' + missing.join(', '));

  if (!diffs.length) console.log('Site e planilha batem.');
  else { console.log(diffs.length + ' diferença(s) — ajuste pelo painel se quiser seguir a planilha:'); diffs.forEach(function (d) { console.log(d); }); }
}

if (require.main === module) {
  main();
}

module.exports = { pricesFromSheet: pricesFromSheet };
