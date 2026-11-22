#!/usr/bin/env python3
"""Build official v2b mesh demo with 4 chroma-key full sets + 8 modular accessories."""
import base64
import io
import json
from pathlib import Path
from PIL import Image

W = Path(__file__).resolve().parent
OUT = W.parent
ASSETS = OUT.parent
EX = W / 'dress' / 'extract'
SETS_DIR = W / 'sets'

meta = json.loads((EX / 'meta.json').read_text(encoding='utf-8'))
sets_meta = json.loads((SETS_DIR / 'sets_meta.json').read_text(encoding='utf-8')) if (SETS_DIR / 'sets_meta.json').exists() else []

PAD_X, PAD_Y = 120, 30
base_exp = Image.open(SETS_DIR / 'tex_base_exp.png').convert('RGBA')
EW, EH = base_exp.size

# Compute union tight bbox across base_exp + all full sets so props/hats/glass dome never clip
ux0, uy0, ux1, uy1 = EW, EH, 0, 0
bbox_sources = [SETS_DIR / 'tex_base_exp.png'] + [SETS_DIR / f"set_{s['id']}.png" for s in sets_meta]
for p in bbox_sources:
    im = Image.open(p).convert('RGBA')
    a = im.split()[3].point(lambda v: 255 if v > 8 else 0)
    bb = a.getbbox()
    if bb:
        ux0 = min(ux0, bb[0])
        uy0 = min(uy0, bb[1])
        ux1 = max(ux1, bb[2])
        uy1 = max(uy1, bb[3])

ux0, uy0 = max(0, ux0 - 8), max(0, uy0 - 8)
ux1, uy1 = min(EW, ux1 + 8), min(EH, uy1 + 8)
assert (ux1 - ux0) <= 1024 and (uy1 - uy0) <= 2048, f"Union bbox exceeds POT 1024x2048: {(ux1-ux0, uy1-uy0)}"

# TEX is expressed in original tex_base (600x1119) coordinate space so all landmarks & modular accessories stay aligned!
TEX = dict(x0=ux0 - PAD_X, y0=uy0 - PAD_Y, w=ux1 - ux0, h=uy1 - uy0)
S = 0.35
FEET = (195.0, 656.0)
FOOT_SRC = (301.0, 1105.0)
OX = FEET[0] - FOOT_SRC[0] * S
OY = FEET[1] - FOOT_SRC[1] * S


def uri_img(im, fmt='WEBP', **kw):
    buf = io.BytesIO()
    if fmt == 'WEBP':
        im.save(buf, 'WEBP', quality=92, method=6, alpha_quality=100)
        mime = 'image/webp'
    else:
        im.save(buf, fmt, **kw)
        mime = 'image/png' if fmt == 'PNG' else 'image/jpeg'
    return 'data:' + mime + ';base64,' + base64.b64encode(buf.getvalue()).decode()


def uri_path(p, crop=None):
    im = Image.open(p)
    if crop:
        im = im.crop(crop)
    if im.mode != 'RGBA' and Path(p).suffix.lower() == '.png':
        im = im.convert('RGBA')
    return uri_img(im)


def uri_tex_exp(p):
    im = Image.open(p).convert('RGBA').crop((ux0, uy0, ux1, uy1))
    return uri_img(im)


items = []
for it in meta:
    rec = dict(
        id=it['id'],
        slot=it['slot'],
        x=it['x'],
        y=it['y'],
        w=it['w'],
        h=it['h'],
        acc=uri_path(EX / f"acc_{it['id']}.png"),
        thumb=uri_path(EX / f"thumb_{it['id']}.png"),
    )
    items.append(rec)

sets_data = []
for s in sets_meta:
    sid = s['id']
    sets_data.append(
        dict(
            id=sid,
            name=s['name'],
            base=uri_tex_exp(SETS_DIR / f'set_{sid}.png'),
            closed=uri_tex_exp(SETS_DIR / f'set_{sid}_closed.png'),
            doze=uri_tex_exp(SETS_DIR / f'set_{sid}_doze.png'),
            thumb=uri_path(SETS_DIR / f'thumb_set_{sid}.png'),
        )
    )

check_svg = (
    '<span class="badge"><svg viewBox="0 0 12 12" aria-hidden="true">'
    '<path d="M2 6.2l2.6 2.6L10 3.4" fill="none" stroke="#fff" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
)

set_cards = []
for s in sets_data:
    set_cards.append(
        f'<button class="card set-card" type="button" data-set="{s["id"]}">'
        f'<img alt="{s["name"]}">'
        f'<span class="label">{s["name"]}</span>'
        f'{check_svg}</button>'
    )

acc_cards = []
for it in items:
    acc_cards.append(
        f'<button class="card acc-card" type="button" data-id="{it["id"]}" data-slot="{it["slot"]}">'
        f'<img alt="">'
        f'{check_svg}</button>'
    )

sheet = (
    '<div id="sheet">'
    '<div class="handle"></div>'
    '<div class="tabs">'
    '<button type="button" class="tab active" data-tab="sets">主题套装</button>'
    '<button type="button" class="tab" data-tab="acc">单品配饰</button>'
    '<button type="button" class="tab-reset" id="btn-reset">卸下</button>'
    '</div>'
    '<div id="grid-sets" class="grid active">' + ''.join(set_cards) + '</div>'
    '<div id="grid-acc" class="grid">' + ''.join(acc_cards) + '</div>'
    '</div>'
)

css = r'''
  #shadow-soft, #shadow-contact { mix-blend-mode: multiply; }
  #shadow-soft { width: 178px; height: 48px; }
  #shadow-contact { width: 126px; height: 17px; }
  #sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; background: #fbf4ea; border-radius: 28px 28px 0 0; box-shadow: 0 -10px 30px rgba(80,50,20,.14); padding: 8px 14px 18px; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  #sheet .handle { width: 40px; height: 4px; background: #e4d3bf; border-radius: 99px; margin: 2px auto 8px; }
  .tabs { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
  .tab { border: 1.5px solid rgba(201,149,90,.28); background: #fffdf9; color: #7a624c; border-radius: 999px; padding: 4px 12px; font: 600 12px/1.2 system-ui, sans-serif; cursor: pointer; }
  .tab.active { background: #c9955a; border-color: #c9955a; color: #fff; }
  .tab-reset { margin-left: auto; border: 1px solid rgba(138,108,80,.25); background: transparent; color: #8a6c50; border-radius: 999px; padding: 4px 10px; font: 500 11px/1.2 system-ui, sans-serif; cursor: pointer; }
  .grid { display: none; grid-template-columns: repeat(4, 1fr); gap: 9px; }
  .grid.active { display: grid; }
  .card { position: relative; aspect-ratio: 1; background: #fffdf9; border-radius: 16px; border: 2px solid rgba(201,149,90,0); box-shadow: 0 1px 3px rgba(80,50,20,.07); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; cursor: pointer; appearance: none; -webkit-appearance: none; overflow: hidden; }
  .card img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; user-select: none; -webkit-user-drag: none; }
  .set-card { padding: 4px 4px 18px; }
  .set-card .label { position: absolute; left: 0; right: 0; bottom: 3px; text-align: center; font: 600 10px/1.1 system-ui, sans-serif; color: #6c533c; pointer-events: none; }
  .card.selected { border-color: #c9955a; box-shadow: 0 0 0 1.5px #c9955a, 0 1px 3px rgba(80,50,20,.07); }
  .card .badge { display: none; position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; border-radius: 50%; background: #c9955a; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,.15); }
  .card.selected .badge { display: flex; }
  .card .badge svg { display: block; width: 11px; height: 11px; }
'''

t = (W / 'template.html').read_text(encoding='utf-8')
t = t.replace(
    '  .zz { position: absolute; left: 0; top: 0; font: 700 15px/1 sans-serif; color: #8a7a68; opacity: 0; pointer-events: none; z-index: 3; }\n</style>',
    '  .zz { position: absolute; left: 0; top: 0; font: 700 15px/1 sans-serif; color: #8a7a68; opacity: 0; pointer-events: none; z-index: 3; }\n'
    + css
    + '</style>',
)
t = t.replace(
    '  <canvas id="gl"></canvas>\n</div></div>',
    '  <canvas id="gl"></canvas>\n%%SHEET_HTML%%\n</div></div>',
)
t = t.replace(
    '  const IMG = { base: "%%TEX_BASE%%", closed: "%%TEX_CLOSED%%", doze: "%%TEX_DOZE%%" };',
    '  const IMG = { base: "%%TEX_BASE%%", closed: "%%TEX_CLOSED%%", doze: "%%TEX_DOZE%%" };\n'
    '  const ITEMS = %%ITEMS%%;\n'
    '  const SETS = %%SETS%%;',
)

# Upgrade texture loader to store per-outfit WebGL texture triplets + hit canvases
old_load = r'''  let ready = 0; const hitCanvas = document.createElement("canvas");
  hitCanvas.width = TEX.w; hitCanvas.height = TEX.h;
  const hitCtx = hitCanvas.getContext("2d", { willReadFrequently: true });
  function loadTex(unit, src, isBase) {
    const img = new Image();
    img.onload = function () {
      const c = document.createElement("canvas"); c.width = POT_W; c.height = POT_H;
      c.getContext("2d").drawImage(img, 0, 0);
      if (isBase) hitCtx.drawImage(img, 0, 0);
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(prog, "t" + unit), unit);
      ready += 1; if (ready === 3) { window.__ready = true; render(lastPose); }
    };
    img.src = src;
  }
  loadTex(0, IMG.base, true); loadTex(1, IMG.closed); loadTex(2, IMG.doze);'''

new_load = r'''  let ready = 0;
  const hitCanvas = document.createElement("canvas");
  hitCanvas.width = TEX.w; hitCanvas.height = TEX.h;
  const hitCtx = hitCanvas.getContext("2d", { willReadFrequently: true });
  const bodySets = { default: { tex: [null, null, null], imgBase: null, loaded: 0 } };
  let activeSet = "default";

  function uploadPotTex(img) {
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

  function bindBodySet(id) {
    const entry = bodySets[id] || bodySets.default;
    if (!entry || entry.loaded < 3) return false;
    gl.useProgram(prog);
    for (let u = 0; u < 3; u++) {
      gl.activeTexture(gl.TEXTURE0 + u);
      gl.bindTexture(gl.TEXTURE_2D, entry.tex[u]);
      gl.uniform1i(gl.getUniformLocation(prog, "t" + u), u);
    }
    if (entry.imgBase) {
      hitCtx.clearRect(0, 0, TEX.w, TEX.h);
      hitCtx.drawImage(entry.imgBase, 0, 0);
    }
    return true;
  }

  function loadBodyTriplet(id, srcs, isDefault) {
    const entry = bodySets[id] || (bodySets[id] = { tex: [null, null, null], imgBase: null, loaded: 0 });
    srcs.forEach(function (src, unit) {
      const img = new Image();
      img.onload = function () {
        entry.tex[unit] = uploadPotTex(img);
        if (unit === 0) entry.imgBase = img;
        entry.loaded += 1;
        if (isDefault) {
          ready += 1;
          if (ready === 3) {
            bindBodySet(activeSet);
            window.__ready = true;
            render(lastPose);
          }
        } else if (entry.loaded === 3 && activeSet === id) {
          bindBodySet(id);
          if (ready >= 3) render(lastPose);
        }
      };
      img.src = src;
    });
  }

  loadBodyTriplet("default", [IMG.base, IMG.closed, IMG.doze], true);
  SETS.forEach(function (s) {
    loadBodyTriplet(s.id, [s.base, s.closed, s.doze], false);
  });

  /* ---------- accessory program (simple textured mesh) ---------- */
  const vsA = vs;
  const fsA = "precision mediump float; varying vec2 vUv; uniform sampler2D t0; void main(){ gl_FragColor = texture2D(t0, vUv); }";
  const progA = gl.createProgram();
  gl.attachShader(progA, sh(gl.VERTEX_SHADER, vsA)); gl.attachShader(progA, sh(gl.FRAGMENT_SHADER, fsA));
  gl.linkProgram(progA);
  const aPosA = gl.getAttribLocation(progA, "aPos"), aUvA = gl.getAttribLocation(progA, "aUv");
  const ACC_COLS = 12, ACC_ROWS = 12;
  const accItems = {};
  let accReady = 0;
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
  });'''

if old_load not in t:
    raise SystemExit('loadTex block not found')
t = t.replace(old_load, new_load)

deform_acc = r'''
  function deformAcc(x, y, p, slot) {
    const p2 = slot === "neck" ? { sx: p.sx, sy: p.sy, breath: p.breath, headRot: 0, headTx: 0, headTy: 0, lean: p.lean } : p;
    return deform(x, y, p2, 0, 0);
  }
  function accStage(x, y, p, slot, cr, sr) {
    const d = deformAcc(x, y, p, slot);
    const dx = d[0] - CX, dy = d[1] - FEET_Y;
    const rx = CX + dx * cr - dy * sr, ry = FEET_Y + dx * sr + dy * cr;
    return [OX + rx * S, OY + ry * S + p.hopY];
  }

'''
t = t.replace('    return [x, y];\n  }\n\n  let lastPose = P({});', '    return [x, y];\n  }\n' + deform_acc + '  let lastPose = P({});')

# Ensure body textures are bound before body draw, and accessories drawn after
render_body_old = '    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);\n    gl.uniform1f(uW1, clamp(p.wClosed, 0, 1)); gl.uniform1f(uW2, clamp(p.wDoze, 0, 1 - clamp(p.wClosed, 0, 1)));\n    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);'
render_body_new = r'''    gl.useProgram(prog);
    const curSet = bodySets[activeSet] && bodySets[activeSet].loaded >= 3 ? bodySets[activeSet] : bodySets.default;
    for (let u = 0; u < 3; u++) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, curSet.tex[u]); gl.uniform1i(gl.getUniformLocation(prog, "t" + u), u); }
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    gl.uniform1f(uW1, clamp(p.wClosed, 0, 1)); gl.uniform1f(uW2, clamp(p.wDoze, 0, 1 - clamp(p.wClosed, 0, 1)));
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    // accessories: scarf (body only) under hats (head follow)
    function drawAcc(rec) {
      if (!rec || !rec.tex) return;
      const crA = cr, srA = sr;
      for (let i = 0; i < rec.nv; i++) {
        const st = accStage(rec.rest[i * 2], rec.rest[i * 2 + 1], p, rec.slot, crA, srA);
        rec.pos[i * 2] = st[0]; rec.pos[i * 2 + 1] = st[1];
      }
      gl.useProgram(progA);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rec.tex);
      gl.uniform1i(gl.getUniformLocation(progA, "t0"), 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, rec.uvBuf); gl.vertexAttribPointer(aUvA, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aUvA);
      gl.bindBuffer(gl.ARRAY_BUFFER, rec.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, rec.pos);
      gl.vertexAttribPointer(aPosA, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aPosA);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rec.idxBuf);
      gl.drawElements(gl.TRIANGLES, rec.idx.length, gl.UNSIGNED_SHORT, 0);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aUv);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aPos);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    }
    if (typeof worn !== "undefined") {
      if (worn.neck) drawAcc(accItems[worn.neck]);
      if (worn.head) drawAcc(accItems[worn.head]);
    }'''

if render_body_old not in t:
    raise SystemExit('render_body_old not found')
t = t.replace(render_body_old, render_body_new)

hit_patch_old = '''  function hit(ev) {
    const s = toSrc(ev), lx = Math.floor(s.x - TEX.x0), ly = Math.floor(s.y - TEX.y0);
    if (lx < 0 || ly < 0 || lx >= TEX.w || ly >= TEX.h || ready < 3) return null;
    if (hitCtx.getImageData(lx, ly, 1, 1).data[3] < 40) return null;
    const hd = Math.pow((s.x - HEAD.x) / HEAD.rx, 2) + Math.pow((s.y - HEAD.y) / HEAD.ry, 2);
    return { face: hd <= 1 || s.y < 560, x: s.x, stageX: s.stageX };
  }'''
hit_patch_new = '''  function hitAcc(srcX, srcY) {
    const ids = [worn && worn.head, worn && worn.neck];
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
    return { face: hd <= 1 || s.y < 560, x: s.x, stageX: s.stageX };
  }'''
t = t.replace(hit_patch_old, hit_patch_new)

dress_js = r'''
  /* ---------- dress-up (full chroma sets + modular accessories) ---------- */
  const worn = { head: null, neck: null };
  const MINI_MS = 620;
  function syncWearUI() {
    document.querySelectorAll(".set-card").forEach(function (card) {
      card.classList.toggle("selected", activeSet === card.getAttribute("data-set"));
    });
    ITEMS.forEach(function (it) {
      const card = document.querySelector('.acc-card[data-id="' + it.id + '"]');
      if (card) card.classList.toggle("selected", worn[it.slot] === it.id);
    });
    if (ready >= 3) render(lastPose);
  }
  function triggerHop(hop) {
    if (hop !== false && (mode === "idle" || mode === "pet-release")) {
      begin("minihop", performance.now());
    }
  }
  function wearSet(id, hop) {
    if (activeSet === id) {
      activeSet = "default";
      bindBodySet("default");
      syncWearUI();
      return;
    }
    activeSet = id || "default";
    worn.head = null; worn.neck = null;
    bindBodySet(activeSet);
    syncWearUI();
    triggerHop(hop);
  }
  function wearItem(id, hop) {
    const it = ITEMS.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    if (activeSet !== "default") {
      activeSet = "default";
      bindBodySet("default");
    }
    if (worn[it.slot] === id) { worn[it.slot] = null; syncWearUI(); return; }
    worn[it.slot] = id; syncWearUI();
    triggerHop(hop);
  }
  function resetAll() {
    activeSet = "default";
    worn.head = null; worn.neck = null;
    bindBodySet("default");
    syncWearUI();
  }
  function setWorn(head, neck) { worn.head = head || null; worn.neck = neck || null; syncWearUI(); }

  document.querySelectorAll(".set-card").forEach(function (card) {
    const sid = card.getAttribute("data-set");
    const s = SETS.filter(function (x) { return x.id === sid; })[0];
    const img = card.querySelector("img");
    if (s && img) img.src = s.thumb;
  });
  document.querySelectorAll(".acc-card").forEach(function (card) {
    const id = card.getAttribute("data-id");
    const it = ITEMS.filter(function (x) { return x.id === id; })[0];
    const img = card.querySelector("img");
    if (it && img) img.src = it.thumb;
  });

  const sheet = document.getElementById("sheet");
  ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(function (tp) {
    sheet.addEventListener(tp, function (ev) { ev.stopPropagation(); ev.preventDefault(); }, true);
  });
  sheet.addEventListener("click", function (ev) {
    const tab = ev.target.closest(".tab");
    if (tab) {
      ev.preventDefault(); ev.stopPropagation();
      const target = tab.getAttribute("data-tab");
      document.querySelectorAll("#sheet .tab").forEach(function (b) { b.classList.toggle("active", b === tab); });
      document.getElementById("grid-sets").classList.toggle("active", target === "sets");
      document.getElementById("grid-acc").classList.toggle("active", target === "acc");
      return;
    }
    if (ev.target.closest("#btn-reset")) {
      ev.preventDefault(); ev.stopPropagation();
      resetAll();
      return;
    }
    const setCard = ev.target.closest(".set-card");
    if (setCard) {
      ev.preventDefault(); ev.stopPropagation();
      wearSet(setCard.getAttribute("data-set"), true);
      return;
    }
    const accCard = ev.target.closest(".acc-card");
    if (accCard) {
      ev.preventDefault(); ev.stopPropagation();
      wearItem(accCard.getAttribute("data-id"), true);
    }
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

'''
t = t.replace(
    '  fitStage(); addEventListener("resize", fitStage);\n  requestAnimationFrame(tick);',
    '  fitStage(); addEventListener("resize", fitStage);\n' + dress_js + '  requestAnimationFrame(tick);',
)

tick_old = '    else if (mode === "pet-release") { if (t >= PET_RELEASE_MS) toIdle(now); else { const u = t / PET_RELEASE_MS; const p = mix(pet(petLean, 0), idle(0, 0), easeInOut(u)); p.wClosed = u < 0.4 ? 1 : 1 - easeOutCubic((u - 0.4) / 0.6); render(p, now); } }'
tick_new = tick_old + '\n    else if (mode === "minihop") { if (t >= MINI_MS) toIdle(now); else render(minihop(t / MINI_MS), now); }'
if tick_old not in t:
    raise SystemExit('tick pattern not found')
t = t.replace(tick_old, tick_new)

demo_old = '''  window.__demo = {
    timeline: TL, jumpMs: JUMP_MS, mode: function () { return mode; },
    seek: function (ms) { live = false; render(poseAt(ms), ms); return ms; },
    live: function () { live = true; toIdle(performance.now()); },
    setSleepDelay: function (ms) { sleepDelay = ms; sleepAt = performance.now() + ms; }
  };'''
demo_new = '''  const DRESS_TL = { hatA: 900, hatAHold: 1650, hatB: 2000, hatBHold: 2750, scarf: 3100, scarfHold: 4000, tilt: 4300, tiltEnd: 5250, jump: 5450, jumpEnd: 5450 + JUMP_MS, end: 5450 + JUMP_MS + 900 };
  const DRESS_HAT_A = "strawberry", DRESS_HAT_B = "crown", DRESS_SCARF = "scarf_stripe";
  function poseAtDress(ms) {
    const T = DRESS_TL;
    if (ms < T.hatA) return idle(ms, 0);
    if (ms < T.hatAHold) return minihop((ms - T.hatA) / MINI_MS);
    if (ms < T.hatB) return idle(ms - T.hatAHold, 0);
    if (ms < T.hatBHold) return minihop((ms - T.hatB) / MINI_MS);
    if (ms < T.scarf) return idle(ms - T.hatBHold, 0);
    if (ms < T.scarfHold) return minihop((ms - T.scarf) / MINI_MS);
    if (ms < T.tilt) return idle(ms - T.scarfHold, 0);
    if (ms < T.tiltEnd) return tilt((ms - T.tilt) / TILT_MS, 1);
    if (ms < T.jump) return idle(ms - T.tiltEnd, 0);
    if (ms < T.jumpEnd) return jump((ms - T.jump) / JUMP_MS);
    return idle(ms - T.jumpEnd, 0);
  }
  function wornAt(ms) {
    let head = null, neck = null;
    if (ms >= DRESS_TL.hatA) head = DRESS_HAT_A;
    if (ms >= DRESS_TL.hatB) head = DRESS_HAT_B;
    if (ms >= DRESS_TL.scarf) neck = DRESS_SCARF;
    return { head: head, neck: neck };
  }
  window.__demo = {
    timeline: TL, jumpMs: JUMP_MS, mode: function () { return mode; },
    seek: function (ms) { live = false; render(poseAt(ms), ms); return ms; },
    live: function () { live = true; toIdle(performance.now()); },
    setSleepDelay: function (ms) { sleepDelay = ms; sleepAt = performance.now() + ms; },
    wear: function (id, hop) { live = true; wearItem(id, hop !== false); },
    wearSet: function (id, hop) { live = true; wearSet(id, hop !== false); },
    outfit: function () { return activeSet; },
    setWorn: setWorn,
    worn: function () { return { set: activeSet, head: worn.head, neck: worn.neck }; },
    seekDress: function (ms) { live = false; const w = wornAt(ms); setWorn(w.head, w.neck); render(poseAtDress(ms), ms); return { ms: ms, worn: w }; },
    dressTimeline: DRESS_TL
  };'''
if demo_old not in t:
    raise SystemExit('demo api pattern not found')
t = t.replace(demo_old, demo_new)

t = t.replace('玉兔 网格变形 Demo v2b', '玉兔 网格变形 · 换装 Demo v2b')

bg = (ASSETS / 'shared' / 'room_bg.jpg').read_bytes()
rep = {
    'TEX': json.dumps(TEX),
    'S': str(S),
    'OX': str(round(OX, 3)),
    'OY': str(round(OY, 3)),
    'TEX_BASE': uri_tex_exp(SETS_DIR / 'tex_base_exp.png'),
    'TEX_CLOSED': uri_tex_exp(SETS_DIR / 'tex_closed_exp.png'),
    'TEX_DOZE': uri_tex_exp(SETS_DIR / 'tex_doze_exp.png'),
    'BG': 'data:image/jpeg;base64,' + base64.b64encode(bg).decode(),
    'SH_SOFT_X': f'{FEET[0]+12}',
    'SH_SOFT_Y': f'{FEET[1]-5}',
    'SH_CON_X': f'{FEET[0]+3}',
    'SH_CON_Y': f'{FEET[1]+1}',
    'ITEMS': json.dumps(items, ensure_ascii=False),
    'SETS': json.dumps(sets_data, ensure_ascii=False),
    'SHEET_HTML': sheet,
}
for k, v in rep.items():
    t = t.replace(f'%%{k}%%', v)
if '%%' in t:
    leftover = [s for s in t.split('%%')[1::2][:8]]
    raise SystemExit('leftover placeholders: ' + str(leftover))

out = OUT / 'yutu_mesh_demo.html'
out.write_text(t, encoding='utf-8')
print('wrote', out, f'{out.stat().st_size / 1024:.1f} KB', 'sets', len(sets_data), 'items', len(items), 'TEX', TEX)
