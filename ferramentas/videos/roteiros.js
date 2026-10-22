/*
 * Roteiros dos vídeos (o que o personagem fala). Regra: só o que está na ficha do produto — nada inventado.
 *
 * Cada fala: { say: 'texto falado', scene: 'hook' | 'spec' | 'combo' | 'price' | 'cta', spec: índice da especificação (0-5) }
 * Usado pelo gerador do computador (gerar.mjs) e pela aba Artes do painel (navegador).
 * Produto sem roteiro próprio → roteiro automático montado com os textos do anúncio (ferramentas/anuncios/anuncios.js).
 * Preços entram sozinhos ({preco}, {de}, {cartao}) a partir do catálogo, para nunca ficarem desatualizados.
 */

var AKYLLA_ROTEIROS = {
  'drone-wrj12618': [
    { scene: 'hook', say: 'Para tudo! Olha esse drone que acabou de chegar na Akylla Shop!' },
    { scene: 'spec', spec: 0, say: 'Ele tem câmera HD, pra você fazer fotos e vídeos lá do alto.' },
    { scene: 'spec', spec: 1, say: 'Tem sensor de obstáculos, que ajuda a evitar batidas.' },
    { scene: 'spec', spec: 3, say: 'E é articulado: dobra e cabe na mochila.' },
    { scene: 'spec', spec: 4, say: 'A bateria é recarregável, e carrega pelo USB.' },
    { scene: 'combo', say: 'E o controle remoto já vem junto. É só tirar da caixa e voar!' },
    { scene: 'price', say: '{oferta}' },
    { scene: 'cta', say: 'Corre, que o estoque é limitado! Chama no WhatsApp ou compra no site. Link na bio!' }
  ]
};

/* Nome falado: "DRONE PRO" → "drone Pro"; evita ler códigos. */
function spokenName(ad) {
  return [ad.title[0], ad.title[1]].filter(Boolean).join(' ').toLowerCase().replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); });
}

function autoRoteiro(ad) {
  const lines = [{ scene: 'hook', say: 'Olha só o que chegou na Akylla Shop: ' + spokenName(ad) + '! ' + ad.hand }];
  ad.specs.slice(0, 4).forEach(([, b, s], i) => lines.push({ scene: 'spec', spec: i, say: b + (s ? ': ' + s : '') + '.' }));
  const c = ad.combo;
  lines.push({ scene: 'combo', say: (c.big + ' ' + c.t2).toLowerCase().replace(/^\S/, (m) => m.toUpperCase()) + '! ' + c.p.replace(/<br\s*\/?>/g, ' ') });
  lines.push({ scene: 'price', say: '{oferta}' });
  lines.push({ scene: 'cta', say: 'Corre, que o estoque é limitado! Chama no WhatsApp ou compra no site. Link na bio!' });
  return lines;
}

var AKYLLA_ROTEIRO_AUTO = autoRoteiro;
if (typeof module !== 'undefined') module.exports = { ROTEIROS: AKYLLA_ROTEIROS, autoRoteiro: autoRoteiro };
else { window.AKYLLA_ROTEIROS = AKYLLA_ROTEIROS; window.AKYLLA_ROTEIRO_AUTO = autoRoteiro; }
