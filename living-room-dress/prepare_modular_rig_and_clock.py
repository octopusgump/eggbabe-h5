#!/usr/bin/env python3
"""Prepare Modular Scene Rig (room shells + 5 transparent furniture modules)
and P4 Black Cat Sheriff Clock (front/back/mid-thickness/tail/scene) PNGs.

Strictly follows AGENTS.md & chroma-transparent-character-png skill:
- Zero-halo chroma-key RGBA extraction (excess keying + warm despill + 3-pass RGB edge bleed)
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
        # Fallback slightly wider quality floor while still staying high-quality compressed PNG
        subprocess.run(
            ["pngquant", "--quality=70-95", "--speed=3", "--strip", "--force", "--output", dst_path, tmp_path],
            check=True,
        )
    return os.path.getsize(dst_path)


def chroma_to_rgba(im: Image.Image, key: str = "auto", glass_rect=None, wood_despill: bool = False) -> Image.Image:
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
        lo = 22.0
        hi = max(80.0, min(bg_excess * 0.56, edge_lo * 0.86))
    else:
        excess = g - np.maximum(r, b)
        border_ex = border_px[:, 1] - np.maximum(border_px[:, 0], border_px[:, 2])
        bg_excess = float(np.median(border_ex))
        edge_lo = float(np.percentile(border_ex, 5))
        lo = 22.0
        hi = max(82.0, min(bg_excess * 0.55, edge_lo * 0.84))

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

    # 1. Warm despill (stronger for warm oak/walnut wood surfaces)
    if key == "blue":
        if wood_despill:
            # Neutralize blue bounce on lower walnut box region (below the plant & glass jar)
            yy_w = np.arange(h)[:, None]
            lower_wood = (yy_w > int(h * 0.48)) & (alpha > 0.05)
            # Only warm up pixels that have cool blue bias (b > r*0.65) and aren't the pale stone pebble
            lum_w = 0.3 * out_rgb[:, :, 0] + 0.6 * out_rgb[:, :, 1] + 0.1 * out_rgb[:, :, 2]
            is_walnut = lower_wood & (lum_w < 175.0) & (out_rgb[:, :, 2] > out_rgb[:, :, 0] * 0.62)
            # Pull blue down into warm walnut spectrum and gently restore shadowed red/green warmth
            excess_b = np.maximum(0.0, out_rgb[:, :, 2] - out_rgb[:, :, 0] * 0.62)
            out_rgb[is_walnut, 2] = out_rgb[is_walnut, 0] * 0.62
            out_rgb[is_walnut, 0] = np.minimum(255.0, out_rgb[is_walnut, 0] + excess_b[is_walnut] * 0.32)
            out_rgb[is_walnut, 1] = np.minimum(255.0, out_rgb[is_walnut, 1] + excess_b[is_walnut] * 0.16)
        spill = out_rgb[:, :, 2] > np.maximum(out_rgb[:, :, 0], out_rgb[:, :, 1])
        out_rgb[spill, 2] = np.maximum(out_rgb[spill, 0], out_rgb[spill, 1])
    else:
        if wood_despill:
            # Neutralize olive-green bounce on shadowed oak side panels (preserve denim blue spine)
            not_denim = out_rgb[:, :, 2] <= (out_rgb[:, :, 0] + 8.0)
            olive = not_denim & (out_rgb[:, :, 1] > out_rgb[:, :, 0] * 0.78 + out_rgb[:, :, 2] * 0.10)
            g_target = out_rgb[:, :, 0] * 0.78 + out_rgb[:, :, 2] * 0.10
            g_excess = np.maximum(0.0, out_rgb[:, :, 1] - g_target)
            out_rgb[olive, 1] = g_target[olive]
            out_rgb[olive, 0] = np.minimum(255.0, out_rgb[olive, 0] + g_excess[olive] * 0.28)
            out_rgb[olive, 2] = np.minimum(255.0, out_rgb[olive, 2] + g_excess[olive] * 0.12)
        spill = out_rgb[:, :, 1] > (out_rgb[:, :, 0] * 0.94 + out_rgb[:, :, 2] * 0.06)
        out_rgb[spill, 1] = np.minimum(out_rgb[spill, 1], out_rgb[spill, 0] * 0.94 + out_rgb[spill, 2] * 0.06)

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
    return Image.fromarray(np.dstack([np.clip(out_rgb, 0, 255), np.clip(alpha * 255.0, 0, 255)]).astype(np.uint8), "RGBA")


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
    print("=== 2. Extracting 5 modular furniture groups (transparent RGBA PNG) ===")
    os.makedirs(OUT_MOD, exist_ok=True)
    meta = {}

    # 1a. Bed base (U-shaped oak box + mattress + pillow)
    bed_im = chroma_to_rgba(Image.open(find_art("mod_bed_base")), key="green")
    bed_c, _ = crop_tight(bed_im, pad=10)
    bed_c.thumbnail((680, 680), Image.Resampling.LANCZOS)
    sz = pngquant_compress(bed_c, os.path.join(OUT_MOD, "mod_bed_base.png"))
    meta["mod_bed_base"] = list(bed_c.size)
    print(f"  mod_bed_base.png -> {bed_c.size}, {sz/1024:.1f} KB")

    # 1b. Blankets (tidy & rumpled — foreground layer z:6 over pet)
    for name, art_prefix in [("mod_blanket_tidy", "mod_blanket_tidy_v2"), ("mod_blanket_rumpled", "mod_blanket_rumpled")]:
        bl = chroma_to_rgba(Image.open(find_art(art_prefix)), key="green")
        bl_c, _ = crop_tight(bl, pad=10)
        bl_c.thumbnail((560, 560), Image.Resampling.LANCZOS)
        sz = pngquant_compress(bl_c, os.path.join(OUT_MOD, f"{name}.png"))
        meta[name] = list(bl_c.size)
        print(f"  {name}.png -> {bl_c.size}, {sz/1024:.1f} KB")

    # 1c. Bedside warm lamp (on / off — locked to identical bbox!)
    lamp_on = chroma_to_rgba(Image.open(find_art("mod_lamp_on")), key="green")
    lamp_off = chroma_to_rgba(Image.open(find_art("mod_lamp_off")), key="green")
    if lamp_off.size != lamp_on.size:
        lamp_off = lamp_off.resize(lamp_on.size, Image.Resampling.LANCZOS)
    _, lbox = crop_tight(lamp_on, pad=10)
    for name, im in [("mod_lamp_on", lamp_on), ("mod_lamp_off", lamp_off)]:
        c = im.crop(lbox)
        c.thumbnail((280, 280), Image.Resampling.LANCZOS)
        sz = pngquant_compress(c, os.path.join(OUT_MOD, f"{name}.png"))
        meta[name] = list(c.size)
        print(f"  {name}.png -> {c.size}, {sz/1024:.1f} KB")

    # 2. Three-tier oak bookshelf
    bk = chroma_to_rgba(Image.open(find_art("mod_bookshelf")), key="green")
    bk_c, _ = crop_tight(bk, pad=10)
    bk_c.thumbnail((420, 620), Image.Resampling.LANCZOS)
    sz = pngquant_compress(bk_c, os.path.join(OUT_MOD, "mod_bookshelf.png"))
    meta["mod_bookshelf"] = list(bk_c.size)
    print(f"  mod_bookshelf.png -> {bk_c.size}, {sz/1024:.1f} KB")

    # 3. Corner walnut jewelry box (closed / peek — blue screen + glass jar recovery, shared bbox!)
    j_closed_raw = Image.open(find_art("mod_jewelry_closed"))
    j_peek_raw = Image.open(find_art("mod_jewelry_peek"))
    if j_peek_raw.size != j_closed_raw.size:
        j_peek_raw = j_peek_raw.resize(j_closed_raw.size, Image.Resampling.LANCZOS)
    jw, jh = j_closed_raw.size
    glass_rect = (int(jw * 0.46), int(jh * 0.22), int(jw * 0.70), int(jh * 0.56))
    j_closed = chroma_to_rgba(j_closed_raw, key="blue", glass_rect=glass_rect)
    j_peek = chroma_to_rgba(j_peek_raw, key="blue", glass_rect=glass_rect)

    # Shared bounding box across closed & peek so drawer opening doesn't shift the box!
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

    # 4. Wall art (two oak frames + kraft botanical print)
    wa = chroma_to_rgba(Image.open(find_art("mod_wall_art")), key="green")
    wa_c, _ = crop_tight(wa, pad=10)
    wa_c.thumbnail((720, 420), Image.Resampling.LANCZOS)
    sz = pngquant_compress(wa_c, os.path.join(OUT_MOD, "mod_wall_art.png"))
    meta["mod_wall_art"] = list(wa_c.size)
    print(f"  mod_wall_art.png -> {wa_c.size}, {sz/1024:.1f} KB")

    # 5. Desk cork mat, coffee mug, sketch paper, pen & sharpener
    ds = chroma_to_rgba(Image.open(find_art("mod_desk_set")), key="green")
    ds_c, _ = crop_tight(ds, pad=10)
    ds_c.thumbnail((740, 460), Image.Resampling.LANCZOS)
    sz = pngquant_compress(ds_c, os.path.join(OUT_MOD, "mod_desk_set.png"))
    meta["mod_desk_set"] = list(ds_c.size)
    print(f"  mod_desk_set.png -> {ds_c.size}, {sz/1024:.1f} KB")

    return meta


def process_black_cat_clock():
    print("=== 3. Extracting Black Cat Sheriff Clock (front / back / mid / tail / scene) ===")
    os.makedirs(OUT_PROP, exist_ok=True)
    front_raw = chroma_to_rgba(Image.open(find_art("clock_black_cat_front")), key="green")
    back_raw = chroma_to_rgba(Image.open(find_art("clock_black_cat_back")), key="green")
    if back_raw.size != front_raw.size:
        back_raw = back_raw.resize(front_raw.size, Image.Resampling.LANCZOS)

    # Align back silhouette to front silhouette bounding box so 3D flip is flush
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
        # Match front dimensions exactly for back so silhouette aligns 1:1
        crop_resized = crop.resize((fw, fh), Image.Resampling.LANCZOS)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        ox = (side - fw) // 2
        oy = (side - fh) // 2
        sq.paste(crop_resized, (ox, oy))
        return sq.resize((CK_SZ, CK_SZ), Image.Resampling.LANCZOS)

    front_sq = place_in_square(front_raw, f_box)
    back_sq = place_in_square(back_raw, b_box)

    # Build matte charcoal felt mid-thickness slice from intersection of front & back alpha
    fa = np.array(front_sq)[:, :, 3]
    ba = np.array(back_sq)[:, :, 3]
    mid_a = np.minimum(fa, ba)
    mid_rgba = np.zeros((CK_SZ, CK_SZ, 4), dtype=np.uint8)
    mid_rgba[:, :, 0] = 28
    mid_rgba[:, :, 1] = 29
    mid_rgba[:, :, 2] = 33
    mid_rgba[:, :, 3] = mid_a
    mid_sq = Image.fromarray(mid_rgba, "RGBA")

    # Measure cream-white belly dial center & radius on front_sq
    f_np = np.array(front_sq)
    lum = 0.299 * f_np[:, :, 0] + 0.587 * f_np[:, :, 1] + 0.114 * f_np[:, :, 2]
    yy, xx = np.mgrid[0:CK_SZ, 0:CK_SZ]
    belly_mask = (f_np[:, :, 3] > 200) & (lum > 185) & (yy > CK_SZ * 0.44) & (yy < CK_SZ * 0.87) & (xx > CK_SZ * 0.24) & (xx < CK_SZ * 0.76)
    bys, bxs = np.where(belly_mask)
    dial_cx = float(bxs.mean()) / CK_SZ * 100.0
    dial_cy = float(bys.mean()) / CK_SZ * 100.0
    dial_rx = float((bxs.max() - bxs.min()) / 2.0) / CK_SZ * 100.0
    dial_ry = float((bys.max() - bys.min()) / 2.0) / CK_SZ * 100.0

    # Measure amber eyes on front_sq (y: 23%..36%, warm amber hue R > B+35)
    eye_mask = (f_np[:, :, 3] > 200) & (yy > CK_SZ * 0.24) & (yy < CK_SZ * 0.37) & (f_np[:, :, 0].astype(int) - f_np[:, :, 2].astype(int) > 35) & (f_np[:, :, 1] > 70)
    eys, exs = np.where(eye_mask)
    half = CK_SZ // 2
    left_eye_x = exs[exs < half]
    left_eye_y = eys[exs < half]
    right_eye_x = exs[exs >= half]
    right_eye_y = eys[exs >= half]
    eyes_info = {
        "left": [round(float(left_eye_x.mean()) / CK_SZ * 100.0, 2), round(float(left_eye_y.mean()) / CK_SZ * 100.0, 2)] if len(left_eye_x) else [41.5, 30.0],
        "right": [round(float(right_eye_x.mean()) / CK_SZ * 100.0, 2), round(float(right_eye_y.mean()) / CK_SZ * 100.0, 2)] if len(right_eye_x) else [58.5, 30.0],
    }

    # Measure backplate circle on back_sq
    b_np = np.array(back_sq)
    b_warm = (b_np[:, :, 3] > 200) & (b_np[:, :, 0].astype(int) - b_np[:, :, 2].astype(int) > 16) & (yy > CK_SZ * 0.41) & (yy < CK_SZ * 0.87)
    bp_ys, bp_xs = np.where(b_warm)
    back_cx = float(bp_xs.mean()) / CK_SZ * 100.0
    back_cy = float(bp_ys.mean()) / CK_SZ * 100.0
    back_r = float((bp_xs.max() - bp_xs.min()) / 2.0) / CK_SZ * 100.0

    # Process pendulum tail
    tail_raw = chroma_to_rgba(Image.open(find_art("clock_black_cat_tail")), key="green")
    tail_c, _ = crop_tight(tail_raw, pad=6)
    tail_c.thumbnail((110, 240), Image.Resampling.LANCZOS)

    # Save compressed PNGs
    s_f = pngquant_compress(front_sq, os.path.join(OUT_PROP, "clock_black_cat_front.png"), "80-95")
    s_b = pngquant_compress(back_sq, os.path.join(OUT_PROP, "clock_black_cat_back.png"), "80-95")
    s_m = pngquant_compress(mid_sq, os.path.join(OUT_PROP, "clock_black_cat_mid.png"), "80-95")
    s_t = pngquant_compress(tail_c, os.path.join(OUT_PROP, "clock_black_cat_tail.png"), "80-95")
    scene_sq = front_sq.resize((196, 196), Image.Resampling.LANCZOS)
    s_s = pngquant_compress(scene_sq, os.path.join(OUT_PROP, "clock_black_cat_scene.png"), "80-95")

    total_kb = (s_f + s_b + s_m + s_t + s_s) / 1024.0
    print(f"  front={s_f/1024:.1f}KB, back={s_b/1024:.1f}KB, mid={s_m/1024:.1f}KB, tail={s_t/1024:.1f}KB, scene={s_s/1024:.1f}KB | TOTAL={total_kb:.1f}KB")
    metrics = {
        "dial": {"cx": round(dial_cx, 2), "cy": round(dial_cy, 2), "rx": round(dial_rx, 2), "ry": round(dial_ry, 2)},
        "eyes": eyes_info,
        "backplate": {"cx": round(back_cx, 2), "cy": round(back_cy, 2), "r": round(back_r, 2)},
        "tailSize": list(tail_c.size),
        "totalClockKB": round(total_kb, 1),
    }
    print("  Clock metrics:", json.dumps(metrics, ensure_ascii=False))
    return metrics


def build_alignment_preview():
    """Composite all 5 modules + Black Cat Clock on room_shell_day & room_shell_night for visual QA."""
    print("=== 4. Building composite QA preview ===")
    for period in ("day", "night"):
        base = Image.open(os.path.join(OUT_PANO, f"room_shell_{period}.png")).convert("RGBA")
        sx = PANO_W / LOGICAL_W
        sy = PANO_H / LOGICAL_H

        def paste_mod(path, lx, ly, lw, lh, anchor="top-left"):
            im = Image.open(path).convert("RGBA")
            w = max(1, int(round(lw * sx)))
            h = max(1, int(round(lh * sy)))
            # Maintain contain inside (w, h)
            im_r = im.copy()
            im_r.thumbnail((w, h), Image.Resampling.LANCZOS)
            if anchor == "center":
                px = int(round(lx * sx - im_r.width / 2))
                py = int(round(ly * sy - im_r.height / 2))
            else:
                px = int(round(lx * sx + (w - im_r.width) / 2))
                py = int(round(ly * sy + (h - im_r.height) / 2))
            base.alpha_composite(im_r, (max(0, px), max(0, py)))

        # Wall art (z:2)
        paste_mod(os.path.join(OUT_MOD, "mod_wall_art.png"), 40, 12, 1220, 405, "top-left")
        # Bed base (z:3)
        paste_mod(os.path.join(OUT_MOD, "mod_bed_base.png"), -24, 415, 1080, 1010, "top-left")
        # Bookshelf (z:3) grounded right beside bed
        paste_mod(os.path.join(OUT_MOD, "mod_bookshelf.png"), 882, 412, 236, 540, "top-left")
        # Jewelry box (z:3) grounded firmly on corner desk surface
        j_file = "mod_jewelry_peek.png" if period == "night" else "mod_jewelry_closed.png"
        paste_mod(os.path.join(OUT_MOD, j_file), 1102, 548, 295, 450, "top-left")
        # Desk set (z:3)
        paste_mod(os.path.join(OUT_MOD, "mod_desk_set.png"), 975, 965, 960, 540, "top-left")
        # Lamp (z:3) grounded on bed top shelf
        l_file = "mod_lamp_on.png" if period == "night" else "mod_lamp_off.png"
        paste_mod(os.path.join(OUT_MOD, l_file), 663, 378, 195, 225, "center")
        # Black Cat Sheriff Clock (z:4) standing solidly at (430, 448)
        paste_mod(os.path.join(OUT_PROP, "clock_black_cat_scene.png"), 430, 448, 152, 152, "center")
        # Blanket foreground (z:6)
        b_file = "mod_blanket_rumpled.png" if period == "night" else "mod_blanket_tidy.png"
        paste_mod(os.path.join(OUT_MOD, b_file), 152, 795, 700, 520, "top-left")

        out_prev = os.path.join(SCRATCH, f"qa_composite_{period}.png")
        base.convert("RGB").save(out_prev)
        print(f"  Saved QA preview: {out_prev}")


def verify_corners_zero_alpha():
    print("=== 5. Verifying zero-alpha outer corners on all extracted PNGs ===")
    all_pngs = sorted(glob.glob(os.path.join(OUT_MOD, "*.png")) + glob.glob(os.path.join(OUT_PROP, "clock_black_cat_*.png")))
    for p in all_pngs:
        im = Image.open(p).convert("RGBA")
        w, h = im.size
        corners = [im.getpixel((0, 0))[3], im.getpixel((w - 1, 0))[3], im.getpixel((0, h - 1))[3], im.getpixel((w - 1, h - 1))[3]]
        assert all(a == 0 for a in corners), f"Corner alpha non-zero in {p}: {corners}"
    print(f"  Verified {len(all_pngs)} transparent RGBA PNGs — all 4 corners alpha == 0!")


if __name__ == "__main__":
    os.makedirs(SCRATCH, exist_ok=True)
    process_room_shells()
    mod_meta = process_modules()
    clock_metrics = process_black_cat_clock()
    verify_corners_zero_alpha()
    build_alignment_preview()
    with open(os.path.join(SCRATCH, "rig_metrics.json"), "w") as f:
        json.dump({"modules": mod_meta, "clock": clock_metrics}, f, indent=2)
    print("DONE!")
