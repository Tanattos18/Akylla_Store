#!/usr/bin/env node
/*
 * Atualiza os preços do catálogo (assets/js/products.js) a partir da
 * planilha local Planilha_Precificacao_Produtos.xlsx (não versionada).
 *
 * Uso:
 *   node scripts/atualizar-precos.js            # aplica os preços
 *   node scripts/atualizar-precos.js --check    # só compara (sai com erro se houver diferença)
 *   node scripts/atualizar-precos.js outra.xlsx # usa outra planilha
 *
 * Os produtos são casados pelo código (coluna A da aba "Precificação" com o
 * campo `code` do products.js). Se a planilha foi salva pelo Excel, usa o
 * "Preço final unit." calculado (coluna K); senão, aplica a mesma fórmula da
 * planilha: custo ÷ (1 − margem − taxas), arredondado para cima (B7).
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

  for (var row = 11; row < 1000; row += 1) {
    var code = cells['A' + row] && cells['A' + row].value;
    if (code == null || code === '') {
      if (cells['B' + row] && /TOTAIS/i.test(String(cells['B' + row].value))) break;
      continue;
    }

    var cached = num(cells, 'K' + row);
    var price;
    if (cached != null) {
      price = cached;
    } else {
      var cost = num(cells, 'D' + row);
      if (cost == null) throw new Error('Linha ' + row + ' sem custo unitário (coluna D).');
      var rowExtra = cells['E' + row] && !cells['E' + row].formula ? num(cells, 'E' + row) || 0 : extra;
      var rowMargin = cells['H' + row] && !cells['H' + row].formula ? num(cells, 'H' + row) || 0 : margin;
      var rowTax = cells['I' + row] && !cells['I' + row].formula ? num(cells, 'I' + row) || 0 : tax;
      if (rowMargin + rowTax >= 1) throw new Error('Linha ' + row + ': margem + taxas ≥ 100%.');
      price = clean((cost + rowExtra) / (1 - rowMargin - rowTax));
      if (step > 0) price = Math.ceil(clean(price / step)) * step;
    }

    prices[String(code).trim()] = Math.round(clean(price) * 100);
  }

  return { prices: prices, margin: margin, tax: tax, step: step };
}

/* ---------------------------------- main ---------------------------------- */

function brl(cents) {
  return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
}

function main() {
  var args = process.argv.slice(2);
  var checkOnly = args.indexOf('--check') >= 0;
  var sheet = args.filter(function (a) { return a.indexOf('--') !== 0; })[0] ||
    path.join(ROOT, 'Planilha_Precificacao_Produtos.xlsx');

  if (!fs.existsSync(sheet)) {
    console.error('Planilha não encontrada: ' + sheet);
    process.exit(2);
  }

  var result = pricesFromSheet(sheet);
  var source = fs.readFileSync(PRODUCTS_FILE, 'utf8');
  var seen = {};
  var changes = [];

  /* Troca só o `price` que vem logo depois do `code` de cada produto. */
  var updated = source.replace(/shortName: '([^']+)'([^{}]*?)code: '([^']+)'([^{}]*?)price: (\d+)/g,
    function (match, name, beforeCode, code, beforePrice, current) {
      seen[code] = true;
      var target = result.prices[code];
      if (target == null || Number(current) === target) return match;
      changes.push({ code: code, name: name, from: Number(current), to: target });
      return "shortName: '" + name + "'" + beforeCode + "code: '" + code + "'" + beforePrice + 'price: ' + target;
    });

  var missingInSite = Object.keys(result.prices).filter(function (code) { return !seen[code]; });
  var missingInSheet = Object.keys(seen).filter(function (code) { return result.prices[code] == null; });

  console.log('Planilha: ' + path.basename(sheet) + ' — margem ' + Math.round(result.margin * 100) +
    '%, taxas ' + Math.round(result.tax * 100) + '%, arredondamento ' + brl(Math.round(result.step * 100)));

  changes.forEach(function (c) {
    console.log('  ' + c.code.padEnd(6) + ' ' + c.name.padEnd(26) + ' ' + brl(c.from) + ' → ' + brl(c.to));
  });
  if (missingInSite.length) console.log('Na planilha, mas fora do site: ' + missingInSite.join(', '));
  if (missingInSheet.length) console.log('No site, mas fora da planilha: ' + missingInSheet.join(', '));

  if (!changes.length) {
    console.log('Todos os preços já batem com a planilha.');
    return;
  }

  if (checkOnly) {
    console.log(changes.length + ' preço(s) diferente(s). Rode sem --check para aplicar.');
    process.exit(1);
  }

  fs.writeFileSync(PRODUCTS_FILE, updated);
  console.log(changes.length + ' preço(s) atualizado(s) em assets/js/products.js.');
}

if (require.main === module) {
  main();
}

module.exports = { pricesFromSheet: pricesFromSheet };
