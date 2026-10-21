/*
 * Formato dos arquivos de dados do site (products.js e config.js).
 * Usado pelo painel (navegador) e pelos scripts/testes (Node), para que os
 * dois leiam e escrevam exatamente o mesmo texto.
 *
 * Os dados ficam como JSON atribuído a window.*: o site carrega com <script>
 * e o painel lê com JSON.parse (sem executar código).
 */
(function (root) {
  'use strict';

  var PRODUCTS_HEADER = [
    '/*',
    ' * Catálogo da Akylla Shop — gerado pelo painel (admin/).',
    ' * Preços em centavos (7560 = R$ 75,60). `stock` = unidades disponíveis.',
    ' * `gallery` = fotos extras; `illustrative` = foto representativa; `hidden` = fora do site.',
    ' * Prefira editar pelo painel: alterações manuais aqui são mantidas, mas',
    ' * comentários e formatação são reescritos na próxima publicação.',
    ' */'
  ].join('\n');

  var CONFIG_HEADER = [
    '/*',
    ' * Configurações da Akylla Shop — gerado pelo painel (admin/).',
    ' * Contato, PIX e textos de atendimento.',
    ' */'
  ].join('\n');

  function serializeProducts(categories, products) {
    return PRODUCTS_HEADER + '\n' +
      'window.AKYLLA_CATEGORIES = ' + JSON.stringify(categories, null, 2) + ';\n\n' +
      'window.AKYLLA_PRODUCTS = ' + JSON.stringify(products, null, 2) + ';\n';
  }

  function serializeConfig(config) {
    return CONFIG_HEADER + '\n' +
      'window.AKYLLA_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n';
  }

  function grab(source, name) {
    var marker = 'window.' + name + ' = ';
    var start = source.indexOf(marker);
    if (start < 0) throw new Error('Não encontrei ' + name + ' no arquivo.');
    start += marker.length;
    /* JSON.stringify nunca gera quebra de linha dentro de strings,
       então ";\n" só aparece no fim da atribuição. */
    var end = source.indexOf(';\n', start);
    if (end < 0) end = source.lastIndexOf(';');
    return JSON.parse(source.slice(start, end));
  }

  function parseProducts(source) {
    return { categories: grab(source, 'AKYLLA_CATEGORIES'), products: grab(source, 'AKYLLA_PRODUCTS') };
  }

  function parseConfig(source) {
    return grab(source, 'AKYLLA_CONFIG');
  }

  var api = {
    serializeProducts: serializeProducts,
    serializeConfig: serializeConfig,
    parseProducts: parseProducts,
    parseConfig: parseConfig
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AkyllaFormato = api;
})(this);
