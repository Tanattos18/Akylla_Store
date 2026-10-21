/*
 * Service worker do painel: recebe os avisos push do servidor e mostra a notificação
 * no celular/PC, mesmo com o painel fechado. Não guarda nada em cache.
 */
'use strict';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch (e) { msg = { body: event.data && event.data.text() }; }
  var title = msg.title || 'Novo pedido — Akylla Shop';
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: msg.body || 'Abra o painel para ver o pedido.',
      tag: msg.tag || 'pedido',
      renotify: true,
      requireInteraction: true,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [300, 120, 300, 120, 500],
      data: { url: msg.url || '/admin/#pedidos' }
    }),
    /* painel aberto: avisa a página para tocar o som e atualizar a lista */
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      list.forEach(function (client) { client.postMessage({ type: 'akylla-order', tag: msg.tag || '' }); });
    })
  ]));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = new URL((event.notification.data && event.notification.data.url) || '/admin/#pedidos', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf('/admin/') >= 0) {
        list[i].postMessage({ type: 'akylla-open-orders' });
        return list[i].focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
