/*
 * Estúdio de artes do painel: gera posts no estilo "Laranja forte" da Akylla
 * nos formatos das redes (1:1, 4:5, 9:16, 16:9) direto no navegador (Canvas),
 * sem serviço externo. Preço e promoção vêm do catálogo; legenda pronta por rede.
 * Também gera o kit de abertura (foto de perfil, capa do Facebook, capas de destaque, bios).
 */
(function () {
  'use strict';

  var api = null;           // { products(), config(), toast(msg), brl(cents) } — vem do admin.js
  var $ = function (s) { return document.querySelector(s); };
  var INK = '#060913';
  var ORANGE = '#ff8a00';
  var DEEP = '#ff5e00';
  var WHATS = '(62) 8151-7002';
  var SITE = 'akyllashop.com';

  /*
   * Estilos (mesma identidade, visuais diferentes). T = estilo da arte que está sendo desenhada.
   * bg: fundo · text: textos · pillBg/pillText: etiquetas · cardBg: cartão da foto · chipBg/chipText: características
   * ctaBg/ctaText: botão de chamada · badgeBg/badgeText: selo de desconto · foot: rodapé
   */
  var STYLES = {
    laranja: { label: 'Laranja forte', text: INK, pillBg: INK, pillText: ORANGE, cardBg: '#ffffff', chipBg: 'rgba(6,9,19,0.86)', chipText: '#ffffff', ctaBg: INK, ctaText: ORANGE, badgeBg: INK, badgeText: ORANGE, foot: 'rgba(6,9,19,0.72)', bg: 'laranja' },
    neon: { label: 'Neon escuro', text: '#ffffff', pillBg: ORANGE, pillText: INK, cardBg: '#ffffff', chipBg: 'rgba(255,255,255,0.12)', chipText: '#ffffff', ctaBg: ORANGE, ctaText: INK, badgeBg: ORANGE, badgeText: INK, foot: 'rgba(255,255,255,0.6)', bg: 'neon', glow: true },
    clean: { label: 'Clean claro', text: INK, pillBg: ORANGE, pillText: INK, cardBg: '#ffffff', chipBg: '#ffffff', chipText: INK, ctaBg: INK, ctaText: '#ffffff', badgeBg: ORANGE, badgeText: INK, foot: 'rgba(6,9,19,0.55)', bg: 'clean' },
    foto: { label: 'Foto em destaque', text: '#ffffff', pillBg: ORANGE, pillText: INK, cardBg: '#ffffff', chipBg: 'rgba(255,255,255,0.14)', chipText: '#ffffff', ctaBg: ORANGE, ctaText: INK, badgeBg: ORANGE, badgeText: INK, foot: 'rgba(255,255,255,0.6)', bg: 'foto' }
  };
  var T = STYLES.laranja;

  var FORMATS = {
    square: { w: 1080, h: 1080, label: '1:1', hint: 'Feed · carrossel · WhatsApp' },
    feed: { w: 1080, h: 1350, label: '4:5', hint: 'Feed do Instagram' },
    story: { w: 1080, h: 1920, label: '9:16', hint: 'Stories · Reels · TikTok · Status' },
    wide: { w: 1920, h: 1080, label: '16:9', hint: 'Facebook · YouTube · capa de vídeo' }
  };

  var CAMPAIGNS = {
    promo: { label: 'Produto em promoção', product: true, kicker: function (c) { return promoOn(c) ? (c.promo.text || 'Promoção').toUpperCase() : 'OFERTA ESPECIAL'; } },
    novo: { label: 'Novidade — chegou', product: true, kicker: function () { return 'CHEGOU NA AKYLLA'; } },
    top: { label: 'Mais vendido', product: true, kicker: function () { return '🔥 MAIS VENDIDO'; } },
    ultimas: { label: 'Últimas unidades', product: true, kicker: function () { return 'ÚLTIMAS UNIDADES'; } },
    inauguracao: { label: 'Inauguração da loja', product: false },
    cartao: { label: 'Cartão em até 12x', product: false },
    frete: { label: 'Frete promocional', product: false }
  };

  /* ------------------------------ utilidades ------------------------------ */

  function promoOn(c) {
    var p = c.promo || {};
    return !!p.active && (!p.until || p.until >= new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10));
  }
  function untilText(c) {
    var u = c.promo && c.promo.until;
    return u ? u.slice(8, 10) + '/' + u.slice(5, 7) : '';
  }
  function money(cents) { return api.brl(cents); }
  function cardInfo(c, price) {
    var k = c.card || {};
    if (!k.enabled) return null;
    var fee = Math.min(20, Math.max(0, Number(k.feePercent) || 0));
    return { total: Math.ceil(price / (1 - fee / 100)), max: Math.min(12, Math.max(1, Number(k.maxInstallments) || 12)) };
  }
  function imgUrl(path) { return path ? '../' + path : ''; }

  var imgCache = {};
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (imgCache[src]) return imgCache[src];
    imgCache[src] = new Promise(function (resolve) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
    return imgCache[src];
  }
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['800 60px Sora', '700 40px "DM Sans"', '400 30px "DM Sans"'].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function font(ctx, weight, size, family) { ctx.font = weight + ' ' + Math.round(size) + 'px ' + (family || 'Sora, "DM Sans", sans-serif'); }

  /* Quebra o texto em até `max` linhas, diminuindo a fonte até caber. */
  function fitLines(ctx, text, width, size, minSize, maxLines, weight, family) {
    for (var s = size; s >= minSize; s -= 2) {
      font(ctx, weight, s, family);
      var words = String(text).split(/\s+/), lines = [], cur = '';
      words.forEach(function (w) {
        var t = cur ? cur + ' ' + w : w;
        if (ctx.measureText(t).width <= width || !cur) cur = t; else { lines.push(cur); cur = w; }
      });
      if (cur) lines.push(cur);
      if (lines.length <= maxLines && lines.every(function (l) { return ctx.measureText(l).width <= width; })) return { lines: lines, size: s };
    }
    font(ctx, weight, minSize, family);
    return { lines: [String(text)], size: minSize };
  }
  function drawLines(ctx, fit, x, y, lh, align) {
    ctx.textAlign = align || 'left';
    fit.lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * fit.size * (lh || 1.08)); });
    return y + fit.lines.length * fit.size * (lh || 1.08);
  }
  function contain(ctx, im, x, y, w, h) {
    if (!im) return;
    var k = Math.min(w / im.width, h / im.height);
    var iw = im.width * k, ih = im.height * k;
    ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }

  /* ------------------------------ peças do estilo ------------------------------ */

  function background(ctx, W, H, seed) {
    if (T.bg === 'neon' || T.bg === 'foto') {
      ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
      var rg = ctx.createRadialGradient(W * 0.5, H * 0.45, 10, W * 0.5, H * 0.45, Math.max(W, H) * 0.7);
      rg.addColorStop(0, T.bg === 'foto' ? 'rgba(255,138,0,0.18)' : 'rgba(255,138,0,0.30)');
      rg.addColorStop(1, 'rgba(255,138,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      if (T.bg === 'neon') {
        ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = ORANGE; ctx.lineWidth = Math.min(W, H) * 0.006;
        for (var n = 0; n < 4; n += 1) { var off = n * Math.min(W, H) * 0.05; ctx.beginPath(); ctx.moveTo(W * 0.62 + off, H); ctx.lineTo(W + off * 0.2, H * 0.72); ctx.stroke(); }
        ctx.restore();
      }
      return;
    }
    if (T.bg === 'clean') {
      ctx.fillStyle = '#f6f4ef'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.fillStyle = ORANGE; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.arc(seed % 2 ? W * 0.02 : W * 0.98, H * 0.02, Math.min(W, H) * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(seed % 2 ? W : 0, H, Math.min(W, H) * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ffa424');
    g.addColorStop(0.55, ORANGE);
    g.addColorStop(1, DEEP);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#fff';
    var r = Math.max(W, H) * 0.42;
    ctx.beginPath(); ctx.arc(seed % 2 ? W * 0.05 : W * 0.95, H * 0.12, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.min(W, H) * 0.035;
    for (var i = 0; i < 6; i += 1) {
      var o = i * Math.min(W, H) * 0.09;
      ctx.beginPath(); ctx.moveTo(-W * 0.1 + o, H * 1.05); ctx.lineTo(W * 0.35 + o, H * 0.6); ctx.stroke();
    }
    ctx.restore();
  }

  function header(ctx, u, x, y, logo) {
    var box = 92 * u;
    ctx.fillStyle = T.text === '#ffffff' ? '#ffffff' : INK;
    rr(ctx, x, y, box, box, 22 * u); ctx.fill();
    if (logo) { ctx.save(); rr(ctx, x + 8 * u, y + 8 * u, box - 16 * u, box - 16 * u, 16 * u); ctx.clip(); contain(ctx, logo, x + 8 * u, y + 8 * u, box - 16 * u, box - 16 * u); ctx.restore(); }
    ctx.fillStyle = T.text;
    font(ctx, 800, 46 * u);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('AKYLLA SHOP', x + box + 22 * u, y + box / 2);
    ctx.textBaseline = 'alphabetic';
  }

  function pill(ctx, u, text, x, y, opts) {
    opts = opts || {};
    font(ctx, 800, (opts.size || 30) * u);
    var padX = 26 * u, h = (opts.size || 30) * u * 1.9;
    var w = ctx.measureText(text).width + padX * 2;
    if (opts.right) x = x - w;
    ctx.fillStyle = opts.bg || T.pillBg;
    rr(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = opts.color || T.pillText;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padX, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    return { w: w, h: h };
  }

  function productCard(ctx, u, im, x, y, w, h, discount) {
    if (!(w > 60 * u) || !(h > 60 * u)) return;
    ctx.save();
    ctx.shadowColor = T.glow ? 'rgba(255,138,0,0.55)' : 'rgba(6,9,19,0.25)'; ctx.shadowBlur = (T.glow ? 70 : 40) * u; ctx.shadowOffsetY = T.glow ? 0 : 16 * u;
    ctx.fillStyle = T.cardBg;
    rr(ctx, x, y, w, h, 40 * u); ctx.fill();
    ctx.restore();
    if (T.bg === 'clean') { ctx.strokeStyle = 'rgba(6,9,19,0.08)'; ctx.lineWidth = 2 * u; rr(ctx, x, y, w, h, 40 * u); ctx.stroke(); }
    var pad = Math.min(w, h) * 0.07;
    contain(ctx, im, x + pad, y + pad, w - pad * 2, h - pad * 2);
    if (discount) {
      var r = Math.min(110 * u, Math.min(w, h) * 0.2);
      var cx = x + w - r * 0.75, cy = y + r * 0.75;
      ctx.fillStyle = T.badgeBg;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = T.badgeText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      font(ctx, 800, r * 0.62); ctx.fillText('-' + discount + '%', cx, cy + 2 * u);
      ctx.textBaseline = 'alphabetic';
    }
  }

  function chips(ctx, u, list, x, y, maxW) {
    var cx = x, cy = y, h = 54 * u;
    list.forEach(function (t) {
      font(ctx, 700, 26 * u, '"DM Sans", sans-serif');
      var w = ctx.measureText(t).width + 40 * u;
      if (cx + w > x + maxW) { cx = x; cy += h + 12 * u; }
      ctx.fillStyle = T.chipBg;
      rr(ctx, cx, cy, w, h, h / 2); ctx.fill();
      if (T.bg === 'clean') { ctx.strokeStyle = 'rgba(6,9,19,0.12)'; ctx.lineWidth = 2 * u; rr(ctx, cx, cy, w, h, h / 2); ctx.stroke(); }
      ctx.fillStyle = T.chipText; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(t, cx + 20 * u, cy + h / 2 + 1);
      ctx.textBaseline = 'alphabetic';
      cx += w + 12 * u;
    });
    return cy + h;
  }

  /* Bloco de preço: "de X" riscado, preço grande, "no PIX" e cartão. Retorna a altura usada. */
  /* Altura do bloco de preço para um tamanho de fonte (usado para montar de baixo para cima). */
  function priceHeight(u, info, big) { return ((info.active ? 48 : 0) + big + 50) * u; }

  /* "de X" riscado, preço grande, "à vista no PIX · 12x". Diminui a fonte até caber em maxW. */
  function priceBlock(ctx, u, info, c, x, y, big, align, maxW) {
    align = align || 'left';
    maxW = maxW || 2000 * u;
    var top = y;
    ctx.fillStyle = T.text; ctx.textAlign = align;
    if (info.active) {
      font(ctx, 700, 34 * u, '"DM Sans", sans-serif');
      var de = 'de ' + money(info.original);
      ctx.fillText(de, x, y + 34 * u);
      var dw = ctx.measureText(de).width;
      var sx = align === 'center' ? x - dw / 2 + 40 * u : align === 'right' ? x - dw + 40 * u : x + 40 * u;
      ctx.fillRect(sx, y + 22 * u, dw - 40 * u, 4 * u);
      y += 48 * u;
    }
    var label = 'R$ ' + money(info.price).replace('R$', '').trim();
    var size = big;
    font(ctx, 800, size * u);
    while (ctx.measureText(label).width > maxW && size > 40) { size -= 4; font(ctx, 800, size * u); }
    ctx.fillText(label, x, y + size * u * 0.9);
    y += big * u;
    var card = cardInfo(c, info.price);
    var line = fitLines(ctx, 'à vista no PIX' + (card ? '  ·  ou ' + card.max + 'x no cartão' : ''), maxW, 30 * u, 18 * u, 1, 800);
    font(ctx, 800, line.size);
    ctx.fillText(line.lines[0], x, y + 36 * u);
    y += 50 * u;
    return y - top;
  }

  /* Etiquetas numa linha só: entram as que cabem (a primeira encolhe se precisar). */
  function chipsRow(ctx, u, list, x, y, maxW) {
    var cx = x, h = 54 * u, drawn = 0;
    list.forEach(function (t) {
      font(ctx, 700, 26 * u, '"DM Sans", sans-serif');
      var text = t;
      var w = ctx.measureText(text).width + 40 * u;
      if (drawn === 0) { while (w > maxW && text.length > 6) { text = text.slice(0, -2); w = ctx.measureText(text + '…').width + 40 * u; } if (text !== t) text += '…'; }
      if (cx + w > x + maxW) return;
      ctx.fillStyle = T.chipBg;
      rr(ctx, cx, y, w, h, h / 2); ctx.fill();
      if (T.bg === 'clean') { ctx.strokeStyle = 'rgba(6,9,19,0.12)'; ctx.lineWidth = 2 * u; rr(ctx, cx, y, w, h, h / 2); ctx.stroke(); }
      ctx.fillStyle = T.chipText; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, cx + 20 * u, y + h / 2 + 1);
      ctx.textBaseline = 'alphabetic';
      cx += w + 12 * u; drawn += 1;
    });
    return y + h;
  }

  function ctaBar(ctx, u, x, y, w, cta) {
    var h = 104 * u;
    ctx.fillStyle = T.ctaBg;
    rr(ctx, x, y, w, h, h / 2); ctx.fill();
    var text = cta === 'site' ? 'COMPRE EM ' + SITE.toUpperCase() : cta === 'bio' ? 'LINK NA BIO · PEÇA JÁ' : 'PEÇA PELO WHATSAPP ' + WHATS;
    var fit = fitLines(ctx, text, w - 80 * u, 38 * u, 22 * u, 1, 800);
    ctx.fillStyle = T.ctaText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    font(ctx, 800, fit.size); ctx.fillText(fit.lines[0], x + w / 2, y + h / 2 + 2 * u);
    ctx.textBaseline = 'alphabetic';
    return h;
  }

  function footnote(ctx, u, c, W, y, align) {
    var t = [promoOn(c) && untilText(c) ? 'Oferta válida até ' + untilText(c) : '', 'Imagens ilustrativas', 'Estoque limitado'].filter(Boolean).join(' · ');
    font(ctx, 600, 22 * u, '"DM Sans", sans-serif');
    ctx.fillStyle = T.foot; ctx.textAlign = align || 'center';
    ctx.fillText(t, align === 'left' ? 60 * u : W / 2, y);
  }

  function specsOf(p) {
    return (p.specs || []).slice(0, 4).map(function (s) { return s.value; }).filter(function (v) { return v.length <= 34; }).slice(0, 3);
  }

  /* ------------------------------ arte de produto ------------------------------ */

  function drawProduct(ctx, W, H, d) {
    var u = Math.min(W, H) / 1080;
    var c = d.config, p = d.product, info = d.info;
    background(ctx, W, H, d.seed);
    var M = 60 * u;
    header(ctx, u, M, M, d.logo);
    var discount = info.active ? info.percent : 0;
    var title = d.title || p.shortName;
    var kicker = d.kicker;
    var specs = specsOf(p);
    var top = M + 92 * u + 40 * u;
    var ctaY = H - M - 104 * u - 30 * u;
    var full = W - M * 2;

    /* 16:9 — foto à esquerda, texto à direita */
    if (W > H * 1.3) {
      var cw = W * 0.42;
      productCard(ctx, u, d.image, M, top, cw, H - top - M - 40 * u, discount);
      var tx = M + cw + 70 * u, tw = W - tx - M;
      var y = top + 10 * u;
      y += pill(ctx, u, kicker, tx, y).h + 20 * u;
      ctx.fillStyle = T.text;
      y = drawLines(ctx, fitLines(ctx, title, tw, 92 * u, 46 * u, 2, 800), tx, y + 80 * u) + 16 * u;
      y = chipsRow(ctx, u, specs, tx, y, tw) + 24 * u;
      var ctaW = Math.min(tw, 900 * u);
      var bottomCta = H - M - 104 * u - 40 * u;
      var big = Math.min(130, (bottomCta - y - 30 * u) / u - (info.active ? 48 : 0) - 50);
      priceBlock(ctx, u, info, c, tx, y, Math.max(60, big), 'left', tw);
      ctaBar(ctx, u, tx, bottomCta, ctaW, d.cta);
      footnote(ctx, u, c, W, H - 30 * u, 'center');
      return;
    }

    /* Foto em destaque: produto enorme, faixa escura embaixo com nome e preço */
    if (T.bg === 'foto') {
      var bigF = H > W * 1.4 ? 130 : 104;
      var priceTop = ctaY - 24 * u - priceHeight(u, info, bigF);
      var titleY = priceTop - 20 * u;
      var imgH = titleY - 90 * u - top;
      ctx.fillStyle = '#ffffff';
      rr(ctx, M, top, full, imgH, 48 * u); ctx.fill();
      contain(ctx, d.image, M + 40 * u, top + 40 * u, full - 80 * u, imgH - 80 * u);
      if (discount) pill(ctx, u, '-' + discount + '%', W - M - 30 * u, top + 30 * u, { right: true, size: 46 });
      pill(ctx, u, kicker, M + 30 * u, top + 30 * u, { bg: INK, color: ORANGE });
      ctx.fillStyle = '#ffffff';
      drawLines(ctx, fitLines(ctx, title, full, 70 * u, 38 * u, 1, 800), M, titleY);
      priceBlock(ctx, u, info, c, M, priceTop, bigF, 'left', full);
      ctaBar(ctx, u, M, ctaY, full, d.cta);
      footnote(ctx, u, c, W, H - 34 * u);
      return;
    }

    var layout = d.layout;

    /* 1:1 — título em cima; foto de um lado e preço do outro */
    if (H < W * 1.15) {
      pill(ctx, u, kicker, M, top);
      ctx.fillStyle = T.text;
      var ys = drawLines(ctx, fitLines(ctx, title, full, 66 * u, 38 * u, 1, 800), M, top + 96 * u + 58 * u) + 24 * u;
      var cwS = full * (layout === 'preco' ? 0.42 : 0.48);
      var chS = ctaY - ys - 30 * u;
      var cardX = layout === 'dividido' ? W - M - cwS : M;
      productCard(ctx, u, d.image, cardX, ys, cwS, chS, discount);
      var tx2 = layout === 'dividido' ? M : M + cwS + 36 * u;
      var tw2 = full - cwS - 36 * u;
      var bigS = layout === 'preco' ? 140 : 112;
      var pTop = ys + chS - priceHeight(u, info, bigS);
      var yr = ys + 6 * u;
      specs.slice(0, 3).forEach(function (sp) { if (yr + 54 * u < pTop - 16 * u) yr = chipsRow(ctx, u, [sp], tx2, yr, tw2) + 12 * u; });
      priceBlock(ctx, u, info, c, tx2, pTop, bigS, 'left', tw2);
      ctaBar(ctx, u, M, ctaY, full, d.cta);
      footnote(ctx, u, c, W, H - 34 * u);
      return;
    }

    /* 4:5 e 9:16 */
    var tall = H > W * 1.4;
    if (layout === 'preco') {
      pill(ctx, u, kicker, M, top);
      ctx.fillStyle = T.text;
      var y2 = drawLines(ctx, fitLines(ctx, title, full, 80 * u, 44 * u, 2, 800), M, top + 96 * u + 70 * u) + 10 * u;
      var bigP = tall ? 200 : 160;
      y2 += priceBlock(ctx, u, info, c, M, y2, bigP, 'left', full) + 10 * u;
      y2 = chipsRow(ctx, u, specs, M, y2, full) + 28 * u;
      productCard(ctx, u, d.image, M, y2, full, ctaY - y2 - 30 * u, discount);
    } else if (layout === 'dividido') {
      var bandH = (ctaY - top) * (tall ? 0.56 : 0.5);
      ctx.fillStyle = '#ffffff';
      rr(ctx, M, top, full, bandH, 40 * u); ctx.fill();
      contain(ctx, d.image, M + 40 * u, top + 90 * u, full - 80 * u, bandH - 120 * u);
      pill(ctx, u, kicker, M + 24 * u, top + 24 * u);
      if (discount) pill(ctx, u, '-' + discount + '%', W - M - 24 * u, top + 24 * u, { right: true, size: 40 });
      var bigD = tall ? 150 : 120;
      var pTopD = ctaY - 30 * u - priceHeight(u, info, bigD);
      ctx.fillStyle = T.text;
      var y3 = drawLines(ctx, fitLines(ctx, title, full, 72 * u, 40 * u, 2, 800), M, top + bandH + 30 * u + 62 * u) + 12 * u;
      if (y3 + 54 * u < pTopD - 10 * u) chipsRow(ctx, u, specs, M, y3, full);
      priceBlock(ctx, u, info, c, M, pTopD, bigD, 'left', full);
    } else {
      pill(ctx, u, kicker, M, top);
      ctx.fillStyle = T.text;
      var y4 = drawLines(ctx, fitLines(ctx, title, full, tall ? 84 * u : 74 * u, 40 * u, tall ? 2 : 1, 800), M, top + 96 * u + 70 * u) + 20 * u;
      var bigG = tall ? 160 : 118;
      var pTopG = ctaY - 30 * u - priceHeight(u, info, bigG);
      if (tall) {
        var chipsTop = pTopG - 20 * u - 54 * u;
        productCard(ctx, u, d.image, M, y4, full, chipsTop - 24 * u - y4, discount);
        chipsRow(ctx, u, specs, M, chipsTop, full);
        priceBlock(ctx, u, info, c, M, pTopG, bigG, 'left', full);
      } else {
        /* 4:5: etiquetas ao lado do preço, para a foto ganhar altura */
        productCard(ctx, u, d.image, M, y4, full, pTopG - 24 * u - y4, discount);
        var priceW = full * 0.56;
        priceBlock(ctx, u, info, c, M, pTopG, bigG, 'left', priceW);
        var cy = pTopG + (info.active ? 48 : 0) * u;
        specs.slice(0, 3).forEach(function (sp) { if (cy + 54 * u <= ctaY - 20 * u) cy = chipsRow(ctx, u, [sp], M + priceW + 24 * u, cy, full - priceW - 24 * u) + 10 * u; });
      }
    }
    ctaBar(ctx, u, M, ctaY, full, d.cta);
    footnote(ctx, u, c, W, H - 34 * u);
  }

  /* --------------------------- artes de campanha --------------------------- */

  function drawCampaign(ctx, W, H, d) {
    var u = Math.min(W, H) / 1080;
    var c = d.config;
    background(ctx, W, H, d.seed);
    var M = 60 * u;
    header(ctx, u, M, M, d.logo);
    var wide = W > H * 1.3;
    var promo = c.promo || {};
    var head, sub, lines = [];
    if (d.campaign === 'inauguracao') {
      head = d.title || 'INAUGURAÇÃO';
      sub = promoOn(c) ? (promo.percent + '% OFF em toda a loja') : 'Eletrônicos e acessórios em Goiânia';
      if (promoOn(c) && untilText(c)) lines.push('Até ' + untilText(c));
    } else if (d.campaign === 'cartao') {
      var k = cardInfo(c, 10000);
      head = d.title || 'AGORA NO CARTÃO';
      sub = 'em até ' + (k ? k.max : 12) + 'x no cartão de crédito';
      lines.push('Pagamento seguro pelo Mercado Pago');
    } else {
      var s = (c.shipping && c.shipping.bands && c.shipping.bands[0]) || {};
      var promoShip = s.promoPrice != null && c.shipping.promoUntil;
      head = d.title || 'FRETE ESPECIAL';
      sub = 'Entrega em Goiânia ' + (promoShip ? 'por ' + money(s.promoPrice) : 'a partir de ' + money(s.price || 0)) + ' (até ' + (s.upToKm || 15) + ' km)';
      if (promoShip) lines.push('Até ' + c.shipping.promoUntil.slice(8, 10) + '/' + c.shipping.promoUntil.slice(5, 7));
      lines.push('Retirada na loja grátis');
    }
    lines.push('PIX à vista' + (cardInfo(c, 1) ? ' ou cartão em até ' + cardInfo(c, 1).max + 'x' : ''));

    var tw = wide ? W * 0.5 - M : W - M * 2;
    var y = M + 92 * u + (wide ? 90 : 120) * u;
    ctx.fillStyle = T.text;
    var squareish = !wide && H < W * 1.3;
    var hs = wide ? 150 : squareish ? 120 : 170;
    y = drawLines(ctx, fitLines(ctx, head, tw, hs * u, 64 * u, 2, 800), M, y + hs * 0.82 * u, 0.98) + 10 * u;
    if (T.bg === 'neon' || T.bg === 'foto') ctx.fillStyle = ORANGE;
    y = drawLines(ctx, fitLines(ctx, sub, tw, (squareish ? 52 : 64) * u, 34 * u, 2, 800), M, y + 50 * u) + 20 * u;
    if (squareish) { var px = M; lines.forEach(function (l) { font(ctx, 800, 28 * u); var pw = ctx.measureText(l).width + 52 * u; if (px + pw > W - M) return; pill(ctx, u, l, px, y, { size: 28 }); px += pw + 12 * u; }); y += 64 * u; }
    else lines.forEach(function (l) { y += pill(ctx, u, l, M, y, { size: 32 }).h + 16 * u; });

    /* mosaico com até 4 produtos */
    var ims = d.collage.filter(Boolean).slice(0, 4);
    var gx, gy, gw, gh;
    if (wide) { gx = W * 0.52; gy = M + 120 * u; gw = W - gx - M; gh = H - gy - M - 40 * u; }
    else { gx = M; gy = y + (squareish ? 10 : 30) * u; gw = W - M * 2; gh = H - gy - M - 104 * u - (squareish ? 50 : 90) * u; }
    if (ims.length && gh > 110 * u) {
      /* escolhe a grade que deixa as fotos maiores (2x2 ou uma fileira) */
      var gap = 24 * u, n = ims.length;
      var opts = [[2, Math.ceil(n / 2)], [n, 1]].map(function (o) { var cs = (gw - gap * (o[0] - 1)) / o[0], rs = (gh - gap * (o[1] - 1)) / o[1]; return { cols: o[0], rows: o[1], size: Math.min(cs, rs * 1.15) }; });
      var best = opts[0].size >= opts[1].size ? opts[0] : opts[1];
      var cw = (gw - gap * (best.cols - 1)) / best.cols, chh = Math.min((gh - gap * (best.rows - 1)) / best.rows, cw * 1.1);
      var offY = (gh - (chh * best.rows + gap * (best.rows - 1))) / 2;
      ims.forEach(function (im, i) {
        var x = gx + (i % best.cols) * (cw + gap), yy = gy + offY + Math.floor(i / best.cols) * (chh + gap);
        productCard(ctx, u, im, x, yy, cw, chh, 0);
      });
    }
    if (wide) ctaBar(ctx, u, M, H - M - 104 * u - 30 * u, W * 0.5 - M * 1.5, d.cta);
    else ctaBar(ctx, u, M, H - M - 104 * u - 30 * u, W - M * 2, d.cta);
    footnote(ctx, u, c, W, H - 34 * u);
  }

  /* --------------------------------- kit --------------------------------- */

  function drawProfile(ctx, W, H, d) {
    var g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, '#ffa424'); g.addColorStop(1, DEEP);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* logo recortada em círculo (o Instagram mostra a foto de perfil redonda) */
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.4, 0, Math.PI * 2); ctx.clip();
    if (d.logo) { var k = Math.max(W * 0.8 / d.logo.width, H * 0.8 / d.logo.height); ctx.drawImage(d.logo, W / 2 - d.logo.width * k / 2, H / 2 - d.logo.height * k / 2, d.logo.width * k, d.logo.height * k); }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = W * 0.02;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.4, 0, Math.PI * 2); ctx.stroke();
  }

  function drawCover(ctx, W, H, d) {
    var u = H / 624;
    background(ctx, W, H, 1);
    /* o Facebook corta as laterais no celular: conteúdo no centro */
    var cx = W / 2;
    ctx.fillStyle = INK;
    rr(ctx, cx - 470 * u, 90 * u, 140 * u, 140 * u, 30 * u); ctx.fill();
    contain(ctx, d.logo, cx - 458 * u, 102 * u, 116 * u, 116 * u);
    ctx.textAlign = 'left';
    font(ctx, 800, 110 * u); ctx.fillText('AKYLLA SHOP', cx - 300 * u, 200 * u);
    font(ctx, 700, 46 * u, '"DM Sans", sans-serif');
    ctx.textAlign = 'center';
    ctx.fillText('Eletrônicos e acessórios em Goiânia', cx, 330 * u);
    var tags = ['PIX à vista', cardInfo(d.config, 1) ? 'Cartão em até ' + cardInfo(d.config, 1).max + 'x' : 'Garantia legal', 'Retirada grátis ou entrega', SITE];
    font(ctx, 800, 30 * u);
    var widths = tags.map(function (t) { return ctx.measureText(t).width + 52 * u; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + 16 * u * (tags.length - 1);
    var x = cx - total / 2;
    tags.forEach(function (t, i) { pill(ctx, u, t, x, 400 * u, { size: 30 }); x += widths[i] + 16 * u; });
  }

  var HIGHLIGHTS = [['🛍️', 'PRODUTOS'], ['💳', 'COMO COMPRAR'], ['🚚', 'ENTREGA'], ['⭐', 'AVALIAÇÕES']];
  function drawHighlight(ctx, W, H, d) {
    ctx.fillStyle = ORANGE; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    font(ctx, 400, W * 0.24, '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif');
    ctx.fillText(d.icon, W / 2, H / 2);
    ctx.textBaseline = 'alphabetic';
  }

  /* ------------------------------- legendas ------------------------------- */

  var TAGS = {
    smartwatches: '#smartwatch #relogiointeligente', audio: '#fonebluetooth #fonedeouvido', drones: '#drone #dronecomcamera',
    carregadores: '#carregador #carregadorturbo', cabos: '#cabousb #cabotipoc', acessorios: '#powerbank #acessoriosparacelular'
  };

  function captions(d) {
    var c = d.config, p = d.product;
    var base = '#akyllashop #goiania #goiás #tecnologia #eletronicos';
    var pay = 'PIX à vista' + (cardInfo(c, 1) ? ' ou cartão em até ' + cardInfo(c, 1).max + 'x' : '');
    var until = promoOn(c) && untilText(c) ? ' (até ' + untilText(c) + ')' : '';
    var text;
    if (p) {
      var info = d.info;
      var opener = { promo: '🔥 Oferta que não dá pra deixar passar!', novo: '✨ Chegou novidade na Akylla!', top: '🏆 O queridinho da galera voltou ao destaque!', ultimas: '⏳ Últimas unidades — corre!' }[d.campaign] || '🔥 Olha isso!';
      var specs = (p.specs || []).slice(0, 4).map(function (s) { return '✅ ' + s.label + ': ' + s.value; }).join('\n');
      var price = info.active ? 'De ' + money(info.original) + ' por *' + money(info.price) + '* no PIX' + until : money(info.price) + ' no PIX';
      text = {
        instagram: opener + '\n\n' + p.name + ' 👇\n\n' + specs + '\n\n💰 ' + price + '\n💳 ' + pay + '\n🚚 Retirada grátis ou entrega em Goiânia e região\n\n📲 Peça pelo WhatsApp ' + WHATS + ' ou pelo link na bio!\n\n' + base + ' ' + (TAGS[p.category] || ''),
        facebook: opener + '\n\n' + p.name + '\n' + (p.summary || '') + '\n\n💰 ' + price + '\n💳 ' + pay + '\n🚚 Retirada grátis ou entrega em Goiânia e região\n\n🛒 Compre em ' + SITE + ' ou chame no WhatsApp ' + WHATS,
        tiktok: opener + ' ' + p.shortName + ' por ' + money(info.price) + ' no PIX' + until + ' 😱 Link na bio! ' + base + ' ' + (TAGS[p.category] || '') + ' #achadinhos'
      };
    } else {
      var head = {
        inauguracao: '🎉 A Akylla Shop está ON! ' + (promoOn(c) ? (c.promo.percent + '% OFF em toda a loja' + until) : 'Chegamos em Goiânia'),
        cartao: '💳 Novidade: agora você parcela em até ' + ((cardInfo(c, 1) || {}).max || 12) + 'x no cartão!',
        frete: '🚚 Frete especial para Goiânia' + (c.shipping && c.shipping.promoUntil ? ' até ' + c.shipping.promoUntil.slice(8, 10) + '/' + c.shipping.promoUntil.slice(5, 7) : '') + '!'
      }[d.campaign];
      var body = 'Smartwatches, fones, drones, power banks, carregadores e cabos com preço justo e atendimento de verdade. 🧡\n\n💳 ' + pay + '\n🚚 Retirada grátis ou entrega em Goiânia e região\n✅ Garantia legal de 90 dias';
      text = {
        instagram: head + '\n\n' + body + '\n\n📲 Confira tudo no link da bio ou chame no WhatsApp ' + WHATS + '\n\n' + base + ' #lojaonline #achadinhos',
        facebook: head + '\n\n' + body + '\n\n🛒 ' + SITE + ' · WhatsApp ' + WHATS,
        tiktok: head + ' 🔥 Link na bio! ' + base + ' #achadinhos #lojaonline'
      };
    }
    return text;
  }

  var BIOS = {
    instagram: '⚡ Eletrônicos e acessórios em Goiânia\n💳 PIX à vista ou cartão em até 12x\n🚚 Retirada grátis ou entrega\n👇 Compre pelo site',
    facebook: 'Akylla Shop — smartwatches, fones, drones, power banks, carregadores e cabos em Goiânia/GO. PIX à vista ou cartão em até 12x, retirada grátis ou entrega. Compre em akyllashop.com ou pelo WhatsApp (62) 8151-7002.',
    tiktok: '⚡ Tech com preço justo em Goiânia 🧡 PIX ou 12x · akyllashop.com'
  };

  /* ------------------------------ interface ------------------------------ */

  var lastRender = [];

  function fillProducts() {
    var sel = $('#stProduct');
    var cur = sel.value;
    sel.innerHTML = '';
    api.products().forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.shortName + (p.hidden ? ' (fora da loja)' : '') + (typeof p.stock === 'number' && p.stock <= 0 ? ' · sem estoque' : '');
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }

  function selectedFormats() {
    return Array.prototype.filter.call(document.querySelectorAll('[data-stformat]'), function (b) { return b.classList.contains('is-active'); })
      .map(function (b) { return b.getAttribute('data-stformat'); });
  }

  function previewItem(name, canvas, filename) {
    var wrap = document.createElement('div');
    wrap.className = 'st-item';
    canvas.className = 'st-canvas';
    var bar = document.createElement('div');
    bar.className = 'st-actions';
    var label = document.createElement('strong');
    label.textContent = name;
    var dl = document.createElement('button');
    dl.type = 'button'; dl.className = 'btn btn-primary btn-sm'; dl.textContent = 'Baixar';
    dl.addEventListener('click', function () { download(canvas, filename); });
    bar.appendChild(label); bar.appendChild(dl);
    if (navigator.canShare) {
      var sh = document.createElement('button');
      sh.type = 'button'; sh.className = 'btn btn-ghost btn-sm'; sh.textContent = 'Compartilhar';
      sh.addEventListener('click', function () { share(canvas, filename); });
      bar.appendChild(sh);
    }
    wrap.appendChild(canvas); wrap.appendChild(bar);
    return wrap;
  }

  function toBlob(canvas) { return new Promise(function (r) { canvas.toBlob(r, 'image/png'); }); }
  function download(canvas, filename) {
    toBlob(canvas).then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    });
  }
  function share(canvas, filename) {
    toBlob(canvas).then(function (blob) {
      var file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: 'Akylla Shop' }).catch(function () {});
      download(canvas, filename);
    });
  }

  function slug(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }

  function generate() {
    var formats = selectedFormats();
    if (!formats.length) { api.toast('Escolha pelo menos um formato.'); return; }
    var campaign = $('#stCampaign').value;
    var meta = CAMPAIGNS[campaign];
    var config = api.config();
    var product = meta.product ? api.products().find(function (p) { return p.id === $('#stProduct').value; }) : null;
    if (meta.product && !product) { api.toast('Escolha o produto.'); return; }
    var layoutSel = document.querySelector('[data-stlayout].is-active').getAttribute('data-stlayout');
    var styleSel = document.querySelector('[data-ststyle].is-active').getAttribute('data-ststyle');
    var layouts = ['grande', 'preco', 'dividido'];
    var seed = Math.floor(Math.random() * 1000);
    var out = $('#stPreviews');
    out.innerHTML = '<p class="muted">Gerando…</p>';
    var collageSrc = api.products().filter(function (p) { return !p.hidden && p.image; })
      .sort(function (a, b) { return (b.bestseller ? 1 : 0) - (a.bestseller ? 1 : 0) || (b.stock || 0) - (a.stock || 0); })
      .slice(0, 4).map(function (p) { return imgUrl(p.image); });
    Promise.all([fontsReady(), loadImg('../assets/img/logo-mark.jpg'), product ? loadImg(imgUrl(product.image)) : null, Promise.all(collageSrc.map(loadImg))]).then(function (res) {
      var d = {
        config: config, product: product, campaign: campaign, cta: $('#stCta').value, title: $('#stTitle').value.trim(),
        logo: res[1], image: res[2], collage: res[3], seed: seed,
        info: product ? window.AkyllaPromo.priceFor(product, config) : null,
        kicker: meta.kicker ? meta.kicker(config) : ''
      };
      out.innerHTML = '';
      lastRender = [];
      formats.forEach(function (f, i) {
        var fm = FORMATS[f];
        var cv = document.createElement('canvas');
        cv.width = fm.w; cv.height = fm.h;
        var ctx = cv.getContext('2d');
        d.layout = layoutSel === 'surpresa' ? layouts[(seed + i) % layouts.length] : layoutSel;
        var styleKey = styleSel === 'surpresa' ? ['laranja', 'neon', 'clean', 'foto'][(seed + i * 3) % 4] : styleSel;
        T = STYLES[styleKey] || STYLES.laranja;
        try {
          if (product) drawProduct(ctx, fm.w, fm.h, d); else drawCampaign(ctx, fm.w, fm.h, d);
        } catch (err) {
          console.error('estúdio', f, err);
          api.toast('Não consegui desenhar o formato ' + fm.label + ': ' + err.message, 6000);
          return;
        }
        var name = fm.label + ' · ' + fm.hint + ' · ' + T.label;
        var file = 'akylla-' + slug(product ? product.shortName : meta.label) + '-' + fm.label.replace(':', 'x') + '.png';
        lastRender.push({ canvas: cv, file: file });
        out.appendChild(previewItem(name, cv, file));
      });
      var cap = captions(d);
      ['instagram', 'facebook', 'tiktok'].forEach(function (k) { $('#stCap-' + k).value = cap[k]; });
      $('#stCaptions').hidden = false;
      $('#stAll').hidden = lastRender.length < 2;
    });
  }

  function generateKit() {
    var config = api.config();
    var box = $('#stKit');
    box.innerHTML = '<p class="muted">Gerando…</p>';
    Promise.all([fontsReady(), loadImg('../assets/img/logo-mark.jpg')]).then(function (res) {
      T = STYLES.laranja;
      var d = { config: config, logo: res[1] };
      box.innerHTML = '';
      var items = [
        ['Foto de perfil (Instagram, Facebook, TikTok)', 1080, 1080, drawProfile, 'akylla-perfil.png', d],
        ['Capa do Facebook', 1640, 624, drawCover, 'akylla-capa-facebook.png', d]
      ];
      HIGHLIGHTS.forEach(function (h, i) {
        items.push(['Capa de destaque: ' + h[1].toLowerCase(), 1080, 1920, drawHighlight, 'akylla-destaque-' + (i + 1) + '-' + slug(h[1]) + '.png', { icon: h[0], text: h[1] }]);
      });
      items.forEach(function (it) {
        var cv = document.createElement('canvas');
        cv.width = it[1]; cv.height = it[2];
        it[3](cv.getContext('2d'), it[1], it[2], it[5]);
        box.appendChild(previewItem(it[0], cv, it[4]));
      });
      ['instagram', 'facebook', 'tiktok'].forEach(function (k) { $('#stBio-' + k).value = BIOS[k]; });
      $('#stBios').hidden = false;
    });
  }

  function copyFrom(id) {
    var t = $(id);
    t.select();
    (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(function () { api.toast('Texto copiado.'); }, function () { document.execCommand('copy'); api.toast('Texto copiado.'); });
  }

  function syncCampaign() {
    var meta = CAMPAIGNS[$('#stCampaign').value];
    $('#stProductWrap').hidden = !meta.product;
    $('#stLayoutWrap').hidden = !meta.product;
  }

  function seg(attr) {
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
      b.addEventListener('click', function () {
        if (attr === 'data-stformat') { b.classList.toggle('is-active'); return; }
        Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (x) { x.classList.toggle('is-active', x === b); });
      });
    });
  }

  /* ------------------------------ pré-definidos ------------------------------ */

  var BUILTIN = [
    { name: 'Promoção — Instagram completo', campaign: 'promo', style: 'laranja', layout: 'grande', formats: ['feed', 'story'], cta: 'bio' },
    { name: 'Oferta relâmpago — Status/Stories', campaign: 'promo', style: 'neon', layout: 'preco', formats: ['story'], cta: 'whatsapp' },
    { name: 'Novidade — Reels/TikTok', campaign: 'novo', style: 'foto', layout: 'grande', formats: ['story'], cta: 'bio' },
    { name: 'Mais vendido — Feed', campaign: 'top', style: 'clean', layout: 'dividido', formats: ['square', 'feed'], cta: 'whatsapp' },
    { name: 'Inauguração — todas as redes', campaign: 'inauguracao', style: 'laranja', layout: 'grande', formats: ['square', 'feed', 'story', 'wide'], cta: 'site' }
  ];

  function userPresets() { return (api.config().studioPresets || []).slice(); }

  function currentSettings() {
    return {
      campaign: $('#stCampaign').value,
      style: document.querySelector('[data-ststyle].is-active').getAttribute('data-ststyle'),
      layout: document.querySelector('[data-stlayout].is-active').getAttribute('data-stlayout'),
      formats: selectedFormats(),
      cta: $('#stCta').value,
      title: $('#stTitle').value.trim()
    };
  }

  function activate(attr, value) {
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) { b.classList.toggle('is-active', b.getAttribute(attr) === value); });
  }

  function applyPreset(p) {
    if (CAMPAIGNS[p.campaign]) $('#stCampaign').value = p.campaign;
    activate('data-ststyle', p.style || 'laranja');
    activate('data-stlayout', p.layout || 'grande');
    Array.prototype.forEach.call(document.querySelectorAll('[data-stformat]'), function (b) { b.classList.toggle('is-active', (p.formats || []).indexOf(b.getAttribute('data-stformat')) >= 0); });
    $('#stCta').value = p.cta || 'whatsapp';
    $('#stTitle').value = p.title || '';
    syncCampaign();
    api.toast('Pré-definido “' + p.name + '” aplicado. Escolha o produto e clique em Gerar artes.');
  }

  function renderPresets() {
    var box = $('#stPresets');
    box.innerHTML = '';
    BUILTIN.concat(userPresets().map(function (p, i) { p._user = i; return p; })).forEach(function (p) {
      var wrap = document.createElement('span');
      wrap.className = 'st-preset' + (p._user != null ? ' is-user' : '');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = p.name;
      b.title = [STYLES[p.style] ? STYLES[p.style].label : 'Surpresa', (p.formats || []).map(function (k) { return FORMATS[k] ? FORMATS[k].label : k; }).join(' + ')].join(' · ');
      b.addEventListener('click', function () { applyPreset(p); });
      wrap.appendChild(b);
      if (p._user != null) {
        var x = document.createElement('button');
        x.type = 'button'; x.className = 'st-preset-del'; x.textContent = '✕'; x.setAttribute('aria-label', 'Apagar ' + p.name);
        x.addEventListener('click', function () {
          if (!confirm('Apagar o pré-definido “' + p.name + '”?')) return;
          var list = userPresets(); list.splice(p._user, 1);
          api.setConfig('studioPresets', list);
          renderPresets();
          api.toast('Pré-definido apagado. Clique em Publicar para valer em todos os aparelhos.');
        });
        wrap.appendChild(x);
      }
      box.appendChild(wrap);
    });
  }

  function savePreset() {
    var cur = currentSettings();
    if (!cur.formats.length) { api.toast('Escolha pelo menos um formato antes de salvar.'); return; }
    var name = (prompt('Nome do pré-definido (ex.: “Promo sexta — Stories”):', CAMPAIGNS[cur.campaign].label) || '').trim();
    if (!name) return;
    cur.name = name.slice(0, 40);
    var list = userPresets().filter(function (p) { return p.name !== cur.name; });
    list.push(cur);
    api.setConfig('studioPresets', list.slice(-12));
    renderPresets();
    api.toast('Pré-definido salvo. Clique em Publicar para ele aparecer também nos outros aparelhos.', 6000);
  }

  var wired = false;
  function init(adminApi) {
    api = adminApi;
    if (!$('#stCampaign')) return;
    var sel = $('#stCampaign');
    if (!wired) {
      Object.keys(CAMPAIGNS).forEach(function (k) {
        var o = document.createElement('option'); o.value = k; o.textContent = CAMPAIGNS[k].label; sel.appendChild(o);
      });
      sel.addEventListener('change', syncCampaign);
      seg('data-stformat'); seg('data-stlayout'); seg('data-ststyle');
      $('#stGenerate').addEventListener('click', generate);
      $('#stKitBtn').addEventListener('click', generateKit);
      $('#stSavePreset').addEventListener('click', savePreset);
      $('#stAll').addEventListener('click', function () { lastRender.forEach(function (r, i) { setTimeout(function () { download(r.canvas, r.file); }, i * 400); }); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (b) {
        b.addEventListener('click', function () { copyFrom(b.getAttribute('data-copy')); });
      });
      wired = true;
    }
    fillProducts();
    syncCampaign();
    renderPresets();
  }

  window.AkyllaStudio = { init: init, refresh: function () { if (api) fillProducts(); } };
})();
