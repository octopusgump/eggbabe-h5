#!/usr/bin/env python3
"""Prepare 1:1 eggbabe-miniprogram Option A panoramas, 3D UI icons, keepsakes & macro props.

All outputs strictly adhere to AGENTS.md:
- 100% compressed PNG via pngquant (zero .webp files anywhere).
- Seamless perspective-aligned empty bedroom panoramas (day/sunset/night) preserving the wooden bed.
- Zero-halo chroma-extracted RGBA PNG props & 3D wardrobe icon.
"""
import os
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = "/tmp/mp_assets_work"
ART_DIR = "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/fa799bb2-3620-4e07-83d7-6588f2dc5608"

PANO_W, PANO_H = 1352, 800  # Exact 2823:1672 aspect ratio (1.6884), Retina crisp


def pngquant_compress(src_path: str, dst_path: str, quality: str = "72-94") -> None:
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    res = subprocess.run(
        ["pngquant", f"--quality={quality}", "--speed=3", "--strip", "--force", "--output", dst_path, src_path],
        stderr=subprocess.PIPE,
    )
    if res.returncode != 0:
        # Fallback with slightly wider floor if 256-color palette has high entropy
        subprocess.run(
            ["pngquant", "--quality=60-92", "--speed=3", "--strip", "--force", "--output", dst_path, src_path],
            check=True,
        )


def chroma_extract_green(src_path: str, size: int, despill_r_weight: float = 0.90) -> Image.Image:
    im = Image.open(src_path).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    px = im.load()
    w, h = im.size
    bg_r, bg_g, bg_b = px[8, 8]
    bg_ex = max(120.0, float(bg_g - max(bg_r, bg_b)))
    lo, hi = 22.0, bg_ex * 0.56

    rgba = Image.new("RGBA", (w, h))
    opx = rgba.load()
    b_weight = 1.0 - despill_r_weight
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            ex = g - max(r, b)
            if ex > hi + 14:
                opx[x, y] = (0, 0, 0, 0)
                continue
            a = max(0.0, min(1.0, (hi - ex) / max(1.0, hi - lo)))
            limit_g = int(r * despill_r_weight + b * b_weight)
            if g > limit_g:
                g = limit_g
            opx[x, y] = (r, g, b, int(a * 255))

    for _ in range(3):
        src = rgba.load()
        updates = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = src[x, y]
                if 2 < a < 244:
                    sr = sg = sb = cnt = 0
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            nr, ng, nb, na = src[x + dx, y + dy]
                            if na >= 244:
                                sr += nr
                                sg += ng
                                sb += nb
                                cnt += 1
                    if cnt > 0:
                        updates.append((x, y, sr // cnt, sg // cnt, sb // cnt, a))
        for x, y, nr, ng, nb, a in updates:
            opx[x, y] = (nr, ng, nb, a)

    bbox = rgba.getbbox()
    if bbox:
        pad = 14
        crop = rgba.crop((
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(w, bbox[2] + pad),
            min(h, bbox[3] + pad),
        ))
        cw, ch = crop.size
        side = max(cw, ch)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(crop, ((side - cw) // 2, (side - ch) // 2))
        rgba = sq

    return rgba.resize((size, size), Image.Resampling.LANCZOS)


def build_empty_panorama(period: str) -> None:
    draw = Image.open(f"{WORK}/raw_actions/jade-rabbit/draw_{period}.png").convert("RGB")
    nap = Image.open(f"{WORK}/raw_actions/jade-rabbit/nap_{period}.png").convert("RGB")

    # Match local seam luminance along upper bookshelf/desk (y: 100..1100, x: 1030..1120)
    s_draw = ImageStat.Stat(draw.crop((1030, 100, 1120, 1100))).mean
    s_nap = ImageStat.Stat(nap.crop((1030, 100, 1120, 1100))).mean
    gains = [s_nap[i] / max(1.0, s_draw[i]) for i in range(3)]
    r, g, b = draw.split()
    r = r.point(lambda v: min(255, int(v * gains[0])))
    g = g.point(lambda v: min(255, int(v * gains[1])))
    b = b.point(lambda v: min(255, int(v * gains[2])))
    draw_matched = Image.merge("RGB", (r, g, b))

    # Perspective seam: x=1095 above y=1100, sloping left to x=965 by y=1260 so crayon box (x>=1040) is 100% excluded
    w, h = draw.size
    mask = Image.new("L", (w, h), 0)
    mpx = mask.load()
    feather = 44.0
    for y in range(h):
        if y <= 1100:
            cx = 1095.0
        elif y >= 1260:
            cx = 965.0
        else:
            cx = 1095.0 - (130.0 * (y - 1100) / 160.0)
        x0 = cx - feather / 2.0
        x1 = cx + feather / 2.0
        for x in range(w):
            if x <= x0:
                mpx[x, y] = 0
            elif x >= x1:
                mpx[x, y] = 255
            else:
                mpx[x, y] = int(255.0 * (x - x0) / feather)

    comp = Image.composite(nap, draw_matched, mask).resize((PANO_W, PANO_H), Image.Resampling.LANCZOS)
    tmp_path = f"{WORK}/tmp_empty_{period}.png"
    comp.save(tmp_path)
    pngquant_compress(tmp_path, f"{HERE}/panoramas/empty_{period}.png")


def process_action_pano(item) -> None:
    char, st, pd = item
    src = f"{WORK}/raw_actions/{char}/{st}_{pd}.png"
    tmp = f"{WORK}/tmp_{char}_{st}_{pd}.png"
    dst = f"{HERE}/panoramas/{char}/{st}_{pd}.png"
    im = Image.open(src).convert("RGB").resize((PANO_W, PANO_H), Image.Resampling.LANCZOS)
    im.save(tmp)
    pngquant_compress(tmp, dst)


def main() -> None:
    # Remove legacy 1024x576 prototype folder
    old_scene = os.path.join(HERE, "scene")
    if os.path.exists(old_scene):
        shutil.rmtree(old_scene)

    for sub in ["panoramas/jade-rabbit", "panoramas/boon-koi", "ui", "keepsakes", "props"]:
        os.makedirs(os.path.join(HERE, sub), exist_ok=True)

    print("1. Building 3 seamless bed-consistent empty panoramas...")
    for pd in ["day", "sunset", "night"]:
        build_empty_panorama(pd)

    print("2. Compressing 48 official action panoramas...")
    jobs = [
        (char, st, pd)
        for char in ["jade-rabbit", "boon-koi"]
        for st in ["nap", "lazy", "stare", "read", "game", "window", "draw", "music"]
        for pd in ["day", "sunset", "night"]
    ]
    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(process_action_pano, jobs))

    print("3. Compressing official 3D UI icons & keepsakes...")
    for fn in os.listdir(f"{WORK}/raw_ui"):
        if fn.endswith(".png"):
            pngquant_compress(f"{WORK}/raw_ui/{fn}", f"{HERE}/ui/{fn}", "80-95")

    for fn in os.listdir(f"{WORK}/raw_keepsakes"):
        if fn.endswith(".png"):
            im = Image.open(f"{WORK}/raw_keepsakes/{fn}").convert("RGBA").resize((220, 220), Image.Resampling.LANCZOS)
            tmp = f"{WORK}/tmp_ks_{fn}"
            im.save(tmp)
            pngquant_compress(tmp, f"{HERE}/keepsakes/{fn}", "80-95")

    print("4. Extracting & compressing chroma-key 3D wardrobe icon & macro props...")
    chroma_specs = [
        (f"{ART_DIR}/ui_3d_fitting_wardrobe_1795485895950.jpg", f"{HERE}/ui/wardrobe_3d.png", 96, 0.88),
        (f"{ART_DIR}/prop_wood_mirror_1795485896899.jpg", f"{HERE}/props/prop_wood_mirror.png", 220, 0.90),
        (f"{ART_DIR}/prop_folded_knit_1795485907923.jpg", f"{HERE}/props/prop_folded_knit.png", 220, 0.86),
    ]
    for src_jpg, dst_png, sz, rw in chroma_specs:
        im = chroma_extract_green(src_jpg, sz, rw)
        tmp = f"{WORK}/tmp_ch_{os.path.basename(dst_png)}"
        im.save(tmp)
        pngquant_compress(tmp, dst_png, "80-95")

    print("All assets prepared successfully!")


if __name__ == "__main__":
    main()
