/* Prepara os dados do vídeo institucional (promo.py): preços atuais, fotos recortadas e textos. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
global.window = global;
require(path.join(ROOT, 'assets/js/config.js'));
require(path.join(ROOT, 'assets/js/products.js'));
const Promo = require(path.join(ROOT, 'assets/js/promo.js'));
const ADS = require(path.join(ROOT, 'ferramentas/anuncios/anuncios.js'));
const C = window.AKYLLA_CONFIG, P = window.AKYLLA_PRODUCTS;
const OUT = path.join(__dirname, '.trabalho', 'promo');
fs.mkdirSync(OUT, { recursive: true });
const brl = (c) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
const SHOW = (process.env.VITRINE || 'drone-wrj12618,w69-ultra,hw8-pro-max,fone-bluetooth-fon6694,carregador-wall-35w').split(',');
const CATS = (process.env.CATEGORIAS || 'w34-plus,fone-kapbom-ka9068,drone-wrj12619,power-bank-pocket,carregador-wall-35w,cabo-tipo-c-60w').split(',');
const jobs = [];
function piece(id) {
  const p = P.find((x) => x.id === id);
  if (!p) throw new Error('produto não encontrado: ' + id);
  const ad = ADS.find((a) => a.id === id) || { hero: 0 };
  const imgs = [p.image].concat(p.gallery || []);
  const mode = ad.card ? 'card' : ad.holes ? 'holes' : 'cut';
  const dst = path.join(OUT, id + '.png');
  if (!fs.existsSync(dst)) jobs.push([path.join(ROOT, imgs[ad.hero] || p.image), dst, mode]);
  const i = Promo.priceFor(p, C);
  const title = ad.title ? ad.title.filter(Boolean).join(' ') : p.shortName.toUpperCase(); // títulos dos anúncios (já em maiúsculas: DRONE PRO, HW8 PRO MAX)
  return { id, name: title, model: p.shortName, img: dst, card: mode === 'card', price: brl(i.price), original: brl(i.original), percent: i.price < i.original ? i.percent : 0 };
}
const data = {
  products: SHOW.map(piece),
  categories: CATS.map(piece),
  promo: C.promo && C.promo.active ? { text: C.promo.text, percent: C.promo.percent, until: (C.promo.until || '').slice(8, 10) + '/' + (C.promo.until || '').slice(5, 7) } : null,
  card: C.card && C.card.enabled ? C.card.maxInstallments : 0,
  whatsapp: C.whatsappDisplay, instagram: '@' + (C.instagram || 'akylla.shop'),
  logo: path.join(ROOT, 'assets/img/logo-akylla.webp'),
  music: path.join(OUT, 'trilha.wav')
};
if (jobs.length) execFileSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(ROOT, 'ferramentas/anuncios/recorte.py'), JSON.stringify(jobs)], { stdio: 'inherit' });
fs.writeFileSync(path.join(OUT, 'dados.json'), JSON.stringify(data, null, 2));
console.log('ok', data.products.map((p) => p.name + ' ' + p.price).join(' | '));
