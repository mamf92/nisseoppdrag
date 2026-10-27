#!/usr/bin/env python3
"""Nisseoppdrag icon set "Karveskurd" (chip-carving style).

Every icon is one solid silhouette in currentColor with knife cuts (incisions, chip triangles,
dots) cut out of it through an SVG mask. The cuts show whatever is behind the icon, so the same
icon works on a category tile, a dark barn board or a white card in both themes.

Run:  python3 apps/web/scripts/icons/build_icons.py
Writes: apps/web/src/ui/sprite.svg (inlined once in the app by <IconSprite />) and preview.html here
"""
import math
from pathlib import Path

HERE = Path(__file__).parent
APP_UI = HERE.parent.parent / "src" / "ui"

# ---------------------------------------------------------------- drawing helpers
# A layer is ("w", markup) for silhouette (kept) or ("k", markup) for cuts (removed).
# Markup uses the placeholder C for the colour, so one string serves both layers.

def f(d, extra=""):
    return f'<path d="{d}" fill="C" {extra}/>'

def s(d, w=1.6, extra=""):
    return f'<path d="{d}" fill="none" stroke="C" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'

def c(cx, cy, r, extra=""):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="C" {extra}/>'

def cs(cx, cy, r, w=1.4):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="C" stroke-width="{w}"/>'

def r(x, y, w, h, rx=0, extra=""):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="C" {extra}/>'

def e(cx, cy, rx, ry, extra=""):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="C" {extra}/>'

def g(transform, *items):
    return f'<g transform="{transform}">' + "".join(items) + "</g>"

def zigzag(x0, x1, y, h, n):
    """Chip-carved zigzag band from x0 to x1 with n teeth."""
    step = (x1 - x0) / (n * 2)
    pts = [f"{x0:.2f} {y:.2f}"]
    for i in range(1, n * 2 + 1):
        pts.append(f"{x0 + i * step:.2f} {y + (h if i % 2 else 0):.2f}")
    return "M" + " L".join(pts)

def star_rays(cx, cy, rad, n=8):
    out = []
    for i in range(n):
        a = math.pi * 2 * i / n
        out.append(f"M{cx:.2f} {cy:.2f} L{cx + rad * math.cos(a):.2f} {cy + rad * math.sin(a):.2f}")
    return " ".join(out)

def petals(cx, cy, rr, n=6):
    """Hexafoil (seksbladrose) petals as lens outlines, the classic carved rosette."""
    out = []
    for i in range(n):
        a = 360 * i / n
        out.append(g(f"rotate({a} {cx} {cy})",
                     s(f"M{cx} {cy} A{rr} {rr} 0 0 1 {cx} {cy - 2 * rr} A{rr} {rr} 0 0 1 {cx} {cy}", 1.1)))
    return "".join(out)

# ---------------------------------------------------------------- the set
MITTEN = (
    f("M10.2 17 C10.8 13 11 9 11 6.5 C11 2.5 9.2 0 6.8 0 C4.4 0 2.8 2.5 2.8 6 V9.2 C2 8.2 0.6 8.1 0 9.2 C-0.5 10.3 0.4 11.6 1.4 12.8 L2.8 14.6 V17 Z")
    + r(2.2, 16.4, 8.6, 5.4, 1.3)
)
MITTEN_CUT = (
    s("M2.8 17.6 H10.6", 1.1) + s("M5 18.9 V20.6 M6.9 18.9 V20.6 M8.8 18.9 V20.6", 1)
    + s(star_rays(6.9, 7.2, 2.3), 1)
)

ICONS = {
    # ---- categories
    "social": [  # two kåser (wooden cups) clinking
        ("w", g("rotate(10 7.8 26)", r(2.8, 12, 10, 14, 2.4), s("M2.8 15.6 C-0.4 15.6 -0.4 21.6 2.8 21.6", 2.2))),
        ("w", g("rotate(-10 24.2 26)", r(19.2, 12, 10, 14, 2.4), s("M29.2 15.6 C32.4 15.6 32.4 21.6 29.2 21.6", 2.2))),
        ("w", s("M16 8.6 V4.4 M12.4 9 L10.8 6.4 M19.6 9 L21.2 6.4", 1.7)),
        ("k", g("rotate(10 7.8 26)", s("M4.4 14.8 H11.2", 1.1), s(zigzag(4.4, 11.2, 17.4, 2.4, 3), 1.2), s("M4.4 22.6 H11.2", 1.1))),
        ("k", g("rotate(-10 24.2 26)", s("M20.8 14.8 H27.6", 1.1), s(zigzag(20.8, 27.6, 17.4, 2.4, 3), 1.2), s("M20.8 22.6 H27.6", 1.1))),
    ],
    "kindness": [  # folk heart with carved inner heart
        ("w", f("M16 28 C9 23 3 18 3 11.5 C3 7.5 6 4.5 9.8 4.5 C12.6 4.5 14.8 6 16 8.4 C17.2 6 19.4 4.5 22.2 4.5 C26 4.5 29 7.5 29 11.5 C29 18 23 23 16 28Z")),
        ("k", s("M16 22.4 C11.6 19.3 8 16 8 12.4 C8 10.4 9.4 9 11.2 9 C13 9 14.6 10.3 16 12.7 C17.4 10.3 19 9 20.8 9 C22.6 9 24 10.4 24 12.4 C24 16 20.4 19.3 16 22.4Z", 1.5)),
        ("k", c(16, 15.6, 1.6) + c(5.6, 11.2, .9) + c(26.4, 11.2, .9)),
    ],
    "learning": [  # open book with rune lines
        ("w", f("M2.5 8 C7 6.4 11.5 6.8 16 9.5 C20.5 6.8 25 6.4 29.5 8 V25 C25 23.6 20.5 23.9 16 26.6 C11.5 23.9 7 23.6 2.5 25Z")),
        ("k", s("M16 9.8 V26.2", 1.5)),
        ("k", s("M5.6 12.6 C8.4 11.8 10.8 12 13.4 13.3 M5.6 16.6 C8.4 15.8 10.8 16 13.4 17.3 M5.6 20.6 C7.4 20 9 20.1 10.6 20.7", 1.3)),
        ("k", s("M26.4 12.6 C23.6 11.8 21.2 12 18.6 13.3 M26.4 16.6 C23.6 15.8 21.2 16 18.6 17.3 M26.4 20.6 C24.6 20 23 20.1 21.4 20.7", 1.3)),
    ],
    "collaboration": [  # two Selbu mittens giving a high five
        ("w", g("translate(2.2 6.6) rotate(7 6.5 22)", MITTEN)),
        ("w", g("translate(32 0) scale(-1 1) translate(2.2 6.6) rotate(7 6.5 22)", MITTEN)),
        ("k", g("translate(2.2 6.6) rotate(7 6.5 22)", MITTEN_CUT)),
        ("k", g("translate(32 0) scale(-1 1) translate(2.2 6.6) rotate(7 6.5 22)", MITTEN_CUT)),
        ("w", s("M16 4.4 V1.8 M12.6 4.8 L11.6 3 M19.4 4.8 L20.4 3", 1.4)),
    ],
    "holiday_fun": [  # julebukk, the straw yule goat with its bands
        ("w", s("M8.6 15.8 H20", 7) + s("M20.6 14.6 L23.6 9.4", 4.6) + s("M23.6 9.2 L27.6 11.4", 3.8)),
        ("w", s("M9.6 18 L8.8 27 M13 18.4 L13.2 27 M17.2 18.4 L17 27 M20 18 L21.2 27", 2.6)),
        ("w", s("M23.2 8 C22.4 3.6 18 2.8 16.6 6.6", 2.2) + s("M6 13.6 L3.6 10.4", 2.2) + s("M26.4 13 L26.8 15.4", 1.6)),
        ("k", s("M11 12.6 V19 M14.4 12.6 V19 M17.8 12.6 V19", 1.3) + s("M20.6 12 L23.4 13.6", 1.2)),
        ("k", s("M8.2 23.4 H10.2 M12.2 23.4 H14.2 M16 23.4 H18 M19.8 23.4 H21.8", 1)),
        ("k", c(24.8, 9.6, .75)),
    ],
    # ---- tokens
    "skip": [  # tresko (wooden clog) hopping over: Hopp over
        ("w", f("M3.6 25 C3.6 21.4 5 19.4 7.4 18.8 L8.8 16 C9.6 14.8 11.2 14.6 12.4 15.2 L16.6 17.2 C19.6 18.6 22.6 19.6 25.6 19.8 C26.6 19.2 27.4 18.2 27.6 16.8 C29.4 17.8 30.2 20.4 29 22.4 C28 25.4 24.8 27 19.8 27 H6.2 C4.6 27 3.6 26.2 3.6 25Z")),
        ("k", e(11, 17.2, 2.2, .9, 'transform="rotate(24 11 17.2)"') + s("M7.4 24.2 C9.4 22.2 12.4 22.6 13.8 24.6", 1.1) + c(17.4, 23.2, .8) + c(21, 23.6, .8) + s("M5.4 25.4 H26", .9, 'stroke-dasharray="1.4 1.4"')),
        ("w", s("M4.4 13.4 C7 5.8 17.2 3.4 24 8.6", 2.2) + f("M27 11.2 L20.8 10.8 L25.2 5.6Z")),
    ],
    "sack": [  # Rist sekken: the nisse sack, shaken
        ("w", f("M12 9.5 C7 12 4.6 16.4 5 21.2 C5.5 26.2 9.6 28.6 16 28.6 C22.4 28.6 26.5 26.2 27 21.2 C27.4 16.4 25 12 20 9.5Z")),
        ("w", r(11.6, 7.4, 8.8, 3.2, 1.4) + f("M12.6 7.8 C11 5.2 11.6 3 13.6 3 C14.9 3 15.5 4.6 16 6.1 C16.5 4.6 17.1 3 18.4 3 C20.4 3 21 5.2 19.4 7.8Z")),
        ("w", s("M2.6 13.4 C1.4 15.6 1.4 18 2.6 20.2 M29.4 13.4 C30.6 15.6 30.6 18 29.4 20.2", 1.6)),
        ("k", s("M12.4 9 H19.6", 1.1) + s(star_rays(16, 19.4, 4.2), 1.2) + c(16, 19.4, 1.2)),
        ("k", s("M8.6 24.6 C12 26.4 20 26.4 23.4 24.6", 1, 'stroke-dasharray="1.6 1.6"')),
    ],
    # ---- navigation
    "barn": [  # låve with X-braced door and lit hay loft
        ("w", f("M2.5 14.5 L8 7 L16 3.2 L24 7 L29.5 14.5 V28.5 H2.5Z")),
        ("k", s("M11 28.5 V17.5 H21 V28.5 M11 17.5 L21 28.5 M21 17.5 L11 28.5", 1.4)),
        ("k", r(13.8, 8.6, 4.4, 4.6, .6)),
        ("k", s("M6.2 16.5 V28.5 M25.8 16.5 V28.5", 1.1) + s("M5.4 14 L9.4 8.8 L16 5.7 L22.6 8.8 L26.6 14", 1)),
    ],
    "trophy": [  # kjenge: the ale bowl with horse-head handles, our trophy
        ("w", f("M5 12 H27 C27 19 22.5 23.2 16 23.2 C9.5 23.2 5 19 5 12Z") + f("M12.2 22.6 H19.8 L21.6 27.8 H10.4Z")),
        ("w", f("M6.6 13.4 C3.8 12.4 2.6 9.6 3.2 7 C3.6 5.1 5 4 6.6 4.3 L9.3 5 C10 5.2 10 6.1 9.3 6.3 L7.2 6.9 C6.8 8.6 7.4 10.6 9.4 12.4Z")),
        ("w", f("M25.4 13.4 C28.2 12.4 29.4 9.6 28.8 7 C28.4 5.1 27 4 25.4 4.3 L22.7 5 C22 5.2 22 6.1 22.7 6.3 L24.8 6.9 C25.2 8.6 24.6 10.6 22.6 12.4Z")),
        ("k", s(zigzag(7.4, 24.6, 14.6, 2.4, 6), 1.1) + s("M9.4 18.8 C13.6 20.6 18.4 20.6 22.6 18.8", 1)),
        ("k", c(5.6, 6.3, .75) + c(26.4, 6.3, .75) + s("M11.8 25.6 H20.2", 1)),
    ],
    "medal": [  # carved rosette medallion with ribbons
        ("w", f("M10.6 18 L7.2 29.4 L11.2 27.4 L13.4 30.2 L15.8 20.4Z") + f("M21.4 18 L24.8 29.4 L20.8 27.4 L18.6 30.2 L16.2 20.4Z")),
        ("w", c(16, 12.6, 8.6) + "".join(c(round(16 + 8.4 * math.cos(math.pi * i / 6), 2), round(12.6 + 8.4 * math.sin(math.pi * i / 6), 2), 2.1) for i in range(12))),
        ("k", cs(16, 12.6, 6, 1.2) + petals(16, 12.6, 2.45)),
    ],
    "cap": [  # nisselue: Meg
        ("w", f("M6.4 24 C7.4 16 10.4 9 15.4 5.6 C18.8 3.2 22.8 3.6 25.2 6 C26.8 7.6 27.6 9.6 27.6 11.6 C25.6 10.2 23.2 10.2 21.8 11.8 C23.8 15.2 25.2 19.6 26.2 24Z")),
        ("w", c(27.6, 13.4, 2.6) + r(4.4, 22.4, 23.2, 6.4, 2.6)),
        ("k", s(zigzag(7, 25, 24.4, 2.4, 6), 1.1) + s("M12.6 12.4 C14 9.6 16 7.6 18.4 6.6", 1.1) + c(17.6, 16.6, .9) + c(14.2, 19.4, .9) + c(20.2, 20, .9)),
    ],
    "key": [  # Nissefars nøkkel: the office key with a heart in the bow
        ("w", c(8.6, 16, 6.2) + r(13.4, 14.5, 16, 3, 1) + r(21.8, 16.8, 2.6, 5, .6) + r(25.8, 16.8, 2.6, 6.6, .6)),
        ("k", f("M8.6 19.6 C6.4 18 4.8 16.5 4.8 14.6 C4.8 13.4 5.7 12.5 6.8 12.5 C7.6 12.5 8.2 13 8.6 13.8 C9 13 9.6 12.5 10.4 12.5 C11.5 12.5 12.4 13.4 12.4 14.6 C12.4 16.5 10.8 18 8.6 19.6Z")),
        ("k", s("M16.4 16 H19.6", 1)),
    ],
    # ---- badges
    "spoon": [  # grøtsleiv
        ("w", e(10.4, 10.4, 6, 7.6, 'transform="rotate(-45 10.4 10.4)"') + s("M13.6 13.6 L26 26", 3.4) + c(26.8, 26.8, 2.6)),
        ("k", e(10.4, 10.4, 3.4, 4.8, 'transform="rotate(-45 10.4 10.4)" fill-opacity="0" stroke="C" stroke-width="1.2"')),
        ("k", c(18.6, 18.6, .8) + c(21.2, 21.2, .8) + c(26.8, 26.8, .9)),
    ],
    "lantern": [  # lykt with a living flame
        ("w", s("M12.6 7 C12.6 2.6 19.4 2.6 19.4 7", 2) + f("M9.8 9.4 L12 6.4 H20 L22.2 9.4Z") + r(9.4, 9, 13.2, 15.2, 1) + r(8.2, 24, 15.6, 3.8, 1.2)),
        ("k", r(11.6, 11.2, 3.8, 10.8, .4) + r(16.6, 11.2, 3.8, 10.8, .4) + s("M10.4 25.9 H21.6", .9, 'stroke-dasharray="1.4 1.4"')),
        ("w", f("M16 20.6 C13.8 19 14.2 16.4 16 13.8 C17.8 16.4 18.2 19 16 20.6Z")),
        ("k", c(16, 18.4, .9)),
    ],
    "aurora": [  # nordlys curtain over the spruce forest
        ("w", f("M" + " L".join(f"{x:.1f} {7 + 3.2 * math.sin(x / 3.4 + .5):.1f}" for x in range(3, 30, 2)) + " " + " ".join(f"L{x:.1f} {14.4 + 2.4 * math.sin(x / 3.4 - .4):.1f}" for x in range(29, 2, -2)) + "Z", 'stroke="C" stroke-width="1.6" stroke-linejoin="round"')),
        ("k", "".join(s(f"M{x:.1f} {14.4 + 2.4 * math.sin(x / 3.4 - .4) + .8:.1f} V{7 + 3.2 * math.sin(x / 3.4 + .5) + (3.4 if i % 2 else 1.8):.1f}", 1) for i, x in enumerate(range(5, 29, 3)))),
        ("w", f("M7 18.6 L11 26.5 H3Z") + f("M15.8 15.6 L21 26.5 H10.6Z") + f("M25 18.8 L29 26.5 H21Z") + r(2, 26, 28, 3.4, 1)),
        ("k", s("M15.8 20.6 L13.6 23.8 M15.8 20.6 L18 23.8 M7 22 L5.6 24.2 M7 22 L8.4 24.2 M25 22.2 L23.6 24.4 M25 22.2 L26.4 24.4", 1) + s("M5.4 27.7 H26.6", .9, 'stroke-dasharray="1.4 1.6"')),
    ],
    "fiddle": [  # hardingfele: Låvedans
        ("w", s("M5.2 6.4 L25.4 27", 1.3) + s("M4.2 7.6 L6.4 5.4", 1.8)),
        ("w", g("translate(16 16) rotate(28) scale(1.06) translate(-16 -16)", e(16, 22.4, 6.6, 5.6) + e(16, 14.8, 5.2, 4.6) + r(12.6, 14.6, 6.8, 8) + r(14.9, 3.8, 2.2, 10, 1) + c(16, 3.8, 2.1) + r(14, 27, 4, 2, .8))),
        ("k", g("translate(16 16) rotate(28) scale(1.06) translate(-16 -16)", f("M11.4 19.4 C12.6 18.6 12.6 17.2 11.4 16.6Z") + f("M20.6 19.4 C19.4 18.6 19.4 17.2 20.6 16.6Z")
                + s("M13.4 21.6 C12.6 20.4 13.2 19.4 14 19.4 M18.6 21.6 C19.4 20.4 18.8 19.4 18 19.4", .9)
                + s("M16 12.4 V25.4", .9) + s("M13.2 24.6 H18.8", 1.1) + c(16, 3.8, .8) + s("M11 25 C12.6 27 19.4 27 21 25", .8, 'stroke-dasharray="1.2 1.2"'))),
    ],
    "owl": [  # vis ugle
        ("w", f("M8 9 L9.6 3.6 L13 6.8 C15 6.3 17 6.3 19 6.8 L22.4 3.6 L24 9 C26 12 26.6 17 25.2 21 C23.6 25.6 20 28 16 28 C12 28 8.4 25.6 6.8 21 C5.4 17 6 12 8 9Z")),
        ("w", s("M4.5 28.8 H27.5", 1.8)),
        ("k", cs(12.3, 12.6, 3, 1.3) + cs(19.7, 12.6, 3, 1.3) + f("M16 16.6 L14.6 14.6 H17.4Z")),
        ("k", s("M10.6 20 L12.6 22 L14.6 20 L16.6 22 L18.6 20 L20.6 22 M12.6 23.6 L14.6 25.6 L16.6 23.6 L18.6 25.6", 1.1)),
    ],
    "sled": [  # kjelke carrying a parcel: dugnad
        ("w", r(4.6, 13.4, 20.6, 4, 1.5) + r(8, 16.8, 2.4, 6.2) + r(19.4, 16.8, 2.4, 6.2)),
        ("w", s("M3 23.6 H23.6 C27.8 23.6 29.6 20.4 28 17", 2.4) + s("M27.6 16.4 C29.2 12 25.2 9 21.6 8.6", 1.2)),
        ("w", r(8.4, 5.6, 10, 7.8, 1)),
        ("k", s("M13.4 5.6 V13.4 M8.4 9.2 H18.4", 1.2) + s("M6.6 15.4 H23.2", 1, 'stroke-dasharray="2 1.4"')),
    ],
    "gingerbread": [  # pepperkakemann with icing
        ("w", c(16, 7.6, 4.8) + s("M7 15.2 H25", 5.2) + r(10.8, 10.8, 10.4, 12.6, 4.2) + s("M13 21 L10.4 27.6 M19 21 L21.6 27.6", 5.2)),
        ("k", c(14.3, 6.9, .9) + c(17.7, 6.9, .9) + s("M14 9.2 C15.2 10.3 16.8 10.3 18 9.2", 1)),
        ("k", c(16, 14.6, .9) + c(16, 17.8, .9) + s("M6.6 13.6 L7.6 16.8 M25.4 13.6 L24.4 16.8 M8.6 26.4 L12 27.6 M23.4 26.4 L20 27.6", 1)),
    ],
    "star": [  # åttebladsrose, the Selbu star
        ("w", "".join(g(f"rotate({45 * i} 16 16)", f("M16 16 L13.2 9.2 L16 2.2 L18.8 9.2Z")) for i in range(8))),
        ("k", "".join(g(f"rotate({45 * i} 16 16)", s("M16 13.2 V6.4", 1)) for i in range(8)) + c(16, 16, 1.4)),
    ],
    "farm": [  # gårdstun: farmhouse and stabbur
        ("w", f("M3 17.4 L10.6 10.6 L18.2 17.4 V27 H3Z") + r(5.4, 10.4, 2.6, 4.6)),
        ("w", f("M16.6 14.4 L23.2 8.6 L29.8 14.4 H28.2 V22 H18.2 V14.4Z") + r(19.4, 21.6, 1.8, 5.6) + r(25.2, 21.6, 1.8, 5.6)),
        ("w", r(1.6, 26.6, 28.8, 2.6, 1)),
        ("k", r(6.2, 19, 3.6, 3.6, .4) + s("M13.2 27 V20.6 H16 V27", 1.1)),
        ("k", r(21.6, 15.6, 3.2, 4.8, .4) + s("M18.4 14.6 L23.2 10.4 L28 14.6", .9)),
    ],
    "crown": [  # Overnissen
        ("w", f("M5 23 L4 10.6 L10 16 L16 7.6 L22 16 L28 10.6 L27 23Z") + c(4, 9.2, 2.1) + c(16, 6.2, 2.3) + c(28, 9.2, 2.1)),
        ("w", r(4.6, 22.6, 22.8, 5, 1.2)),
        ("k", s("M5.6 23.8 H26.4", 1) + "".join(f(f"M{x} 24.8 L{x + 1.4} 26 L{x} 27.2 L{x - 1.4} 26Z") for x in (8.5, 12.5, 16.5, 20.5, 24.5))),
        ("k", c(16, 15.6, 1.6) + c(10.4, 19.4, 1) + c(21.6, 19.4, 1)),
    ],
    "butter": [  # grøt with the butter eye (smørøye)
        ("w", f("M5.4 14.4 C6.4 8.6 11.2 6.4 16 6.4 C20.8 6.4 25.6 8.6 26.6 14.4Z") + f("M3.6 14 H28.4 C28.4 21.2 23.2 26.2 16 26.2 C8.8 26.2 3.6 21.2 3.6 14Z") + r(11.4, 25.4, 9.2, 2.8, 1)),
        ("k", g("rotate(45 16 10.4)", r(13.9, 8.3, 4.2, 4.2, .8)) + s("M18.6 12.6 C19.6 13.2 19.8 14 19.6 14.6", 1)),
        ("k", s(zigzag(6.2, 25.8, 17.2, 2.4, 7), 1.1)),
    ],
    "candle": [  # Lussinatt
        ("w", r(12.8, 11.2, 6.4, 13.2, 1) + f("M6.6 24 H25.4 C25.4 26.6 22 28.2 16 28.2 C10 28.2 6.6 26.6 6.6 24Z") + cs(26.8, 24.6, 2.2, 1.6)),
        ("w", f("M16 9.6 C13.8 8 14 5.4 16 2.6 C18 5.4 18.2 8 16 9.6Z") + s("M10.4 4.4 L11.8 5.6 M21.6 4.4 L20.2 5.6 M9.2 9 H11 M22.8 9 H21", 1.4)),
        ("k", s("M14.6 11.2 V15.2 C14.6 16 15.6 16 15.6 15.2 V13", 1) + s("M9.4 25.4 H22.6", 1, 'stroke-dasharray="1.4 1.4"') + c(16, 7.2, .8)),
    ],
    "tulip": [  # rosemaling tulip: ornament for hatch corners and dividers
        ("w", f("M16 5 C13.4 8.4 13.2 12.4 16 15.6 C18.8 12.4 18.6 8.4 16 5Z") + f("M15.2 16 C10.8 16 7.8 12.8 8.2 9 C10.8 10.2 13.6 12.4 15.2 16Z") + f("M16.8 16 C21.2 16 24.2 12.8 23.8 9 C21.2 10.2 18.4 12.4 16.8 16Z")),
        ("w", s("M16 15.6 V26", 1.8) + f("M15.6 22.6 C12.4 22.8 9.8 21.2 8.8 18.6 C11.8 18.4 14.4 20 15.6 22.6Z") + f("M16.4 20.6 C19.6 20.8 22.2 19.2 23.2 16.6 C20.2 16.4 17.6 18 16.4 20.6Z") + c(16, 27.6, 1.6)),
        ("k", s("M16 8.4 V13", 1) + s("M11 11.4 C12.4 12.4 13.6 13.6 14.2 14.8 M21 11.4 C19.6 12.4 18.4 13.6 17.8 14.8", .9)),
    ],
    # ---- story items (Låven «Grøt til nissen»: what each mission brings to the porridge)
    "rice": [  # an open sack of risengryn, a few grains spilled
        ("w", f("M9 14 C5.4 17 5 24.4 7.6 28.6 H24.4 C27 24.4 26.6 17 23 14Z") + r(7.6, 10.8, 16.8, 3.8, 1.8)),
        ("w", f("M9.4 11.2 C10.6 7.8 13 6.2 16 6.2 C19 6.2 21.4 7.8 22.6 11.2Z")),
        ("w", e(28, 27.6, 1.4, .8, 'transform="rotate(-20 28 27.6)"') + e(29.4, 24.8, 1.3, .75, 'transform="rotate(30 29.4 24.8)"') + e(3.8, 27.8, 1.3, .75, 'transform="rotate(15 3.8 27.8)"')),
        ("k", s("M7.4 11 H24.6", 1) + s("M8.6 14.4 H23.4", 1) + f("M16 17.6 L19.2 21.6 L16 25.6 L12.8 21.6Z") + c(16, 21.6, .9, 'fill="#fff"')),
        ("k", e(12.6, 9.4, 1.2, .55, 'transform="rotate(-25 12.6 9.4)"') + e(16.4, 8.2, 1.2, .55, 'transform="rotate(10 16.4 8.2)"') + e(19.6, 9.6, 1.2, .55, 'transform="rotate(30 19.6 9.6)"')),
    ],
    "milk": [  # melkespann (milk churn)
        ("w", r(11, 3, 10, 3, 1.2) + r(12.6, 5.6, 6.8, 4.4) + f("M12.6 9.4 C9.6 10.6 8 12.6 8 15.4 V26.4 C8 28 9.2 29 10.8 29 H21.2 C22.8 29 24 28 24 26.4 V15.4 C24 12.6 22.4 10.6 19.4 9.4Z")),
        ("w", s("M8.4 13.4 C5.2 13.4 5.2 18.2 8 18.6", 1.8) + s("M23.6 13.4 C26.8 13.4 26.8 18.2 24 18.6", 1.8)),
        ("k", s("M11.6 5.7 H20.4", .9) + s("M8 17.4 H24 M8 25.4 H24", 1.1) + petals(16, 21.4, 1.55)),
    ],
    "cinnamon": [  # kanelstenger, three sticks tied with a string
        ("w", g("rotate(-35 16 16)", r(3, 10.2, 26, 3.6, 1.8), r(3, 14.2, 26, 3.6, 1.8), r(3, 18.2, 26, 3.6, 1.8))),
        ("w", g("rotate(-35 16 16)", r(13.4, 8.4, 5.2, 15.2, 1))),
        ("k", g("rotate(-35 16 16)", s("M5.4 11.2 C4.2 11.6 4.2 12.9 5.4 13.1 M5.4 15.2 C4.2 15.6 4.2 16.9 5.4 17.1 M5.4 19.2 C4.2 19.6 4.2 20.9 5.4 21.1", .8)
                                     + s("M7.6 12 H11.6 M20.4 12 H26.4 M7.6 16 H11.6 M20.4 16 H26.4 M7.6 20 H11.6 M20.4 20 H26.4", .8)
                                     + s("M14.2 10 L17.8 22 M17.8 10 L14.2 22", .9))),
    ],
    "bowl_spoon": [  # grøtbolle with the sleiv standing in it
        ("w", f("M3 15 H29 C29 22.8 23.2 28 16 28 C8.8 28 3 22.8 3 15Z") + r(11, 27.2, 10, 2.4, 1)),
        ("w", f("M6.4 15 C8.4 11.8 12 10.8 16 10.8 C20 10.8 23.6 11.8 25.6 15Z") + s("M18.6 13.6 L26.8 4", 2.6) + c(27.4, 3.4, 2)),
        ("k", s("M3.4 15.2 H28.6", 1) + s(zigzag(7, 25, 18.2, 2.6, 4), 1.3) + c(27.4, 3.4, .75)),
    ],
    "butter_pat": [  # a round smørklatt pressed in a carved smørform, with the butter knife
        ("w", e(16, 25, 13.6, 3.6) + f("M6 13 V18.4 C6 21 10.4 23 16 23 C21.6 23 26 21 26 18.4 V13Z") + e(16, 13, 10, 4.6)),
        ("w", s("M23.4 9.6 L29.4 4.2", 2.4)),
        ("k", s("M6 13 C6 15.6 10.4 17.6 16 17.6 C21.6 17.6 26 15.6 26 13", 1) + s("M4.6 23.6 C7 25.6 25 25.6 27.4 23.6", .9)),
        ("k", petals(16, 13.4, 1.05) + s("M9 19.6 V21.2 M12.4 20.6 V22.2 M16 21 V22.6 M19.6 20.6 V22.2 M23 19.6 V21.2", .9)),
    ],
    # ---- small UI
    "bowl": [  # difficulty: one grøtbolle per level
        ("w", f("M2.5 13 H29.5 C29.5 21 23.6 26.6 16 26.6 C8.4 26.6 2.5 21 2.5 13Z") + s("M10.4 8.6 C12 6.6 13.6 6.6 15.2 8.6 S18.4 10.6 20 8.6 S23.2 6.6 24.8 8.6", 2.2)),
        ("k", s(zigzag(7, 25, 15.6, 3, 4), 1.6)),
    ],
    "hourglass": [  # timeglass: countdown to Sunday
        ("w", r(6, 3, 20, 3.6, 1.2) + r(6, 25.4, 20, 3.6, 1.2) + f("M9 6.4 H23 C23 11.4 18.6 13.6 18.6 16 C18.6 18.4 23 20.6 23 25.6 H9 C9 20.6 13.4 18.4 13.4 16 C13.4 13.6 9 11.4 9 6.4Z")),
        ("k", f("M12.2 9.2 H19.8 C19.2 11 17 12.4 16 13.4 C15 12.4 12.8 11 12.2 9.2Z") + f("M11.8 23.6 C12.4 21.4 14.6 20 16 19.6 C17.4 20 19.6 21.4 20.2 23.6Z")),
        ("k", s("M8 4.8 H24 M8 27.2 H24", .9, 'stroke-dasharray="1.4 1.4"')),
    ],
    "check": [  # carved tick
        ("w", s("M5 17.4 L12.6 25 L27 7.6", 4.6)),
        ("k", c(12.6, 25, .9) + s("M15.6 21.4 L18.2 18.2 M20.4 15.6 L23 12.4", 1)),
    ],
}

ALIASES = {"heart": "kindness", "home": "barn", "reroll": "sack"}

# ---------------------------------------------------------------- nisse avatar
# A painted-looking portrait (head and shoulders) in the folk-tale style, coloured through CSS
# custom properties so players keep their own look: --nisse-cap, --nisse-beard, --nisse-skin,
# --nisse-nose and --nisse-coat. Shown inside the carved ring (f-ring) by <NisseAvatar>.
CAP, BEARD, SKIN, NOSE, COAT = ("var(--nisse-cap,#C2382B)", "var(--nisse-beard,#F4F1EA)", "var(--nisse-skin,#E9B996)",
                                "var(--nisse-nose,#D9826C)", "var(--nisse-coat,#5E6470)")
INK = "#2A1E15"
AVATAR = f"""<g>
<path d="M2 40 C3 33.4 9.6 30.2 20 30.2 C30.4 30.2 37 33.4 38 40Z" fill="{COAT}"/>
<path d="M2 40 C3 33.4 9.6 30.2 20 30.2 C30.4 30.2 37 33.4 38 40Z" fill="#000" fill-opacity=".12"/>
<g fill="#fff" fill-opacity=".55"><circle cx="7" cy="36.6" r=".55"/><circle cx="10" cy="34.6" r=".55"/><circle cx="10.4" cy="38.4" r=".55"/><circle cx="30" cy="34.6" r=".55"/><circle cx="33" cy="36.6" r=".55"/><circle cx="29.6" cy="38.4" r=".55"/></g>
<path d="M4.4 35.4 L6 34 L7.6 35.4 L9.2 34 M30.8 34 L32.4 35.4 L34 34 L35.6 35.4" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="20" cy="23" rx="8.8" ry="6.8" fill="{SKIN}"/>
<path d="M10.6 22.6 C9.2 28.6 10.2 34 13.2 37.2 C14.6 36 15.8 37.4 17.2 38.2 C18.4 37.2 19.2 38.9 20 39.1 C20.8 38.9 21.6 37.2 22.8 38.2 C24.2 37.4 25.4 36 26.8 37.2 C29.8 34 30.8 28.6 29.4 22.6 C28.2 26.2 25.6 28.4 22.6 28.6 L17.4 28.6 C14.4 28.4 11.8 26.2 10.6 22.6Z" fill="{BEARD}"/>
<path d="M14 30.4 C14.4 32.6 15.4 34.6 16.8 36 M17.4 31 C17.6 33.2 18.2 35.2 19.2 36.8 M22.6 31 C22.4 33.2 21.8 35.2 20.8 36.8 M26 30.4 C25.6 32.6 24.6 34.6 23.2 36 M12.2 26.8 C12 29.6 12.6 32.4 14 34.6 M27.8 26.8 C28 29.6 27.4 32.4 26 34.6" fill="none" stroke="#000" stroke-opacity=".13" stroke-width=".7" stroke-linecap="round"/>
<path d="M10.2 20.4 C10.2 12.6 13.4 6.4 19 4.4 C24.2 2.6 29.8 4.2 32.6 8.8 C34.2 11.4 34.6 14.4 33.8 17 C32.8 15.4 31.4 14.8 30.2 15.4 C30.8 17 30.6 18.8 30 20.4Z" fill="{CAP}"/>
<path d="M14.2 19.8 C14 13.6 15.8 8.8 19 6.4 M18.2 19.6 C18.4 13.2 20.4 8.4 23.6 5.8 M22.4 19.6 C23 14 25 9.6 28.2 7.4 M26.4 19.8 C27.2 15.6 28.8 12.6 31.2 11" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".75" stroke-linecap="round"/>
<path d="M12.4 13.6 C14 9.6 16.4 7 19.6 5.8" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.3" stroke-linecap="round"/>
<g transform="translate(33.6 18.4)"><circle r="2.5" fill="{BEARD}"/><path d="M-1.6 -.6 L-.4 1.8 M0 -1.2 V2.2 M1.6 -.6 L.4 1.8" stroke="#000" stroke-opacity=".18" stroke-width=".6" stroke-linecap="round"/></g>
<path d="M9.2 19.6 C13.4 17.4 26.6 17.4 30.8 19.6 L31 23 C26.8 21.2 13.2 21.2 9 23Z" fill="{CAP}"/>
<path d="M9.2 19.6 C13.4 17.4 26.6 17.4 30.8 19.6 L31 23 C26.8 21.2 13.2 21.2 9 23Z" fill="#000" fill-opacity=".24"/>
<path d="M10.6 20.6 L11.4 21.6 L12.2 20.4 L13 21.4 L13.8 20.2 L14.6 21.2 L15.4 20 L16.2 21 L17 19.9 L17.8 20.9 L18.6 19.8 L19.4 20.8 L20.2 19.8 L21 20.8 L21.8 19.8 L22.6 20.9 L23.4 19.9 L24.2 21 L25 20 L25.8 21.2 L26.6 20.2 L27.4 21.4 L28.2 20.4 L29 21.6 L29.6 20.8" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".55" stroke-linejoin="round"/>
<path d="M12.8 23.6 C14 22.2 16.6 22 18.4 23.2 C16.6 23.2 14.8 23.4 12.8 23.6Z M27.2 23.6 C26 22.2 23.4 22 21.6 23.2 C23.4 23.2 25.2 23.4 27.2 23.6Z" fill="{BEARD}" stroke="{BEARD}" stroke-width=".9" stroke-linejoin="round"/>
<path d="M14.8 25.6 C15.6 24.7 16.8 24.7 17.6 25.6 M22.4 25.6 C23.2 24.7 24.4 24.7 25.2 25.6" fill="none" stroke="{INK}" stroke-width="1.05" stroke-linecap="round"/>
<path d="M13.4 25 L12.4 24.6 M13.4 25.8 L12.4 26.2 M26.6 25 L27.6 24.6 M26.6 25.8 L27.6 26.2" stroke="{INK}" stroke-opacity=".45" stroke-width=".5" stroke-linecap="round"/>
<circle cx="14.4" cy="27.6" r="1.9" fill="#E06C5A" fill-opacity=".32"/><circle cx="25.6" cy="27.6" r="1.9" fill="#E06C5A" fill-opacity=".32"/>
<path d="M20 28.4 C18.2 27 15.2 27.2 13 29.2 C12 30.2 12.2 31.4 13.2 31.2 C15.2 31 18.2 30.4 20 29.6 C21.8 30.4 24.8 31 26.8 31.2 C27.8 31.4 28 30.2 27 29.2 C24.8 27.2 21.8 27 20 28.4Z" fill="{BEARD}"/>
<path d="M20 28.4 C18.2 27 15.2 27.2 13 29.2 C12 30.2 12.2 31.4 13.2 31.2 C15.2 31 18.2 30.4 20 29.6 C21.8 30.4 24.8 31 26.8 31.2 C27.8 31.4 28 30.2 27 29.2 C24.8 27.2 21.8 27 20 28.4Z M15.6 29 C17 28.6 18.4 28.8 19.4 29.4 M24.4 29 C23 28.6 21.6 28.8 20.6 29.4" fill="none" stroke="#000" stroke-opacity=".14" stroke-width=".6"/>
<ellipse cx="20" cy="27.2" rx="2.7" ry="2.4" fill="{NOSE}"/>
<path d="M17.8 28.4 C19 29.4 21 29.4 22.2 28.4" fill="none" stroke="#000" stroke-opacity=".18" stroke-width=".6" stroke-linecap="round"/>
<circle cx="19.1" cy="26.3" r=".75" fill="#fff" fill-opacity=".6"/>
</g>"""

AVATAR_PRESETS = [
    ("Fjøsnissen", "#C2382B", "#F4F1EA", "#E9B996"),
    ("Lyktenissen", "#D9862B", "#E9E2D2", "#E3AE8A"),
    ("Grøtnissa", "#9E2B4F", "#F7F2E8", "#C98F6A"),
    ("Låvenissen", "#4F6A3A", "#D9D2C4", "#F0C9A8"),
    ("Snønissen", "#2F5C8F", "#FFFFFF", "#8D5B3E"),
    ("Bjellenissen", "#6B4A8A", "#CFC6B5", "#B87A55"),
]

# ---------------------------------------------------------------- carved frames (full colour)
# The category tiles and the avatar sit inside the same chip-carved wooden ring as the painted
# badge medallions. Colours come from CSS: --medal-rim (wood), --medal-bead (brass bead).
def chip_ring(n=30, r_out=30.2, r_in=25.4, cx=32, cy=32):
    """A band of chip-carved triangles: dark cut pointing in, lit cut pointing out, alternating."""
    out = []
    step = 2 * math.pi / n
    for i in range(n):
        a = i * step - math.pi / 2
        p = lambda rr, aa: f"{cx + rr * math.cos(aa):.2f} {cy + rr * math.sin(aa):.2f}"
        # inward triangle: base on the outer edge, apex towards the centre
        out.append(f'<path d="M{p(r_out, a - step * .42)} L{p(r_out, a + step * .42)} L{p(r_in, a)}Z" fill="#000" fill-opacity=".36"/>')
        # outward triangle between them: base on the inner edge, lit from above
        b = a + step / 2
        out.append(f'<path d="M{p(r_in, b - step * .38)} L{p(r_in, b + step * .38)} L{p(r_out - .6, b)}Z" fill="#fff" fill-opacity=".14"/>')
    return "".join(out)

FRAME_DEFS = (
    '<radialGradient id="g-sheen" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".34"/>'
    '<stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></radialGradient>'
    '<linearGradient id="g-ring" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/>'
    '<stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>'
    '<clipPath id="c-disc"><circle cx="32" cy="32" r="22"/></clipPath>'
)

FRAMES = {
    # wooden ring with a chip-carved band and a brass bead, 64 x 64, inner disc radius 22
    "f-ring": (
        '<circle cx="32" cy="32" r="31.6" fill="var(--medal-rim,#6B4426)"/>'
        '<circle cx="32" cy="32" r="31.6" fill="url(#g-ring)"/>'
        '<circle cx="32" cy="32" r="31" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>'
        + chip_ring()
        + '<circle cx="32" cy="32" r="23.6" fill="none" stroke="var(--medal-bead,#E7B04A)" stroke-width="1.8"/>'
        '<circle cx="32" cy="32" r="22.4" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".8"/>'
    ),
    # painted dot border inside the disc, as on rosemaling bowls
    "f-dots": "".join(
        f'<circle cx="{32 + 19.2 * math.cos(i * math.pi / 12):.2f}" cy="{32 + 19.2 * math.sin(i * math.pi / 12):.2f}" r=".85" fill="#FFF6EA" fill-opacity=".55"/>'
        for i in range(24)),
    "f-sheen": '<circle cx="32" cy="32" r="22" fill="url(#g-sheen)"/>',
}

# ---------------------------------------------------------------- rosemaling (full colour)
# Telemark-style C- and S-scrolls with leaves, buds and a tulip. Colours come from CSS:
# --rose-flower, --rose-leaf, --rose-line (fine liner strokes) and --rose-dot.
FL, LF, LN, DT = ("var(--rose-flower,#B5222B)", "var(--rose-leaf,#4D6B2E)", "var(--rose-line,#FFF6EA)", "var(--rose-dot,#B8862B)")

def leaf(x0, y0, x1, y1, w=.42, fill=LF, line=True):
    """A teardrop leaf from (x0,y0) to the tip (x1,y1), with a liner stroke down the middle."""
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy = x1 - x0, y1 - y0
    nx, ny = -dy * w, dx * w
    shape = (f'<path d="M{x0:.2f} {y0:.2f} Q{mx + nx:.2f} {my + ny:.2f} {x1:.2f} {y1:.2f} '
             f'Q{mx - nx * .55:.2f} {my - ny * .55:.2f} {x0:.2f} {y0:.2f}Z" fill="{fill}"/>')
    if line:
        shape += (f'<path d="M{x0 + dx * .2:.2f} {y0 + dy * .2:.2f} Q{mx + nx * .35:.2f} {my + ny * .35:.2f} {x0 + dx * .8:.2f} {y0 + dy * .8:.2f}" '
                  f'fill="none" stroke="{LN}" stroke-opacity=".7" stroke-width=".5" stroke-linecap="round"/>')
    return shape

def dots(*pts, r=.9):
    return "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{DT}"/>' for x, y in pts)

def tulip(cx, cy, s=1.0):
    """Rosemaling tulip, opening upwards, centred on its base (cx, cy)."""
    return (f'<g transform="translate({cx} {cy}) scale({s})">'
            f'<path d="M0 0 C-6 -1 -8.6 -6 -7.6 -11 C-5 -9 -2.6 -7.6 0 -4.4 C2.6 -7.6 5 -9 7.6 -11 C8.6 -6 6 -1 0 0Z" fill="{FL}"/>'
            f'<path d="M0 -3 C-2.6 -6 -2.8 -10.4 0 -14 C2.8 -10.4 2.6 -6 0 -3Z" fill="{FL}"/>'
            f'<path d="M0 -3 C-2.6 -6 -2.8 -10.4 0 -14 C2.8 -10.4 2.6 -6 0 -3Z" fill="#000" fill-opacity=".18"/>'
            f'<path d="M-5.6 -8.4 C-4.6 -5.4 -2.8 -3.4 -.8 -2 M5.6 -8.4 C4.6 -5.4 2.8 -3.4 .8 -2 M0 -12 V-6" fill="none" stroke="{LN}" stroke-width=".6" stroke-linecap="round"/>'
            f'<circle cx="0" cy="1.6" r="1.6" fill="{DT}"/></g>')

def scroll_half():
    """Left half of the divider, from the centre (x=120) out to x=8, in a 240 x 32 box."""
    stem = (f'<path d="M110 18 C100 18 96 10 86 10 C76 10 72 20 62 21 C52 22 48 12 38 12 C29 12 24 18 27 23 C29.6 27 35 24.4 33 20.6" '
            f'fill="none" stroke="{LF}" stroke-width="1.7" stroke-linecap="round"/>')
    curl = (f'<path d="M86 10 C83 6 86.4 2.6 89.4 4.6 C91 5.8 90.2 8 88.6 7.6" fill="none" stroke="{LF}" stroke-width="1.2" stroke-linecap="round"/>'
            f'<path d="M62 21 C60 25.6 64.4 28.6 67 26.2 C68.4 24.8 67.2 22.8 65.8 23.6" fill="none" stroke="{LF}" stroke-width="1.2" stroke-linecap="round"/>')
    leaves = (leaf(98, 15.6, 92, 5.4) + leaf(96, 16.6, 102, 26.6, .36)
              + leaf(78, 11.4, 72, 3.4) + leaf(72, 16.6, 76, 27.4, .38)
              + leaf(52, 19, 46, 27.6, .38) + leaf(46, 14, 50, 4.6, .4)
              + leaf(34, 12.4, 26, 6.8, .38))
    buds = (f'<circle cx="89.4" cy="6.4" r="2.1" fill="{FL}"/><circle cx="65.2" cy="24.6" r="2.1" fill="{FL}"/>'
            f'<circle cx="31" cy="21.6" r="2.3" fill="{FL}"/><circle cx="30.4" cy="21" r=".8" fill="{LN}" fill-opacity=".7"/>')
    return stem + curl + leaves + buds + dots((84, 16.4), (81.6, 18), (57.6, 12.2), (55, 13.6), (40.6, 20.4), (20, 14.4), (16, 16), (12, 17.6), r=.85)

ORNAMENTS = {
    # wide divider between sections, 240 x 32
    "o-divider": ("0 0 240 32", scroll_half() + f'<g transform="translate(240 0) scale(-1 1)">{scroll_half()}</g>'
                  + tulip(120, 22, 1.0) + leaf(114, 21, 106, 26.4, .4) + leaf(126, 21, 134, 26.4, .4)),
    # corner flourish for cards and sheets, 48 x 48, drawn for the top-left corner
    "o-corner": ("0 0 48 48",
                 f'<path d="M4 44 C4 26 8 12 18 7 C26 3 36 3 44 4" fill="none" stroke="{LF}" stroke-width="1.6" stroke-linecap="round"/>'
                 f'<path d="M18 7 C14 12 18 18 22.6 15.6 C25 14.2 24 11 21.8 11.8" fill="none" stroke="{LF}" stroke-width="1.2" stroke-linecap="round"/>'
                 + leaf(6.6, 30, 14, 24, .4) + leaf(5, 36, 1.6, 26, .34, line=False)
                 + leaf(30, 4.6, 24, 12.4, .4) + leaf(36, 4.2, 28, 1, .34, line=False)
                 + f'<circle cx="21.8" cy="13.2" r="2.4" fill="{FL}"/><circle cx="21.2" cy="12.6" r=".8" fill="{LN}" fill-opacity=".7"/>'
                 + dots((10, 18), (12.6, 15), (40, 9), (9, 41), r=.9)),
    # small tulip sprig for headings and empty states, 32 x 32
    "o-sprig": ("0 0 32 32", leaf(16, 27, 7, 21, .4) + leaf(16, 27, 25, 21, .4)
                + f'<path d="M16 30 V17" stroke="{LF}" stroke-width="1.4" stroke-linecap="round"/>' + tulip(16, 18, .95)),
}

# Seksbladrose (hexafoil) in a chip-carved ring: a large carved ornament for empty states and
# page backgrounds. One colour, cut out like the icons.
ROSETTE = [
    ("w", cs(16, 16, 13.6, 4.4) + cs(16, 16, 9.4, 1.3) + c(16, 16, 1.5)),
    ("k", "".join(g(f"rotate({360 / 24 * i} 16 16)", f("M14.9 0.6 H17.1 L16 3.8Z")) for i in range(24))),
    ("w", "".join(g(f"rotate({60 * i} 16 16)", s("M16 16 A4.6 4.6 0 0 1 16 6.8 A4.6 4.6 0 0 1 16 16", 1.2)) for i in range(6))),
]
ICONS["rosette"] = ROSETTE

# ---------------------------------------------------------------- output
def layer_markup(layers):
    out = []
    for kind, markup in layers:
        out.append(markup.replace('"C"', '"#fff"' if kind == "w" else '"#000"'))
    return "".join(out)

def mask(name, layers, prefix="nm-"):
    return (f'<mask id="{prefix}{name}" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">'
            f'{layer_markup(layers)}</mask>')

def build():
    names = list(ICONS)
    masks = "\n".join(mask(n, ICONS[n]) for n in names)
    symbols = "\n".join(
        f'<symbol id="i-{n}" viewBox="0 0 32 32"><rect width="32" height="32" fill="currentColor" mask="url(#nm-{n})"/></symbol>'
        for n in names)
    symbols += "\n" + "\n".join(
        f'<symbol id="i-{a}" viewBox="0 0 32 32"><rect width="32" height="32" fill="currentColor" mask="url(#nm-{t})"/></symbol>'
        for a, t in ALIASES.items())
    symbols += f'\n<symbol id="i-nisse" viewBox="0 0 40 40">{AVATAR}</symbol>'
    symbols += "\n" + "\n".join(f'<symbol id="{n}" viewBox="0 0 64 64">{body}</symbol>' for n, body in FRAMES.items())
    symbols += "\n" + "\n".join(f'<symbol id="{n}" viewBox="{vb}">{body}</symbol>' for n, (vb, body) in ORNAMENTS.items())
    sprite = ('<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">\n'
              f'<defs>\n{FRAME_DEFS}\n{masks}\n</defs>\n{symbols}\n</svg>\n')
    (APP_UI / "sprite.svg").write_text(sprite)

    # preview sheet for visual checks (not committed)
    cells = "".join(
        f'<figure><div class="ic"><svg><use href="#i-{n}"/></svg></div><div class="ic lv"><svg><use href="#i-{n}"/></svg></div>'
        f'<div class="ic sm"><svg><use href="#i-{n}"/></svg></div><figcaption>{n}</figcaption></figure>' for n in names)
    (HERE / "preview.html").write_text(f"""<!doctype html><meta charset="utf-8"><title>Karveskurd icons</title>
<style>body{{font:12px system-ui;background:#EDF0F4;margin:16px}} .grid{{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}}
figure{{margin:0;background:#fff;border-radius:10px;padding:8px;display:grid;grid-template-columns:repeat(3,auto);gap:6px;justify-content:center;align-items:center}}
figcaption{{grid-column:1/-1;text-align:center;color:#556}} .ic{{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;background:#D71E28;color:#fff}}
.ic.lv{{background:#3A2A1E;color:#F4B740}} .ic.sm{{width:28px;height:28px;background:none;color:#121212}} .ic svg{{width:34px;height:34px}} .ic.sm svg{{width:22px;height:22px}}</style>
{sprite}<div class="grid">{cells}</div>""")
    print(f"{len(names)} icons, {len(ALIASES)} aliases, avatar, {len(FRAMES)} frames, {len(ORNAMENTS)} ornaments")

if __name__ == "__main__":
    build()
