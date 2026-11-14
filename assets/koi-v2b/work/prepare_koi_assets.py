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
TARGET_H = 1119
BOOTS_YELLOW = (252, 210, 58)
BOOTS_MINT = (168, 228, 198)


def crop_front(im: Image.Image) -> Image.Image:
    w, h = im.size
    panel = w // 4
    crop = im.crop((0, 0, panel, h))
    scale = TARGET_H / crop.height
    nw = int(crop.width * scale)
    return crop.resize((nw, TARGET_H), Image.Resampling.LANCZOS)


def rgba_from_rgb(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    arr = np.array(im)
    # white backdrop -> transparent
    rgb = arr[:, :, :3].astype(np.int16)
    white = (rgb > 245).all(axis=2)
    arr[white, 3] = 0
  # soften fringe
    im = Image.fromarray(arr)
    return im


def recolor_boots(im: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    arr = np.array(im).copy()
    h = arr.shape[0]
    y0 = int(h * 0.72)
    region = arr[y0:, :]
    rgb = region[:, :, :3].astype(np.float32)
    mask = region[:, :, 3] > 40
    yellowish = (
        (rgb[:, :, 0] > 180)
        & (rgb[:, :, 1] > 150)
        & (rgb[:, :, 2] < 140)
        & mask
    )
    if yellowish.sum() < 80:
        yellowish = mask
    tgt = np.array(target, dtype=np.float32)
    for c in range(3):
        region[:, :, c] = np.where(yellowish, tgt[c], region[:, :, c])
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


def anchor_boxes(tex: Image.Image) -> dict[str, tuple[int, int, int, int]]:
    a = tex.split()[3]
    bb = a.getbbox() or (0, 0, tex.width, tex.height)
    x0, y0, x1, y1 = bb
    cx = (x0 + x1) // 2
    bh = min(190, max(120, y1 - y0 - 20))
    by = max(y0 + 40, y1 - bh)
    return {
        "head": (cx - 140, y0 + 20, 280, 200),
        "neck": (cx - 200, y0 + 180, 400, 160),
        "dorsal": (cx - 120, y0 + 40, 240, 180),
        "hand": (max(x0, x1 - 120), y0 + 200, 100, 120),
        "boots": (cx - 170, by, 340, bh),
    }


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

    anchors = anchor_boxes(front)
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