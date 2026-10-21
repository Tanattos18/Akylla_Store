/*
 * Regras de pedido do servidor (sem dependência da Cloudflare — testáveis no Node).
 * Usa os MESMOS arquivos do site para preço/promoção/frete, então site e servidor
 * nunca calculam valores diferentes.
 */
import Promo from '../../assets/js/promo.js';
import Frete from '../../assets/js/frete.js';
import Formato from '../../admin/formato.js';

export { Promo, Frete, Formato };

export class OrderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status || 400;
  }
}

/* O Worker roda em UTC; promoções valem pelo dia de Brasília (UTC−3). */
export function brazilNow(ms) {
  return new Date((ms == null ? Date.now() : ms) - 3 * 3600 * 1000);
}

export function newOrderId(ms) {
  const time = (ms == null ? Date.now() : ms).toString(36).slice(-6);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => (b % 36).toString(36)).join('');
  return ('AK-' + time + rand).toUpperCase();
}

/* Quantidade reservada por produto (pedidos aguardando pagamento). */
export function reservedByProduct(reservations) {
  const map = {};
  (reservations || []).forEach((r) => {
    (r.items || []).forEach((it) => { map[it.id] = (map[it.id] || 0) + it.qty; });
  });
  return map;
}

/*
 * Monta as linhas do pedido com preço do servidor.
 *   items: [{ id, qty }] vindos do cliente (só id e quantidade são aceitos)
 *   reserved: { id: qtdReservada } de outros pedidos pendentes
 */
export function buildLines({ products, config, items, reserved, now }) {
  if (!Array.isArray(items) || !items.length) throw new OrderError('Sua sacola está vazia.');
  if (items.length > 50) throw new OrderError('Pedido com itens demais.');
  const merged = {};
  items.forEach((it) => {
    const id = String(it && it.id || '');
    const qty = Math.floor(Number(it && it.qty));
    if (!id || !(qty > 0) || qty > 99) throw new OrderError('Quantidade inválida.');
    merged[id] = (merged[id] || 0) + qty;
  });

  const byId = {};
  products.forEach((p) => { byId[p.id] = p; });
  const lines = Object.keys(merged).map((id) => {
    const p = byId[id];
    if (!p || p.hidden) throw new OrderError('Um dos produtos não está mais disponível. Atualize a página.', 409);
    const free = Math.max(0, (Number(p.stock) || 0) - ((reserved && reserved[id]) || 0));
    if (merged[id] > free) {
      throw new OrderError(free > 0
        ? 'Temos só ' + free + (free === 1 ? ' unidade disponível' : ' unidades disponíveis') + ' de ' + p.shortName + ' agora.'
        : p.shortName + ' acabou de esgotar.', 409);
    }
    const info = Promo.priceFor(p, config, now);
    return { id, code: p.code, name: p.shortName, qty: merged[id], unit: info.price, original: info.original };
  });

  const subtotal = lines.reduce((t, l) => t + l.unit * l.qty, 0);
  const savings = lines.reduce((t, l) => t + (l.original - l.unit) * l.qty, 0);
  if (!(subtotal > 0)) throw new OrderError('Não foi possível calcular o pedido.');
  return { lines, subtotal, savings };
}

/*
 * Frete recalculado no servidor. delivery: { mode: 'pickup' } ou
 * { mode: 'delivery', cep, number, complement }.
 * Retorna { fee, label, quote } — fee 0 quando é retirada ou "a combinar"/transportadora.
 */
export async function serverShipping(delivery, config, quoteFn) {
  const d = delivery || {};
  if (d.mode === 'pickup') return { fee: 0, mode: 'pickup', label: 'Retirada na loja (grátis)' };
  if (d.mode !== 'delivery') throw new OrderError('Escolha retirada ou entrega.');
  const quote = await (quoteFn || Frete.quote)({ cep: d.cep, number: d.number }, config).catch((e) => {
    throw new OrderError(e && e.message ? e.message : 'Não foi possível calcular o frete.');
  });
  if (quote.kind === 'outside') throw new OrderError('Ainda não entregamos nesse endereço. Escolha a retirada ou fale no WhatsApp.');
  const fee = quote.kind === 'distance' || quote.kind === 'fixed' ? quote.fee : 0;
  return { fee, mode: 'delivery', kind: quote.kind, km: quote.km, precision: quote.precision, address: quote.address, complement: String(d.complement || '').slice(0, 120) };
}

/* Baixa o estoque dos itens vendidos. Retorna { products, warnings }. */
export function applySale(products, lines) {
  const warnings = [];
  const next = products.map((p) => ({ ...p }));
  lines.forEach((l) => {
    const p = next.find((x) => x.id === l.id);
    if (!p) { warnings.push('produto removido do catálogo: ' + l.name); return; }
    const before = Number(p.stock) || 0;
    if (l.qty > before) warnings.push(l.name + ': vendido ' + l.qty + ', havia ' + before + ' em estoque');
    p.stock = Math.max(0, before - l.qty);
  });
  return { products: next, warnings };
}

export function centsToReais(cents) {
  return Number((cents / 100).toFixed(2));
}

/* Data no formato do Mercado Pago com fuso de Brasília. */
export function mpDate(ms) {
  const d = new Date(ms - 3 * 3600 * 1000);
  return d.toISOString().replace('Z', '-03:00');
}

/* Dados do comprador (nome obrigatório; WhatsApp opcional). */
export function cleanCustomer(customer) {
  const c = customer || {};
  const name = String(c.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (name.length < 3) throw new OrderError('Informe seu nome completo para gerar o PIX.');
  const phone = String(c.phone || '').replace(/\D/g, '').slice(0, 13);
  return { name, phone: phone.length >= 10 ? phone : '' };
}

function brl(cents) {
  return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* Mensagem de venda para o WhatsApp da loja. */
export function saleMessage(order) {
  const when = new Date(order.paidAt || order.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const c = order.customer || {};
  const s = order.shipping || {};
  const a = s.address || {};
  const delivery = s.mode === 'pickup'
    ? 'Retirada na loja'
    : [a.street, a.number].filter(Boolean).join(', ') + (s.complement ? ' — ' + s.complement : '') + ' · ' + [a.district, (a.city || '') + '/' + (a.uf || '')].filter(Boolean).join(', ') + ' · CEP ' + (a.cep || '');
  const freight = s.mode === 'pickup' ? 'grátis (retirada)'
    : s.kind === 'carrier' ? 'TRANSPORTADORA — cotar (frete × 1,30)'
    : s.kind === 'negotiable' ? 'A COMBINAR'
    : brl(s.fee || 0) + (s.km ? ' (' + String(s.km).replace('.', ',') + ' km' + (s.precision && s.precision !== 'endereço' ? ', aprox. pela ' + s.precision : '') + ')' : '');
  const title = order.status === 'review' ? '⚠️ PAGAMENTO PARA CONFERIR' : '🛒 NOVA VENDA — Akylla Shop';
  return [
    title,
    '',
    'Pedido: ' + order.id,
    'Data: ' + when,
    'Cliente: ' + (c.name || '—') + (c.phone ? ' · WhatsApp ' + c.phone : ''),
    '',
    'Produtos:',
    ...order.lines.map((l) => '• ' + l.qty + 'x ' + l.name + ' (cód. ' + l.code + ') — ' + brl(l.unit * l.qty)),
    '',
    'Entrega: ' + delivery,
    'Frete: ' + freight,
    'TOTAL PAGO: ' + brl(order.total),
    'Mercado Pago: #' + order.paymentId,
    order.status === 'review' ? 'Motivo: ' + (order.reviewReason || '') : 'Estoque: ' + (order.stockUpdated ? 'baixado automaticamente' : 'NÃO atualizado — ' + (order.stockError || 'verifique no painel'))
  ].join('\n');
}
