#!/usr/bin/env python3
"""Crop Boon Koi front view, recolor the boots, and extract the painted props."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
REF = ROOT / "assets/refs/koi_turnaround.png"
WORK = Path(__file__).resolve().parent
EX = WORK / "dress/extract"
BOOTS_YELLOW = (252, 210, 58)
BOOTS_MINT = (168, 228, 198)


# FIGURE 1 only. Rows below this are the floor line and the "FIGURE 1 / front" caption.
FRONT_BODY = (50, 236, 344, 576)  # x0, y0, x1, y1 in the left panel
SCALE = 2


def crop_front(im: Image.Image) -> Image.Image:
    w, _h = im.size
    panel = im.crop((0, 0, w // 4, im.height))
    x0, y0, x1, y1 = FRONT_BODY
    crop = panel.crop((x0, y0, min(x1, panel.width), min(y1, panel.height)))
    nw, nh = crop.width * SCALE, crop.height * SCALE
    return crop.resize((nw, nh), Image.Resampling.LANCZOS)


def rgba_from_rgb(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    arr = np.array(im)
    # sheet backdrop is pure white; cream fur stays (its darkest channel is well under this)
    white = arr[:, :, :3].min(axis=2) > 236
    arr[white, 3] = 0
    return Image.fromarray(arr)


def boot_mask(im: Image.Image) -> np.ndarray:
    """Whole yellow boot, including the cuff and the pale highlights."""
    arr = np.array(im)
    h = arr.shape[0]
    rgb = arr[:, :, :3].astype(np.int16)
    alpha = arr[:, :, 3] > 30
    chroma = rgb[:, :, 0] - rgb[:, :, 2]
    y0 = int(h * 0.78)
    seed = np.zeros(alpha.shape, dtype=bool)
    seed[y0:] = alpha[y0:] & (chroma[y0:] > 60) & (rgb[y0:, :, 0] > 130)
    grown = Image.fromarray(np.where(seed, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(11))
    near = (np.array(grown) > 0) & alpha
    # cream legs sit just above the cuff; pale highlights on the boot itself stay
    cream_rows = np.zeros(alpha.shape, dtype=bool)
    cream_rows[: int(h * 0.80)] = True
    cream = cream_rows & (rgb[:, :, 2] > 130) & (chroma < 50)
    boot = near & ~cream
    inv = Image.fromarray(np.where(boot, 0, 255).astype(np.uint8))
    ImageDraw.floodfill(inv, (0, 0), 128)
    holes = np.array(inv) == 255
    boot = (boot | holes) & alpha & ~cream
    boot[:y0] = False
    # pale cuff just above the saturated yellow
    warm = alpha & (chroma > 32) & (rgb[:, :, 0] > 150)
    warm[: int(h * 0.76)] = False
    grown2 = Image.fromarray(np.where(boot, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    boot = boot | ((np.array(grown2) > 0) & warm & ~cream)
    # the opaque floor shadow runs wider than the boots; keep the boot columns only
    strong = alpha & (chroma > 55)
    strong[:y0] = False
    cols = np.where(strong.any(axis=0))[0]
    if len(cols):
        boot[:, : max(0, int(cols.min()) - 6)] = False
        boot[:, min(boot.shape[1], int(cols.max()) + 7) :] = False
    return boot


def recolor_boots(im: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    arr = np.array(im).copy()
    boot = boot_mask(im)
    rgb = arr[:, :, :3].astype(np.float32)
    luma = (0.30 * rgb[:, :, 0] + 0.52 * rgb[:, :, 1] + 0.18 * rgb[:, :, 2]) / 255.0
    med = float(np.median(luma[boot])) if boot.any() else 0.6
    shade = np.clip(luma / max(med, 0.15), 0.58, 1.28)
    painted = np.clip(np.array(target, dtype=np.float32) * shade[:, :, None], 0, 255)
    for c in range(3):
        arr[:, :, c] = np.where(boot, painted[:, :, c], arr[:, :, c])
    return Image.fromarray(arr)


def save_tex(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")


def thumb_from(im: Image.Image, size: int = 128) -> Image.Image:
    t = im.copy()
    t.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - t.width) // 2
    oy = (size - t.height) // 2
    canvas.paste(t, (ox, oy), t)
    return canvas


ITEMS = [
    {"id": "boots_yellow", "slot": "boots", "label": "雨靴黄", "kind": "boots_base"},
    {"id": "boots_mint", "slot": "boots", "label": "雨靴薄荷", "kind": "boots_mint"},
    {"id": "kasa", "slot": "head", "label": "小笠", "kind": "hat"},
    {"id": "crown", "slot": "head", "label": "锦鲤冠", "kind": "crown"},
    {"id": "bow", "slot": "head", "label": "绒球", "kind": "bow"},
    {"id": "scarf", "slot": "neck", "label": "祈福结", "kind": "scarf"},
    {"id": "omamori", "slot": "dorsal", "label": "御守袋", "kind": "bag"},
    {"id": "goldfish", "slot": "hand", "label": "小金鱼", "kind": "fish"},
]


def landmarks_for(tex: Image.Image) -> dict:
    """Head, neck and feet in tex_base pixels, from the opaque silhouette."""
    arr = np.array(tex.split()[3])
    ys, xs = np.where(arr > 40)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    cx = int(round((x0 + x1) / 2))
    widths = (arr > 40).sum(axis=1)
    eq = int(np.argmax(widths))
    half = max(40, int(widths[eq] * 0.46))
    above = eq
    for y in range(eq, y0, -1):
        if widths[y] < widths[eq] * 0.55:
            above = y
            break
    below = eq
    for y in range(eq, y1):
        if widths[y] < widths[eq] * 0.42:
            below = y
            break
    ry = max(50, int((eq - above + below - eq) * 0.45))
    return {
        "cx": cx,
        "feetY": y1,
        "neck": {"x": cx, "y": int(below)},
        "head": {"x": cx, "y": int(eq), "rx": half, "ry": ry},
        "earL": {"x": cx - 18, "y": int(y0 + (eq - y0) * 0.25)},
        "earR": {"x": cx + 18, "y": int(y0 + (eq - y0) * 0.25)},
        "bodyY": int((eq + below) / 2),
        "bbox": [x0, y0, x1, y1],
    }


def clamp_box(box: tuple[int, int, int, int], size: tuple[int, int]) -> tuple[int, int, int, int]:
    x, y, w, h = box
    x = max(0, min(x, size[0] - 8))
    y = max(0, min(y, size[1] - 8))
    w = max(16, min(w, size[0] - x))
    h = max(16, min(h, size[1] - y))
    return (x, y, w, h)


SRC = WORK / "dress" / "src"
# Painted props. Head pieces sit between the dorsal fin and the eyes.
# The knot hangs under the mouth. The charm sits on the right chest.
# The goldfish is held beside the hip, below the side fin.
PLACEMENTS = {
    "kasa": {"bottom": 226, "width": 232},
    "crown": {"bottom": 220, "width": 206},
    "bow": {"bottom": 232, "width": 164},
    "scarf": {"bottom": 524, "width": 112},
    "omamori": {"x": 356, "y": 340, "width": 96},
    "goldfish": {"x": 330, "y": 418, "width": 156},
}


def key_magenta(im: Image.Image) -> Image.Image:
    """Drop the flat magenta backdrop and the magenta fringe JPEG leaves behind."""
    arr = np.array(im.convert("RGB")).astype(np.float32)
    corners = np.concatenate(
        [
            arr[:16, :16].reshape(-1, 3),
            arr[:16, -16:].reshape(-1, 3),
            arr[-16:, :16].reshape(-1, 3),
            arr[-16:, -16:].reshape(-1, 3),
        ]
    )
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))
    alpha = np.clip((dist - 24.0) / 32.0, 0.0, 1.0)
    r = arr[:, :, 0].copy()
    g = arr[:, :, 1].copy()
    b = arr[:, :, 2].copy()
    # floor shadow on the magenta sheet is nearly pure red after compression
    cast = (g < 24) & (b > 36) & (r > 50)
    alpha = np.where(cast, 0.0, alpha)
    # magenta fringe lifts blue above the felt
    spill = np.clip(b - g, 0, None)
    arr[:, :, 2] = np.where(spill > 12, np.clip(g - 8, 0, 255), b)
    fringe = np.clip(np.minimum(r, b) - g, 0, None)
    arr[:, :, 0] = np.clip(r - fringe * 0.35, 0, 255)
    # leftover brim shadow is dark red, not the black bead of the goldfish
    dirt = (g < 14) & (b < 24) & (r > g + 28) & (r < 160)
    alpha = np.where(dirt, 0.0, alpha)
    out = Image.fromarray(np.dstack([arr.astype(np.uint8), (alpha * 255).astype(np.uint8)]), "RGBA")
    mask = out.split()[3].point(lambda p: 255 if p > 14 else 0)
    bb = mask.getbbox()
    if not bb:
        return out
    return out.crop(bb)


def load_prop(kind: str) -> Image.Image:
    path = SRC / f"{kind}.jpg"
    if not path.exists():
        raise SystemExit(f"missing prop art {path}")
    return key_magenta(Image.open(path))


def place_box(sprite: Image.Image, spec: dict, cx: int, size: tuple[int, int]) -> tuple[int, int, int, int]:
    aspect = sprite.height / max(1, sprite.width)
    w = int(spec["width"])
    h = max(16, int(round(w * aspect)))
    if "x" in spec:
        x, y = int(spec["x"]), int(spec["y"])
    else:
        x = int(cx - w / 2)
        y = int(spec["bottom"] - h)
    return clamp_box((x, y, w, h), size)


def paint_layer(base: Image.Image, sprite: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """Prop plus a soft contact shadow, painted in texture space."""
    x, y, w, h = box
    sprite = sprite.resize((w, h), Image.Resampling.LANCZOS)
    obj = np.array(sprite.split()[3]).astype(np.float32)
    blurred = np.array(sprite.split()[3].filter(ImageFilter.GaussianBlur(4))).astype(np.float32)
    shifted = np.zeros_like(blurred)
    shifted[5:, :] = blurred[:-5, :]
    shadow_a = np.clip(shifted * (1.0 - obj / 255.0) * 0.42, 0, 255).astype(np.uint8)
    shadow = Image.new("RGBA", (w, h), (30, 22, 16, 0))
    shadow.putalpha(Image.fromarray(shadow_a))
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.paste(shadow, (x, y), shadow)
    body = np.array(base.split()[3]) > 20
    lay = np.array(layer)
    lay[:, :, 3] = np.where(body, lay[:, :, 3], 0)
    layer = Image.fromarray(lay, "RGBA")
    layer.paste(sprite, (x, y), sprite)
    return layer


def extract_changed(base: Image.Image, layer: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    worn = Image.alpha_composite(base, layer)
    before = np.array(base).astype(np.int16)
    after = np.array(worn).astype(np.int16)
    delta = np.abs(after[:, :, :3] - before[:, :, :3]).sum(axis=2)
    lay = np.array(layer)
    keep = (lay[:, :, 3] > 8) | (delta > 16)
    lay[:, :, 3] = np.where(keep, np.maximum(lay[:, :, 3], np.clip(delta, 0, 80).astype(np.uint8)), 0)
    full = Image.fromarray(lay, "RGBA")
    mask = full.split()[3].point(lambda p: 255 if p > 8 else 0)
    bb = mask.getbbox()
    if not bb:
        bb = (0, 0, 8, 8)
    x0, y0, x1, y1 = bb
    pad = 2
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(full.width, x1 + pad), min(full.height, y1 + pad)
    return full.crop((x0, y0, x1, y1)), (x0, y0, x1 - x0, y1 - y0)


def main() -> None:
    if not REF.exists():
        raise SystemExit(f"missing reference {REF}")
    front = rgba_from_rgb(crop_front(Image.open(REF)))
    save_tex(front, WORK / "tex_base.png")
    save_tex(front.copy(), WORK / "tex_closed.png")
    save_tex(front.copy(), WORK / "tex_doze.png")
    save_tex(recolor_boots(front, BOOTS_MINT), WORK / "tex_boots_mint.png")

    lm = landmarks_for(front)
    (WORK / "landmarks.json").write_text(json.dumps(lm, indent=2), encoding="utf-8")
    print("landmarks", lm)

    meta = []
    EX.mkdir(parents=True, exist_ok=True)
    boots = boot_mask(front)
    ys, xs = np.where(boots)
    boot_box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    mint = Image.open(WORK / "tex_boots_mint.png")
    preview = Path("/tmp/koi_preview")
    preview.mkdir(parents=True, exist_ok=True)

    for it in ITEMS:
        iid = it["id"]
        slot = it["slot"]
        if it.get("kind") in ("boots_base", "boots_mint"):
            src = front if it["kind"] == "boots_base" else mint
            thumb = thumb_from(src.crop(boot_box))
            thumb.save(EX / f"thumb_{iid}.png")
            acc = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
            acc.save(EX / f"acc_{iid}.png")
            meta.append(
                {
                    "id": iid,
                    "slot": slot,
                    "x": boot_box[0],
                    "y": boot_box[1],
                    "w": boot_box[2] - boot_box[0],
                    "h": boot_box[3] - boot_box[1],
                    "opaque": 1,
                }
            )
            continue

        sprite = load_prop(iid)
        box = place_box(sprite, PLACEMENTS[iid], lm["cx"], front.size)
        layer = paint_layer(front, sprite, box)
        patch, tight = extract_changed(front, layer)
        thumb_from(sprite).save(EX / f"thumb_{iid}.png")
        patch.save(EX / f"acc_{iid}.png")
        patch.save(EX / f"acc_{iid}_full.png")
        worn = Image.alpha_composite(front, layer)
        worn.save(preview / f"worn_{iid}.png")
        opaque = int((np.array(patch.split()[3]) > 40).sum())
        meta.append(
            {
                "id": iid,
                "slot": slot,
                "x": tight[0],
                "y": tight[1],
                "w": tight[2],
                "h": tight[3],
                "opaque": opaque,
            }
        )
        print(iid, "placed", box, "tight", tight, "opaque", opaque)

    (EX / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("wrote textures +", len(meta), "items to", WORK)


if __name__ == "__main__":
    main()