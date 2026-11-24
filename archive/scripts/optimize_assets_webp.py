#!/usr/bin/env python3
"""DEPRECATED & ARCHIVED — DO NOT RUN.
Per AGENTS.md §1 and PRD-0003 P0, eggbabe-h5 strictly uses compressed PNG
under assets/shared/png/ (zero .webp assets allowed for full H5 + iOS WeChat
mini-program compatibility).
"""
from __future__ import annotations

import sys
raise SystemExit("DEPRECATED: WebP conversion is prohibited by AGENTS.md. Use pngquant PNG pipeline instead.")

import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CAT_PATH = ROOT / "assets/shared/catalog.json"
OUT_DIR = ROOT / "assets/shared/webp"


def convert_img(src_rel: str, dst_name: str, *, quality: int = 86, alpha_quality: int = 96, max_size: tuple[int, int] | None = None) -> tuple[str, int, int]:
    src = ROOT / src_rel
    if not src.exists():
        raise FileNotFoundError(f"Missing source asset: {src}")
    dst = OUT_DIR / dst_name
    dst.parent.mkdir(parents=True, exist_ok=True)

    orig_sz = src.stat().st_size
    im = Image.open(src)
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        is_alpha = True
    else:
        im = im.convert("RGB")
        is_alpha = False

    if max_size is not None and (im.width > max_size[0] or im.height > max_size[1]):
        im.thumbnail(max_size, Image.Resampling.LANCZOS)

    save_kw = {"quality": quality, "method": 6}
    if is_alpha:
        save_kw["alpha_quality"] = alpha_quality
    im.save(dst, "WEBP", **save_kw)
    new_sz = dst.stat().st_size

    # Verify generated WebP decodes cleanly
    with Image.open(dst) as check:
        check.load()
        assert check.size == im.size

    rel_out = dst.relative_to(ROOT).as_posix()
    return rel_out, orig_sz, new_sz


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cat = json.loads(CAT_PATH.read_text(encoding="utf-8"))

    # Keep a backup map of original paths on first run, or resolve original if already webp
    total_orig = 0
    total_new = 0
    count = 0

    def record(label: str, src_rel: str, dst_name: str, **kw) -> str:
        nonlocal total_orig, total_new, count
        if src_rel.startswith("assets/shared/webp/"):
            p = ROOT / src_rel
            sz = p.stat().st_size
            total_orig += sz
            total_new += sz
            return src_rel
        rel_out, o, n = convert_img(src_rel, dst_name, **kw)
        total_orig += o
        total_new += n
        count += 1
        pct = (1.0 - n / max(o, 1)) * 100.0
        print(f"  {label:32s} {o/1024:7.1f} KB -> {n/1024:6.1f} KB  (-{pct:4.1f}%)")
        return rel_out

    print("=== Converting Backgrounds (11) ===")
    for bg in cat["backgrounds"]:
        bg["file"] = record(f"bg/{bg['id']}", bg["file"], f"bgs/{bg['id']}.webp", quality=80)

    for pid, pet in cat["pets"].items():
        print(f"\n=== Converting Pet: {pid} ===")
        texs = pet["textures"]
        texs["base"] = record(f"{pid}/base", texs["base"], f"{pid}_base.webp", quality=86, alpha_quality=96)
        if pid == "koi":
            # Full-canvas seamless plush fur tile: 320x390 WebP is crisp and ~10 KB
            texs["doze"] = record(f"{pid}/doze", texs["doze"], f"{pid}_doze.webp", quality=82, alpha_quality=90, max_size=(320, 390))
            if texs.get("closed"):
                texs["closed"] = record(f"{pid}/closed", texs["closed"], f"{pid}_closed.webp", quality=82, alpha_quality=90, max_size=(320, 390))
        else:
            if texs.get("closed"):
                texs["closed"] = record(f"{pid}/closed", texs["closed"], f"{pid}_closed.webp", quality=86, alpha_quality=96)
            if texs.get("doze"):
                texs["doze"] = record(f"{pid}/doze", texs["doze"], f"{pid}_doze.webp", quality=86, alpha_quality=96)

        for it in pet["items"]:
            iid = it["id"]
            it["tex"] = record(f"{pid}/{iid}", it["tex"], f"{pid}_{iid}.webp", quality=86, alpha_quality=96)
            if it.get("closedTex"):
                it["closedTex"] = record(f"{pid}/{iid}_closed", it["closedTex"], f"{pid}_{iid}_closed.webp", quality=86, alpha_quality=96)
            if it.get("dozeTex"):
                it["dozeTex"] = record(f"{pid}/{iid}_doze", it["dozeTex"], f"{pid}_{iid}_doze.webp", quality=86, alpha_quality=96)
            if it.get("thumb"):
                it["thumb"] = record(f"{pid}/thumb_{iid}", it["thumb"], f"thumbs/{pid}_{iid}.webp", quality=84, alpha_quality=94, max_size=(160, 160))

    cat["version"] = "1.2.0"
    cat["updatedAt"] = "2026-11-22"
    CAT_PATH.write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    saved_pct = (1.0 - total_new / max(total_orig, 1)) * 100.0
    print(f"\nDONE! Converted {count} images: {total_orig/1024:.1f} KB -> {total_new/1024:.1f} KB (-{saved_pct:.1f}%)")
    assert saved_pct >= 75.0, f"Expected >=75% size reduction, got {saved_pct:.1f}%"


if __name__ == "__main__":
    main()
