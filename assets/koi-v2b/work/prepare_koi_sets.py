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
]


def find_eyes(rgb: np.ndarray) -> tuple[tuple[float, float], tuple[float, float]]:
    """Detect left and right pupil centers in a centered 1:1 front-facing BOON KOI portrait."""
    h, w, _ = rgb.shape
    ry0, ry1 = int(h * 0.30), int(h * 0.62)
    rx0, rx1 = int(w * 0.28), int(w * 0.72)
    roi = rgb[ry0:ry1, rx0:rx1].mean(axis=2)
    ys, xs = np.where(roi < 42)
    xs = xs.astype(np.float32) + rx0
    ys = ys.astype(np.float32) + ry0
    y_cut = np.percentile(ys, 65)
    cx = w * 0.5
    l = (xs < cx - 12) & (ys <= y_cut)
    r = (xs > cx + 12) & (ys <= y_cut)
    return (float(xs[l].mean()), float(ys[l].mean())), (float(xs[r].mean()), float(ys[r].mean()))


def chroma_key_matte(im: Image.Image, key: str, translucent_helmet: bool = False) -> Image.Image:
    """Extract spotless RGBA matte from a flat shadowless blue/green chroma screen
    with chroma spill suppression and optical translucent glass matting for astronaut.
    """
    rgb = np.array(im.convert("RGB"), dtype=np.float32)
    h, w, _ = rgb.shape
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]

    # Sample exact background chroma color from the 4 corners
    corners = np.concatenate(
        [rgb[:16, :16].reshape(-1, 3), rgb[:16, -16:].reshape(-1, 3),
         rgb[-16:, :16].reshape(-1, 3), rgb[-16:, -16:].reshape(-1, 3)],
        axis=0,
    )
    bg_col = np.median(corners, axis=0)

    if key == "blue":
        excess = b - np.maximum(r, g)
        bg_excess = float(bg_col[2] - max(bg_col[0], bg_col[1]))
        lo, hi = 24.0, max(105.0, bg_excess * 0.58)
    else:
        excess = g - np.maximum(r, b)
        bg_excess = float(bg_col[1] - max(bg_col[0], bg_col[2]))
        lo, hi = 24.0, max(125.0, bg_excess * 0.56)

    # Smooth physical alpha ramp for opaque objects
    alpha = np.clip((hi - excess) / max(hi - lo, 1.0), 0.0, 1.0)
    # Clean near-zero noise in pure chroma background
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

        # Locate the outer bubble helmet dome circle
        dome_cx = ecx
        dome_cy = ecy - edist * 0.25
        dome_r = edist * 1.50
        dist_dome = np.hypot(xx - dome_cx, yy - dome_cy)
        # Inner opaque plush head + top fin + suit collar + side fins
        dist_head = np.hypot((xx - ecx) / (edist * 1.08), (yy - (ecy - edist * 0.05)) / (edist * 1.12))
        dist_fin = np.hypot((xx - ecx) / (edist * 0.21), (yy - (ecy - edist * 1.24)) / (edist * 0.36))
        in_suit = yy > ecy + edist * 0.72
        in_side_fins = (np.abs(xx - ecx) > edist * 1.02) & (yy > ecy - edist * 0.35) & (yy < ecy + edist * 0.55)

        in_glass = (dist_dome <= dome_r) & (dist_head > 1.0) & (dist_fin > 1.0) & (~in_suit) & (~in_side_fins)

        # True optical blue-screen recovery:
        # C_obs = a * C_glass + (1 - a) * C_bg  =>  a ≈ 1 - excess / bg_excess
        # Pure glass body has slight visibility (0.14+), specular highlights reach ~0.92!
        outer_fade = np.clip((dome_r - dist_dome) / 6.0, 0.0, 1.0)
        optical_a = np.clip(1.0 - excess / max(bg_excess, 1.0), 0.0, 1.0)
        # Boost slightly so glass shell stays gently visible even over light cream room bg
        rim_boost = np.clip((dist_dome / dome_r - 0.84) / 0.16, 0.0, 1.0) * 0.24
        glass_a = np.clip(optical_a * 1.08 + 0.08 + rim_boost, 0.0, 0.94) * outer_fade

        # Smooth transition at inner plush head & top fin boundary
        inner_t = np.clip((dist_head - 1.0) / 0.07, 0.0, 1.0) * np.clip((dist_fin - 1.0) / 0.12, 0.0, 1.0)
        alpha = np.where(in_glass, alpha * (1.0 - inner_t) + glass_a * inner_t, alpha)

        # Recover pure neutral-white glass reflection RGB (removing blue backdrop contribution)
        safe_a = np.maximum(alpha[in_glass, None], 0.12)
        rec = (rgb[in_glass] - (1.0 - alpha[in_glass, None]) * bg_col[None, :]) / safe_a
        rec = np.clip(rec, 0.0, 255.0)
        # Neutralize any remaining blue tint on the glass reflection
        rec[:, 2] = np.minimum(rec[:, 2], np.maximum(rec[:, 0], rec[:, 1]) + 10.0)
        out_rgb[in_glass] = rec

    # Chroma spill suppression on all non-glass pixels (completely kills green/blue edge tint!)
    non_glass = ~in_glass
    if key == "blue":
        # Clamp excess blue toward max(R, G) everywhere outside pure background
        spill = non_glass & (b > np.maximum(r, g))
        out_rgb[spill, 2] = np.maximum(out_rgb[spill, 0], out_rgb[spill, 1])
    else:
        # Clamp excess green to warm cream balance (eliminates green bounce tint on white/cream fur)
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


def make_eye_overlays(base_ext: Image.Image, eye_l: tuple[float, float], eye_r: tuple[float, float]) -> tuple[Image.Image, Image.Image]:
    """Create shared transparent eye-expression overlays (happy closed + sleepy doze)."""
    arr = np.array(base_ext)
    mx = int(round((eye_l[0] + eye_r[0]) * 0.5))
    my = int(round((eye_l[1] + eye_r[1]) * 0.5))
    patch = arr[my - 14 : my + 14, mx - 14 : mx + 14, :3]
    cream = tuple(int(v) for v in np.median(patch.reshape(-1, 3), axis=0))
    r_eye = 57

    def render_state(mode: str) -> Image.Image:
        s = 2
        cov = Image.new("RGBA", (CANVAS_W * s, CANVAS_H * s), (0, 0, 0, 0))
        d_cov = ImageDraw.Draw(cov)
        for ex, ey in (eye_l, eye_r):
            cx, cy = ex * s, ey * s
            rr = r_eye * s
            d_cov.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=cream + (255,))
        cov = cov.filter(ImageFilter.GaussianBlur(radius=6.0))

        cov_arr = np.array(cov)
        rng = np.random.default_rng(42 if mode == "closed" else 99)
        noise = rng.normal(0, 5.5, size=(CANVAS_H * s, CANVAS_W * s, 1))
        mask = cov_arr[:, :, 3] > 20
        for c in range(3):
            ch = cov_arr[:, :, c].astype(np.float32) + noise[:, :, 0]
            cov_arr[:, :, c] = np.where(mask, np.clip(ch, 0, 255), cov_arr[:, :, c]).astype(np.uint8)
        cov = Image.fromarray(cov_arr, "RGBA")

        draw = ImageDraw.Draw(cov)
        stroke = (34, 29, 25, 255)
        lw = 14
        for ex, ey in (eye_l, eye_r):
            cx, cy = ex * s, ey * s
            w_arc = 34 * s
            h_arc = 22 * s
            if mode == "closed":
                bbox = (cx - w_arc, cy - h_arc * 0.55, cx + w_arc, cy + h_arc * 1.45)
                draw.arc(bbox, start=202, end=338, fill=stroke, width=lw)
                for ang_deg in (202, 338):
                    ang = math.radians(ang_deg)
                    px = cx + math.cos(ang) * w_arc
                    py = (cy + h_arc * 0.45) + math.sin(ang) * h_arc
                    draw.ellipse((px - lw / 2, py - lw / 2, px + lw / 2, py + lw / 2), fill=stroke)
            else:
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

    base_orig = Image.open(WORK / "tex_base.png").convert("RGBA")
    mint_orig = Image.open(WORK / "tex_boots_mint.png").convert("RGBA")
    base_ext = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    base_ext.paste(base_orig, (BASE_DX, BASE_DY), base_orig)
    mint_ext = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    mint_ext.paste(mint_orig, (BASE_DX, BASE_DY), mint_orig)

    base_ext.save(SETS_DIR / "tex_base_ext.png")
    mint_ext.save(SETS_DIR / "tex_boots_mint_ext.png")

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
    lm = json.loads((WORK / "landmarks.json").read_text())
    ref_feet_y = float(lm["feetY"] + BASE_DY)

    eyes_closed, eyes_doze = make_eye_overlays(base_ext, ref_eye_l, ref_eye_r)
    eyes_closed.save(SETS_DIR / "eyes_closed.png")
    eyes_doze.save(SETS_DIR / "eyes_doze.png")
    Image.alpha_composite(base_ext, eyes_closed).save(SETS_DIR / "tex_closed_ext.png")
    Image.alpha_composite(base_ext, eyes_doze).save(SETS_DIR / "tex_doze_ext.png")

    sets_meta = []
    for spec in SET_SPECS:
        src_path = CHROMA_DIR / f"{spec['id']}.jpg"
        im = Image.open(src_path).convert("RGB")
        rgb = np.array(im, dtype=np.float32)
        eye_l, eye_r = find_eyes(rgb)
        cutout = chroma_key_matte(im, key=spec["key"], translucent_helmet=spec["translucent_helmet"])
        aligned, stats = place_aligned(cutout, eye_l, eye_r, ref_eye_mid, ref_feet_y)

        tex_path = SETS_DIR / f"tex_{spec['id']}.png"
        thumb_path = SETS_DIR / f"thumb_{spec['id']}.png"
        aligned.save(tex_path)
        make_thumb(aligned, 256).save(thumb_path)

        a = np.array(aligned)[:, :, 3]
        semi_count = int(((a > 15) & (a < 235)).sum())
        corners_max = int(max(a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]))
        print(
            f"[{spec['id']}] {spec['name']} ({spec['key']}-key): size={aligned.size} "
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
    print("Chroma-key pipeline complete!")


if __name__ == "__main__":
    main()
