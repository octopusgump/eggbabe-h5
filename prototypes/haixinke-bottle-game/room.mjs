import { paintEffects } from './effects.mjs';

const width = 360;
const height = 420;
const floorY = 404;

function rounded(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function pill(ctx, x, y, width, height, radius, fill) {
  rounded(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function gradient(ctx, x1, y1, x2, y2, ...colors) {
  const shade = ctx.createLinearGradient(x1, y1, x2, y2);
  colors.forEach((color, index) => shade.addColorStop(index / (colors.length - 1), color));
  return shade;
}

function oval(ctx, x, y, radiusX, radiusY, fill, angle = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, angle, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function shadow(ctx, x, y, width, height, radius, fill, opacity = 0.2) {
  ctx.save();
  ctx.shadowColor = `rgba(81, 53, 35, ${opacity})`;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.shadowOffsetX = 3;
  pill(ctx, x, y, width, height, radius, fill);
  ctx.restore();
}

function drawWindow(ctx) {
  const glass = gradient(ctx, 31, 46, 100, 123, '#6babab', '#a5d2c5', '#f0deac');
  shadow(ctx, 20, 34, 99, 100, 10, gradient(ctx, 20, 34, 119, 134, '#f8ecd1', '#c7b88c'));
  pill(ctx, 25, 39, 89, 89, 6, '#969f83');
  pill(ctx, 28, 42, 83, 83, 5, glass);
  ctx.save();
  rounded(ctx, 28, 42, 83, 83, 5);
  ctx.clip();
  oval(ctx, 83, 64, 9, 9, '#f8e8b7');
  oval(ctx, 49, 76, 17, 4, 'rgba(251, 249, 218, .66)');
  oval(ctx, 46, 72, 8, 6, 'rgba(251, 249, 218, .59)');
  oval(ctx, 97, 87, 14, 4, 'rgba(251, 249, 218, .48)');
  oval(ctx, 39, 145, 59, 52, '#9ab49b', -0.18);
  oval(ctx, 95, 152, 47, 47, '#769e8b', 0.2);
  ctx.restore();
  pill(ctx, 66, 41, 5, 86, 2, gradient(ctx, 66, 41, 71, 41, '#f9eaca', '#c8b995'));
  pill(ctx, 26, 84, 87, 5, 2, gradient(ctx, 26, 84, 26, 89, '#fff2d5', '#c8b995'));
  shadow(ctx, 15, 126, 110, 8, 4, gradient(ctx, 15, 126, 15, 134, '#fff1cf', '#cbad7f'), 0.16);
  pill(ctx, 17, 127, 105, 1.5, 1, '#fff8e8');
}

function drawBook(ctx, x, y, width, height, cover) {
  pill(ctx, x, y, width, height, 2, cover);
  pill(ctx, x + 2, y + 2, 1.3, height - 4, 1, 'rgba(255, 244, 215, .4)');
  pill(ctx, x + 3, y + height * 0.22, width - 6, 1.4, 0.7, 'rgba(255, 249, 225, .54)');
  pill(ctx, x + 3, y + height * 0.32, width - 6, 1.2, 0.6, 'rgba(255, 249, 225, .32)');
}

function drawShelf(ctx) {
  shadow(ctx, 226, 132, 116, 9, 3, gradient(ctx, 226, 132, 226, 141, '#dcb082', '#ad784e'), 0.23);
  pill(ctx, 228, 133, 110, 1.4, 1, '#efcaa3');
  pill(ctx, 236, 140, 5, 13, 2, '#be9270');
  pill(ctx, 327, 140, 5, 13, 2, '#be9270');
  drawBook(ctx, 240, 101, 11, 31, gradient(ctx, 240, 102, 252, 103, '#a67565', '#d59277', '#9c655a'));
  drawBook(ctx, 253, 93, 12, 39, gradient(ctx, 253, 93, 265, 93, '#6d8d80', '#a6bf9c', '#6c8d80'));
  ctx.save();
  ctx.translate(269, 132);
  ctx.rotate(0.21);
  drawBook(ctx, 0, -27, 11, 27, gradient(ctx, 0, -27, 11, -27, '#bc8a44', '#e7b864', '#b18243'));
  ctx.restore();

  oval(ctx, 312, 133, 16, 3, 'rgba(95, 65, 47, .23)');
  const stem = '#6c8461';
  ctx.beginPath();
  ctx.moveTo(312, 115);
  ctx.quadraticCurveTo(308, 97, 314, 85);
  ctx.moveTo(312, 111);
  ctx.quadraticCurveTo(315, 104, 324, 99);
  ctx.moveTo(313, 112);
  ctx.quadraticCurveTo(308, 105, 300, 103);
  ctx.strokeStyle = stem;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  oval(ctx, 307, 94, 4, 9, '#8fa579', -0.72);
  oval(ctx, 316, 87, 3.9, 8, '#7e9a6c', 0.45);
  oval(ctx, 323, 99, 4.2, 8, '#91a774', 0.95);
  oval(ctx, 300, 102, 4, 8, '#768e65', -0.94);
  ctx.beginPath();
  ctx.moveTo(299, 112);
  ctx.lineTo(326, 112);
  ctx.lineTo(322, 129);
  ctx.quadraticCurveTo(312, 135, 303, 129);
  ctx.closePath();
  ctx.fillStyle = gradient(ctx, 299, 114, 326, 127, '#ce9274', '#ebb89c', '#ad765b');
  ctx.fill();
  oval(ctx, 312.5, 112, 13.5, 3.2, '#b07a60');
  oval(ctx, 312.5, 111.5, 10.6, 1.7, '#775e43');
}

function drawRack(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#a58c65';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(263, 347);
  ctx.lineTo(276, 242);
  ctx.lineTo(327, 242);
  ctx.lineTo(342, 347);
  ctx.moveTo(268, 309);
  ctx.lineTo(337, 309);
  ctx.stroke();
  pill(ctx, 265, 236, 72, 7, 3, gradient(ctx, 265, 236, 265, 243, '#ead0a4', '#bc996d'));
  pill(ctx, 275, 239, 28, 58, 5, gradient(ctx, 275, 242, 303, 292, '#d49880', '#e5a58e', '#b97d67'));
  pill(ctx, 278, 242, 3, 51, 2, 'rgba(250, 213, 176, .36)');
  pill(ctx, 306, 240, 22, 45, 4, gradient(ctx, 306, 240, 328, 282, '#a4b9ab', '#77988a'));
  pill(ctx, 307, 274, 20, 4, 1, 'rgba(233, 235, 207, .52)');
  pill(ctx, 279, 233, 3.5, 12, 1.5, '#eccc96');
  pill(ctx, 310, 233, 3.5, 12, 1.5, '#eccc96');
  ctx.restore();
}

function drawDesk(ctx, target, floorY) {
  const {left, right, y} = target;
  const width = right - left;
  oval(ctx, left + width / 2 + 3, floorY + 3, width / 2 + 8, 7, 'rgba(101, 68, 43, .18)');
  pill(ctx, left + 12, y + 9, 12, floorY - y - 8, 3, '#b37d55');
  pill(ctx, right - 24, y + 9, 12, floorY - y - 8, 3, '#9a6948');
  shadow(ctx, left + 3, y + 8, width - 6, 37, 5, gradient(ctx, left, y + 8, right, y + 45, '#daa674', '#c88d5e', '#a97750'));
  pill(ctx, left + 24, y + 17, width - 48, 16, 4, '#a6744f');
  pill(ctx, left + 25, y + 17, width - 50, 14, 4, gradient(ctx, left, y + 17, left, y + 32, '#dca879', '#c79566'));
  oval(ctx, left + width / 2 + 1, y + 24, 6, 3, 'rgba(104, 69, 39, .29)');
  pill(ctx, left + width / 2 - 5, y + 21, 10, 4, 2, '#eed9a9');
  pill(ctx, left, y, width, 12, 3, gradient(ctx, left, y, left, y + 12, '#fef0c9', '#ecc18d', '#ca9968'));
  pill(ctx, left + 3, y + 1, width - 6, 1.5, 1, '#fff1d4');
  pill(ctx, left + 1, y + 10, width - 2, 1.1, 1, 'rgba(137, 84, 43, .48)');

  ctx.lineWidth = 0.6;
  ctx.strokeStyle = 'rgba(152, 101, 52, .28)';
  [5, 7.5, 9].forEach((offset, index) => {
    ctx.beginPath();
    ctx.moveTo(left + 10 + index * 17, y + offset);
    ctx.bezierCurveTo(left + 68, y + offset + 1, right - 58, y + offset - 1, right - 17 - index * 13, y + offset);
    ctx.stroke();
  });
}

function paintRoom(ctx, {width, height, target, floorY}) {
  ctx.save();
  ctx.fillStyle = gradient(ctx, 0, 0, width, height, '#ebe1c4', '#e2e2c8', '#b8c4a9');
  ctx.fillRect(0, 0, width, height);
  const sunlight = ctx.createRadialGradient(60, 63, 10, 99, 111, 219);
  sunlight.addColorStop(0, 'rgba(255, 250, 218, .62)');
  sunlight.addColorStop(1, 'rgba(255, 250, 218, 0)');
  ctx.fillStyle = sunlight;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(119, 119, 88, .11)';
  for (let y = 5; y < floorY; y += 7) {
    for (let x = 4; x < width; x += 7) {
      if (x > 125 && x < 222) continue;
      ctx.fillRect(x + Math.sin(x * 3 + y) * 2, y + Math.cos(y + x) * 2, 0.65, 0.65);
    }
  }
  ctx.fillStyle = gradient(ctx, 0, 334, 0, floorY, 'rgba(132, 147, 111, .2)', 'rgba(132, 147, 111, .38)');
  ctx.fillRect(0, 334, width, floorY - 334);
  ctx.fillStyle = 'rgba(253, 247, 212, .64)';
  ctx.fillRect(0, 333, width, 2);
  ctx.fillStyle = gradient(ctx, 0, floorY, 0, height, '#a99b7a', '#cfb891');
  ctx.fillRect(0, floorY, width, height - floorY);
  ctx.fillStyle = 'rgba(244, 226, 181, .65)';
  ctx.fillRect(0, floorY + 1, width, 1);

  drawWindow(ctx);
  drawShelf(ctx);
  drawRack(ctx);
  drawDesk(ctx, target, floorY);
  ctx.restore();
}

function drawBooks(ctx, target, desk) {
  const { left, right, y } = target;
  const width = right - left;
  const spine = [
    { color: '#709387', shadow: '#526d62', inset: 0 },
    { color: '#ca9878', shadow: '#a47153', inset: 6 },
    { color: '#bbad70', shadow: '#978b4f', inset: 2 },
    { color: '#a5aa81', shadow: '#747e5b', inset: 9 },
  ];
  const height = ((desk?.y ?? 350) - y) / spine.length;
  for (const [index, book] of spine.entries()) {
    const top = y + index * height;
    const start = left + book.inset;
    const span = width - book.inset * 2;
    pill(ctx, start, top, span, height, 2, gradient(ctx, start, top, start, top + height, book.color, book.shadow));
    pill(ctx, start + 8, top + 2.6, span - 16, height - 5.4, 1.3, '#f4e5bf');
    pill(ctx, start + 9, top + height * 0.53, span - 18, 0.8, 0.4, '#dfceaa');
    pill(ctx, start + 3, top + 1.3, span - 6, 0.8, 0.4, '#faebc1a8');
  }
}

function drawTray(ctx, target, sliding) {
  const { left, right, y, active } = target;
  const span = right - left;
  const lip = sliding ? 14 : 11;
  const paint = active ? '#82aaa0' : '#c9a37b';
  const depth = active ? '#416b59' : '#926f50';
  const rim = active ? '#e2edc6' : '#f0d6aa';
  pill(ctx, left + 3, y + lip - 2, span - 6, 4, 2, '#75513950');
  pill(ctx, left, y, span, lip, 3, gradient(ctx, left, y, left, y + lip, paint, depth));
  pill(ctx, left + 3, y + 1, span - 6, 2, 1, rim);
  pill(ctx, left + 8, y + lip - 3, span - 16, 1.1, 0.6, '#f5e7b049');
  if (sliding) {
    oval(ctx, left + 12, y + lip + 1, 3, 3, depth);
    oval(ctx, right - 12, y + lip + 1, 3, 3, depth);
  }
}

function drawTarget(ctx, target) {
  if (target.active === false) return;
  const { left, right, y } = target;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#35634d';
  ctx.beginPath();
  ctx.moveTo(left, y - 5);
  ctx.lineTo(left, y);
  ctx.lineTo(right, y);
  ctx.lineTo(right, y - 5);
  ctx.stroke();
  ctx.restore();
}

function drawNextDock(ctx, nextDock, stageTime) {
  const { left, right, y } = nextDock;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#346756';
  ctx.setLineDash([5, 3]);
  ctx.globalAlpha = 0.62 + 0.28 * (0.5 + Math.sin(stageTime * 8) / 2);
  ctx.beginPath();
  ctx.moveTo(left, y - 11);
  ctx.lineTo(left, y - 3);
  ctx.lineTo(right, y - 3);
  ctx.lineTo(right, y - 11);
  ctx.stroke();
  ctx.restore();
}

function drawCenterZone(ctx, zone) {
  const { left, right, y } = zone;
  ctx.save();
  ctx.fillStyle = 'rgba(244, 208, 106, .52)';
  ctx.fillRect(left, y - 4, right - left, 4);
  ctx.strokeStyle = '#fff0b5';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (const x of [left, right]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x, y - 4);
    ctx.stroke();
  }
  ctx.restore();
}

export function createRoomRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const background = canvas.ownerDocument.createElement('canvas');
  background.width = canvas.width;
  background.height = canvas.height;
  const backgroundContext = background.getContext('2d');
  const scaleX = canvas.width / width;
  const scaleY = canvas.height / height;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  backgroundContext.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  let cachedDesk;

  return function draw(frame) {
    const { level, layout, stageTime } = frame;
    const { target, nextDock } = layout;
    const desk = layout.desk ?? target;
    if (!cachedDesk || desk.left !== cachedDesk.left || desk.right !== cachedDesk.right || desk.y !== cachedDesk.y) {
      paintRoom(backgroundContext, { width, height, target: desk, floorY });
      cachedDesk = desk;
    }
    ctx.drawImage(background, 0, 0, width, height);
    if (level.kind === 'books') {
      drawBooks(ctx, target, desk);
    } else if (level.kind !== 'desk') {
      const sliding = level.kind === 'sliding-tray';
      if (sliding) {
        pill(ctx, desk.left + 5, desk.y + 9, desk.right - desk.left - 10, 3, 1.5, '#835d44');
      }
      drawTray(ctx, target, sliding);
    }
    drawTarget(ctx, target);
    if (frame.centerZone) drawCenterZone(ctx, frame.centerZone);
    if (nextDock) drawNextDock(ctx, nextDock, stageTime);
    paintEffects(ctx, frame, floorY);
  };
}
