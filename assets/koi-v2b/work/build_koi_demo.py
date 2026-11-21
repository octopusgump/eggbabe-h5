#!/usr/bin/env python3
"""Build official v2b KOI mesh demo with full-body elastic transparent sets
and shared eye expression overlays (sets only).
"""
import base64
import io
import json
from pathlib import Path
from PIL import Image

W = Path(__file__).resolve().parent
OUT = W.parent
SETS = W / "sets"

sets_meta = json.loads((SETS / "sets_meta.json").read_text())
ext_lm = json.loads((SETS / "landmarks_ext.json").read_text())

CW, CH = int(ext_lm["canvasW"]), int(ext_lm["canvasH"])

# Unified texture region covers the full 640x780 expanded canvas so tall hats never clip
TEX = dict(x0=0, y0=0, w=CW, h=CH)

# Frame BOON KOI completely above the fixed 410px bottom panel (top edge y=434)
BODY_H = max(1, ext_lm["feetY"] - ext_lm["bbox"][1])
BODY_W = max(1, ext_lm["bbox"][2] - ext_lm["bbox"][0])
S = min(268.0 / BODY_H, 240.0 / BODY_W)
FEET = (195.0, 412.0)  # stands cleanly on lifted rug with 22px clearance above #sheet and >100px jump headroom
FOOT_SRC = (float(ext_lm["cx"]), float(ext_lm["feetY"]))
OX = FEET[0] - FOOT_SRC[0] * S
OY = FEET[1] - FOOT_SRC[1] * S


def uri_img(im: Image.Image, fmt: str = "WEBP", **kw) -> str:
    buf = io.BytesIO()
    if fmt == "WEBP":
        im.save(buf, "WEBP", quality=92, method=6, alpha_quality=100)
        mime = "image/webp"
    else:
        im.save(buf, fmt, **kw)
        mime = "image/png" if fmt == "PNG" else "image/jpeg"
    return "data:" + mime + ";base64," + base64.b64encode(buf.getvalue()).decode()


def uri_path(p: Path) -> str:
    im = Image.open(p)
    if im.mode != "RGBA" and p.suffix.lower() == ".png":
        im = im.convert("RGBA")
    return uri_img(im)


items = []
for s in sets_meta:
    items.append(
        dict(
            id=s["id"],
            slot="set",
            name=s["name"],
            desc=s["desc"],
            price=s["price"],
            tex=uri_path(W / s["tex"]),
            thumb=uri_path(W / s["thumb"]),
        )
    )

cards = []
for it in items:
    cards.append(
        f'<button class="card" type="button" data-id="{it["id"]}" data-slot="set">'
        f'<div class="thumb-wrap"><img alt="{it["name"]}"></div>'
        f'<div class="card-name">{it["name"]}</div>'
        f'<div class="card-price">★ {it["price"]}</div>'
        f'<span class="badge"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.2l2.6 2.6L10 3.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
        f"</button>"
    )

sheet = (
    '<div id="sheet">'
    '<div class="handle"></div>'
    f'<div class="sheet-title">套装 ({len(sets_meta)})</div>'
    '<div id="grid">' + "".join(cards) + "</div>"
    "</div>"
)

css = r"""
  #sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 410px; z-index: 10; background: #fbf4ea; border-radius: 24px 24px 0 0; box-shadow: 0 -8px 26px rgba(80,50,20,.14); padding: 8px 14px calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
  #sheet .handle { width: 38px; height: 4px; background: #e4d3bf; border-radius: 99px; margin: 2px auto 6px; flex-shrink: 0; }
  .sheet-title { text-align: center; margin-bottom: 8px; font: 600 12.5px/1.2 system-ui, sans-serif; color: #7a634d; flex-shrink: 0; }
  #grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: max-content; align-content: start; gap: 9px 8px; overflow-y: auto; overscroll-behavior: contain; padding: 2px 1px 18px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  #grid::-webkit-scrollbar { display: none; }
  .card { position: relative; background: #fffdf9; border-radius: 14px; border: 2px solid rgba(201,149,90,0); box-shadow: 0 1px 3px rgba(80,50,20,.08); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 7px 4px 6px; cursor: pointer; appearance: none; -webkit-appearance: none; }
  .card .thumb-wrap { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .card img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; user-select: none; -webkit-user-drag: none; }
  .card-name { margin-top: 4px; font: 600 11px/1.15 system-ui, sans-serif; color: #4f3d2e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .card-price { margin-top: 3px; font: 600 10.5px/1 system-ui, sans-serif; color: #c48840; }
  .card.selected { border-color: #c9955a; box-shadow: 0 0 0 1.5px #c9955a, 0 2px 6px rgba(201,149,90,.2); }
  .card .badge { display: none; position: absolute; top: 4px; right: 4px; width: 17px; height: 17px; border-radius: 50%; background: #c9955a; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,.15); }
  .card.selected .badge { display: flex; }
  .card .badge svg { display: block; width: 10px; height: 10px; }
"""

t = (W / "template.html").read_text()
t = t.replace(
    "  .zz { position: absolute; left: 0; top: 0; font: 700 15px/1 sans-serif; color: #8a7a68; opacity: 0; pointer-events: none; z-index: 3; }\n</style>",
    "  .zz { position: absolute; left: 0; top: 0; font: 700 15px/1 sans-serif; color: #8a7a68; opacity: 0; pointer-events: none; z-index: 3; }\n"
    + css
    + "</style>",
)
t = t.replace(
    '  <canvas id="gl"></canvas>\n</div></div>',
    '  <canvas id="gl"></canvas>\n%%SHEET_HTML%%\n</div></div>',
)
t = t.replace(
    '  const IMG = { base: "%%TEX_BASE%%", closed: "%%TEX_CLOSED%%", doze: "%%TEX_DOZE%%" };',
    '  const IMG = { base: "%%TEX_BASE%%", closed: "%%TEX_CLOSED%%", doze: "%%TEX_DOZE%%", eyesClosed: "%%EYES_CLOSED%%", eyesDoze: "%%EYES_DOZE%%" };\n  const ITEMS = %%ITEMS%%;',
)

set_init = r"""
  /* ---------- full-body set textures ---------- */
  const setTextures = {};
  function makePotTexture(img) {
    const c = document.createElement("canvas"); c.width = POT_W; c.height = POT_H;
    c.getContext("2d").drawImage(img, 0, 0);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  ITEMS.forEach(function (it) {
    const img = new Image();
    img.onload = function () {
      setTextures[it.id] = makePotTexture(img);
      if (worn.set === it.id && ready >= 3) render(lastPose);
    };
    img.src = it.tex;
  });
"""

early_worn = r"""
  const worn = { set: null };
  let texBodyDefault = null, texClosed = null, texDoze = null;
  let texEyesClosed = null, texEyesDoze = null;
  function rebindBodyTex() {
    gl.useProgram(prog);
    const t0 = (worn.set && setTextures[worn.set]) ? setTextures[worn.set] : texBodyDefault;
    if (t0) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t0); }
    if (texEyesClosed && texEyesDoze) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texEyesClosed);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texEyesDoze);
      gl.uniform1f(uEye, 1.0);
    } else {
      if (texClosed) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texClosed); }
      if (texDoze) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texDoze); }
      gl.uniform1f(uEye, 0.0);
    }
  }
"""

extra_loaders = r"""
  (function loadExtraBodyTex() {
    function loadPot(src, cb) {
      const img = new Image();
      img.onload = function () { cb(makePotTexture(img)); };
      img.src = src;
    }
    loadPot(IMG.eyesClosed, function (t) { texEyesClosed = t; });
    loadPot(IMG.eyesDoze, function (t) { texEyesDoze = t; });
  })();
"""

t = t.replace(
    '      gl.uniform1i(gl.getUniformLocation(prog, "t" + unit), unit);\n      ready += 1; if (ready === 3) { window.__ready = true; render(lastPose); }',
    '      gl.uniform1i(gl.getUniformLocation(prog, "t" + unit), unit);\n      if (unit === 0) texBodyDefault = t;\n      else if (unit === 1) texClosed = t;\n      else if (unit === 2) texDoze = t;\n      ready += 1; if (ready === 3) { window.__ready = true; render(lastPose); }',
)
t = t.replace(
    "  loadTex(0, IMG.base, true); loadTex(1, IMG.closed); loadTex(2, IMG.doze);",
    early_worn
    + "  loadTex(0, IMG.base, true); loadTex(1, IMG.closed); loadTex(2, IMG.doze);\n"
    + set_init
    + extra_loaders,
)

t = t.replace(
    "    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);\n    const air = clamp(-p.hopY / 70, 0, 1);",
    "    if (ready < 3) return;\n    rebindBodyTex();\n"
    "    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aUv);\n"
    "    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aPos);\n"
    "    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);\n"
    "    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);\n"
    "    const air = clamp(-p.hopY / 70, 0, 1);",
)

hit_patch_old = """  function hit(ev) {
    const s = toSrc(ev), lx = Math.floor(s.x - TEX.x0), ly = Math.floor(s.y - TEX.y0);
    if (lx < 0 || ly < 0 || lx >= TEX.w || ly >= TEX.h || ready < 3) return null;
    if (hitCtx.getImageData(lx, ly, 1, 1).data[3] < 40) return null;
    const hd = Math.pow((s.x - HEAD.x) / HEAD.rx, 2) + Math.pow((s.y - HEAD.y) / HEAD.ry, 2);
    return { face: hd <= 1 || s.y < 560, x: s.x, stageX: s.stageX };
  }"""
hit_patch_new = """  function hit(ev) {
    const s = toSrc(ev), lx = Math.floor(s.x - TEX.x0), ly = Math.floor(s.y - TEX.y0);
    if (lx < 0 || ly < 0 || lx >= TEX.w || ly >= TEX.h || ready < 3) return null;
    if (hitCtx.getImageData(lx, ly, 1, 1).data[3] < 40) return null;
    const hd = Math.pow((s.x - HEAD.x) / HEAD.rx, 2) + Math.pow((s.y - HEAD.y) / HEAD.ry, 2);
    return { face: hd <= 1 || s.y < NECK.y, x: s.x, stageX: s.stageX };
  }"""
t = t.replace(hit_patch_old, hit_patch_new)

dress_js = r"""
  /* ---------- dress-up (sets only) ---------- */
  const MINI_MS = 620;
  function syncWearUI() {
    ITEMS.forEach(function (it) {
      const card = document.querySelector('.card[data-id="' + it.id + '"]');
      if (!card) return;
      card.classList.toggle("selected", worn.set === it.id);
    });
    if (ready >= 3) render(lastPose);
  }
  function wearItem(id, hop) {
    const it = ITEMS.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    if (worn.set === id) { worn.set = null; syncWearUI(); return; }
    worn.set = id;
    syncWearUI();
    if (hop !== false && (mode === "idle" || mode === "pet-release")) begin("minihop", performance.now());
  }
  function wearSet(id, hop) { wearItem(id, hop); }
  document.querySelectorAll("#grid .card").forEach(function (card) {
    const id = card.getAttribute("data-id");
    const it = ITEMS.filter(function (x) { return x.id === id; })[0];
    const img = card.querySelector("img");
    if (it && img) img.src = it.thumb;
  });
  const sheet = document.getElementById("sheet");
  // Only stopPropagation (never preventDefault) so mobile browsers synthesize click cleanly
  ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(function (tp) {
    sheet.addEventListener(tp, function (ev) { ev.stopPropagation(); }, true);
  });
  sheet.addEventListener("click", function (ev) {
    const card = ev.target.closest(".card"); if (!card) return;
    ev.stopPropagation();
    wearItem(card.getAttribute("data-id"), true);
  });
  function minihop(u) {
    const kfs = [
      { o: 0, e: "in", hopY: 0, sx: 1, sy: 1, shS: 1, shO: 1 },
      { o: 0.18, e: "out", hopY: 4, sx: 1.08, sy: 0.9, shS: 1.12, shO: 0.9 },
      { o: 0.4, e: "out", hopY: -28, sx: 0.96, sy: 1.06, earL: -10, earR: 10, shS: 0.6, shO: 0.4 },
      { o: 0.78, e: "back", hopY: 3, sx: 1.08, sy: 0.9, shS: 1.12, shO: 0.85 },
      { o: 1, e: "out", hopY: 0, sx: 1, sy: 1, shS: 1, shO: 1 }
    ];
    return kf(kfs, u);
  }

"""
t = t.replace(
    '  fitStage(); addEventListener("resize", fitStage);\n  requestAnimationFrame(tick);',
    '  fitStage(); addEventListener("resize", fitStage);\n' + dress_js + "  requestAnimationFrame(tick);",
)

tick_old = """    else if (mode === "pet-release") { if (t >= PET_RELEASE_MS) toIdle(now); else { const u = t / PET_RELEASE_MS; const p = mix(pet(petLean, 0), idle(0, 0), easeInOut(u)); p.wClosed = u < 0.4 ? 1 : 1 - easeOutCubic((u - 0.4) / 0.6); render(p, now); } }"""
tick_new = (
    tick_old
    + '\n    else if (mode === "minihop") { if (t >= MINI_MS) toIdle(now); else render(minihop(t / MINI_MS), now); }'
)
if tick_old not in t:
    raise SystemExit("tick pattern not found")
t = t.replace(tick_old, tick_new)

demo_old = """  window.__demo = {
    timeline: TL, jumpMs: JUMP_MS, mode: function () { return mode; },
    seek: function (ms) { live = false; render(poseAt(ms), ms); return ms; },
    live: function () { live = true; toIdle(performance.now()); },
    setSleepDelay: function (ms) { sleepDelay = ms; sleepAt = performance.now() + ms; }
  };"""
demo_new = """  window.__demo = {
    timeline: TL, jumpMs: JUMP_MS, mode: function () { return mode; },
    seek: function (ms) { live = false; render(poseAt(ms), ms); return ms; },
    live: function () { live = true; toIdle(performance.now()); },
    setSleepDelay: function (ms) { sleepDelay = ms; sleepAt = performance.now() + ms; },
    wear: function (id, hop) { live = true; wearItem(id, hop !== false); },
    wearSet: function (id, hop) { live = true; wearSet(id, hop !== false); },
    worn: function () { return { set: worn.set }; }
  };"""
if demo_old not in t:
    raise SystemExit("demo api pattern not found")
t = t.replace(demo_old, demo_new)

t = t.replace("锦鲤 BOON KOI 网格换装 Demo", "锦鲤 BOON KOI · 套装弹性透明换装 Demo")

bg = (W.parents[2] / "assets/shared/room_bg.jpg").read_bytes()
rep = {
    "TEX": json.dumps(TEX),
    "S": str(S),
    "OX": str(round(OX, 3)),
    "OY": str(round(OY, 3)),
    "TEX_BASE": uri_path(SETS / "tex_base_ext.png"),
    "TEX_CLOSED": uri_path(SETS / "tex_closed_ext.png"),
    "TEX_DOZE": uri_path(SETS / "tex_doze_ext.png"),
    "EYES_CLOSED": uri_path(SETS / "eyes_closed.png"),
    "EYES_DOZE": uri_path(SETS / "eyes_doze.png"),
    "BG": "data:image/jpeg;base64," + base64.b64encode(bg).decode(),
    "SH_SOFT_X": f"{FEET[0] + 12}",
    "SH_SOFT_Y": f"{FEET[1] - 5}",
    "SH_CON_X": f"{FEET[0] + 3}",
    "SH_CON_Y": f"{FEET[1] + 1}",
    "ITEMS": json.dumps(items, ensure_ascii=False),
    "FEET_Y": str(ext_lm["feetY"]),
    "CX": str(ext_lm["cx"]),
    "NECK": json.dumps(ext_lm["neck"]),
    "HEAD": json.dumps(ext_lm["head"]),
    "EAR_L": json.dumps(ext_lm["earL"]),
    "EAR_R": json.dumps(ext_lm["earR"]),
    "EYE_L_UV": json.dumps([
        round(ext_lm["eyeL"]["x"] / 1024.0, 6),
        round(ext_lm["eyeL"]["y"] / 2048.0, 6),
        round(ext_lm["eyeL"]["rx"] / 1024.0, 6),
        round(ext_lm["eyeL"]["ry"] / 2048.0, 6),
    ]),
    "EYE_R_UV": json.dumps([
        round(ext_lm["eyeR"]["x"] / 1024.0, 6),
        round(ext_lm["eyeR"]["y"] / 2048.0, 6),
        round(ext_lm["eyeR"]["rx"] / 1024.0, 6),
        round(ext_lm["eyeR"]["ry"] / 2048.0, 6),
    ]),
    "BODY_Y": str(ext_lm["bodyY"]),
    "SHEET_HTML": sheet,
}
for k, v in rep.items():
    t = t.replace(f"%%{k}%%", v)
if "%%" in t:
    leftover = [s for s in t.split("%%")[1::2][:8]]
    raise SystemExit("leftover placeholders: " + str(leftover))

out = OUT / "koi_mesh_demo.html"
out.write_text(t, encoding="utf-8")
print("wrote", out, out.stat().st_size, "bytes | items:", len(items), "| TEX:", TEX)
