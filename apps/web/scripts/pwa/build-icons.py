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

# Browser tab: tighter crop on the cap and nose, where the details survive at 32 px.
tab = src.crop((180, 40, 880, 740))
save(tab.resize((700, 700)), web / 'public' / 'favicon-48.png', 48)
save(tab.resize((700, 700)), web / 'public' / 'favicon-32.png', 32)
