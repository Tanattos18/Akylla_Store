"""Desenha o vídeo 9:16 quadro a quadro (Pillow) e monta o MP4 com a voz (FFmpeg).

Uso: python render.py video.json saida.mp4 caminho/do/ffmpeg   (chamado pelo gerar.mjs)
Mascote: "Aky", robô laranja da Akylla; a boca acompanha o volume da voz e ele pisca e acena.
"""
import json
import math
import os
import random
import struct
import subprocess
import sys
import wave

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
ORANGE, DEEP, INK = (255, 138, 0), (255, 94, 0), (7, 9, 15)
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')


def font(name, size):
    for n in (name, 'seguibl.ttf', 'arialbd.ttf'):
        try:
            return ImageFont.truetype(os.path.join(FONTS, n), size)
        except OSError:
            continue
    return ImageFont.load_default()


F_CAP = font('seguibl.ttf', 84)
F_BRAND = font('seguibl.ttf', 40)
F_SMALL = font('segoeuib.ttf', 26)


def ease_out_back(x):
    x = max(0.0, min(1.0, x))
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


# ------------------------------- áudio -------------------------------

def read_wav(path):
    with wave.open(path, 'rb') as w:
        return w.readframes(w.getnframes())


def build_audio(spec, job):
    rate = 24000
    silence = lambda s: b'\x00\x00' * int(rate * s)
    pcm = silence(0.35)
    lead_gap, tail = 0.28, 2.2
    for line in spec['lines']:
        data = read_wav(line['wav'])
        line['start'] = len(pcm) / 2 / rate
        line['dur'] = len(data) / 2 / rate
        pcm += data + silence(lead_gap)
    end_speech = len(pcm) / 2 / rate
    pcm += silence(tail)
    out = os.path.join(job, 'voz.wav')
    with wave.open(out, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    # volume por quadro (boca do mascote)
    samples = struct.unpack('<%dh' % (len(pcm) // 2), pcm)
    per = rate // FPS
    env = []
    for i in range(0, len(samples), per):
        chunk = samples[i:i + per]
        env.append(math.sqrt(sum(s * s for s in chunk[::4]) / max(1, len(chunk[::4]))))
    peak = sorted(env)[int(len(env) * 0.95)] or 1
    env = [min(1.0, e / peak) for e in env]
    return out, env, end_speech, len(pcm) / 2 / rate


# ------------------------------ imagens ------------------------------

def background():
    bg = Image.new('RGB', (1, 2))
    bg.putpixel((0, 0), (17, 20, 30))
    bg.putpixel((0, 1), (6, 8, 13))
    bg = bg.resize((W, H), Image.BICUBIC)
    glow = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(glow)
    d.ellipse((W * 0.05, H * 0.12, W * 0.95, H * 0.55), fill=120)
    d.ellipse((W * 0.45, H * 0.78, W * 1.4, H * 1.2), fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    orange = Image.new('RGB', (W, H), DEEP)
    return Image.composite(orange, bg, glow.point(lambda v: int(v * 0.55)))


def fit(im, box_w, box_h):
    k = min(box_w / im.width, box_h / im.height)
    return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)


def with_glow(im, card):
    """Produto com brilho laranja em volta (ou num cartão branco, como no anúncio)."""
    pad = 60
    if card:
        base = Image.new('RGBA', (im.width + 40, im.height + 40), (255, 255, 255, 255))
        base.paste(im, (20, 20), im if im.mode == 'RGBA' else None)
        mask = Image.new('L', base.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, base.width - 1, base.height - 1), 36, fill=255)
        base.putalpha(mask)
        im = base
    canvas = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    halo = Image.new('RGBA', canvas.size, ORANGE + (0,))
    a = Image.new('L', canvas.size, 0)
    a.paste(im.split()[-1], (pad, pad))
    a = a.filter(ImageFilter.GaussianBlur(28)).point(lambda v: int(v * 0.75))
    halo.putalpha(a)
    canvas.alpha_composite(halo)
    canvas.alpha_composite(im, (pad, pad))
    return canvas


def spec_rows(ad):
    """Recorta as linhas da ficha técnica do anúncio (ícone + texto), achando as linhas divisórias."""
    x0, x1 = 676, 1044
    px = ad.load()
    lum = lambda x, y: sum(px[x, y][:3]) / 3
    seps = [400]
    y = 470
    while y < 1300:
        vals = [lum(x, y) for x in range(700, 1030, 6)]
        above = [lum(x, y - 3) for x in range(700, 1030, 6)]
        m = sum(vals) / len(vals)
        var = sum((v - m) ** 2 for v in vals) / len(vals)
        if var < 30 and m > sum(above) / len(above) + 10:
            seps.append(y)
            y += 60
        y += 1
    rows = []
    for i in range(len(seps)):
        top = seps[i]
        bottom = seps[i + 1] if i + 1 < len(seps) else min(top + 140, 1290)
        if bottom - top < 90:
            continue
        rows.append(ad.crop((x0, top + 2, x1, bottom - 1)))
    if len(rows) < 3:  # plano B: altura fixa
        rows = [ad.crop((x0, 400 + i * 133, x1, 400 + (i + 1) * 133)) for i in range(6)]
    return rows


def card_from(crop, scale):
    """Peça do anúncio num cartão escuro com borda laranja."""
    im = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.LANCZOS).convert('RGBA')
    pad = 22
    card = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle((0, 0, card.width - 1, card.height - 1), 40, fill=(10, 12, 20, 235), outline=DEEP + (255,), width=5)
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), 26, fill=255)
    card.paste(im, (pad, pad), mask)
    return card


def paste_center(frame, im, cx, cy, scale=1.0, rot=0.0, alpha=1.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    if abs(scale - 1) > 0.005:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if abs(rot) > 0.05:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    if alpha < 0.999:
        a = im.split()[-1].point(lambda v: int(v * alpha))
        im = im.copy()
        im.putalpha(a)
    frame.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


# ------------------------------ mascote ------------------------------

def mascot(open_, blink, t, pose, logo):
    S = 800
    m = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(m)
    bob = math.sin(t * 3.2) * 10
    # antena
    d.line((400, 175 + bob, 400, 95 + bob), fill=(255, 210, 122, 255), width=14)
    glow = 22 + 4 * math.sin(t * 6)
    d.ellipse((400 - glow - 10, 70 + bob - glow - 10, 400 + glow + 10, 70 + bob + glow + 10), fill=(255, 170, 60, 70))
    d.ellipse((400 - 22, 70 + bob - 22, 400 + 22, 70 + bob + 22), fill=(255, 220, 140, 255))
    # corpo
    d.rounded_rectangle((250, 560, 550, 790), 70, fill=DEEP + (255,))
    d.rounded_rectangle((262, 568, 538, 700), 60, fill=ORANGE + (255,))
    if logo is not None:
        m.alpha_composite(logo, (400 - logo.width // 2, 600))
    # braços: esquerdo parado; direito acena (gancho) ou aponta para o produto
    d.line((262, 620, 190, 720), fill=DEEP + (255,), width=46)
    d.ellipse((160, 690, 222, 752), fill=ORANGE + (255,))
    # ângulo a partir da horizontal (para cima): acena balançando ou aponta para o produto (acima, à direita)
    deg = 70 + 22 * math.sin(t * 9) if pose == 'wave' else 48 + 5 * math.sin(t * 2.5)
    sx, sy = 540, 610
    ex = sx + 170 * math.cos(math.radians(deg))
    ey = sy - 170 * math.sin(math.radians(deg))
    d.line((sx, sy, ex, ey), fill=DEEP + (255,), width=46)
    d.ellipse((ex - 34, ey - 34, ex + 34, ey + 34), fill=ORANGE + (255,))
    # cabeça e tela do rosto
    d.rounded_rectangle((150, 175 + bob, 650, 560 + bob), 130, fill=ORANGE + (255,), outline=DEEP + (255,), width=12)
    d.rounded_rectangle((205, 235 + bob, 595, 500 + bob), 95, fill=(11, 13, 20, 255))
    look = 12 if pose != 'wave' else 0
    eh = 8 if blink else 78
    for cx in (315, 485):
        d.rounded_rectangle((cx - 32 + look, 345 - eh / 2 + bob, cx + 32 + look, 345 + eh / 2 + bob), 30, fill=(255, 255, 255, 255))
        if not blink:
            d.ellipse((cx - 8 + look + 8, 322 + bob, cx + 8 + look + 8, 338 + bob), fill=(255, 200, 120, 255))
    mh = 10 + 62 * open_
    d.rounded_rectangle((400 - 62, 440 - mh / 2 + bob, 400 + 62, 440 + mh / 2 + bob), 24, fill=ORANGE + (255,))
    # bochechas
    d.ellipse((222, 405 + bob, 262, 430 + bob), fill=(255, 120, 60, 120))
    d.ellipse((538, 405 + bob, 578, 430 + bob), fill=(255, 120, 60, 120))
    return m.resize((400, 400), Image.LANCZOS)


# ------------------------------ legendas ------------------------------

def caption_groups(words):
    groups, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= 3 or len(' '.join(x['text'] for x in cur)) > 16:
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    return groups


def draw_caption(frame, group, current):
    d = ImageDraw.Draw(frame)
    parts = [w['text'].upper() for w in group]
    space = 24
    widths = [d.textlength(p, font=F_CAP) for p in parts]
    total = sum(widths) + space * (len(parts) - 1)
    size_k = min(1.0, 960 / max(total, 1))
    f = F_CAP if size_k >= 1 else font('seguibl.ttf', int(84 * size_k))
    widths = [d.textlength(p, font=f) for p in parts]
    total = sum(widths) + space * (len(parts) - 1)
    x = (W - total) / 2
    for p, w_, word in zip(parts, widths, group):
        color = ORANGE if word is current else (255, 255, 255)
        d.text((x, 1235), p, font=f, fill=color, stroke_width=8, stroke_fill=(0, 0, 0))
        x += w_ + space


# ------------------------------ montagem ------------------------------

def main():
    spec_path, out, ffmpeg = sys.argv[1], sys.argv[2], sys.argv[3]
    spec = json.load(open(spec_path, encoding='utf-8'))
    job = os.path.dirname(spec_path)
    wav, env, end_speech, total = build_audio(spec, job)

    ad = Image.open(spec['adPng']).convert('RGB')
    bg = background().convert('RGBA')
    hero_raw = Image.open(spec['hero']).convert('RGBA')
    hero = with_glow(fit(hero_raw, 820 if not spec['card'] else 560, 600 if not spec['card'] else 560), spec['card'])
    combo = with_glow(fit(Image.open(spec['combo']).convert('RGBA'), 520, 420), spec['card']) if spec.get('combo') else None
    rows = spec_rows(ad)
    spec_cards = [card_from(r, 2.3) for r in rows]
    price_card = ad.crop((0, 1472, 630, 1760)).convert('RGBA')
    price_card = price_card.resize((int(price_card.width * 1.5), int(price_card.height * 1.5)), Image.LANCZOS)
    combo_text = card_from(ad.crop((326, 985, 662, 1262)), 1.6)
    cta_card = ad.crop((20, 1758, 700, 1896)).convert('RGBA')
    cta_card = cta_card.resize((int(cta_card.width * 1.45), int(cta_card.height * 1.45)), Image.LANCZOS)
    full_ad = ad.convert('RGBA')
    logo = Image.open(spec['logo']).convert('RGBA')
    logo_top = logo.resize((96, 96), Image.LANCZOS)
    mask = Image.new('L', logo_top.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 95, 95), fill=255)
    logo_top.putalpha(mask)
    logo_chest = logo.resize((110, 110), Image.LANCZOS)
    mask2 = Image.new('L', logo_chest.size, 0)
    ImageDraw.Draw(mask2).ellipse((0, 0, 109, 109), fill=255)
    logo_chest.putalpha(mask2)

    rnd = random.Random(7)
    particles = [(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(2, 6), rnd.uniform(15, 45)) for _ in range(40)]
    for line in spec['lines']:
        line['groups'] = caption_groups(line['words'])

    frames = int(total * FPS)
    cmd = [ffmpeg, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
           '-i', wav, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
           '-shortest', '-movflags', '+faststart', out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    lines = spec['lines']
    spec_seen = {}

    for fi in range(frames):
        t = fi / FPS
        frame = bg.copy()
        d = ImageDraw.Draw(frame)
        # partículas subindo
        for (px, py, r, sp) in particles:
            y = (py - sp * t) % H
            d.ellipse((px - r, y - r, px + r, y + r), fill=(255, 150, 40, 90))

        # fala atual
        idx = 0
        for i, line in enumerate(lines):
            if t >= line['start'] - 0.05:
                idx = i
        line = lines[idx]
        lt = t - line['start']
        scene = line['scene']
        ending = t > end_speech + 0.1

        if not ending:
            # topo: logo + nome + aviso de IA
            frame.alpha_composite(logo_top, (48, 70))
            d.text((160, 88), 'AKYLLA SHOP', font=F_BRAND, fill=(255, 255, 255))
            d.text((160, 134), 'akyllashop.com', font=F_SMALL, fill=(255, 170, 70))
            tag = 'Conteúdo criado com IA'
            tw = d.textlength(tag, font=F_SMALL)
            d.rounded_rectangle((W - tw - 78, 92, W - 40, 138), 23, fill=(32, 34, 44, 255), outline=(90, 92, 104, 255), width=2)
            d.text((W - tw - 59, 97), tag, font=F_SMALL, fill=(230, 230, 230))

            float_y = math.sin(t * 2.0) * 14
            rot = math.sin(t * 1.3) * 2.5
            punch = 1 + 0.06 * max(0.0, 1 - lt / 0.25)
            if scene == 'hook':
                s = 0.35 + 0.65 * ease_out_back(lt / 0.7)
                paste_center(frame, hero, W / 2, 640 + float_y, s, rot)
            elif scene == 'spec':
                paste_center(frame, hero, W / 2, 560 + float_y, 0.82 * punch, rot)
                k = line.get('spec', 0)
                if k < len(spec_cards):
                    p = ease_out_back(lt / 0.45)
                    paste_center(frame, spec_cards[k], W / 2 + (1 - ease_out(lt / 0.35)) * 500, 1030, 0.5 + 0.5 * p)
            elif scene == 'combo':
                paste_center(frame, hero, 300, 480 + float_y, 0.5, rot)
                if combo is not None:
                    paste_center(frame, combo, 690 + (1 - ease_out(lt / 0.5)) * 600, 560 - float_y, 0.9 * punch, -rot)
                paste_center(frame, combo_text, W / 2, 1060, 0.4 + 0.6 * ease_out_back(lt / 0.5))
            elif scene == 'price':
                paste_center(frame, hero, W / 2, 520 + float_y, 0.7, rot)
                shake = math.sin(lt * 60) * 10 * max(0.0, 1 - lt / 0.5)
                paste_center(frame, price_card, W / 2 + shake, 1010, 0.3 + 0.7 * ease_out_back(lt / 0.5), -2)
                for k in range(10):  # brilhos
                    a = k * 0.63 + t * 1.5
                    sx, sy = W / 2 + math.cos(a) * 470, 1010 + math.sin(a) * 260
                    rr = 6 + 4 * math.sin(t * 8 + k)
                    d.ellipse((sx - rr, sy - rr, sx + rr, sy + rr), fill=(255, 220, 120, 220))
            else:  # cta
                paste_center(frame, hero, W / 2, 540 + float_y, 0.72, rot)
                paste_center(frame, cta_card, W / 2, 1040, (0.4 + 0.6 * ease_out_back(lt / 0.5)) * (1 + 0.03 * math.sin(t * 7)))

            # mascote falando
            fi_env = min(fi, len(env) - 1)
            speaking = line['start'] <= t <= line['start'] + line['dur']
            open_ = env[fi_env] if speaking else 0.0
            blink = (t % 3.3) < 0.12
            pose = 'wave' if scene in ('hook', 'cta') else 'point'
            m = mascot(open_, blink, t, pose, logo_chest)
            mx = 40
            my = 1380 + int(math.sin(t * 3.2) * 6)
            if fi < 12:
                my += int((1 - fi / 12) * 400)
            frame.alpha_composite(m, (mx, my))

            # legenda
            if speaking:
                cur_word, cur_group = None, None
                for g in line['groups']:
                    for w in g:
                        if lt >= w['start']:
                            cur_word, cur_group = w, g
                if cur_group is None and line['groups']:
                    cur_group = line['groups'][0]
                if cur_group:
                    draw_caption(frame, cur_group, cur_word)
            # clarão no começo
            if t < 0.25:
                flash = Image.new('RGBA', (W, H), (255, 255, 255, int(200 * (1 - t / 0.25))))
                frame.alpha_composite(flash)
        else:
            # cartela final: o anúncio completo
            et = t - end_speech - 0.1
            a = ease_out(et / 0.5)
            s = 1.06 - 0.06 * ease_out(et / 1.6)
            paste_center(frame, full_ad, W / 2, H / 2, s, 0, a)

        enc.stdin.write(frame.convert('RGB').tobytes())
        if fi % 30 == 0:
            print('  quadros %d/%d' % (fi, frames), end='\r', flush=True)

    enc.stdin.close()
    enc.wait()
    if enc.returncode != 0:
        raise SystemExit('FFmpeg falhou ao montar o vídeo')
    print('  quadros %d/%d' % (frames, frames))


if __name__ == '__main__':
    main()
