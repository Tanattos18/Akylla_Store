/*
 * Gera os anúncios 9:16 (1080x1920, PNG) dos produtos para Instagram/Facebook (Stories/Reels).
 *
 * Uso (na raiz do projeto):
 *   node ferramentas/anuncios/gerar.js            → todos os anúncios de anuncios.js
 *   node ferramentas/anuncios/gerar.js 02 05      → só os números escolhidos
 *
 * Precisa de: Node 18+, Python 3 com Pillow (pip install pillow) e Microsoft Edge ou Google Chrome.
 * Saída: pasta Banner_Itens_Loja/ na raiz (fica fora do GitHub, ver .gitignore).
 * Preço e promoção vêm do catálogo (assets/js/products.js e config.js) — gere de novo quando mudarem.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { page, ROOT } = require('./modelo');
const ADS = require('./anuncios');

const WORK = path.join(__dirname, '.trabalho');
const OUT = path.join(ROOT, 'Banner_Itens_Loja');
const BROWSERS = [
  process.env.NAVEGADOR,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean);
const BROWSER = BROWSERS.find((p) => fs.existsSync(p));
if (!BROWSER) throw new Error('Instale o Microsoft Edge ou o Google Chrome (ou informe o caminho na variável NAVEGADOR).');

const PY = process.platform === 'win32' ? 'python' : 'python3';
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
/* fontes e logo do site usados no anúncio */
fs.copyFileSync(path.join(ROOT, 'assets/fonts/dm-sans-latin.woff2'), path.join(WORK, 'dm-sans-latin.woff2'));
fs.copyFileSync(path.join(ROOT, 'assets/fonts/sora-latin.woff2'), path.join(WORK, 'sora-latin.woff2'));
fs.copyFileSync(path.join(ROOT, 'assets/img/logo-mark.jpg'), path.join(WORK, 'logo-mark.jpg'));

const wanted = process.argv.slice(2);
ADS.filter((a) => !wanted.length || wanted.includes(a.n)).forEach((ad) => {
  fs.writeFileSync(path.join(WORK, ad.slug + '.html'), page(ad));
  /* recorte: 'cut' (produto escuro em fundo branco), 'holes' (também tira brancos internos), 'card' (foto no cartão branco) */
  const mode = ad.card ? 'card' : ad.holes ? 'holes' : 'cut';
  const jobs = [[ad.heroSrc, path.join(WORK, ad.slug + '-hero.png'), mode]];
  if (ad.comboSrc) jobs.push([ad.comboSrc, path.join(WORK, ad.slug + '-combo.png'), mode]);
  execFileSync(PY, [path.join(__dirname, 'recorte.py'), JSON.stringify(jobs)], { stdio: 'inherit' });

  /* desenha em 2x e reduz para 1080x1920: textos mais nítidos */
  const shot = path.join(WORK, ad.slug + '@2x.png');
  try { fs.unlinkSync(shot); } catch (e) { /* ainda não existia */ }
  try {
    execFileSync(BROWSER, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
      '--virtual-time-budget=8000', '--window-size=1080,1920', '--user-data-dir=' + path.join(WORK, 'perfil-navegador'),
      '--screenshot=' + shot, 'file:///' + path.join(WORK, ad.slug + '.html').replace(/\\/g, '/')], { stdio: 'ignore' });
  } catch (e) { /* o navegador às vezes sai com erro mesmo gravando a imagem */ }
  for (let i = 0; i < 60 && !fs.existsSync(shot); i++) sleep(500);
  if (!fs.existsSync(shot)) throw new Error('O navegador não gerou a imagem de ' + ad.slug);

  const final = path.join(OUT, ad.n + ' -Anuncio_' + ad.slug + '_9x16.png');
  execFileSync(PY, ['-c', 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGB").resize((1080,1920),Image.LANCZOS)\nim.save(sys.argv[2],optimize=True)', shot, final]);
  console.log('ok', path.relative(ROOT, final));
});
