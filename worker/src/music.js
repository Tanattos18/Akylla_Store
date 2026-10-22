/*
 * Biblioteca de trilhas (músicas próprias, compostas pelo painel: sem direito autoral de terceiros).
 * Cada trilha é guardada no KV como "receita" (estilo, BPM, tom, semente) — com ela o painel recria a MESMA
 * música em qualquer duração, sincronizada com o vídeo — e uma amostra em áudio (WAV) para ouvir.
 *
 *   music:list          [{ id, name, style, bpm, key, seed, createdAt, hasAudio }]   (índice da biblioteca)
 *   musicfile:<id>      amostra em WAV
 */

export class MusicError extends Error {
  constructor(message, status) { super(message); this.status = status || 400; }
}

const STYLES = ['pop', 'lofi', 'hype'];
const KEYS = ['A', 'C', 'D', 'E', 'G'];
const MAX_TRACKS = 60;

async function readList(env) { return (await env.ORDERS.get('music:list', 'json')) || []; }

function cleanTrack(body) {
  const style = STYLES.includes(body.style) ? body.style : 'pop';
  const bpm = Math.max(70, Math.min(150, Math.round(Number(body.bpm) || 0))) || 118;
  const key = KEYS.includes(body.key) ? body.key : 'A';
  const seed = Math.max(1, Math.min(999999, Math.round(Number(body.seed) || 1)));
  const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  if (!name) throw new MusicError('Dê um nome para a trilha.');
  return { style, bpm, key, seed, name };
}

export async function musicList(env) {
  return { tracks: await readList(env) };
}

export async function musicSave(env, body) {
  const t = cleanTrack(body || {});
  const list = await readList(env);
  if (list.length >= MAX_TRACKS) throw new MusicError('A biblioteca chegou a ' + MAX_TRACKS + ' trilhas. Apague alguma antes.', 409);
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const track = { id, ...t, createdAt: Date.now(), hasAudio: false };
  list.unshift(track);
  await env.ORDERS.put('music:list', JSON.stringify(list));
  return { track };
}

export async function musicUploadAudio(env, id, request) {
  if (!/^[0-9a-f]{16}$/.test(id)) throw new MusicError('Trilha inválida.', 404);
  if (!/^audio\/(wav|x-wav|wave)/.test(request.headers.get('Content-Type') || '')) throw new MusicError('Envie a amostra em WAV.');
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 6 * 1024 * 1024) throw new MusicError('Amostra vazia ou grande demais (máx. 6 MB).');
  const list = await readList(env);
  const track = list.find((t) => t.id === id);
  if (!track) throw new MusicError('Trilha não encontrada.', 404);
  await env.ORDERS.put('musicfile:' + id, bytes);
  if (!track.hasAudio) { track.hasAudio = true; await env.ORDERS.put('music:list', JSON.stringify(list)); }
  return { ok: true };
}

export async function musicAudio(env, id) {
  if (!/^[0-9a-f]{16}$/.test(id)) throw new MusicError('Trilha inválida.', 404);
  const bytes = await env.ORDERS.get('musicfile:' + id, 'arrayBuffer');
  if (!bytes) throw new MusicError('Esta trilha não tem amostra salva.', 404);
  return new Response(bytes, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=3600' } });
}

export async function musicDelete(env, id) {
  const list = await readList(env);
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) throw new MusicError('Trilha não encontrada.', 404);
  await env.ORDERS.put('music:list', JSON.stringify(next));
  await env.ORDERS.delete('musicfile:' + id);
  return { ok: true };
}
