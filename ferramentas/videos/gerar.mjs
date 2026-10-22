/*
 * Gera vídeos 9:16 (1080x1920, MP4) dos produtos no estilo TikTok Shop:
 * o mascote da Akylla apresenta o produto falando em português (voz neural), com legendas palavra por palavra.
 *
 * Uso (na pasta ferramentas/videos, depois de "npm install" uma vez):
 *   node gerar.mjs 01               → vídeo do anúncio 01 (drone)
 *   node gerar.mjs 01 05 --voz=antonio
 *   node gerar.mjs todos
 * Vozes: francisca (padrão), thalita, antonio.
 *
 * Precisa de: Node 18+, Python 3 com Pillow, FFmpeg (winget install Gyan.FFmpeg) e internet (voz).
 * Usa as fotos recortadas e o anúncio 9:16 do mesmo número (rode antes: node ferramentas/anuncios/gerar.js NN).
 * Saída: Banner_Itens_Loja/Videos/NN -Video_<produto>_9x16.mp4 (fora do GitHub).
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
global.window = global;
require(path.join(ROOT, 'assets/js/config.js'));
require(path.join(ROOT, 'assets/js/products.js'));
const Promo = require(path.join(ROOT, 'assets/js/promo.js'));
const ADS = require(path.join(ROOT, 'ferramentas/anuncios/anuncios.js'));
const { ROTEIROS, autoRoteiro } = require('./roteiros.js');
const CONFIG = window.AKYLLA_CONFIG;
const PRODUCTS = window.AKYLLA_PRODUCTS;

const VOICES = { francisca: 'pt-BR-FranciscaNeural', thalita: 'pt-BR-ThalitaMultilingualNeural', antonio: 'pt-BR-AntonioNeural' };
const PY = process.platform === 'win32' ? 'python' : 'python3';
const WORK = path.join(HERE, '.trabalho');
const OUT = path.join(ROOT, 'Banner_Itens_Loja', 'Videos');
const ADS_WORK = path.join(ROOT, 'ferramentas', 'anuncios', '.trabalho');

function findFfmpeg() {
  const candidates = [process.env.FFMPEG, 'ffmpeg'];
  const pkgs = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(pkgs)) {
    fs.readdirSync(pkgs).filter((d) => /FFmpeg/i.test(d)).forEach((d) => {
      const base = path.join(pkgs, d);
      fs.readdirSync(base).forEach((sub) => candidates.push(path.join(base, sub, 'bin', 'ffmpeg.exe')));
    });
  }
  for (const c of candidates.filter(Boolean)) {
    try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c; } catch (e) { /* tenta o próximo */ }
  }
  throw new Error('FFmpeg não encontrado. Instale com: winget install Gyan.FFmpeg');
}

function brlSpoken(cents) { return 'R$ ' + (cents / 100).toFixed(2).replace('.', ','); }

function offerLine(p) {
  const pr = Promo.priceFor(p, CONFIG);
  const card = CONFIG.card && CONFIG.card.enabled ? ', ou em até ' + (CONFIG.card.maxInstallments || 12) + ' vezes no cartão' : '';
  return pr.price < pr.original
    ? 'Na promoção, de ' + brlSpoken(pr.original) + ' por apenas ' + brlSpoken(pr.price) + ' no PIX' + card + '!'
    : 'E sai por apenas ' + brlSpoken(pr.price) + ' no PIX' + card + '!';
}

async function speak(tts, text, dir, rate) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const r = await tts.toFile(dir, text, { rate });
  const meta = JSON.parse(fs.readFileSync(r.metadataFilePath, 'utf8')).Metadata || [];
  const words = meta.filter((m) => m.Type === 'WordBoundary').map((m) => ({
    text: m.Data.text.Text, start: m.Data.Offset / 1e7, end: (m.Data.Offset + m.Data.Duration) / 1e7
  }));
  return { mp3: r.audioFilePath, words };
}

async function makeVideo(ad, voiceKey, ffmpeg) {
  const p = PRODUCTS.find((x) => x.id === ad.id);
  if (!p) throw new Error('produto não encontrado: ' + ad.id);
  const adPng = path.join(ROOT, 'Banner_Itens_Loja', ad.n + ' -Anuncio_' + ad.slug + '_9x16.png');
  const hero = path.join(ADS_WORK, ad.slug + '-hero.png');
  if (!fs.existsSync(adPng) || !fs.existsSync(hero)) {
    console.log('  gerando antes o anúncio ' + ad.n + ' (fotos recortadas e peças da arte)…');
    execFileSync(process.execPath, [path.join(ROOT, 'ferramentas/anuncios/gerar.js'), ad.n], { stdio: 'inherit', cwd: ROOT });
  }
  const combo = path.join(ADS_WORK, ad.slug + '-combo.png');

  const lines = (ROTEIROS[ad.id] || autoRoteiro(ad)).map((l) => ({ ...l, say: l.say.replace('{oferta}', offerLine(p)) }));
  const job = path.join(WORK, ad.slug);
  fs.mkdirSync(job, { recursive: true });

  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICES[voiceKey] || VOICES.francisca, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
  const timeline = [];
  for (let i = 0; i < lines.length; i += 1) {
    process.stdout.write('  voz ' + (i + 1) + '/' + lines.length + '\r');
    const r = await speak(tts, lines[i].say, path.join(job, 'fala' + i), '+8%');
    const wav = path.join(job, 'fala' + i + '.wav');
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', r.mp3, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    timeline.push({ ...lines[i], wav, words: r.words });
  }
  tts.close();

  const pr = Promo.priceFor(p, CONFIG);
  const spec = {
    product: p.shortName, slug: ad.slug, adPng, hero, combo: fs.existsSync(combo) ? combo : null,
    card: !!ad.card, tall: !!ad.tall,
    specs: ad.specs.map((s) => s[1]),
    logo: path.join(ROOT, 'assets/img/logo-akylla.webp'),
    price: brlSpoken(pr.price), promo: pr.price < pr.original,
    lines: timeline
  };
  const specFile = path.join(job, 'video.json');
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2));
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, ad.n + ' -Video_' + ad.slug + '_9x16.mp4');
  execFileSync(PY, [path.join(HERE, 'render.py'), specFile, out, ffmpeg], { stdio: 'inherit' });
  return out;
}

const args = process.argv.slice(2);
const voice = (args.find((a) => a.startsWith('--voz=')) || '--voz=francisca').slice(6);
const wanted = args.filter((a) => !a.startsWith('--'));
const list = wanted.includes('todos') ? ADS : ADS.filter((a) => wanted.includes(a.n) || wanted.includes(a.id));
if (!list.length) {
  console.log('Diga qual vídeo gerar, ex.: node gerar.mjs 01   (ou "todos"). Números disponíveis: ' + ADS.map((a) => a.n).join(' '));
  process.exit(1);
}
const ffmpeg = findFfmpeg();
for (const ad of list) {
  console.log('Vídeo ' + ad.n + ' — ' + ad.slug);
  const out = await makeVideo(ad, voice, ffmpeg);
  console.log('  pronto: ' + path.relative(ROOT, out));
}
