  /* ==========================================================================
   * Click emotes: dialogue bubble + 4 random expressions (laugh / sad / think / cute)
   *
   * NOTE: this is NOT a standalone module. patch_emotes.py splices it into the
   * IIFE of v2b/yutu_mesh_demo.html and koi-v2b/koi_mesh_demo.html (right before
   * "live state machine") and replaces the FACE placeholder with the per-pet
   * JSON config. It relies on the demo's own scope: gl, sh, vs, makeAccGrid,
   * accStage, P, kf, mix, clamp, lerp, easeOutCubic, hitCtx, TEX, S, stage,
   * render, begin, toIdle, blend, mode, live, lastPose.
   *
   * - Body motion = pose keyframes (same deform() as jump / tilt).
   * - Facial features = a 12x12 overlay grid over the face (makeAccGrid),
   *   deformed with accStage(..., "head"); its texture is painted at runtime
   *   on a 2D canvas, sampling / copying pixels from the pet's base texture.
   * All coordinates in FACE are source px (same space as HEAD / NECK).
   * ======================================================================== */
  const FACE = /*@FACE@*/null;
  const EMO_KINDS = ["laugh", "sad", "think", "cute"];
  const EMO_REPICK_MS = 650, BUBBLE_MS = 2100, STALK_K = FACE.stalkK || 1.5;

  /* ---------- face overlay program (own shader, alpha uniform, texture unit 3) ---------- */
  const fsF = "precision mediump float; varying vec2 vUv; uniform sampler2D tF; uniform float uA;" +
    " void main(){ gl_FragColor = texture2D(tF, vUv) * uA; }";
  const progF = gl.createProgram();
  gl.attachShader(progF, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(progF, sh(gl.FRAGMENT_SHADER, fsF));
  gl.linkProgram(progF);
  const aPosF = gl.getAttribLocation(progF, "aPos"), aUvF = gl.getAttribLocation(progF, "aUv");
  const uTF = gl.getUniformLocation(progF, "tF"), uAF = gl.getUniformLocation(progF, "uA");
  const FR = FACE.rect, FW = FR[2] - FR[0], FH = FR[3] - FR[1];
  const faceGrid = (function (x, y, w, h) {
    const C = 12, R = 12, nv = (C + 1) * (R + 1);
    const rest = new Float32Array(nv * 2), uv = new Float32Array(nv * 2), pos = new Float32Array(nv * 2);
    for (let r = 0, i = 0; r <= R; r++) for (let c = 0; c <= C; c++, i++) {
      const u = c / C, v = r / R;
      rest[i * 2] = x + u * w; rest[i * 2 + 1] = y + v * h;
      uv[i * 2] = u; uv[i * 2 + 1] = v;
    }
    const idx = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const a = r * (C + 1) + c, b = a + 1, d = a + C + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const uB = gl.createBuffer(), pB = gl.createBuffer(), iB = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uB); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, pB); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iB); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    return { rest: rest, uv: uv, pos: pos, nv: nv, idx: idx, uvBuf: uB, posBuf: pB, idxBuf: iB };
  })(FR[0], FR[1], FW, FH);
  function faceStage(x, y, p, cr, sr) {
    const d = deform(x, y, p, 0, 0), dx = d[0] - CX, dy = d[1] - FEET_Y;
    return [OX + (CX + dx * cr - dy * sr) * S, OY + (FEET_Y + dx * sr + dy * cr) * S + p.hopY];
  }
  const faceTex = {};   // id -> WebGLTexture | false (nothing to draw for this pet)

  /* ---------- painting helpers (ctx is translated so that 1 unit = 1 source px) ---------- */
  function lw(stagePx) { return stagePx / S; }
  function sampleAvg(x, y, w, h) {
    const d = hitCtx.getImageData(Math.round(x - TEX.x0), Math.round(y - TEX.y0), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200 || (d[i] + d[i + 1] + d[i + 2]) / 3 < 120) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    return n ? [r / n | 0, g / n | 0, b / n | 0] : [230, 225, 215];
  }
  function rgb(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a == null ? 1 : a) + ")"; }
  function eyeClip(c, e) { c.beginPath(); c.ellipse(e.ex, e.ey, e.erx, e.ery, 0, 0, Math.PI * 2); c.clip(); }
  // hide the pupil: fill it with the eye-white colour (vertical gradient sampled above / below it)
  function coverPupil(c, e) {
    const top = sampleAvg(e.x - 8, e.y - e.r - 10, 16, 5), bot = sampleAvg(e.x - 8, e.y + e.r + 5, 16, 5);
    const mid = sampleAvg(e.x + (e.x < CX ? -e.r - 9 : e.r + 4), e.y - 6, 5, 12);
    c.save(); eyeClip(c, e);
    const g = c.createLinearGradient(0, e.y - e.r - 4, 0, e.y + e.r + 4);
    g.addColorStop(0, rgb(top)); g.addColorStop(0.5, rgb(mid)); g.addColorStop(1, rgb(bot));
    c.filter = "blur(" + lw(0.6).toFixed(2) + "px)";
    c.fillStyle = g; c.beginPath(); c.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  // copy the original pupil pixels to an offset position (stays inside the eye white)
  function movePupil(c, e, dx, dy) {
    coverPupil(c, e);
    const R = e.r + 3;
    c.save(); eyeClip(c, e);
    c.beginPath(); c.arc(e.x + dx, e.y + dy, e.r + 2, 0, Math.PI * 2); c.clip();
    c.drawImage(hitCtx.canvas, e.x - R - TEX.x0, e.y - R - TEX.y0, 2 * R, 2 * R, e.x - R + dx, e.y - R + dy, 2 * R, 2 * R);
    c.restore();
  }
  // erase the original mouth: copy a patch of fur from below, feathered edges
  function eraseMouth(c) {
    const m = FACE.eraseMouth; if (!m) return;
    const w = m.x1 - m.x0, h = m.y1 - m.y0, tc = document.createElement("canvas");
    tc.width = w; tc.height = h;
    const t = tc.getContext("2d");
    t.filter = "blur(5px)";
    t.lineCap = "round"; t.lineWidth = 26; t.strokeStyle = "#000"; t.fillStyle = "#000";
    t.beginPath(); t.moveTo(16, 17); t.quadraticCurveTo(w / 2, h - 4, w - 18, 14); t.stroke();
    t.beginPath(); t.ellipse(w / 2, h * 0.5, w * 0.36, h * 0.32, 0, 0, Math.PI * 2); t.fill();
    t.filter = "none"; t.globalCompositeOperation = "source-in";
    t.drawImage(hitCtx.canvas, m.x0 - TEX.x0, m.y0 + m.dy - TEX.y0, w, h, 0, 0, w, h);
    c.drawImage(tc, m.x0, m.y0);
  }
  function stroke(c, color, wStage, fn) {
    c.save(); c.strokeStyle = color; c.lineWidth = lw(wStage); c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); fn(c); c.stroke(); c.restore();
  }
  const INK = "rgba(52,38,32,.92)";
  function dMouth(c, m) {
    const x0 = m.x - m.w / 2, x1 = m.x + m.w / 2, y0 = m.y - m.h / 2;
    function path() { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(m.x, y0 - m.h * 0.08, x1, y0); c.bezierCurveTo(x1, y0 + m.h * 0.9, m.x + m.w * 0.22, y0 + m.h * 1.08, m.x, y0 + m.h * 1.08); c.bezierCurveTo(m.x - m.w * 0.22, y0 + m.h * 1.08, x0, y0 + m.h * 0.9, x0, y0); c.closePath(); }
    c.save(); path(); c.fillStyle = "#5b2a26"; c.fill(); c.clip();
    c.fillStyle = "#ff8f8f"; c.beginPath(); c.ellipse(m.x, y0 + m.h * 1.0, m.w * 0.3, m.h * 0.42, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    c.save(); path(); c.strokeStyle = "#3a1c18"; c.lineWidth = lw(1.3); c.lineJoin = "round"; c.stroke(); c.restore();
  }
  function happyEyes(c) {   // ^ ^
    FACE.eyes.forEach(function (e) {
      coverPupil(c, e);
      stroke(c, INK, 2.6, function (c) { c.moveTo(e.x - e.r * 0.95, e.y + e.r * 0.3); c.quadraticCurveTo(e.x, e.y - e.r * 0.95, e.x + e.r * 0.95, e.y + e.r * 0.3); });
    });
  }
  function squeezeEyes(c) { // > <
    FACE.eyes.forEach(function (e) {
      coverPupil(c, e); const d = e.x < CX ? 1 : -1, r = e.r;
      stroke(c, INK, 2.6, function (c) { c.moveTo(e.x - d * r * 0.7, e.y - r * 0.62); c.lineTo(e.x + d * r * 0.62, e.y); c.lineTo(e.x - d * r * 0.7, e.y + r * 0.62); });
    });
  }
  function brows(c, kind, side) {
    FACE.eyes.forEach(function (e) {
      const isL = e.x < CX, inner = isL ? 1 : -1, L = FACE.browLen, bx = e.ex, by = e.ey - e.ery - FACE.browGap;
      stroke(c, "rgba(78,60,50,.88)", 2.1, function (c) {
        if (kind === "sad") {       // 八字眉: inner end up
          c.moveTo(bx - inner * L * 0.5, by + L * 0.12); c.quadraticCurveTo(bx, by + L * 0.02, bx + inner * L * 0.5, by - L * 0.28);
        } else {                    // think: brow on `side` raised & arched, the other flat
          const up = (isL ? -1 : 1) === side;
          if (up) { c.moveTo(bx - L * 0.5, by - L * 0.05); c.quadraticCurveTo(bx, by - L * 0.42, bx + L * 0.5, by - L * 0.05); }
          else { c.moveTo(bx - L * 0.45, by + L * 0.1); c.lineTo(bx + L * 0.45, by + L * 0.06); }
        }
      });
    });
  }
  function gloom(c) {
    const g = FACE.gloom;
    for (let i = 0; i < 4; i++) {
      const x = g.x + (i - 1.5) * g.w / 3, h = g.h * (i % 2 ? 0.8 : 1);
      const gr = c.createLinearGradient(0, g.y, 0, g.y + h);
      gr.addColorStop(0, "rgba(96,124,210,.78)"); gr.addColorStop(1, "rgba(96,124,210,0)");
      stroke(c, gr, 1.5, function (c) { c.moveTo(x, g.y); c.lineTo(x, g.y + h); });
    }
  }
  const PAINT = {
    laughEyes: function (c) { if (FACE.closedTex) return false; happyEyes(c); },
    laugh: function (c) { eraseMouth(c); dMouth(c, FACE.mouth); },
    sad: function (c) {
      brows(c, "sad"); gloom(c);
      if (FACE.eraseMouth) {
        eraseMouth(c); const m = FACE.mouth, w = m.w * 0.36;
        stroke(c, INK, 2.2, function (c) { c.moveTo(m.x - w, m.y + 6); c.quadraticCurveTo(m.x, m.y - 12, m.x + w, m.y + 6); });
      }
    },
    thinkL: function (c) { paintThink(c, -1); }, thinkR: function (c) { paintThink(c, 1); },
    cute: function (c) {
      if (FACE.closedTex) return false;
      squeezeEyes(c); eraseMouth(c); const m = FACE.mouth, r = m.w * 0.13;
      stroke(c, INK, 2.2, function (c) { c.moveTo(m.x - 2 * r, m.y - 2); c.quadraticCurveTo(m.x - r, m.y + r * 1.6, m.x, m.y - 2); c.quadraticCurveTo(m.x + r, m.y + r * 1.6, m.x + 2 * r, m.y - 2); });
    }
  };
  function paintThink(c, side) {
    brows(c, "think", side);
    FACE.eyes.forEach(function (e) { movePupil(c, e, FACE.lookUp[0] * side, FACE.lookUp[1]); });
    if (FACE.eraseMouth) {
      eraseMouth(c); const m = FACE.mouth, w = m.w * 0.3;
      stroke(c, INK, 2.1, function (c) { for (let i = 0; i <= 24; i++) { const t = i / 24, x = m.x - w + 2 * w * t, y = m.y + Math.sin(t * Math.PI * 4) * 4.5; if (i) c.lineTo(x, y); else c.moveTo(x, y); } });
    }
  }
  function paintFace(id) {
    if (faceTex[id] !== undefined) return faceTex[id];
    const cv = document.createElement("canvas"); cv.width = FW; cv.height = FH;
    const c = cv.getContext("2d");
    c.translate(-FR[0], -FR[1]);
    if (PAINT[id](c) === false) { faceTex[id] = false; return false; }
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    faceTex[id] = t; return t;
  }

  /* ---------- emote definitions: keyframes (kf), beats, face segments ---------- */
  // ears: yutu earL<0 / earR>0 = tips outward; koi uses one `stalk` value for both (+ = tip to the right)
  function earSide(s, v) { return s > 0 ? { earL: 0, earR: v } : { earL: -v, earR: 0 }; }
  function K(o, e, pose, extra) { return Object.assign({ o: o, e: e }, pose, extra || {}); }
  const EMOTES = {
    laugh: { ms: 2400,
      keys: function (s) { const hop = function (o, d) { return K(o, "in", { hopY: -10, sy: 1.03, sx: 0.98, headRot: 5 * d, earL: d > 0 ? -14 : -5, earR: d > 0 ? 5 : 14, stalk: 16 * d, wClosed: 1, shS: 0.92 }); };
        const land = function (o, d) { return K(o, "out", { hopY: 0, sy: 0.95, sx: 1.05, headRot: 2 * d, earL: -8, earR: 8, stalk: 4 * d, wClosed: 1, shS: 1.08 }); };
        return [
          K(0, "in", {}),
          K(0.08, "out", { sx: 1.08, sy: 0.88, earL: 12, earR: -12, wClosed: 1, shS: 1.12, stalk: -8 }),
          K(0.18, "out", { hopY: -34, sy: 1.10, sx: 0.94, earL: -20, earR: 20, rot: -2, wClosed: 1, shS: 0.9, stalk: -18 }),
          K(0.28, "in", { hopY: -42, sy: 1.02, sx: 0.99, headRot: 6, earL: -8, earR: 8, rot: -1, wClosed: 1, stalk: -12 }),
          K(0.38, "back", { hopY: 0, sx: 1.12, sy: 0.86, earL: -18, earR: 18, wClosed: 1, shS: 1.16, stalk: 10 }),
          hop(0.46, 1), land(0.515, 1), hop(0.57, -1), land(0.625, -1), hop(0.68, 1),
          K(0.735, "out", { hopY: 0, sy: 0.95, sx: 1.05, headRot: 1, wClosed: 1, shS: 1.08 }),
          K(0.78, "io", { sy: 1.0, wClosed: 1 }),
          K(0.84, "io", { headRot: -4, rot: -1.5, sy: 1.02, earL: -6, earR: 6, wClosed: 1, stalk: -6 }),
          K(0.92, "out", { headRot: -1, wClosed: 0.5 }),
          K(1, "out", {})
        ]; },
      faces: [["laughEyes", 0.07, 0.88, 140, 260], ["laugh", 0.27, 0.88, 160, 260]],
      beats: [{ u: 0.3, fx: "haha", t: "哈", at: "L" }, { u: 0.46, fx: "haha", t: "哈哈", at: "R" }, { u: 0.57, fx: "haha", t: "嘻", at: "L" }, { u: 0.68, fx: "haha", t: "哈", at: "R" }] },
    sad: { ms: 2600, lag: { earR: 0.05 },
      keys: function (s) { const base = { sy: 0.94, sx: 1.03, headTy: 12, headRot: -5 * s, earL: -50, earR: 50, stalk: 40 * s };
        const sniff = function (o) { return K(o, "out", Object.assign({}, base, { sy: 0.965, hopY: -3, headRot: -5 * s + 1.5, stalk: 40 * s + 4 })); };
        return [
          K(0, "io", {}),
          K(0.10, "io", { sy: 1.02, earL: -4, earR: 4, stalk: -6 * s }),
          K(0.30, "lin", base), K(0.42, "in", base), sniff(0.443), K(0.466, "out", Object.assign({}, base, { stalk: 40 * s - 4 })),
          K(0.52, "in", base), sniff(0.543), K(0.566, "io", Object.assign({}, base, { stalk: 40 * s - 4 })),
          K(0.62, "io", base),
          K(0.71, "io", Object.assign({}, base, { sy: 0.97, breath: 0.04, headTy: 10 })),
          K(0.80, "io", Object.assign({}, base, { sy: 0.92, breath: -0.02, headTy: 16 })),
          K(0.88, "io", Object.assign({}, base, { sy: 0.93, headTy: 15, lean: 0.25 * s, rot: 0.8 * s })),
          K(0.92, "io", Object.assign({}, base, { sy: 0.97, headTy: 6, headRot: -2 * s, lean: 0.1 * s, earL: -46, earR: 46 })),
          K(0.96, "io", { earL: -30, earR: 30, stalk: 22 * s }),
          K(1, "out", {})
        ]; },
      faces: [["sad", 0.12, 0.9, 320, 220]],
      beats: [{ u: 0.36, fx: "tear", eye: 0 }, { u: 0.50, fx: "tear", eye: 1 }] },
    think: { ms: 2500,
      add: function (u, ms, s) { const w = sstep(0.15, 0.22, u) * (1 - sstep(0.5, 0.55, u)), shk = u > 0.8 && u < 0.92 ? Math.sin((u - 0.8) / 0.12 * Math.PI * 4) * (1 - (u - 0.8) / 0.12) : 0;
        return { headRot: 2.5 * w * Math.sin(ms / 1000 * Math.PI * 2 * 0.7), lean: 0.15 * w * Math.sin(ms / 1000 * Math.PI * 2 * 0.5), stalk: 10 * shk }; },
      keys: function (s) { const tilt = Object.assign({ headRot: 11 * s, rot: 1.5 * s, headTy: 3, stalk: 20 * s }, earSide(s, 24));
        return [
          K(0, "out", {}),
          K(0.15, "lin", tilt), K(0.33, "out", tilt), K(0.345, "in", Object.assign({}, tilt, { hopY: -3 })), K(0.36, "out", tilt),
          K(0.375, "in", Object.assign({}, tilt, { hopY: -3 })), K(0.39, "io", tilt), K(0.5, "io", tilt),
          K(0.62, "io", Object.assign({ headRot: -6 * s, rot: -0.5 * s, headTy: 2, stalk: -12 * s }, earSide(-s, 14))),
          K(0.72, "out", { sy: 0.9, sx: 1.06, headRot: -2 * s, earL: 6, earR: -6, shS: 1.1 }),
          K(0.80, "in", { hopY: -18, sy: 1.08, sx: 0.95, earL: -14, earR: 14, shS: 0.9 }),
          K(0.88, "back", { hopY: 0, sx: 1.08, sy: 0.9, earL: -8, earR: 8, shS: 1.1 }),
          K(0.95, "io", { sy: 1.02 }),
          K(1, "out", {})
        ]; },
      faces: function (s) { return [[s > 0 ? "thinkR" : "thinkL", 0.04, 0.72, 220, 120]]; },
      beats: [{ u: 0.08, fx: "q", big: true }, { u: 0.56, fx: "q", big: false, flip: true }, { u: 0.78, fx: "bang" }] },
    cute: { ms: 2400,
      keys: function (s) { const sw = function (o, d) { return K(o, "io", Object.assign({ headRot: 10 * d, lean: 0.45 * d, rot: 2 * d, headTy: 3, wClosed: 1, stalk: 14 * d }, d > 0 ? { earL: 8, earR: 10 } : { earL: -10, earR: -8 })); };
        const pose = Object.assign({ headRot: 12 * s, rot: 3 * s, headTy: 2, wClosed: 1, stalk: 22 * s }, s > 0 ? { earL: -2, earR: 26 } : { earL: -26, earR: 2 });
        return [
          K(0, "out", {}),
          K(0.10, "io", { sy: 0.95, sx: 1.04, headTy: 4, earL: 8, earR: -8, wClosed: 1 }),
          sw(0.2, 1), sw(0.3, -1), sw(0.4, 1),
          K(0.50, "out", { wClosed: 1 }),
          K(0.55, "in", { hopY: -14, sy: 1.06, sx: 0.96, earL: -10, earR: 10, wClosed: 1, shS: 0.9 }),
          K(0.60, "out", { hopY: 0, sy: 0.9, sx: 1.08, earL: -6, earR: 6, wClosed: 1, shS: 1.1 }),
          K(0.65, "in", { hopY: -14, sy: 1.06, sx: 0.96, earL: -10, earR: 10, wClosed: 1, shS: 0.9 }),
          K(0.70, "back", { hopY: 0, sy: 0.92, sx: 1.07, wClosed: 1, shS: 1.08 }),
          K(0.74, "lin", pose), K(0.865, "io", pose),
          K(0.92, "io", { sy: 1.03, headRot: 3 * s, wClosed: 0.6 }),
          K(1, "out", {})
        ]; },
      faces: [["cute", 0.04, 0.88, 200, 260]],
      beats: [{ u: 0.2, fx: "heart", at: "R" }, { u: 0.3, fx: "heart", at: "L" }, { u: 0.4, fx: "heart", at: "R" }, { u: 0.76, fx: "star", at: "S" }, { u: 0.8, fx: "star", at: "S2" }] }
  };
  const keyCache = {};
  function emoKeys(kind, s) {
    const id = kind + (s > 0 ? "+" : "-");
    if (!keyCache[id]) keyCache[id] = EMOTES[kind].keys(s).map(function (k) {
      if (FACE.stalk) { const v = (k.stalk || 0) * STALK_K; k.earL = v; k.earR = v; }
      if (!FACE.closedTex && k.wClosed) k.wClosed = 0;
      return k;
    });
    return keyCache[id];
  }
  function emotePose(kind, u, s, ms) {
    const def = EMOTES[kind], list = emoKeys(kind, s), p = kf(list, u);
    if (def.lag && !FACE.stalk) for (const k in def.lag) p[k] = kf(list, u - def.lag[k])[k];
    if (def.add) { const a = def.add(u, ms, s); for (const k in a) {
      if (k === "stalk") { if (FACE.stalk) { p.earL += a[k] * STALK_K; p.earR += a[k] * STALK_K; } }
      else p[k] += a[k];
    } }
    return p;
  }
  function emoFaces(kind, s) { const f = EMOTES[kind].faces; return typeof f === "function" ? f(s) : f; }

  /* ---------- runtime state ---------- */
  const emo = { kind: null, side: 1, t0: 0, u: 0, beat: 0, last: null, seek: false, active: false, endAt: 0, snap: {}, prevSnap: null, prevAt: 0, warmed: false };
  function faceAlphas(kind, s, ms) {
    const out = {}, dur = EMOTES[kind].ms;
    emoFaces(kind, s).forEach(function (f) {
      const a = f[1] * dur, b = f[2] * dur, fi = f[3] || 120, fo = f[4] || 120;
      out[f[0]] = ms < a ? 0 : ms < a + fi ? easeOutCubic((ms - a) / fi) : ms < b ? 1 : ms < b + fo ? 1 - (ms - b) / fo : 0;
    });
    return out;
  }
  function drawFace(p, cr, sr) {
    let al = {};
    if (emo.kind && (mode === "emote" || emo.seek)) {
      al = faceAlphas(emo.kind, emo.side, emo.u * EMOTES[emo.kind].ms);
      if (emo.prevSnap && !emo.seek) {
        const pk = 1 - (performance.now() - emo.prevAt) / 140;
        if (pk > 0) { for (const id in emo.prevSnap) al[id] = Math.max(al[id] || 0, emo.prevSnap[id] * pk); }
        else emo.prevSnap = null;
      }
      emo.active = true; emo.snap = Object.assign({}, al);
    } else if (emo.active || emo.endAt) {
      if (emo.active) { emo.active = false; emo.endAt = performance.now(); }
      const k = 1 - (performance.now() - emo.endAt) / 160;
      if (k <= 0) { emo.endAt = 0; emo.prevSnap = null; return; }
      for (const id in emo.snap) al[id] = emo.snap[id] * k;
    }
    let any = false;
    for (const id in al) {
      if (al[id] <= 0.003) continue;
      const tex = paintFace(id); if (!tex) continue;
      if (!any) {
        any = true;
        for (let i = 0; i < faceGrid.nv; i++) {
          const st = faceStage(faceGrid.rest[i * 2], faceGrid.rest[i * 2 + 1], p, cr, sr);
          faceGrid.pos[i * 2] = st[0]; faceGrid.pos[i * 2 + 1] = st[1];
        }
        gl.useProgram(progF);
        gl.bindBuffer(gl.ARRAY_BUFFER, faceGrid.uvBuf); gl.vertexAttribPointer(aUvF, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aUvF);
        gl.bindBuffer(gl.ARRAY_BUFFER, faceGrid.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, faceGrid.pos);
        gl.vertexAttribPointer(aPosF, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aPosF);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceGrid.idxBuf);
        gl.uniform1i(uTF, 3);
      }
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1f(uAF, clamp(al[id], 0, 1));
      gl.drawElements(gl.TRIANGLES, faceGrid.idx.length, gl.UNSIGNED_SHORT, 0);
    }
    if (!any) return;
    // restore the body program / buffers for whatever is drawn next (accessories)
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aUv);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aPos);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  }

  /* ---------- source px -> stage px (follows head deformation of the last pose) ---------- */
  function headStage(x, y) {
    const p = lastPose, cr = Math.cos(p.rot * Math.PI / 180), sr = Math.sin(p.rot * Math.PI / 180);
    return faceStage(x, y, p, cr, sr);
  }

  /* ---------- dialogue bubble ---------- */
  const bubble = document.createElement("div"); bubble.className = "emo-bubble"; stage.appendChild(bubble);
  let bubbleUntil = 0, bubbleOn = false;
  function say(text, now) { bubble.textContent = text; bubbleUntil = now + BUBBLE_MS; bubbleOn = true; bubble.classList.add("show"); updateBubble(now, true); }
  function updateBubble(now, force) {
    if (!emo.warmed && ready >= 3) { emo.warmed = true; Object.keys(PAINT).forEach(paintFace); }
    if (!force) emo.seek = false;
    if (!bubbleOn) return;
    if (!force && (now > bubbleUntil || (mode !== "emote" && mode !== "idle"))) {
      bubbleOn = false; bubble.classList.remove("show"); return;
    }
    const a = headStage(FACE.bubble.x, FACE.bubble.y), w = bubble.offsetWidth || 120;
    const x = clamp(a[0], w / 2 + 8, 390 - w / 2 - 8), y = Math.max(a[1], bubble.offsetHeight + 10);
    bubble.style.left = x.toFixed(1) + "px"; bubble.style.top = y.toFixed(1) + "px";
    bubble.style.setProperty("--tail", clamp(w / 2 + (a[0] - x), 14, w - 14).toFixed(1) + "px");
  }

  /* ---------- particles ---------- */
  const fxNodes = [];
  function topAnchor(s) { const t = FACE.anchors.top; return [CX + (t[0] - CX) * (s || 1), t[1]]; }
  function anchor(at, s) {
    const A = FACE.anchors;
    if (at === "L") return A.L; if (at === "R") return A.R;
    if (at === "S") return s > 0 ? A.R : A.L;
    return topAnchor(s);
  }
  function fx(b, s, elapsed) {
    const n = document.createElement("div"); n.className = "emo-fx"; let src, frames, dur, rnd = ((b.u * 1000) % 7) / 7 - 0.5;
    if (b.fx === "haha") {
      src = anchor(b.at, s); n.textContent = b.t; n.style.color = "#e0785a"; n.style.fontSize = "17px";
      const dx = (b.at === "L" ? -1 : 1) * 14; dur = 900;
      frames = [[0, 0, 0.5, 0, -8 * rnd], [dx * 0.5, -12, 1.15, 1, 0], [dx, -34, 1, 0, 6 * rnd]];
    } else if (b.fx === "tear") {
      const e = FACE.eyes[b.eye], out = e.x < CX ? -1 : 1; src = [e.ex + out * e.erx * 0.55, e.ey + e.ery * 0.58];
      n.className = "emo-fx emo-tear"; dur = 1000;
      frames = [[0, 0, 0.5, 0, 0], [out * 1, 2, 1.15, 1, 0], [out * 2.5, 16, 1.05, 1, 0], [out * 4, 34, 0.9, 0, 0]];
    } else if (b.fx === "q") {
      src = b.flip ? (s > 0 ? FACE.anchors.L : FACE.anchors.R) : topAnchor(s); n.textContent = "?";
      n.style.color = "#6b8fc4"; n.style.fontSize = b.big ? "26px" : "18px"; dur = 1200;
      frames = [[0, 0, 0.3, 0, -20], [0, -8, 1.1, 1, 8], [4, -18, 1, 1, -6], [6, -26, 1, 0, 4]];
    } else if (b.fx === "bang") {
      src = topAnchor(s); n.textContent = "!"; n.style.color = "#ef5b3f"; n.style.fontSize = "30px"; dur = 800;
      frames = [[0, 4, 0.2, 0, 0], [0, -6, 1.35, 1, 0], [0, -8, 1, 1, 0], [0, -14, 1, 0, 0]];
    } else if (b.fx === "heart") {
      src = anchor(b.at, s); n.textContent = "♥"; n.style.color = "#ff6f91"; n.style.fontSize = "19px"; dur = 1300;
      const d = b.at === "L" ? -1 : 1;
      frames = [[0, 0, 0.3, 0, 0], [d * 6, -14, 1.1, 1, -10 * d], [-d * 4, -30, 1, 0.9, 8 * d], [d * 4, -46, 0.9, 0, 0]];
    } else {
      src = anchor(b.at, s); n.textContent = "✦"; n.style.color = "#ffc23d"; n.style.fontSize = b.at === "S2" ? "14px" : "20px"; dur = 900;
      frames = [[0, 0, 0.2, 0, 0], [0, -4, 1.3, 1, 90], [0, -8, 0.6, 0, 180]];
    }
    const st = headStage(src[0], src[1]);
    stage.appendChild(n); fxNodes.push(n);
    const kfs = frames.map(function (f, i) {
      return { transform: "translate(" + (st[0] + f[0]).toFixed(1) + "px," + (st[1] + f[1]).toFixed(1) + "px) translate(-50%,-50%) scale(" + f[2] + ") rotate(" + f[4] + "deg)", opacity: f[3], offset: i / (frames.length - 1) };
    });
    const an = n.animate(kfs, { duration: dur, easing: b.fx === "tear" ? "cubic-bezier(.5,0,.9,.6)" : "ease-out", fill: "forwards" });
    an.onfinish = function () { n.remove(); const i = fxNodes.indexOf(n); if (i >= 0) fxNodes.splice(i, 1); };
    if (elapsed != null) { an.pause(); an.currentTime = clamp(elapsed, 0, dur - 1); }
    return dur;
  }
  function clearFx() { while (fxNodes.length) fxNodes.pop().remove(); }
  function clearEmoteSeek() {
    if (!emo.seek && bubbleUntil !== Infinity) return;
    emo.seek = false; emo.active = false; emo.endAt = 0; emo.prevSnap = null;
    bubbleOn = false; bubbleUntil = 0;
    bubble.style.transition = "none"; bubble.classList.remove("show"); void bubble.offsetWidth; bubble.style.transition = "";
    clearFx();
  }

  /* ---------- start / tick ---------- */
  function pickKind() { const c = EMO_KINDS.filter(function (k) { return k !== emo.last; }); return c[Math.floor(Math.random() * c.length)]; }
  function startEmote(now, ptrInfo, kind, side) {
    if (mode === "emote" && now - emo.t0 < EMO_REPICK_MS) return false;
    clearEmoteSeek();
    if (mode === "emote" && emo.active) { emo.prevSnap = Object.assign({}, emo.snap); emo.prevAt = now; }
    kind = kind || pickKind();
    emo.kind = kind; emo.last = kind; emo.side = side || (ptrInfo && ptrInfo.side) || (Math.random() < 0.5 ? -1 : 1);
    emo.t0 = now; emo.u = 0; emo.beat = 0; emo.seek = false;
    begin("emote", now);
    const lines = FACE.lines[kind]; say(lines[Math.floor(Math.random() * lines.length)], now);
    return true;
  }
  function tickEmote(now, t) {
    const def = EMOTES[emo.kind];
    if (t >= def.ms) { emo.u = 1; toIdle(now); render(blend(idle(0, 0), now), now); return; }
    emo.u = t / def.ms;
    while (emo.beat < def.beats.length && def.beats[emo.beat].u <= emo.u) { fx(def.beats[emo.beat], emo.side); emo.beat++; }
    render(blend(emotePose(emo.kind, emo.u, emo.side, t), now), now);
  }
  // deterministic frame for screenshots: pose + face + bubble + particles frozen at `ms`
  function seekEmote(kind, ms, side) {
    live = false; const def = EMOTES[kind]; side = side || 1;
    emo.kind = kind; emo.side = side; emo.seek = true; emo.u = clamp(ms / def.ms, 0, 1);
    emo.prevSnap = null; emo.endAt = 0;
    clearFx();
    def.beats.forEach(function (b) {
      const bm = b.u * def.ms;
      if (ms >= bm && ms - bm < 1400) { lastPose = emotePose(kind, b.u, side, bm); fx(b, side, ms - bm); }
    });
    render(emotePose(kind, emo.u, side, ms), ms);
    bubble.textContent = FACE.lines[kind][0]; bubbleOn = true; bubbleUntil = Infinity; bubble.classList.add("show");
    updateBubble(performance.now(), true);
    return { kind: kind, ms: ms, u: emo.u, dur: def.ms };
  }
