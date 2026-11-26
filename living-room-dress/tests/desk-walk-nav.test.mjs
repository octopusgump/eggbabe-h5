import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const DeskNav = require(path.join(ROOT, "living-room-dress/desk-nav.js"));

test("DESK_WALK_POLY covers all wooden desk corners while excluding bed, books, mirror, sky, and right drop-off", () => {
  const { DESK_WALK_POLY, isPointInPolygon, clampPointToPolygon, DESK_CLICK_SNAP_MARGIN } = DeskNav;

  // 应完全可达的所有桌面角落
  const reachableCorners = [
    ["床前左下角", 210, 1520],
    ["床前最左侧边缘", 150, 1340],
    ["床前中段木桌", 680, 1540],
    ["床与书本间走廊", 1230, 1020],
    ["书本右侧近窗台角", 1420, 910],
    ["镜子左侧窗边", 1740, 1015],
    ["软木垫中心", 1520, 1205],
    ["镜子正前方", 1960, 1210],
    ["镜子右侧远端桌角", 2320, 1230],
    ["右前斜边桌角", 1990, 1580],
    ["左前桌沿", 180, 1600]
  ];
  for (const [label, x, y] of reachableCorners) {
    assert.equal(isPointInPolygon(x, y, DESK_WALK_POLY), true, `${label} (${x},${y}) 应在可走桌面多边形内`);
  }

  // 应排除的非桌面/障碍区
  const excludedPoints = [
    ["床垫中央", 620, 960],
    ["书本区域", 1040, 760],
    ["镜子底座中央", 2000, 1060],
    ["天空窗外", 1900, 420],
    ["右侧小圆边桌/地板悬空区", 2620, 1420]
  ];
  for (const [label, x, y] of excludedPoints) {
    assert.equal(isPointInPolygon(x, y, DESK_WALK_POLY), false, `${label} (${x},${y}) 不应在桌面多边形内`);
  }

  // 天空点击距离远大于吸附阈值，会被忽略；紧贴前桌沿的点击会自动吸附到桌沿
  const skySnap = clampPointToPolygon(1800, 420, DESK_WALK_POLY);
  assert.equal(skySnap.clamped, true);
  assert.ok(skySnap.dist > DESK_CLICK_SNAP_MARGIN);

  const edgeSnap = clampPointToPolygon(1520, 1660, DESK_WALK_POLY);
  assert.equal(edgeSnap.clamped, true);
  assert.ok(edgeSnap.dist <= DESK_CLICK_SNAP_MARGIN);
  assert.equal(isPointInPolygon(edgeSnap.x, edgeSnap.y, DESK_WALK_POLY), true);
});

test("findDeskPath routes around bed corner and mirror stand with 100% of sampled points inside DESK_WALK_POLY", () => {
  const { DESK_WALK_POLY, findDeskPath, buildPathSampler, isPointInPolygon } = DeskNav;

  const trips = [
    ["床前左下角 → 书本窗台角（需绕过木床前角与右角）", { x: 200, y: 1500 }, { x: 1380, y: 900 }],
    ["镜子左侧 → 镜子右侧远端桌角（需绕过镜座前缘）", { x: 1700, y: 1010 }, { x: 2350, y: 1235 }],
    ["最左床前角 → 最右桌角（跨全桌长途）", { x: 160, y: 1340 }, { x: 2360, y: 1245 }],
    ["软木垫 → 右前桌角（直线可达）", { x: 1520, y: 1205 }, { x: 1980, y: 1590 }]
  ];

  for (const [name, start, end] of trips) {
    const pts = findDeskPath(start, end, DESK_WALK_POLY);
    assert.ok(pts.length >= 2, `${name}: 至少包含起点和终点`);
    const sampler = buildPathSampler(pts);
    assert.ok(sampler.totalLen > 100, `${name}: 路径长度应有效`);

    // 对整条路径做 40 段密集采样，确保不穿床、不穿镜、不掉出桌外
    for (let i = 0; i <= 40; i++) {
      const s = sampler.sample((sampler.totalLen * i) / 40);
      assert.equal(
        isPointInPolygon(s.x, s.y, DESK_WALK_POLY),
        true,
        `${name} 第 ${i}/40 采样点 (${s.x.toFixed(1)}, ${s.y.toFixed(1)}) 跑出了木桌多边形`
      );
    }

    // 确认起点与终点精准对齐
    const p0 = sampler.sample(0);
    const p1 = sampler.sample(sampler.totalLen);
    assert.ok(Math.hypot(p0.x - start.x, p0.y - start.y) < 1);
    assert.ok(Math.hypot(p1.x - end.x, p1.y - end.y) < 1);
  }
});

test("computeWalkPoseState generates anti-phase bilateral steps, gentle bounce, contralateral arms, and monotonic step ticks", () => {
  const { computeWalkPoseState } = DeskNav;

  // env=0 时完全静止归零
  const rest = computeWalkPoseState(120, 190, 1, 0);
  assert.equal(rest.pose.legL, 0);
  assert.equal(rest.pose.legR, 0);
  assert.equal(rest.pose.hopY, 0);
  assert.equal(rest.pose.rot, 0);

  // 1/4 周期：左脚抬起最高，右脚支撑，左手后摆/右手前摆，微小步伐起伏而非大跳
  const q1 = computeWalkPoseState(48, 192, 1, 1);
  assert.ok(q1.pose.legL > 0.95);
  assert.ok(Math.abs(q1.pose.legL + q1.pose.legR) < 1e-6, "左右脚应严格反相");
  assert.ok(Math.abs(q1.pose.armL + q1.pose.legL) < 1e-6, "同侧手脚应反向摆动");
  assert.ok(q1.pose.hopY < 0 && q1.pose.hopY >= -18, "走路起伏应为柔和的小碎步微弹而非大跳");
  assert.ok(q1.pose.headTx > 0, "向右行走时头部微向右侧偏转");

  // 连续行走 600px 应触发约 6 次交替脚步节拍
  let prevStep = -1;
  let ticks = 0;
  for (let d = 0; d <= 600; d += 10) {
    const st = computeWalkPoseState(d, 192, -1, 1);
    if (st.stepIndex > prevStep) {
      if (prevStep >= 0) ticks++;
      prevStep = st.stepIndex;
    }
  }
  assert.ok(ticks >= 5 && ticks <= 7, `600px 应产生 5~7 步交替节拍，实际=${ticks}`);
});

test("index.html and living-room-dress/app.js wire desk-nav.js, walkMove, sfx.step, and remove legacy hopMove", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(ROOT, "living-room-dress/app.js"), "utf8");

  const deskNavIdx = html.indexOf("./living-room-dress/desk-nav.js");
  const appJsIdx = html.indexOf("./living-room-dress/app.js");
  assert.ok(deskNavIdx > 0 && appJsIdx > deskNavIdx, "index.html 应在 app.js 之前加载 desk-nav.js");

  assert.equal(appJs.includes("hopMove"), false, "app.js 不应残留旧版单段跳动 hopMove");
  assert.ok(appJs.includes("window.EggBabeDeskNav"), "app.js 应挂载 EggBabeDeskNav");
  assert.ok(appJs.includes("DeskNav.findDeskPath"), "app.js 应使用 DeskNav.findDeskPath 绕障寻路");
  assert.ok(appJs.includes("DeskNav.computeWalkPoseState"), "app.js 应使用 DeskNav.computeWalkPoseState 驱动步态");
  assert.ok(appJs.includes("sfx.step("), "app.js 应在走路触地时播放轻柔脚步声");
  assert.ok(appJs.includes("p.legL || p.legR"), "deformVertex 应具备双腿交替迈步形变");
});
