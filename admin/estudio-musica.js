/*
 * Trilhas próprias da Akylla, compostas no navegador (Web Audio): bateria, baixo, acordes e efeitos sintetizados.
 * Nada é baixado nem copiado → sem direito autoral de terceiros. A "receita" (estilo, BPM, tom, semente) recria
 * sempre a mesma música, em qualquer duração; por isso a biblioteca no servidor guarda só a receita + uma amostra.
 *
 * Sincronia com o vídeo (cues): whoosh na troca de cena, subida antes do preço, impacto no preço,
 * volume abaixa sozinho enquanto o mascote fala (ducking) e some no final.
 */
(function () {
  'use strict';

  var STYLES = {
    pop: { label: 'Pop animado', bpm: 118 },
    lofi: { label: 'Lo-fi suave', bpm: 84 },
    hype: { label: 'Eletrônica hype', bpm: 128 }
  };
  var TONIC = { A: 57, C: 60, D: 62, E: 52, G: 55 };

  /* gerador de números com semente: mesma semente → mesma música */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  var PROGS = {
    pop: [[[9, 'm'], [5, 'M'], [0, 'M'], [7, 'M']], [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], [[9, 'm'], [7, 'M'], [5, 'M'], [7, 'M']]],
    lofi: [[[2, 'm7'], [7, '7'], [0, 'M7'], [9, 'm7']], [[5, 'M7'], [4, 'm7'], [2, 'm7'], [0, 'M7']], [[9, 'm7'], [2, 'm7'], [7, '7'], [0, 'M7']]],
    hype: [[[9, 'm'], [5, 'M'], [0, 'M'], [7, 'M']], [[9, 'm'], [9, 'm'], [5, 'M'], [7, 'M']], [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']]]
  };
  var SHAPES = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10] };

  /* ------------------------------ instrumentos ------------------------------ */

  function Kit(ctx, out) {
    var len = ctx.sampleRate * 1.5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    this.ctx = ctx; this.out = out; this.noise = buf;
  }
  Kit.prototype.env = function (t, peak, attack, decay) {
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.out);
    return g;
  };
  Kit.prototype.osc = function (type, freq, t, dur) {
    var o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  };
  Kit.prototype.noiseSrc = function (t, dur) {
    var n = this.ctx.createBufferSource(); n.buffer = this.noise;
    n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
    return n;
  };
  Kit.prototype.filter = function (type, freq, q) {
    var f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; return f;
  };
  Kit.prototype.kick = function (t, vol, soft) {
    var o = this.osc('sine', soft ? 110 : 150, t, 0.45);
    o.frequency.exponentialRampToValueAtTime(soft ? 50 : 42, t + 0.12);
    o.connect(this.env(t, vol, 0.004, soft ? 0.3 : 0.38));
  };
  Kit.prototype.snare = function (t, vol, dark) {
    var n = this.noiseSrc(t, 0.25), f = this.filter('bandpass', dark ? 1100 : 1800, 0.8);
    n.connect(f); f.connect(this.env(t, vol, 0.003, dark ? 0.22 : 0.16));
    var o = this.osc('triangle', 190, t, 0.12); o.connect(this.env(t, vol * 0.5, 0.002, 0.08));
  };
  Kit.prototype.hat = function (t, vol, open) {
    var n = this.noiseSrc(t, open ? 0.3 : 0.06), f = this.filter('highpass', 7500);
    n.connect(f); f.connect(this.env(t, vol, 0.002, open ? 0.22 : 0.04));
  };
  Kit.prototype.bass = function (t, freq, dur, vol, type) {
    var o = this.osc(type || 'sawtooth', freq, t, dur), f = this.filter('lowpass', 380, 4);
    o.connect(f); f.connect(this.env(t, vol, 0.01, dur));
  };
  Kit.prototype.chord = function (t, freqs, dur, vol, type, cutoff) {
    var self = this, f = this.filter('lowpass', cutoff || 2200, 0.7), g = this.env(t, vol, 0.015, dur);
    f.connect(g);
    freqs.forEach(function (fr, i) {
      var o = self.osc(type || 'triangle', fr, t, dur + 0.1);
      o.detune.value = (i % 2 ? 6 : -6);
      o.connect(f);
    });
  };
  Kit.prototype.pluck = function (t, freq, vol) {
    var o = this.osc('square', freq, t, 0.25), f = this.filter('lowpass', 3200, 3);
    f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.18);
    o.connect(f); f.connect(this.env(t, vol, 0.003, 0.18));
  };
  Kit.prototype.whoosh = function (t, vol) {
    var n = this.noiseSrc(t, 0.45), f = this.filter('bandpass', 600, 1.2);
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(5000, t + 0.35);
    n.connect(f); f.connect(this.env(t, vol, 0.12, 0.28));
  };
  Kit.prototype.riser = function (t0, t1, vol) {
    var n = this.noiseSrc(t0, t1 - t0), f = this.filter('bandpass', 400, 2);
    f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(7000, t1);
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t1); g.gain.linearRampToValueAtTime(0, t1 + 0.05);
    n.connect(f); f.connect(g); g.connect(this.out);
  };
  Kit.prototype.impact = function (t, vol) {
    var o = this.osc('sine', 90, t, 1.0); o.frequency.exponentialRampToValueAtTime(35, t + 0.6);
    o.connect(this.env(t, vol, 0.005, 0.9));
    var n = this.noiseSrc(t, 1.4), f = this.filter('highpass', 3000);
    n.connect(f); f.connect(this.env(t, vol * 0.45, 0.005, 1.2));
  };
  Kit.prototype.crackle = function (t, vol) {
    var n = this.noiseSrc(t, 0.02), f = this.filter('highpass', 2000);
    n.connect(f); f.connect(this.env(t, vol, 0.001, 0.01));
  };

  /* ------------------------------ composição ------------------------------ */

  /*
   * Agenda a trilha no contexto (normalmente um OfflineAudioContext) até `duration` segundos.
   * opts.cues = { changes: [t...], priceAt, endAt, speech: [[ini, fim]...] }; opts.level = volume (0–1)
   */
  function compose(ctx, dest, recipe, duration, opts) {
    opts = opts || {};
    var style = STYLES[recipe.style] ? recipe.style : 'pop';
    var bpm = recipe.bpm || STYLES[style].bpm;
    var r = rng(recipe.seed || 1);
    var tonic = TONIC[recipe.key] || 57;
    var prog = PROGS[style][Math.floor(r() * PROGS[style].length)];
    var spb = 60 / bpm, step = spb / 4, bar = spb * 4;
    var level = opts.level == null ? 0.5 : opts.level;

    /* barramento da música: filtro de abertura (o "drop" no começo), ducking sob a voz e fade no fim */
    var bus = ctx.createGain(), lp = ctx.createBiquadFilter(), master = ctx.createGain(), comp = ctx.createDynamicsCompressor();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, 0); lp.frequency.exponentialRampToValueAtTime(18000, 0.7);
    bus.connect(lp); lp.connect(master); master.connect(comp); comp.connect(dest);
    master.gain.setValueAtTime(level, 0);
    var cues = opts.cues || {};
    (cues.speech || []).forEach(function (s) {
      master.gain.setTargetAtTime(level * 0.42, Math.max(0, s[0] - 0.08), 0.05);
      master.gain.setTargetAtTime(level, s[1] + 0.05, 0.18);
    });
    master.gain.setTargetAtTime(0.0001, Math.max(0, duration - 1.1), 0.3);

    var kit = new Kit(ctx, bus);
    var fx = new Kit(ctx, comp); // efeitos não abaixam com a voz
    var hatOff = r() < 0.5, kickAlt = r() < 0.5, arpUp = r() < 0.5;

    for (var t0 = 0, b = 0; t0 < duration; t0 += bar, b += 1) {
      var ch = prog[b % prog.length];
      var root = tonic + ch[0];
      var notes = SHAPES[ch[1]].map(function (iv) { return hz(root + iv); });
      var bassF = hz(root - 24);
      for (var s = 0; s < 16; s += 1) {
        var t = t0 + s * step;
        if (t >= duration) break;
        var swing = style === 'lofi' && s % 2 ? step * 0.33 : 0;
        if (style === 'pop') {
          if (s % 4 === 0 || (kickAlt && s === 10)) kit.kick(t, 0.9);
          if (s === 4 || s === 12) kit.snare(t, 0.45);
          if (s % 2 === 0) kit.hat(t, s % 4 ? 0.12 : 0.18, hatOff && s % 4 === 2);
          if (s === 0 || s === 6 || s === 8 || s === 11) kit.bass(t, bassF, step * 2.5, 0.35);
          if (s === 2 || s === 6 || s === 10 || s === 14) kit.chord(t, notes, step * 1.4, 0.07, 'triangle', 2600);
        } else if (style === 'lofi') {
          if (s === 0 || s === 10 || (kickAlt && s === 7)) kit.kick(t, 0.7, true);
          if (s === 4 || s === 12) kit.snare(t, 0.22, true);
          if (s % 2 === 0) kit.hat(t + swing, 0.07, false);
          if (s === 0 || s === 8) kit.bass(t, bassF, step * 6, 0.3, 'sine');
          if (s === 0) kit.chord(t, notes, bar * 0.95, 0.09, 'sine', 1300);
          if (s % 3 === 0 && r() < 0.35) kit.crackle(t + r() * step, 0.03);
        } else {
          if (s % 4 === 0) kit.kick(t, 1.0);
          if (s === 4 || s === 12) kit.snare(t, 0.5);
          kit.hat(t, s % 2 ? 0.08 : 0.13, s % 4 === 2);
          if (s % 4 === 2) kit.bass(t, bassF, step * 1.6, 0.42);
          var arp = notes.concat([notes[0] * 2]);
          var idx = arpUp ? s % arp.length : (arp.length - 1 - (s % arp.length));
          if (b % 2 === 1 || s % 2 === 0) kit.pluck(t, arp[idx] * 2, 0.06);
        }
      }
    }
    /* efeitos sincronizados com o vídeo */
    (cues.changes || []).forEach(function (t) { if (t > 0.3 && t < duration - 0.5) fx.whoosh(Math.max(0, t - 0.18), 0.16 * (level / 0.5)); });
    if (cues.priceAt) {
      fx.riser(Math.max(0, cues.priceAt - 1.6), cues.priceAt, 0.22 * (level / 0.5));
      fx.impact(cues.priceAt, 0.6 * (level / 0.5));
    }
    if (cues.endAt) fx.impact(cues.endAt, 0.35 * (level / 0.5));
  }

  /* Só a música (amostra / prévia). */
  function render(recipe, duration, sampleRate) {
    var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var rate = sampleRate || 44100;
    var ctx = new Off(1, Math.ceil(duration * rate), rate);
    compose(ctx, ctx.destination, recipe, duration, { level: 0.7 });
    return ctx.startRendering();
  }

  /* Voz + música mixadas (para o vídeo). */
  function mix(voice, recipe, cues, level) {
    var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var rate = voice.sampleRate, duration = voice.duration;
    var ctx = new Off(1, voice.length, rate);
    var v = ctx.createBufferSource(); v.buffer = voice; v.connect(ctx.destination); v.start(0);
    if (recipe) compose(ctx, ctx.destination, recipe, duration, { level: level, cues: cues });
    return ctx.startRendering();
  }

  /* AudioBuffer → WAV 16 bits (mono) */
  function toWav(buf) {
    var data = buf.getChannelData(0), n = data.length, out = new DataView(new ArrayBuffer(44 + n * 2));
    var w = function (o, s) { for (var i = 0; i < s.length; i += 1) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * 2, true);
    out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i += 1) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true);
    return new Blob([out], { type: 'audio/wav' });
  }

  function randomRecipe(style) {
    var st = STYLES[style] ? style : 'pop';
    var keys = Object.keys(TONIC);
    return { style: st, bpm: STYLES[st].bpm + Math.round((Math.random() - 0.5) * 8), key: keys[Math.floor(Math.random() * keys.length)], seed: 1 + Math.floor(Math.random() * 999998) };
  }

  window.AkyllaMusic = { STYLES: STYLES, compose: compose, render: render, mix: mix, toWav: toWav, randomRecipe: randomRecipe };
})();
