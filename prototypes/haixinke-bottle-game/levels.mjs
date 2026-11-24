const desk = Object.freeze({ left: 34, right: 286, y: 350 });

export const levels = Object.freeze([
  { id: 1, title: '桌上首飞', kind: 'desk', hint: '向上轻快一划，等瓶子站稳。' },
  { id: 2, title: '书山登顶', kind: 'books', hint: '对准书堆，上划快一点。' },
  { id: 3, title: '右边有位', kind: 'wide-tray', hint: '往右上方划，让瓶子落进托盘。' },
  { id: 4, title: '一瓶之地', kind: 'narrow-tray', hint: '瞄准窄台中央，微调斜划角度。' },
  { id: 5, title: '接瓶专线', kind: 'sliding-tray', hint: '看托盘会停在哪边，提前划。' },
].map(level => Object.freeze(level)));

const fixedTargets = [
  desk,
  Object.freeze({ left: 79, right: 241, y: 296 }),
  Object.freeze({ left: 158, right: 282, y: desk.y }),
  Object.freeze({ left: 180, right: 260, y: desk.y }),
];

const fixedScenes = fixedTargets.map((target, index) => Object.freeze({
  target: Object.freeze({ ...target, active: true }),
  desk: index === 0 ? null : desk,
  nextDock: null,
  moving: false,
}));

const leftDock = Object.freeze({ left: 28, right: 152, y: desk.y });
const rightDock = Object.freeze({ left: 170, right: 294, y: desk.y });
const travelTime = 0.9;
const dockTime = 1.6;
const halfCycle = travelTime + dockTime;

export function sceneAt(levelId, time) {
  if (levelId !== 5) return fixedScenes[levelId - 1];

  const phase = time % (halfCycle * 2);
  const goingRight = phase < halfCycle;
  const halfTime = goingRight ? phase : phase - halfCycle;
  const from = goingRight ? leftDock : rightDock;
  const to = goingRight ? rightDock : leftDock;
  const moving = halfTime < travelTime;
  const progress = Math.min(halfTime / travelTime, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const offset = (to.left - from.left) * eased;

  return {
    target: { left: from.left + offset, right: from.right + offset, y: desk.y, active: !moving },
    desk,
    nextDock: moving ? to : null,
    moving,
    dock: moving ? null : goingRight ? 'right' : 'left',
  };
}
