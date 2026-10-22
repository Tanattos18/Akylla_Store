/*
 * Voz neural em português (as mesmas vozes do "Ler em voz alta" do Microsoft Edge), para os vídeos do painel.
 * O navegador não consegue falar direto com esse serviço; o servidor faz a ponte e devolve
 * o MP3 + o tempo de cada palavra (para as legendas). Grátis, sem chave — mas é um serviço não oficial:
 * se a Microsoft mudar, o vídeo no painel avisa e o gerador do computador (ferramentas/videos) segue como alternativa.
 */

const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'; // identificador público do Edge (não é segredo)
const WSS = 'https://api.msedgeservices.com/tts/cognitiveservices/websocket/v1';
const VERSION = '1-143.0.3650.96';
const VOICES = { francisca: 'pt-BR-FranciscaNeural', thalita: 'pt-BR-ThalitaMultilingualNeural', antonio: 'pt-BR-AntonioNeural' };

export class TtsError extends Error {
  constructor(message, status) { super(message); this.status = status || 502; }
}

async function secMsGec() {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const data = new TextEncoder().encode(String(rounded * 10000000) + TOKEN);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hex(n) { return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join(''); }

function xml(text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* Devolve { audio: Uint8Array (MP3 24 kHz), words: [{ text, start, end }] } */
export async function synthesize(body) {
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!text) throw new TtsError('Texto vazio.', 400);
  const voice = VOICES[body.voice] || VOICES.francisca;
  const rate = /^[+-]\d{1,2}%$/.test(body.rate || '') ? body.rate : '+8%';

  const url = WSS + '?Ocp-Apim-Subscription-Key=' + TOKEN + '&Sec-MS-GEC=' + (await secMsGec()) +
    '&Sec-MS-GEC-Version=' + VERSION + '&ConnectionId=' + hex(16);
  const res = await fetch(url, {
    headers: {
      Upgrade: 'websocket',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
      Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      Pragma: 'no-cache',
      'Cache-Control': 'no-cache'
    }
  });
  const ws = res.webSocket;
  if (!ws) throw new TtsError('O serviço de voz recusou a conexão (' + res.status + '). Tente de novo mais tarde.');
  ws.accept();

  const chunks = [];
  const words = [];
  const reqId = hex(16);
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TtsError('O serviço de voz demorou demais.')), 25000);
    ws.addEventListener('message', (ev) => {
      if (typeof ev.data === 'string') {
        if (ev.data.includes('Path:audio.metadata')) {
          try {
            const json = JSON.parse(ev.data.slice(ev.data.indexOf('\r\n\r\n') + 4));
            (json.Metadata || []).forEach((m) => {
              if (m.Type === 'WordBoundary') words.push({ text: m.Data.text.Text, start: m.Data.Offset / 1e7, end: (m.Data.Offset + m.Data.Duration) / 1e7 });
            });
          } catch (e) { /* metadado incompleto: segue sem legenda dessa palavra */ }
        } else if (ev.data.includes('Path:turn.end')) {
          clearTimeout(timer);
          resolve();
        }
        return;
      }
      /* binário: 2 bytes com o tamanho do cabeçalho + cabeçalho + áudio */
      const buf = new Uint8Array(ev.data);
      const headLen = (buf[0] << 8) | buf[1];
      const head = new TextDecoder().decode(buf.subarray(2, 2 + headLen));
      if (head.includes('Path:audio')) chunks.push(buf.subarray(2 + headLen));
    });
    ws.addEventListener('close', () => { clearTimeout(timer); resolve(); });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new TtsError('Falha na conexão com o serviço de voz.')); });
  });

  const stamp = new Date().toUTCString();
  ws.send('X-Timestamp:' + stamp + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' +
    '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}');
  ws.send('X-RequestId:' + reqId + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + stamp + '\r\nPath:ssml\r\n\r\n' +
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pt-BR">' +
    '<voice name="' + voice + '"><prosody pitch="+0Hz" rate="' + rate + '" volume="+0%">' + xml(text) + '</prosody></voice></speak>');
  await done;
  try { ws.close(); } catch (e) { /* já fechado */ }

  const size = chunks.reduce((n, c) => n + c.length, 0);
  if (!size) throw new TtsError('O serviço de voz não devolveu áudio.');
  const audio = new Uint8Array(size);
  let at = 0;
  chunks.forEach((c) => { audio.set(c, at); at += c.length; });
  return { audio, words };
}
