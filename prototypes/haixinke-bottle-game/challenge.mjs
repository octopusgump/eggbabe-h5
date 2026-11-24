const MEDAL_STREAK = 2;
const CENTER_THIRD = 3;

export const medalLevels = Object.freeze({
  'book-stack': 2,
  'narrow-platform': 4,
  'both-docks': 5,
});

export function narrowCenterRange(target) {
  const third = (target.right - target.left) / CENTER_THIRD;
  return Object.freeze({ left: target.left + third, right: target.right - third });
}

export function startChallenge() {
  return Object.freeze({ streak: 0, medal: false });
}

export function resolveChallenge(current, result) {
  const streak = result === 'success' ? Math.min(current.streak + 1, MEDAL_STREAK) : 0;
  return Object.freeze({ streak, medal: streak >= MEDAL_STREAK });
}

export function resolveNarrowCenter(shot, target) {
  const range = narrowCenterRange(target);
  // 瓶底中心是底边两顶点中点；立稳允许 8° 倾斜，不能直接等同瓶身原点。
  const baseCenter = shot.x - 42 * Math.sin(shot.angle);
  const medal = shot.result === 'success' && baseCenter >= range.left && baseCenter <= range.right;
  return Object.freeze({ medal, range });
}

export function startDockChallenge() {
  return Object.freeze({ left: false, right: false, medal: false });
}

export function resolveDockChallenge(current, result, dock) {
  if (result !== 'success' || (dock !== 'left' && dock !== 'right') || current[dock]) return current;
  const landed = { ...current, [dock]: true };
  return Object.freeze({ ...landed, medal: landed.left && landed.right });
}
