#!/usr/bin/env python3
"""Build official v2b KOI mesh demo with full-body elastic transparent sets
(mushroom, baker, astronaut translucent helmet, lion dance) + shared eye
expression overlays + existing accessories and tab switcher.
"""
import base64
import io
import json
from pathlib import Path
from PIL import Image

W = Path(__file__).resolve().parent
OUT = W.parent
EX = W / "dress" / "extract"
SETS = W / "sets"

meta = json.loads((EX / "meta.json").read_text())
sets_meta = json.loads((SETS / "sets_meta.json").read_text())
ext_lm = json.loads((SETS / "landmarks_ext.json").read_text())

BASE_DX = int(ext_lm["baseDx"])
BASE_DY = int(ext_lm["baseDy"])
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


ACC_LABELS = {
    "boots_yellow": ("小黄雨靴", 20),
    "boots_mint": ("薄荷雨靴", 20),
    "kasa": ("竹编斗笠", 20),
    "crown": ("小皇冠", 20),
    "bow": ("蝴蝶结", 20),
    "scarf": ("小围巾", 20),
    "omamori": ("好运御守", 20),
    "goldfish": ("小金鱼灯", 20),
}

items = []
# 1. Full-body sets (tab="set")
for s in sets_meta:
    items.append(
        dict(
            id=s["id"],
            slot="set",
            tab="set",
            name=s["name"],
            desc=s["desc"],
            price=s["price"],
            tex=uri_path(W / s["tex"]),
            thumb=uri_path(W / s["thumb"]),
        )
    )

# 2. Existing accessories (tab="acc"), shifted by (BASE_DX, BASE_DY) into expanded canvas
for it in meta:
    label, price = ACC_LABELS.get(it["id"], (it["id"], 20))
    items.append(
        dict(
            id=it["id"],
            slot=it["slot"],
            tab="acc",
            name=label,
            desc="",
            price=price,
            x=it["x"] + BASE_DX,
            y=it["y"] + BASE_DY,
            w=it["w"],
            h=it["h"],
            acc=uri_path(EX / f"acc_{it['id']}.png"),
            thumb=uri_path(EX / f"thumb_{it['id']}.png"),
        )
    )

cards = []
for it in items:
    hidden_cls = " hidden" if it["tab"] != "set" else ""
    cards.append(
        f'<button class="card{hidden_cls}" type="button" data-id="{it["id"]}" data-slot="{it["slot"]}" data-tab="{it["tab"]}">'
        f'<div class="thumb-wrap"><img alt="{it["name"]}"></div>'
        f'<div class="card-name">{it["name"]}</div>'
        f'<div class="card-price">★ {it["price"]}</div>'
        f'<span class="badge"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.2l2.6 2.6L10 3.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
        f"</button>"
    )

sheet = (
    '<div id="sheet">'
    '<div class="handle"></div>'
    '<div class="tabs">'
    f'<button type="button" class="tab active" data-tab="set">套装 ({len(sets_meta)})</button>'
    f'<button type="button" class="tab" data-tab="acc">配饰 ({len(meta)})</button>'
    "</div>"
    '<div id="grid">' + "".join(cards) + "</div>"
    "</div>"
)

css = r"""
  #sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 410px; z-index: 10; background: #fbf4ea; border-radius: 24px 24px 0 0; box-shadow: 0 -8px 26px rgba(80,50,20,.14); padding: 8px 14px calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
  #sheet .handle { width: 38px; height: 4px; background: #e4d3bf; border-radius: 99px; margin: 2px auto 8px; flex-shrink: 0; }
  .tabs { display: flex; gap: 8px; margin-bottom: 10px; flex-shrink: 0; }
  .tab { flex: 1; padding: 6px 10px; border-radius: 999px; border: 1.5px solid #e6d5c1; background: #fffdf9; color: #7a634d; font: 600 12px/1.2 system-ui, sans-serif; cursor: pointer; }
  .tab.active { background: #c9955a; border-color: #c9955a; color: #fff; }
  #grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: max-content; align-content: start; gap: 9px 8px; overflow-y: auto; overscroll-behavior: contain; padding: 2px 1px 18px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  #grid::-webkit-scrollbar { display: none; }
  .card { position: relative; background: #fffdf9; border-radius: 14px; border: 2px solid rgba(201,149,90,0); box-shadow: 0 1px 3px rgba(80,50,20,.08); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 7px 4px 6px; cursor: pointer; appearance: none; -webkit-appearance: none; }
  .card.hidden { display: none; }
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
    '  const IMG = { base: "%%TEX_BASE%%", closed: "%%TEX_CLOSED%%", doze: "%%TEX_DOZE%%", bootsMint: "%%TEX_BOOTS_MINT%%", eyesClosed: "%%EYES_CLOSED%%", eyesDoze: "%%EYES_DOZE%%" };\n  const ITEMS = %%ITEMS%%;',
)

acc_init = r"""
  /* ---------- accessory program (simple textured mesh) ---------- */
  const vsA = vs;
  const fsA = "precision mediump float; varying vec2 vUv; uniform sampler2D t0; void main(){ gl_FragColor = texture2D(t0, vUv); }";
  const progA = gl.createProgram();
  gl.attachShader(progA, sh(gl.VERTEX_SHADER, vsA)); gl.attachShader(progA, sh(gl.FRAGMENT_SHADER, fsA));
  gl.linkProgram(progA);
  const aPosA = gl.getAttribLocation(progA, "aPos"), aUvA = gl.getAttribLocation(progA, "aUv");
  const uT0A = gl.getUniformLocation(progA, "t0");
  const ACC_COLS = 12, ACC_ROWS = 12;
  const accItems = {};
  const setTextures = {};
  let accReady = 0;
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
  function makeAccGrid(it) {
    const nv = (ACC_COLS + 1) * (ACC_ROWS + 1);
    const rest = new Float32Array(nv * 2), uv = new Float32Array(nv * 2), pos = new Float32Array(nv * 2);
    for (let r = 0, i = 0; r <= ACC_ROWS; r++) for (let c = 0; c <= ACC_COLS; c++, i++) {
      const u = c / ACC_COLS, v = r / ACC_ROWS;
      rest[i * 2] = it.x + u * it.w; rest[i * 2 + 1] = it.y + v * it.h;
      uv[i * 2] = u; uv[i * 2 + 1] = v;
    }
    const idx = [];
    for (let r = 0; r < ACC_ROWS; r++) for (let c = 0; c < ACC_COLS; c++) {
      const a = r * (ACC_COLS + 1) + c, b = a + 1, d = a + ACC_COLS + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const uvBuf = gl.createBuffer(), posBuf = gl.createBuffer(), idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return { rest: rest, uv: uv, pos: pos, nv: nv, idx: idx, uvBuf: uvBuf, posBuf: posBuf, idxBuf: idxBuf, tex: null, hit: null };
  }
  ITEMS.forEach(function (it) {
    if (it.slot === "set") {
      const img = new Image();
      img.onload = function () {
        setTextures[it.id] = makePotTexture(img);
        if (worn.set === it.id && ready >= 3) render(lastPose);
      };
      img.src = it.tex;
      return;
    }
    const rec = makeAccGrid(it);
    rec.slot = it.slot; rec.id = it.id; rec.x = it.x; rec.y = it.y; rec.w = it.w; rec.h = it.h;
    accItems[it.id] = rec;
    const img = new Image();
    img.onload = function () {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      rec.tex = t;
      const hc = document.createElement("canvas"); hc.width = img.naturalWidth; hc.height = img.naturalHeight;
      const hctx = hc.getContext("2d", { willReadFrequently: true });
      hctx.drawImage(img, 0, 0);
      rec.hit = hctx; rec.hitW = hc.width; rec.hitH = hc.height;
      accReady += 1;
    };
    img.src = it.acc;
  });
"""

early_worn = r"""
  const worn = { set: null, head: null, neck: null, dorsal: null, hand: null, boots: "boots_yellow" };
  let texBodyDefault = null, texBodyMint = null, texClosed = null, texDoze = null;
  let texEyesClosed = null, texEyesDoze = null;
  function rebindBodyTex() {
    gl.useProgram(prog);
    const t0 = (worn.set && setTextures[worn.set])
      ? setTextures[worn.set]
      : ((worn.boots === "boots_mint" && texBodyMint) ? texBodyMint : texBodyDefault);
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
    loadPot(IMG.bootsMint, function (t) { texBodyMint = t; });
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
    + acc_init
    + extra_loaders,
)

deform_acc = r"""
  function deformAcc(x, y, p, slot) {
    const bodyOnly = slot === "neck" || slot === "dorsal" || slot === "hand" || slot === "boots";
    const p2 = bodyOnly ? { sx: p.sx, sy: p.sy, breath: p.breath, headRot: 0, headTx: 0, headTy: 0, lean: p.lean } : p;
    return deform(x, y, p2, 0, 0);
  }
  function accStage(x, y, p, slot, cr, sr) {
    const d = deformAcc(x, y, p, slot);
    const dx = d[0] - CX, dy = d[1] - FEET_Y;
    const rx = CX + dx * cr - dy * sr, ry = FEET_Y + dx * sr + dy * cr;
    return [OX + rx * S, OY + ry * S + p.hopY];
  }

"""
t = t.replace(
    "    return [x, y];\n  }\n\n  let lastPose = P({});",
    "    return [x, y];\n  }\n" + deform_acc + "  let lastPose = P({});",
)

draw_acc = r"""
    // accessories (skipped when wearing a full-body set): dorsal -> neck -> hand -> head
    function drawAcc(rec) {
      if (!rec || !rec.tex) return;
      const crA = cr, srA = sr;
      for (let i = 0; i < rec.nv; i++) {
        const st = accStage(rec.rest[i * 2], rec.rest[i * 2 + 1], p, rec.slot, crA, srA);
        rec.pos[i * 2] = st[0]; rec.pos[i * 2 + 1] = st[1];
      }
      gl.useProgram(progA);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rec.tex);
      gl.uniform1i(uT0A, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, rec.uvBuf); gl.vertexAttribPointer(aUvA, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aUvA);
      gl.bindBuffer(gl.ARRAY_BUFFER, rec.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, rec.pos);
      gl.vertexAttribPointer(aPosA, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aPosA);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rec.idxBuf);
      gl.drawElements(gl.TRIANGLES, rec.idx.length, gl.UNSIGNED_SHORT, 0);
    }
    if (typeof worn !== "undefined" && !worn.set) {
      ["dorsal", "neck", "hand", "head"].forEach(function (sl) { if (worn[sl]) drawAcc(accItems[worn[sl]]); });
    }
"""
t = t.replace(
    "    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);\n    const air = clamp(-p.hopY / 70, 0, 1);",
    "    if (ready < 3) return;\n    rebindBodyTex();\n"
    "    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aUv);\n"
    "    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aPos);\n"
    "    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);\n"
    "    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);\n"
    + draw_acc
    + "    const air = clamp(-p.hopY / 70, 0, 1);",
)

hit_patch_old = """  function hit(ev) {
    const s = toSrc(ev), lx = Math.floor(s.x - TEX.x0), ly = Math.floor(s.y - TEX.y0);
    if (lx < 0 || ly < 0 || lx >= TEX.w || ly >= TEX.h || ready < 3) return null;
    if (hitCtx.getImageData(lx, ly, 1, 1).data[3] < 40) return null;
    const hd = Math.pow((s.x - HEAD.x) / HEAD.rx, 2) + Math.pow((s.y - HEAD.y) / HEAD.ry, 2);
    return { face: hd <= 1 || s.y < 560, x: s.x, stageX: s.stageX };
  }"""
hit_patch_new = """  function hitAcc(srcX, srcY) {
    if (worn && worn.set) return false;
    const ids = worn ? ["dorsal", "neck", "hand", "head"].map(function (s) { return worn[s]; }) : [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]; if (!id) continue;
      const rec = accItems[id]; if (!rec || !rec.hit) continue;
      if (srcX < rec.x || srcY < rec.y || srcX >= rec.x + rec.w || srcY >= rec.y + rec.h) continue;
      const u = (srcX - rec.x) / rec.w * rec.hitW, v = (srcY - rec.y) / rec.h * rec.hitH;
      if (rec.hit.getImageData(Math.floor(u), Math.floor(v), 1, 1).data[3] > 60) return true;
    }
    return false;
  }
  function hit(ev) {
    const s = toSrc(ev), lx = Math.floor(s.x - TEX.x0), ly = Math.floor(s.y - TEX.y0);
    if (ready < 3) return null;
    let body = false;
    if (lx >= 0 && ly >= 0 && lx < TEX.w && ly < TEX.h) body = hitCtx.getImageData(lx, ly, 1, 1).data[3] >= 40;
    if (!body && !hitAcc(s.x, s.y)) return null;
    const hd = Math.pow((s.x - HEAD.x) / HEAD.rx, 2) + Math.pow((s.y - HEAD.y) / HEAD.ry, 2);
    return { face: hd <= 1 || s.y < NECK.y, x: s.x, stageX: s.stageX };
  }"""
t = t.replace(hit_patch_old, hit_patch_new)

dress_js = r"""
  /* ---------- dress-up ---------- */
  const MINI_MS = 620;
  function syncWearUI() {
    ITEMS.forEach(function (it) {
      const card = document.querySelector('.card[data-id="' + it.id + '"]');
      if (!card) return;
      const on = it.slot === "set" ? worn.set === it.id : (!worn.set && (it.slot === "boots" ? worn.boots === it.id : worn[it.slot] === it.id));
      card.classList.toggle("selected", on);
    });
    if (ready >= 3) render(lastPose);
  }
  function wearItem(id, hop) {
    const it = ITEMS.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    if (it.slot === "set") {
      if (worn.set === id) { worn.set = null; syncWearUI(); return; }
      worn.set = id;
      worn.head = worn.neck = worn.dorsal = worn.hand = null;
      syncWearUI();
      if (hop !== false && (mode === "idle" || mode === "pet-release")) begin("minihop", performance.now());
      return;
    }
    // Equipping any single accessory clears active full-body set
    if (worn.set) worn.set = null;
    if (it.slot === "boots") {
      if (worn.boots === id) { worn.boots = "boots_yellow"; syncWearUI(); return; }
      worn.boots = id; syncWearUI();
      if (hop !== false && (mode === "idle" || mode === "pet-release")) begin("minihop", performance.now());
      return;
    }
    if (worn[it.slot] === id) { worn[it.slot] = null; syncWearUI(); return; }
    worn[it.slot] = id; syncWearUI();
    if (hop !== false && (mode === "idle" || mode === "pet-release")) {
      begin("minihop", performance.now());
    }
  }
  function setWorn(head, neck) { worn.set = null; worn.head = head || null; worn.neck = neck || null; syncWearUI(); }
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
    const tab = ev.target.closest(".tab");
    if (tab) {
      const targetTab = tab.getAttribute("data-tab");
      document.querySelectorAll("#sheet .tab").forEach(function (b) { b.classList.toggle("active", b === tab); });
      document.querySelectorAll("#grid .card").forEach(function (c) { c.classList.toggle("hidden", c.getAttribute("data-tab") !== targetTab); });
      return;
    }
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
    setWorn: setWorn,
    worn: function () { return { set: worn.set, head: worn.head, neck: worn.neck, boots: worn.boots }; }
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
    "TEX_BOOTS_MINT": uri_path(SETS / "tex_boots_mint_ext.png"),
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
