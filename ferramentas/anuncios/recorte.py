"""Recorta o produto do fundo claro (preenchimento a partir das bordas) e amplia 2x."""
import json
import sys
from collections import deque
from PIL import Image, ImageChops, ImageFilter


def cut(src, dst, mode='cut', limit=238):
    im = Image.open(src).convert('RGB')
    if mode == 'card':
        im.save(dst)
        return
    w, h = im.size
    px = im.load()
    mask = Image.new('L', (w, h), 0)
    m = mask.load()
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if m[x, y]:
            continue
        r, g, b = px[x, y]
        if not (r > limit and g > limit and b > limit and max(r, g, b) - min(r, g, b) < 18):
            continue
        m[x, y] = 255
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    if mode == 'holes':
        # produto escuro: tira também as áreas brancas fechadas (ex.: dentro da pulseira)
        for y in range(h):
            for x in range(w):
                r, g, b = px[x, y]
                if r > 228 and g > 228 and b > 228:
                    m[x, y] = 255
    alpha = ImageChops.invert(mask).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    box = out.getbbox()
    if box:
        out = out.crop(box)
    out = out.resize((out.width * 2, out.height * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 60, 2))
    out.save(dst)


for job in json.loads(sys.argv[1]):
    cut(*job)
