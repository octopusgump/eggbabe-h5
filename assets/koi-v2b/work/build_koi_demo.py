#!/usr/bin/env python3
"""Build official v2b mesh demo with dress-up panel + new closed-eye textures."""
import base64, io, json
from pathlib import Path
from PIL import Image

W = Path(__file__).resolve().parent
OUT = W.parent
EX = W / 'dress' / 'extract'
meta = json.loads((EX / 'meta.json').read_text())

base = Image.open(W / 'tex_base.png')
CW, CH = base.size
lm = json.loads((W / 'landmarks.json').read_text())
a = base.split()[3].point(lambda v: 255 if v > 8 else 0)
x0, y0, x1, y1 = a.getbbox()
x0, y0, x1, y1 = max(0, x0 - 4), max(0, y0 - 4), min(CW, x1 + 4), min(CH, y1 + 4)
TEX = dict(x0=x0, y0=y0, w=x1 - x0, h=y1 - y0)
# Same rug anchor as the yutu room (feet at stage 195,656) and a similar body height.
BODY_H = max(1, lm['feetY'] - lm['bbox'][1])
BODY_W = max(1, lm['bbox'][2] - lm['bbox'][0])
S = min(400.0 / BODY_H, 340.0 / BODY_W)
FEET = (195.0, 656.0)
FOOT_SRC = (float(lm['cx']), float(lm['feetY']))
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

def uri_tex(p):
    im = Image.open(p).crop((x0, y0, x1, y1))
    return uri_img(im)

items = []
for it in meta:
    rec = dict(id=it['id'], slot=it['slot'], x=it['x'], y=it['y'], w=it['w'], h=it['h'],
               acc=uri_path(EX / f"acc_{it['id']}.png"),
               thumb=uri_path(EX / f"thumb_{it['id']}.png"))
    items.append(rec)

badge = '''<span class="badge"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.2l2.6 2.6L10 3.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'''
cards = []
for it in items:
    cards.append(f'<button class="card" type="button" data-id="{it["id"]}" data-slot="{it["slot"]}"><img alt=""><span class="badge">{badge}</span></button>')
# fix badge - I doubled. redo
cards = []
for it in items:
    cards.append(
        f'<button class="card" type="button" data-id="{it["id"]}" data-slot="{it["slot"]}">'
        f'<img alt="">'
        f'<span class="badge"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.2l2.6 2.6L10 3.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
        f'</button>'
    )
sheet = '<div id="sheet"><div class="handle"></div><div id="grid">' + ''.join(cards) + '</div></div>'

css = r'''
  #sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; background: #fbf4ea; border-radius: 28px 28px 0 0; box-shadow: 0 -10px 30px rgba(80,50,20,.14); padding: 8px 14px 20px; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  #sheet .handle { width: 40px; height: 4px; background: #e4d3bf; border-radius: 99px; margin: 4px auto 12px; }
  #grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; }
  .card { position: relative; aspect-ratio: 1; background: #fffdf9; border-radius: 16px; border: 2px solid rgba(201,149,90,0); box-shadow: 0 1px 3px rgba(80,50,20,.07); display: flex; align-items: center; justify-content: center; padding: 7px; cursor: pointer; appearance: none; -webkit-appearance: none; }
  .card img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; user-select: none; -webkit-user-drag: none; }
  .card.selected { border-color: #c9955a; box-shadow: 0 0 0 1.5px #c9955a, 0 1px 3px rgba(80,50,20,.07); }
  .card .badge { display: none; position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; border-radius: 50%; background: #c9955a; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,.15); }
  .card.selected .badge { display: flex; }
  .card .badge svg { display: block; width: 11px; height: 11px; }
'''

# Read template and inject
t = (W / "template.html").read_text()
t = t.replace('  .zz { position: absolute; left: 0; top: 0; font: 700 15px/1 sans-serif; color: #8a7a68; opacity: 0; pointer-events: none; z-index: 3; }\n</style>',
              '  .zz { position: absolute; left: 0; top: 0; font: 700 15px/1 sans-serif; color: #8a7a68; opacity: 0; pointer-events: none; z-index: 3; }\n' + css + '</style>')
t = t.replace('  <canvas id="gl"></canvas>\n</div></div>',
              '  <canvas id="gl"></canvas>\n%%SHEET_HTML%%\n</div></div>')
t = t.replace(
    '  const IMG = { base: "%%TEX_BASE%%", closed: "%%TEX_CLOSED%%", doze: "%%TEX_DOZE%%" };',
    '  const IMG = { base: "%%TEX_BASE%%", closed: "%%TEX_CLOSED%%", doze: "%%TEX_DOZE%%", bootsMint: "%%TEX_BOOTS_MINT%%" };\n  const ITEMS = %%ITEMS%%;',
)

# After loadTex / textures, we'll add acc load in JS via a marker
# Insert acc shader + buffers after `loadTex(0, IMG.base, true); loadTex(1, IMG.closed); loadTex(2, IMG.doze);`
acc_init = r'''
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
  });
'''

early_worn = r'''
  const worn = { head: null, neck: null, dorsal: null, hand: null, boots: "boots_yellow" };
  let texBodyDefault = null, texBodyMint = null, texClosed = null, texDoze = null;
  function syncBootsBodyTex() {
    const t = (worn.boots === "boots_mint" && texBodyMint) ? texBodyMint : texBodyDefault;
    if (!t) return;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
  }
  function rebindBodyTex() {
    syncBootsBodyTex();
    if (texClosed) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texClosed); }
    if (texDoze) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texDoze); }
  }
'''
boot_mint_loader = r'''
  (function loadBootsMintTex() {
    const img = new Image();
    img.onload = function () {
      const c = document.createElement("canvas"); c.width = POT_W; c.height = POT_H;
      c.getContext("2d").drawImage(img, 0, 0);
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      texBodyMint = t;
      syncBootsBodyTex();
    };
    img.src = IMG.bootsMint;
  })();
'''
t = t.replace(
    '      gl.uniform1i(gl.getUniformLocation(prog, "t" + unit), unit);\n      ready += 1; if (ready === 3) { window.__ready = true; render(lastPose); }',
    '      gl.uniform1i(gl.getUniformLocation(prog, "t" + unit), unit);\n      if (unit === 0) texBodyDefault = t;\n      else if (unit === 1) texClosed = t;\n      else if (unit === 2) texDoze = t;\n      ready += 1; if (ready === 3) { window.__ready = true; render(lastPose); }',
)
t = t.replace(
    '  loadTex(0, IMG.base, true); loadTex(1, IMG.closed); loadTex(2, IMG.doze);',
    early_worn + '  loadTex(0, IMG.base, true); loadTex(1, IMG.closed); loadTex(2, IMG.doze);\n' + acc_init + boot_mint_loader,
)

# Insert deformAcc after deform() function — find the closing of deform and the let lastPose line
deform_acc = r'''
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

'''
t = t.replace('    return [x, y];\n  }\n\n  let lastPose = P({});',
              '    return [x, y];\n  }\n' + deform_acc + '  let lastPose = P({});')

# Patch render() to draw accessories after the rabbit mesh
# After `gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);`
draw_acc = r'''
    // accessories: dorsal -> neck -> hand -> head
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
      ["dorsal", "neck", "hand", "head"].forEach(function (sl) { if (worn[sl]) drawAcc(accItems[worn[sl]]); });
    }
    rebindBodyTex();
'''
t = t.replace('    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);\n    const air = clamp(-p.hopY / 70, 0, 1);',
              '    if (ready < 3) return;\n    gl.useProgram(prog);\n    rebindBodyTex();\n'
              '    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aUv);\n'
              '    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aPos);\n'
              '    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);\n'
              '    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);\n' + draw_acc + '    const air = clamp(-p.hopY / 70, 0, 1);')

# Hit testing: after body miss, check accessories. Also if body hits, fine.
# Modify hit() to also return a hit if an accessory is opaque.
hit_patch_old = '''  function hit(ev) {
    const s = toSrc(ev), lx = Math.floor(s.x - TEX.x0), ly = Math.floor(s.y - TEX.y0);
    if (lx < 0 || ly < 0 || lx >= TEX.w || ly >= TEX.h || ready < 3) return null;
    if (hitCtx.getImageData(lx, ly, 1, 1).data[3] < 40) return null;
    const hd = Math.pow((s.x - HEAD.x) / HEAD.rx, 2) + Math.pow((s.y - HEAD.y) / HEAD.ry, 2);
    return { face: hd <= 1 || s.y < 560, x: s.x, stageX: s.stageX };
  }'''
hit_patch_new = '''  function hitAcc(srcX, srcY) {
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
  }'''
t = t.replace(hit_patch_old, hit_patch_new)

# Dress UI JS before requestAnimationFrame(tick)
dress_js = r'''
  /* ---------- dress-up ---------- */
  const MINI_MS = 620;
  function syncWearUI() {
    ITEMS.forEach(function (it) {
      const card = document.querySelector('.card[data-id="' + it.id + '"]');
      if (card) card.classList.toggle("selected", it.slot === "boots" ? worn.boots === it.id : worn[it.slot] === it.id);
    });
    syncBootsBodyTex();
    if (ready >= 3) render(lastPose);
  }
  function wearItem(id, hop) {
    const it = ITEMS.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    if (it.slot === "boots") {
      if (worn.boots === id) { worn.boots = "boots_yellow"; syncWearUI(); return; }
      worn.boots = id; syncWearUI(); return;
    }
    if (worn[it.slot] === id) { worn[it.slot] = null; syncWearUI(); return; }
    worn[it.slot] = id; syncWearUI();
    if (hop !== false && (mode === "idle" || mode === "pet-release")) {
      begin("minihop", performance.now());
    }
  }
  function setWorn(head, neck) { worn.head = head || null; worn.neck = neck || null; syncWearUI(); }
  document.querySelectorAll("#grid .card").forEach(function (card) {
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
    const card = ev.target.closest(".card"); if (!card) return;
    ev.preventDefault(); ev.stopPropagation();
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

'''
t = t.replace('  fitStage(); addEventListener("resize", fitStage);\n  requestAnimationFrame(tick);',
              '  fitStage(); addEventListener("resize", fitStage);\n' + dress_js + '  requestAnimationFrame(tick);')

# Handle minihop in the tick loop — after pet-release branch
tick_old = '''    else if (mode === "pet-release") { if (t >= PET_RELEASE_MS) toIdle(now); else { const u = t / PET_RELEASE_MS; const p = mix(pet(petLean, 0), idle(0, 0), easeInOut(u)); p.wClosed = u < 0.4 ? 1 : 1 - easeOutCubic((u - 0.4) / 0.6); render(p, now); } }'''
tick_new = '''    else if (mode === "pet-release") { if (t >= PET_RELEASE_MS) toIdle(now); else { const u = t / PET_RELEASE_MS; const p = mix(pet(petLean, 0), idle(0, 0), easeInOut(u)); p.wClosed = u < 0.4 ? 1 : 1 - easeOutCubic((u - 0.4) / 0.6); render(p, now); } }
    else if (mode === "minihop") { if (t >= MINI_MS) toIdle(now); else render(minihop(t / MINI_MS), now); }'''
if tick_old not in t:
    raise SystemExit('tick pattern not found')
t = t.replace(tick_old, tick_new)

# Extend __demo API
demo_old = '''  window.__demo = {
    timeline: TL, jumpMs: JUMP_MS, mode: function () { return mode; },
    seek: function (ms) { live = false; render(poseAt(ms), ms); return ms; },
    live: function () { live = true; toIdle(performance.now()); },
    setSleepDelay: function (ms) { sleepDelay = ms; sleepAt = performance.now() + ms; }
  };'''
demo_new = '''  const DRESS_TL = { hatA: 900, hatAHold: 1650, hatB: 2000, hatBHold: 2750, scarf: 3100, scarfHold: 4000, tilt: 4300, tiltEnd: 5250, jump: 5450, jumpEnd: 5450 + JUMP_MS, end: 5450 + JUMP_MS + 900 };
  const DRESS_HAT_A = "kasa", DRESS_HAT_B = "crown", DRESS_SCARF = "scarf";
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
    setWorn: setWorn,
    worn: function () { return { head: worn.head, neck: worn.neck }; },
    seekDress: function (ms) { live = false; const w = wornAt(ms); setWorn(w.head, w.neck); render(poseAtDress(ms), ms); return { ms: ms, worn: w }; },
    dressTimeline: DRESS_TL
  };'''
if demo_old not in t:
    raise SystemExit('demo api pattern not found')
t = t.replace(demo_old, demo_new)

# Title
t = t.replace('锦鲤 BOON KOI 网格换装 Demo', '锦鲤 BOON KOI · 自由试衣 Demo')

# Replace placeholders
bg = (W.parents[2] / 'assets/shared/room_bg.jpg').read_bytes()
rep = {
    'TEX': json.dumps(TEX),
    'S': str(S),
    'OX': str(round(OX, 3)),
    'OY': str(round(OY, 3)),
    'TEX_BASE': uri_tex(W / 'tex_base.png'),
    'TEX_CLOSED': uri_tex(W / 'tex_closed.png'),
    'TEX_DOZE': uri_tex(W / 'tex_doze.png'),
    'TEX_BOOTS_MINT': uri_tex(W / 'tex_boots_mint.png'),
    'BG': 'data:image/jpeg;base64,' + base64.b64encode(bg).decode(),
    'SH_SOFT_X': f'{FEET[0]+12}',
    'SH_SOFT_Y': f'{FEET[1]-5}',
    'SH_CON_X': f'{FEET[0]+3}',
    'SH_CON_Y': f'{FEET[1]+1}',
    'ITEMS': json.dumps(items, ensure_ascii=False),
    'FEET_Y': str(lm['feetY']),
    'CX': str(lm['cx']),
    'NECK': json.dumps(lm['neck']),
    'HEAD': json.dumps(lm['head']),
    'EAR_L': json.dumps(lm['earL']),
    'EAR_R': json.dumps(lm['earR']),
    'BODY_Y': str(lm['bodyY']),
    'SHEET_HTML': sheet,
}
for k, v in rep.items():
    t = t.replace(f'%%{k}%%', v)
if '%%' in t:
    leftover = [s for s in t.split('%%')[1::2][:8]]
    raise SystemExit('leftover placeholders: ' + str(leftover))

# Save the source template (without inlined binaries) for future edits? optional
# Write official html
out = OUT / 'koi_mesh_demo.html'
out.write_text(t, encoding='utf-8')
print('wrote', out, out.stat().st_size, 'items', len(items), 'TEX', TEX)
