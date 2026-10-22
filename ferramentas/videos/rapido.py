"""Vídeo de produto no ritmo TikTok/Reels (~15 s): gancho de curiosidade, cortes rápidos, suspense e revelação do preço.

Estrutura (pensada para retenção):
  0,0–1,8  GANCHO: pergunta que abre curiosidade, palavra por palavra batendo na tela ("QUANTO VOCÊ ACHA QUE CUSTA?")
  1,8–7,3  CORTES de ~1,1 s: um benefício por corte, com transição de chicote e zoom
  7,3–9,6  SUSPENSE: "E O PREÇO..." (música subindo, produto tremendo)
  9,6–12,6 REVELAÇÃO: clarão + preço gigante + confete + "de" riscado + selo da promoção
  12,6–15,5 CHAMADA que gera comentário ("COMENTA 'EU QUERO'"), @ e link na bio
  + barra de progresso no topo (segura até o fim)
Textos em ferramentas/videos/destaques/<produto>.json (bloco "rapido"); preço sempre do catálogo.
Uso: python ferramentas/videos/rapido.py <ffmpeg> <produto> <dados.json> <trilha.wav>
"""
import json
import math
import os
import random
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import promo as P
import render as R
import destaque as D

FPS = 30
ORANGE, WHITE, SOFT, DEEP = P.ORANGE, P.WHITE, P.SOFT, P.DEEP
HOOK, CUT0, CUTLEN, BUILD, PRICE, CTA, END = 0.0, 1.8, 1.1, 7.3, 9.6, 12.6, 15.5


def word_slam(img, words, y0, size, t0, t, u, gap=0.22, color_last=ORANGE):
    """palavras batendo na tela, uma por vez (escala grande → normal, com tremida)"""
    for i, w in enumerate(words):
        lt = t - (t0 + i * gap)
        if lt <= 0:
            continue
        layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
        P.center_text(layer, w, 0, size, color_last if i == len(words) - 1 else WHITE, int(12 * u + 4))
        bb = layer.getbbox()
        if not bb:
            continue
        s = 1 + 0.9 * (1 - P.ease(lt / 0.16))
        shake = math.sin(lt * 70) * 10 * u * max(0, 1 - lt / 0.25)
        P.put(img, layer.crop(bb), img.width / 2 + shake, y0 + i * size * 1.12, s, min(1, lt * 8))


def render(cfg, data, music, W, H, out, ffmpeg):
    portrait = H > W * 1.5
    u = H / 1920 if portrait else H / 1350 * 0.86
    rc = cfg['rapido']
    p = data['products'][0]
    bg = P.background(W, H)
    hero = P.with_glow(P.fit(Image.open(p['img']).convert('RGBA'), 940 * u, 760 * u), p['card'])
    cw, ch = int(W * 0.86), int(H * (0.46 if portrait else 0.48))
    shots = []
    for c in rc['cortes']:
        if c.get('recorte'):
            shots.append(None)
        else:
            shots.append(Image.open(os.path.join(ROOT, c['foto'])).convert('RGB'))
    logo_raw = Image.open(data['logo']).convert('RGBA')
    logo_small = D.rounded(logo_raw.resize((int(200 * u), int(200 * u)), Image.LANCZOS), int(100 * u))
    logo_chest = D.rounded(logo_raw.resize((110, 110), Image.LANCZOS), 55)
    rnd = random.Random(9)
    dots = [(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(2, 6) * u, rnd.uniform(15, 45) * u) for _ in range(40)]
    confetti = [(rnd.uniform(-1, 1), rnd.uniform(-1.2, -0.3), rnd.choice([ORANGE, WHITE, DEEP, (255, 210, 120)]), rnd.uniform(6, 14) * u, rnd.uniform(0, 6)) for _ in range(90)]
    frames = int(END * FPS)
    enc = subprocess.Popen([ffmpeg, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
                            '-i', music, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                            '-shortest', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    E, EB = P.ease, P.ease_back
    cy = H * (0.42 if portrait else 0.45)
    for fi in range(frames):
        t = fi / FPS
        frame = bg.copy()
        d = ImageDraw.Draw(frame)
        for (px, py, r, sp) in dots:
            y = (py - sp * t * 1.6) % H
            d.ellipse((px - r, y - r, px + r, y + r), fill=(255, 150, 40, 90))

        if t < CUT0:  # GANCHO
            punch = 1 + 0.6 * (1 - E(t / 0.3))
            shake = math.sin(t * 60) * 14 * u * max(0, 1 - t / 0.35)
            P.put(frame, hero, W / 2 + shake, cy + 120 * u, 0.9 * punch, 1.0, math.sin(t * 3) * 3)
            word_slam(frame, rc['gancho'], H * (0.08 if portrait else 0.05), 112 * u, 0.12, t, u)
        elif t < BUILD:  # CORTES rápidos
            k = min(len(rc['cortes']) - 1, int((t - CUT0) / CUTLEN))
            lt = t - CUT0 - k * CUTLEN
            c = rc['cortes'][k]
            whip = (1 - E(lt / 0.16)) * W * 0.9 * (1 if k % 2 == 0 else -1)
            if shots[k] is None:
                P.put(frame, hero, W / 2 + whip, cy, 0.95 + 0.12 * (lt / CUTLEN), 1.0, (k % 2 * 2 - 1) * 4 * (lt / CUTLEN))
            else:
                src = shots[k]
                z = 1.05 + 0.18 * (lt / CUTLEN)
                sw, sh = src.width / z, src.height / z
                ratio = cw / ch
                if sw / sh > ratio:
                    sw = sh * ratio
                else:
                    sh = sw / ratio
                fx, fy = c.get('foco', [0.5, 0.5])
                x0 = min(max(0, fx * src.width - sw / 2), src.width - sw)
                y0 = min(max(0, fy * src.height - sh / 2), src.height - sh)
                crop = src.crop((int(x0), int(y0), int(x0 + sw), int(y0 + sh))).resize((cw, ch), Image.BILINEAR)
                if lt < 0.16:
                    crop = crop.filter(ImageFilter.BoxBlur(int(20 * (1 - lt / 0.16)) + 1))
                card = D.framed(crop, int(40 * u), max(4, int(6 * u)))
                P.put(frame, card, W / 2 + whip, cy, 1.0, 1.0)
            layer = Image.new('RGBA', frame.size, (0, 0, 0, 0))
            P.center_text(layer, c['texto'], 0, 100 * u, WHITE, int(12 * u + 4), maxw=W - 100 * u)
            bb = layer.getbbox()
            if bb:
                P.put(frame, layer.crop(bb), W / 2, H * (0.77 if portrait else 0.84), 0.6 + 0.4 * EB((lt - 0.05) / 0.25), min(1, max(0, (lt - 0.05) * 8)))
            P.pill(frame, W / 2, H * (0.12 if portrait else 0.08), '%d/%d' % (k + 1, len(rc['cortes'])), 34 * u, fill=(30, 32, 42), color=WHITE)
        elif t < PRICE:  # SUSPENSE
            lt = t - BUILD
            k = lt / (PRICE - BUILD)
            shake = math.sin(t * (40 + 60 * k)) * 16 * u * k
            P.put(frame, hero, W / 2 + shake, cy, 0.9 + 0.25 * E(k), 1.0)
            dark = Image.new('RGBA', frame.size, (0, 0, 0, int(140 * k)))
            frame.alpha_composite(dark)
            dots_n = 1 + int(lt / 0.45) % 3
            P.center_text(frame, rc['suspense'].rstrip('.') + '.' * dots_n, H * (0.74 if portrait else 0.8), 110 * u, WHITE, int(12 * u + 4))
        elif t < CTA:  # REVELAÇÃO
            lt = t - PRICE
            P.put(frame, hero, W / 2, H * (0.26 if portrait else 0.27) + math.sin(t * 2.2) * 10 * u, 0.72, 1.0)
            base = H * (0.5 if portrait else 0.52)
            if p['percent']:
                D.strike_text(frame, 'de ' + p['original'], W / 2, base, 62 * u, SOFT, P.ease((lt - 0.35) / 0.3))
            layer = Image.new('RGBA', frame.size, (0, 0, 0, 0))
            P.center_text(layer, p['price'], 0, 210 * u, ORANGE, 16)
            bb = layer.getbbox()
            if bb:
                pulse = 1 + 0.04 * math.sin(max(0, lt - 0.8) * 7)
                P.put(frame, layer.crop(bb), W / 2, base + 210 * u, max(0.01, (1.8 - 0.8 * EB(lt / 0.35))) * pulse, min(1, lt * 8))
            P.center_text(frame, 'no PIX', base + 330 * u, 64 * u, WHITE, 8, alpha=P.ease((lt - 0.3) / 0.3))
            if p['percent']:
                P.pill(frame, W / 2, base + 470 * u, ('-' + str(p['percent']) + '% ' + cfg.get('cena4', {}).get('selo', '')).strip(), 56 * u, fill=WHITE, color=DEEP,
                       alpha=P.ease((lt - 0.6) / 0.3), scale=max(0.01, EB((lt - 0.6) / 0.4)) * (1 + 0.05 * math.sin(max(0, lt - 1) * 7)))
            if data.get('card'):
                P.center_text(frame, 'ou em até ' + str(data['card']) + 'x no cartão', base + 560 * u, 40 * u, SOFT, 5, black=False, alpha=P.ease((lt - 0.9) / 0.3))
            # confete
            cd = ImageDraw.Draw(frame)
            for (vx, vy, col, sz, rot) in confetti:
                x = W / 2 + vx * W * 0.6 * min(1, lt * 1.6)
                y = H * 0.5 + (vy * H * 0.45) * min(1, lt * 1.6) + 600 * u * lt * lt
                if y < H:
                    a = math.radians(rot * 60 + lt * 300)
                    dx, dy = math.cos(a) * sz, math.sin(a) * sz * 0.5
                    cd.polygon([(x - dx, y - dy), (x + dy, y - dx * 0.5), (x + dx, y + dy), (x - dy, y + dx * 0.5)], fill=col + (230,))
            if lt < 0.18:
                frame.alpha_composite(Image.new('RGBA', frame.size, (255, 255, 255, int(230 * (1 - lt / 0.18)))))
        else:  # CHAMADA
            lt = t - CTA
            ch_ = rc['chamada']
            P.put(frame, logo_small, W / 2, H * 0.11, EB(lt / 0.4), 1.0)
            word_slam(frame, [ch_['titulo']], H * (0.2 if portrait else 0.22), 96 * u, 0.0, lt, u)
            P.center_text(frame, ch_['sub'], H * (0.28 if portrait else 0.32), 50 * u, WHITE, 6, black=False, alpha=P.ease((lt - 0.35) / 0.3))
            P.center_text(frame, data['instagram'], H * (0.35 if portrait else 0.41), 70 * u, ORANGE, 8, alpha=P.ease((lt - 0.55) / 0.3))
            P.pill(frame, W / 2, H * (0.43 if portrait else 0.51), 'Link na bio', 62 * u, alpha=min(1, max(0, (lt - 0.75) * 4)), scale=max(0.01, EB((lt - 0.75) / 0.4)) * (1 + 0.03 * math.sin(t * 6)))
            m = R.mascot(0, (t % 3.1) < 0.12, t, 'wave', logo_chest)
            ms = 0.62 * u * (1 if portrait else 0.8)
            m = m.resize((int(400 * ms / 0.5), int(400 * ms / 0.5)), Image.LANCZOS)
            frame.alpha_composite(m, (int(W / 2 - m.width / 2), int(H - m.height * 0.92 + (1 - P.ease(lt / 0.45)) * 300 * u)))
        # barra de progresso (retenção)
        bar = ImageDraw.Draw(frame)
        bar.rectangle((0, 0, W, int(10 * u)), fill=(255, 255, 255, 50))
        bar.rectangle((0, 0, int(W * t / END), int(10 * u)), fill=ORANGE + (255,))
        if t < 0.1:
            frame.alpha_composite(Image.new('RGBA', frame.size, (255, 255, 255, int(220 * (1 - t / 0.1)))))
        enc.stdin.write(frame.convert('RGB').tobytes())
        if fi % 60 == 0:
            print('  %s %d/%d' % (os.path.basename(out), fi, frames), end='\r', flush=True)
    enc.stdin.close()
    enc.wait()
    print('  pronto: ' + out + ' ' * 20)


def main():
    ffmpeg, pid, dados, music = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    cfg = json.load(open(os.path.join(HERE, 'destaques', pid + '.json'), encoding='utf-8'))
    data = json.load(open(dados, encoding='utf-8'))
    outdir = os.path.join(ROOT, 'Banner_Itens_Loja', 'Videos')
    os.makedirs(outdir, exist_ok=True)
    for (w, h, tag) in ((1080, 1920, '9x16'), (1080, 1350, '4x5')):
        if len(sys.argv) > 5 and tag not in sys.argv[5:]:
            continue
        render(cfg, data, music, w, h, os.path.join(outdir, 'Rapido_' + pid + '_' + tag + '.mp4'), ffmpeg)


if __name__ == '__main__':
    main()
