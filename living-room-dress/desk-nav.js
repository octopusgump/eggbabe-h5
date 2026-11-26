/* ==========================================================================
   EggBabe 全桌面导航与程序化步态模块 (desk-nav.js)
   - 基于 12 顶点实景桌面多边形覆盖木桌全部角落（床前左侧、书本窗台前、镜子右侧与前桌沿）
   - 内置轻量可见图最短路 + 圆角平滑，自动绕开木床与镜座，不穿模不卡死
   - 距离驱动双足步态曲线（零滑步）：左右脚交替抬迈、企鹅摇摆、微幅起伏、头部稳定与脚步节拍
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeDeskNav = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // 主木桌实景可行走多边形（2823 x 1672 全景坐标系，顺时针）
  // 精准贴合：床前左角 → 床底前角 → 床右侧 → 书本前缘 → 窗台踢脚线 → 镜座前缘绕行 → 右后桌角 → 右前斜边 → 左前桌角
  const DESK_WALK_POLY = Object.freeze([
    Object.freeze({ x: 130, y: 1295 }),   // 0: 床前最左侧木桌角
    Object.freeze({ x: 545, y: 1455 }),   // 1: 木床最前凸圆角
    Object.freeze({ x: 1190, y: 1145 }),  // 2: 木床右前角
    Object.freeze({ x: 1185, y: 960 }),   // 3: 床与书本之间走廊
    Object.freeze({ x: 1385, y: 865 }),   // 4: 书本右侧近窗台踢脚线
    Object.freeze({ x: 1795, y: 988 }),   // 5: 镜子左侧踢脚线
    Object.freeze({ x: 1825, y: 1100 }),  // 6: 镜座左前角
    Object.freeze({ x: 2105, y: 1185 }),  // 7: 镜座右前角
    Object.freeze({ x: 2205, y: 1140 }),  // 8: 镜座右侧近窗台
    Object.freeze({ x: 2425, y: 1210 }),  // 9: 桌面最右后角（靠小圆边桌）
    Object.freeze({ x: 2040, y: 1625 }),  // 10: 桌面右前斜边角
    Object.freeze({ x: 130, y: 1625 })    // 11: 桌面左前角
  ]);

  // 凹角绕行导航点（略微内缩于木床前角/右角与镜座左右角）
  const DESK_DETOUR_WAYPOINTS = Object.freeze([
    Object.freeze({ x: 560, y: 1495 }),
    Object.freeze({ x: 1235, y: 1175 }),
    Object.freeze({ x: 1790, y: 1138 }),
    Object.freeze({ x: 2125, y: 1222 }),
    Object.freeze({ x: 1520, y: 1205 })
  ]);

  // 自定义纯色/主题背景下的宽敞可行走区域
  const CUSTOM_BG_WALK_POLY = Object.freeze([
    Object.freeze({ x: 780, y: 980 }),
    Object.freeze({ x: 2040, y: 980 }),
    Object.freeze({ x: 2040, y: 1480 }),
    Object.freeze({ x: 780, y: 1480 })
  ]);

  // 点击桌面时的容错吸附边距（px）：点击紧贴桌边/床沿时自动吸附到最近桌面角落，点击天空/墙面则忽略
  const DESK_CLICK_SNAP_MARGIN = 115;

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq <= 1e-8) {
      return { x: ax, y: ay, dist: Math.hypot(px - ax, py - ay) };
    }
    const t = clamp(((px - ax) * abx + (py - ay) * aby) / abLenSq, 0, 1);
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
  }

  function isPointInPolygon(x, y, poly) {
    const n = poly.length;
    if (n < 3) return false;
    // 先检查是否落在边界上（允许微小浮点误差）
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = poly[j], b = poly[i];
      if (closestPointOnSegment(x, y, a.x, a.y, b.x, b.y).dist <= 0.75) {
        return true;
      }
    }
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function clampPointToPolygon(px, py, poly) {
    if (isPointInPolygon(px, py, poly)) {
      return { x: px, y: py, clamped: false, dist: 0 };
    }
    const n = poly.length;
    let best = { x: poly[0].x, y: poly[0].y, dist: Infinity };
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const cand = closestPointOnSegment(px, py, poly[j].x, poly[j].y, poly[i].x, poly[i].y);
      if (cand.dist < best.dist) best = cand;
    }
    return { x: best.x, y: best.y, clamped: true, dist: best.dist };
  }

  function segmentsProperlyCross(a, b, c, d) {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const d1 = cross(a, b, c);
    const d2 = cross(a, b, d);
    const d3 = cross(c, d, a);
    const d4 = cross(c, d, b);
    const eps = 1e-4;
    return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) &&
      ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
  }

  function isSegmentInsidePolygon(a, b, poly) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 1e-4) return isPointInPolygon(a.x, a.y, poly);
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      if (segmentsProperlyCross(a, b, poly[j], poly[i])) {
        return false;
      }
    }
    const samples = Math.max(8, Math.ceil(len / 32));
    for (let k = 1; k < samples; k++) {
      const t = k / samples;
      const sx = a.x + (b.x - a.x) * t;
      const sy = a.y + (b.y - a.y) * t;
      if (!isPointInPolygon(sx, sy, poly)) return false;
    }
    return true;
  }

  function smoothPathCorners(pts, poly) {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const next = pts[i + 1];
      const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
      const r = Math.min(58, d1 * 0.34, d2 * 0.34);
      if (r < 12) {
        out.push(curr);
        continue;
      }
      const pA = {
        x: curr.x + ((prev.x - curr.x) / d1) * r,
        y: curr.y + ((prev.y - curr.y) / d1) * r
      };
      const pB = {
        x: curr.x + ((next.x - curr.x) / d2) * r,
        y: curr.y + ((next.y - curr.y) / d2) * r
      };
      const arc = [];
      let allInside = true;
      const segs = 4;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const omt = 1 - t;
        const qx = omt * omt * pA.x + 2 * omt * t * curr.x + t * t * pB.x;
        const qy = omt * omt * pA.y + 2 * omt * t * curr.y + t * t * pB.y;
        if (!isPointInPolygon(qx, qy, poly)) {
          allInside = false;
          break;
        }
        arc.push({ x: qx, y: qy });
      }
      if (allInside) {
        for (let k = 0; k < arc.length; k++) out.push(arc[k]);
      } else {
        out.push(curr);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function findDeskPath(start, end, poly, waypoints) {
    const activePoly = poly || DESK_WALK_POLY;
    const activeWaypoints = waypoints || (activePoly === DESK_WALK_POLY ? DESK_DETOUR_WAYPOINTS : []);
    const s = clampPointToPolygon(start.x, start.y, activePoly);
    const e = clampPointToPolygon(end.x, end.y, activePoly);
    const sp = { x: s.x, y: s.y };
    const ep = { x: e.x, y: e.y };

    if (Math.hypot(ep.x - sp.x, ep.y - sp.y) < 2) {
      return [sp, ep];
    }
    if (isSegmentInsidePolygon(sp, ep, activePoly)) {
      return [sp, ep];
    }

    const nodes = [sp];
    for (let i = 0; i < activeWaypoints.length; i++) {
      const wp = activeWaypoints[i];
      if (isPointInPolygon(wp.x, wp.y, activePoly)) nodes.push(wp);
    }
    nodes.push(ep);

    const N = nodes.length;
    const dist = new Array(N).fill(Infinity);
    const prev = new Array(N).fill(-1);
    const used = new Array(N).fill(false);
    dist[0] = 0;

    for (let iter = 0; iter < N; iter++) {
      let u = -1;
      for (let i = 0; i < N; i++) {
        if (!used[i] && (u === -1 || dist[i] < dist[u])) u = i;
      }
      if (u === -1 || dist[u] === Infinity || u === N - 1) break;
      used[u] = true;
      for (let v = 0; v < N; v++) {
        if (used[v] || v === u) continue;
        const w = Math.hypot(nodes[v].x - nodes[u].x, nodes[v].y - nodes[u].y);
        if (dist[u] + w >= dist[v]) continue;
        if (isSegmentInsidePolygon(nodes[u], nodes[v], activePoly)) {
          dist[v] = dist[u] + w;
          prev[v] = u;
        }
      }
    }

    if (prev[N - 1] === -1) {
      // 兜底：保证不会中断移动
      return [sp, ep];
    }

    const raw = [];
    for (let cur = N - 1; cur !== -1; cur = prev[cur]) {
      raw.push(nodes[cur]);
    }
    raw.reverse();
    return smoothPathCorners(raw, activePoly);
  }

  function buildPathSampler(points) {
    const pts = points && points.length >= 2 ? points : [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    const cumLen = [0];
    let totalLen = 0;
    for (let i = 1; i < pts.length; i++) {
      totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      cumLen.push(totalLen);
    }
    return {
      points: pts,
      totalLen,
      sample(distAlong) {
        if (totalLen <= 1e-4) {
          const p = pts[pts.length - 1];
          return { x: p.x, y: p.y, dx: 0, dy: 0, progress: 1 };
        }
        const d = clamp(distAlong, 0, totalLen);
        let segIdx = 0;
        for (let i = 1; i < cumLen.length; i++) {
          if (d <= cumLen[i] || i === cumLen.length - 1) {
            segIdx = i - 1;
            break;
          }
        }
        const a = pts[segIdx];
        const b = pts[segIdx + 1];
        const segLen = Math.max(1e-5, cumLen[segIdx + 1] - cumLen[segIdx]);
        const t = clamp((d - cumLen[segIdx]) / segLen, 0, 1);
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          dx: (b.x - a.x) / segLen,
          dy: (b.y - a.y) / segLen,
          progress: d / totalLen
        };
      }
    };
  }

  /**
   * 距离驱动的程序化小碎步走路姿态（零滑步、兼容全部 36 套单图换装）
   * @param {number} walkDist - 累计行走弧长（PANO px）
   * @param {number} strideLen - 单次完整左右步周期弧长（默认约 190px * depthScale）
   * @param {number} walkDir - 水平前进方向 [-1, 1]
   * @param {number} env - 起步/停步包络强度 [0, 1]
   */
  function computeWalkPoseState(walkDist, strideLen, walkDir, env) {
    const e = clamp(env, 0, 1);
    const dir = clamp(walkDir || 0, -1, 1);
    const safeStride = Math.max(55, strideLen || 190);
    const phase = (walkDist / safeStride) * Math.PI * 2;
    const stepIndex = Math.floor(phase / Math.PI);

    if (e <= 1e-6) {
      return {
        phase,
        stepIndex,
        pose: {
          hopY: 0, rot: 0, sx: 1, sy: 1, breath: 0,
          headRot: 0, headTx: 0, headTy: 0, earL: 0, earR: 0,
          lean: 0, wClosed: 0, wDoze: 0, shS: 1, shO: 1, shShiftX: 0,
          legL: 0, legR: 0, armL: 0, armR: 0, walkDir: 0
        }
      };
    }

    const s = Math.sin(phase);
    const absS = Math.abs(s);

    return {
      phase,
      stepIndex,
      pose: {
        hopY: -absS * 16 * e,
        rot: (-s * 4.8 + dir * 2.2) * e,
        sx: 1 + (0.028 - absS * 0.044) * e,
        sy: 1 + (-0.026 + absS * 0.044) * e,
        breath: 0.012 * Math.cos(phase * 2) * e,
        headRot: (s * 3.0 + dir * 3.4) * e,
        headTx: dir * 9.5 * e,
        headTy: -absS * 2.6 * e,
        earL: (-4 - s * 7.5 - dir * 4.5) * e,
        earR: (4 - s * 7.5 - dir * 4.5) * e,
        lean: dir * 0.62 * e,
        wClosed: 0,
        wDoze: 0,
        shS: 1 - absS * 0.08 * e,
        shO: 1 - absS * 0.11 * e,
        shShiftX: -s * 7.5 * e,
        legL: s * e,
        legR: -s * e,
        armL: -s * e,
        armR: s * e,
        walkDir: dir * e
      }
    };
  }

  return {
    DESK_WALK_POLY,
    DESK_DETOUR_WAYPOINTS,
    CUSTOM_BG_WALK_POLY,
    DESK_CLICK_SNAP_MARGIN,
    closestPointOnSegment,
    isPointInPolygon,
    clampPointToPolygon,
    isSegmentInsidePolygon,
    findDeskPath,
    buildPathSampler,
    computeWalkPoseState
  };
});
