/* Monta o HTML de cada anúncio 9:16 (usado por gerar.js). Visual: estilo.css.txt; textos: anuncios.js. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
global.window = global;
require(path.join(ROOT, 'assets/js/config.js'));
require(path.join(ROOT, 'assets/js/products.js'));
const Promo = require(path.join(ROOT, 'assets/js/promo.js'));
const CONFIG = window.AKYLLA_CONFIG;
const PRODUCTS = window.AKYLLA_PRODUCTS;

let css = fs.readFileSync(path.join(__dirname, 'estilo.css.txt'), 'utf8');
css = css.replace('.hero img { position: absolute; left: 20px; top: 40px; width: 610px;',
  '.hero img { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: 620px; max-height: 470px;');
css = css.replace('</style>', `
.hero.tall { top: 440px; height: 520px; }
.hero.tall img { max-height: 520px; max-width: 560px; }
.combo img { max-height: 250px; object-fit: contain; }
.ring { flex: none; width: 230px; height: 230px; margin: 0 20px; border-radius: 50%; border: 6px solid var(--o2); display: grid; place-items: center; background: radial-gradient(circle, #1b1f2a, #0b0d13); box-shadow: 0 0 40px rgba(255,94,0,.4); }
.ring svg { width: 120px; height: 120px; stroke: #fff; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.card .hero img, .card .combo img { filter: none !important; background: #fff; border-radius: 28px; padding: 14px; box-shadow: 0 0 0 4px rgba(255,138,0,.85), 0 0 50px rgba(255,120,0,.45); }
.card .hero img { max-height: 450px; max-width: 450px; }
.card .combo img { max-width: 230px; max-height: 230px; margin: 0 10px; }
</style>`);

const I = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  wifi: '<path d="M5 12a10 10 0 0 1 14 0"/><path d="M8 15a6 6 0 0 1 8 0"/><circle cx="12" cy="18.5" r="1.2"/><path d="M2 9a14.5 14.5 0 0 1 20 0"/>',
  fold: '<path d="M4 4l6 6M20 4l-6 6M4 20l6-6M20 20l-6-6"/><rect x="9" y="9" width="6" height="6" rx="1.5"/><path d="M2 4h4M18 4h4M2 20h4M18 20h4"/>',
  arrows: '<path d="M3 12h18"/><path d="M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3"/><path d="M11.5 9l-2.5 3.5h4L10.5 15"/>',
  person: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  plug: '<path d="M9 3v4M15 3v4"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
  bluetooth: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M6 12h3l1.5-2.5 2 5 1.5-2.5h4"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  nfc: '<path d="M8 7a7 7 0 0 1 0 10"/><path d="M12 4a11 11 0 0 1 0 16"/><path d="M16 2a14 14 0 0 1 0 20"/><path d="M4 10a3 3 0 0 1 0 4"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  run: '<circle cx="14" cy="4.5" r="1.8"/><path d="M7 21l3.5-6 3 2.5V22"/><path d="M5 11.5l3.5-3.5 5 1 3 4h3"/><path d="M10.5 15L9.5 9"/>',
  cable: '<path d="M8 3v3M12 3v3"/><path d="M6 6h8v4a4 4 0 0 1-8 0z"/><path d="M10 14v2a4 4 0 0 0 8 0V9"/><path d="M16 6h4v3h-4z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  usb: '<circle cx="12" cy="19" r="2"/><path d="M12 17V3"/><path d="M10 5.5L12 3l2 2.5"/><path d="M12 14l-4.5-2.5V8"/><path d="M12 12l4.5-2.5V7"/><rect x="6" y="6" width="3" height="2"/><circle cx="16.5" cy="6" r="1.2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  case: '<rect x="4" y="8" width="16" height="12" rx="4"/><path d="M4 12h16"/><circle cx="12" cy="16" r="1"/>',
  voice: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9v3M11 8v5M14 9.5v2M17 9v3"/>',
  watch: '<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3"/><path d="M12 9.5V12l1.5 1"/>',
  strap: '<rect x="5" y="3" width="4" height="18" rx="2"/><rect x="10" y="3" width="4" height="18" rx="2"/><rect x="15" y="3" width="4" height="18" rx="2"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  magnet: '<path d="M5 4h4v8a3 3 0 0 0 6 0V4h4v8a7 7 0 0 1-14 0z"/><path d="M5 8h4M15 8h4"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><path d="M10 10h4v4h-4z"/>',
  ports: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7h8M8 11h8M8 15h8"/>',
  noise: '<path d="M3 12h2l2-5 3 10 3-14 3 12 2-3h3"/>',
  display: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6M12 17v4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  smartphone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'
};
const svg = (name) => `<svg viewBox="0 0 24 24">${I[name]}</svg>`;

function money(cents) {
  const r = Math.floor(cents / 100);
  return { int: r.toLocaleString('pt-BR'), dec: String(cents % 100).padStart(2, '0') };
}
function brl(cents) { const m = money(cents); return 'R$ ' + m.int + ',' + m.dec; }

function page(ad) {
  const p = PRODUCTS.find((x) => x.id === ad.id);
  if (!p) throw new Error('produto não encontrado: ' + ad.id);
  const pr = Promo.priceFor(p, CONFIG);
  const now = money(pr.price);
  const promoOn = pr.price < pr.original;
  const until = pr.until ? pr.until.slice(8, 10) + '/' + pr.until.slice(5, 7) : '';
  const imgs = [p.image].concat(p.gallery || []);
  ad.heroSrc = path.join(ROOT, imgs[ad.hero]);
  if (ad.combo.img != null) ad.comboSrc = path.join(ROOT, imgs[ad.combo.img]);

  const specs = ad.specs.map(([ic, b, s]) => `<div class="spec"><div class="ic">${svg(ic)}</div><p><b>${b}</b><small>${s}</small></p></div>`).join('\n  ');
  const feats = ad.feats.map(([ic, t]) => `<div class="feat">${svg(ic)}<p>${t}</p></div>`).join('\n  ');
  const comboVisual = ad.combo.img != null ? `<img src="${ad.slug}-combo.png" alt="">` : `<div class="ring">${svg(ad.combo.icon)}</div>`;
  const checks = ad.checks.concat(['Retirada na loja ou entrega em Goiânia e região']).map((c) => `<li>${c}</li>`).join('\n  ');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kalam:wght@700&display=block" rel="stylesheet">
${css}
</head>
<body class="${ad.card ? 'card' : ''}">
<header class="top">
  <div class="brand"><img src="logo-mark.jpg" alt=""><span>AKYLLA SHOP</span></div>
  <h1 id="title">${ad.title[0]} <em>${ad.title[1]}</em></h1>
  <div class="model">${ad.model}</div>
  <p class="sub">${ad.sub}</p>
</header>
<div class="hand h1">${ad.hand}</div>

<div class="hero${ad.tall ? ' tall' : ''}${ad.light ? ' light' : ''}"><img src="${ad.slug}-hero.png" alt=""></div>

<div class="specs">
  ${specs}
</div>

<div class="combo${ad.light ? ' light' : ''}">
  ${comboVisual}
  <div>
    <div class="big" id="big">${ad.combo.big}</div>
    <div class="t2">${ad.combo.t2}</div>
    <p>${ad.combo.p}</p>
  </div>
</div>

<div class="feats">
  ${feats}
</div>

<div class="price">
  <div class="lab">${promoOn ? 'Oferta de inauguração' : 'Preço especial'}</div>
  <div class="de">${promoOn ? 'de <s>' + brl(pr.original) + '</s> por' : 'à vista'}</div>
  <div class="por"><small>R$</small><strong>${now.int}</strong><i>,${now.dec}</i></div>
  <div class="pix">no PIX</div>
</div>
<ul class="checks">
  ${checks}
</ul>

<div class="cta">
  <svg viewBox="0 0 24 24"><path d="M6 6h15l-1.5 8H7.5z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="19" r="1.6"/><circle cx="18" cy="19" r="1.6"/></svg>
  <div><b>COMPRE AGORA</b><span>akyllashop.com · (62) 8151-7002</span></div>
</div>
<div class="hand h2">${promoOn && until ? 'Oferta válida até ' + until + '!' : 'Não perca essa oportunidade!'}</div>
<div class="foot">Imagens ilustrativas. Estoque limitado.</div>
<script>
/* encolhe títulos longos para caber na largura */
function fit(id, max) { var e = document.getElementById(id); var s = parseFloat(getComputedStyle(e).fontSize); e.style.whiteSpace = 'nowrap'; e.style.display = 'inline-block'; while (e.scrollWidth > max && s > 30) { s -= 2; e.style.fontSize = s + 'px'; } }
document.fonts.ready.then(function () { fit('title', 620); fit('big', 330); });
</script>
</body>
</html>`;
}

module.exports = { page, PRODUCTS, ROOT };
