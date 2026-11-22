#!/usr/bin/env python3
"""
Chroma-key transparent PNG extraction, optical glass recovery, eye/feet alignment,
expression compositing, and QA contact-sheet generation for Yutu (v2b) full-body sets.

Follows the `chroma-transparent-character-png` pipeline.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WORK = Path(__file__).resolve().parent
ASSETS = WORK.parent.parent  # assets/
RAW_DIR = WORK / "sets_raw"
OUT_DIR = WORK / "sets"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Unified expanded canvas so wider props (carrot, lantern, watering can, straw hat, glass dome)
# never clip while keeping tex_base.png (600x1119) at an exact integer offset.
PAD_X = 120
PAD_Y = 30
BASE_W, BASE_H = 600, 1119
EXP_W = BASE_W + PAD_X * 2  # 840
EXP_H = BASE_H + PAD_Y * 2  # 1179

SETS = [
    {
        "id": "cozy_knit",
        "name": "奶油针织",
        "key": "blue",
        "translucent_dome": False,
        "raw": "set_cozy_knit.jpg",
    },
    {
        "id": "moon_palace",
        "name": "广寒桂月",
        "key": "green",
        "translucent_dome": False,
        "raw": "set_moon_palace.jpg",
    },
    {
        "id": "moss_gardener",
        "name": "苔藓园丁",
        "key": "blue",
        "translucent_dome": False,
        "raw": "set_moss_gardener.jpg",
    },
    {
        "id": "astro_bubble",
        "name": "泡泡宇航",
        "key": "blue",
        "translucent_dome": True,
        "raw": "set_astro_bubble.jpg",
    },
    {
        "id": "wolf_hood",
        "name": "狼皮小兔",
        "key": "green",
        "translucent_dome": False,
        "raw": "set_wolf_hood.jpg",
    },
    {
        "id": "duck_bathrobe",
        "name": "泡泡浴袍",
        "key": "blue",
        "translucent_dome": False,
        "raw": "set_duck_bathrobe.jpg",
    },
]


def find_eyes_and_feet(rgba: np.ndarray, is_base: bool = False) -> Dict[str, float]:
    """Detect left/right black eye pupil centers and bottom feet Y from an RGBA image."""
    h, w, _ = rgba.shape
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    a = rgba[:, :, 3].astype(np.float32)

    # Bounding box of opaque subject
    ys, xs = np.where(a > 128)
    y_top, y_bot = int(ys.min()), int(ys.max())
    x_left, x_right = int(xs.min()), int(xs.max())
    subj_h = y_bot - y_top

    # Search for dark pupils in the face band (~35% to ~56% of subject height from top)
    fy0 = y_top + int(subj_h * 0.36)
    fy1 = y_top + int(subj_h * 0.56)
    cx_est = 0.5 * (x_left + x_right)
    if is_base:
        cx_est = 301.0

    # Restrict horizontally around head center
    half_head = int(subj_h * 0.22)
    fx0 = max(0, int(cx_est - half_head))
    fx1 = min(w, int(cx_est + half_head))

    lum = 0.299 * r + 0.587 * g + 0.114 * b
    dark = (lum < 48.0) & (a > 200)

    # Split left and right of center
    mid_x = int(cx_est)
    left_mask = np.zeros((h, w), dtype=bool)
    left_mask[fy0:fy1, fx0:mid_x - 8] = dark[fy0:fy1, fx0:mid_x - 8]
    right_mask = np.zeros((h, w), dtype=bool)
    right_mask[fy0:fy1, mid_x + 8:fx1] = dark[fy0:fy1, mid_x + 8:fx1]

    ly, lx = np.where(left_mask)
    ry, rx = np.where(right_mask)
    if len(lx) < 20 or len(rx) < 20:
        raise RuntimeError(f"Could not detect eyes cleanly (left={len(lx)}, right={len(rx)})")

    # Use median to be robust against eyelashes or tiny stray dark pixels
    eye_lx, eye_ly = float(np.median(lx)), float(np.median(ly))
    eye_rx, eye_ry = float(np.median(rx)), float(np.median(ry))
    eye_cx = 0.5 * (eye_lx + eye_rx)
    eye_cy = 0.5 * (eye_ly + eye_ry)
    eye_dist = math.hypot(eye_rx - eye_lx, eye_ry - eye_ly)

    # Feet Y: bottom-most opaque pixel within central 36% of subject height around eye_cx
    foot_half = int(eye_dist * 1.15)
    fxs0 = max(0, int(eye_cx - foot_half))
    fxs1 = min(w, int(eye_cx + foot_half))
    f_ys, _ = np.where(a[:, fxs0:fxs1] > 180)
    feet_y = float(f_ys.max())

    return {
        "eye_lx": eye_lx,
        "eye_ly": eye_ly,
        "eye_rx": eye_rx,
        "eye_ry": eye_ry,
        "eye_cx": eye_cx,
        "eye_cy": eye_cy,
        "eye_dist": eye_dist,
        "feet_y": feet_y,
        "y_top": float(y_top),
        "y_bot": float(y_bot),
    }


def detect_glass_dome(rgb: np.ndarray, bg_col: np.ndarray, eye_cx: float, eye_cy: float, eye_dist: float) -> Tuple[float, float, float]:
    """Detect the circular translucent glass bubble helmet center & radius around Yutu's head."""
    h, w, _ = rgb.shape
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    excess = b - np.maximum(r, g)
    bg_excess = float(bg_col[2] - max(bg_col[0], bg_col[1]))

    # Pixels that deviate slightly from pure flat chroma blue (glass rim + reflection)
    # In the horizontal band around eye_cy, find the leftmost and rightmost non-pure-bg pixels
    band_y0 = max(0, int(eye_cy - eye_dist * 0.45))
    band_y1 = min(h, int(eye_cy + eye_dist * 0.15))
    dev = (bg_excess - excess) > 10.0

    xs_left = []
    xs_right = []
    for y in range(band_y0, band_y1):
        row = np.where(dev[y])[0]
        if len(row) > 20:
            xs_left.append(row[0])
            xs_right.append(row[-1])

    dome_x0 = float(np.percentile(xs_left, 5))
    dome_x1 = float(np.percentile(xs_right, 95))
    dome_cx = 0.5 * (dome_x0 + dome_x1)
    dome_r = 0.5 * (dome_x1 - dome_x0)

    # Estimate dome_cy by scanning the top rim of the glass arc between the two ears
    mid_x0 = int(dome_cx - eye_dist * 0.25)
    mid_x1 = int(dome_cx + eye_dist * 0.25)
    top_ys = []
    for x in range(mid_x0, mid_x1):
        col = np.where(dev[:int(eye_cy), x])[0]
        if len(col) > 0:
            top_ys.append(col[0])
    if top_ys:
        dome_top = float(np.percentile(top_ys, 15))
        dome_cy = dome_top + dome_r
    else:
        dome_cy = eye_cy - eye_dist * 0.25

    return dome_cx, dome_cy, dome_r


def chroma_to_rgba(
    im: Image.Image,
    key: str = "auto",
    translucent_dome: bool = False,
) -> Image.Image:
    """
    Zero-halo chroma-key extraction with:
    1. Chroma excess alpha keying
    2. Warm despill (with slate-blue facial feature protection for Yutu on blue screens)
    3. 3-pass inward foreground RGB bleed into semi-transparent edge pixels
    4. Optional optical translucent glass recovery for bubble helmets on blue screens
    """
    rgb = np.array(im.convert("RGB"), dtype=np.float32)
    h, w, _ = rgb.shape
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]

    corners = np.concatenate(
        [
            rgb[:16, :16].reshape(-1, 3),
            rgb[:16, -16:].reshape(-1, 3),
            rgb[-16:, :16].reshape(-1, 3),
            rgb[-16:, -16:].reshape(-1, 3),
        ],
        axis=0,
    )
    bg_col = np.median(corners, axis=0)
    if key == "auto":
        key = (
            "blue"
            if (bg_col[2] - max(bg_col[0], bg_col[1])) >= (bg_col[1] - max(bg_col[0], bg_col[2]))
            else "green"
        )

    if key == "blue":
        excess = b - np.maximum(r, g)
        bg_excess = float(bg_col[2] - max(bg_col[0], bg_col[1]))
        lo, hi = 24.0, max(105.0, bg_excess * 0.58)
    else:
        excess = g - np.maximum(r, b)
        bg_excess = float(bg_col[1] - max(bg_col[0], bg_col[2]))
        lo, hi = 24.0, max(125.0, bg_excess * 0.56)

    alpha = np.clip((hi - excess) / max(hi - lo, 1.0), 0.0, 1.0)
    alpha[excess > hi + 15.0] = 0.0
    out_rgb = rgb.copy()

    # Preliminary eye detection to locate Yutu's slate-blue nose & cheek whiskers
    prelim_rgba = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
    lm = find_eyes_and_feet(prelim_rgba, is_base=False)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)

    # Protect Yutu's slate-blue nose & 3 cheek whiskers from blue despill!
    face_protect = np.zeros((h, w), dtype=bool)
    if key == "blue":
        # Elliptical region covering nose, mouth, and both sets of cheek whiskers
        fx = (xx - lm["eye_cx"]) / (lm["eye_dist"] * 1.15)
        fy = (yy - (lm["eye_cy"] + lm["eye_dist"] * 0.30)) / (lm["eye_dist"] * 0.55)
        face_protect = (fx * fx + fy * fy <= 1.0) & (alpha > 0.92) & (excess < 55.0)

    # 1. Warm despill (eliminates green/blue bounce tint on white/cream fur)
    if key == "blue":
        spill = (b > np.maximum(r, g)) & (~face_protect)
        out_rgb[spill, 2] = np.maximum(out_rgb[spill, 0], out_rgb[spill, 1])
    else:
        spill = g > (r * 0.94 + b * 0.06)
        out_rgb[spill, 1] = np.minimum(
            out_rgb[spill, 1], out_rgb[spill, 0] * 0.94 + out_rgb[spill, 2] * 0.06
        )

    # 2. Inward foreground RGB bleed (3 passes) into semi-transparent edge pixels
    known = alpha >= 0.96
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

    fringe = (alpha > 0.01) & (alpha < 0.96) & known
    out_rgb[fringe] = bleed[fringe]

    # 3. Optical Translucent Glass Recovery (bubble helmet on blue screen)
    if translucent_dome and key == "blue":
        dome_cx, dome_cy, dome_r = detect_glass_dome(
            rgb, bg_col, lm["eye_cx"], lm["eye_cy"], lm["eye_dist"]
        )
        dist_dome = np.sqrt((xx - dome_cx) ** 2 + (yy - dome_cy) ** 2)

        # Smooth outer circular edge of the glass dome (soft 3px anti-aliased boundary)
        outer_fade = np.clip((dome_r + 1.5 - dist_dome) / 3.5, 0.0, 1.0)

        # Rim Fresnel boost near the outer 12% of the sphere
        rim_t = np.clip((dist_dome / max(dome_r, 1.0) - 0.80) / 0.20, 0.0, 1.0)
        rim_boost = (rim_t ** 2.2) * 0.28

        # Glass ring mask: inside the dome, smoothly feathered into the spacesuit collar, outside opaque inner fur/head
        collar_y = lm["eye_cy"] + lm["eye_dist"] * 0.98
        collar_fade = np.clip((collar_y - yy) / 18.0, 0.0, 1.0)
        glass_zone = (dist_dome <= dome_r + 1.5) & (collar_fade > 0.0) & (alpha < 0.94)

        # Physical opacity recovered from blue screen attenuation
        atten = np.clip(1.0 - excess / max(bg_excess, 1.0), 0.0, 1.0)
        alpha_glass = np.clip(atten * 1.15 + 0.07 + rim_boost, 0.0, 0.94) * outer_fade * collar_fade

        # Recover neutral-white reflection color by un-blending bg_col
        denom = np.maximum(alpha_glass, 0.12)[:, :, None]
        rgb_glass = np.clip(
            (rgb - (1.0 - alpha_glass[:, :, None]) * bg_col[None, None, :]) / denom,
            0.0,
            255.0,
        )
        # Neutralize any residual blue tint in glass reflection
        rgb_glass[:, :, 2] = np.minimum(
            rgb_glass[:, :, 2], np.maximum(rgb_glass[:, :, 0], rgb_glass[:, :, 1]) + 10.0
        )
        # Lift very dim glass body pixels toward soft luminous cool-white so it reads like real clear glass
        lum_g = 0.299 * rgb_glass[:, :, 0] + 0.587 * rgb_glass[:, :, 1] + 0.114 * rgb_glass[:, :, 2]
        low_spec = glass_zone & (lum_g < 195.0)
        rgb_glass[low_spec] = rgb_glass[low_spec] * 0.55 + np.array([235.0, 240.0, 246.0]) * 0.45

        # Blend glass over semi-transparent fur boundary smoothly (preserve opaque inner subject)
        blend_w = np.clip((0.94 - alpha) / 0.35, 0.0, 1.0) * glass_zone.astype(np.float32)
        new_alpha = np.maximum(alpha, alpha_glass * outer_fade)
        out_rgb = out_rgb * (1.0 - blend_w[:, :, None]) + rgb_glass * blend_w[:, :, None]
        alpha = np.where(glass_zone, new_alpha, alpha)
        print(
            f"  [glass] dome center=({dome_cx:.1f}, {dome_cy:.1f}) r={dome_r:.1f}, "
            f"glass_px={int(glass_zone.sum())}"
        )

    out_rgb[alpha <= 0.005] = 0.0
    out = np.dstack([np.clip(out_rgb, 0, 255), np.clip(alpha * 255.0, 0, 255)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def align_to_base(
    src_im: Image.Image,
    base_lm: Dict[str, float],
) -> Tuple[Image.Image, Dict[str, float]]:
    """
    Uniformly scale and translate `src_im` into the unified expanded canvas (EXP_W x EXP_H)
    so that eye center and feet Y align with `tex_base.png` placed at (PAD_X, PAD_Y).
    """
    src_rgba = np.array(src_im)
    lm = find_eyes_and_feet(src_rgba, is_base=False)

    target_eye_cx = base_lm["eye_cx"] + PAD_X
    target_eye_cy = base_lm["eye_cy"] + PAD_Y
    target_feet_y = base_lm["feet_y"] + PAD_Y

    # Match eye-to-feet vertical span so both eyes AND feet land within <= 1px
    base_span = base_lm["feet_y"] - base_lm["eye_cy"]
    src_span = lm["feet_y"] - lm["eye_cy"]
    scale = base_span / max(src_span, 1.0)

    new_w = max(1, int(round(src_im.width * scale)))
    new_h = max(1, int(round(src_im.height * scale)))
    resized = src_im.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Exact sub-pixel placement rounded to nearest pixel
    paste_x = int(round(target_eye_cx - lm["eye_cx"] * scale))
    paste_y = int(round(target_eye_cy - lm["eye_cy"] * scale))

    canvas = Image.new("RGBA", (EXP_W, EXP_H), (0, 0, 0, 0))
    canvas.paste(resized, (paste_x, paste_y), resized)

    # Measure actual post-alignment error
    aligned_lm = find_eyes_and_feet(np.array(canvas), is_base=False)
    err = {
        "scale": round(scale, 4),
        "eye_dx": round(aligned_lm["eye_cx"] - target_eye_cx, 2),
        "eye_dy": round(aligned_lm["eye_cy"] - target_eye_cy, 2),
        "feet_dy": round(aligned_lm["feet_y"] - target_feet_y, 2),
    }
    return canvas, err


def make_eye_expression_mask(
    base_exp: Image.Image,
    expr_exp: Image.Image,
    base_lm: Dict[str, float],
) -> np.ndarray:
    """
    Build a smooth feathered mask covering ONLY the eye sockets + under-eye marks
    where `tex_closed` / `tex_doze` differs from `tex_base`.
    """
    b = np.array(base_exp, dtype=np.float32)
    e = np.array(expr_exp, dtype=np.float32)
    diff = np.abs(b[:, :, :3] - e[:, :, :3]).max(axis=2)

    h, w = diff.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    lx = base_lm["eye_lx"] + PAD_X
    ly = base_lm["eye_ly"] + PAD_Y
    rx = base_lm["eye_rx"] + PAD_X
    ry = base_lm["eye_ry"] + PAD_Y
    r_eye = base_lm["eye_dist"] * 0.34

    d_l = ((xx - lx) / (r_eye * 1.15)) ** 2 + ((yy - (ly + 4.0)) / (r_eye * 1.10)) ** 2
    d_r = ((xx - rx) / (r_eye * 1.15)) ** 2 + ((yy - (ry + 4.0)) / (r_eye * 1.10)) ** 2
    roi = (d_l <= 1.0) | (d_r <= 1.0)

    raw_mask = np.clip((diff - 8.0) / 28.0, 0.0, 1.0) * roi.astype(np.float32)
    # Dilate slightly & blur for soft wool-fur blending
    m_im = Image.fromarray((raw_mask * 255.0).astype(np.uint8), "L")
    m_im = m_im.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(radius=3.5))
    return np.array(m_im, dtype=np.float32) / 255.0


def apply_expression(set_im: Image.Image, expr_exp: Image.Image, mask: np.ndarray) -> Image.Image:
    """Blend closed/doze eyes from `expr_exp` onto `set_im` using the smooth eye mask."""
    s = np.array(set_im, dtype=np.float32)
    e = np.array(expr_exp, dtype=np.float32)
    # Color-match eyelid brightness slightly to the set's forehead fur tone
    m = mask[:, :, None]
    out_rgb = s[:, :, :3] * (1.0 - m) + e[:, :, :3] * m
    out_a = s[:, :, 3]
    out = np.dstack([np.clip(out_rgb, 0, 255), np.clip(out_a, 0, 255)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def make_thumbnail(im: Image.Image, size: int = 256) -> Image.Image:
    """Crop tightly to subject alpha bbox and fit cleanly into a square RGBA thumbnail."""
    a = im.split()[3].point(lambda v: 255 if v > 16 else 0)
    bbox = a.getbbox()
    crop = im.crop(bbox) if bbox else im
    pad = int(round(size * 0.06))
    inner = size - pad * 2
    scale = min(inner / crop.width, inner / crop.height)
    nw, nh = max(1, int(round(crop.width * scale))), max(1, int(round(crop.height * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    thumb = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    thumb.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return thumb


def make_checkerboard(w: int, h: int, cell: int = 16) -> Image.Image:
    yy, xx = np.mgrid[0:h, 0:w]
    pat = ((xx // cell) + (yy // cell)) % 2
    img = np.where(pat[:, :, None] == 0, 224, 192).astype(np.uint8)
    return Image.fromarray(np.repeat(img, 3, axis=2), "RGB")


def make_ground_shadow_rgba(
    w: int,
    h: int,
    cx: float,
    feet_y: float,
    scale: float = 1.0,
    tint_rgb: Tuple[int, int, int] = (46, 30, 18),
    strength: float = 1.0,
) -> Image.Image:
    """
    Generate a standalone transparent dual-layer ground shadow:
    1) Ambient soft elliptical shadow spreading slightly behind/around the feet
    2) Crisp dual-foot contact occlusion shadow directly under left & right feet + subtle skirt bridge
    """
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)

    # 1) Ambient soft shadow
    soft_rx = 165.0 * scale
    soft_ry = 38.0 * scale
    d_soft = ((xx - (cx + 8.0 * scale)) / soft_rx) ** 2 + ((yy - (feet_y - 2.0 * scale)) / soft_ry) ** 2
    a_soft = np.exp(-1.85 * d_soft) * 0.38 * strength

    # 2) Dual-foot contact occlusion shadows (left foot + right foot + soft bridge)
    foot_off = 68.0 * scale
    foot_rx = 66.0 * scale
    foot_ry = 14.0 * scale
    d_fl = ((xx - (cx - foot_off)) / foot_rx) ** 2 + ((yy - (feet_y + 1.0 * scale)) / foot_ry) ** 2
    d_fr = ((xx - (cx + foot_off)) / foot_rx) ** 2 + ((yy - (feet_y + 1.0 * scale)) / foot_ry) ** 2
    d_mid = ((xx - cx) / (115.0 * scale)) ** 2 + ((yy - (feet_y + 1.0 * scale)) / (15.0 * scale)) ** 2
    a_con = (
        np.exp(-2.6 * d_fl) * 0.44
        + np.exp(-2.6 * d_fr) * 0.44
        + np.exp(-2.2 * d_mid) * 0.24
    ) * strength

    alpha = np.clip(1.0 - (1.0 - np.clip(a_soft, 0.0, 1.0)) * (1.0 - np.clip(a_con, 0.0, 1.0)), 0.0, 0.82)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, 0] = tint_rgb[0]
    rgba[:, :, 1] = tint_rgb[1]
    rgba[:, :, 2] = tint_rgb[2]
    rgba[:, :, 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def multiply_shadow_onto_bg(bg_rgba: Image.Image, shadow_rgba: Image.Image) -> Image.Image:
    """Composite a transparent shadow layer onto an RGBA background using true Multiply blending."""
    bg = np.array(bg_rgba, dtype=np.float32)
    sh = np.array(shadow_rgba, dtype=np.float32)
    a = sh[:, :, 3:4] / 255.0
    mult = (bg[:, :, :3] * sh[:, :, :3]) / 255.0
    out_rgb = bg[:, :, :3] * (1.0 - a) + mult * a
    out = np.dstack([np.clip(out_rgb, 0, 255), bg[:, :, 3]]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def composite_on_bg(
    fg: Image.Image,
    bg_path: Optional[Path],
    size: Tuple[int, int],
    shadow_tint: Optional[Tuple[int, int, int]] = None,
    shadow_strength: float = 1.0,
) -> Image.Image:
    w, h = size
    if bg_path and bg_path.exists():
        bg = Image.open(bg_path).convert("RGB")
        # Cover-fit
        scale = max(w / bg.width, h / bg.height)
        nw, nh = int(round(bg.width * scale)), int(round(bg.height * scale))
        bg = bg.resize((nw, nh), Image.Resampling.LANCZOS)
        x0, y0 = (nw - w) // 2, (nh - h) // 2
        bg = bg.crop((x0, y0, x0 + w, y0 + h)).convert("RGBA")
    else:
        bg = make_checkerboard(w, h, cell=14).convert("RGBA")

    # Fit fg nicely with margin
    fg_scale = min((w * 0.88) / fg.width, (h * 0.88) / fg.height)
    nw, nh = int(round(fg.width * fg_scale)), int(round(fg.height * fg_scale))
    fgr = fg.resize((nw, nh), Image.Resampling.LANCZOS)
    px = (w - nw) // 2
    py = int(h * 0.94 - nh)

    # Apply independent Multiply ground shadow layer on scene backgrounds
    if shadow_tint is not None:
        feet_canvas_y = py + (1102.0 + PAD_Y) * fg_scale
        cx_canvas = px + (302.0 + PAD_X) * fg_scale
        sh_im = make_ground_shadow_rgba(w, h, cx_canvas, feet_canvas_y, scale=fg_scale, tint_rgb=shadow_tint, strength=shadow_strength)
        bg = multiply_shadow_onto_bg(bg, sh_im)

    bg.alpha_composite(fgr, (px, py))
    return bg.convert("RGB")


def build_qa_sheet(aligned_sets: Dict[str, Image.Image], out_path: Path) -> None:
    """Create a 3-row x 4-col QA contact sheet (checkerboard, warm room + shadow, moon night + shadow)."""
    cell_w, cell_h = 320, 420
    ids = [s["id"] for s in SETS]
    rows = [
        ("Alpha Checker", None, None, 0.0),
        ("Warm Room + Shadow", ASSETS / "shared" / "room_bg.jpg", (76, 46, 22), 1.0),
        ("Moon Night + Shadow", ASSETS / "shared" / "bgs" / "bg_moon_courtyard.jpg", (16, 20, 46), 1.15),
    ]
    sheet = Image.new("RGB", (cell_w * len(ids), cell_h * len(rows)), (28, 24, 20))
    draw = ImageDraw.Draw(sheet)

    for r_idx, (r_label, bg_p, sh_tint, sh_str) in enumerate(rows):
        for c_idx, sid in enumerate(ids):
            tile = composite_on_bg(aligned_sets[sid], bg_p, (cell_w, cell_h), shadow_tint=sh_tint, shadow_strength=sh_str)
            sheet.paste(tile, (c_idx * cell_w, r_idx * cell_h))
            draw.rectangle(
                [c_idx * cell_w + 6, r_idx * cell_h + 6, c_idx * cell_w + 210, r_idx * cell_h + 28],
                fill=(20, 18, 16),
            )
            draw.text((c_idx * cell_w + 12, r_idx * cell_h + 11), f"{sid} | {r_label}", fill=(250, 242, 230))

    sheet.save(out_path, quality=92)
    print(f"Wrote QA contact sheet -> {out_path}")


def main() -> None:
    base_im = Image.open(WORK / "tex_base.png").convert("RGBA")
    closed_im = Image.open(WORK / "tex_closed.png").convert("RGBA")
    doze_im = Image.open(WORK / "tex_doze.png").convert("RGBA")
    assert base_im.size == (BASE_W, BASE_H), f"Unexpected tex_base size: {base_im.size}"

    base_lm = find_eyes_and_feet(np.array(base_im), is_base=True)
    print("Base landmarks:", {k: round(v, 2) for k, v in base_lm.items()})

    # Build expanded base textures
    def expand(im: Image.Image) -> Image.Image:
        c = Image.new("RGBA", (EXP_W, EXP_H), (0, 0, 0, 0))
        c.paste(im, (PAD_X, PAD_Y), im)
        return c

    base_exp = expand(base_im)
    closed_exp = expand(closed_im)
    doze_exp = expand(doze_im)
    base_exp.save(OUT_DIR / "tex_base_exp.png")
    closed_exp.save(OUT_DIR / "tex_closed_exp.png")
    doze_exp.save(OUT_DIR / "tex_doze_exp.png")

    mask_closed = make_eye_expression_mask(base_exp, closed_exp, base_lm)
    mask_doze = make_eye_expression_mask(base_exp, doze_exp, base_lm)

    meta_out: List[Dict] = []
    aligned_sets: Dict[str, Image.Image] = {}

    for cfg in SETS:
        sid = cfg["id"]
        raw_path = RAW_DIR / cfg["raw"]
        print(f"\nProcessing {sid} ({cfg['key']} key, dome={cfg['translucent_dome']})...")
        raw_im = Image.open(raw_path)
        keyed = chroma_to_rgba(raw_im, key=cfg["key"], translucent_dome=cfg["translucent_dome"])

        # Assert all 4 outer corners have alpha == 0
        ka = np.array(keyed)[:, :, 3]
        corners_a = [int(ka[0, 0]), int(ka[0, -1]), int(ka[-1, 0]), int(ka[-1, -1])]
        assert all(v == 0 for v in corners_a), f"{sid} non-zero corner alpha: {corners_a}"

        aligned, err = align_to_base(keyed, base_lm)
        aligned_sets[sid] = aligned
        print(f"  Aligned error: {err}")

        # Save transparent base + closed + doze + thumbnail
        aligned.save(OUT_DIR / f"set_{sid}.png")
        apply_expression(aligned, closed_exp, mask_closed).save(OUT_DIR / f"set_{sid}_closed.png")
        apply_expression(aligned, doze_exp, mask_doze).save(OUT_DIR / f"set_{sid}_doze.png")
        make_thumbnail(aligned, 256).save(OUT_DIR / f"thumb_set_{sid}.png")

        meta_out.append(
            {
                "id": sid,
                "name": cfg["name"],
                "key": cfg["key"],
                "translucent_dome": cfg["translucent_dome"],
                "align_error": err,
                "canvas": [EXP_W, EXP_H],
                "pad": [PAD_X, PAD_Y],
            }
        )

    (OUT_DIR / "sets_meta.json").write_text(json.dumps(meta_out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT_DIR / 'sets_meta.json'}")

    # Export standalone reusable ground shadow layer aligned to the exact same 840x1179 canvas
    shadow_layer = make_ground_shadow_rgba(
        EXP_W,
        EXP_H,
        cx=base_lm["eye_cx"] + PAD_X,
        feet_y=base_lm["feet_y"] + PAD_Y,
        scale=1.0,
        tint_rgb=(42, 28, 18),
        strength=1.0,
    )
    shadow_layer.save(OUT_DIR / "shadow_ground.png")
    print(f"Wrote standalone shadow layer -> {OUT_DIR / 'shadow_ground.png'}")

    # Save QA contact sheet to artifact dir for visual inspection
    art_dir = Path(
        "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/bebdf5ef-5683-4c19-8182-9d748f7c71ef"
    )
    if art_dir.exists():
        build_qa_sheet(aligned_sets, art_dir / "yutu_sets_qa_contact.png")


if __name__ == "__main__":
    main()
