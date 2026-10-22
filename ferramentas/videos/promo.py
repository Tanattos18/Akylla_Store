"""Vídeo institucional da loja (apresentação + vitrine), para anúncio no Instagram/Facebook.

Feito para ser assistido SEM SOM (texto grande na tela) com trilha própria. Sai em 9:16 (Reels/Stories) e 4:5 (feed).
Uso (na raiz do projeto):
  node ferramentas/videos/promo-dados.cjs          -> preços atuais, fotos recortadas (dados.json)
  (trilha: painel → Artes → Biblioteca de trilhas, ou a gerada em .trabalho/promo/trilha.wav)
  python ferramentas/videos/promo.py <ffmpeg>       -> Banner_Itens_Loja/Videos/Akylla_Institucional_9x16.mp4 e _4x5.mp4
Movimento segue os princípios de motion design (entrada desacelerando com leve estouro, destaque primeiro,
elementos em sequência, saída rápida, fundo vivo).
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
import render as R  # mascote, fontes e curvas de movimento do gerador de vídeos

FPS = 30
ORANGE, DEEP, WHITE = (255, 138, 0), (255, 94, 0), (255, 255, 255)
SOFT = (200, 205, 215)
# linha do tempo (segundos): abertura, categorias, 5 produtos, vantagens, oferta, chamada
T = [0, 2.6, 5.6, 7.6, 9.6, 11.6, 13.6, 15.6, 18.8, 21.2, 25.0]


def ease_back(x):
    return R.ease_out_back(x)


def ease(x):
    return R.ease_out(x)


def font(size, black=True):
    return R.font('seguibl.ttf' if black else 'segoeuib.ttf', int(size))


def text_w(d, txt, f):
    return d.textlength(txt, font=f)


def fit_font(d, txt, maxw, size, black=True):
    while size > 20:
        f = font(size, black)
        if text_w(d, txt, f) <= maxw:
            return f
        size -= 2
    return font(size, black)


def center_text(img, txt, y, size, color=WHITE, stroke=8, black=True, alpha=1.0, maxw=None, dy=0):
    if alpha <= 0.01:
        return
    W = img.width
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = fit_font(d, txt, maxw or W - 120, size, black)
    w = text_w(d, txt, f)
    d.text(((W - w) / 2, y + dy), txt, font=f, fill=color + (255,), stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    if alpha < 0.999:
        layer.putalpha(layer.split()[-1].point(lambda v: int(v * alpha)))
    img.alpha_composite(layer)


def pill(img, cx, cy, txt, size, fill=ORANGE, color=(17, 17, 17), alpha=1.0, scale=1.0, pad=None):
    if alpha <= 0.01 or scale <= 0.01:
        return
    tmp = ImageDraw.Draw(img)
    f = font(size * scale)
    w = text_w(tmp, txt, f)
    p = (pad or size * 0.7) * scale
    h = size * 1.55 * scale
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    box = (cx - w / 2 - p, cy - h / 2, cx + w / 2 + p, cy + h / 2)
    d.rounded_rectangle(box, radius=h / 2, fill=fill + (255,))
    d.text((cx - w / 2, cy - h / 2 + (h - size * 1.25 * scale) / 2), txt, font=f, fill=color + (255,))
    if alpha < 0.999:
        layer.putalpha(layer.split()[-1].point(lambda v: int(v * alpha)))
    img.alpha_composite(layer)


def with_glow(im, card):
    if card:
        base = Image.new('RGBA', (im.width + 60, im.height + 60), (255, 255, 255, 255))
        base.paste(im, (30, 30), im)
        mask = Image.new('L', base.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, base.width - 1, base.height - 1), 48, fill=255)
        base.putalpha(mask)
        im = base
    pad = 70
    out = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    a = Image.new('L', out.size, 0)
    a.paste(im.split()[-1], (pad, pad))
    halo = Image.new('RGBA', out.size, ORANGE + (0,))
    halo.putalpha(a.filter(ImageFilter.GaussianBlur(32)).point(lambda v: int(v * 0.8)))
    out.alpha_composite(halo)
    out.alpha_composite(im, (pad, pad))
    return out


def fit(im, bw, bh):
    k = min(bw / im.width, bh / im.height)
    return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)


def put(img, im, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    if abs(scale - 1) > 0.004:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if abs(rot) > 0.05:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    if alpha < 0.999:
        im = im.copy()
        im.putalpha(im.split()[-1].point(lambda v: int(v * alpha)))
    img.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


def background(W, H):
    bg = Image.new('RGB', (1, 2))
    bg.putpixel((0, 0), (17, 20, 30))
    bg.putpixel((0, 1), (6, 8, 13))
    bg = bg.resize((W, H), Image.BICUBIC)
    glow = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(glow)
    d.ellipse((W * 0.05, H * 0.15, W * 0.95, H * 0.6), fill=120)
    d.ellipse((W * 0.5, H * 0.8, W * 1.4, H * 1.2), fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(170))
    orange = Image.new('RGB', (W, H), DEEP)
    out = Image.composite(orange, bg, glow.point(lambda v: int(v * 0.5))).convert('RGBA')
    vig = Image.new('L', (W, H), 0)
    ImageDraw.Draw(vig).ellipse((-W * 0.25, -H * 0.15, W * 1.25, H * 1.15), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(160))
    dark = Image.new('RGBA', (W, H), (0, 0, 0, 120))
    dark.putalpha(vig.point(lambda v: int((255 - v) * 0.55)))
    out.alpha_composite(dark)
    return out


def check_icon(img, x, y, s, alpha):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((x, y, x + s, y + s), fill=ORANGE + (255,))
    d.line([(x + s * 0.27, y + s * 0.52), (x + s * 0.44, y + s * 0.69), (x + s * 0.74, y + s * 0.33)], fill=(17, 17, 17, 255), width=max(3, int(s * 0.12)), joint='curve')
    if alpha < 0.999:
        layer.putalpha(layer.split()[-1].point(lambda v: int(v * alpha)))
    img.alpha_composite(layer)


def render(data, W, H, out, ffmpeg):
    u = H / 1920 if H > W * 1.5 else H / 1350 * 0.86
    portrait = H > W * 1.5
    bg = background(W, H)
    logo_raw = Image.open(data['logo']).convert('RGBA')
    logo_big = logo_raw.resize((int(620 * u), int(620 * u)), Image.LANCZOS)
    mask = Image.new('L', logo_big.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, logo_big.width - 1, logo_big.height - 1), fill=255)
    logo_big.putalpha(mask)
    logo_small = logo_big.resize((int(220 * u), int(220 * u)), Image.LANCZOS)
    logo_chest = logo_raw.resize((110, 110), Image.LANCZOS)
    m2 = Image.new('L', logo_chest.size, 0)
    ImageDraw.Draw(m2).ellipse((0, 0, 109, 109), fill=255)
    logo_chest.putalpha(m2)

    prods = []
    for p in data['products']:
        im = Image.open(p['img']).convert('RGBA')
        prods.append(dict(p, im=with_glow(fit(im, 900 * u if not p['card'] else 640 * u, 760 * u if not p['card'] else 640 * u), p['card'])))
    cats = []
    for p in data['categories']:
        im = Image.open(p['img']).convert('RGBA')
        cats.append(with_glow(fit(im, 250 * u, 230 * u), p['card']))

    rnd = random.Random(11)
    dots = [(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(2, 6) * u, rnd.uniform(15, 45) * u) for _ in range(46)]
    total = T[-1]
    frames = int(total * FPS)
    cmd = [ffmpeg, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
           '-i', data['music'], '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
           '-shortest', '-movflags', '+faststart', out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    benefits = ['PIX à vista ou ' + (str(data['card']) + 'x no cartão' if data['card'] else 'cartão'), 'Retirada grátis na loja', 'Entrega em Goiânia e região', 'Garantia legal de 90 dias']

    for fi in range(frames):
        t = fi / FPS
        frame = bg.copy()
        # ambiente: brilho respirando + partículas
        d = ImageDraw.Draw(frame)
        for (px, py, r, sp) in dots:
            y = (py - sp * t) % H
            d.ellipse((px - r, y - r, px + r, y + r), fill=(255, 150, 40, 90))
        sc = max(i for i in range(len(T) - 1) if t >= T[i])
        lt = t - T[sc]
        dur = T[sc + 1] - T[sc]
        out_a = 1 - R.ease_out(max(0.0, (lt - (dur - 0.22)) / 0.22)) if sc < len(T) - 2 else 1.0  # saída rápida
        cy = H * (0.42 if portrait else 0.44)

        if sc == 0:  # abertura: logo + frase
            put(frame, logo_big, W / 2, cy - 60 * u, 0.55 + 0.45 * ease_back(lt / 0.7), out_a, (1 - ease(lt / 0.7)) * -12)
            center_text(frame, 'Tecnologia em Goiânia', cy + 300 * u, 64 * u, WHITE, 8, alpha=ease((lt - 0.5) / 0.4) * out_a, dy=(1 - ease((lt - 0.5) / 0.4)) * 40 * u)
            center_text(frame, 'com preço justo e atendimento de verdade', cy + 390 * u, 40 * u, ORANGE, 6, black=False, alpha=ease((lt - 0.75) / 0.4) * out_a)
        elif sc == 1:  # categorias
            center_text(frame, 'TEM DE TUDO PRO SEU DIA A DIA', H * 0.12, 62 * u, WHITE, 8, alpha=ease(lt / 0.3) * out_a)
            labels = ['Smartwatches', 'Fones', 'Drones', 'Power banks', 'Carregadores', 'Cabos']
            cols, rows = 3, 2
            gw, gh = W / cols, (H * (0.62 if portrait else 0.6)) / rows
            for i, im in enumerate(cats):
                c, r = i % cols, i // cols
                x = gw * c + gw / 2
                y = H * 0.24 + gh * r + gh / 2 - 30 * u
                p = (lt - 0.15 - i * 0.08) / 0.4
                if p <= 0:
                    continue
                put(frame, im, x, y + (1 - ease(p)) * 60 * u, 0.7 + 0.3 * ease_back(p), min(1, p * 2) * out_a)
                center_tx = labels[i]
                layer_d = ImageDraw.Draw(frame)
                f = font(34 * u, False)
                tw = text_w(layer_d, center_tx, f)
                if p > 0.4:
                    layer_d.text((x - tw / 2, y + 150 * u), center_tx, font=f, fill=WHITE + (int(255 * min(1, (p - 0.4) * 2) * out_a),), stroke_width=4, stroke_fill=(0, 0, 0, 255))
        elif 2 <= sc <= 6:  # vitrine: um produto por vez
            p = prods[sc - 2]
            enter = ease(lt / 0.45)
            put(frame, p['im'], W / 2 + (1 - enter) * 500 * u, cy - 40 * u + math.sin(t * 2.2) * 10 * u, 0.82 + 0.18 * ease_back(lt / 0.5), min(1, lt * 4) * out_a)
            center_text(frame, p['name'], H * (0.66 if portrait else 0.7), 100 * u, WHITE, 9, alpha=ease((lt - 0.15) / 0.3) * out_a, dy=(1 - ease((lt - 0.15) / 0.3)) * 40 * u)
            s = ease_back((lt - 0.3) / 0.4)
            pill(frame, W / 2, H * (0.66 if portrait else 0.7) + 190 * u, p['price'] + ' no PIX', 68 * u, alpha=min(1, max(0, (lt - 0.3) * 4)) * out_a, scale=max(0.01, s))
            if p['percent']:
                bs = ease_back((lt - 0.45) / 0.35) * (1 + 0.06 * math.sin(max(0, lt - 0.8) * 9) * max(0, 1 - (lt - 0.8)))
                pill(frame, W / 2 + 300 * u, cy - 330 * u, '-' + str(p['percent']) + '%', 52 * u, fill=WHITE, color=DEEP, alpha=min(1, max(0, (lt - 0.45) * 4)) * out_a, scale=max(0.01, bs))
            if data['card']:
                center_text(frame, 'ou em até ' + str(data['card']) + 'x no cartão', H * (0.66 if portrait else 0.7) + 290 * u, 40 * u, SOFT, 5, black=False, alpha=ease((lt - 0.55) / 0.3) * out_a)
            # contador da vitrine
            center_text(frame, '%d/5' % (sc - 1), H * 0.08, 32 * u, SOFT, 4, black=False, alpha=0.8 * out_a)
        elif sc == 7:  # vantagens
            center_text(frame, 'POR QUE COMPRAR NA AKYLLA?', H * (0.2 if portrait else 0.14), 60 * u, WHITE, 8, alpha=ease(lt / 0.3) * out_a)
            for i, b in enumerate(benefits):
                p = (lt - 0.25 - i * 0.12) / 0.4
                if p <= 0:
                    continue
                a = min(1, p * 2) * out_a
                y = H * (0.34 if portrait else 0.3) + i * 150 * u
                x0 = W * 0.13 - (1 - ease(p)) * 80 * u
                check_icon(frame, x0, y, 78 * u, a)
                dd = ImageDraw.Draw(frame)
                f = fit_font(dd, b, W * 0.68, 52 * u)
                dd.text((x0 + 105 * u, y + 6 * u), b, font=f, fill=WHITE + (int(255 * a),), stroke_width=6, stroke_fill=(0, 0, 0, 255))
        elif sc == 8:  # oferta
            pr = data['promo']
            big = (str(pr['percent']) + '% OFF') if pr else 'OFERTAS'
            s = ease_back(lt / 0.45) * (1 + 0.05 * math.sin(max(0, lt - 0.6) * 7))
            center_text(frame, (pr['text'] if pr else 'Preços especiais').upper(), cy - 260 * u, 56 * u, WHITE, 8, alpha=ease(lt / 0.3) * out_a)
            layer = Image.new('RGBA', frame.size, (0, 0, 0, 0))
            center_text(layer, big, 0, 220 * u, ORANGE, 14)
            bbox = layer.getbbox()
            if bbox:
                crop = layer.crop(bbox)
                put(frame, crop, W / 2, cy - 30 * u, max(0.01, s), min(1, lt * 4) * out_a, -4)
            if pr and pr.get('until'):
                pill(frame, W / 2, cy + 200 * u, 'até ' + pr['until'], 50 * u, fill=WHITE, color=(17, 17, 17), alpha=ease((lt - 0.4) / 0.3) * out_a, scale=max(0.01, ease_back((lt - 0.4) / 0.4)))
            center_text(frame, 'em toda a loja', cy + 300 * u, 44 * u, SOFT, 5, black=False, alpha=ease((lt - 0.6) / 0.3) * out_a)
        else:  # chamada final
            put(frame, logo_small, W / 2, H * 0.14, ease_back(lt / 0.5), 1.0)
            center_text(frame, 'COMPRE AGORA', H * (0.26 if portrait else 0.27), 96 * u, WHITE, 10, alpha=ease((lt - 0.1) / 0.3))
            pill(frame, W / 2, H * (0.39 if portrait else 0.43), 'akyllashop.com', 64 * u, alpha=min(1, max(0, (lt - 0.3) * 4)), scale=max(0.01, ease_back((lt - 0.3) / 0.4)) * (1 + 0.03 * math.sin(t * 6)))
            center_text(frame, 'Instagram ' + data['instagram'], H * (0.47 if portrait else 0.53), 46 * u, WHITE, 6, black=False, alpha=ease((lt - 0.5) / 0.3))
            center_text(frame, 'WhatsApp ' + data['whatsapp'], H * (0.51 if portrait else 0.6), 46 * u, ORANGE, 6, black=False, alpha=ease((lt - 0.65) / 0.3))
            msz = 0.62 * u * (1 if portrait else 0.8)
            m = R.mascot(0, (t % 3.1) < 0.12, t, 'wave', logo_chest)
            m = m.resize((int(400 * msz / 0.5), int(400 * msz / 0.5)), Image.LANCZOS)
            my = H - m.height * 0.92 + (1 - ease(lt / 0.5)) * 300 * u
            frame.alpha_composite(m, (int(W / 2 - m.width / 2), int(my)))
            fade = max(0.0, (t - (total - 0.6)) / 0.6)
            if fade > 0:
                frame.alpha_composite(Image.new('RGBA', frame.size, (0, 0, 0, int(160 * fade))))
        if t < 0.18:
            frame.alpha_composite(Image.new('RGBA', frame.size, (255, 255, 255, int(200 * (1 - t / 0.18)))))
        enc.stdin.write(frame.convert('RGB').tobytes())
        if fi % 60 == 0:
            print('  %s quadros %d/%d' % (os.path.basename(out), fi, frames), end='\r', flush=True)
    enc.stdin.close()
    enc.wait()
    print('  pronto: ' + out + ' ' * 20)


def main():
    ffmpeg = sys.argv[1] if len(sys.argv) > 1 else 'ffmpeg'
    data = json.load(open(os.path.join(HERE, '.trabalho', 'promo', 'dados.json'), encoding='utf-8'))
    outdir = os.path.join(ROOT, 'Banner_Itens_Loja', 'Videos')
    os.makedirs(outdir, exist_ok=True)
    which = sys.argv[2:] or ['9x16', '4x5']
    if '9x16' in which:
        render(data, 1080, 1920, os.path.join(outdir, 'Akylla_Institucional_9x16.mp4'), ffmpeg)
    if '4x5' in which:
        render(data, 1080, 1350, os.path.join(outdir, 'Akylla_Institucional_4x5.mp4'), ffmpeg)


if __name__ == '__main__':
    main()
