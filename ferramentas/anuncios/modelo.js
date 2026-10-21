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

const I = require('./icones');
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
