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
    anuncio: { label: 'Anúncio', text: '#ffffff', pillBg: ORANGE, pillText: INK, cardBg: '#ffffff', chipBg: 'rgba(255,255,255,0.12)', chipText: '#ffffff', ctaBg: ORANGE, ctaText: INK, badgeBg: ORANGE, badgeText: INK, foot: 'rgba(255,255,255,0.6)', bg: 'neon', glow: true },
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
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
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

  /* ------------------- estilo "Anúncio" (mesmo padrão dos anúncios 9:16 do gerador) ------------------- */

  var SOFT = '#b9c0cc';

  /* Textos do anúncio: os mesmos de ferramentas/anuncios/anuncios.js; produto sem anúncio → montado da ficha. */
  var ICON_GUESS = [
    [/bateria|mah|autonomia/i, 'battery'], [/tela|display/i, 'display'], [/bluetooth/i, 'bluetooth'], [/nfc/i, 'nfc'],
    [/c[aâ]mera/i, 'camera'], [/ip6|[aá]gua|prova/i, 'drop'], [/carga|pot[eê]ncia|\d+\s?w\b|turbo|r[aá]pid/i, 'bolt'],
    [/cabo|comprimento|conector|lightning|usb-c|tipo c/i, 'cable'], [/usb/i, 'usb'], [/compat|android|ios|iphone/i, 'smartphone'],
    [/som|[aá]udio|fone/i, 'headphones'], [/microfone/i, 'mic'], [/gps|local/i, 'pin'], [/sa[uú]de|card[ií]ac|batimento/i, 'heart'],
    [/material|caixa|alum/i, 'watch'], [/garantia|anatel|prote/i, 'shield'], [/medida|tamanho|dimens/i, 'ruler'], [/conex|wi-?fi|2\.4/i, 'wifi']
  ];
  function guessIcon(text) {
    for (var i = 0; i < ICON_GUESS.length; i += 1) if (ICON_GUESS[i][0].test(text)) return ICON_GUESS[i][1];
    return 'chip';
  }
  function adFor(p) {
    var a = (window.AKYLLA_ADS || []).find(function (x) { return x.id === p.id; });
    if (a) return a;
    var words = String(p.shortName || p.name).toUpperCase().split(/\s+/);
    var specs = (p.specs || []).slice(0, 6).map(function (s) { return [guessIcon(s.label + ' ' + s.value), String(s.value).slice(0, 26), s.label]; });
    return {
      hero: 0, title: [words[0], words.slice(1, 3).join(' ')], model: [p.brand, p.model || p.code].filter(Boolean).join(' '),
      sub: String(p.summary || '').slice(0, 60), hand: 'Garanta já o seu!', specs: specs,
      combo: { icon: 'box', big: 'PRONTA', t2: 'ENTREGA', p: 'Retire na loja ou<br>receba em casa.' },
      feats: specs.slice(0, 4).map(function (s) { return [s[0], s[2]]; }),
      checks: ['Ótimo custo-benefício', 'Pronta entrega']
    };
  }
  function brLines(t) { return String(t || '').split(/<br\s*\/?>/i); }

  /* Ícones SVG (traço) desenhados no canvas. */
  var iconCache = {};
  function iconPaths(name) {
    if (iconCache[name]) return iconCache[name];
    var src = (window.AKYLLA_AD_ICONS || {})[name] || (window.AKYLLA_AD_ICONS || {}).chip || '';
    var doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + src + '</svg>', 'image/svg+xml');
    var list = [];
    Array.prototype.forEach.call(doc.documentElement.children, function (el) {
      var n = function (k) { return parseFloat(el.getAttribute(k)) || 0; };
      var p = new Path2D();
      if (el.tagName === 'path') p = new Path2D(el.getAttribute('d'));
      else if (el.tagName === 'circle') p.arc(n('cx'), n('cy'), n('r'), 0, Math.PI * 2);
      else if (el.tagName === 'rect') {
        var x = n('x'), y = n('y'), w = n('width'), h = n('height'), r = Math.min(n('rx'), w / 2, h / 2);
        p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
      }
      list.push(p);
    });
    iconCache[name] = list;
    return list;
  }
  function drawIcon(ctx, name, x, y, size, color, width) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color; ctx.lineWidth = width || 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    iconPaths(name).forEach(function (p) { ctx.stroke(p); });
    ctx.restore();
  }

  /* Recorte do produto: tira o fundo branco a partir das bordas (como o recorte.py do gerador). */
  var cutCache = {};
  function cutout(im, mode) {
    if (!im) return null;
    var key = im.src + '|' + mode;
    if (cutCache[key]) return cutCache[key];
    var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    if (mode === 'card') { cutCache[key] = cv; return cv; }
    var data = x.getImageData(0, 0, w, h), px = data.data, n = w * h;
    var bg = new Uint8Array(n), stack = [], i;
    var light = function (j, lim) { var r = px[j * 4], g = px[j * 4 + 1], b = px[j * 4 + 2]; return r > lim && g > lim && b > lim && Math.max(r, g, b) - Math.min(r, g, b) < 18; };
    for (i = 0; i < w; i += 1) { stack.push(i, (h - 1) * w + i); }
    for (i = 0; i < h; i += 1) { stack.push(i * w, i * w + w - 1); }
    while (stack.length) {
      i = stack.pop();
      if (bg[i] || !light(i, 238)) continue;
      bg[i] = 1;
      var cx = i % w;
      if (cx > 0) stack.push(i - 1);
      if (cx < w - 1) stack.push(i + 1);
      if (i >= w) stack.push(i - w);
      if (i < n - w) stack.push(i + w);
    }
    if (mode === 'holes') for (i = 0; i < n; i += 1) if (light(i, 228)) bg[i] = 1;
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (i = 0; i < n; i += 1) {
      var px0 = i % w, py0 = (i - px0) / w;
      var edge = bg[i] || (px0 > 0 && bg[i - 1]) || (px0 < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < n - w && bg[i + w]);
      px[i * 4 + 3] = bg[i] ? 0 : edge ? 150 : 255;
      if (!bg[i]) { if (px0 < minX) minX = px0; if (px0 > maxX) maxX = px0; if (py0 < minY) minY = py0; if (py0 > maxY) maxY = py0; }
    }
    x.putImageData(data, 0, 0);
    if (maxX < 0) { cutCache[key] = cv; return cv; }
    var out = document.createElement('canvas');
    out.width = maxX - minX + 1; out.height = maxY - minY + 1;
    out.getContext('2d').drawImage(cv, -minX, -minY);
    cutCache[key] = out;
    return out;
  }

  function adBackground(ctx, W, H) {
    var g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, '#10131c'); g.addColorStop(0.55, '#07090f'); g.addColorStop(1, '#0b0d14');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var spot = function (x, y, r, color) {
      var rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color); rg.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    };
    spot(W * 0.34, H * 0.41, Math.max(W, H) * 0.38, 'rgba(255,138,0,0.22)');
    spot(W, H, Math.max(W, H) * 0.33, 'rgba(255,94,0,0.35)');
  }

  function spaced(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }

  function adBrand(ctx, x, y, s, logo) {
    font(ctx, 800, 46 * s);
    spaced(ctx, -1 * s);
    var tw = ctx.measureText('AKYLLA SHOP').width;
    var w = 16 * s + 62 * s + 16 * s + tw + 26 * s, h = 90 * s;
    ctx.fillStyle = ORANGE; rr(ctx, x, y, w, h, 6 * s); ctx.fill();
    if (logo) { ctx.save(); rr(ctx, x + 16 * s, y + 14 * s, 62 * s, 62 * s, 10 * s); ctx.clip(); ctx.drawImage(logo, x + 16 * s, y + 14 * s, 62 * s, 62 * s); ctx.restore(); }
    ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('AKYLLA SHOP', x + 94 * s, y + h / 2 + 2 * s);
    ctx.textBaseline = 'alphabetic'; spaced(ctx, 0);
    return y + h;
  }

  /* Título (2 cores, numa linha), modelo e subtítulo. Devolve o fim do bloco. */
  function adTitle(ctx, x, y, maxW, ad, s, opts) {
    opts = opts || {};
    var t0 = ad.title[0], t1 = ad.title[1] ? ' ' + ad.title[1] : '';
    var size = 104 * s;
    spaced(ctx, -3 * s);
    font(ctx, 800, size);
    while (ctx.measureText(t0 + t1).width > maxW && size > 30 * s) { size -= 2 * s; font(ctx, 800, size); }
    var base = y + size * 0.82;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff'; ctx.fillText(t0, x, base);
    var w0 = ctx.measureText(t0).width;
    ctx.fillStyle = ORANGE; ctx.fillText(t1, x + w0, base);
    spaced(ctx, -1 * s);
    var yy = base + size * 0.13;
    if (ad.model) {
      var m = fitLines(ctx, ad.model, maxW, 44 * s, 26 * s, 1, 700);
      ctx.fillStyle = '#ffffff'; font(ctx, 700, m.size);
      ctx.fillText(m.lines[0], x, yy + 6 * s + m.size * 0.95);
      yy += 6 * s + m.size * 1.15;
    }
    spaced(ctx, 0);
    if (ad.sub && !opts.noSub) {
      spaced(ctx, 2 * s);
      font(ctx, 700, 29 * s, '"DM Sans", sans-serif');
      ctx.fillStyle = SOFT;
      yy += 18 * s;
      brLines(ad.sub).slice(0, opts.subLines || 2).forEach(function (l) {
        var f = fitLines(ctx, l.toUpperCase(), maxW, 29 * s, 18 * s, 1, 700, '"DM Sans", sans-serif');
        font(ctx, 700, f.size, '"DM Sans", sans-serif');
        ctx.fillText(f.lines[0], x, yy + f.size * 0.9);
        yy += 29 * s * 1.3;
      });
      spaced(ctx, 0);
    }
    return yy;
  }

  /* Frase "à mão" inclinada com traço laranja embaixo. */
  function adHand(ctx, text, x, y, w, size, deg) {
    var f = fitLines(ctx, text, w, size, size * 0.6, 3, 'italic 700', '"DM Sans", sans-serif');
    ctx.save();
    var lh = f.size * 1.05, h = f.lines.length * lh;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(deg * Math.PI / 180);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    font(ctx, 'italic 700', f.size, '"DM Sans", sans-serif');
    f.lines.forEach(function (l, i) { ctx.fillText(l, 0, -h / 2 + lh * (i + 0.82)); });
    ctx.fillStyle = ORANGE;
    ctx.beginPath(); ctx.ellipse(0, h / 2 + f.size * 0.25, w * 0.4, f.size * 0.07, -0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* Produto recortado com brilho (ou no cartão branco, para produtos claros). */
  function adHero(ctx, im, mode, x, y, w, h, s) {
    if (!im) return;
    var sh = ctx.createRadialGradient(x + w / 2, y + h - 30 * s, 0, x + w / 2, y + h - 30 * s, w * 0.42);
    sh.addColorStop(0, 'rgba(0,0,0,0.85)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(0, y + h - 30 * s); ctx.scale(1, 0.12); ctx.translate(0, -(y + h - 30 * s));
    ctx.fillStyle = sh; ctx.fillRect(x, y + h - 30 * s - w * 0.42, w, w * 0.84); ctx.restore();
    var k = Math.min(w / im.width, h / im.height);
    if (mode === 'card') k = Math.min(k, (Math.min(w, h) * 0.95) / Math.max(im.width, im.height));
    var iw = im.width * k, ih = im.height * k, ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (mode === 'card') {
      var pad = 14 * s;
      ctx.shadowColor = 'rgba(255,120,0,0.45)'; ctx.shadowBlur = 50 * s;
      ctx.fillStyle = '#ffffff'; rr(ctx, ix - pad, iy - pad, iw + pad * 2, ih + pad * 2, 28 * s); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,138,0,0.85)'; ctx.lineWidth = 4 * s; rr(ctx, ix - pad - 2 * s, iy - pad - 2 * s, iw + pad * 2 + 4 * s, ih + pad * 2 + 4 * s, 30 * s); ctx.stroke();
      ctx.drawImage(im, ix, iy, iw, ih);
    } else {
      ctx.shadowColor = 'rgba(255,170,80,0.35)'; ctx.shadowBlur = 30 * s;
      if ('filter' in ctx) ctx.filter = 'brightness(1.18) contrast(1.05)';
      ctx.drawImage(im, ix, iy, iw, ih);
    }
    ctx.restore();
  }

  function iconBadge(ctx, name, cx, cy, d, s) {
    ctx.save();
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, d / 2);
    g.addColorStop(0, '#1b1f2a'); g.addColorStop(1, '#0b0d13');
    ctx.shadowColor = 'rgba(255,94,0,0.35)'; ctx.shadowBlur = 22 * s;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = DEEP; ctx.lineWidth = d * 0.042; ctx.beginPath(); ctx.arc(cx, cy, d / 2 - d * 0.021, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    drawIcon(ctx, name, cx - d * 0.26, cy - d * 0.26, d * 0.52, '#ffffff', 2.2);
  }

  /* Ficha técnica: círculo com ícone + título + detalhe. */
  function adSpecs(ctx, list, x, y, w, s, maxY) {
    var d = 96 * s, tx = x + d + 20 * s, tw = w - d - 20 * s;
    list.forEach(function (sp, i) {
      var b = fitLines(ctx, sp[1], tw, 31 * s, 20 * s, 2, 700, '"DM Sans", sans-serif');
      var sm = fitLines(ctx, sp[2] || '', tw, 23 * s, 17 * s, 2, 400, '"DM Sans", sans-serif');
      var th = b.lines.length * b.size * 1.15 + (sp[2] ? sm.lines.length * sm.size * 1.2 + 4 * s : 0);
      var rowH = Math.max(d, th) + 36 * s;
      if (maxY && y + rowH > maxY) return;
      var cy = y + rowH / 2;
      iconBadge(ctx, sp[0], x + d / 2, cy, d, s);
      var ty = cy - th / 2;
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
      font(ctx, 700, b.size, '"DM Sans", sans-serif');
      b.lines.forEach(function (l) { ctx.fillText(l, tx, ty + b.size * 0.9); ty += b.size * 1.15; });
      if (sp[2]) {
        ty += 4 * s;
        ctx.fillStyle = SOFT; font(ctx, 400, sm.size, '"DM Sans", sans-serif');
        sm.lines.forEach(function (l) { ctx.fillText(l, tx, ty + sm.size * 0.9); ty += sm.size * 1.2; });
      }
      y += rowH;
      if (i < list.length - 1) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y - 1, w, 1.5 * s); }
    });
    return y;
  }

  /* Destaque secundário: segunda foto (ex.: controle) ou ícone num anel + textos. */
  function adCombo(ctx, ad, im, mode, x, y, w, s) {
    var vw = 270 * s, vh = 250 * s;
    if (im) adHero(ctx, im, mode, x, y, vw, vh, s * 0.8);
    else {
      var d = 230 * s, cx = x + 20 * s + d / 2, cy = y + vh / 2;
      ctx.save();
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, d / 2);
      g.addColorStop(0, '#1b1f2a'); g.addColorStop(1, '#0b0d13');
      ctx.shadowColor = 'rgba(255,94,0,0.4)'; ctx.shadowBlur = 40 * s;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = DEEP; ctx.lineWidth = 6 * s; ctx.stroke();
      ctx.restore();
      drawIcon(ctx, ad.combo.icon || 'box', cx - 60 * s, cy - 60 * s, 120 * s, '#ffffff', 1.8);
      vw = d + 40 * s;
    }
    var tx = x + vw + 26 * s, tw = w - vw - 26 * s;
    var big = fitLines(ctx, ad.combo.big, tw, 58 * s, 30 * s, 1, 800);
    var t2 = fitLines(ctx, ad.combo.t2, tw, 34 * s, 22 * s, 2, 800);
    var pl = brLines(ad.combo.p);
    var th = big.size + 4 * s + t2.lines.length * t2.size * 1.05 + 12 * s + pl.length * 26 * s * 1.3;
    var ty = y + vh / 2 - th / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = ORANGE; font(ctx, 800, big.size); ctx.fillText(big.lines[0], tx, ty + big.size * 0.85); ty += big.size + 4 * s;
    ctx.fillStyle = '#ffffff'; font(ctx, 800, t2.size);
    t2.lines.forEach(function (l) { ctx.fillText(l, tx, ty + t2.size * 0.85); ty += t2.size * 1.05; });
    ty += 12 * s;
    ctx.fillStyle = '#e3e6ec';
    pl.forEach(function (l) { var f = fitLines(ctx, l, tw, 26 * s, 18 * s, 1, 400, '"DM Sans", sans-serif'); font(ctx, 400, f.size, '"DM Sans", sans-serif'); ctx.fillText(f.lines[0], tx, ty + f.size * 0.9); ty += 26 * s * 1.3; });
    return y + vh;
  }

  /* Faixa de 4 destaques com ícones. */
  function adFeats(ctx, list, x, y, w, s) {
    var h = 178 * s, cw = w / list.length;
    ctx.fillStyle = 'rgba(255,94,0,0.6)';
    ctx.fillRect(x, y, w, 2 * s); ctx.fillRect(x, y + h, w, 2 * s);
    list.forEach(function (f, i) {
      var cx = x + cw * i + cw / 2;
      if (i > 0) ctx.fillRect(x + cw * i, y + 24 * s, 2 * s, h - 48 * s);
      drawIcon(ctx, f[0], cx - 32 * s, y + 24 * s, 64 * s, DEEP, 2.4);
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
      brLines(f[1]).slice(0, 2).forEach(function (l, j) {
        var t = fitLines(ctx, l, cw - 20 * s, 24 * s, 16 * s, 1, 700, '"DM Sans", sans-serif');
        font(ctx, 700, t.size, '"DM Sans", sans-serif');
        ctx.fillText(t.lines[0], cx, y + 24 * s + 64 * s + 8 * s + 24 * s + j * 29 * s);
      });
      ctx.restore();
      ctx.fillStyle = 'rgba(255,94,0,0.6)';
    });
    return y + h;
  }

  /* Faixa laranja inclinada com o preço. */
  function adPrice(ctx, info, label, x, y, w, h, s) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-3 * Math.PI / 180); ctx.translate(-w / 2, -h / 2);
    var pts = [[0.03, 0.08], [0.4, 0], [0.99, 0.06], [0.96, 0.5], [1, 0.92], [0.55, 1], [0, 0.95], [0.04, 0.5]];
    ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0] * w, p[1] * h); else ctx.moveTo(p[0] * w, p[1] * h); });
    ctx.closePath();
    var g = ctx.createLinearGradient(0, 0, w, h * 0.3);
    g.addColorStop(0, DEEP); g.addColorStop(1, ORANGE);
    ctx.fillStyle = g; ctx.fill();
    var px = 58 * s * (w / (560 * s)), py = 22 * s;
    var inner = w - px - 30 * s;
    ctx.textAlign = 'left';
    spaced(ctx, 1 * s);
    var lab = fitLines(ctx, label.toUpperCase(), inner, 32 * s, 20 * s, 1, 800);
    ctx.fillStyle = '#111'; font(ctx, 800, lab.size); ctx.fillText(lab.lines[0], px, py + 32 * s * 0.9);
    spaced(ctx, 0);
    var yy = py + 32 * s + 4 * s;
    ctx.fillStyle = '#ffffff'; font(ctx, 700, 28 * s, '"DM Sans", sans-serif');
    if (info.active) {
      var pre = 'de ', val = money(info.original), pos = ' por';
      ctx.fillText(pre, px, yy + 28 * s * 0.9);
      var a = ctx.measureText(pre).width, b = ctx.measureText(val).width;
      ctx.fillText(val, px + a, yy + 28 * s * 0.9);
      ctx.fillRect(px + a, yy + 28 * s * 0.55, b, 3 * s);
      ctx.fillText(pos, px + a + b, yy + 28 * s * 0.9);
    } else ctx.fillText('à vista', px, yy + 28 * s * 0.9);
    yy += 28 * s * 1.25 + 4 * s;
    var cents = Math.round(info.price), int = Math.floor(cents / 100).toLocaleString('pt-BR'), dec = ',' + String(cents % 100).padStart(2, '0');
    var big = 108 * s;
    font(ctx, 800, big); spaced(ctx, -4 * s);
    var maxInt = inner - 150 * s;
    while (ctx.measureText(int).width > maxInt && big > 50 * s) { big -= 4 * s; font(ctx, 800, big); }
    var base = yy + big * 0.85;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowOffsetY = 4 * s;
    spaced(ctx, 0); font(ctx, 800, 46 * s); ctx.fillText('R$', px, base);
    var cx = px + ctx.measureText('R$').width + 12 * s;
    spaced(ctx, -4 * s); font(ctx, 800, big); ctx.fillText(int, cx, base);
    cx += ctx.measureText(int).width + 4 * s;
    spaced(ctx, 0); font(ctx, 800, 52 * s); ctx.fillText(dec, cx, base);
    ctx.restore();
    spaced(ctx, 0);
    font(ctx, 700, 22 * s, '"DM Sans", sans-serif');
    var tw = ctx.measureText('no PIX').width + 28 * s;
    ctx.fillStyle = '#111'; rr(ctx, w - 60 * s - tw, 82 * s, tw, 40 * s, 6 * s); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillText('no PIX', w - 60 * s - tw + 14 * s, 82 * s + 28 * s);
    ctx.restore();
  }

  function adChecks(ctx, list, x, y, w, s, maxY) {
    var top = y;
    ctx.textAlign = 'left';
    list.forEach(function (c) {
      var f = fitLines(ctx, c, w - 30 * s - 48 * s, 26 * s, 20 * s, 2, 400, '"DM Sans", sans-serif');
      var h = f.lines.length * f.size * 1.2;
      if (maxY && y + h > maxY) return;
      ctx.fillStyle = DEEP; font(ctx, 700, 34 * s, '"DM Sans", sans-serif');
      ctx.fillText('✔', x + 30 * s, y + 30 * s);
      ctx.fillStyle = '#ffffff'; font(ctx, 400, f.size, '"DM Sans", sans-serif');
      f.lines.forEach(function (l, i) { ctx.fillText(l, x + 30 * s + 48 * s, y + f.size * 0.95 + i * f.size * 1.2); });
      y += h + 20 * s;
    });
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, top, 2 * s, Math.max(0, y - top - 20 * s));
    return y;
  }

  function adCta(ctx, cta, x, y, w, h, s) {
    ctx.save();
    var g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, DEEP); g.addColorStop(1, ORANGE);
    ctx.shadowColor = 'rgba(255,94,0,0.35)'; ctx.shadowBlur = 30 * s; ctx.shadowOffsetY = 10 * s;
    ctx.fillStyle = g; rr(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.restore();
    var ic = 70 * s * (h / (120 * s));
    var pad = 36 * s * (h / (120 * s));
    ctx.save(); ctx.translate(x + pad, y + (h - ic) / 2); ctx.scale(ic / 24, ic / 24);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ['M6 6h15l-1.5 8H7.5z', 'M6 6L5 3H2'].forEach(function (d) { ctx.stroke(new Path2D(d)); });
    ctx.beginPath(); ctx.arc(9, 19, 1.6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(18, 19, 1.6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    var tx = x + pad + ic + 22 * s, tw = w - (tx - x) - pad;
    var sub = cta === 'site' ? SITE : cta === 'bio' ? 'Link na bio · ' + SITE : SITE + ' · ' + WHATS;
    var b = fitLines(ctx, 'COMPRE AGORA', tw, 44 * s * (h / (120 * s)), 20 * s, 1, 800);
    var t = fitLines(ctx, sub, tw, 25 * s * (h / (120 * s)), 14 * s, 1, 700, '"DM Sans", sans-serif');
    var th = b.size + t.size * 1.2, ty = y + (h - th) / 2;
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
    spaced(ctx, -1 * s); font(ctx, 800, b.size); ctx.fillText(b.lines[0], tx, ty + b.size * 0.85); spaced(ctx, 0);
    font(ctx, 700, t.size, '"DM Sans", sans-serif'); ctx.fillText(t.lines[0], tx, ty + b.size + t.size * 0.95);
  }

  function adFoot(ctx, W, y, s) {
    font(ctx, 400, 15 * s * 1.2, '"DM Sans", sans-serif');
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.textAlign = 'center';
    ctx.fillText('Imagens ilustrativas. Estoque limitado.', W / 2, y);
  }

  function adLabel(d) {
    var c = d.config;
    if (d.campaign === 'novo') return 'Novidade na loja';
    if (d.campaign === 'top') return 'Mais vendido';
    if (d.campaign === 'ultimas') return 'Últimas unidades';
    return d.info.active ? (promoOn(c) && c.promo.text ? c.promo.text : 'Oferta especial') : 'Preço especial';
  }

  function drawAd(ctx, W, H, d) {
    var p = d.product, ad = adFor(p);
    if (d.title) ad = Object.assign({}, ad, { title: [d.title, ''] });
    var mode = ad.card ? 'card' : ad.holes ? 'holes' : 'cut';
    var hero = cutout(d.adHero || d.image, mode);
    var combo = d.adCombo ? cutout(d.adCombo, mode) : null;
    var label = adLabel(d);
    var until = d.info.active && promoOn(d.config) && untilText(d.config) ? 'Oferta válida até ' + untilText(d.config) + '!' : 'Não perca essa oportunidade!';
    var checks = (ad.checks || []).concat(['Retirada na loja ou entrega em Goiânia e região']);
    adBackground(ctx, W, H);

    if (W === 1080 && H === 1920) {
      adBrand(ctx, 60, 56, 1, d.logo);
      adTitle(ctx, 60, 168, 620, ad, 1);
      adHand(ctx, ad.hand, 694, 70, 340, 54, -8);
      if (ad.tall) adHero(ctx, hero, mode, 0, 440, 720, 520, 1); else adHero(ctx, hero, mode, 0, 470, 720, 470, 1);
      adSpecs(ctx, ad.specs, 680, 400, 360, 1, 1270);
      adCombo(ctx, ad, combo, mode, 40, 990, 640, 1);
      adFeats(ctx, ad.feats, 60, 1290, 960, 1);
      adPrice(ctx, d.info, label, 30, 1480, 560, 250, 1);
      adChecks(ctx, checks, 640, 1490, 400, 1, 1740);
      adCta(ctx, d.cta, 40, 1770, 640, 120, 1);
      adHand(ctx, until, 700, 1752, 340, 44, -7);
      adFoot(ctx, W, 1912, 1);
      return;
    }
    if (W === 1080 && H === 1350) {
      adBrand(ctx, 56, 48, 0.9, d.logo);
      var yf = adTitle(ctx, 56, 152, 600, ad, 0.9);
      adHand(ctx, ad.hand, 700, 64, 330, 48, -8);
      var top = Math.max(yf + 20, 400);
      adHero(ctx, hero, mode, 0, top, 650, 860 - top, 0.9);
      adSpecs(ctx, ad.specs.slice(0, 4), 670, 360, 370, 0.85, 860);
      adPrice(ctx, d.info, label, 30, 885, 540, 230, 0.9);
      adChecks(ctx, checks, 610, 900, 430, 0.9, 1130);
      adCta(ctx, d.cta, 40, 1160, 620, 110, 0.9);
      adHand(ctx, until, 690, 1160, 340, 40, -7);
      adFoot(ctx, W, 1340, 0.9);
      return;
    }
    if (W === H) {
      adBrand(ctx, 50, 40, 0.8, d.logo);
      var ys = adTitle(ctx, 50, 132, 600, ad, 0.8, { noSub: true });
      adHand(ctx, ad.hand, 700, 46, 330, 42, -8);
      var topS = Math.max(ys + 16, 280);
      adHero(ctx, hero, mode, 0, topS, 610, 740 - topS, 0.8);
      var endS = adSpecs(ctx, ad.specs.slice(0, 3), 630, 270, 410, 0.8, 640);
      adChecks(ctx, checks.slice(0, 2), 630, endS + 20, 410, 0.8, 790);
      adPrice(ctx, d.info, label, 24, 770, 530, 215, 0.8);
      adCta(ctx, d.cta, 590, 840, 450, 104, 0.8);
      adFoot(ctx, W, 1066, 0.8);
      return;
    }
    /* 16:9 */
    adBrand(ctx, 70, 56, 0.9, d.logo);
    adTitle(ctx, 70, 160, 820, ad, 0.95, { subLines: 1 });
    adHand(ctx, ad.hand, 1520, 56, 340, 48, -6);
    adHero(ctx, hero, mode, 0, 380, 920, 620, 1);
    var half = Math.ceil(Math.min(6, ad.specs.length) / 2);
    adSpecs(ctx, ad.specs.slice(0, half), 950, 250, 440, 0.82, 690);
    adSpecs(ctx, ad.specs.slice(half, 6), 1430, 250, 440, 0.82, 690);
    adPrice(ctx, d.info, label, 940, 720, 520, 220, 0.85);
    adCta(ctx, d.cta, 1490, 760, 390, 108, 0.8);
    adChecks(ctx, checks.slice(0, 2), 1490, 900, 400, 0.75, 1040);
    adFoot(ctx, W, 1068, 0.9);
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
    var ad = product ? adFor(product) : null;
    var photos = product ? [product.image].concat(product.gallery || []) : [];
    var collageSrc = api.products().filter(function (p) { return !p.hidden && p.image; })
      .sort(function (a, b) { return (b.bestseller ? 1 : 0) - (a.bestseller ? 1 : 0) || (b.stock || 0) - (a.stock || 0); })
      .slice(0, 4).map(function (p) { return imgUrl(p.image); });
    Promise.all([fontsReady(), loadImg('../assets/img/logo-mark.jpg'), product ? loadImg(imgUrl(product.image)) : null, Promise.all(collageSrc.map(loadImg)),
      ad ? loadImg(imgUrl(photos[ad.hero] || product.image)) : null,
      ad && ad.combo && ad.combo.img != null && photos[ad.combo.img] ? loadImg(imgUrl(photos[ad.combo.img])) : null]).then(function (res) {
      var d = {
        config: config, product: product, campaign: campaign, cta: $('#stCta').value, title: $('#stTitle').value.trim(),
        logo: res[1], image: res[2], collage: res[3], adHero: res[4], adCombo: res[5], seed: seed,
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
        var styleKey = styleSel === 'surpresa' ? ['anuncio', 'laranja', 'neon', 'clean', 'foto'][(seed + i * 3) % 5] : styleSel;
        T = STYLES[styleKey] || STYLES.laranja;
        try {
          if (product && styleKey === 'anuncio') drawAd(ctx, fm.w, fm.h, d);
          else if (product) drawProduct(ctx, fm.w, fm.h, d);
          else drawCampaign(ctx, fm.w, fm.h, d);
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
    var style = document.querySelector('[data-ststyle].is-active');
    $('#stLayoutWrap').hidden = !meta.product || (style && style.getAttribute('data-ststyle') === 'anuncio');
  }

  function seg(attr) {
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
      b.addEventListener('click', function () {
        if (attr === 'data-stformat') { b.classList.toggle('is-active'); return; }
        Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (x) { x.classList.toggle('is-active', x === b); });
        if (attr === 'data-ststyle') syncCampaign();
      });
    });
  }

  /* ------------------------------ pré-definidos ------------------------------ */

  var BUILTIN = [
    { name: 'Promoção — Instagram completo', campaign: 'promo', style: 'anuncio', layout: 'grande', formats: ['feed', 'story'], cta: 'bio' },
    { name: 'Oferta relâmpago — Status/Stories', campaign: 'promo', style: 'neon', layout: 'preco', formats: ['story'], cta: 'whatsapp' },
    { name: 'Novidade — Reels/TikTok', campaign: 'novo', style: 'foto', layout: 'grande', formats: ['story'], cta: 'bio' },
    { name: 'Mais vendido — Feed', campaign: 'top', style: 'clean', layout: 'dividido', formats: ['square', 'feed'], cta: 'whatsapp' },
    { name: 'Anúncio completo — todos os formatos', campaign: 'promo', style: 'anuncio', layout: 'grande', formats: ['square', 'feed', 'story', 'wide'], cta: 'whatsapp' },
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
    activate('data-ststyle', p.style || 'anuncio');
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
