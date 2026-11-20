#!/usr/bin/env python3
"""Extract 4 full-body BOON KOI outfits from a 2x2 studio sheet into aligned
transparent RGBA textures (with translucent bubble helmet alpha for astronaut),
shared eye-expression overlays (closed/doze), and wardrobe thumbnails.
"""
from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WORK = Path(__file__).resolve().parent
EX = WORK / "dress" / "extract"
SETS_DIR = WORK / "sets"
SRC_SHEET = SETS_DIR / "source_batch2.jpg"

# Unified expanded canvas so tall hats (chef/mushroom/astronaut/lion) never clip
CANVAS_W, CANVAS_H = 640, 780
BASE_DX, BASE_DY = 26, 92  # offsets placing original 588x680 tex_base inside 640x780

SET_SPECS = [
    {
        "id": "set_mushroom",
        "name": "森林小蘑菇",
        "desc": "针织波点蘑菇帽配背带裤",
        "price": 20,
        "quad": (0, 0),
        "translucent_helmet": False,
    },
    {
        "id": "set_baker",
        "name": "小厨师烘焙",
        "desc": "蓬蓬厨师帽配格纹可颂围裙",
        "price": 20,
        "quad": (1, 0),
        "translucent_helmet": False,
    },
    {
        "id": "set_astronaut",
        "name": "复古宇航员",
        "desc": "透明泡泡头盔配星星宇航服",
        "price": 20,
        "quad": (0, 1),
        "translucent_helmet": True,
    },
    {
        "id": "set_lion",
        "name": "新年小醒狮",
        "desc": "红金毛绒醒狮帽配祥云马甲",
        "price": 20,
        "quad": (1, 1),
        "translucent_helmet": False,
    },
]


def split_quads(im: Image.Image) -> dict[tuple[int, int], Image.Image]:
    arr = np.array(im.convert("RGB"))
    h, w, _ = arr.shape
    row_b = arr.mean(axis=(1, 2))
    col_b = arr.mean(axis=(0, 2))
    mid_y = int(np.argmax(row_b[int(h * 0.45) : int(h * 0.55)]) + int(h * 0.45))
    mid_x = int(np.argmax(col_b[int(w * 0.45) : int(w * 0.55)]) + int(w * 0.45))
    pad = 16
    return {
        (0, 0): im.crop((pad, pad, mid_x - 10, mid_y - 10)),
        (1, 0): im.crop((mid_x + 10, pad, w - pad, mid_y - 10)),
        (0, 1): im.crop((pad, mid_y + 10, mid_x - 10, h - pad)),
        (1, 1): im.crop((mid_x + 10, mid_y + 10, w - pad, h - pad)),
    }


def estimate_bg(rgb: np.ndarray) -> np.ndarray:
    """Smooth row-wise studio background color model from left & right margins."""
    h, w, _ = rgb.shape
    m = max(14, w // 10)
    left_strip = np.median(rgb[:, :m, :], axis=1)
    right_strip = np.median(rgb[:, w - m :, :], axis=1)
    t = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :, None]
    bg = left_strip[:, None, :].astype(np.float32) * (1.0 - t) + right_strip[:, None, :].astype(np.float32) * t
    return bg


def find_eyes(rgb: np.ndarray) -> tuple[tuple[float, float], tuple[float, float]]:
    """Detect left and right pupil centers in a front-facing BOON KOI panel."""
    h, w, _ = rgb.shape
    ry0, ry1 = int(h * 0.34), int(h * 0.62)
    rx0, rx1 = int(w * 0.32), int(w * 0.68)
    roi = rgb[ry0:ry1, rx0:rx1].mean(axis=2)
    ys, xs = np.where(roi < 48)
    xs = xs.astype(np.float32) + rx0
    ys = ys.astype(np.float32) + ry0
    y_cut = np.percentile(ys, 65)
    cx = w * 0.5
    l = (xs < cx - 8) & (ys <= y_cut)
    r = (xs > cx + 8) & (ys <= y_cut)
    return (float(xs[l].mean()), float(ys[l].mean())), (float(xs[r].mean()), float(ys[r].mean()))


def local_texture(rgb: np.ndarray) -> np.ndarray:
    """Compute local 5x5 standard deviation (texture energy) to distinguish
    smooth studio backdrop from textured plush, knit, fur, and gingham fabric.
    """
    luma = rgb.mean(axis=2)
    im_l = Image.fromarray(np.clip(luma, 0, 255).astype(np.uint8))
    mean = np.array(im_l.filter(ImageFilter.BoxBlur(2)), dtype=np.float32)
    diff_sq = (luma - mean) ** 2
    im_ds = Image.fromarray(np.clip(diff_sq * 2.0, 0, 255).astype(np.uint8))
    var = np.array(im_ds.filter(ImageFilter.BoxBlur(2)), dtype=np.float32) / 2.0
    return np.sqrt(np.maximum(var, 0.0))


def matte_panel(im: Image.Image, translucent_helmet: bool = False, set_id: str = "") -> Image.Image:
    """Remove studio cream backdrop using smooth-background + texture-barrier
    flood-fill and color decontamination. Preserves translucent glass bubble
    helmet alpha for astronaut.
    """
    rgb = np.array(im.convert("RGB"), dtype=np.float32)
    h, w, _ = rgb.shape
    bg = estimate_bg(rgb)
    diff = np.linalg.norm(rgb - bg, axis=2)
    tex = local_texture(rgb)

    gx = np.zeros((h, w), dtype=np.float32)
    gy = np.zeros((h, w), dtype=np.float32)
    gx[:, 1:-1] = np.linalg.norm(rgb[:, 2:] - rgb[:, :-2], axis=2) * 0.5
    gy[1:-1, :] = np.linalg.norm(rgb[2:, :] - rgb[:-2, :], axis=2) * 0.5
    edge = np.hypot(gx, gy)

    bg_luma = bg.mean(axis=2)
    px_luma = rgb.mean(axis=2)
    bg_norm = bg / np.maximum(bg_luma[:, :, None], 1.0)
    px_norm = rgb / np.maximum(px_luma[:, :, None], 1.0)
    chroma_diff = np.linalg.norm(px_norm - bg_norm, axis=2) * 255.0

    eye_l, eye_r = find_eyes(rgb)
    ecx = (eye_l[0] + eye_r[0]) * 0.5
    ecy = (eye_l[1] + eye_r[1]) * 0.5
    edist = eye_r[0] - eye_l[0]
    yy_all, xx_all = np.mgrid[0:h, 0:w].astype(np.float32)

    # Background has tex p95 ~0.7 and diff p95 ~3.1; plush has tex ~4.5+ and diff ~19+
    is_smooth = (tex < 2.2) & (edge < 7.0)
    floor_zone = yy_all >= h * 0.80
    is_floor_shadow = (
        floor_zone
        & (tex < 3.2)
        & (edge < 8.5)
        & (chroma_diff < 10.5)
        & (px_luma < bg_luma + 5.0)
        & (px_luma > bg_luma - 55.0)
    )

    bg_thresh = 9.5 if translucent_helmet else 11.5
    bg_cand = ((diff < bg_thresh) & is_smooth) | is_floor_shadow

    # For baker's cream boots, protect the inner left/right boot cuff columns from color-match leak
    if set_id == "set_baker":
        left_cuff = (yy_all > h * 0.78) & (yy_all < h * 0.94) & (xx_all > ecx - edist * 0.82) & (xx_all < ecx - edist * 0.17)
        right_cuff = (yy_all > h * 0.78) & (yy_all < h * 0.94) & (xx_all > ecx + edist * 0.17) & (xx_all < ecx + edist * 0.82)
        bg_cand = bg_cand & (~(left_cuff | right_cuff))

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, 2, h - 1, h - 3):
            if bg_cand[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, 2, w - 1, w - 3):
            if bg_cand[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and bg_cand[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    # Clean all floor shadow patches in bottom boot zone (y > 80%)
    outside_boots_floor = (
        ((yy_all > h * 0.80) & (np.abs(xx_all - ecx) > edist * 1.12))
        | ((yy_all > h * 0.86) & (np.abs(xx_all - ecx) > edist * 0.94))
        | ((yy_all > h * 0.82) & (np.abs(xx_all - ecx) < edist * 0.15) & (chroma_diff < 16.0) & (px_luma > 140.0))
    )
    visited = visited | outside_boots_floor

    # For colored/metallic boots (mushroom brown, lion red, astronaut silver),
    # any pale warm-beige floor/shadow pixel in the bottom 18% is guaranteed background!
    if set_id in ("set_mushroom", "set_lion"):
        beige_floor = (yy_all > h * 0.82) & (chroma_diff < 15.0) & (px_luma > 152.0) & (rgb[:, :, 0] - rgb[:, :, 2] > 18.0)
        visited = visited | beige_floor

    # Punch out beige background gap BETWEEN the two legs/boots
    between_cand = (
        (yy_all > h * 0.78)
        & (np.abs(xx_all - ecx) < edist * 0.42)
        & (tex < 4.0)
        & (edge < 11.0)
        & (chroma_diff < 14.0)
        & (px_luma > 145.0)
    )
    qb: deque[tuple[int, int]] = deque()
    for y in range(int(h * 0.82), int(h * 0.97)):
        for x in range(int(ecx - 8), int(ecx + 9)):
            if 0 <= y < h and 0 <= x < w and between_cand[y, x] and not visited[y, x]:
                visited[y, x] = True
                qb.append((y, x))
    while qb:
        cy, cx = qb.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and between_cand[ny, nx]:
                visited[ny, nx] = True
                qb.append((ny, nx))

    fg_mask = ~visited

    # Unconditional 2px inward shrink to completely remove the 5x5 local_texture dilation rim
    fg_shrunk = np.array(
        Image.fromarray((fg_mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))
    ) > 128
    # Extra 1px trim on any remaining pale-beige outer border pixel (diff < 22)
    fg_shrunk_in = np.array(
        Image.fromarray((fg_shrunk * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    ) > 128
    rim_1px = fg_shrunk & (~fg_shrunk_in)
    fg_mask = fg_shrunk & (~(rim_1px & (diff < 22.0)))

    # Soft 0.75px anti-aliased edge ramp
    fg_img = Image.fromarray((fg_mask * 255).astype(np.uint8))
    fg_soft = fg_img.filter(ImageFilter.GaussianBlur(radius=0.75))
    alpha = np.array(fg_soft, dtype=np.float32) / 255.0
    bg_eroded = (
        np.array(Image.fromarray(((~fg_mask) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))) > 128
    )
    alpha[bg_eroded] = 0.0

    # Special translucent glass dome alpha for astronaut
    in_glass_ring = np.zeros((h, w), dtype=bool)
    if translucent_helmet:
        dome_cx = ecx
        dome_cy = ecy - edist * 0.22
        dome_r = edist * 1.54
        dist_dome = np.hypot(xx_all - dome_cx, yy_all - dome_cy)

        head_r = edist * 1.13
        dist_head = np.hypot((xx_all - ecx) / 1.03, (yy_all - (ecy - edist * 0.05)) / 1.07)
        dist_fin = np.hypot((xx_all - ecx) / (edist * 0.21), (yy_all - (ecy - edist * 1.18)) / (edist * 0.40))
        in_top_fin = dist_fin <= 1.0
        in_suit = yy_all > ecy + edist * 0.72
        in_side_fins = (np.abs(xx_all - ecx) > edist * 1.04) & (yy_all > ecy - edist * 0.35) & (yy_all < ecy + edist * 0.55)

        in_glass_ring = (dist_dome <= dome_r) & (dist_head > head_r) & (~in_top_fin) & (~in_suit) & (~in_side_fins)
        inner_blend = np.clip((dist_head - head_r) / 6.0, 0.0, 1.0) * np.clip((dist_fin - 1.0) / 0.25, 0.0, 1.0)
        outer_fade = np.clip((dome_r - dist_dome) / 3.0, 0.0, 1.0)

        luma_boost = np.clip((px_luma - bg_luma) / 42.0, 0.0, 1.0)
        rim_factor = np.clip((dist_dome / dome_r - 0.82) / 0.18, 0.0, 1.0)
        glass_alpha = np.clip(0.18 + 0.32 * rim_factor + 0.72 * luma_boost, 0.16, 0.90) * outer_fade

        dome_alpha = alpha * (1.0 - inner_blend) + glass_alpha * inner_blend
        alpha = np.where(in_glass_ring, dome_alpha, alpha)

    # Inward Foreground RGB Edge Bleed: pull pure solid interior foreground RGB
    # outward into all anti-aliased edge pixels so zero beige/white fringe can exist!
    out_rgb = rgb.copy()
    solid = (alpha >= 0.96) & (~in_glass_ring)
    known = solid.copy()
    bleed_rgb = rgb.copy()
    for _ in range(4):
        need = (~known) & (alpha > 0.01) & (~in_glass_ring)
        if not need.any():
            break
        acc = np.zeros_like(bleed_rgb)
        cnt = np.zeros((h, w), dtype=np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            sy0, sy1 = max(0, -dy), min(h, h - dy)
            sx0, sx1 = max(0, -dx), min(w, w - dx)
            ty0, ty1 = max(0, dy), min(h, h + dy)
            tx0, tx1 = max(0, dx), min(w, w + dx)
            k = known[sy0:sy1, sx0:sx1]
            acc[ty0:ty1, tx0:tx1] += bleed_rgb[sy0:sy1, sx0:sx1] * k[:, :, None]
            cnt[ty0:ty1, tx0:tx1] += k.astype(np.float32)
        upd = need & (cnt > 0)
        bleed_rgb[upd] = acc[upd] / cnt[upd, None]
        known[upd] = True

    edge_band = (alpha > 0.01) & (alpha < 0.96) & (~in_glass_ring) & known
    out_rgb[edge_band] = bleed_rgb[edge_band]

    # Color decontamination for translucent astronaut glass ring
    if translucent_helmet:
        semi_g = in_glass_ring & (alpha > 0.03) & (alpha < 0.96)
        safe_a = np.maximum(alpha[semi_g, None], 0.14)
        out_rgb[semi_g] = np.clip((rgb[semi_g] - (1.0 - alpha[semi_g, None]) * bg[semi_g]) / safe_a, 0.0, 255.0)

    out_rgb[alpha <= 0.01] = 0.0
    rgba = np.dstack([out_rgb, np.clip(alpha * 255.0, 0.0, 255.0)]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def place_aligned(
    cutout: Image.Image,
    eye_l: tuple[float, float],
    eye_r: tuple[float, float],
    ref_eye_mid: tuple[float, float],
    ref_eye_dist: float,
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
    stats = {
        "scale": round(scale, 4),
        "dx": dx,
        "dy": dy,
        "eye_err_x": round(placed_eye_x - ref_eye_mid[0], 2),
        "eye_err_y": round(placed_eye_y - ref_eye_mid[1], 2),
        "feet_err_y": round(placed_feet_y - ref_feet_y, 2),
    }
    return canvas, stats


def make_eye_overlays(base_ext: Image.Image, eye_l: tuple[float, float], eye_r: tuple[float, float]) -> tuple[Image.Image, Image.Image]:
    """Create shared transparent eye-expression overlays (happy closed + sleepy doze)
    using BOON KOI's own cream plush tone so all full-body outfits blink & squint seamlessly.
    """
    arr = np.array(base_ext)
    mx = int(round((eye_l[0] + eye_r[0]) * 0.5))
    my = int(round((eye_l[1] + eye_r[1]) * 0.5))
    patch = arr[my - 14 : my + 14, mx - 14 : mx + 14, :3]
    cream = tuple(int(v) for v in np.median(patch.reshape(-1, 3), axis=0))

    r_eye = 57

    def render_state(mode: str) -> Image.Image:
        # Draw at 2x for super-crisp anti-aliased stitched arcs
        s = 2
        cov = Image.new("RGBA", (CANVAS_W * s, CANVAS_H * s), (0, 0, 0, 0))
        d_cov = ImageDraw.Draw(cov)
        for ex, ey in (eye_l, eye_r):
            cx, cy = ex * s, ey * s
            rr = r_eye * s
            d_cov.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=cream + (255,))
        # Soft feather edge on plush cover so it blends naturally onto any face
        cov = cov.filter(ImageFilter.GaussianBlur(radius=6.0))

        # Draw subtle plush texture grain inside the cover
        cov_arr = np.array(cov)
        rng = np.random.default_rng(42 if mode == "closed" else 99)
        noise = rng.normal(0, 5.5, size=(CANVAS_H * s, CANVAS_W * s, 1))
        mask = cov_arr[:, :, 3] > 20
        for c in range(3):
            ch = cov_arr[:, :, c].astype(np.float32) + noise[:, :, 0]
            cov_arr[:, :, c] = np.where(mask, np.clip(ch, 0, 255), cov_arr[:, :, c]).astype(np.uint8)
        cov = Image.fromarray(cov_arr, "RGBA")

        # Draw crisp stitched charcoal eyelid arcs on top
        draw = ImageDraw.Draw(cov)
        stroke = (34, 29, 25, 255)
        lw = 14
        for ex, ey in (eye_l, eye_r):
            cx, cy = ex * s, ey * s
            w_arc = 34 * s
            h_arc = 22 * s
            if mode == "closed":
                # Happy upward curved ^ ^ eyes for petting
                bbox = (cx - w_arc, cy - h_arc * 0.55, cx + w_arc, cy + h_arc * 1.45)
                draw.arc(bbox, start=202, end=338, fill=stroke, width=lw)
                # Rounded caps
                for ang_deg in (202, 338):
                    ang = math.radians(ang_deg)
                    px = cx + math.cos(ang) * w_arc
                    py = (cy + h_arc * 0.45) + math.sin(ang) * h_arc
                    draw.ellipse((px - lw / 2, py - lw / 2, px + lw / 2, py + lw / 2), fill=stroke)
            else:
                # Cozy downward curved u u eyes for blink / doze
                bbox = (cx - w_arc, cy - h_arc * 1.25, cx + w_arc, cy + h_arc * 0.75)
                draw.arc(bbox, start=20, end=160, fill=stroke, width=lw)
                for ang_deg in (20, 160):
                    ang = math.radians(ang_deg)
                    px = cx + math.cos(ang) * w_arc
                    py = (cy - h_arc * 0.25) + math.sin(ang) * h_arc
                    draw.ellipse((px - lw / 2, py - lw / 2, px + lw / 2, py + lw / 2), fill=stroke)

        return cov.resize((CANVAS_W, CANVAS_H), Image.Resampling.LANCZOS)

    return render_state("closed"), render_state("doze")


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
    if not SRC_SHEET.exists():
        raise SystemExit(f"Source 2x2 sheet not found: {SRC_SHEET}")

    # 1. Pad base & mint-boots textures into unified 640x780 canvas
    base_orig = Image.open(WORK / "tex_base.png").convert("RGBA")
    mint_orig = Image.open(WORK / "tex_boots_mint.png").convert("RGBA")
    base_ext = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    base_ext.paste(base_orig, (BASE_DX, BASE_DY), base_orig)
    mint_ext = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    mint_ext.paste(mint_orig, (BASE_DX, BASE_DY), mint_orig)

    base_ext.save(SETS_DIR / "tex_base_ext.png")
    mint_ext.save(SETS_DIR / "tex_boots_mint_ext.png")

    # Measure reference eye landmarks & feet line in extended canvas
    b_arr = np.array(base_ext)
    roi = b_arr[BASE_DY + 220 : BASE_DY + 360, BASE_DX + 140 : BASE_DX + 440]
    dark = (roi[:, :, 3] > 200) & (roi[:, :, :3].mean(axis=2) < 40)
    ys, xs = np.where(dark)
    xs = xs.astype(np.float32) + BASE_DX + 140
    ys = ys.astype(np.float32) + BASE_DY + 220
    cx_split = BASE_DX + 300
    ref_eye_l = (float(xs[xs < cx_split].mean()), float(ys[xs < cx_split].mean()))
    ref_eye_r = (float(xs[xs >= cx_split].mean()), float(ys[xs >= cx_split].mean()))
    ref_eye_mid = ((ref_eye_l[0] + ref_eye_r[0]) * 0.5, (ref_eye_l[1] + ref_eye_r[1]) * 0.5)
    ref_eye_dist = ref_eye_r[0] - ref_eye_l[0]
    lm = json.loads((WORK / "landmarks.json").read_text())
    ref_feet_y = float(lm["feetY"] + BASE_DY)

    # 2. Generate shared eye-expression overlays (closed + doze)
    eyes_closed, eyes_doze = make_eye_overlays(base_ext, ref_eye_l, ref_eye_r)
    eyes_closed.save(SETS_DIR / "eyes_closed.png")
    eyes_doze.save(SETS_DIR / "eyes_doze.png")

    # Also bake closed/doze onto base_ext for non-set mode
    base_closed = Image.alpha_composite(base_ext, eyes_closed)
    base_doze = Image.alpha_composite(base_ext, eyes_doze)
    base_closed.save(SETS_DIR / "tex_closed_ext.png")
    base_doze.save(SETS_DIR / "tex_doze_ext.png")

    # 3. Extract, matte, and align all 4 full outfits
    sheet = Image.open(SRC_SHEET).convert("RGB")
    quads = split_quads(sheet)
    sets_meta = []

    for spec in SET_SPECS:
        q_im = quads[spec["quad"]]
        q_rgb = np.array(q_im, dtype=np.float32)
        eye_l, eye_r = find_eyes(q_rgb)
        cutout = matte_panel(q_im, translucent_helmet=spec["translucent_helmet"], set_id=spec["id"])
        aligned, stats = place_aligned(cutout, eye_l, eye_r, ref_eye_mid, ref_eye_dist, ref_feet_y)

        tex_path = SETS_DIR / f"tex_{spec['id']}.png"
        thumb_path = SETS_DIR / f"thumb_{spec['id']}.png"
        aligned.save(tex_path)
        make_thumb(aligned, 256).save(thumb_path)

        a = np.array(aligned)[:, :, 3]
        semi_count = int(((a > 15) & (a < 235)).sum())
        corners_max = int(max(a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]))
        print(
            f"[{spec['id']}] {spec['name']}: size={aligned.size} corners_max_alpha={corners_max} "
            f"semi_px={semi_count} align={stats}"
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
            }
        )

    # Save extended landmarks and sets manifest
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
    print("Saved sets_meta.json & landmarks_ext.json in", SETS_DIR)


if __name__ == "__main__":
    main()
