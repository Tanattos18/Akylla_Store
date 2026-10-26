/*
 * Visitantes do site para o Início do painel: o servidor busca os números no Umami Cloud
 * com a chave secreta UMAMI_API_KEY (ela nunca vai para o navegador).
 * Site: UMAMI_WEBSITE_ID (wrangler.toml). A contagem começou em 26/10/2026.
 */

export class VisitorError extends Error {
  constructor(message, status) { super(message); this.status = status || 400; }
}

const UMAMI = 'https://api.umami.is/v1';
const COUNT_START = Date.UTC(2026, 9, 26, 3); // 26/10/2026 00:00 em Brasília
const MAX_RANGE = 400 * 86400000;

/* Umami v2 devolve { value, prev }; versões novas devolvem o número direto. */
function num(v) {
  if (v && typeof v === 'object') v = v.value;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function list(rows, limit) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({ name: String(r.x == null ? '' : r.x), count: num(r.y) }))
    .filter((r) => r.count > 0).slice(0, limit || 8);
}

async function umami(env, path, params) {
  const url = UMAMI + '/websites/' + env.UMAMI_WEBSITE_ID + path + '?' + new URLSearchParams(params).toString();
  const res = await fetch(url, { headers: { 'x-umami-api-key': env.UMAMI_API_KEY, Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new VisitorError('A chave do Umami foi recusada. Confira UMAMI_API_KEY.', 502);
  if (!res.ok) throw new VisitorError('O Umami não respondeu agora (erro ' + res.status + '). Tente de novo.', 502);
  return res.json();
}

export async function visitorStats(env, url) {
  if (!env.UMAMI_API_KEY || !/^[0-9a-f-]{36}$/i.test(String(env.UMAMI_WEBSITE_ID || ''))) {
    return { configured: false };
  }
  const now = Date.now();
  const endAt = now;
  let startAt = Math.floor(Number(url.searchParams.get('start')) || 0);
  startAt = Math.max(startAt, COUNT_START, endAt - MAX_RANGE);
  const hourly = endAt - startAt <= 36 * 3600000;
  const range = { startAt: String(startAt), endAt: String(endAt) };

  const [stats, active, series, referrers, devices, cities] = await Promise.all([
    umami(env, '/stats', range),
    umami(env, '/active', {}).catch(() => null),
    umami(env, '/pageviews', { ...range, unit: hourly ? 'hour' : 'day', timezone: 'America/Sao_Paulo' }).catch(() => null),
    umami(env, '/metrics', { ...range, type: 'referrer', limit: '8' }).catch(() => []),
    umami(env, '/metrics', { ...range, type: 'device', limit: '5' }).catch(() => []),
    umami(env, '/metrics', { ...range, type: 'city', limit: '8' }).catch(() => [])
  ]);

  const visits = num(stats.visits);
  const sessions = (series && Array.isArray(series.sessions)) ? series.sessions : [];
  return {
    configured: true,
    startAt,
    countStart: COUNT_START,
    totals: {
      visitors: num(stats.visitors),
      visits,
      pageviews: num(stats.pageviews),
      bounces: num(stats.bounces),
      avgSeconds: visits ? Math.round(num(stats.totaltime) / visits) : 0
    },
    active: active ? num(active.visitors != null ? active.visitors : active.x) : null,
    series: { unit: hourly ? 'hour' : 'day', points: sessions.map((p) => ({ at: String(p.x), visitors: num(p.y) })) },
    referrers: list(referrers, 8),
    devices: list(devices, 5),
    cities: list(cities, 8)
  };
}
