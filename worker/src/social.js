/*
 * Publicação nas redes (Instagram + Facebook) pelo painel, via API oficial da Meta (Graph API), sem custo.
 *
 * Precisa de UM segredo na Cloudflare: META_PAGE_TOKEN — token de acesso da PÁGINA do Facebook
 * (permissões pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish).
 * O Instagram precisa ser conta profissional ligada a essa Página. O passo a passo está no README (seção 10.2).
 *
 * Como funciona: o painel envia a arte (JPEG, POST /api/admin/social/media) → o servidor guarda por 1 dia no KV
 * e serve num endereço público (/api/media/…) → o painel pede a publicação (POST /api/admin/social/publish)
 * → a Meta busca a imagem nesse endereço e publica.
 */

const GRAPH = 'https://graph.facebook.com/';

export class SocialError extends Error {
  constructor(message, status) { super(message); this.status = status || 400; }
}

function version(env) { return env.META_GRAPH_VERSION || 'v23.0'; }

async function graph(env, path, params, method) {
  const url = new URL(GRAPH + version(env) + '/' + path.replace(/^\//, ''));
  const body = new URLSearchParams({ ...(params || {}), access_token: env.META_PAGE_TOKEN });
  const res = method === 'GET'
    ? await fetch(url.toString() + '?' + body.toString())
    : await fetch(url.toString(), { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    const err = new SocialError(e.error_user_msg || e.message || ('Meta ' + res.status), res.status >= 500 ? 502 : 400);
    err.code = e.code;
    throw err;
  }
  return data;
}

/* Página e Instagram ligados ao token (guardado em memória por 10 min). */
let accountCache = null;
export async function socialAccounts(env) {
  if (!env.META_PAGE_TOKEN) return { configured: false };
  if (accountCache && Date.now() - accountCache.at < 600000) return accountCache.data;
  const me = await graph(env, 'me', { fields: 'id,name,link,instagram_business_account{id,username}' }, 'GET');
  const ig = me.instagram_business_account || null;
  const data = {
    configured: true,
    facebook: { id: me.id, name: me.name, link: me.link || '' },
    instagram: ig ? { id: ig.id, username: ig.username } : null
  };
  accountCache = { at: Date.now(), data };
  return data;
}

function mediaId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/* Instagram: cria o contêiner, espera ficar pronto e publica. */
async function igPublish(env, igId, params) {
  const container = await graph(env, igId + '/media', params);
  for (let i = 0; i < 6; i += 1) {
    const st = await graph(env, container.id, { fields: 'status_code' }, 'GET').catch(() => ({}));
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR') throw new SocialError('O Instagram recusou a imagem (formato ou proporção).');
    await new Promise((r) => setTimeout(r, 1500));
  }
  const pub = await graph(env, igId + '/media_publish', { creation_id: container.id });
  const info = await graph(env, pub.id, { fields: 'permalink' }, 'GET').catch(() => ({}));
  return { id: pub.id, link: info.permalink || '' };
}

/*
 * targets: 'instagram' (feed), 'instagram_story', 'facebook' (feed da Página), 'facebook_story'.
 * O Instagram só aceita no feed proporções entre 4:5 e 1,91:1 — 9:16 vai como Story.
 */
export async function socialPublish(env, body, origin) {
  const acc = await socialAccounts(env);
  if (!acc.configured) throw new SocialError('Publicação nas redes ainda não configurada (falta o token da Meta no servidor).', 409);
  const targets = Array.isArray(body.targets) ? body.targets.filter((t) => ['instagram', 'instagram_story', 'facebook', 'facebook_story'].includes(t)) : [];
  if (!targets.length) throw new SocialError('Escolha onde publicar.');
  if ((targets.includes('instagram') || targets.includes('instagram_story')) && !acc.instagram) {
    throw new SocialError('O Instagram não está ligado à Página do Facebook (precisa ser conta profissional ligada à Página).', 409);
  }
  const id = String(body.mediaId || '');
  if (!/^[0-9a-f]{24}$/.test(id) || !(await env.ORDERS.get('media:' + id, 'stream'))) throw new SocialError('Arte não encontrada. Gere e envie de novo.');
  const imageUrl = origin + '/api/media/' + id + '.jpg';
  const caption = String(body.caption || '').slice(0, 2200);
  const fbCaption = String(body.facebookCaption || caption).slice(0, 5000);

  const results = {};
  for (const t of targets) {
    try {
      if (t === 'instagram') results[t] = await igPublish(env, acc.instagram.id, { image_url: imageUrl, caption });
      else if (t === 'instagram_story') results[t] = await igPublish(env, acc.instagram.id, { image_url: imageUrl, media_type: 'STORIES' });
      else if (t === 'facebook') {
        const r = await graph(env, acc.facebook.id + '/photos', { url: imageUrl, caption: fbCaption, published: 'true' });
        results[t] = { id: r.post_id || r.id, link: r.post_id ? 'https://www.facebook.com/' + r.post_id : '' };
      } else if (t === 'facebook_story') {
        const photo = await graph(env, acc.facebook.id + '/photos', { url: imageUrl, published: 'false' });
        const r = await graph(env, acc.facebook.id + '/photo_stories', { photo_id: photo.id });
        results[t] = { id: r.post_id || photo.id, link: '' };
      }
    } catch (err) {
      results[t] = { error: String(err.message || err) };
    }
  }
  return { ok: Object.values(results).some((r) => !r.error), results };
}

/* Recebe a arte (corpo = JPEG puro, sem conversão: economiza processamento no plano grátis). */
export async function socialUpload(env, request) {
  if (!/^image\/jpeg/.test(request.headers.get('Content-Type') || '')) throw new SocialError('Envie a arte em JPEG.');
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 8 * 1024 * 1024) throw new SocialError('Arte vazia ou grande demais (máx. 8 MB).');
  const id = mediaId();
  await env.ORDERS.put('media:' + id, bytes, { expirationTtl: 86400 });
  return { mediaId: id };
}

/* Imagem temporária para a Meta buscar (pública, some em 1 dia). */
export async function socialMedia(env, id) {
  if (!/^[0-9a-f]{24}$/.test(id)) return new Response('not found', { status: 404 });
  const bytes = await env.ORDERS.get('media:' + id, 'arrayBuffer');
  if (!bytes) return new Response('not found', { status: 404 });
  return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
}
