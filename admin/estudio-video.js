/*
 * Vídeo do produto (9:16, 1080x1920) no painel: o mascote Aky apresenta o produto falando em português.
 * Voz: servidor (POST /api/admin/tts, voz neural) → MP3 + tempo das palavras.
 * Imagem: desenhada no Canvas com as peças do estilo "Anúncio" do estúdio; gravada com MediaRecorder (MP4 quando o
 * navegador permite, senão WebM). A gravação acontece em tempo real: a aba precisa ficar aberta e visível.
 * Mesmo roteiro e mesma animação do gerador do computador (ferramentas/videos).
 */
(function () {
  'use strict';

  var W = 1080, H = 1920, FPS = 30;
  var ORANGE = '#ff8a00', DEEP = '#ff5e00';
  var api = null, L = null; // L = peças do estúdio (window.AkyllaStudio.lib)
  var $ = function (s) { return document.querySelector(s); };
  var busy = false;

  var TAGS = { gancho: 'hook', ficha: 'spec', junto: 'combo', preco: 'price', 'preço': 'price', chamada: 'cta', fala: 'talk' };
  var LABEL = { hook: 'gancho', spec: 'ficha', combo: 'junto', price: 'preço', cta: 'chamada', talk: 'fala' };

  /* ------------------------------ roteiro ------------------------------ */

  function brlSpoken(cents) { return 'R$ ' + (cents / 100).toFixed(2).replace('.', ','); }
  function offerLine(p, c) {
    var pr = window.AkyllaPromo.priceFor(p, c);
    var card = c.card && c.card.enabled ? ', ou em até ' + (c.card.maxInstallments || 12) + ' vezes no cartão' : '';
    return pr.price < pr.original
      ? 'Na promoção, de ' + brlSpoken(pr.original) + ' por apenas ' + brlSpoken(pr.price) + ' no PIX' + card + '!'
      : 'E sai por apenas ' + brlSpoken(pr.price) + ' no PIX' + card + '!';
  }

  function defaultScript(p) {
    var ad = L.adFor(p);
    var lines = (window.AKYLLA_ROTEIROS || {})[p.id] || window.AKYLLA_ROTEIRO_AUTO(ad);
    return lines.map(function (l) {
      var tag = LABEL[l.scene] + (l.scene === 'spec' ? ' ' + ((l.spec || 0) + 1) : '');
      return '[' + tag + '] ' + l.say.replace('{oferta}', offerLine(p, api.config()));
    }).join('\n');
  }

  function parseScript(text) {
    return String(text).split('\n').map(function (row) {
      row = row.trim();
      if (!row) return null;
      var m = /^\[([^\]\d]+?)\s*(\d+)?\]\s*(.*)$/.exec(row);
      var scene = m ? (TAGS[m[1].trim().toLowerCase()] || 'talk') : 'talk';
      var say = m ? m[3] : row;
      return say ? { scene: scene, spec: m && m[2] ? Number(m[2]) - 1 : 0, say: say } : null;
    }).filter(Boolean);
  }

  /* ------------------------------ áudio ------------------------------ */

  function tts(text, voice) {
    return api.server('/api/admin/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, raw: true,
      body: JSON.stringify({ text: text, voice: voice, rate: '+8%' })
    }).then(function (res) {
      var words = [];
      try { words = JSON.parse(decodeURIComponent(res.headers.get('X-Words') || '%5B%5D')); } catch (e) { /* sem legenda */ }
      return res.arrayBuffer().then(function (buf) { return { buf: buf, words: words }; });
    });
  }

  /* Junta as falas com pausas e calcula o volume por quadro (boca do mascote). */
  function buildAudio(actx, parts, lines) {
    var rate = actx.sampleRate, lead = 0.35, gap = 0.28, tail = 2.2;
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

  function makePieces(p, d, imgs) {
    var ad = L.adFor(p);
    var mode = ad.card ? 'card' : ad.holes ? 'holes' : 'cut';
    var pieces = { ad: ad, mode: mode };
    pieces.hero = L.cutout(imgs.hero || imgs.main, mode);
    pieces.specs = ad.specs.map(function (sp) {
      var c = canvas(860, 300), x = c.getContext('2d');
      cardBox(x, 860, 300);
      L.adSpecs(x, [sp], 40, 18, 780, 2.0);
      return c;
    });
    var cb = canvas(900, 430), cx = cb.getContext('2d');
    cardBox(cx, 900, 430);
    L.adCombo(cx, ad, imgs.combo ? L.cutout(imgs.combo, mode) : null, mode, 30, 40, 840, 1.45);
    pieces.combo = cb;
    var pc = canvas(900, 420);
    L.adPrice(pc.getContext('2d'), d.info, L.adLabel(d), 30, 40, 840, 340, 1.5);
    pieces.price = pc;
    var ct = canvas(980, 220);
    L.adCta(ct.getContext('2d'), d.cta, 20, 20, 940, 170, 1.35);
    pieces.cta = ct;
    var full = canvas(W, H);
    L.drawAd(full.getContext('2d'), W, H, d);
    pieces.full = full;
    var bg = canvas(W, H), b = bg.getContext('2d');
    L.adBackground(b, W, H);
    pieces.bg = bg;
    return pieces;
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

  /* Produto com brilho laranja (ou no cartão branco), cabendo em boxW x boxH. */
  function hero(ctx, im, mode, cx, cy, boxW, boxH, scale, rot) {
    if (!im) return;
    var k = Math.min(boxW / im.width, boxH / im.height) * scale;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180);
    var w = im.width * k, h = im.height * k;
    ctx.imageSmoothingQuality = 'high';
    if (mode === 'card') {
      ctx.shadowColor = 'rgba(255,120,0,0.55)'; ctx.shadowBlur = 50;
      ctx.fillStyle = '#fff'; L.rr(ctx, -w / 2 - 20, -h / 2 - 20, w + 40, h + 40, 36); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowColor = 'rgba(255,150,40,0.75)'; ctx.shadowBlur = 45;
    }
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function mascot(ctx, x, y, open, blink, t, pose, logo) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(0.5, 0.5);
    var bob = Math.sin(t * 3.2) * 10;
    var r = function (x0, y0, x1, y1, rad, fill) { ctx.fillStyle = fill; L.rr(ctx, x0, y0, x1 - x0, y1 - y0, rad); ctx.fill(); };
    var dot = function (cx, cy, rad, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill(); };
    ctx.lineCap = 'round';
    // antena
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(400, 175 + bob); ctx.lineTo(400, 95 + bob); ctx.stroke();
    dot(400, 70 + bob, 32 + 4 * Math.sin(t * 6), 'rgba(255,170,60,0.3)');
    dot(400, 70 + bob, 22, '#ffdc8c');
    // corpo
    r(250, 560, 550, 790, 70, DEEP);
    r(262, 568, 538, 700, 60, ORANGE);
    if (logo) { ctx.save(); ctx.beginPath(); ctx.arc(400, 655, 55, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logo, 345, 600, 110, 110); ctx.restore(); }
    // braços
    ctx.strokeStyle = DEEP; ctx.lineWidth = 46;
    ctx.beginPath(); ctx.moveTo(262, 620); ctx.lineTo(190, 720); ctx.stroke();
    dot(191, 721, 31, ORANGE);
    var deg = pose === 'wave' ? 70 + 22 * Math.sin(t * 9) : 48 + 5 * Math.sin(t * 2.5);
    var ex = 540 + 170 * Math.cos(deg * Math.PI / 180), ey = 610 - 170 * Math.sin(deg * Math.PI / 180);
    ctx.beginPath(); ctx.moveTo(540, 610); ctx.lineTo(ex, ey); ctx.stroke();
    dot(ex, ey, 34, ORANGE);
    // cabeça e rosto
    r(150, 175 + bob, 650, 560 + bob, 130, ORANGE);
    ctx.strokeStyle = DEEP; ctx.lineWidth = 12; L.rr(ctx, 150, 175 + bob, 500, 385, 130); ctx.stroke();
    r(205, 235 + bob, 595, 500 + bob, 95, '#0b0d14');
    var look = pose === 'wave' ? 0 : 12, eh = blink ? 8 : 78;
    [315, 485].forEach(function (cx) {
      r(cx - 32 + look, 345 - eh / 2 + bob, cx + 32 + look, 345 + eh / 2 + bob, Math.min(30, eh / 2), '#fff');
      if (!blink) dot(cx + look + 8, 330 + bob, 8, '#ffc878');
    });
    var mh = 10 + 62 * open;
    r(338, 440 - mh / 2 + bob, 462, 440 + mh / 2 + bob, Math.min(24, mh / 2), ORANGE);
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
    var size = 84;
    L.font(ctx, 800, size);
    var space = 24, widths, total;
    var measure = function () { widths = parts.map(function (p) { return ctx.measureText(p).width; }); total = widths.reduce(function (a, b) { return a + b; }, 0) + space * (parts.length - 1); };
    measure();
    if (total > 960) { size = Math.floor(84 * 960 / total); L.font(ctx, 800, size); measure(); }
    var x = (W - total) / 2;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = '#000';
    parts.forEach(function (p, i) {
      ctx.strokeText(p, x, 1320);
      ctx.fillStyle = group[i] === current ? ORANGE : '#fff';
      ctx.fillText(p, x, 1320);
      x += widths[i] + space;
    });
  }

  function drawFrame(ctx, t, S) {
    var P = S.pieces, lines = S.lines;
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
    // topo
    if (S.logo) { ctx.save(); ctx.beginPath(); ctx.arc(96, 118, 48, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(S.logo, 48, 70, 96, 96); ctx.restore(); }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; L.font(ctx, 800, 40); ctx.fillText('AKYLLA SHOP', 160, 122);
    ctx.fillStyle = '#ffaa46'; L.font(ctx, 700, 26, '"DM Sans", sans-serif'); ctx.fillText('akyllashop.com', 160, 156);
    L.font(ctx, 700, 26, '"DM Sans", sans-serif');
    var tag = 'Conteúdo criado com IA', tw = ctx.measureText(tag).width;
    ctx.fillStyle = '#20222c'; L.rr(ctx, W - tw - 78, 92, tw + 38, 46, 23); ctx.fill();
    ctx.strokeStyle = '#5a5c68'; ctx.lineWidth = 2; L.rr(ctx, W - tw - 78, 92, tw + 38, 46, 23); ctx.stroke();
    ctx.fillStyle = '#e6e6e6'; ctx.fillText(tag, W - tw - 59, 124);

    var fy = Math.sin(t * 2) * 14, rot = Math.sin(t * 1.3) * 2.5, punch = 1 + 0.06 * Math.max(0, 1 - lt / 0.25);
    var bw = P.mode === 'card' ? 560 : 820, bh = P.mode === 'card' ? 560 : 600;
    if (scene === 'hook') hero(ctx, P.hero, P.mode, W / 2, 660 + fy, bw, bh, 0.35 + 0.65 * easeOutBack(lt / 0.7), rot);
    else if (scene === 'spec' || scene === 'talk') {
      hero(ctx, P.hero, P.mode, W / 2, 600 + fy, bw, bh, 0.85 * punch, rot);
      var card = scene === 'spec' ? P.specs[Math.min(line.spec || 0, P.specs.length - 1)] : null;
      if (card) put(ctx, card, W / 2 + (1 - easeOut(lt / 0.35)) * 500, 1060, 0.5 + 0.5 * easeOutBack(lt / 0.45));
    } else if (scene === 'combo') {
      hero(ctx, P.hero, P.mode, W / 2, 560 + fy, bw, bh, 0.7 * punch, rot);
      put(ctx, P.combo, W / 2, 1060, 0.4 + 0.6 * easeOutBack(lt / 0.5));
    } else if (scene === 'price') {
      hero(ctx, P.hero, P.mode, W / 2, 560 + fy, bw, bh, 0.72, rot);
      var shake = Math.sin(lt * 60) * 10 * Math.max(0, 1 - lt / 0.5);
      put(ctx, P.price, W / 2 + shake, 1060, (0.3 + 0.7 * easeOutBack(lt / 0.5)) * 1.1, 0);
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      for (var k = 0; k < 10; k += 1) {
        var a = k * 0.63 + t * 1.5, rr = 6 + 4 * Math.sin(t * 8 + k);
        ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * 470, 1060 + Math.sin(a) * 260, Math.max(1, rr), 0, Math.PI * 2); ctx.fill();
      }
    } else {
      hero(ctx, P.hero, P.mode, W / 2, 580 + fy, bw, bh, 0.72, rot);
      put(ctx, P.cta, W / 2, 1080, (0.4 + 0.6 * easeOutBack(lt / 0.5)) * (1 + 0.03 * Math.sin(t * 7)));
    }
    // mascote
    var fi = Math.min(S.audio.env.length - 1, Math.floor(t * FPS));
    var speaking = t >= line.start && t <= line.start + line.dur;
    var my = 1400 + Math.sin(t * 3.2) * 6 + (t < 0.4 ? (1 - t / 0.4) * 400 : 0);
    mascot(ctx, 40, my, speaking ? S.audio.env[fi] : 0, (t % 3.3) < 0.12, t, scene === 'hook' || scene === 'cta' ? 'wave' : 'point', S.logo);
    // legenda
    if (speaking && line.groups.length) {
      var cw = null, cg = line.groups[0];
      line.groups.forEach(function (g) { g.forEach(function (w) { if (lt >= w.start) { cw = w; cg = g; } }); });
      caption(ctx, cg, cw);
    }
    if (t < 0.25) { ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - t / 0.25)) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  /* ------------------------------ gravação ------------------------------ */

  function pickMime() {
    var list = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    for (var i = 0; i < list.length; i += 1) if (window.MediaRecorder && MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }

  function status(text) { $('#vdStatus').textContent = text; }

  function generate() {
    if (busy) return;
    var p = api.products().find(function (x) { return x.id === $('#vdProduct').value; });
    if (!p) { api.toast('Escolha o produto.'); return; }
    if (!api.server) { api.toast('Entre no painel para gerar vídeos.'); return; }
    var mime = pickMime();
    if (!mime) { api.toast('Este navegador não grava vídeo. Use o Chrome ou o Edge atualizados.', 6000); return; }
    var lines = parseScript($('#vdScript').value);
    if (!lines.length) { api.toast('O roteiro está vazio.'); return; }
    busy = true;
    $('#vdGenerate').disabled = true;
    $('#vdResult').innerHTML = '';
    var voice = $('#vdVoice').value;
    var config = api.config();
    var ad = L.adFor(p);
    var photos = [p.image].concat(p.gallery || []);
    var actx = new (window.AudioContext || window.webkitAudioContext)();
    var S = { lines: lines, particles: [] };
    for (var i = 0; i < 40; i += 1) S.particles.push([Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 15 + Math.random() * 30]);

    var done = 0;
    status('Gerando a voz… (0/' + lines.length + ')');
    /* 2 falas por vez, com até 3 tentativas cada (o serviço de voz recusa muitos pedidos juntos) */
    var buffers = new Array(lines.length), next = 0;
    function one(i, attempt) {
      return tts(lines[i].say, voice).then(function (r) {
        lines[i].words = r.words; lines[i].groups = groups(r.words);
        return actx.decodeAudioData(r.buf);
      }).then(function (b) {
        buffers[i] = b;
        done += 1; status('Gerando a voz… (' + done + '/' + lines.length + ')');
      }, function (err) {
        if (attempt >= 3) throw err;
        return new Promise(function (r) { setTimeout(r, 1200 * attempt); }).then(function () { return one(i, attempt + 1); });
      });
    }
    function worker() { if (next >= lines.length) return Promise.resolve(); var i = next++; return one(i, 1).then(worker); }
    Promise.all([worker(), worker()]).then(function () {
      S.audio = buildAudio(actx, buffers, lines);
      status('Preparando as imagens…');
      return Promise.all([L.fontsReady(), L.loadImg('../assets/img/logo-akylla.webp'), L.loadImg('../assets/img/logo-mark.jpg'),
        L.loadImg(L.imgUrl(photos[ad.hero] || p.image)), ad.combo && ad.combo.img != null && photos[ad.combo.img] ? L.loadImg(L.imgUrl(photos[ad.combo.img])) : null]);
    }).then(function (res) {
      S.logo = res[1];
      var d = { config: config, product: p, campaign: 'promo', cta: 'whatsapp', title: '', logo: res[2], image: res[3], adHero: res[3], adCombo: res[4],
        info: window.AkyllaPromo.priceFor(p, config) };
      S.pieces = makePieces(p, d, { main: res[3], hero: res[3], combo: res[4] });
      return record(actx, S, mime);
    }).then(function (blob) {
      var ext = /mp4/.test(mime) ? 'mp4' : 'webm';
      var file = 'akylla-video-' + String(p.shortName).normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase() + '-9x16.' + ext;
      var url = URL.createObjectURL(blob);
      var v = document.createElement('video');
      v.src = url; v.controls = true; v.playsInline = true; v.className = 'vd-video';
      var a = document.createElement('a');
      a.href = url; a.download = file; a.className = 'btn btn-primary'; a.textContent = 'Baixar vídeo (' + ext.toUpperCase() + ', ' + (blob.size / 1048576).toFixed(1) + ' MB)';
      var box = $('#vdResult');
      box.innerHTML = '';
      box.appendChild(v); box.appendChild(a);
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], file, { type: blob.type })] })) {
        var sh = document.createElement('button');
        sh.type = 'button'; sh.className = 'btn btn-ghost'; sh.textContent = 'Compartilhar';
        sh.addEventListener('click', function () { navigator.share({ files: [new File([blob], file, { type: blob.type })], title: 'Akylla Shop' }).catch(function () {}); });
        box.appendChild(sh);
      }
      status('Pronto! Confira o vídeo e baixe.' + (ext === 'webm' ? ' (Este navegador gravou em WebM; o TikTok aceita. Para MP4, use o Edge ou o Chrome atualizados.)' : ''));
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

  function record(actx, S, mime) {
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
      src.buffer = S.audio.buffer;
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

  /* ------------------------------ tela ------------------------------ */

  function fillProducts() {
    var sel = $('#vdProduct');
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '';
    api.products().filter(function (p) { return p.image; }).forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id; o.textContent = p.shortName + (p.hidden ? ' (fora da loja)' : '');
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
    if (!$('#vdScript').value) $('#vdScript').value = defaultScript(api.products().find(function (p) { return p.id === sel.value; }) || api.products()[0]);
  }

  var wired = false;
  function init(adminApi, lib) {
    api = adminApi; L = lib;
    if (!$('#vdProduct')) return;
    fillProducts();
    if (wired) return;
    wired = true;
    $('#vdProduct').addEventListener('change', function () {
      var p = api.products().find(function (x) { return x.id === $('#vdProduct').value; });
      if (p) $('#vdScript').value = defaultScript(p);
    });
    $('#vdReset').addEventListener('click', function () {
      var p = api.products().find(function (x) { return x.id === $('#vdProduct').value; });
      if (p) $('#vdScript').value = defaultScript(p);
    });
    $('#vdGenerate').addEventListener('click', generate);
  }

  window.AkyllaVideo = { init: init, refresh: function () { if (api) fillProducts(); } };
})();
