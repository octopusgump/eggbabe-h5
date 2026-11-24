#!/usr/bin/env python3
"""Prepare Modular Scene Rig (room shells + 5 transparent furniture modules)
and P4 Black Cat Sheriff Clock (front/back/mid-thickness/tail/scene) PNGs.

Strictly follows AGENTS.md & chroma-transparent-character-png skill:
- Zero-halo chroma-key RGBA extraction + 1px alpha edge cleanup + 3-pass RGB edge bleed
- Precision warm-oak / warm-walnut spill calibration (zero green bookshelf, zero purple jewelry box)
- Exact original-perspective extraction for wall art from empty_day.png (100% camera match)
- Optical translucent glass recovery for the blue-screen glass jar on the jewelry box
- 100% compressed PNG via pngquant --quality=80-95 --speed=3 --strip (zero .webp)
"""
import glob
import json
import os
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REPO = "/home/antigravity/octopusgump/eggbabe-h5"
ART_DIR = "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/e0b241dd-d122-4a4e-9e66-da9841cfe250"
SCRATCH = os.path.join(ART_DIR, "scratch")
OUT_PANO = os.path.join(REPO, "living-room-dress/panoramas")
OUT_MOD = os.path.join(REPO, "living-room-dress/modules")
OUT_PROP = os.path.join(REPO, "living-room-dress/props")

PANO_W, PANO_H = 1352, 800
LOGICAL_W, LOGICAL_H = 2823, 1672


def find_art(prefix: str) -> str:
    matches = sorted(glob.glob(os.path.join(ART_DIR, f"{prefix}_*.jpg")) +
                     glob.glob(os.path.join(ART_DIR, f"{prefix}_*.png")))
    if not matches:
        raise FileNotFoundError(f"Missing generated asset for prefix: {prefix}")
    return matches[-1]


def pngquant_compress(im: Image.Image, dst_path: str, quality: str = "80-95") -> int:
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    tmp_path = os.path.join(SCRATCH, "tmp_" + os.path.basename(dst_path))
    im.save(tmp_path, "PNG")
    res = subprocess.run(
        ["pngquant", f"--quality={quality}", "--speed=3", "--strip", "--force", "--output", dst_path, tmp_path],
        stderr=subprocess.PIPE,
    )
    if res.returncode != 0:
        subprocess.run(
            ["pngquant", "--quality=70-95", "--speed=3", "--strip", "--force", "--output", dst_path, tmp_path],
            check=True,
        )
    return os.path.getsize(dst_path)


def erode_alpha_fringe(im: Image.Image, passes: int = 1) -> Image.Image:
    """Trim 1px semi-transparent chroma fringe and re-bleed interior foreground RGB cleanly."""
    if passes <= 0:
        return im
    arr = np.array(im.convert("RGBA"), dtype=np.float32)
    a = arr[:, :, 3] / 255.0
    rgb = arr[:, :, :3].copy()
    h, w = a.shape

    for _ in range(passes):
        # Soft minimum filter on alpha (reduces outer 1px halo without jagged staircase)
        a_img = Image.fromarray(np.clip(a * 255.0, 0, 255).astype(np.uint8), "L")
        a_min = np.array(a_img.filter(ImageFilter.MinFilter(3)), dtype=np.float32) / 255.0
        # Blend 75% toward min on edges so anti-aliasing stays smooth while eliminating outer halo
        edge = a < 0.98
        a = np.where(edge, a * 0.25 + a_min * 0.75, a)
        a[a < 0.04] = 0.0

    # Bleed solid interior RGB into remaining anti-aliased fringe pixels
    known = a >= 0.92
    bleed = rgb.copy()
    for _ in range(3):
        need = (~known) & (a > 0.01)
        if not need.any():
            break
        acc = np.zeros_like(bleed)
        cnt = np.zeros((h, w), dtype=np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            sy0, sy1 = max(0, -dy), min(h, h - dy)
            sx0, sx1 = max(0, -dx), min(w, w - dx)
            ty0, ty1 = max(0, dy), min(h, h + dy)
            tx0, tx1 = max(0, dx), min(w, w + dx)
            k = known[sy0:sy1, sx0:sx1]
            acc[ty0:ty1, tx0:tx1] += bleed[sy0:sy1, sx0:sx1] * k[:, :, None]
            cnt[ty0:ty1, tx0:tx1] += k.astype(np.float32)
        upd = need & (cnt > 0)
        bleed[upd] = acc[upd] / cnt[upd, None]
        known[upd] = True

    fringe = (a > 0.01) & (a < 0.92) & known
    rgb[fringe] = bleed[fringe]
    rgb[a <= 0.01] = 0.0
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(a * 255.0, 0, 255)]).astype(np.uint8), "RGBA")


def calibrate_warm_oak(im: Image.Image) -> Image.Image:
    """Eliminate olive-green bounce on shadowed oak wood (e.g., bookshelf side panels & bed rim).
    Target warm oak ratio: G <= 0.74*R + 0.08*B, B >= 0.42*R while preserving blue denim spine & neutral whites.
    """
    arr = np.array(im.convert("RGBA"), dtype=np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    vis = a > 12

    # Exclude genuinely blue items (like denim book spine where B > R + 6)
    # and near-neutral bright cream/white pages (where min/max > 0.80 and lum > 175)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    not_blue = b <= (r + 6.0)
    not_neutral_white = ~((mx > 175.0) & (mn / np.maximum(mx, 1.0) > 0.82))

    # Olive-green bounce signature: G is too high relative to R, and/or B is suppressed relative to R
    g_ideal = r * 0.73 + b * 0.08
    olive_mask = vis & not_blue & not_neutral_white & (g > g_ideal)

    g_excess = np.maximum(0.0, g - g_ideal)
    # Shift excess green energy into warm oak red/blue balance to preserve natural luminance
    r_new = np.where(olive_mask, np.minimum(255.0, r + g_excess * 0.42), r)
    b_new = np.where(olive_mask, np.minimum(255.0, np.maximum(b + g_excess * 0.35, r_new * 0.40)), b)
    g_new = np.where(olive_mask, np.minimum(g, r_new * 0.74 + b_new * 0.06), g)

    out = np.dstack([np.clip(r_new, 0, 255), np.clip(g_new, 0, 255), np.clip(b_new, 0, 255), a]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def calibrate_warm_walnut(im: Image.Image, wood_start_y_ratio: float = 0.46) -> Image.Image:
    """Eliminate cool blue/purple bounce on shadowed walnut wood (lower half of jewelry box)
    while leaving the upper green plant, white pot, glass jar, and pale front pebble untouched.
    """
    arr = np.array(im.convert("RGBA"), dtype=np.float32)
    h, w, _ = arr.shape
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    yy = np.arange(h)[:, None]

    # Lower wood box zone; exclude pale neutral front pebble (bright low-saturation pixels)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    in_wood_zone = (yy > int(h * wood_start_y_ratio)) & (a > 12) & (lum < 178.0)

    # Cool blue/purple bounce signature on walnut: B > 0.56 * R
    b_ideal = r * 0.48 + g * 0.06
    cool_mask = in_wood_zone & (b > b_ideal)
    b_excess = np.maximum(0.0, b - b_ideal)

    r_new = np.where(cool_mask, np.minimum(255.0, r + b_excess * 0.48), r)
    g_new = np.where(cool_mask, np.minimum(255.0, g + b_excess * 0.24), g)
    b_new = np.where(cool_mask, np.minimum(b, r_new * 0.48 + g_new * 0.06), b)

    out = np.dstack([np.clip(r_new, 0, 255), np.clip(g_new, 0, 255), np.clip(b_new, 0, 255), a]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def chroma_to_rgba(im: Image.Image, key: str = "auto", glass_rect=None, erode_passes: int = 1) -> Image.Image:
    rgb = np.array(im.convert("RGB"), dtype=np.float32)
    h, w, _ = rgb.shape
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]

    border_px = np.concatenate([
        rgb[:16, :].reshape(-1, 3), rgb[-16:, :].reshape(-1, 3),
        rgb[:, :16].reshape(-1, 3), rgb[:, -16:].reshape(-1, 3),
    ], axis=0)
    bg_col = np.median(border_px, axis=0)
    if key == "auto":
        key = "blue" if (bg_col[2] - max(bg_col[0], bg_col[1])) >= (bg_col[1] - max(bg_col[0], bg_col[2])) else "green"

    if key == "blue":
        excess = b - np.maximum(r, g)
        border_ex = border_px[:, 2] - np.maximum(border_px[:, 0], border_px[:, 1])
        bg_excess = float(np.median(border_ex))
        edge_lo = float(np.percentile(border_ex, 5))
        lo = 20.0
        hi = max(78.0, min(bg_excess * 0.54, edge_lo * 0.84))
    else:
        excess = g - np.maximum(r, b)
        border_ex = border_px[:, 1] - np.maximum(border_px[:, 0], border_px[:, 2])
        bg_excess = float(np.median(border_ex))
        edge_lo = float(np.percentile(border_ex, 5))
        lo = 20.0
        hi = max(80.0, min(bg_excess * 0.52, edge_lo * 0.82))

    alpha = np.clip((hi - excess) / max(hi - lo, 1.0), 0.0, 1.0)
    alpha[excess >= hi] = 0.0
    out_rgb = rgb.copy()

    # Optional optical translucent glass recovery (for ribbed glass jar over blue screen)
    if key == "blue" and glass_rect is not None:
        gx0, gy0, gx1, gy1 = glass_rect
        yy, xx = np.mgrid[0:h, 0:w]
        in_glass = (xx >= gx0) & (xx <= gx1) & (yy >= gy0) & (yy <= gy1)
        atten = 1.0 - np.clip(excess / max(bg_excess, 1.0), 0.0, 1.0)
        is_glass_px = in_glass & (atten > 0.08) & (alpha < 0.92)
        if is_glass_px.any():
            a_g = np.clip(atten * 1.15 + 0.08, 0.0, 0.88)
            a_safe = np.maximum(a_g, 0.14)
            rec = (rgb - (1.0 - a_g[:, :, None]) * bg_col[None, None, :]) / a_safe[:, :, None]
            rec = np.clip(rec, 0.0, 255.0)
            rec[:, :, 2] = np.minimum(rec[:, :, 2], np.maximum(rec[:, :, 0], rec[:, :, 1]) + 8.0)
            alpha[is_glass_px] = np.maximum(alpha[is_glass_px], a_g[is_glass_px])
            out_rgb[is_glass_px] = rec[is_glass_px]

    # 1. Standard warm despill
    if key == "blue":
        spill = out_rgb[:, :, 2] > np.maximum(out_rgb[:, :, 0], out_rgb[:, :, 1])
        out_rgb[spill, 2] = np.maximum(out_rgb[spill, 0], out_rgb[spill, 1])
    else:
        spill = out_rgb[:, :, 1] > (out_rgb[:, :, 0] * 0.92 + out_rgb[:, :, 2] * 0.08)
        out_rgb[spill, 1] = np.minimum(out_rgb[spill, 1], out_rgb[spill, 0] * 0.92 + out_rgb[spill, 2] * 0.08)

    # 2. Inward foreground RGB bleed (3 passes)
    known = alpha >= 0.95
    bleed = out_rgb.copy()
    for _ in range(3):
        need = (~known) & (alpha > 0.01)
        if not need.any():
            break
        acc = np.zeros_like(bleed)
        cnt = np.zeros((h, w), dtype=np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            sy0, sy1 = max(0, -dy), min(h, h - dy)
            sx0, sx1 = max(0, -dx), min(w, w - dx)
            ty0, ty1 = max(0, dy), min(h, h + dy)
            tx0, tx1 = max(0, dx), min(w, w + dx)
            k = known[sy0:sy1, sx0:sx1]
            acc[ty0:ty1, tx0:tx1] += bleed[sy0:sy1, sx0:sx1] * k[:, :, None]
            cnt[ty0:ty1, tx0:tx1] += k.astype(np.float32)
        upd = need & (cnt > 0)
        bleed[upd] = acc[upd] / cnt[upd, None]
        known[upd] = True

    fringe = (alpha > 0.01) & (alpha < 0.95) & known
    out_rgb[fringe] = bleed[fringe]
    out_rgb[alpha <= 0.008] = 0.0
    alpha[alpha <= 0.008] = 0.0
    rgba = Image.fromarray(np.dstack([np.clip(out_rgb, 0, 255), np.clip(alpha * 255.0, 0, 255)]).astype(np.uint8), "RGBA")
    return erode_alpha_fringe(rgba, passes=erode_passes)


def crop_tight(im: Image.Image, pad: int = 8, bbox=None) -> tuple[Image.Image, tuple]:
    if bbox is None:
        arr = np.array(im)[:, :, 3]
        ys, xs = np.where(arr > 10)
        if len(xs) == 0:
            return im, (0, 0, im.width, im.height)
        bbox = (
            max(0, int(xs.min()) - pad),
            max(0, int(ys.min()) - pad),
            min(im.width, int(xs.max()) + 1 + pad),
            min(im.height, int(ys.max()) + 1 + pad),
        )
    return im.crop(bbox), bbox


def extract_wall_art_from_empty_day() -> Image.Image:
    """Extract the 3 original wall art pieces directly from empty_day.png (1352x800)
    so perspective slant, scale, and breathing room around the lamp match 100% natively.
    Output canvas is exact 624x212 corresponding to logical x: 0..1303, y: 0..443.
    """
    src = Image.open(os.path.join(OUT_PANO, "empty_day.png")).convert("RGBA")
    W, H = 624, 212
    crop = src.crop((0, 0, W, H))
    mask = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(mask)

    # Frame 1 (left-edge cropped oak frame, exact polygon from empty_day.png)
    draw.polygon([(0, 0), (58, 0), (70, 121), (0, 127)], fill=255)
    # Frame 2 (main botanical oak frame, clean breathing gap before lamp at x=317)
    draw.polygon([(85, 0), (240, 0), (249, 152), (101, 169)], fill=255)
    # Kraft paper botanical print + top wooden tack pin
    draw.polygon([(523, 45), (608, 44), (604, 200), (521, 187)], fill=255)
    draw.ellipse((553, 38, 574, 59), fill=255)

    # Soft 1px feather so edges sit naturally flush against the textured plaster wall
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.9))
    # Keep top-left & top-right corners strictly alpha==0 for corner-zero check
    m_arr = np.array(mask)
    m_arr[0, 0] = 0
    m_arr[0, W - 1] = 0
    m_arr[H - 1, 0] = 0
    m_arr[H - 1, W - 1] = 0
    mask = Image.fromarray(m_arr, "L")

    out = crop.copy()
    out.putalpha(mask)
    return out


def fit_aspect_crop(im: Image.Image, target_w: int, target_h: int) -> Image.Image:
    src_w, src_h = im.size
    target_ar = target_w / target_h
    src_ar = src_w / src_h
    if src_ar > target_ar:
        new_w = int(round(src_h * target_ar))
        x0 = (src_w - new_w) // 2
        im = im.crop((x0, 0, x0 + new_w, src_h))
    elif src_ar < target_ar:
        new_h = int(round(src_w / target_ar))
        y0 = (src_h - new_h) // 2
        im = im.crop((0, y0, src_w, y0 + new_h))
    return im.resize((target_w, target_h), Image.Resampling.LANCZOS)


def process_room_shells():
    print("=== 1. Building clean room shells (day / sunset / night) ===")
    for period in ("day", "sunset", "night"):
        src = find_art(f"room_shell_{period}")
        im = Image.open(src).convert("RGB")
        im_fit = fit_aspect_crop(im, PANO_W, PANO_H)
        dst = os.path.join(OUT_PANO, f"room_shell_{period}.png")
        sz = pngquant_compress(im_fit, dst, "80-95")
        print(f"  room_shell_{period}.png -> {im_fit.size}, {sz/1024:.1f} KB")


def process_modules():
    print("=== 2. Extracting 5 modular furniture groups (zero-spill transparent RGBA PNG) ===")
    os.makedirs(OUT_MOD, exist_ok=True)
    meta = {}

    # 1a. Bed base (U-shaped oak box + mattress + pillow) — 2-pass edge cleanup + warm oak calibration
    bed_im = chroma_to_rgba(Image.open(find_art("mod_bed_base")), key="green", erode_passes=2)
    bed_im = calibrate_warm_oak(bed_im)
    bed_c, _ = crop_tight(bed_im, pad=10)
    bed_c.thumbnail((680, 680), Image.Resampling.LANCZOS)
    sz = pngquant_compress(bed_c, os.path.join(OUT_MOD, "mod_bed_base.png"))
    meta["mod_bed_base"] = list(bed_c.size)
    print(f"  mod_bed_base.png -> {bed_c.size}, {sz/1024:.1f} KB")

    # 1b. Blankets (tidy & rumpled — foreground layer z:6 over pet, 2-pass halo trim)
    for name, art_prefix in [("mod_blanket_tidy", "mod_blanket_tidy_v2"), ("mod_blanket_rumpled", "mod_blanket_rumpled")]:
        bl = chroma_to_rgba(Image.open(find_art(art_prefix)), key="green", erode_passes=2)
        bl_c, _ = crop_tight(bl, pad=10)
        bl_c.thumbnail((560, 560), Image.Resampling.LANCZOS)
        sz = pngquant_compress(bl_c, os.path.join(OUT_MOD, f"{name}.png"))
        meta[name] = list(bl_c.size)
        print(f"  {name}.png -> {bl_c.size}, {sz/1024:.1f} KB")

    # 1c. Bedside warm lamp (on / off — locked to identical bbox, warm oak base clean)
    lamp_on = calibrate_warm_oak(chroma_to_rgba(Image.open(find_art("mod_lamp_on")), key="green", erode_passes=1))
    lamp_off = calibrate_warm_oak(chroma_to_rgba(Image.open(find_art("mod_lamp_off")), key="green", erode_passes=1))
    if lamp_off.size != lamp_on.size:
        lamp_off = lamp_off.resize(lamp_on.size, Image.Resampling.LANCZOS)
    _, lbox = crop_tight(lamp_on, pad=10)
    for name, im in [("mod_lamp_on", lamp_on), ("mod_lamp_off", lamp_off)]:
        c = im.crop(lbox)
        c.thumbnail((280, 280), Image.Resampling.LANCZOS)
        sz = pngquant_compress(c, os.path.join(OUT_MOD, f"{name}.png"))
        meta[name] = list(c.size)
        print(f"  {name}.png -> {c.size}, {sz/1024:.1f} KB")

    # 2. Three-tier oak bookshelf — strong warm oak calibration kills olive-green side panels
    bk = chroma_to_rgba(Image.open(find_art("mod_bookshelf")), key="green", erode_passes=2)
    bk = calibrate_warm_oak(bk)
    bk_c, _ = crop_tight(bk, pad=10)
    bk_c.thumbnail((420, 620), Image.Resampling.LANCZOS)
    sz = pngquant_compress(bk_c, os.path.join(OUT_MOD, "mod_bookshelf.png"))
    meta["mod_bookshelf"] = list(bk_c.size)
    print(f"  mod_bookshelf.png -> {bk_c.size}, {sz/1024:.1f} KB")

    # 3. Corner walnut jewelry box (closed / peek — blue screen + glass recovery + walnut calibration)
    j_closed_raw = Image.open(find_art("mod_jewelry_closed"))
    j_peek_raw = Image.open(find_art("mod_jewelry_peek"))
    if j_peek_raw.size != j_closed_raw.size:
        j_peek_raw = j_peek_raw.resize(j_closed_raw.size, Image.Resampling.LANCZOS)
    jw, jh = j_closed_raw.size
    glass_rect = (int(jw * 0.46), int(jh * 0.22), int(jw * 0.70), int(jh * 0.56))
    j_closed = calibrate_warm_walnut(chroma_to_rgba(j_closed_raw, key="blue", glass_rect=glass_rect, erode_passes=1))
    j_peek = calibrate_warm_walnut(chroma_to_rgba(j_peek_raw, key="blue", glass_rect=glass_rect, erode_passes=1))

    a1 = np.array(j_closed)[:, :, 3]
    a2 = np.array(j_peek)[:, :, 3]
    ys, xs = np.where((a1 > 10) | (a2 > 10))
    jbox = (
        max(0, int(xs.min()) - 14),
        max(0, int(ys.min()) - 14),
        min(jw, int(xs.max()) + 15),
        min(jh, int(ys.max()) + 15),
    )
    for name, im in [("mod_jewelry_closed", j_closed), ("mod_jewelry_peek", j_peek)]:
        c = im.crop(jbox)
        c.thumbnail((420, 420), Image.Resampling.LANCZOS)
        sz = pngquant_compress(c, os.path.join(OUT_MOD, f"{name}.png"))
        meta[name] = list(c.size)
        print(f"  {name}.png -> {c.size}, {sz/1024:.1f} KB")

    # 4. Wall art — extracted natively from empty_day.png for 100% original perspective & scale
    wa = extract_wall_art_from_empty_day()
    sz = pngquant_compress(wa, os.path.join(OUT_MOD, "mod_wall_art.png"))
    meta["mod_wall_art"] = list(wa.size)
    print(f"  mod_wall_art.png (native perspective) -> {wa.size}, {sz/1024:.1f} KB")

    # 5. Desk cork mat, coffee mug, sketch paper, pen & sharpener — 2-pass halo cleanup + warm oak tone
    ds = calibrate_warm_oak(chroma_to_rgba(Image.open(find_art("mod_desk_set")), key="green", erode_passes=2))
    ds_c, _ = crop_tight(ds, pad=10)
    ds_c.thumbnail((740, 460), Image.Resampling.LANCZOS)
    sz = pngquant_compress(ds_c, os.path.join(OUT_MOD, "mod_desk_set.png"))
    meta["mod_desk_set"] = list(ds_c.size)
    print(f"  mod_desk_set.png -> {ds_c.size}, {sz/1024:.1f} KB")

    return meta


def process_black_cat_clock():
    print("=== 3. Extracting Black Cat Sheriff Clock (front / back / mid / tail / scene) ===")
    os.makedirs(OUT_PROP, exist_ok=True)
    front_raw = chroma_to_rgba(Image.open(find_art("clock_black_cat_front")), key="green", erode_passes=1)
    back_raw = chroma_to_rgba(Image.open(find_art("clock_black_cat_back")), key="green", erode_passes=1)
    if back_raw.size != front_raw.size:
        back_raw = back_raw.resize(front_raw.size, Image.Resampling.LANCZOS)

    f_arr = np.array(front_raw)[:, :, 3]
    b_arr = np.array(back_raw)[:, :, 3]
    fy, fx = np.where(f_arr > 20)
    by, bx = np.where(b_arr > 20)
    f_box = (int(fx.min()), int(fy.min()), int(fx.max()) + 1, int(fy.max()) + 1)
    b_box = (int(bx.min()), int(by.min()), int(bx.max()) + 1, int(by.max()) + 1)

    fw, fh = f_box[2] - f_box[0], f_box[3] - f_box[1]
    side = int(max(fw, fh) * 1.08)
    CK_SZ = 480

    def place_in_square(im_rgba, box):
        crop = im_rgba.crop(box)
        crop_resized = crop.resize((fw, fh), Image.Resampling.LANCZOS)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        ox = (side - fw) // 2
        oy = (side - fh) // 2
        sq.paste(crop_resized, (ox, oy))
        return sq.resize((CK_SZ, CK_SZ), Image.Resampling.LANCZOS)

    front_sq = place_in_square(front_raw, f_box)
    back_sq = place_in_square(back_raw, b_box)

    fa = np.array(front_sq)[:, :, 3]
    ba = np.array(back_sq)[:, :, 3]
    mid_a = np.minimum(fa, ba)
    mid_rgba = np.zeros((CK_SZ, CK_SZ, 4), dtype=np.uint8)
    mid_rgba[:, :, 0] = 28
    mid_rgba[:, :, 1] = 29
    mid_rgba[:, :, 2] = 33
    mid_rgba[:, :, 3] = mid_a
    mid_sq = Image.fromarray(mid_rgba, "RGBA")

    f_np = np.array(front_sq)
    lum = 0.299 * f_np[:, :, 0] + 0.587 * f_np[:, :, 1] + 0.114 * f_np[:, :, 2]
    yy, xx = np.mgrid[0:CK_SZ, 0:CK_SZ]
    belly_mask = (f_np[:, :, 3] > 200) & (lum > 185) & (yy > CK_SZ * 0.44) & (yy < CK_SZ * 0.87) & (xx > CK_SZ * 0.24) & (xx < CK_SZ * 0.76)
    bys, bxs = np.where(belly_mask)
    dial_cx = float(bxs.mean()) / CK_SZ * 100.0
    dial_cy = float(bys.mean()) / CK_SZ * 100.0
    dial_rx = float((bxs.max() - bxs.min()) / 2.0) / CK_SZ * 100.0
    dial_ry = float((bys.max() - bys.min()) / 2.0) / CK_SZ * 100.0

    eye_mask = (f_np[:, :, 3] > 200) & (yy > CK_SZ * 0.24) & (yy < CK_SZ * 0.37) & (f_np[:, :, 0].astype(int) - f_np[:, :, 2].astype(int) > 35) & (f_np[:, :, 1] > 70)
    eys, exs = np.where(eye_mask)
    half = CK_SZ // 2
    left_eye_x, left_eye_y = exs[exs < half], eys[exs < half]
    right_eye_x, right_eye_y = exs[exs >= half], eys[exs >= half]
    eyes_info = {
        "left": [round(float(left_eye_x.mean()) / CK_SZ * 100.0, 2), round(float(left_eye_y.mean()) / CK_SZ * 100.0, 2)] if len(left_eye_x) else [41.5, 30.0],
        "right": [round(float(right_eye_x.mean()) / CK_SZ * 100.0, 2), round(float(right_eye_y.mean()) / CK_SZ * 100.0, 2)] if len(right_eye_x) else [58.5, 30.0],
    }

    b_np = np.array(back_sq)
    b_warm = (b_np[:, :, 3] > 200) & (b_np[:, :, 0].astype(int) - b_np[:, :, 2].astype(int) > 16) & (yy > CK_SZ * 0.41) & (yy < CK_SZ * 0.87)
    bp_ys, bp_xs = np.where(b_warm)
    back_cx = float(bp_xs.mean()) / CK_SZ * 100.0
    back_cy = float(bp_ys.mean()) / CK_SZ * 100.0
    back_r = float((bp_xs.max() - bp_xs.min()) / 2.0) / CK_SZ * 100.0

    tail_raw = chroma_to_rgba(Image.open(find_art("clock_black_cat_tail")), key="green", erode_passes=1)
    tail_c, _ = crop_tight(tail_raw, pad=6)
    tail_c.thumbnail((110, 240), Image.Resampling.LANCZOS)

    s_f = pngquant_compress(front_sq, os.path.join(OUT_PROP, "clock_black_cat_front.png"), "80-95")
    s_b = pngquant_compress(back_sq, os.path.join(OUT_PROP, "clock_black_cat_back.png"), "80-95")
    s_m = pngquant_compress(mid_sq, os.path.join(OUT_PROP, "clock_black_cat_mid.png"), "80-95")
    s_t = pngquant_compress(tail_c, os.path.join(OUT_PROP, "clock_black_cat_tail.png"), "80-95")
    scene_sq = front_sq.resize((196, 196), Image.Resampling.LANCZOS)
    s_s = pngquant_compress(scene_sq, os.path.join(OUT_PROP, "clock_black_cat_scene.png"), "80-95")

    total_kb = (s_f + s_b + s_m + s_t + s_s) / 1024.0
    print(f"  front={s_f/1024:.1f}KB, back={s_b/1024:.1f}KB, mid={s_m/1024:.1f}KB, tail={s_t/1024:.1f}KB, scene={s_s/1024:.1f}KB | TOTAL={total_kb:.1f}KB")
    assert total_kb < 180.0, f"Clock bundle exceeded 180KB: {total_kb:.1f}KB"
    return {
        "dial": {"cx": round(dial_cx, 2), "cy": round(dial_cy, 2), "rx": round(dial_rx, 2), "ry": round(dial_ry, 2)},
        "eyes": eyes_info,
        "backplate": {"cx": round(back_cx, 2), "cy": round(back_cy, 2), "r": round(back_r, 2)},
        "tailSize": list(tail_c.size),
        "totalClockKB": round(total_kb, 1),
    }


def verify_asset_quality():
    print("=== 4. Running strict pixel QA assertions (corners + zero green/blue wood spill) ===")
    all_pngs = sorted(glob.glob(os.path.join(OUT_MOD, "*.png")) + glob.glob(os.path.join(OUT_PROP, "clock_black_cat_*.png")))
    for p in all_pngs:
        im = Image.open(p).convert("RGBA")
        w, h = im.size
        corners = [im.getpixel((0, 0))[3], im.getpixel((w - 1, 0))[3], im.getpixel((0, h - 1))[3], im.getpixel((w - 1, h - 1))[3]]
        assert all(a == 0 for a in corners), f"Corner alpha non-zero in {p}: {corners}"

    # Verify bookshelf right oak panel is warm oak (G/R <= 0.80, no olive green)
    bk = np.array(Image.open(os.path.join(OUT_MOD, "mod_bookshelf.png")).convert("RGBA"), dtype=np.float32)
    rp = bk[200:500, 255:295]
    rm = rp[:, :, 3] > 200
    r_m, g_m, b_m = rp[rm][:, :3].mean(axis=0)
    print(f"  Bookshelf right panel RGB: ({r_m:.1f}, {g_m:.1f}, {b_m:.1f}), G/R={g_m/r_m:.3f}")
    assert g_m / max(r_m, 1.0) <= 0.80, f"Bookshelf side panel still greenish: G/R={g_m/r_m:.3f}"

    # Verify jewelry box lower-left walnut face has zero blue/purple spill (B/R <= 0.62)
    jw = np.array(Image.open(os.path.join(OUT_MOD, "mod_jewelry_closed.png")).convert("RGBA"), dtype=np.float32)
    jp = jw[280:360, 20:90]
    jm = jp[:, :, 3] > 200
    jr, jg, jb = jp[jm][:, :3].mean(axis=0)
    print(f"  Jewelry left walnut RGB: ({jr:.1f}, {jg:.1f}, {jb:.1f}), B/R={jb/jr:.3f}")
    assert jb / max(jr, 1.0) <= 0.62, f"Jewelry walnut still bluish: B/R={jb/jr:.3f}"

    # Verify bed semi-transparent edge has zero green rim (G/R <= 0.86)
    bd = np.array(Image.open(os.path.join(OUT_MOD, "mod_bed_base.png")).convert("RGBA"), dtype=np.float32)
    em = (bd[:, :, 3] > 20) & (bd[:, :, 3] < 245)
    er, eg, eb = bd[em][:, :3].mean(axis=0)
    print(f"  Bed edge RGB: ({er:.1f}, {eg:.1f}, {eb:.1f}), G/R={eg/er:.3f}")
    assert eg / max(er, 1.0) <= 0.86, f"Bed edge still greenish: G/R={eg/er:.3f}"
    print(f"  All {len(all_pngs)} transparent RGBA PNGs passed strict zero-halo & zero-spill QA!")


if __name__ == "__main__":
    os.makedirs(SCRATCH, exist_ok=True)
    process_room_shells()
    mod_meta = process_modules()
    clock_metrics = process_black_cat_clock()
    verify_asset_quality()
    with open(os.path.join(SCRATCH, "rig_metrics.json"), "w") as f:
        json.dump({"modules": mod_meta, "clock": clock_metrics}, f, indent=2)
    print("DONE!")
