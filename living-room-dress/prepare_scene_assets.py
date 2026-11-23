#!/usr/bin/env python3
"""Generate pngquant-compressed PNG scene layers for living-room-dress (per AGENTS.md)."""
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
OUT = HERE / "scene"
OUT.mkdir(parents=True, exist_ok=True)

im_koi_sleep = Image.open("/home/antigravity/image.png").convert("RGB")
im_yutu_sleep = Image.open("/home/antigravity/image_2.png").convert("RGB").resize((1024, 576), Image.LANCZOS)
im_koi_draw = Image.open("/home/antigravity/image_3.png").convert("RGB")
im_yutu_draw = Image.open("/home/antigravity/image_4.png").convert("RGB")

# Clean wood gap right outside the bed box rail at x=399
poly = [
    (0, 0),
    (399, 0),
    (399, 418),
    (366, 444),
    (330, 495),
    (270, 576),
    (0, 576),
]
mask = Image.new("L", (1024, 576), 0)
ImageDraw.Draw(mask).polygon(poly, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(radius=4))
im_empty = Image.composite(im_yutu_draw, im_yutu_sleep, mask)

targets = {
    "room_empty.png": im_empty,
    "sleep_koi.png": im_koi_sleep,
    "sleep_yutu.png": im_yutu_sleep,
    "draw_koi.png": im_koi_draw,
    "draw_yutu.png": im_yutu_draw,
}

for fname, im in targets.items():
    p = OUT / fname
    im.save(p, "PNG")
    subprocess.run(
        ["pngquant", "--quality=80-95", "--speed=3", "--strip", "--ext", ".png", "--force", str(p)],
        check=True,
    )

print("Generated compressed PNGs:")
for p in sorted(OUT.glob("*.png")):
    print(f"  {p.name}: {p.stat().st_size // 1024} KB")
