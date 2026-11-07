"""Builds the favicon and the home screen icons from the painted nisse in app-icon-source.webp.

Run after changing the source:  python3 apps/web/scripts/pwa/build-icons.py
(needs Pillow). The white notification badge is made separately by render-icons.mjs.
"""
from pathlib import Path
from PIL import Image

here = Path(__file__).parent
web = here.parent.parent
icons = web / 'public' / 'icons'
src = Image.open(here / 'app-icon-source.webp').convert('RGB')

def save(img, path, size):
    img.resize((size, size), Image.LANCZOS).save(path, optimize=True)

save(src, icons / 'icon-512.png', 512)
save(src, icons / 'icon-192.png', 192)
save(src, icons / 'apple-touch-icon.png', 180)
save(src, icons / 'shortcut-96.png', 96)

# Maskable: Android may crop to a circle, so the picture is shrunk into the central 78 %
# and a blurred copy of the painting fills the rest, so no seam shows.
from PIL import ImageFilter
pad = src.resize((1024, 1024)).filter(ImageFilter.GaussianBlur(40))
inner = src.resize((800, 800), Image.LANCZOS)
pad.paste(inner, (112, 112))
save(pad, icons / 'maskable-512.png', 512)

# Browser tab: a cut-out of the painted nisse on a transparent background, so it also works on
# dark tabs. It is a separate bolder, simpler painting (favicon-source.webp) that fills the square.
fav = Image.open(here / 'favicon-source.webp').convert('RGBA')
sizes = (16, 32, 48, 180)
for size in sizes[:3]:
    fav.resize((size, size), Image.LANCZOS).save(web / 'public' / f'favicon-{size}.png', optimize=True)
fav.resize((48, 48), Image.LANCZOS).save(
    web / 'public' / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)]
)
