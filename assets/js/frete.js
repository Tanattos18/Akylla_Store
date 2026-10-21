/*
 * Frete — cálculo único usado pelo site, pelo painel e pelos testes.
 *
 * Regras (config.js → `shipping`, editável no painel):
 *   - Goiânia: pela distância de IDA (rota de moto/carro) a partir da loja,
 *     nas faixas `bands` ({ upToKm, price } em centavos). Acima da última faixa,
 *     soma `extraStepPrice` a cada `extraStepKm` km adicionais (ou fração).
 *   - Cidades em `cities`: valor fixo (`price`) ou "a combinar" (`price: null`).
 *   - Outras cidades (interior e outras regiões): envio por transportadora —
 *     frete cotado individualmente + taxa administrativa (`carrier.feePercent`, 30%).
 *     Valor final = frete da transportadora × 1,30, informado ao cliente antes do envio.
 *
 * Serviços gratuitos usados no navegador (sem chave):
 *   ViaCEP (endereço pelo CEP) · Nominatim/OpenStreetMap (coordenadas) ·
 *   OSRM (distância da rota). A distância pode diferir um pouco do Google Maps;
 *   ela vai na mensagem do pedido para conferência.
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    enabled: true,
    pickup: true,
    pickupNote: 'Retirada combinada pelo WhatsApp no Conj. Res. Aruanã III, Goiânia/GO.',
    originLabel: 'Rua Capauam, nº 752 — Conj. Res. Aruanã III, Goiânia/GO',
    origin: { lat: -16.6818529, lon: -49.2018912 },
    bands: [
      { upToKm: 15, price: 2500 },
      { upToKm: 20, price: 2800 },
      { upToKm: 25, price: 3100 },
      { upToKm: 30, price: 3400 },
      { upToKm: 35, price: 3700 },
      { upToKm: 40, price: 4000 }
    ],
    extraStepKm: 5,
    extraStepPrice: 300,
    homeCity: 'Goiânia',
    carrier: { enabled: true, feePercent: 30 },
    cities: [
      { name: 'Senador Canedo', price: 2500 },
      { name: 'Aparecida de Goiânia', price: null },
      { name: 'Goianira', price: null },
      { name: 'Trindade', price: null }
    ]
  };

  function settings(config) {
    var s = (config && config.shipping) || {};
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = s[k] != null ? s[k] : DEFAULTS[k]; });
    out.bands = (out.bands || []).slice().sort(function (a, b) { return a.upToKm - b.upToKm; });
    return out;
  }

  function norm(text) {
    return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  /* Valor (centavos) para uma distância de ida em km. */
  function feeForKm(km, config) {
    var s = settings(config);
    var d = Math.max(0, Number(km) || 0);
    for (var i = 0; i < s.bands.length; i += 1) {
      if (d <= s.bands[i].upToKm + 1e-9) return s.bands[i].price;
    }
    var last = s.bands[s.bands.length - 1];
    if (!last) return null;
    var steps = Math.ceil((d - last.upToKm) / (s.extraStepKm || 5) - 1e-9);
    return last.price + steps * (s.extraStepPrice || 0);
  }

  function cityRule(city, config) {
    var s = settings(config);
    var key = norm(city);
    for (var i = 0; i < s.cities.length; i += 1) {
      if (norm(s.cities[i].name) === key) return s.cities[i];
    }
    return null;
  }

  /* ----------------------------- serviços ----------------------------- */

  var cache = {};
  var lastNominatim = 0;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function getJSON(url) {
    return fetch(url, { headers: { Accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  /* Nominatim pede no máximo 1 requisição por segundo. */
  function nominatim(params) {
    var wait = Math.max(0, lastNominatim + 1100 - Date.now());
    return sleep(wait).then(function () {
      lastNominatim = Date.now();
      var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
      return getJSON('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&' + qs);
    }).then(function (list) {
      var hit = list && list[0];
      return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
    });
  }

  function lookupCep(cep) {
    var digits = String(cep || '').replace(/\D/g, '');
    if (digits.length !== 8) return Promise.reject(new Error('Digite um CEP com 8 números.'));
    return getJSON('https://viacep.com.br/ws/' + digits + '/json/').then(function (data) {
      if (!data || data.erro) throw new Error('CEP não encontrado. Confira os números.');
      return {
        cep: data.cep,
        street: data.logradouro || '',
        district: data.bairro || '',
        city: data.localidade || '',
        uf: data.uf || ''
      };
    });
  }

  /* Coordenadas do endereço, da mais precisa para a mais aproximada. */
  function geocode(address, number) {
    var city = address.city + ', ' + address.uf;
    var tries = [];
    if (address.street && number) tries.push({ precision: 'endereço', params: { street: number + ' ' + address.street, city: address.city, state: 'Goiás', country: 'Brasil' } });
    if (address.street) tries.push({ precision: 'rua', params: { q: address.street + ', ' + (address.district ? address.district + ', ' : '') + city } });
    if (address.district) tries.push({ precision: 'bairro', params: { q: address.district + ', ' + city } });

    return tries.reduce(function (chain, attempt) {
      return chain.then(function (found) {
        if (found) return found;
        return nominatim(attempt.params).then(function (point) {
          return point ? { lat: point.lat, lon: point.lon, precision: attempt.precision } : null;
        }).catch(function () { return null; });
      });
    }, Promise.resolve(null));
  }

  function routeKm(from, to) {
    var url = 'https://router.project-osrm.org/route/v1/driving/' +
      from.lon + ',' + from.lat + ';' + to.lon + ',' + to.lat + '?overview=false';
    return getJSON(url).then(function (data) {
      if (!data || data.code !== 'Ok' || !data.routes || !data.routes[0]) throw new Error('rota');
      return Math.round(data.routes[0].distance / 100) / 10;
    });
  }

  /*
   * Cotação de entrega para um CEP + número.
   * Resolve com { kind, fee, km, precision, address, message }:
   *   kind 'distance' (Goiânia, pela tabela) | 'fixed' (cidade com valor fixo) |
   *        'negotiable' (a combinar) | 'outside' (fora da área)
   * Rejeita com Error(mensagem amigável) se não der para calcular.
   */
  function quote(input, config) {
    var s = settings(config);
    var number = String(input.number || '').trim();
    var key = String(input.cep || '').replace(/\D/g, '') + '|' + number.toLowerCase();
    if (cache[key]) return Promise.resolve(cache[key]);

    return lookupCep(input.cep).then(function (address) {
      address.number = number;
      var base = { address: address, km: null, precision: '', fee: null };
      var rule = cityRule(address.city, config);

      if (rule && norm(address.city) !== norm(s.homeCity)) {
        var result = rule.price == null
          ? Object.assign(base, { kind: 'negotiable', message: 'Entrega em ' + address.city + ': valor a combinar pelo WhatsApp.' })
          : Object.assign(base, { kind: 'fixed', fee: rule.price, message: 'Entrega em ' + address.city + ': valor fixo.' });
        cache[key] = result;
        return result;
      }

      if (norm(address.city) !== norm(s.homeCity)) {
        if (s.carrier && s.carrier.enabled) {
          return Object.assign(base, {
            kind: 'carrier',
            message: 'Cotamos o frete com a transportadora e somamos ' + (s.carrier.feePercent || 0) + '% de taxa administrativa.'
          });
        }
        return Object.assign(base, { kind: 'outside', message: 'Ainda não entregamos em ' + address.city + '/' + address.uf + '. Fale com a gente no WhatsApp ou escolha a retirada.' });
      }

      return geocode(address, number).then(function (point) {
        if (!point) throw new Error('Não encontramos esse endereço no mapa. Calculamos o frete pelo WhatsApp.');
        return routeKm(s.origin, point).then(function (km) {
          var res = Object.assign(base, {
            kind: 'distance',
            km: km,
            precision: point.precision,
            fee: feeForKm(km, config),
            message: point.precision === 'endereço' ? '' : 'Distância aproximada pela ' + point.precision + ' (confirmamos no WhatsApp).'
          });
          cache[key] = res;
          return res;
        });
      });
    });
  }

  /* Transportadora: frete cotado + taxa administrativa (arredondada ao centavo). */
  function carrierTotal(freightCents, config) {
    var s = settings(config);
    var pct = (s.carrier && Number(s.carrier.feePercent)) || 0;
    var freight = Math.max(0, Math.round(Number(freightCents) || 0));
    var fee = Math.round(freight * pct / 100);
    return { freight: freight, fee: fee, total: freight + fee, percent: pct };
  }

  var api = {
    DEFAULTS: DEFAULTS,
    carrierTotal: carrierTotal,
    settings: settings,
    feeForKm: feeForKm,
    cityRule: cityRule,
    quote: quote,
    lookupCep: lookupCep
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AkyllaFrete = api;
})(this);
