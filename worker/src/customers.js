/*
 * Cadastro de clientes (sem senha): a ficha é identificada pelo WhatsApp.
 * - Criada/atualizada sozinha a cada pedido (nome, e-mail, bairro/cidade, primeiro e último pedido, origem).
 * - No painel (aba Clientes): editar, etiquetas, observações, consentimento para ofertas (LGPD),
 *   cadastrar cliente manualmente (venda presencial) e excluir a ficha a pedido do cliente.
 *
 * KV: cliente:<DDD+número>  (ex.: cliente:62991657619)
 */

export class CustomerError extends Error {
  constructor(message, status) { super(message); this.status = status || 400; }
}

/* "+55 (62) 99165-7619" → "62991657619" (sem o 55) */
export function phoneKey(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d.length >= 10 && d.length <= 11 ? d : '';
}

function clean(s, max) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function cleanTags(list) {
  const arr = Array.isArray(list) ? list : String(list || '').split(',');
  const out = [];
  arr.forEach((t) => { const v = clean(t, 20); if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v); });
  return out.slice(0, 8);
}

/* Chamado quando um pedido é criado: cria ou atualiza a ficha (não sobrescreve o que o painel editou). */
export async function upsertFromOrder(env, order) {
  const key = phoneKey(order.customer && order.customer.phone);
  if (!key) return null;
  const now = order.createdAt || Date.now();
  const old = (await env.ORDERS.get('cliente:' + key, 'json')) || null;
  const d = order.shipping || {};
  const a = (d.quote && d.quote.address) || d.address || {};
  const rec = old || { phone: key, createdAt: now, firstOrderAt: now, orders: 0, tags: [], notes: '', optIn: false, origin: order.origin || '' };
  if (!old || !old.edited) rec.name = clean(order.customer.name, 80) || rec.name || '';
  /* e-mail real do cliente (o servidor usa um e-mail interno @akyllashop.com quando o cliente não informa) */
  if (order.email && !/@akyllashop\.com$/i.test(order.email) && !rec.email) rec.email = clean(order.email, 120);
  if (order.marketingOptIn && !rec.optIn) { rec.optIn = true; rec.optInAt = now; rec.optInSource = 'checkout'; }
  if (a.city) { rec.city = clean(a.city, 60); rec.district = clean(a.district, 60); }
  rec.orders = (rec.orders || 0) + 1;
  rec.lastOrderAt = now;
  rec.updatedAt = Date.now();
  await env.ORDERS.put('cliente:' + key, JSON.stringify(rec));
  return rec;
}

export async function listCustomers(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.ORDERS.list({ prefix: 'cliente:', cursor });
    page.keys.forEach((k) => keys.push(k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && keys.length < 2000);
  const recs = await Promise.all(keys.map((k) => env.ORDERS.get(k, 'json')));
  return { customers: recs.filter(Boolean) };
}

/* Painel: cria ou edita uma ficha. */
export async function saveCustomer(env, body) {
  const key = phoneKey(body.phone);
  if (!key) throw new CustomerError('Informe o WhatsApp com DDD (10 ou 11 números).');
  const name = clean(body.name, 80);
  if (name.length < 2) throw new CustomerError('Informe o nome do cliente.');
  const email = clean(body.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CustomerError('E-mail inválido.');
  const old = (await env.ORDERS.get('cliente:' + key, 'json')) || { phone: key, createdAt: Date.now(), orders: 0, manual: true };
  const rec = {
    ...old,
    name,
    email,
    notes: clean(body.notes, 500),
    tags: cleanTags(body.tags),
    optIn: !!body.optIn,
    city: body.city != null ? clean(body.city, 60) : old.city || '',
    district: body.district != null ? clean(body.district, 60) : old.district || '',
    edited: true,
    updatedAt: Date.now()
  };
  if (rec.optIn && !old.optIn) rec.optInAt = Date.now();
  await env.ORDERS.put('cliente:' + key, JSON.stringify(rec));
  return { customer: rec };
}

/* Painel: exclui a ficha (LGPD: o cliente pode pedir). Os pedidos continuam no histórico de vendas. */
export async function deleteCustomer(env, phone) {
  const key = phoneKey(phone);
  if (!key) throw new CustomerError('Cliente inválido.', 404);
  await env.ORDERS.delete('cliente:' + key);
  return { ok: true };
}
