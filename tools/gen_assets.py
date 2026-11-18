#!/usr/bin/env python3
"""Gerador dos recursos visuais (pixel art -> SVG) do PIXEL ADVENTURE.
Cada imagem e desenhada em uma grade de pixels e exportada como SVG
(shape-rendering: crispEdges), mantendo o visual pixel art nitido em qualquer tela.
Uso: python3 tools/gen_assets.py  (os arquivos vao para assets/images/)"""
import os, math, random

OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'images'))
os.makedirs(OUT, exist_ok=True)
INK = '#1f1a2e'

def save(g, w, h, name, scale=4):
    """Converte a grade {(x,y):cor} em SVG, agrupando pixels por cor."""
    by = {}
    for y in range(h):
        x = 0
        while x < w:
            c = g.get((x, y))
            if c is None:
                x += 1; continue
            e = x
            while e + 1 < w and g.get((e + 1, y)) == c: e += 1
            by.setdefault(c, []).append('M%d %dh%dv1h-%dz' % (x, y, e - x + 1, e - x + 1))
            x = e + 1
    body = ''.join('<path fill="%s" d="%s"/>' % (c, ''.join(d)) for c, d in by.items())
    with open(os.path.join(OUT, name + '.svg'), 'w') as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" shape-rendering="crispEdges">%s</svg>' % (w * scale, h * scale, w, h, body))

def art(rows, pal, ox=0, oy=0, g=None):
    g = {} if g is None else g
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal: g[(x + ox, y + oy)] = pal[ch]
    return g

def outline(g, w, h, col=INK):
    add = {}
    for (x, y) in g:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + dx, y + dy)
            if p not in g and 0 <= p[0] < w and 0 <= p[1] < h: add[p] = col
    g.update(add); return g

def disc(g, cx, cy, r, col, ox=0, oy=0):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: g[(x + ox, y + oy)] = col

def shift(g, ox, oy):
    return {(x + ox, y + oy): c for (x, y), c in g.items()}

# ---------------------------------------------------------------- PERSONAGEM
PAL = dict(H='#5b351b', h='#9a6130', S='#f4c795', E=INK, R='#d8443c', r='#9e2b2e', B='#33509e',
           K='#43301f', P='#c98a2e', p='#8a5a1b', G='#f7c93e')
UP = ["....HHHHHH......", "...HHhhhHHH.....", "..HHHHHHHHHH....", "..HGGGGGGGGG....",
      "..HHSSSSSSSS....", "..HHSSSSSESS....", "..HHSSSSSSSS....", "....SSSSSSS.....",
      "..GGGRRRRRR.....", "..PPRRRRRRRR....", ".PPPRRrRRRRSS...", ".PppRRRRRRRR....",
      ".PppRRRRRRRR....", "..ppGGGGGGGG....", "....BBBBBBBB....", "....BBBBBBBB...."]
E8 = "................"
LEGS = {
 'idle': ["....BBBBBBBB....", ".....BBBBBB.....", ".....BBB.BB.....", ".....BBB.BB.....", ".....KKK.KK.....", "....KKKK.KKK....", E8, E8],
 'run1': ["....BBB..BBB....", "...BBB....BBB...", "...BBB.....BBB..", "..BBB.......BB..", "..KKK.......KKK.", ".KKKK.......KKKK", E8, E8],
 'run3': ["....BBB..BBB....", "....BB....BBB...", "...BB.....BBB...", "..BBB......BB...", "..KKK......KKK..", ".KKKK......KKKK.", E8, E8],
 'jump': ["....BBBBBBBB....", "...BBBB..BBBB...", "..BBB.....BBB...", "..KKK.....KKK...", E8, E8, E8, E8],
 'fall': ["....BBBB.BBBB...", "...BBB.....BBB..", "..BBB.......BBB.", "..KKK.......KKK.", E8, E8, E8, E8],
}
for r in UP + sum(LEGS.values(), []): assert len(r) == 16, r
FW, FH = 18, 26

def frame(legs, up=UP):
    g = art(up, PAL, 1, 1); art(legs, PAL, 1, 17, g)
    return outline(g, FW, FH)

sheet = {}
for i, k in enumerate(['idle', 'run1', 'run3', 'jump', 'fall']):
    sheet.update(shift(frame(LEGS[k]), i * FW, 0))
save(sheet, FW * 5, FH, 'player')
dead = list(UP)
dead[4] = "..HHSSSSESES...."; dead[5] = "..HHSSSSSESS...."; dead[6] = "..HHSSSSESES...."
save(frame(LEGS['fall'], dead), FW, FH, 'player-defeated')

# ---------------------------------------------------------------- CENARIO
def hexc(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
def tohex(c): return '#%02x%02x%02x' % tuple(int(v) for v in c)
def lerp(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def sky():
    W, H, N = 240, 135, 16
    stops = [(0, '#2f5fd0'), (.35, '#5aa2f0'), (.65, '#9bd6ff'), (.88, '#ffe2a8'), (1, '#ffbf86')]
    bay = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    def col(t):
        for i in range(len(stops) - 1):
            a, b = stops[i], stops[i + 1]
            if t <= b[0]: return lerp(hexc(a[1]), hexc(b[1]), (t - a[0]) / (b[0] - a[0]))
        return hexc(stops[-1][1])
    g = {}
    for y in range(H):
        for x in range(W):
            t = y / (H - 1) * N; k = int(t)
            if t - k > bay[y % 4][x % 4] / 16: k += 1
            g[(x, y)] = tohex(col(min(k, N) / N))
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - 175, y - 60)
            if d < 10: g[(x, y)] = '#fffbe0'
            elif d < 13: g[(x, y)] = '#ffec99'
    save(g, W, H, 'background')
sky()

def clouds():
    W, H = 200, 40
    defs = [(32, 24, [(-8, 3, 5), (0, 0, 7), (9, 2, 6), (16, 4, 4)]), (95, 14, [(-6, 2, 4), (0, 0, 6), (8, 2, 5)]),
            (140, 26, [(-9, 3, 5), (-1, 0, 8), (9, 1, 6), (17, 4, 4)]), (180, 12, [(-5, 2, 4), (0, 0, 5), (6, 2, 4)])]
    ins = {}
    for cx, cy, ps in defs:
        for dx, dy, r in ps: disc(ins, cx + dx, cy + dy, r, 1)
    g = {}
    for (x, y) in ins:
        if (x, y + 2) not in ins: c = '#c9dcf6'
        elif (x, y + 1) not in ins: c = '#e2ecfb'
        else: c = '#ffffff'
        g[(x, y)] = c
    save({k: v for k, v in g.items() if 0 <= k[0] < W and 0 <= k[1] < H}, W, H, 'clouds')
clouds()

def ridge(W, H, comps, base, col, hi, sh, name):
    g = {}
    for x in range(W):
        h = base + sum(a * math.sin(2 * math.pi * k * x / W + ph) for a, k, ph in comps)
        top = int(H - h)
        for y in range(max(0, top), H):
            c = col
            if y == top: c = hi
            elif y < top + 3 and h > H * 0.82: c = '#f4f8ff'
            elif (x + y * 2) % 12 < 3 and y > top + 2: c = sh
            g[(x, y)] = c
    save(g, W, H, name)
ridge(200, 64, [(10, 2, .3), (6, 5, 1.2), (3, 11, 2.0)], 40, '#92a8e0', '#c9d8ff', '#8499d6', 'mountains-far')
ridge(200, 48, [(8, 3, 1.0), (4, 7, 2.2), (2, 13, .4)], 28, '#6d86c4', '#9db3e8', '#5f78b8', 'mountains-near')

def trees():
    W, H = 200, 72; base = H - 1; g = {}
    def round_tree(cx, s):
        for y in range(base - 18, base + 1):
            for x in range(cx - 1, cx + 2): g[(x, y)] = '#5a3a20' if x < cx + 1 else '#43291a'
        cs = {}
        for dx, dy, r in [(0, -30, 13 * s), (-8, -24, 9 * s), (8, -24, 9 * s), (0, -20, 10 * s)]:
            disc(cs, cx + dx, base + dy, r, 1)
        for (x, y) in cs:
            v = (x - cx) * .4 + (y - (base - 28)) * .8
            g[(x, y)] = '#59c25f' if v < -8 else ('#2f9a4b' if v < 6 else '#1f6e3a')
    def pine(cx):
        for y in range(base - 10, base + 1):
            for x in range(cx - 1, cx + 2): g[(x, y)] = '#5a3a20'
        for i in range(3):
            tip = base - 52 + i * 12; hh = 22; hw = 7 + i * 4
            for r in range(hh):
                half = int(r / hh * hw) + 1
                for x in range(cx - half, cx + half + 1):
                    g[(x, tip + r)] = '#3aa05a' if x < cx - half // 3 else ('#1f6e46' if x < cx + half // 2 else '#17583a')
    round_tree(24, 1); pine(70); round_tree(118, .85); pine(165)
    for bx in (95, 142, 190):
        cs = {}; disc(cs, bx, base - 3, 6, 1)
        for (x, y) in cs: g[(x, y)] = '#3cae55' if y < base - 5 else '#277a41'
    save({k: v for k, v in g.items() if 0 <= k[0] < W and 0 <= k[1] < H}, W, H, 'trees')
trees()

def ground():
    W, H = 16, 25; r = random.Random(5); g = {}
    for y in range(H):
        for x in range(W):
            if y == 0:
                if x % 5 == 2: continue
                c = '#9cef63' if x % 4 else '#7ed957'
            elif y == 1: c = '#6fd055'
            elif y == 2: c = '#4fb046'
            elif y == 3: c = '#3f9a3c' if (x * 7 % 5) < 3 else '#9a6a3d'
            else:
                c = ['#a06f40', '#946538', '#885c32', '#7c532c'][min(3, (y - 4) // 6)]
                v = r.random()
                if v < .09: c = '#6b4524'
                elif v < .15: c = '#b98a57'
            g[(x, y)] = c
    for sx, sy in ((3, 10), (11, 16), (7, 21)):
        for dx in range(3):
            for dy in range(2): g[(sx + dx, sy + dy)] = '#b9b2a6' if dy == 0 else '#8c857a'
    save(g, W, H, 'ground')
ground()

def platform():
    g = {}
    for x in range(16):
        g[(x, 0)] = '#7ed957'; g[(x, 1)] = '#4fb046' if x % 4 else '#3f9a3c'
        g[(x, 2)] = '#3f9a3c' if x % 3 else '#9a6a3d'
        g[(x, 3)] = '#a06f40' if x % 5 else '#b98a57'; g[(x, 4)] = '#7c532c'; g[(x, 5)] = '#4a2c18'
    save(g, 16, 6, 'platform')
platform()

# ---------------------------------------------------------------- OBJETOS
def coin():
    g = {}
    for y in range(10):
        for x in range(10):
            d = math.hypot(x - 4.5, y - 4.5)
            if d <= 4.9:
                g[(x + 1, y + 1)] = '#b8740f' if d > 3.9 else ('#e8a417' if d > 3 else '#f6c427')
    for p in ((3, 3), (4, 2), (3, 4), (5, 2)): g[(p[0] + 1, p[1] + 1)] = '#fff6b0'
    for p in ((4, 3), (5, 3), (4, 4), (5, 4), (4, 5), (5, 5), (4, 6), (5, 6)): g[(p[0] + 1, p[1] + 1)] = '#c27b12'
    save(outline(g, 12, 12, '#6b3d08'), 12, 12, 'coin')
coin()

def clock():
    g = {}
    for y in range(12):
        for x in range(12):
            d = math.hypot(x - 5.5, y - 5.5)
            if d <= 5.4: g[(x, y)] = '#d8443c' if d > 4.2 else '#fff7e0'
    for y in range(2, 6): g[(5, y)] = INK; g[(6, y)] = INK
    for x in range(6, 9): g[(x, 6)] = INK
    save(outline(g, 12, 12), 12, 12, 'clock')
clock()

def crate():
    g = {}
    for y in range(12):
        for x in range(12):
            edge = x in (0, 11) or y in (0, 11)
            g[(x + 1, y + 1)] = '#5a3512' if edge else ('#a8672a' if x in (1, 10) or y in (1, 10) else '#c98a3a')
    for i in range(2, 10):
        g[(i + 1, i + 1)] = '#8d5a22'; g[(12 - i, i + 1)] = '#8d5a22'
    for x in range(3, 10): g[(x + 1, 2)] = '#e5ad5a'
    for p in ((2, 2), (11, 2), (2, 11), (11, 11)): g[p] = '#3d260f'
    save(outline(g, 14, 14, '#2b190a'), 14, 14, 'crate')
crate()

def cactus():
    g = {}
    def rect(x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): g[(x + 1, y + 1)] = '#7bd36a' if x == x0 else ('#2a7a38' if x == x1 else '#3fa04a')
    rect(3, 1, 6, 15); rect(4, 0, 5, 0); rect(0, 3, 1, 8); rect(0, 7, 3, 8); rect(8, 5, 9, 10); rect(6, 9, 9, 10)
    for p in ((4, 4), (5, 8), (4, 12), (0, 5), (9, 7), (5, 2), (5, 14)): g[(p[0] + 1, p[1] + 1)] = '#f5f0c8'
    save(outline(g, 12, 18, '#1d4a2a'), 12, 18, 'cactus')
cactus()

def obstacles():
    sp = {}
    for k in range(3):
        for y in range(6):
            half = (1 if y < 2 else 2) if y < 5 else 6
            for x in range(4 * k + 2 - half, 4 * k + 2 + half): sp[(x + 1, y + 1)] = '#cfd8e6' if x == 4 * k + 2 - half else '#8793a8'
        for y in range(2, 5): sp[(4 * k + 4, y + 1)] = '#4a5468'
    for x in range(12): sp[(x + 1, 6)] = '#4a5468'
    sp = outline(sp, 14, 8, INK)
    rk = {}
    for y, hw in enumerate([3, 4, 5, 5, 6, 6, 6, 6]):
        for x in range(6 - hw, 6 + hw):
            c = '#8d96a3'
            if y < 2 or (x < 6 - hw + 2 and y < 5): c = '#c2c9d3'
            if y > 5 or x > 6 + hw - 3: c = '#5c6573'
            rk[(x + 1, y + 1)] = c
    for p in ((6, 3), (6, 4), (7, 5)): rk[(p[0] + 1, p[1] + 1)] = '#4a5260'
    for p in ((4, 0), (5, 0), (6, 0), (3, 1)): rk[(p[0] + 1, p[1] + 1)] = '#5fae4f'
    rk = outline(rk, 14, 10, INK)
    save({**shift(sp, 0, 2), **shift(rk, 15, 0)}, 30, 10, 'obstacles')
obstacles()

def decor():
    sheet = {}
    b = {}
    for dx, dy, r, c in [(5, 5, 4, '#2f9a4b'), (10, 5, 4, '#2f9a4b'), (8, 3, 4, '#59c25f'), (3, 7, 2.5, '#277a41'), (13, 7, 2.5, '#277a41')]: disc(b, dx + 1, dy + 1, r, c)
    sheet.update(shift(outline(b, 18, 12, '#1d4a2a'), 0, 0))
    t = {}
    for x, hh in ((1, 3), (3, 5), (5, 4), (7, 3)):
        for y in range(5 - hh, 5): t[(x + 1, y + 1)] = '#3fa04a' if y > 5 - hh else '#7bd36a'
    sheet.update(shift(outline(t, 10, 7, '#1d4a2a'), 18, 5))
    m = {}
    for y in range(3, 6):
        for x in (2, 3): m[(x + 1, y + 1)] = '#f2e6d0'
    for y in range(0, 3):
        for x in range(0, 6): m[(x + 1, y + 1)] = '#e04848'
    m[(2, 2)] = '#fff'; m[(5, 3)] = '#fff'
    sheet.update(shift(outline(m, 8, 8, INK), 28, 4))
    f = {}
    for y in range(4, 8): f[(3, y + 1)] = '#3fa04a'
    for p in ((2, 1), (3, 0), (4, 1), (3, 2)): f[(p[0] + 1, p[1] + 1)] = '#ff7bb0'
    f[(4, 2)] = '#ffe36a'
    sheet.update(shift(outline(f, 8, 10, '#1d4a2a'), 36, 2))
    save(sheet, 44, 12, 'decor')
decor()
print('Recursos gerados em', OUT)
