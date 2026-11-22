#!/usr/bin/env python3
"""Chroma-key + spill-suppression pipeline for 4 full-body BOON KOI outfits.
Produces razor-clean transparent RGBA PNGs (zero white edge, zero floor shadow,
and true optical translucent glass alpha for the astronaut bubble helmet),
aligned to a unified 640x780 canvas with shared eye-expression overlays.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WORK = Path(__file__).resolve().parent
SETS_DIR = WORK / "sets"
CHROMA_DIR = SETS_DIR / "chroma"

CANVAS_W, CANVAS_H = 640, 780
BASE_DX, BASE_DY = 26, 92

SET_SPECS = [
    # Batch 1: Daily & Cute (4)
    {
        "id": "set_duck",
        "name": "小黄鸭雨衣",
        "desc": "鹅黄连帽小鸭雨衣配雨靴",
        "price": 20,
        "key": "blue",
        "translucent_helmet": False,
    },
    {
        "id": "set_yukata",
        "name": "夏日祭浴衣",
        "desc": "靛蓝海浪浴衣配狐狸面具",
        "price": 20,
        "key": "green",
        "has_blue": True,
        "translucent_helmet": False,
    },
    {
        "id": "set_sailor",
        "name": "小海军水手",
        "desc": "针织水手服配红领结白帽",
        "price": 20,
        "key": "green",
        "has_blue": True,
        "translucent_helmet": False,
    },
    {
        "id": "set_strawberry_pj",
        "name": "草莓睡衣",
        "desc": "浅粉波点毛绒睡衣配草莓帽",
        "price": 20,
        "key": "blue",
        "translucent_helmet": False,
    },
    # Batch 2: Fairytale & Festival (4)
    {
        "id": "set_mushroom",
        "name": "森林小蘑菇",
        "desc": "针织波点蘑菇帽配背带裤",
        "price": 20,
        "key": "blue",
        "translucent_helmet": False,
    },
    {
        "id": "set_baker",
        "name": "小厨师烘焙",
        "desc": "蓬蓬厨师帽配格纹可颂围裙",
        "price": 20,
        "key": "green",
        "translucent_helmet": False,
    },
    {
        "id": "set_astronaut",
        "name": "复古宇航员",
        "desc": "透明泡泡头盔配星星宇航服",
        "price": 20,
        "key": "blue",
        "translucent_helmet": True,
    },
    {
        "id": "set_lion",
        "name": "新年小醒狮",
        "desc": "红金毛绒醒狮帽配祥云马甲",
        "price": 20,
        "key": "green",
        "translucent_helmet": False,
    },
    # Batch 3: Goofy Dinosaurs (4)
    {
        "id": "set_trex",
        "name": "暴走霸王龙",
        "desc": "搞怪锯齿牙霸王龙小短手",
        "price": 20,
        "key": "blue",
        "translucent_helmet": False,
    },
    {
        "id": "set_triceratops",
        "name": "针织三角龙",
        "desc": "海蓝粗毛线颈盾配波点裤",
        "price": 20,
        "key": "green",
        "has_blue": True,
        "translucent_helmet": False,
    },
    {
        "id": "set_eggshell_dino",
        "name": "破壳小恐龙",
        "desc": "锯齿奶油蛋壳裤配恐龙帽",
        "price": 20,
        "key": "blue",
        "has_purple": True,
        "translucent_helmet": False,
    },
    {
        "id": "set_stego",
        "name": "粉黄小剑龙",
        "desc": "张嘴包脸剑龙配黄背板靴",
        "price": 20,
        "key": "blue",
        "translucent_helmet": False,
    },
]


def find_eyes(rgb: np.ndarray, alpha: np.ndarray | None = None) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    """Precisely detect BOON KOI's left & right button eyes as (x, y, outer_r)
    using 4-connected dark pupil blobs verified by their surrounding bright
    cream-white glossy button-eye ring (100% immune to dark collars, lion hood
    eyes, mushroom shadows, and curved mouth lines).
    """
    from collections import deque

    h, w, _ = rgb.shape
    luma = rgb.mean(axis=2)
    ry0, ry1 = int(h * 0.25), int(h * 0.62)
    rx0, rx1 = int(w * 0.20), int(w * 0.80)

    dark = luma[ry0:ry1, rx0:rx1] < 48.0
    if alpha is not None:
        dark = dark & (alpha[ry0:ry1, rx0:rx1] > 200)

    rh, rw = dark.shape
    visited = np.zeros((rh, rw), dtype=bool)
    min_area = max(80, int(w * h * 0.0004))
    max_area = int(w * h * 0.015)

    candidates = []
    ys_d, xs_d = np.where(dark)
    for sy, sx in zip(ys_d, xs_d):
        if visited[sy, sx]:
            continue
        q = deque([(int(sy), int(sx))])
        visited[sy, sx] = True
        pts_y, pts_x = [], []
        while q:
            cy, cx = q.popleft()
            pts_y.append(cy)
            pts_x.append(cx)
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < rh and 0 <= nx < rw and not visited[ny, nx] and dark[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))
        area = len(pts_x)
        if area < min_area or area > max_area:
            continue
        px = np.array(pts_x, dtype=np.float32) + rx0
        py = np.array(pts_y, dtype=np.float32) + ry0
        bw = float(px.max() - px.min() + 1)
        bh = float(py.max() - py.min() + 1)
        aspect = min(bw, bh) / max(bw, bh)
        if aspect < 0.72:
            continue
        cx_c, cy_c = float(px.mean()), float(py.mean())
        r_p = math.sqrt(area / math.pi)

        # Verify bright cream-white glossy button-eye ring around pupil (1.35*r_p .. 2.15*r_p)
        y0 = max(0, int(cy_c - r_p * 2.4))
        y1 = min(h, int(cy_c + r_p * 2.4) + 1)
        x0 = max(0, int(cx_c - r_p * 2.4))
        x1 = min(w, int(cx_c + r_p * 2.4) + 1)
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        dist = np.hypot(xx - cx_c, yy - cy_c)
        ring = (dist >= r_p * 1.35) & (dist <= r_p * 2.15)
        if not ring.any():
            continue
        ring_luma = luma[y0:y1, x0:x1][ring]
        med_luma = float(np.median(ring_luma))
        bright_frac = float((ring_luma > 130.0).mean())
        # Real button eyes have bright ivory sclera all around the pupil
        if med_luma < 130.0 or bright_frac < 0.55:
            continue

        # Outer white button-eye radius is consistently ~2.25x pupil radius
        outer_r = r_p * 2.25
        # Score favors bright uniform sclera ring + roundness + proximity to face center Y
        score = med_luma * bright_frac * aspect
        candidates.append((cx_c, cy_c, outer_r, score, area))

    mid_x = w * 0.5
    lefts = [c for c in candidates if c[0] < mid_x - w * 0.03]
    rights = [c for c in candidates if c[0] > mid_x + w * 0.03]
    if not lefts or not rights:
        raise RuntimeError(f"Failed to detect button-eye pair! candidates={candidates}")

    best_pair = None
    best_score = -1e9
    for l in lefts:
        for r in rights:
            dy = abs(l[1] - r[1])
            dx = r[0] - l[0]
            if dy > h * 0.06 or dx < w * 0.11 or dx > w * 0.42:
                continue
            # Prefer symmetric Y, similar pupil radius, centered X, and high sclera ring score
            sym_pen = dy * 4.0 + abs((l[0] + r[0]) * 0.5 - mid_x) * 1.5 + abs(l[2] - r[2]) * 3.0
            # Slightly prefer lower of two high-scoring pairs if hood has decoy eyes above (lion/duck)
            s = (l[3] + r[3]) - sym_pen
            if s > best_score:
                best_score = s
                best_pair = (l, r)

    if best_pair is None:
        raise RuntimeError(f"No valid symmetric eye pair found! lefts={lefts}, rights={rights}")
    l, r = best_pair
    return (l[0], l[1], l[2]), (r[0], r[1], r[2])


def chroma_key_matte(
    im: Image.Image,
    key: str,
    translucent_helmet: bool = False,
    has_blue: bool = False,
    has_purple: bool = False,
) -> Image.Image:
    """Extract spotless RGBA matte from a flat shadowless blue/green chroma screen
    with chroma spill suppression and optical translucent glass matting for astronaut.
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

    if key == "blue":
        excess = b - np.maximum(r, g)
        bg_excess = float(bg_col[2] - max(bg_col[0], bg_col[1]))
        lo = 52.0 if has_purple else 24.0
        hi = max(115.0, bg_excess * 0.58)
    else:
        excess = g - np.maximum(r, b)
        bg_excess = float(bg_col[1] - max(bg_col[0], bg_col[2]))
        lo, hi = 24.0, max(125.0, bg_excess * 0.56)

    alpha = np.clip((hi - excess) / max(hi - lo, 1.0), 0.0, 1.0)
    alpha[excess > hi + 15.0] = 0.0

    out_rgb = rgb.copy()

    # Optical translucent glass dome matting for astronaut (blue screen)
    in_glass = np.zeros((h, w), dtype=bool)
    if translucent_helmet and key == "blue":
        eye_l, eye_r = find_eyes(rgb)
        ecx = (eye_l[0] + eye_r[0]) * 0.5
        ecy = (eye_l[1] + eye_r[1]) * 0.5
        edist = eye_r[0] - eye_l[0]
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)

        dome_cx = ecx
        dome_cy = ecy - edist * 0.25
        dome_r = edist * 1.50
        dist_dome = np.hypot(xx - dome_cx, yy - dome_cy)
        dist_head = np.hypot((xx - ecx) / (edist * 1.08), (yy - (ecy - edist * 0.05)) / (edist * 1.12))
        dist_fin = np.hypot((xx - ecx) / (edist * 0.21), (yy - (ecy - edist * 1.24)) / (edist * 0.36))
        in_suit = yy > ecy + edist * 0.72
        in_side_fins = (np.abs(xx - ecx) > edist * 1.02) & (yy > ecy - edist * 0.35) & (yy < ecy + edist * 0.55)

        in_glass = (dist_dome <= dome_r) & (dist_head > 1.0) & (dist_fin > 1.0) & (~in_suit) & (~in_side_fins)

        outer_fade = np.clip((dome_r - dist_dome) / 6.0, 0.0, 1.0)
        optical_a = np.clip(1.0 - excess / max(bg_excess, 1.0), 0.0, 1.0)
        rim_boost = np.clip((dist_dome / dome_r - 0.84) / 0.16, 0.0, 1.0) * 0.24
        glass_a = np.clip(optical_a * 1.08 + 0.08 + rim_boost, 0.0, 0.94) * outer_fade

        inner_t = np.clip((dist_head - 1.0) / 0.07, 0.0, 1.0) * np.clip((dist_fin - 1.0) / 0.12, 0.0, 1.0)
        alpha = np.where(in_glass, alpha * (1.0 - inner_t) + glass_a * inner_t, alpha)

        safe_a = np.maximum(alpha[in_glass, None], 0.12)
        rec = (rgb[in_glass] - (1.0 - alpha[in_glass, None]) * bg_col[None, :]) / safe_a
        rec = np.clip(rec, 0.0, 255.0)
        rec[:, 2] = np.minimum(rec[:, 2], np.maximum(rec[:, 0], rec[:, 1]) + 10.0)
        out_rgb[in_glass] = rec

    # Chroma spill suppression on all non-glass pixels
    non_glass = ~in_glass
    if key == "blue":
        if has_purple:
            # Preserve purple spikes (where R > G + 15) while despilling neutral/fringe blue
            spill = non_glass & (b > np.maximum(r, g)) & (~((r > g + 15.0) & (alpha > 0.95)))
        else:
            spill = non_glass & (b > np.maximum(r, g))
        out_rgb[spill, 2] = np.maximum(out_rgb[spill, 0], out_rgb[spill, 1])
    else:
        if has_blue:
            # Preserve blue/teal fabric while killing pure green spill
            spill = non_glass & (g > np.maximum(r, b))
            out_rgb[spill, 1] = np.maximum(out_rgb[spill, 0], out_rgb[spill, 2])
        else:
            # Warm cream balance kills faint green bounce on white/cream fur
            spill = non_glass & (g > (r * 0.94 + b * 0.06))
            out_rgb[spill, 1] = np.minimum(out_rgb[spill, 1], out_rgb[spill, 0] * 0.94 + out_rgb[spill, 2] * 0.06)

    # Inward RGB bleed on semi-transparent anti-aliased fringes (2 passes)
    solid = (alpha >= 0.96) & non_glass
    known = solid.copy()
    bleed = out_rgb.copy()
    for _ in range(3):
        need = (~known) & (alpha > 0.01) & non_glass
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

    fringe = (alpha > 0.01) & (alpha < 0.96) & non_glass & known
    out_rgb[fringe] = bleed[fringe]
    out_rgb[alpha <= 0.005] = 0.0

    rgba = np.dstack([np.clip(out_rgb, 0, 255), np.clip(alpha * 255.0, 0, 255)]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def place_aligned(
    cutout: Image.Image,
    eye_l: tuple[float, float],
    eye_r: tuple[float, float],
    ref_eye_mid: tuple[float, float],
    ref_feet_y: float,
) -> tuple[Image.Image, dict]:
    """Scale and translate cutout into CANVAS_W x CANVAS_H so BOTH eyes and feet
    align precisely with tex_base (ensuring shared eye overlays land dead-center).
    """
    arr = np.array(cutout)
    ys, _ = np.where(arr[:, :, 3] > 60)
    src_feet_y = float(ys.max())
    src_eye_mid_x = (eye_l[0] + eye_r[0]) * 0.5
    src_eye_mid_y = (eye_l[1] + eye_r[1]) * 0.5

    scale = (ref_feet_y - ref_eye_mid[1]) / max(src_feet_y - src_eye_mid_y, 1.0)
    nw = max(1, int(round(cutout.width * scale)))
    nh = max(1, int(round(cutout.height * scale)))
    resized = cutout.resize((nw, nh), Image.Resampling.LANCZOS)

    dx = int(round(ref_eye_mid[0] - src_eye_mid_x * scale))
    dy = int(round(ref_feet_y - src_feet_y * scale))

    r_arr = np.array(resized)
    ry, _ = np.where(r_arr[:, :, 3] > 20)
    top_y = dy + int(ry.min())
    if top_y < 4:
        shrink = (ref_feet_y - 6.0) / max(ref_feet_y - top_y, 1.0)
        scale *= shrink
        nw = max(1, int(round(cutout.width * scale)))
        nh = max(1, int(round(cutout.height * scale)))
        resized = cutout.resize((nw, nh), Image.Resampling.LANCZOS)
        dx = int(round(ref_eye_mid[0] - src_eye_mid_x * scale))
        dy = int(round(ref_feet_y - src_feet_y * scale))

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    canvas.paste(resized, (dx, dy), resized)

    placed_eye_x = dx + src_eye_mid_x * scale
    placed_eye_y = dy + src_eye_mid_y * scale
    placed_feet_y = dy + src_feet_y * scale
    return canvas, {
        "scale": round(scale, 4),
        "dx": dx,
        "dy": dy,
        "eye_err_x": round(placed_eye_x - ref_eye_mid[0], 2),
        "eye_err_y": round(placed_eye_y - ref_eye_mid[1], 2),
        "feet_err_y": round(placed_feet_y - ref_feet_y, 2),
    }


def make_plush_fur_texture(base_ext: Image.Image, eye_l: tuple[float, float, float], eye_r: tuple[float, float, float]) -> Image.Image:
    """Create a seamless full-canvas real-plush terry-cloth fur texture sampled
    directly from BOON KOI's own forehead fur (solid alpha=255 everywhere).
    The WebGL shader dynamically masks and shades both sliding eyelids (w2) and
    happy petting crescent eyes (w1) at each outfit's exact uEyeL / uEyeR!
    """
    arr = np.array(base_ext, dtype=np.float32)
    mx = int(round((eye_l[0] + eye_r[0]) * 0.5))
    my = int(round((eye_l[1] + eye_r[1]) * 0.5))

    # Harvest a clean 96x64 real cream terry-cloth plush patch from BOON KOI's forehead
    fy0 = max(0, my - 124)
    fy1 = fy0 + 64
    fx0 = max(0, mx - 48)
    fx1 = fx0 + 96
    fur_tile = arr[fy0:fy1, fx0:fx1, :3].copy()
    # Mirror-tile into a seamless 2x2 texture block (192x128)
    row_tile = np.concatenate([fur_tile, fur_tile[:, ::-1, :]], axis=1)
    big_tile = np.concatenate([row_tile, row_tile[::-1, :, :]], axis=0)
    th, tw, _ = big_tile.shape

    reps_y = (CANVAS_H // th) + 2
    reps_x = (CANVAS_W // tw) + 2
    plush_full = np.tile(big_tile, (reps_y, reps_x, 1))[:CANVAS_H, :CANVAS_W, :].copy()

    warm = np.array([0.975, 0.96, 0.935], dtype=np.float32)[None, None, :]
    plush_rgb = np.clip(plush_full * warm, 0.0, 255.0)
    alpha_full = np.full((CANVAS_H, CANVAS_W), 255.0, dtype=np.float32)
    return Image.fromarray(np.dstack([plush_rgb, alpha_full]).astype(np.uint8), "RGBA")


def eye_dict(eye: tuple[float, float, float]) -> dict[str, float]:
    """Convert (x, y, outer_r) to shader-ready {x, y, rx, ry} dict."""
    rx = round(min(max(eye[2] * 1.12, 44.0), 66.0), 2)
    ry = round(rx * 0.97, 2)
    return {"x": round(eye[0], 2), "y": round(eye[1], 2), "rx": rx, "ry": ry}


def assert_eye_alignment(label: str, eye_l: dict[str, float], eye_r: dict[str, float], ref_eye_mid: tuple[float, float]) -> None:
    dy = abs(eye_l["y"] - eye_r["y"])
    mid_x = (eye_l["x"] + eye_r["x"]) * 0.5
    mid_y = (eye_l["y"] + eye_r["y"]) * 0.5
    err_x = abs(mid_x - ref_eye_mid[0])
    err_y = abs(mid_y - ref_eye_mid[1])
    if dy > 6.0 or err_x > 12.0 or err_y > 12.0:
        raise AssertionError(
            f"[{label}] eye alignment out of bounds: L={eye_l}, R={eye_r}, "
            f"dy={dy:.2f}, err_x={err_x:.2f}, err_y={err_y:.2f}"
        )


def make_thumb(im: Image.Image, size: int = 256) -> Image.Image:
    bbox = im.split()[3].point(lambda v: 255 if v > 15 else 0).getbbox()
    cropped = im.crop(bbox) if bbox else im
    pad = int(size * 0.06)
    inner = size - pad * 2
    t = cropped.copy()
    t.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(t, ((size - t.width) // 2, (size - t.height) // 2), t)
    return canvas


def main() -> None:
    SETS_DIR.mkdir(parents=True, exist_ok=True)

    # Canonical reference frame from landmarks.json + legacy base eye height
    lm = json.loads((WORK / "landmarks.json").read_text())
    ref_feet_y = float(lm["feetY"] + BASE_DY)

    base_orig = Image.open(WORK / "tex_base.png").convert("RGBA")
    legacy_ext = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    legacy_ext.paste(base_orig, (BASE_DX, BASE_DY), base_orig)
    leg_arr = np.array(legacy_ext, dtype=np.float32)
    leg_eye_l, leg_eye_r = find_eyes(leg_arr[:, :, :3], leg_arr[:, :, 3])
    ref_eye_mid = ((leg_eye_l[0] + leg_eye_r[0]) * 0.5, (leg_eye_l[1] + leg_eye_r[1]) * 0.5)
    print(f"[ref] eye_mid=({ref_eye_mid[0]:.2f}, {ref_eye_mid[1]:.2f}) feet_y={ref_feet_y:.2f}")

    # Build HD tex_base_ext.png from chroma/base_front.jpg if present (never regress to low-res!)
    hd_base_src = CHROMA_DIR / "base_front.jpg"
    if hd_base_src.exists():
        im_base = Image.open(hd_base_src).convert("RGB")
        rgb_base = np.array(im_base, dtype=np.float32)
        b_el, b_er = find_eyes(rgb_base)
        base_cutout = chroma_key_matte(im_base, key="blue")
        base_ext, base_stats = place_aligned(base_cutout, b_el, b_er, ref_eye_mid, ref_feet_y)
        print(f"[base_hd] aligned from {hd_base_src.name}: {base_stats}")
    else:
        base_ext = legacy_ext

    base_ext.save(SETS_DIR / "tex_base_ext.png")

    b_arr = np.array(base_ext, dtype=np.float32)
    base_eye_l, base_eye_r = find_eyes(b_arr[:, :, :3], b_arr[:, :, 3])
    base_eye_l_d = eye_dict(base_eye_l)
    base_eye_r_d = eye_dict(base_eye_r)
    assert_eye_alignment("base", base_eye_l_d, base_eye_r_d, ref_eye_mid)
    print(f"[base] eyes: L={base_eye_l_d} R={base_eye_r_d}")

    # Full-canvas seamless real-plush fur texture for dynamic WebGL eyelid & happy-eye shader
    eyes_plush = make_plush_fur_texture(base_ext, base_eye_l, base_eye_r)
    eyes_plush.save(SETS_DIR / "eyes_doze.png")

    sets_meta = []
    for spec in SET_SPECS:
        src_path = CHROMA_DIR / f"{spec['id']}.jpg"
        im = Image.open(src_path).convert("RGB")
        rgb = np.array(im, dtype=np.float32)
        eye_l, eye_r = find_eyes(rgb)
        cutout = chroma_key_matte(
            im,
            key=spec["key"],
            translucent_helmet=spec["translucent_helmet"],
            has_blue=spec.get("has_blue", False),
            has_purple=spec.get("has_purple", False),
        )
        aligned, stats = place_aligned(cutout, eye_l, eye_r, ref_eye_mid, ref_feet_y)

        # Re-measure exact eye coordinates on the final 640x780 aligned texture
        a_arr = np.array(aligned, dtype=np.float32)
        fin_l, fin_r = find_eyes(a_arr[:, :, :3], a_arr[:, :, 3])
        fin_l_d = eye_dict(fin_l)
        fin_r_d = eye_dict(fin_r)
        assert_eye_alignment(spec["id"], fin_l_d, fin_r_d, ref_eye_mid)

        tex_path = SETS_DIR / f"tex_{spec['id']}.png"
        thumb_path = SETS_DIR / f"thumb_{spec['id']}.png"
        aligned.save(tex_path)
        make_thumb(aligned, 256).save(thumb_path)

        a = a_arr[:, :, 3]
        semi_count = int(((a > 15) & (a < 235)).sum())
        corners_max = int(max(a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]))
        print(
            f"[{spec['id']}] {spec['name']} ({spec['key']}-key): "
            f"L=({fin_l_d['x']},{fin_l_d['y']},r={fin_l_d['rx']}) "
            f"R=({fin_r_d['x']},{fin_r_d['y']},r={fin_r_d['rx']}) "
            f"corners={corners_max} semi_px={semi_count} align={stats}"
        )
        sets_meta.append(
            {
                "id": spec["id"],
                "slot": "set",
                "name": spec["name"],
                "desc": spec["desc"],
                "price": spec["price"],
                "tex": f"sets/tex_{spec['id']}.png",
                "thumb": f"sets/thumb_{spec['id']}.png",
                "translucent": spec["translucent_helmet"],
                "eyeL": fin_l_d,
                "eyeR": fin_r_d,
            }
        )

    ext_lm = {
        "canvasW": CANVAS_W,
        "canvasH": CANVAS_H,
        "baseDx": BASE_DX,
        "baseDy": BASE_DY,
        "cx": lm["cx"] + BASE_DX,
        "feetY": lm["feetY"] + BASE_DY,
        "neck": {"x": lm["neck"]["x"] + BASE_DX, "y": lm["neck"]["y"] + BASE_DY},
        "head": {
            "x": lm["head"]["x"] + BASE_DX,
            "y": lm["head"]["y"] + BASE_DY,
            "rx": lm["head"]["rx"],
            "ry": lm["head"]["ry"],
        },
        "earL": {"x": lm["earL"]["x"] + BASE_DX, "y": lm["earL"]["y"] + BASE_DY},
        "earR": {"x": lm["earR"]["x"] + BASE_DX, "y": lm["earR"]["y"] + BASE_DY},
        "eyeL": base_eye_l_d,
        "eyeR": base_eye_r_d,
        "bodyY": lm["bodyY"] + BASE_DY,
        "bbox": [
            lm["bbox"][0] + BASE_DX,
            lm["bbox"][1] + BASE_DY,
            lm["bbox"][2] + BASE_DX,
            lm["bbox"][3] + BASE_DY,
        ],
    }
    (SETS_DIR / "landmarks_ext.json").write_text(json.dumps(ext_lm, indent=2, ensure_ascii=False))
    (SETS_DIR / "sets_meta.json").write_text(json.dumps(sets_meta, indent=2, ensure_ascii=False))
    print("Chroma-key pipeline complete (all 13 textures verified)!")


if __name__ == "__main__":
    main()
