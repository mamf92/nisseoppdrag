"""Crops the player portraits («portretter») out of the approved character sheets.

No new image generation: every portrait is a head from a sheet the design thread already made
(L-01 to L-07 round 1, R-01 round 2). Each crop is a square (centre x, centre y, side) in the
sheet's own pixels. Output: public/art/portraits/<id>-128, -256 and -512.webp.

  python3 scripts/portraits/build_portraits.py <sheet dir> <out dir> [--contact sheet.jpg]

<sheet dir> is design/illustrations/source in the project files.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# id -> (sheet, cx, cy, side). Order is the order in the picker.
CROPS = {
    "lyktenissen-1": ("L-02-lyktenissen-sheet.png", 270, 815, 450),
    "lyktenissen-2": ("L-02-lyktenissen-sheet.png", 726, 828, 430),
    "grotnissa-1": ("L-03-grotnissa-sheet.png", 283, 828, 430),
    "grotnissa-2": ("L-03-grotnissa-sheet.png", 726, 828, 430),
    "grotnissa-3": ("L-03-grotnissa-sheet.png", 1169, 828, 430),
    "lavenissen-1": ("L-04-lavenissen-sheet.png", 283, 815, 440),
    "lavenissen-2": ("L-04-lavenissen-sheet.png", 726, 815, 440),
    "lavenissen-3": ("L-04-lavenissen-sheet.png", 1169, 815, 440),
    "snonissen-1": ("L-05-snonissen-sheet.png", 300, 790, 440),
    "snonissen-2": ("L-05-snonissen-sheet.png", 770, 790, 440),
    "nissefar-1": ("L-06-nissefar-sheet.png", 283, 822, 420),
    "nissefar-3": ("L-06-nissefar-sheet.png", 1169, 822, 420),
    "fjosnissen-1": ("L-01-fjosnissen-sheet.png", 350, 800, 400),
    "fjosnissen-2": ("L-01-fjosnissen-sheet.png", 770, 800, 400),
    "fjosnissen-3": ("L-01-fjosnissen-sheet.png", 1180, 800, 400),
    "gamlenissen-1": ("round2/R-01-fjosnissen-sheet.png", 300, 740, 460),
    "gamlenissen-2": ("round2/R-01-fjosnissen-sheet.png", 1260, 740, 460),
    "fjoskatten": ("L-07-cat-mice-sheet.png", 300, 205, 380),
    "musa": ("L-07-cat-mice-sheet.png", 290, 840, 320),
}


def crop(src: Path, sheet: str, cx: int, cy: int, side: int) -> Image.Image:
    im = Image.open(src / sheet).convert("RGB")
    h = side // 2
    return im.crop((cx - h, cy - h, cx + h, cy + h))


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    contact = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--contact" else None
    out.mkdir(parents=True, exist_ok=True)
    tiles = []
    for pid, (sheet, cx, cy, side) in CROPS.items():
        img = crop(src, sheet, cx, cy, side)
        for px in (128, 256, 512):
            img.resize((px, px), Image.LANCZOS).save(out / f"{pid}-{px}.webp", "WEBP", quality=82, method=6)
        tiles.append((pid, img.resize((180, 180), Image.LANCZOS)))
    if contact:
        cols = 5
        rows = (len(tiles) + cols - 1) // cols
        sheet_img = Image.new("RGB", (cols * 200, rows * 220), "#3a2a1a")
        draw = ImageDraw.Draw(sheet_img)
        mask = Image.new("L", (180, 180), 0)
        ImageDraw.Draw(mask).ellipse((14, 14, 166, 166), fill=255)
        for i, (pid, tile) in enumerate(tiles):
            x, y = (i % cols) * 200 + 10, (i // cols) * 220 + 10
            sheet_img.paste(tile, (x, y), mask)
            draw.text((x, y + 185), pid, fill="#f5e9d0")
        sheet_img.save(contact, quality=85)


if __name__ == "__main__":
    main()
