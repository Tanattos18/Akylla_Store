/*
 * Contagem de visitantes com o Umami (sem cookies, sem dados pessoais).
 * Liga quando `analytics.umamiWebsiteId` está preenchido em config.js e o site está em akyllashop.com
 * (testes no PC não contam). Mostra: visitantes, visitas, páginas vistas, de onde vieram
 * (Instagram, Google…), cidade/país e celular ou computador.
 */
(function () {
  'use strict';

  var cfg = (window.AKYLLA_CONFIG || {}).analytics || {};
  var id = String(cfg.umamiWebsiteId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return;
  if (!/(^|\.)akyllashop\.com$/.test(location.hostname)) return;

  var s = document.createElement('script');
  s.src = 'https://cloud.umami.is/script.js';
  s.defer = true;
  s.setAttribute('data-website-id', id);
  s.setAttribute('data-domains', 'akyllashop.com,www.akyllashop.com');
  document.head.appendChild(s);
})();
