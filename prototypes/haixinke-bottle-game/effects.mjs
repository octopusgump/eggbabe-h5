import { koiAppearance } from './appearances.mjs';

const bottle = new Path2D('M -14 42 Q -18 42 -18 38 L -19 -14 Q -19 -20 -14 -23 L -9 -29 L -9 -36 L 9 -36 L 9 -29 L 14 -23 Q 19 -20 19 -14 L 18 38 Q 18 42 14 42 Z');
const cap = new Path2D('M -7.2 -42 H 7.2 Q 9 -42 9 -40.2 V -35 H -9 V -40.2 Q -9 -42 -7.2 -42 Z');
const tau = 2 * Math.PI;
export const impactDuration = 0.56;

// 焦糖咕噜内的气泡粒子。位置以瓶身为局部坐标（y 朝下为正，水线在 y=4 附近，瓶底在 y=40）。
// 初次创建时把气泡均匀铺在液面到瓶底之间，避免首次渲染全在瓶底。
function makeBubble(seedX, size, phase) {
  return { seedX, size, phase, x: seedX, y: 6 + ((phase * 7.3) % 32) };
}
const sodaBubbles = [
  makeBubble(-9, 1.0, 0.0),
  makeBubble(4, 1.4, 0.9),
  makeBubble(-2, 0.7, 1.7),
  makeBubble(11, 1.1, 2.4),
  makeBubble(-13, 0.6, 3.3),
  makeBubble(7, 0.85, 4.2),
  makeBubble(-6, 0.5, 5.0),
  makeBubble(2, 0.55, 5.7),
];

function oval(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, tau);
}

function paintMarker(ctx, point, confirmed) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.fillStyle = confirmed ? '#e2ffd4' : point.onTarget ? '#f9f9df' : '#fff0d6';
  oval(ctx, 0, 2.5, 28, 5.5);
  ctx.fill();
  ctx.strokeStyle = point.onTarget ? '#558366' : '#996b52';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 2]);
  oval(ctx, 0, 2, 23, 4);
  ctx.stroke();
  ctx.restore();
}

function paintImpact(ctx, point, age) {
  if (age < 0 || age >= 0.41) return;
  const spread = age / 0.41;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.globalAlpha = 1 - spread;
  ctx.strokeStyle = '#fff5c7';
  ctx.lineWidth = 1.8;
  oval(ctx, 0, 1, 19 + spread * 32, 3 + spread * 5);
  ctx.stroke();
  ctx.restore();
}

function paintWater(ctx, pose, age, colors = ['#75e9dd', '#389aaf']) {
  ctx.save();
  ctx.clip(bottle);
  ctx.rotate(-pose.angle);
  const spin = Math.abs(pose.omega ?? 0);
  const surge = Math.max(0, 1 - age / impactDuration);
  const swell = Math.min(spin * 0.7, 5) + surge * 7;
  const wave = swell * Math.sin((pose.elapsed ?? 0) * 21);
  const water = ctx.createLinearGradient(0, -8, 0, 44);
  water.addColorStop(0, colors[0]);
  water.addColorStop(1, colors[1]);
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.moveTo(-54, 2);
  ctx.bezierCurveTo(-27, 4 + wave, -12, -wave * 1.1, 5, 1);
  ctx.quadraticCurveTo(24, wave * 0.9, 54, 2);
  ctx.lineTo(54, 54);
  ctx.lineTo(-54, 54);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-44, 2);
  ctx.bezierCurveTo(-27, 4 + wave, -12, -wave * 1.1, 5, 1);
  ctx.quadraticCurveTo(24, wave * 0.9, 48, 2);
  ctx.strokeStyle = '#dafcf0';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (surge > 0) {
    ctx.globalAlpha = surge * 0.9;
    ctx.fillStyle = '#f0fffb';
    const beat = Math.sin(age * 5.3);
    for (const [x, height, size] of [[-11, 15, 2.4], [0, 23, 3], [10, 11, 1.8]]) {
      oval(ctx, x, -2 - height * beat, size * 0.86, size * 1.3);
      ctx.fill();
    }
  }
  ctx.restore();
}

function paintSodaGlass(ctx, pose, age) {
  // 深焦糖汽水 + 上浮气泡 + 落地泡沫。
  // 液面遵守重力:先在瓶身坐标里 clip,再反向旋转回世界系,把液面画成水平线。
  // 这样瓶子横躺时汽水会流向瓶身低端,而不是像胶水一样粘在瓶底。
  const spin = Math.abs(pose.omega ?? 0);
  const surge = Math.max(0, 1 - age / impactDuration);
  const swell = Math.min(spin * 0.7, 5) + surge * 7;
  const wave = swell * Math.sin((pose.elapsed ?? 0) * 21);
  const elapsed = pose.elapsed ?? 0;

  // 瓶身局部坐标里,液面"基准线"距离瓶中心(原点)沿瓶轴的偏移。
  // 瓶底 y=42、瓶口 y=-36,液面定在 y=4,即瓶中心下方 4px 处沿瓶轴。
  const levelLocal = 4;

  // ---- 第一步:画液体(世界系,液面水平)----
  // paintBottle 已经 translate(瓶中心) + rotate(pose.angle);
  // 我们再 rotate(-pose.angle) 把坐标系对齐回"以瓶中心为原点、不旋转"的世界系。
  // 此时瓶身局部点 (0, levelLocal) 在当前系里的位置是:
  //   R(pose.angle) · (0, levelLocal) = (-levelLocal·sin θ, levelLocal·cos θ)
  // 液面必须过这个点且水平(因为水受重力),所以液面方程:
  //   y = levelLocal · cos(pose.angle)
  // 同时液面"中点"在 x 方向要偏移 -levelLocal · sin(pose.angle)(用于波形居中)。
  ctx.save();
  ctx.clip(bottle);
  ctx.rotate(-pose.angle);

  const theta = pose.angle ?? 0;
  const surfaceY = levelLocal * Math.cos(theta);
  const surfaceX = -levelLocal * Math.sin(theta);
  const halfSpan = 60; // 画得比瓶身宽,由 clip 裁掉多余部分

  // 渐变方向沿世界"下"——从液面往瓶内低端逐渐加深
  const soda = ctx.createLinearGradient(0, surfaceY - 8, 0, surfaceY + 44);
  soda.addColorStop(0, '#b0622a');
  soda.addColorStop(0.18, '#7c3f14');
  soda.addColorStop(0.6, '#4a2409');
  soda.addColorStop(1, '#2a1204');
  ctx.fillStyle = soda;
  ctx.beginPath();
  ctx.moveTo(surfaceX - halfSpan, surfaceY);
  ctx.bezierCurveTo(surfaceX - 27, surfaceY + 2 + wave, surfaceX - 12, surfaceY - wave * 1.1, surfaceX + 5, surfaceY + 1);
  ctx.quadraticCurveTo(surfaceX + 24, surfaceY + wave * 0.9, surfaceX + halfSpan, surfaceY);
  ctx.lineTo(surfaceX + halfSpan, surfaceY + 60);
  ctx.lineTo(surfaceX - halfSpan, surfaceY + 60);
  ctx.closePath();
  ctx.fill();

  // 液面"金边"——一道浅橘色高光,让汽水看上去有油亮感
  ctx.strokeStyle = 'rgba(255, 178, 96, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(surfaceX - halfSpan + 6, surfaceY);
  ctx.bezierCurveTo(surfaceX - 27, surfaceY + 2 + wave, surfaceX - 12, surfaceY - wave * 1.1, surfaceX + 5, surfaceY + 1);
  ctx.quadraticCurveTo(surfaceX + 24, surfaceY + wave * 0.9, surfaceX + halfSpan - 6, surfaceY);
  ctx.stroke();

  // 落地瞬间水面涌一层厚实泡沫
  if (surge > 0) {
    ctx.globalAlpha = surge * 0.92;
    ctx.fillStyle = '#f8e6bc';
    const head = 3 + surge * 5;
    ctx.beginPath();
    ctx.moveTo(surfaceX - halfSpan, surfaceY);
    ctx.bezierCurveTo(surfaceX - 27, surfaceY + 2 + wave, surfaceX - 12, surfaceY - wave * 1.1, surfaceX + 5, surfaceY + 1);
    ctx.quadraticCurveTo(surfaceX + 24, surfaceY + wave * 0.9, surfaceX + halfSpan, surfaceY);
    ctx.lineTo(surfaceX + halfSpan, surfaceY + head);
    ctx.lineTo(surfaceX - halfSpan, surfaceY + head);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // ---- 第二步:画气泡(瓶身局部,沿瓶轴上浮)----
  // 气泡保持在瓶身坐标系,这样它们被瓶身 clip 自然约束。
  // "上浮"方向沿瓶轴朝瓶口,即瓶身局部 -y;瓶子横躺时气泡仍朝瓶口浮,
  // 这在视觉上可接受,因为气泡小、快,重力错位感不强。
  ctx.save();
  ctx.clip(bottle);
  for (const bubble of sodaBubbles) {
    const riseSpeed = 4 + bubble.size * 5;
    const drift = Math.sin(elapsed * 1.4 + bubble.phase) * 0.5;
    bubble.vy = -riseSpeed + spin * 1.4;
    bubble.y += bubble.vy * 0.016;
    bubble.x += (drift + Math.sin(pose.angle) * riseSpeed * 0.4) * 0.016;
    if (bubble.y < 5) {
      bubble.y = 36 + bubble.size * 2;
      bubble.x = bubble.seedX;
    }
    if (bubble.y > 40) bubble.y = 40;
    const limit = 14 - Math.max(0, (bubble.y - 4) * 0.04);
    if (bubble.x < -limit) bubble.x = -limit;
    if (bubble.x > limit) bubble.x = limit;

    ctx.fillStyle = 'rgba(255, 224, 178, 0.4)';
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.size, 0, tau);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 246, 224, 0.85)';
    ctx.beginPath();
    ctx.arc(bubble.x - bubble.size * 0.3, bubble.y - bubble.size * 0.35, bubble.size * 0.32, 0, tau);
    ctx.fill();
  }
  ctx.restore();

  // 玻璃反光条：一宽一窄斜向跨瓶身，让瓶壁显得硬、透
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.moveTo(-13.5, -20);
  ctx.lineTo(-11, -20);
  ctx.lineTo(-14.5, 32);
  ctx.lineTo(-16.5, 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.moveTo(11, -18);
  ctx.lineTo(13, -18);
  ctx.lineTo(15, 26);
  ctx.lineTo(13.5, 26);
  ctx.closePath();
  ctx.fill();
}

// 瓶中余烬：暖色熔岩团（橙红→品红，自瓶底向上涌）与冷色熔岩团（深紫，自液面向下压）。
// 全部用三角函数表达"缓慢对流"，不需要粒子状态。椭圆团的中心和半径随时间呼吸，模拟熔岩的脉动。
// 暖团周期 6–10 秒，振幅 ±10 px；冷团与暖团错开 Math.PI 相位，反向运动。
const warmBlobs = [
  { x: -7, phase: 0.0, period: 7.4, rx: 5.8, ry: 8.0, gradient: ['#ff6b3a', '#d43a6e'] },
  { x: 5, phase: 2.1, period: 9.2, rx: 6.8, ry: 9.6, gradient: ['#ff7a45', '#e0507a'] },
  { x: -1, phase: 4.4, period: 6.3, rx: 4.6, ry: 6.6, gradient: ['#ff5c30', '#c83268'] },
];
const coldBlobs = [
  { x: 7, phase: Math.PI, period: 8.6, rx: 5.2, ry: 7.4, gradient: ['#3a1a5e', '#1f0d3a'] },
  { x: -6, phase: Math.PI + 0.6, period: 10.2, rx: 6.0, ry: 8.6, gradient: ['#452a70', '#241140'] },
  { x: 2, phase: Math.PI + 1.8, period: 7.0, rx: 4.2, ry: 6.0, gradient: ['#341658', '#1a0a30'] },
];

function paintLavaLamp(ctx, pose, age) {
  const elapsed = pose.elapsed ?? 0;
  const spin = Math.abs(pose.omega ?? 0);
  const surge = Math.max(0, 1 - age / impactDuration);
  // 翻转（|omega| > 0.3）时熔岩被甩动，摆动幅度放大 1.5–2 倍；立稳的冲击另加一层衰减震荡。
  const fling = spin > 0.3 ? 1.5 + Math.min(spin, 2) * 0.25 : 1;
  const slosh = fling + surge * 0.9;

  ctx.save();
  ctx.clip(bottle);
  // 暗色基底：让熔岩看上去悬浮在暗紫介质里
  const base = ctx.createLinearGradient(0, -36, 0, 42);
  base.addColorStop(0, '#120818');
  base.addColorStop(1, '#1a0a2a');
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = base;
  ctx.fillRect(-20, -36, 40, 78);
  ctx.globalAlpha = 1;

  // 熔岩团用自身的不透明渐变叠在暗色基底上，软边互相渗透，暗色瓶身衬出荧光熔岩
  // 冷团先画（在底层），暖团后画（在顶层）：径向渐变的软边让相邻色团在交接处互相渗透。
  // 暖团以液面下 y=12 为上界、瓶底 y=36 为下界缓慢上浮回落；冷团反向，从 y=8 压向 y=32，与暖团错开相位。
  const paintBlobs = (blobs, surfaceEnd, bottomEnd) => {
    for (const { x, phase, period, rx, ry, gradient } of blobs) {
      const t = (elapsed / period) * tau + phase;
      const middle = (surfaceEnd + bottomEnd) / 2;
      const y = middle + Math.sin(t) * (bottomEnd - middle) * slosh;
      const breathe = 1 + Math.sin(elapsed * 1.3 + phase * 2.1) * 0.15;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, rx * breathe * 2.1);
      glow.addColorStop(0, gradient[0]);
      glow.addColorStop(0.55, gradient[1]);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      oval(ctx, x, y, rx * breathe, ry * breathe);
      ctx.fill();
    }
  };
  paintBlobs(coldBlobs, 8, 32);
  paintBlobs(warmBlobs, 12, 36);
  // 立稳的 0.56 s 内，两团之间叠一层薄的"被震动激活"高光
  if (surge > 0) {
    ctx.fillStyle = `rgba(255, 220, 200, ${surge * 0.3})`;
    oval(ctx, 0, 22, 15, 20);
    ctx.fill();
  }
  ctx.restore();
}

// 瓶中有鲤：预览和球场各用自己的鱼和动画时钟。
const koiByCanvas = new WeakMap();
const initialKoi = { elapsed: 0, x: 0, y: 22, vx: 2, vy: 0, turn: 0, tailPhase: 0 };
const koiGlints = [[-12, 12, 0.5], [8, 10, 0.3], [13, 19, 0.6], [-14, 28, 0.4], [3, 34, 0.5], [11, 37, 0.3]];

function koiSwimBounds(heading) {
  // 摆动的尾鳍比鱼头伸得更远，掉头时也要留出空间。
  return [-10.5 + Math.max(0, heading) * 5, 10.5 + Math.min(0, heading) * 5];
}

export function advanceKoi(ctx, pose, age, elapsed = pose.elapsed ?? 0) {
  const previous = koiByCanvas.get(ctx) ?? initialKoi;
  const koi = elapsed < previous.elapsed ? initialKoi : previous;
  const dt = Math.min(elapsed - koi.elapsed, 0.05);
  if (dt === 0) {
    koiByCanvas.set(ctx, koi);
    return koi;
  }
  const omega = pose.result ? 0 : (pose.omega ?? 0);
  const spin = Math.abs(omega);
  const settled = pose.result === 'success';
  const calm = settled || (age >= 0 && age < impactDuration && spin < 0.1);
  const direction = Math.sign(koi.vx) || (koi.turn < 0.5 ? 1 : -1);
  const speed = calm ? 1.5 : 5;
  const drag = 1 - Math.exp(-dt * 6);
  const fling = spin > 0.5;
  const flowX = fling ? -Math.sin(pose.angle) * spin * 2 : 0;
  const flowY = fling ? Math.sin(elapsed * 7.3) * omega : 0;
  const vx = koi.vx + (direction * speed + flowX - koi.vx) * drag;
  const driftY = Math.sin(elapsed * 0.4) * (calm ? 0.35 : 1.5);
  const vy = koi.vy + (driftY + flowY - koi.vy) * drag;
  const turn = Math.max(0, Math.min(1, koi.turn + (vx < 0 ? 1 : -1) * dt / 0.4));
  const heading = Math.cos(turn * Math.PI);
  const y = koi.y + vy * dt;
  const x = koi.x + vx * dt;
  const [left, right] = koiSwimBounds(heading);
  const next = {
    elapsed, turn,
    x: Math.max(left, Math.min(right, x)),
    y: Math.max(9, Math.min(34, y)),
    vx: (x < left && vx < 0) || (x > right && vx > 0) ? -vx * 0.7 : vx,
    vy: y < 9 || y > 34 ? -vy * 0.7 : vy,
    tailPhase: (koi.tailPhase + dt * tau * (calm ? 0.6 : 1.8)) % tau,
  };
  koiByCanvas.set(ctx, next);
  return next;
}

function paintKoi(ctx, { x, y, turn, tailPhase }, angle) {
  const heading = Math.cos(turn * Math.PI);
  const sway = Math.sin(tailPhase);
  const tail = sway * 6.4;
  // 水线保持水平。翻转经过水面时，把鱼沿重力方向推回水中。
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const depth = Math.max(0, 9 - (x * sin + y * cos));
  const [left, right] = koiSwimBounds(heading);
  const swimX = Math.max(left, Math.min(right, x + depth * sin));
  const swimY = y + depth * cos;
  // 瓶壁挡住横向位移时，用剩余的纵向空间补偿。接近横躺时平滑减弱补偿。
  const remaining = Math.max(0, 9 - (swimX * sin + swimY * cos));
  const submergedY = swimY + remaining * cos / Math.max(0.04, cos * cos);
  ctx.save();
  ctx.translate(swimX, Math.max(-13, Math.min(34, submergedY)));
  ctx.scale(heading, 1);
  ctx.rotate(sway * 0.15);

  ctx.save();
  ctx.translate(-6, tail);
  ctx.rotate(sway * Math.PI / 15);
  ctx.fillStyle = '#f5cfa0';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-4, -2);
  ctx.lineTo(-3.4, 0);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#fff4e0';
  ctx.beginPath();
  ctx.moveTo(-6, tail);
  ctx.bezierCurveTo(-3, tail, -3, -2.6, 2, -2.4);
  ctx.bezierCurveTo(8.5, -2.5, 8.5, 2.5, 2, 2.4);
  ctx.bezierCurveTo(-3, 2.6, -3, tail + 1.3, -6, tail + 0.7);
  ctx.closePath();
  ctx.moveTo(6.8, 0);
  ctx.ellipse(2.3, 0, 4.5, 2.4, 0, 0, tau);
  ctx.fill();
  ctx.fillStyle = '#e8823a';
  oval(ctx, 0.7, -1.1, 2.2, 1);
  ctx.fill();
  ctx.fillStyle = '#1a0d08';
  oval(ctx, 5.1, -0.5, 0.4, 0.4);
  ctx.fill();
  ctx.restore();
}

function paintKoiBottle(ctx, pose, age) {
  const glass = ctx.createLinearGradient(-19, 0, 19, 0);
  glass.addColorStop(0, '#acd7cebb');
  glass.addColorStop(0.5, '#ebfff43b');
  glass.addColorStop(1, '#acd7cebb');
  ctx.fillStyle = glass;
  ctx.fill(bottle);
  paintWater(ctx, pose, age, ['#a8d8d0', '#5c9a92']);

  ctx.save();
  ctx.clip(bottle);
  paintKoi(ctx, advanceKoi(ctx, pose, age), pose.angle);
  ctx.fillStyle = '#fff4e0a8';
  for (const [x, y, radius] of koiGlints) {
    oval(ctx, x, y, radius, radius);
    ctx.fill();
  }
  ctx.strokeStyle = '#effff4a8';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, -12);
  ctx.lineTo(-10, -4);
  ctx.stroke();
  ctx.restore();
}

export function paintBottle(ctx, pose, age, appearance) {
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  const isSoda = appearance === 'cream-label';
  // 存档 id 沿用 mint-cap，显示名为「瓶中余烬」
  const isLava = appearance === 'mint-cap';
  const isKoi = appearance === koiAppearance;
  if (isSoda) {
    paintSodaGlass(ctx, pose, age);
    // 玻璃高光薄雾：边缘略亮、中心几乎完全透明，让背景透过来
    const glass = ctx.createLinearGradient(-19, 0, 19, 0);
    glass.addColorStop(0, 'rgba(210, 228, 220, 0.5)');
    glass.addColorStop(0.18, 'rgba(232, 244, 238, 0.14)');
    glass.addColorStop(0.5, 'rgba(242, 250, 245, 0.04)');
    glass.addColorStop(0.82, 'rgba(232, 244, 238, 0.14)');
    glass.addColorStop(1, 'rgba(210, 228, 220, 0.5)');
    ctx.fillStyle = glass;
    ctx.fill(bottle);
  } else if (isLava) {
    paintLavaLamp(ctx, pose, age);
  } else if (isKoi) {
    paintKoiBottle(ctx, pose, age);
  } else {
    const plastic = ctx.createLinearGradient(-19, 0, 19, 0);
    plastic.addColorStop(0, '#a5c9bd');
    plastic.addColorStop(0.24, '#f5ffef');
    plastic.addColorStop(0.75, '#f8fcf4');
    plastic.addColorStop(1, '#aac4b5');
    ctx.fillStyle = plastic;
    ctx.fill(bottle);
    paintWater(ctx, pose, age);
  }
  ctx.lineWidth = 1.45;
  ctx.strokeStyle = '#406d63';
  ctx.stroke(bottle);
  if (!isSoda && !isLava && !isKoi) {
    ctx.fillStyle = '#ffffffc4';
    ctx.fillRect(-12, -13, 2.5, 29);
  }
  ctx.fillStyle = '#a9463a';
  ctx.fill(cap);
  ctx.stroke(cap);
  ctx.strokeStyle = '#f6a693';
  ctx.lineWidth = 0.75;
  for (const x of [-5, -2, 1, 4]) {
    ctx.beginPath();
    ctx.moveTo(x, -40.5);
    ctx.lineTo(x, -36.5);
    ctx.stroke();
  }
  ctx.restore();
}

function paintWobble(ctx, pose, impact, age) {
  const spin = Math.abs(pose.omega ?? 0);
  if (!impact?.onTarget || age < 0 || age >= 0.47 || spin < 0.31) return;
  ctx.save();
  ctx.globalAlpha = (1 - age / 0.47) * 0.48;
  ctx.strokeStyle = '#f8feeb';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  const headX = pose.x + Math.sin(pose.angle) * 29;
  const headY = pose.y - Math.cos(pose.angle) * 29;
  for (const direction of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(headX + direction * 16, headY - 7);
    ctx.quadraticCurveTo(headX + direction * 24, headY, headX + direction * 21, headY + 7);
    ctx.stroke();
  }
  ctx.restore();
}

function paintOutcome(ctx, pose, target, impact) {
  if (!pose.result || pose.result === 'miss') return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pose.result === 'success') {
    const x = pose.x;
    const y = pose.y - 63;
    ctx.fillStyle = '#3c7257';
    oval(ctx, x, y, 10, 10);
    ctx.fill();
    ctx.strokeStyle = '#fffced';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x - 1, y + 3);
    ctx.lineTo(x + 4, y - 3);
    ctx.stroke();
  } else if (pose.result === 'edge') {
    const direction = pose.x >= (target.left + target.right) / 2 ? 1 : -1;
    const edge = direction === 1 ? target.right : target.left;
    ctx.strokeStyle = '#8b4b31';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(edge - direction * 10, target.y - 7);
    ctx.quadraticCurveTo(edge + direction * 13, target.y - 5, edge + direction * 25, target.y + 20);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#ad6a48';
    ctx.lineWidth = 1.6;
    oval(ctx, impact?.x ?? pose.x, (impact?.y ?? target.y) + 3, 28, 5);
    ctx.stroke();
  }
  ctx.restore();
}

function paintShadow(ctx, pose, layout, floorY) {
  const { target, desk } = layout;
  const surfaces = desk ? [target, desk] : [target];
  const surface = surfaces.find(({ left, right, y }) => pose.x >= left && pose.x <= right && pose.y < y - 10);
  const rise = Math.max(0, (surface?.y ?? floorY) - pose.y - 42);
  ctx.fillStyle = '#49342330';
  oval(ctx, pose.x, surface ? surface.y + 2 : floorY + 1, 17 + rise * 0.054, 3.5);
  ctx.fill();
}

export function paintEffects(ctx, { layout, pose, cue, impact, outcomeTarget, impactAge = Infinity, appearance, stageTime }, floorY) {
  paintShadow(ctx, pose, layout, floorY);
  if (cue) paintMarker(ctx, cue, false);
  if (pose.result === 'success') paintMarker(ctx, { x: pose.x, y: layout.target.y, onTarget: true }, true);
  if (impact) paintImpact(ctx, impact, impactAge);
  const bottlePose = appearance === koiAppearance
    ? { ...pose, elapsed: stageTime, omega: pose.result ? 0 : pose.omega }
    : pose;
  paintBottle(ctx, bottlePose, impactAge, appearance);
  paintWobble(ctx, pose, impact, impactAge);
  paintOutcome(ctx, pose, outcomeTarget ?? layout.target, impact);
}
