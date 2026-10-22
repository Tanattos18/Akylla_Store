"""Vídeo de destaque de UM produto, em 5 cenas (roteiro de anúncio), sem voz e com trilha própria.

Cenas: 1) abertura (produto "decolando") · 2) close com zoom lento + 2 destaques · 3) foto + lista de benefícios ·
4) preço de/por + selo da promoção · 5) chamada (Garanta o seu / @ / Link na bio).
Os textos ficam em ferramentas/videos/destaques/<produto>.json; o preço vem do catálogo (nunca escrito à mão).

Uso (na raiz do projeto):
  VITRINE=<produto> CATEGORIAS=<produto> node ferramentas/videos/promo-dados.cjs   (preço e foto recortada)
  python ferramentas/videos/destaque.py <ffmpeg> <produto> <dados.json> <trilha.wav>
Saída: Banner_Itens_Loja/Videos/Destaque_<produto>_9x16.mp4 e _4x5.mp4
"""
import json
import math
import os
import random
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import promo as P
import render as R

FPS = 30
T = [0, 3, 7, 12, 18, 22]
ORANGE, WHITE, SOFT, DEEP = P.ORANGE, P.WHITE, P.SOFT, P.DEEP


def ease_in_out(x):
    x = max(0.0, min(1.0, x))
    return -(math.cos(math.pi * x) - 1) / 2


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    im = im.convert('RGBA')
    im.putalpha(m)
    return im


def framed(im, r, border):
    """foto com cantos arredondados, borda laranja e brilho"""
    pad = int(border * 6)
    out = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((pad - border, pad - border, pad + im.width + border, pad + im.height + border), r + border, fill=ORANGE + (255,))
    out.alpha_composite(rounded(im, r), (pad, pad))
    return out


def strike_text(img, txt, cx, y, size, color, alpha):
    if alpha <= 0.01:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = P.font(size, False)
    w = d.textlength(txt, font=f)
    d.text((cx - w / 2, y), txt, font=f, fill=color + (255,), stroke_width=5, stroke_fill=(0, 0, 0, 255))
    d.line([(cx - w / 2 - 6, y + size * 0.72), (cx + w / 2 + 6, y + size * 0.72)], fill=(255, 80, 80, 255), width=max(4, int(size * 0.09)))
    layer.putalpha(layer.split()[-1].point(lambda v: int(v * alpha)))
    img.alpha_composite(layer)


def render(cfg, data, music, W, H, out, ffmpeg):
    portrait = H > W * 1.5
    u = H / 1920 if portrait else H / 1350 * 0.86
    p = data['products'][0]
    bg = P.background(W, H)
    hero_raw = Image.open(p['img']).convert('RGBA')
    hero = P.with_glow(P.fit(hero_raw, 900 * u, 700 * u), p['card'])
    c2 = cfg['cena2']
    close_src = Image.open(os.path.join(ROOT, c2['foto'])).convert('RGB')
    cw, ch = int(W * 0.84), int((H * 0.5) if portrait else (H * 0.5))
    c3 = cfg['cena3']
    main_photo = framed(P.fit(Image.open(os.path.join(ROOT, c3['foto'])).convert('RGB'), W * 0.86, H * (0.37 if portrait else 0.38)), int(36 * u), max(4, int(6 * u)))
    logo_raw = Image.open(data['logo']).convert('RGBA')
    logo_small = rounded(logo_raw.resize((int(230 * u), int(230 * u)), Image.LANCZOS), int(115 * u))
    logo_chest = rounded(logo_raw.resize((110, 110), Image.LANCZOS), 55)
    rnd = random.Random(5)
    dots = [(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(2, 6) * u, rnd.uniform(15, 45) * u) for _ in range(46)]
    total = T[-1]
    frames = int(total * FPS)
    enc = subprocess.Popen([ffmpeg, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
                            '-i', music, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                            '-shortest', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    E, EB = P.ease, P.ease_back
    for fi in range(frames):
        t = fi / FPS
        frame = bg.copy()
        d = ImageDraw.Draw(frame)
        for (px, py, r, sp) in dots:
            y = (py - sp * t * (2.2 if t < 3 else 1)) % H
            d.ellipse((px - r, y - r, px + r, y + r), fill=(255, 150, 40, 90))
        sc = max(i for i in range(len(T) - 1) if t >= T[i])
        lt = t - T[sc]
        dur = T[sc + 1] - T[sc]
        out_a = 1 - E(max(0.0, (lt - (dur - 0.22)) / 0.22)) if sc < len(T) - 2 else 1.0
        cy = H * (0.46 if portrait else 0.5)

        if sc == 0:  # 1) decolagem em câmera lenta
            rise = E(lt / 2.4)
            y = H * 0.9 - (H * 0.9 - cy) * rise
            gy = H * (0.86 if portrait else 0.9)
            sh = Image.new('RGBA', frame.size, (0, 0, 0, 0))
            sw = W * 0.5 * (1 - 0.6 * rise)
            ImageDraw.Draw(sh).ellipse((W / 2 - sw / 2, gy - 22 * u, W / 2 + sw / 2, gy + 22 * u), fill=(0, 0, 0, int(170 * (1 - rise * 0.8))))
            frame.alpha_composite(sh)
            P.put(frame, hero, W / 2, y + math.sin(t * 3.1) * 8 * u, 0.82 + 0.18 * rise, out_a, math.sin(t * 2.3) * 3)
            P.center_text(frame, cfg['cena1']['titulo'], H * 0.1, 104 * u, WHITE, 10, alpha=E((lt - 0.8) / 0.4) * out_a, dy=(1 - E((lt - 0.8) / 0.4)) * 50 * u)
            P.center_text(frame, cfg['cena1']['sub'], H * 0.1 + 125 * u, 56 * u, ORANGE, 7, alpha=E((lt - 1.1) / 0.4) * out_a)
        elif sc == 1:  # 2) close com zoom lento
            z = 1 + 0.3 * ease_in_out(lt / dur)
            sw, shh = close_src.width / z, close_src.height / z
            ratio = cw / ch
            if sw / shh > ratio:
                sw = shh * ratio
            else:
                shh = sw / ratio
            fx, fy = c2['foco'][0] * close_src.width, c2['foco'][1] * close_src.height
            x0 = min(max(0, fx - sw / 2), close_src.width - sw)
            y0 = min(max(0, fy - shh / 2), close_src.height - shh)
            crop = close_src.crop((int(x0), int(y0), int(x0 + sw), int(y0 + shh))).resize((cw, ch), Image.BILINEAR)
            card = framed(crop, int(40 * u), max(4, int(6 * u)))
            P.put(frame, card, W / 2, H * (0.36 if portrait else 0.37), 0.9 + 0.1 * E(lt / 0.5), min(1, lt * 4) * out_a)
            lines = c2['texto']
            P.center_text(frame, lines[0], H * (0.68 if portrait else 0.72), 96 * u, WHITE, 10, alpha=E((lt - 0.4) / 0.35) * out_a, dy=(1 - E((lt - 0.4) / 0.35)) * 40 * u)
            if len(lines) > 1:
                P.center_text(frame, lines[1], H * (0.68 if portrait else 0.72) + 120 * u, 66 * u, ORANGE, 8, alpha=E((lt - 0.7) / 0.35) * out_a, dy=(1 - E((lt - 0.7) / 0.35)) * 40 * u)
        elif sc == 2:  # 3) benefícios
            P.center_text(frame, c3['titulo'], H * (0.07 if portrait else 0.05), 64 * u, WHITE, 8, alpha=E(lt / 0.3) * out_a)
            P.put(frame, main_photo, W / 2, H * (0.31 if portrait else 0.32), 0.9 + 0.1 * EB(lt / 0.5), min(1, lt * 4) * out_a)
            for i, item in enumerate(c3['itens'][:4]):
                q = (lt - 0.45 - i * 0.14) / 0.4
                if q <= 0:
                    continue
                a = min(1, q * 2) * out_a
                yy = H * (0.57 if portrait else 0.62) + i * 128 * u
                x0 = W * 0.12 - (1 - E(q)) * 80 * u
                P.check_icon(frame, x0, yy, 76 * u, a)
                dd = ImageDraw.Draw(frame)
                f = P.fit_font(dd, item, W * 0.7, 56 * u)
                dd.text((x0 + 100 * u, yy + 4 * u), item, font=f, fill=WHITE + (int(255 * a),), stroke_width=6, stroke_fill=(0, 0, 0, 255))
        elif sc == 3:  # 4) preço
            P.put(frame, hero, W / 2, H * (0.3 if portrait else 0.3) + math.sin(t * 2.2) * 12 * u, 0.85 + 0.05 * math.sin(t * 1.4), min(1, lt * 4) * out_a, math.sin(t * 1.7) * 2)
            base = H * (0.56 if portrait else 0.58)
            if p['percent']:
                strike_text(frame, 'De ' + p['original'], W / 2, base, 60 * u, SOFT, E((lt - 0.2) / 0.3) * out_a)
            layer = Image.new('RGBA', frame.size, (0, 0, 0, 0))
            P.center_text(layer, p['price'], 0, 190 * u, ORANGE, 14)
            bb = layer.getbbox()
            if bb:
                pulse = 1 + 0.04 * math.sin(max(0, lt - 1.0) * 6)
                P.put(frame, layer.crop(bb), W / 2, base + 200 * u, max(0.01, EB((lt - 0.4) / 0.45)) * pulse, min(1, max(0, (lt - 0.4) * 4)) * out_a)
            P.center_text(frame, 'no PIX', base + 310 * u, 60 * u, WHITE, 8, alpha=E((lt - 0.7) / 0.3) * out_a)
            if p['percent']:
                selo = '-' + str(p['percent']) + '% ' + cfg['cena4'].get('selo', '')
                P.pill(frame, W / 2, base + 450 * u, selo.strip(), 54 * u, fill=WHITE, color=DEEP, alpha=E((lt - 1.0) / 0.3) * out_a, scale=max(0.01, EB((lt - 1.0) / 0.4)) * (1 + 0.05 * math.sin(max(0, lt - 1.4) * 7)))
            if data.get('card'):
                P.center_text(frame, 'ou em até ' + str(data['card']) + 'x no cartão', base + 540 * u, 40 * u, SOFT, 5, black=False, alpha=E((lt - 1.3) / 0.3) * out_a)
        else:  # 5) chamada
            c5 = cfg['cena5']
            P.put(frame, logo_small, W / 2, H * 0.13, EB(lt / 0.5), 1.0)
            P.center_text(frame, c5['titulo'], H * (0.24 if portrait else 0.27), 110 * u, WHITE, 11, alpha=E((lt - 0.1) / 0.3), dy=(1 - E((lt - 0.1) / 0.3)) * 40 * u)
            P.center_text(frame, data['instagram'], H * (0.33 if portrait else 0.39), 70 * u, ORANGE, 8, alpha=E((lt - 0.35) / 0.3))
            P.pill(frame, W / 2, H * (0.42 if portrait else 0.5), c5['chamada'], 66 * u, alpha=min(1, max(0, (lt - 0.55) * 4)), scale=max(0.01, EB((lt - 0.55) / 0.4)) * (1 + 0.03 * math.sin(t * 6)))
            P.center_text(frame, 'akyllashop.com · WhatsApp ' + data['whatsapp'], H * (0.49 if portrait else 0.58), 38 * u, SOFT, 5, black=False, alpha=E((lt - 0.8) / 0.3))
            m = R.mascot(0, (t % 3.1) < 0.12, t, 'wave', logo_chest)
            ms = 0.62 * u * (1 if portrait else 0.8)
            m = m.resize((int(400 * ms / 0.5), int(400 * ms / 0.5)), Image.LANCZOS)
            frame.alpha_composite(m, (int(W / 2 - m.width / 2), int(H - m.height * 0.92 + (1 - E(lt / 0.5)) * 300 * u)))
            fade = max(0.0, (t - (total - 0.5)) / 0.5)
            if fade > 0:
                frame.alpha_composite(Image.new('RGBA', frame.size, (0, 0, 0, int(160 * fade))))
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
        render(cfg, data, music, w, h, os.path.join(outdir, 'Destaque_' + pid + '_' + tag + '.mp4'), ffmpeg)


if __name__ == '__main__':
    main()
