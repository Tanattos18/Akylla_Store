/*
 * Vídeo do produto (9:16, 1080x1920) no painel — versão 2.
 * O mascote Aky apresenta o produto falando em português, com legendas palavra por palavra, cortes com as fotos
 * da galeria, trilha própria sincronizada (admin/estudio-musica.js) e chamada para ação.
 * Também gera: capa, legenda, comentário fixado, link rastreado (?origem=…) e publica como Reels (Instagram/Facebook).
 * Voz: servidor (POST /api/admin/tts). Gravação: MediaRecorder em tempo real (a aba precisa ficar aberta e visível).
 */
(function () {
  'use strict';

  var W = 1080, H = 1920, FPS = 30;
  var ORANGE = '#ff8a00', DEEP = '#ff5e00';
  var api = null, L = null, M = null; // L = peças do estúdio; M = música
  var $ = function (s) { return document.querySelector(s); };
  var busy = false, last = null, library = [];

  var TAGS = { gancho: 'hook', ficha: 'spec', junto: 'combo', preco: 'price', 'preço': 'price', chamada: 'cta', fala: 'talk', oferta: 'deal', versus: 'versus' };
  var LABEL = { hook: 'gancho', spec: 'ficha', combo: 'junto', price: 'preço', cta: 'chamada', talk: 'fala', deal: 'oferta', versus: 'versus' };

  /* ------------------------------ textos ------------------------------ */

  function brl(cents) { return 'R$ ' + (cents / 100).toFixed(2).replace('.', ','); }
  function priceOf(p) { return window.AkyllaPromo.priceFor(p, api.config()); }
  function spokenName(p) {
    var ad = L.adFor(p);
    return [ad.title[0], ad.title[1]].filter(Boolean).join(' ').toLowerCase().replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); });
  }
  function cardText() { var c = api.config().card; return c && c.enabled ? ', ou em até ' + (c.maxInstallments || 12) + ' vezes no cartão' : ''; }
  function offerLine(p) {
    var pr = priceOf(p);
    return pr.price < pr.original
      ? 'Na promoção, de ' + brl(pr.original) + ' por apenas ' + brl(pr.price) + ' no PIX' + cardText() + '!'
      : 'E sai por apenas ' + brl(pr.price) + ' no PIX' + cardText() + '!';
  }

  var QUESTIONS = {
    smartwatches: 'Ainda pega o celular toda hora pra ver mensagem?',
    drones: 'Já pensou filmar tudo lá do alto?',
    audio: 'Cansou de fone com fio embolado?',
    carregadores: 'Seu celular demora uma eternidade pra carregar?',
    cabos: 'Cabo que não carrega direito? Chega!',
    acessorios: 'A bateria do celular sempre acaba na pior hora?'
  };

  /* Gancho: [fala, título grande nos primeiros segundos] */
  function hookFor(kind, p) {
    var pr = priceOf(p), name = spokenName(p), promo = pr.price < pr.original;
    if (kind === 'preco') return [name + ' por só ' + brl(pr.price) + '? Olha isso!', { big: brl(pr.price), small: 'no PIX', badge: promo ? '-' + pr.percent + '%' : '' }];
    if (kind === 'pergunta') { var q = QUESTIONS[p.category] || 'Procurando ' + name.toLowerCase() + ' bom e barato?'; return [q + ' Olha esse ' + name + '!', { text: q }]; }
    if (kind === 'curiosidade') return ['Você não vai acreditar no que esse ' + name + ' faz!', { text: 'Olha o que esse ' + name + ' faz… 👀' }];
    var own = ((window.AKYLLA_ROTEIROS || {})[p.id] || [])[0];
    return [own ? own.say : 'Olha só o que chegou na Akylla Shop: ' + name + '!', { text: name.toUpperCase() }];
  }

  var CTAS = {
    comente: { say: 'Comenta EU QUERO que eu te mando o link!', big: 'COMENTA "EU QUERO"', small: 'que eu te mando o link 💬' },
    whatsapp: { say: 'Chama no WhatsApp que a gente separa o seu!', big: null },
    bio: { say: 'O link tá na bio. Corre, que o estoque é limitado!', big: 'LINK NA BIO 🔗', small: 'akyllashop.com' },
    salva: { say: 'Salva esse vídeo pra não esquecer, e chama a gente no WhatsApp!', big: 'SALVA ESSE VÍDEO 🔖', small: 'e chama no WhatsApp' }
  };

  function specLine(sp, short) { return sp[1] + (sp[2] && !short ? ': ' + sp[2] : '') + '.'; }
  function shortOffer(p) { var pr = priceOf(p); return pr.price < pr.original ? 'De ' + brl(pr.original) + ' por só ' + brl(pr.price) + ' no PIX!' : 'Só ' + brl(pr.price) + ' no PIX!'; }
  function comboLine(ad) { return (ad.combo.big + ' ' + ad.combo.t2).toLowerCase().replace(/^\S/, function (m) { return m.toUpperCase(); }) + '!'; }

  /* Monta o roteiro conforme modelo, gancho, duração e chamada. */
  function buildScript(o) {
    var p = o.product, ad = L.adFor(p), lines = [];
    var nSpecs = o.duration === 'curto' ? 2 : o.duration === 'medio' ? 3 : 4;
    var cta = CTAS[o.cta] || CTAS.comente;
    var own = (window.AKYLLA_ROTEIROS || {})[p.id];
    if (o.template === 'motivos') {
      lines.push({ scene: 'hook', say: '3 motivos pra ter o ' + spokenName(p) + ':', headline: { text: '3 MOTIVOS PRA TER O ' + spokenName(p).toUpperCase() } });
      ['Um', 'Dois', 'Três'].forEach(function (n, i) { if (ad.specs[i]) lines.push({ scene: 'spec', spec: i, num: i + 1, say: n + ': ' + specLine(ad.specs[i]) }); });
      lines.push({ scene: 'price', say: offerLine(p) });
    } else if (o.template === 'unboxing') {
      lines.push({ scene: 'hook', say: 'Bora abrir? Olha o que vem com o ' + spokenName(p) + '!', headline: { text: 'O QUE VEM NA CAIXA? 📦' } });
      lines.push({ scene: 'combo', say: comboLine(ad) + ' ' + String(ad.combo.p).replace(/<br\s*\/?>/g, ' ') });
      ad.specs.slice(0, nSpecs).forEach(function (sp, i) { lines.push({ scene: 'spec', spec: i, say: specLine(sp) }); });
      lines.push({ scene: 'price', say: offerLine(p) });
    } else if (o.template === 'precodia') {
      lines.push({ scene: 'hook', say: 'Preço do dia na Akylla Shop! Olha essas ofertas:', headline: { text: 'PREÇO DO DIA 🔥' } });
      o.deals.slice(0, 4).forEach(function (q, i) { lines.push({ scene: 'deal', prod: i, say: spokenName(q) + ': ' + brl(priceOf(q).price) + ' no PIX.' }); });
    } else if (o.template === 'comparativo') {
      var b = o.productB || p;
      lines.push({ scene: 'hook', say: spokenName(p) + ' ou ' + spokenName(b) + ': qual combina com você?', headline: { text: 'QUAL VOCÊ ESCOLHE? 🤔' } });
      [p, b].forEach(function (q, i) {
        var sp = L.adFor(q).specs[0];
        lines.push({ scene: 'deal', prod: i, say: spokenName(q) + ': ' + (sp ? sp[1] + ', ' : '') + 'por ' + brl(priceOf(q).price) + ' no PIX.' });
      });
      lines.push({ scene: 'versus', say: 'Comenta A ou B, que eu te ajudo a escolher!' });
    } else {
      var hk = hookFor(o.hook, p);
      lines.push({ scene: 'hook', say: hk[0], headline: hk[1] });
      if (own && o.duration === 'completo' && o.hook === 'classico') {
        own.slice(1).forEach(function (l) { if (l.scene !== 'cta') lines.push({ scene: l.scene, spec: l.spec, say: l.say.replace('{oferta}', offerLine(p)) }); });
      } else {
        var short = o.duration === 'curto';
        ad.specs.slice(0, nSpecs).forEach(function (sp, i) { lines.push({ scene: 'spec', spec: i, say: specLine(sp, short) }); });
        if (!short) lines.push({ scene: 'combo', say: comboLine(ad) });
        lines.push({ scene: 'price', say: short ? shortOffer(p) : offerLine(p) });
      }
    }
    if (o.template !== 'comparativo') lines.push({ scene: 'cta', say: cta.say });
    return lines;
  }

  function toText(lines) {
    return lines.map(function (l) {
      var tag = LABEL[l.scene] + (l.scene === 'spec' ? ' ' + ((l.spec || 0) + 1) : l.scene === 'deal' ? ' ' + ((l.prod || 0) + 1) : '') + (l.num ? ' #' + l.num : '');
      return '[' + tag + '] ' + l.say;
    }).join('\n');
  }

  function parseScript(text, base) {
    var heads = (base || []).filter(function (l) { return l.headline; });
    var out = String(text).split('\n').map(function (row) {
      row = row.trim();
      if (!row) return null;
      var m = /^\[([^\]\d#]+?)\s*(\d+)?\s*(?:#(\d+))?\]\s*(.*)$/.exec(row);
      var scene = m ? (TAGS[m[1].trim().toLowerCase()] || 'talk') : 'talk';
      var n = m && m[2] ? Number(m[2]) - 1 : 0;
      var say = m ? m[4] : row;
      if (!say) return null;
      return { scene: scene, spec: scene === 'spec' ? n : 0, prod: scene === 'deal' ? n : 0, num: m && m[3] ? Number(m[3]) : 0, say: say };
    }).filter(Boolean);
    var hook = out.find(function (l) { return l.scene === 'hook'; });
    if (hook && heads[0]) hook.headline = heads[0].headline;
    return out;
  }

  /* ------------------------------ link, legenda, comentário ------------------------------ */

  function originSlug(o) {
    var base = o.template === 'precodia' ? 'precodia' : o.template === 'comparativo' ? 'compara-' + o.product.id.split('-')[0] : o.product.id;
    return (o.network + '-' + base + '-' + o.version).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  }
  function trackLink(o) { return 'https://akyllashop.com/?origem=' + originSlug(o); }

  function captionFor(o, lines) {
    var p = o.product, pr = priceOf(p), link = trackLink(o).replace('https://', '');
    var tags = '#akyllashop #goiania #tecnologia #achadinhos #ofertas';
    var hook = (lines[0] && lines[0].say) || '';
    var bullets = L.adFor(p).specs.slice(0, 3).map(function (s) { return '✅ ' + s[1]; }).join('\n');
    var cta = { comente: '💬 Comenta EU QUERO que a gente te manda o link!', whatsapp: '📲 Chama no WhatsApp ' + (api.config().whatsappDisplay || ''), bio: '🔗 Link na bio', salva: '🔖 Salva pra não esquecer!' }[o.cta];
    var price = (pr.price < pr.original ? 'De ' + brl(pr.original) + ' por ' : 'Só ') + brl(pr.price) + ' no PIX' + (cardText() ? ' ou em até 12x' : '');
    if (o.template === 'precodia') {
      bullets = o.deals.map(function (q) { return '🔥 ' + q.shortName + ' — ' + brl(priceOf(q).price); }).join('\n');
      price = 'Preços no PIX, enquanto durar o estoque.';
    }
    if (o.template === 'comparativo') {
      bullets = [p, o.productB || p].map(function (q, i) { return (i ? '🅱️ ' : '🅰️ ') + q.shortName + ' — ' + brl(priceOf(q).price); }).join('\n');
      cta = '💬 Comenta A ou B!';
    }
    var caption = hook + '\n\n' + bullets + '\n\n💰 ' + price + '\n🚚 Retirada grátis ou entrega em Goiânia e região\n\n' + cta + '\n🛒 ' + link + '\n\n' + tags;
    var pinned = o.cta === 'comente'
      ? '📌 Comentou EU QUERO? Te chamo no direct! Ou compre direto: ' + link
      : '📌 ' + (o.template === 'precodia' ? 'Ofertas do dia' : p.shortName + ' por ' + brl(pr.price) + ' no PIX') + ' 👉 ' + link + ' · WhatsApp ' + (api.config().whatsappDisplay || '');
    return { caption: caption, pinned: pinned };
  }

  /* ------------------------------ áudio ------------------------------ */

  function tts(text, voice, rate) {
    return api.server('/api/admin/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, raw: true,
      body: JSON.stringify({ text: text, voice: voice, rate: rate })
    }).then(function (res) {
      var words = [];
      try { words = JSON.parse(decodeURIComponent(res.headers.get('X-Words') || '%5B%5D')); } catch (e) { /* sem legenda */ }
      return res.arrayBuffer().then(function (buf) { return { buf: buf, words: words }; });
    });
  }

  /* Junta as falas com pausas e calcula o volume por quadro (boca do mascote). */
  function buildVoice(actx, parts, lines, gap) {
    var rate = actx.sampleRate, lead = 0.3, tail = 2.2;
    var total = lead + tail;
    parts.forEach(function (b) { total += b.duration + gap; });
    var out = actx.createBuffer(1, Math.ceil(total * rate), rate);
    var data = out.getChannelData(0);
    var at = lead;
    parts.forEach(function (b, i) {
      data.set(b.getChannelData(0), Math.floor(at * rate));
      lines[i].start = at; lines[i].dur = b.duration;
      at += b.duration + gap;
    });
    var per = Math.floor(rate / FPS), env = [];
    for (var i = 0; i < data.length; i += per) {
      var s = 0, n = 0;
      for (var j = i; j < Math.min(i + per, data.length); j += 4) { s += data[j] * data[j]; n += 1; }
      env.push(Math.sqrt(s / Math.max(1, n)));
    }
    var sorted = env.slice().sort(function (a, b) { return a - b; });
    var peak = sorted[Math.floor(sorted.length * 0.95)] || 1;
    return { buffer: out, env: env.map(function (e) { return Math.min(1, e / peak); }), endSpeech: at, total: total };
  }

  /* ------------------------------ peças ------------------------------ */

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function cardBox(ctx, w, h) {
    ctx.fillStyle = 'rgba(10,12,20,0.93)';
    L.rr(ctx, 3, 3, w - 6, h - 6, 40); ctx.fill();
    ctx.strokeStyle = DEEP; ctx.lineWidth = 5;
    L.rr(ctx, 3, 3, w - 6, h - 6, 40); ctx.stroke();
  }
  function pill(ctx, x, y, w, h, big, small) {
    var g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, DEEP); g.addColorStop(1, ORANGE);
    ctx.save(); ctx.shadowColor = 'rgba(255,94,0,0.45)'; ctx.shadowBlur = 30;
    ctx.fillStyle = g; L.rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    var size = 64; L.font(ctx, 800, size);
    while (ctx.measureText(big).width > w - 80 && size > 30) { size -= 2; L.font(ctx, 800, size); }
    ctx.fillText(big, x + w / 2, y + h / 2 + (small ? -4 : size * 0.35));
    if (small) { L.font(ctx, 700, 34, '"DM Sans", sans-serif'); ctx.fillText(small, x + w / 2, y + h / 2 + 46); }
  }

  function productPieces(p, imgs) {
    var ad = L.adFor(p), mode = ad.card ? 'card' : ad.holes ? 'holes' : 'cut';
    return { p: p, ad: ad, mode: mode, hero: L.cutout(imgs.hero || imgs.all[0], mode), gallery: imgs.all.map(function (im) { return L.cutout(im, mode); }).filter(Boolean), combo: imgs.combo ? L.cutout(imgs.combo, mode) : null };
  }

  function dealCard(q) {
    var c = canvas(900, 300), x = c.getContext('2d'), pr = priceOf(q);
    cardBox(x, 900, 300);
    x.fillStyle = '#fff'; x.textAlign = 'left';
    var f = L.fitLines(x, q.shortName, 800, 56, 32, 1, 800); L.font(x, 800, f.size); x.fillText(f.lines[0], 50, 100);
    if (pr.price < pr.original) {
      L.font(x, 700, 36, '"DM Sans", sans-serif'); x.fillStyle = '#b9c0cc';
      var de = 'de ' + brl(pr.original); x.fillText(de, 50, 160);
      x.fillRect(50, 148, x.measureText(de).width, 4);
      x.fillStyle = ORANGE; L.rr(x, 640, 130, 210, 70, 35); x.fill();
      x.fillStyle = '#111'; L.font(x, 800, 40); x.textAlign = 'center'; x.fillText('-' + pr.percent + '%', 745, 180); x.textAlign = 'left';
    }
    x.fillStyle = ORANGE; L.font(x, 800, 96); x.fillText(brl(pr.price), 50, 262);
    var w = x.measureText(brl(pr.price)).width;
    x.fillStyle = '#fff'; L.font(x, 700, 34, '"DM Sans", sans-serif'); x.fillText('no PIX', 70 + w, 262);
    return c;
  }

  function makePieces(o, d, imgsList) {
    var P = { products: imgsList.map(function (imgs, i) { return productPieces(o.all[i], imgs); }) };
    var main = P.products[0], ad = main.ad;
    P.specs = ad.specs.map(function (sp) { var c = canvas(860, 300), x = c.getContext('2d'); cardBox(x, 860, 300); L.adSpecs(x, [sp], 40, 18, 780, 2.0); return c; });
    var cb = canvas(900, 430), cx = cb.getContext('2d'); cardBox(cx, 900, 430);
    L.adCombo(cx, ad, main.combo, main.mode, 30, 40, 840, 1.45); P.combo = cb;
    var pc = canvas(900, 420); L.adPrice(pc.getContext('2d'), d.info, L.adLabel(d), 30, 40, 840, 340, 1.5); P.price = pc;
    var ct = canvas(980, 230), cx2 = ct.getContext('2d');
    var cta = CTAS[o.cta] || CTAS.comente;
    if (cta.big) pill(cx2, 20, 20, 940, 190, cta.big, cta.small); else L.adCta(cx2, 'whatsapp', 20, 30, 940, 170, 1.35);
    P.cta = ct;
    P.deals = o.all.map(dealCard);
    var full = canvas(W, H); L.drawAd(full.getContext('2d'), W, H, d); P.full = full;
    var bg = canvas(W, H); L.adBackground(bg.getContext('2d'), W, H); P.bg = bg;
    return P;
  }

  /* ------------------------------ desenho ------------------------------ */

  function easeOutBack(x) { x = Math.max(0, Math.min(1, x)); var c1 = 1.70158, c3 = 2.70158; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function easeOut(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }

  function put(ctx, im, cx, cy, scale, rot, alpha) {
    if (!im || scale <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(cx, cy); ctx.rotate((rot || 0) * Math.PI / 180); ctx.scale(scale, scale);
    ctx.drawImage(im, -im.width / 2, -im.height / 2);
    ctx.restore();
  }

  function hero(ctx, im, mode, cx, cy, boxW, boxH, scale, rot, alpha) {
    if (!im || scale <= 0.01) return;
    var k = Math.min(boxW / im.width, boxH / im.height) * scale;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180);
    var w = im.width * k, h = im.height * k;
    ctx.imageSmoothingQuality = 'high';
    if (mode === 'card') {
      ctx.shadowColor = 'rgba(255,120,0,0.55)'; ctx.shadowBlur = 50;
      ctx.fillStyle = '#fff'; L.rr(ctx, -w / 2 - 20, -h / 2 - 20, w + 40, h + 40, 36); ctx.fill();
      ctx.shadowBlur = 0;
    } else { ctx.shadowColor = 'rgba(255,150,40,0.75)'; ctx.shadowBlur = 45; }
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /* Foto do produto com cortes a cada ~2,4 s pela galeria (zoom lento + troca rápida). */
  function galleryShot(ctx, pp, lt, idx, cx, cy, bw, bh, scale, rot) {
    var g = pp.gallery.length ? pp.gallery : [pp.hero];
    var cut = 2.4, k = Math.floor(Math.max(0, lt) / cut), within = Math.max(0, lt) - k * cut;
    var im = g[(k + idx) % g.length];
    hero(ctx, im, pp.mode, cx, cy, bw, bh, scale * (1 + 0.08 * (within / cut)), rot, Math.min(1, within / 0.15));
  }

  function mascot(ctx, x, y, size, mirror, open, blink, t, pose, expr, logo) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(size, size);
    if (mirror) { ctx.translate(800, 0); ctx.scale(-1, 1); }
    var bob = Math.sin(t * 3.2) * 10;
    var r = function (x0, y0, x1, y1, rad, fill) { ctx.fillStyle = fill; L.rr(ctx, x0, y0, x1 - x0, y1 - y0, rad); ctx.fill(); };
    var dot = function (cx, cy, rad, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill(); };
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(400, 175 + bob); ctx.lineTo(400, 95 + bob); ctx.stroke();
    dot(400, 70 + bob, 32 + 4 * Math.sin(t * 6), 'rgba(255,170,60,0.3)');
    dot(400, 70 + bob, 22, '#ffdc8c');
    r(250, 560, 550, 790, 70, DEEP);
    r(262, 568, 538, 700, 60, ORANGE);
    if (logo) { ctx.save(); ctx.beginPath(); ctx.arc(400, 655, 55, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logo, 345, 600, 110, 110); ctx.restore(); }
    ctx.strokeStyle = DEEP; ctx.lineWidth = 46;
    ctx.beginPath(); ctx.moveTo(262, 620); ctx.lineTo(190, 720); ctx.stroke();
    dot(191, 721, 31, ORANGE);
    var deg = pose === 'wave' ? 70 + 22 * Math.sin(t * 9) : 48 + 5 * Math.sin(t * 2.5);
    var ex = 540 + 170 * Math.cos(deg * Math.PI / 180), ey = 610 - 170 * Math.sin(deg * Math.PI / 180);
    ctx.beginPath(); ctx.moveTo(540, 610); ctx.lineTo(ex, ey); ctx.stroke();
    dot(ex, ey, 34, ORANGE);
    r(150, 175 + bob, 650, 560 + bob, 130, ORANGE);
    ctx.strokeStyle = DEEP; ctx.lineWidth = 12; L.rr(ctx, 150, 175 + bob, 500, 385, 130); ctx.stroke();
    r(205, 235 + bob, 595, 500 + bob, 95, '#0b0d14');
    var look = pose === 'wave' ? 0 : 12;
    [315, 485].forEach(function (cx) {
      if (expr === 'happy' && !blink) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 16;
        ctx.beginPath(); ctx.arc(cx + look, 365 + bob, 30, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        return;
      }
      var eh = blink ? 8 : expr === 'surprised' ? 96 : 78, ew = expr === 'surprised' ? 40 : 32;
      r(cx - ew + look, 345 - eh / 2 + bob, cx + ew + look, 345 + eh / 2 + bob, Math.min(30, eh / 2), '#fff');
      if (!blink) dot(cx + look + 8, 330 + bob, 8, '#ffc878');
    });
    if (expr === 'surprised') {
      var ro = 22 + 22 * open;
      ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.ellipse(400, 445 + bob, ro * 0.85, ro, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      var mh = 10 + 62 * open;
      r(338, 440 - mh / 2 + bob, 462, 440 + mh / 2 + bob, Math.min(24, mh / 2), ORANGE);
    }
    dot(242, 418 + bob, 20, 'rgba(255,120,60,0.45)');
    dot(558, 418 + bob, 20, 'rgba(255,120,60,0.45)');
    ctx.restore();
  }

  function groups(words) {
    var out = [], cur = [];
    words.forEach(function (w) {
      cur.push(w);
      if (cur.length >= 3 || cur.map(function (x) { return x.text; }).join(' ').length > 16) { out.push(cur); cur = []; }
    });
    if (cur.length) out.push(cur);
    return out;
  }

  function caption(ctx, group, current) {
    var parts = group.map(function (w) { return w.text.toUpperCase(); });
    var size = 84, space = 24, widths, total;
    L.font(ctx, 800, size);
    var measure = function () { widths = parts.map(function (p) { return ctx.measureText(p).width; }); total = widths.reduce(function (a, b) { return a + b; }, 0) + space * (parts.length - 1); };
    measure();
    if (total > 960) { size = Math.floor(84 * 960 / total); L.font(ctx, 800, size); measure(); }
    var x = (W - total) / 2;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = '#000';
    parts.forEach(function (p, i) {
      ctx.strokeText(p, x, 1320);
      ctx.fillStyle = group[i] === current ? ORANGE : '#fff';
      ctx.fillText(p, x, 1320);
      x += widths[i] + space;
    });
  }

  /* Título grande dos primeiros segundos (o que segura quem está rolando o feed). */
  function headline(ctx, h, t) {
    if (!h || t > 3.2) return;
    var a = Math.min(1, t / 0.2) * (t > 2.9 ? Math.max(0, (3.2 - t) / 0.3) : 1);
    var s = 0.6 + 0.4 * easeOutBack(t / 0.45);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, 330); ctx.scale(s, s);
    ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000';
    if (h.big) {
      L.font(ctx, 800, 170); ctx.lineWidth = 22; ctx.strokeText(h.big, 0, 40); ctx.fillStyle = ORANGE; ctx.fillText(h.big, 0, 40);
      L.font(ctx, 800, 56); ctx.lineWidth = 12; ctx.strokeText(h.small || '', 0, 120); ctx.fillStyle = '#fff'; ctx.fillText(h.small || '', 0, 120);
      if (h.badge) {
        ctx.rotate(-0.12);
        ctx.fillStyle = '#fff'; L.rr(ctx, 260, -200, 230, 100, 50); ctx.fill();
        ctx.fillStyle = DEEP; L.font(ctx, 800, 62); ctx.fillText(h.badge, 375, -128);
      }
    } else {
      var f = L.fitLines(ctx, h.text, 960, 92, 54, 3, 800);
      L.font(ctx, 800, f.size); ctx.lineWidth = 16;
      f.lines.forEach(function (l, i) {
        var y = (i - (f.lines.length - 1) / 2) * f.size * 1.08;
        ctx.strokeText(l, 0, y); ctx.fillStyle = i === f.lines.length - 1 ? ORANGE : '#fff'; ctx.fillText(l, 0, y);
      });
    }
    ctx.restore();
  }

  function drawFrame(ctx, t, S) {
    var P = S.pieces, lines = S.lines, o = S.opts, main = P.products[0];
    ctx.drawImage(P.bg, 0, 0);
    ctx.fillStyle = 'rgba(255,150,40,0.35)';
    S.particles.forEach(function (q) { var y = ((q[1] - q[3] * t) % H + H) % H; ctx.beginPath(); ctx.arc(q[0], y, q[2], 0, Math.PI * 2); ctx.fill(); });
    if (t > S.audio.endSpeech + 0.1) {
      var et = t - S.audio.endSpeech - 0.1;
      put(ctx, P.full, W / 2, H / 2, 1.06 - 0.06 * easeOut(et / 1.6), 0, easeOut(et / 0.5));
      return;
    }
    var idx = 0;
    lines.forEach(function (l, i) { if (t >= l.start - 0.05) idx = i; });
    var line = lines[idx], lt = t - line.start, scene = line.scene;
    /* topo: marca + aviso de IA */
    if (S.logo) { ctx.save(); ctx.beginPath(); ctx.arc(96, 118, 48, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(S.logo, 48, 70, 96, 96); ctx.restore(); }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; L.font(ctx, 800, 40); ctx.fillText('AKYLLA SHOP', 160, 122);
    ctx.fillStyle = '#ffaa46'; L.font(ctx, 700, 26, '"DM Sans", sans-serif'); ctx.fillText('akyllashop.com', 160, 156);
    var tag = 'Conteúdo criado com IA', tw = ctx.measureText(tag).width;
    ctx.fillStyle = '#20222c'; L.rr(ctx, W - tw - 78, 92, tw + 38, 46, 23); ctx.fill();
    ctx.strokeStyle = '#5a5c68'; ctx.lineWidth = 2; L.rr(ctx, W - tw - 78, 92, tw + 38, 46, 23); ctx.stroke();
    ctx.fillStyle = '#e6e6e6'; ctx.fillText(tag, W - tw - 59, 124);

    var fy = Math.sin(t * 2) * 14, rot = Math.sin(t * 1.3) * 2.5, punch = 1 + 0.06 * Math.max(0, 1 - lt / 0.25);
    var bw = main.mode === 'card' ? 560 : 820, bh = main.mode === 'card' ? 560 : 600;
    if (scene === 'hook') {
      galleryShot(ctx, main, lt, 0, W / 2, (line.headline && t < 3.2 ? 800 : 660) + fy, bw, bh, 0.35 + 0.65 * easeOutBack(lt / 0.7), rot);
    } else if (scene === 'spec' || scene === 'talk') {
      galleryShot(ctx, main, lt, idx, W / 2, 600 + fy, bw, bh, 0.85 * punch, rot);
      var card = scene === 'spec' ? P.specs[Math.min(line.spec || 0, P.specs.length - 1)] : null;
      if (card) put(ctx, card, W / 2 + (1 - easeOut(lt / 0.35)) * 500, 1060, 0.5 + 0.5 * easeOutBack(lt / 0.45));
      if (line.num) {
        var ns = easeOutBack(lt / 0.4);
        ctx.save(); ctx.translate(150, 880); ctx.scale(ns, ns);
        ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.textAlign = 'center'; L.font(ctx, 800, 110); ctx.fillText(String(line.num), 0, 38);
        ctx.restore();
      }
    } else if (scene === 'combo') {
      galleryShot(ctx, main, lt, idx, W / 2, 560 + fy, bw, bh, 0.7 * punch, rot);
      put(ctx, P.combo, W / 2, 1060, 0.4 + 0.6 * easeOutBack(lt / 0.5));
    } else if (scene === 'price') {
      hero(ctx, main.hero, main.mode, W / 2, 560 + fy, bw, bh, 0.72, rot);
      var shake = Math.sin(lt * 60) * 10 * Math.max(0, 1 - lt / 0.5);
      put(ctx, P.price, W / 2 + shake, 1060, (0.3 + 0.7 * easeOutBack(lt / 0.5)) * 1.1, 0);
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      for (var k = 0; k < 10; k += 1) {
        var a = k * 0.63 + t * 1.5, rr = 6 + 4 * Math.sin(t * 8 + k);
        ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * 470, 1060 + Math.sin(a) * 260, Math.max(1, rr), 0, Math.PI * 2); ctx.fill();
      }
    } else if (scene === 'deal') {
      var pi = Math.min(line.prod || 0, P.products.length - 1), pp = P.products[pi];
      var pw = pp.mode === 'card' ? 560 : 820, ph = pp.mode === 'card' ? 560 : 600;
      galleryShot(ctx, pp, lt, 0, W / 2 + (1 - easeOut(lt / 0.35)) * 700, 600 + fy, pw, ph, 0.85, rot);
      put(ctx, P.deals[pi], W / 2, 1060, 0.4 + 0.6 * easeOutBack(lt / 0.45));
      if (o.template === 'comparativo') {
        ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.lineWidth = 14;
        L.font(ctx, 800, 140); ctx.strokeText(pi ? 'B' : 'A', 150, 480); ctx.fillStyle = ORANGE; ctx.fillText(pi ? 'B' : 'A', 150, 480);
      }
    } else if (scene === 'versus') {
      var A = P.products[0], B = P.products[1] || P.products[0];
      hero(ctx, A.hero, A.mode, 290, 640 + fy, 460, 460, easeOutBack(lt / 0.5), -4);
      hero(ctx, B.hero, B.mode, 790, 640 - fy, 460, 460, easeOutBack((lt - 0.15) / 0.5), 4);
      ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.lineWidth = 14;
      L.font(ctx, 800, 150); ctx.strokeText('VS', W / 2, 700); ctx.fillStyle = ORANGE; ctx.fillText('VS', W / 2, 700);
      [[A, 290, 'A'], [B, 790, 'B']].forEach(function (z) {
        L.font(ctx, 800, 90); ctx.strokeText(z[2], z[1], 380); ctx.fillStyle = '#fff'; ctx.fillText(z[2], z[1], 380);
        L.font(ctx, 800, 62); ctx.strokeText(brl(priceOf(z[0].p).price), z[1], 980); ctx.fillStyle = ORANGE; ctx.fillText(brl(priceOf(z[0].p).price), z[1], 980);
      });
    } else {
      hero(ctx, main.hero, main.mode, W / 2, 580 + fy, bw, bh, 0.72, rot);
      put(ctx, P.cta, W / 2, 1070, (0.4 + 0.6 * easeOutBack(lt / 0.5)) * (1 + 0.03 * Math.sin(t * 7)));
    }
    headline(ctx, lines[0] && lines[0].headline, t);

    var fi = Math.min(S.audio.env.length - 1, Math.floor(t * FPS));
    var speaking = t >= line.start && t <= line.start + line.dur;
    var size = { p: 0.38, m: 0.5, g: 0.62 }[o.mascotSize] || 0.5;
    var mx = o.mascotSide === 'direita' ? W - 800 * size - 30 : 30;
    var my = H - 820 * size - 100 + Math.sin(t * 3.2) * 6 + (t < 0.4 ? (1 - t / 0.4) * 400 : 0);
    var expr = scene === 'price' || scene === 'deal' ? 'surprised' : scene === 'cta' || scene === 'versus' ? 'happy' : 'normal';
    mascot(ctx, mx, my, size, o.mascotSide === 'direita', speaking ? S.audio.env[fi] : 0, (t % 3.3) < 0.12, t,
      scene === 'hook' || scene === 'cta' ? 'wave' : 'point', expr, S.logo);
    if (speaking && line.groups && line.groups.length && !(line.headline && t < 3.2)) {
      var cw = null, cg = line.groups[0];
      line.groups.forEach(function (g) { g.forEach(function (w) { if (lt >= w.start) { cw = w; cg = g; } }); });
      caption(ctx, cg, cw);
    }
    if (t < 0.2) { ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - t / 0.2)) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  /* Capa (1080x1920 JPEG): produto grande + título + preço. */
  function drawCover(S) {
    var c = canvas(W, H), x = c.getContext('2d'), P = S.pieces, main = P.products[0], o = S.opts;
    x.drawImage(P.bg, 0, 0);
    if (o.template === 'comparativo' && P.products[1]) {
      hero(x, main.hero, main.mode, 290, 900, 480, 520, 1, -4);
      hero(x, P.products[1].hero, P.products[1].mode, 790, 900, 480, 520, 1, 4);
    } else hero(x, main.hero, main.mode, W / 2, 920, 900, 760, 1, 0);
    var title = { motivos: '3 MOTIVOS PRA TER', unboxing: 'O QUE VEM NA CAIXA', precodia: 'PREÇO DO DIA', comparativo: 'QUAL VOCÊ ESCOLHE?' }[o.template] || spokenName(main.p).toUpperCase();
    x.textAlign = 'center'; x.lineJoin = 'round'; x.strokeStyle = '#000';
    var f = L.fitLines(x, title, 960, 120, 64, 2, 800); L.font(x, 800, f.size); x.lineWidth = 18;
    f.lines.forEach(function (l, i) { var y = 330 + i * f.size * 1.05; x.strokeText(l, W / 2, y); x.fillStyle = i ? ORANGE : '#fff'; x.fillText(l, W / 2, y); });
    if (o.template !== 'precodia') {
      var pr = priceOf(main.p);
      pill(x, 190, 1420, 700, 170, brl(pr.price) + ' no PIX', pr.price < pr.original ? '-' + pr.percent + '% de desconto' : '');
    }
    if (S.logo) { x.save(); x.beginPath(); x.arc(W / 2, 1720, 70, 0, Math.PI * 2); x.clip(); x.drawImage(S.logo, W / 2 - 70, 1650, 140, 140); x.restore(); }
    return c;
  }

  /* ------------------------------ gravação ------------------------------ */

  function pickMime() {
    var list = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    for (var i = 0; i < list.length; i += 1) if (window.MediaRecorder && MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }
  function status(text) { $('#vdStatus').textContent = text; }

  function record(actx, S, mixed, mime) {
    return new Promise(function (resolve, reject) {
      var cv = canvas(W, H);
      cv.className = 'vd-live';
      var box = $('#vdResult');
      box.innerHTML = '';
      box.appendChild(cv);
      var ctx = cv.getContext('2d');
      drawFrame(ctx, 0, S);
      var stream = cv.captureStream(FPS);
      var dest = actx.createMediaStreamDestination();
      var src = actx.createBufferSource();
      src.buffer = mixed;
      src.connect(dest);
      stream.addTrack(dest.stream.getAudioTracks()[0]);
      var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000, audioBitsPerSecond: 160000 });
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () { resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
      rec.onerror = function (e) { reject(e.error || new Error('falha na gravação')); };
      actx.resume().then(function () {
        rec.start(1000);
        var t0 = actx.currentTime + 0.15;
        src.start(t0);
        var total = S.audio.total;
        (function loop() {
          var t = Math.max(0, actx.currentTime - t0);
          drawFrame(ctx, t, S);
          status('Gravando o vídeo… ' + Math.min(100, Math.round(t / total * 100)) + '% (deixe esta aba aberta e visível)');
          if (t >= total) { setTimeout(function () { rec.stop(); }, 200); return; }
          requestAnimationFrame(loop);
        })();
      }, reject);
    });
  }

  /* ------------------------------ opções ------------------------------ */

  function val(id) { var el = $(id); return el ? el.value : ''; }
  function productById(id) { return api.products().find(function (x) { return x.id === id; }); }

  function readOpts() {
    var p = productById(val('#vdProduct'));
    var deals = Array.prototype.map.call(document.querySelectorAll('#vdDeals input:checked'), function (cb) { return productById(cb.value); }).filter(Boolean).slice(0, 4);
    if (!deals.length && p) deals = [p];
    var o = {
      template: val('#vdTemplate') || 'padrao', product: p, productB: productById(val('#vdProductB')), deals: deals,
      hook: val('#vdHook') || 'preco', duration: val('#vdDuration') || 'medio', cta: val('#vdCta') || 'comente',
      voice: val('#vdVoice') || 'francisca', rate: val('#vdRate') || '+12%', music: val('#vdMusic') || 'new:pop', musicLevel: Number(val('#vdMusicLevel') || 0.45),
      mascotSize: val('#vdMascotSize') || 'm', mascotSide: val('#vdMascotSide') || 'esquerda',
      network: val('#vdNetwork') || 'tiktok', version: val('#vdVersion') || 'a'
    };
    if (o.template === 'precodia') { o.product = deals[0]; o.all = deals; }
    else if (o.template === 'comparativo') o.all = [p, o.productB && o.productB !== p ? o.productB : p];
    else o.all = [p];
    return o;
  }

  function syncFields() {
    var t = val('#vdTemplate');
    $('#vdDealsWrap').hidden = t !== 'precodia';
    $('#vdProductBWrap').hidden = t !== 'comparativo';
    $('#vdProductWrap').hidden = t === 'precodia';
    $('#vdHookWrap').hidden = t !== 'padrao';
    var o = readOpts();
    $('#vdLink').textContent = o.product ? trackLink(o) : '';
  }

  function rebuildScript() {
    var o = readOpts();
    if (!o.product) return;
    var lines = buildScript(o);
    last = { base: lines };
    $('#vdScript').value = toText(lines);
    syncFields();
  }

  function recipeFor(o) {
    if (o.music === 'none') return null;
    if (o.music.indexOf('new:') === 0) return M.randomRecipe(o.music.slice(4));
    return library.find(function (t) { return t.id === o.music; }) || M.randomRecipe('pop');
  }

  /* ------------------------------ gerar ------------------------------ */

  function generate() {
    if (busy) return;
    var o = readOpts();
    if (!o.product) { api.toast('Escolha o produto.'); return; }
    if (!api.server) { api.toast('Entre no painel para gerar vídeos.'); return; }
    var mime = pickMime();
    if (!mime) { api.toast('Este navegador não grava vídeo. Use o Chrome ou o Edge atualizados.', 6000); return; }
    var lines = parseScript($('#vdScript').value, last && last.base);
    if (!lines.length) { api.toast('O roteiro está vazio.'); return; }
    lines.forEach(function (l) { if (l.scene === 'deal' && l.prod >= o.all.length) l.prod = o.all.length - 1; });
    busy = true;
    $('#vdGenerate').disabled = true;
    $('#vdResult').innerHTML = '';
    $('#vdAfter').hidden = true;
    var config = api.config();
    var actx = new (window.AudioContext || window.webkitAudioContext)();
    var S = { lines: lines, particles: [], opts: o };
    for (var i = 0; i < 40; i += 1) S.particles.push([Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 15 + Math.random() * 30]);
    var recipe = recipeFor(o);
    var gap = o.duration === 'completo' ? 0.25 : 0.12;

    /* voz: 2 falas por vez, com até 3 tentativas cada (o serviço recusa muitos pedidos juntos) */
    var buffers = new Array(lines.length), next = 0, done = 0;
    function one(i, attempt) {
      return tts(lines[i].say, o.voice, o.rate).then(function (r) {
        lines[i].words = r.words; lines[i].groups = groups(r.words);
        return actx.decodeAudioData(r.buf);
      }).then(function (b) {
        buffers[i] = b; done += 1; status('Gerando a voz… (' + done + '/' + lines.length + ')');
      }, function (err) {
        if (attempt >= 3) throw err;
        return new Promise(function (r) { setTimeout(r, 1200 * attempt); }).then(function () { return one(i, attempt + 1); });
      });
    }
    function worker() { if (next >= lines.length) return Promise.resolve(); var i = next++; return one(i, 1).then(worker); }
    status('Gerando a voz… (0/' + lines.length + ')');
    var mixed;
    Promise.all([worker(), worker()]).then(function () {
      S.audio = buildVoice(actx, buffers, lines, gap);
      status(recipe ? 'Compondo a trilha (' + M.STYLES[recipe.style].label + ')…' : 'Preparando…');
      var price = lines.find(function (l) { return l.scene === 'price'; });
      var cues = {
        changes: lines.map(function (l) { return l.start; }),
        priceAt: price ? price.start : 0,
        endAt: S.audio.endSpeech + 0.1,
        speech: lines.map(function (l) { return [l.start, l.start + l.dur]; })
      };
      return M.mix(S.audio.buffer, recipe, cues, o.musicLevel);
    }).then(function (buf) {
      mixed = buf;
      status('Preparando as imagens…');
      return Promise.all([L.fontsReady(), L.loadImg('../assets/img/logo-akylla.webp'), L.loadImg('../assets/img/logo-mark.jpg')].concat(o.all.map(function (q) {
        var ad = L.adFor(q), photos = [q.image].concat(q.gallery || []);
        return Promise.all([L.loadImg(L.imgUrl(photos[ad.hero] || q.image)), Promise.all(photos.slice(0, 5).map(function (ph) { return L.loadImg(L.imgUrl(ph)); })),
          ad.combo && ad.combo.img != null && photos[ad.combo.img] ? L.loadImg(L.imgUrl(photos[ad.combo.img])) : null]);
      })));
    }).then(function (res) {
      S.logo = res[1];
      var imgsList = res.slice(3).map(function (r) { return { hero: r[0], all: r[1].filter(Boolean), combo: r[2] }; });
      var d = { config: config, product: o.product, campaign: 'promo', cta: 'whatsapp', title: '', logo: res[2], image: imgsList[0].hero, adHero: imgsList[0].hero, adCombo: imgsList[0].combo, info: priceOf(o.product) };
      S.pieces = makePieces(o, d, imgsList);
      return record(actx, S, mixed, mime);
    }).then(function (blob) {
      showResult(S, o, blob, mime, recipe, lines);
      status('Pronto! Confira o vídeo, a capa e a legenda.' + (/webm/.test(mime) ? ' (Este navegador gravou em WebM; o TikTok aceita. Para MP4 e Reels, use o Edge ou o Chrome atualizados.)' : ''));
      api.toast('Vídeo pronto!');
    }).catch(function (err) {
      console.error('vídeo', err);
      status('Não consegui gerar o vídeo: ' + (err.message || err));
    }).finally(function () {
      busy = false;
      $('#vdGenerate').disabled = false;
      actx.close().catch(function () {});
    });
  }

  function slug(t) { return String(t).normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }

  function button(text, cls, onClick) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (cls || 'btn-ghost'); b.textContent = text;
    b.addEventListener('click', onClick); return b;
  }

  function showResult(S, o, blob, mime, recipe, lines) {
    var ext = /mp4/.test(mime) ? 'mp4' : 'webm';
    var name = 'akylla-' + slug(o.template === 'precodia' ? 'preco-do-dia' : o.product.shortName) + '-' + o.network + '-' + o.version;
    var url = URL.createObjectURL(blob);
    var cover = drawCover(S);
    var box = $('#vdResult');
    box.innerHTML = '';
    var frame = document.createElement('div'); frame.className = 'vd-frame';
    var v = document.createElement('video'); v.src = url; v.controls = true; v.playsInline = true; v.className = 'vd-video';
    var safe = document.createElement('div'); safe.className = 'vd-safe'; safe.hidden = true;
    ['top', 'bottom', 'side'].forEach(function (k) { var z = document.createElement('span'); z.className = 'vd-safe-' + k; safe.appendChild(z); });
    frame.appendChild(v); frame.appendChild(safe);
    var coverImg = document.createElement('img'); coverImg.className = 'vd-cover'; coverImg.alt = 'Capa do vídeo';
    coverImg.src = cover.toDataURL('image/jpeg', 0.9);
    var media = document.createElement('div'); media.className = 'vd-media';
    media.appendChild(frame); media.appendChild(coverImg);
    box.appendChild(media);
    var actions = document.createElement('div'); actions.className = 'st-buttons';
    var a = document.createElement('a'); a.href = url; a.download = name + '-9x16.' + ext; a.className = 'btn btn-primary';
    a.textContent = 'Baixar vídeo (' + ext.toUpperCase() + ', ' + (blob.size / 1048576).toFixed(1) + ' MB)';
    actions.appendChild(a);
    actions.appendChild(button('Baixar capa', 'btn-ghost', function () {
      cover.toBlob(function (b) { var l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = name + '-capa.jpg'; document.body.appendChild(l); l.click(); setTimeout(function () { URL.revokeObjectURL(l.href); l.remove(); }, 1500); }, 'image/jpeg', 0.9);
    }));
    actions.appendChild(button('Mostrar áreas seguras', 'btn-ghost', function () { safe.hidden = !safe.hidden; this.textContent = safe.hidden ? 'Mostrar áreas seguras' : 'Esconder áreas seguras'; }));
    var file = new File([blob], name + '.' + ext, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) actions.appendChild(button('Compartilhar', 'btn-ghost', function () { navigator.share({ files: [file], title: 'Akylla Shop' }).catch(function () {}); }));
    if (recipe && !recipe.id) actions.appendChild(button('🎵 Salvar esta trilha na biblioteca', 'btn-ghost', function () { saveTrack(recipe); }));
    box.appendChild(actions);

    var texts = captionFor(o, lines);
    $('#vdCaption').value = texts.caption;
    $('#vdPinned').value = texts.pinned;
    $('#vdLinkOut').textContent = trackLink(o);
    $('#vdAfter').hidden = false;
    var reel = $('#vdReel');
    reel.disabled = ext !== 'mp4';
    reel.title = ext !== 'mp4' ? 'Reels precisa de MP4 (use o Chrome ou o Edge atualizados)' : '';
    reel.onclick = function () { publishReel(blob, cover, o); };
  }

  /* ------------------------------ Reels ------------------------------ */

  function publishReel(blob, cover, o) {
    var targets = [];
    if ($('#vdReelIg').checked) targets.push('instagram_reel');
    if ($('#vdReelFb').checked) targets.push('facebook_video');
    if (!targets.length) { api.toast('Marque Instagram e/ou Facebook.'); return; }
    if (!confirm('Publicar este vídeo agora (' + targets.map(function (t) { return t === 'instagram_reel' ? 'Reels do Instagram' : 'vídeo da Página do Facebook'; }).join(' e ') + ')?\n\nFica público na hora.')) return;
    var out = $('#vdReelResult'), btn = $('#vdReel');
    btn.disabled = true; btn.textContent = 'Enviando…'; out.textContent = '';
    var up = function (body, type) { return api.server('/api/admin/social/media', { method: 'POST', headers: { 'Content-Type': type }, body: body }); };
    new Promise(function (r) { cover.toBlob(r, 'image/jpeg', 0.9); }).then(function (cb) {
      return Promise.all([up(blob, 'video/mp4'), up(cb, 'image/jpeg')]);
    }).then(function (ids) {
      btn.textContent = 'Publicando (o Instagram processa o vídeo, até 1–2 min)…';
      return api.server('/api/admin/social/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: ids[0].mediaId, coverId: ids[1].mediaId, targets: targets, caption: $('#vdCaption').value, facebookCaption: $('#vdCaption').value })
      });
    }).then(function (r) {
      out.textContent = '';
      Object.keys(r.results).forEach(function (k) {
        var res = r.results[k], p = document.createElement('p');
        p.className = res.error ? 'st-pub-err' : 'st-pub-ok';
        p.textContent = (res.error ? '✖ ' : '✓ ') + (k === 'instagram_reel' ? 'Reels do Instagram' : 'Facebook') + (res.error ? ': ' + res.error : ' publicado');
        if (res.link) { var a = document.createElement('a'); a.href = res.link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' — ver'; p.appendChild(a); }
        out.appendChild(p);
      });
      api.toast(r.ok ? 'Publicado! Fixe o comentário pronto no post.' : 'Não consegui publicar. Veja o motivo.', 6000);
    }).catch(function (err) {
      out.textContent = '✖ ' + err.message + (/configurad|token/i.test(err.message) ? ' (veja o README, seção 10.2)' : '');
    }).finally(function () { btn.disabled = false; btn.textContent = 'Publicar como Reels'; });
  }

  /* ------------------------------ biblioteca de trilhas ------------------------------ */

  function loadLibrary() {
    if (!api.server) return Promise.resolve();
    return api.server('/api/admin/music').then(function (r) { library = r.tracks || []; renderLibrary(); fillMusic(); })
      .catch(function () { library = []; renderLibrary(); fillMusic(); });
  }

  function fillMusic() {
    var sel = $('#vdMusic'); if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '';
    var add = function (v, t, g) { var op = document.createElement('option'); op.value = v; op.textContent = t; (g || sel).appendChild(op); };
    add('none', 'Sem música (adicionar um som em alta no app)');
    Object.keys(M.STYLES).forEach(function (k) { add('new:' + k, 'Nova trilha: ' + M.STYLES[k].label); });
    if (library.length) {
      var g = document.createElement('optgroup'); g.label = 'Biblioteca da loja';
      library.forEach(function (t) { add(t.id, '🎵 ' + t.name + ' (' + M.STYLES[t.style].label + ', ' + t.bpm + ' BPM)', g); });
      sel.appendChild(g);
    }
    sel.value = cur && sel.querySelector('option[value="' + cur + '"]') ? cur : 'new:pop';
  }

  var preview = null;
  function playRecipe(recipe, btn) {
    if (preview) { preview.pause(); preview = null; }
    if (btn) btn.disabled = true;
    return M.render(recipe, 20, 22050).then(function (buf) {
      preview = new Audio(URL.createObjectURL(M.toWav(buf)));
      preview.play().catch(function () {});
    }).finally(function () { if (btn) btn.disabled = false; });
  }

  var draft = null;
  function saveTrack(recipe) {
    var name = (prompt('Nome da trilha (ex.: "Pop da inauguração"):', M.STYLES[recipe.style].label + ' ' + new Date().toLocaleDateString('pt-BR')) || '').trim();
    if (!name) return;
    api.toast('Salvando a trilha na biblioteca…');
    api.server('/api/admin/music', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, style: recipe.style, bpm: recipe.bpm, key: recipe.key, seed: recipe.seed }) })
      .then(function (r) {
        return M.render(recipe, 20, 22050).then(function (buf) {
          return api.server('/api/admin/music/' + r.track.id + '/audio', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: M.toWav(buf) });
        });
      }).then(function () { api.toast('Trilha salva na biblioteca da loja.'); return loadLibrary(); })
      .catch(function (err) { api.toast('Não consegui salvar: ' + err.message, 6000); });
  }

  function renderLibrary() {
    var box = $('#mlList'); if (!box) return;
    box.innerHTML = '';
    if (!library.length) { var p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Nenhuma trilha salva ainda. Crie uma acima e clique em Salvar na biblioteca.'; box.appendChild(p); return; }
    library.forEach(function (t) {
      var row = document.createElement('div'); row.className = 'ml-row';
      var info = document.createElement('div');
      var b = document.createElement('strong'); b.textContent = '🎵 ' + t.name;
      var s = document.createElement('small'); s.className = 'muted'; s.textContent = ' ' + M.STYLES[t.style].label + ' · ' + t.bpm + ' BPM · tom ' + t.key + ' · ' + new Date(t.createdAt).toLocaleDateString('pt-BR');
      info.appendChild(b); info.appendChild(s);
      row.appendChild(info);
      var acts = document.createElement('div'); acts.className = 'ml-actions';
      acts.appendChild(button('▶ Ouvir', 'btn-ghost btn-sm', function () { playRecipe(t, this); }));
      acts.appendChild(button('Usar no vídeo', 'btn-ghost btn-sm', function () { $('#vdMusic').value = t.id; api.toast('Trilha "' + t.name + '" escolhida para o vídeo.'); }));
      acts.appendChild(button('Apagar', 'btn-ghost btn-sm', function () {
        if (!confirm('Apagar a trilha "' + t.name + '" da biblioteca?')) return;
        api.server('/api/admin/music/' + t.id + '/delete', { method: 'POST' }).then(loadLibrary).catch(function (err) { api.toast(err.message); });
      }));
      row.appendChild(acts);
      box.appendChild(row);
    });
  }

  /* ------------------------------ desempenho ------------------------------ */

  function loadInsights() {
    var out = $('#piResult');
    out.textContent = 'Buscando no Instagram…';
    api.server('/api/admin/social/insights').then(function (r) {
      out.innerHTML = '';
      if (!r.configured || !r.instagram) { out.textContent = 'Ligue o painel ao Instagram para ver o desempenho (README, seção 10.2). Enquanto isso, poste às 12h e entre 19h e 22h, os horários de maior movimento.'; return; }
      var t = document.createElement('table'); t.className = 'dash-table';
      var head = ['Data', 'Tipo', 'Post', 'Visualiz.', 'Alcance', 'Curtidas', 'Coment.', 'Salvos', 'Compart.'];
      var thead = document.createElement('thead'), tr = document.createElement('tr');
      head.forEach(function (h, i) { var th = document.createElement('th'); th.textContent = h; if (i > 2) th.className = 'num'; tr.appendChild(th); });
      thead.appendChild(tr); t.appendChild(thead);
      var tb = document.createElement('tbody'), byHour = {};
      r.items.forEach(function (m) {
        var d = new Date(m.at), row = document.createElement('tr');
        var eng = (m.likes || 0) + (m.comments || 0) * 2 + (m.saved || 0) * 3 + (m.shares || 0) * 3;
        var hour = Number(d.toLocaleString('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }));
        byHour[hour] = byHour[hour] || { sum: 0, n: 0 }; byHour[hour].sum += eng; byHour[hour].n += 1;
        [d.toLocaleDateString('pt-BR'), m.type === 'REELS' ? 'Reels' : m.type === 'STORY' ? 'Story' : 'Post'].forEach(function (c) { var td = document.createElement('td'); td.textContent = c; row.appendChild(td); });
        var tdp = document.createElement('td'); var a = document.createElement('a'); a.href = m.link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = m.caption || 'abrir'; tdp.appendChild(a); row.appendChild(tdp);
        [m.views, m.reach, m.likes, m.comments, m.saved, m.shares].forEach(function (c) { var td = document.createElement('td'); td.className = 'num'; td.textContent = c == null ? '—' : String(c); row.appendChild(td); });
        tb.appendChild(row);
      });
      t.appendChild(tb);
      var wrap = document.createElement('div'); wrap.className = 'table-wrap'; wrap.appendChild(t);
      out.appendChild(wrap);
      var best = Object.keys(byHour).map(function (h) { return [Number(h), byHour[h].sum / byHour[h].n]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
      var tip = document.createElement('p'); tip.className = 'muted';
      tip.textContent = r.items.length >= 6 && best.length
        ? '⏰ Seus melhores horários até agora (mais curtidas, comentários, salvos e compartilhamentos): ' + best.map(function (b) { return b[0] + 'h'; }).join(', ') + '. Poste nesses horários.'
        : '⏰ Ainda há poucos posts para medir. Comece às 12h e entre 19h e 22h; com 6 ou mais posts, o painel mostra os seus melhores horários.';
      out.appendChild(tip);
    }).catch(function (err) { out.textContent = 'Não consegui buscar: ' + err.message; });
  }

  /* ------------------------------ tela ------------------------------ */

  function fillProducts() {
    var list = api.products().filter(function (p) { return p.image; });
    ['#vdProduct', '#vdProductB'].forEach(function (id, k) {
      var sel = $(id); if (!sel) return;
      var cur = sel.value;
      sel.innerHTML = '';
      list.forEach(function (p) { var op = document.createElement('option'); op.value = p.id; op.textContent = p.shortName + (p.hidden ? ' (fora da loja)' : ''); sel.appendChild(op); });
      if (cur) sel.value = cur; else if (k === 1 && list[1]) sel.value = list[1].id;
    });
    var deals = $('#vdDeals');
    if (deals && !deals.children.length) {
      list.filter(function (p) { return !p.hidden; }).forEach(function (p, i) {
        var lab = document.createElement('label'); lab.className = 'st-pub-check';
        var cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = p.id; cb.checked = i < 3;
        cb.addEventListener('change', function () {
          if (document.querySelectorAll('#vdDeals input:checked').length > 4) { cb.checked = false; api.toast('No máximo 4 produtos no Preço do dia.'); }
          rebuildScript();
        });
        lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + p.shortName));
        deals.appendChild(lab);
      });
    }
    if (!$('#vdScript').value) rebuildScript();
  }

  var wired = false;
  function init(adminApi, lib) {
    api = adminApi; L = lib; M = window.AkyllaMusic;
    if (!$('#vdProduct') || !M) return;
    fillMusic();
    fillProducts();
    loadLibrary();
    if (wired) return;
    wired = true;
    ['#vdProduct', '#vdProductB', '#vdTemplate', '#vdHook', '#vdDuration', '#vdCta'].forEach(function (id) { $(id).addEventListener('change', rebuildScript); });
    ['#vdNetwork', '#vdVersion'].forEach(function (id) { $(id).addEventListener('change', syncFields); });
    $('#vdReset').addEventListener('click', rebuildScript);
    $('#vdGenerate').addEventListener('click', generate);
    Array.prototype.forEach.call(document.querySelectorAll('[data-vdcopy]'), function (b) {
      b.addEventListener('click', function () {
        var el = $(b.getAttribute('data-vdcopy'));
        var text = el.value != null ? el.value : el.textContent;
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { api.toast('Copiado!'); }, function () { if (el.select) el.select(); document.execCommand('copy'); api.toast('Copiado!'); });
      });
    });
    $('#mlCreate').addEventListener('click', function () {
      draft = M.randomRecipe(val('#mlStyle'));
      playRecipe(draft, this);
      $('#mlSave').disabled = false;
      $('#mlInfo').textContent = 'Tocando: ' + M.STYLES[draft.style].label + ' · ' + draft.bpm + ' BPM · tom ' + draft.key + '. Gostou? Salve. Não gostou? Crie outra.';
    });
    $('#mlStop').addEventListener('click', function () { if (preview) { preview.pause(); preview = null; } });
    $('#mlSave').addEventListener('click', function () { if (draft) saveTrack(draft); });
    $('#piLoad').addEventListener('click', loadInsights);
    syncFields();
  }

  window.AkyllaVideo = { init: init, refresh: function () { if (api) fillProducts(); } };
})();
