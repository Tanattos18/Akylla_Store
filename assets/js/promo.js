/*
 * Promoções — cálculo único usado pelo site, pelo painel e pelos testes.
 *
 * O desconto é REAL: sai do preço praticado (`product.price`). O preço riscado
 * mostrado no site é sempre esse preço normal (nunca um valor inventado).
 *
 * Configuração (config.js → `promo`):
 *   { active: true, text: 'Descontos de inauguração…', percent: 10, until: '2026-10-31' }
 * Por produto (products.js → `promo`, opcional):
 *   ausente                      → segue a promoção geral
 *   { percent: 15, until: '…' }  → promoção própria (campo vazio herda o geral)
 *   { percent: 0 }               → fora da promoção
 * `until` é o último dia válido (inclusive), no horário do aparelho do cliente.
 */
(function (root) {
  'use strict';

  var MAX_PERCENT = 90;

  function toDay(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function clampPercent(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(MAX_PERCENT, Math.round(n * 10) / 10);
  }

  /* Preço com desconto, arredondado para BAIXO em R$ 0,10 (a favor do cliente). */
  function discounted(cents, percent) {
    var value = Math.floor(Math.round(cents * (100 - percent)) / 100 / 10) * 10;
    return Math.max(10, Math.min(cents, value));
  }

  /* Regra efetiva de promoção de um produto (ou null se não houver). */
  function ruleFor(product, config) {
    var general = config && config.promo;
    if (!general || !general.active || !product) return null;
    var own = product.promo;
    var percent = clampPercent(own && own.percent != null && own.percent !== '' ? own.percent : general.percent);
    var until = (own && own.until) || general.until || '';
    if (!percent) return null;
    return { percent: percent, until: until, custom: !!own };
  }

  /*
   * Preço de venda de um produto agora.
   * Retorna { price, original, percent, until, active }.
   */
  function priceFor(product, config, now) {
    var original = Number(product && product.price) || 0;
    var rule = ruleFor(product, config);
    var today = toDay(now);
    if (!rule || !original || (rule.until && today > rule.until)) {
      return { price: original, original: original, percent: 0, until: '', active: false };
    }
    return { price: discounted(original, rule.percent), original: original, percent: rule.percent, until: rule.until, active: true };
  }

  /* Resumo para a faixa do site: maior desconto ativo e a última data. */
  function summary(products, config, now) {
    var max = 0, min = Infinity, last = '', count = 0;
    (products || []).forEach(function (p) {
      var info = priceFor(p, config, now);
      if (!info.active) return;
      count += 1;
      max = Math.max(max, info.percent);
      min = Math.min(min, info.percent);
      if (info.until && info.until > last) last = info.until;
    });
    return {
      active: count > 0,
      count: count,
      total: (products || []).length,
      maxPercent: max,
      uniform: count > 0 && min === max,
      until: last,
      text: (config && config.promo && config.promo.text) || ''
    };
  }

  function formatDay(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] : '';
  }

  /*
   * Venda com reposição pelo fornecedor (config.js → `restock`: { enabled, default, days }).
   * Além do estoque físico (`stock`), cada produto pode vender até N a mais
   * (`product.restock`; sem o campo usa o padrão; 0 = só o que tem em casa).
   * O estoque físico pode ficar negativo: −3 = 3 unidades para comprar no fornecedor.
   */
  function restockLimit(product, config) {
    var r = (config && config.restock) || {};
    if (!r.enabled || !product) return 0;
    var own = product.restock;
    var n = own != null && own !== '' ? Number(own) : Number(r['default']);
    return Number.isFinite(n) && n > 0 ? Math.min(99, Math.floor(n)) : 0;
  }

  /* Quanto ainda dá para vender: físico + reposição permitida. */
  function available(product, config) {
    if (!product || typeof product.stock !== 'number') return 99;
    return Math.max(0, Math.min(99, product.stock + restockLimit(product, config)));
  }

  var api = {
    restockLimit: restockLimit,
    available: available,
    priceFor: priceFor,
    summary: summary,
    discounted: discounted,
    formatDay: formatDay,
    toDay: toDay,
    MAX_PERCENT: MAX_PERCENT
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AkyllaPromo = api;
})(this);
