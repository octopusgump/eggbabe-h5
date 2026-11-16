#!/usr/bin/env python3
"""Crop Boon Koi front view, build tex_* and v0 dress extract (paint+extract placeholder pass)."""
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


def recolor_boots(im: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    arr = np.array(im).copy()
    h = arr.shape[0]
    y0 = int(h * 0.80)
    region = arr[y0:]
    rgb = region[:, :, :3].astype(np.int16)
    alpha = region[:, :, 3] > 40
    boot = alpha & ((rgb[:, :, 0].astype(np.int16) - rgb[:, :, 2]) > 50) & (rgb[:, :, 0] > 120)
    grown = Image.fromarray(np.where(boot, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    boot = (np.array(grown) > 0) & alpha
    tgt = np.array(target, dtype=np.uint8)
    # keep the shading: scale each boot pixel toward the mint color
    base = rgb.astype(np.float32)
    luma = base.mean(axis=2, keepdims=True) / 255.0
    tint = np.array(target, dtype=np.float32)
    painted = np.clip(tint * (0.55 + 0.7 * luma), 0, 255)
    for c in range(3):
        region[:, :, c] = np.where(boot, painted[:, :, c], region[:, :, c])
    arr[y0:] = region
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
    {"id": "kasa", "slot": "head", "label": "小笠", "kind": "hat", "color": (210, 178, 120)},
    {"id": "crown", "slot": "head", "label": "锦鲤冠", "kind": "crown", "color": (220, 190, 90)},
    {"id": "bow", "slot": "head", "label": "绒球", "kind": "bow", "color": (240, 160, 170)},
    {"id": "scarf", "slot": "neck", "label": "祈福结", "kind": "scarf", "color": (210, 90, 90)},
    {"id": "omamori", "slot": "dorsal", "label": "御守袋", "kind": "bag", "color": (200, 120, 100)},
    {"id": "goldfish", "slot": "hand", "label": "小金鱼", "kind": "fish", "color": (255, 140, 80)},
]


def box_xywh(box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    x, y, w, h = box
    return (x, y, x + w, y + h)


def opaque_bbox(tex: Image.Image) -> tuple[int, int, int, int]:
    bb = tex.split()[3].getbbox()
    if not bb:
        return (0, 0, tex.width, tex.height)
    return bb


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


def anchor_boxes(tex: Image.Image, lm: dict) -> dict[str, tuple[int, int, int, int]]:
    x0, y0, x1, y1 = lm["bbox"]
    cx = lm["cx"]
    bw, bh = x1 - x0, y1 - y0
    raw = {
        "head": (cx - int(bw * 0.28), y0 + int(bh * 0.06), int(bw * 0.56), int(bh * 0.28)),
        "neck": (x0 + int(bw * 0.08), lm["neck"]["y"] - int(bh * 0.06), int(bw * 0.84), int(bh * 0.16)),
        "dorsal": (cx - int(bw * 0.08), y0 + int(bh * 0.04), int(bw * 0.34), int(bh * 0.22)),
        "hand": (x1 - int(bw * 0.28), lm["head"]["y"], int(bw * 0.22), int(bh * 0.16)),
        "boots": (x0 + int(bw * 0.12), y1 - int(bh * 0.28), int(bw * 0.76), int(bh * 0.28)),
    }
    return {k: clamp_box(v, tex.size) for k, v in raw.items()}


def draw_accessory(kind: str, size: tuple[int, int], color: tuple[int, int, int]) -> Image.Image:
    w, h = size
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if kind == "hat":
        d.polygon([(w * 0.2, h * 0.55), (w * 0.5, h * 0.05), (w * 0.8, h * 0.55)], fill=color + (230,))
        d.ellipse([w * 0.08, h * 0.48, w * 0.92, h * 0.72], fill=color + (240,))
    elif kind == "crown":
        pts = []
        for i in range(5):
            x = w * (0.15 + i * 0.17)
            y = h * (0.35 if i % 2 == 0 else 0.12)
            pts.append((x, y))
        pts += [(w * 0.85, h * 0.55), (w * 0.15, h * 0.55)]
        d.polygon(pts, fill=color + (235,))
    elif kind == "bow":
        d.ellipse([w * 0.05, h * 0.25, w * 0.45, h * 0.75], fill=color + (230,))
        d.ellipse([w * 0.55, h * 0.25, w * 0.95, h * 0.75], fill=color + (230,))
        d.rectangle([w * 0.42, h * 0.38, w * 0.58, h * 0.62], fill=color + (250,))
    elif kind == "scarf":
        d.rounded_rectangle([w * 0.05, h * 0.3, w * 0.95, h * 0.7], radius=18, fill=color + (220,))
        d.rounded_rectangle([w * 0.65, h * 0.55, w * 0.92, h * 0.95], radius=12, fill=color + (200,))
    elif kind == "bag":
        d.rounded_rectangle([w * 0.25, h * 0.2, w * 0.75, h * 0.85], radius=16, fill=color + (225,))
        d.line([w * 0.35, h * 0.2, w * 0.65, h * 0.2], fill=(80, 50, 40, 200), width=4)
    elif kind == "fish":
        d.ellipse([w * 0.15, h * 0.3, w * 0.78, h * 0.72], fill=color + (235,))
        d.polygon([(w * 0.78, h * 0.4), (w * 0.95, h * 0.52), (w * 0.78, h * 0.65)], fill=color + (220,))
    else:
        d.ellipse([2, 2, w - 2, h - 2], fill=color + (200,))
    return im.filter(ImageFilter.GaussianBlur(0.6))


def composite_extract(base: Image.Image, acc: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    x, y, w, h = box
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    patch = acc.resize((w, h), Image.Resampling.LANCZOS)
    layer.paste(patch, (x, y), patch)
    out = base.copy()
    out = Image.alpha_composite(out, layer)
    # cut to accessory alpha island
    crop = layer.crop(box_xywh((x, y, w, h)))
    return crop


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

    anchors = anchor_boxes(front, lm)
    meta = []
    EX.mkdir(parents=True, exist_ok=True)

    for it in ITEMS:
        iid = it["id"]
        slot = it["slot"]
        if it.get("kind") == "boots_base":
            thumb = thumb_from(front.crop(box_xywh(anchors["boots"])))
            thumb.save(EX / f"thumb_{iid}.png")
            # empty acc — default body
            acc = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
            acc.save(EX / f"acc_{iid}.png")
            meta.append(
                {
                    "id": iid,
                    "slot": slot,
                    "x": anchors["boots"][0],
                    "y": anchors["boots"][1],
                    "w": anchors["boots"][2],
                    "h": anchors["boots"][3],
                    "opaque": 1,
                }
            )
            continue
        if it.get("kind") == "boots_mint":
            thumb = thumb_from(Image.open(WORK / "tex_boots_mint.png").crop(box_xywh(anchors["boots"])))
            thumb.save(EX / f"thumb_{iid}.png")
            acc = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
            acc.save(EX / f"acc_{iid}.png")
            meta.append(
                {
                    "id": iid,
                    "slot": slot,
                    "x": anchors["boots"][0],
                    "y": anchors["boots"][1],
                    "w": anchors["boots"][2],
                    "h": anchors["boots"][3],
                    "opaque": 1,
                }
            )
            continue

        box = anchors[slot if slot in anchors else "head"]
        art = draw_accessory(it["kind"], (box[2], box[3]), it["color"])
        thumb = thumb_from(art)
        thumb.save(EX / f"thumb_{iid}.png")
        patch = composite_extract(front, art, box)
        patch.save(EX / f"acc_{iid}.png")
        patch.save(EX / f"acc_{iid}_full.png")
        a = patch.split()[3]
        opaque = int((np.array(a) > 40).sum())
        meta.append({"id": iid, "slot": slot, "x": box[0], "y": box[1], "w": box[2], "h": box[3], "opaque": opaque})

    (EX / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("wrote textures +", len(meta), "items to", WORK)


if __name__ == "__main__":
    main()