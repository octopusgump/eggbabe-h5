import assert from 'node:assert/strict';
import test from 'node:test';
import {
  narrowCenterRange, resolveChallenge, resolveDockChallenge, resolveNarrowCenter, startChallenge, startDockChallenge,
} from './challenge.mjs';
import { vertices } from './physics.mjs';

test('two consecutive 立稳 earn 书堆双稳, but a miss resets the current run', () => {
  const started = startChallenge();
  assert.deepEqual(started, { streak: 0, medal: false });

  const first = resolveChallenge(started, 'success');
  assert.deepEqual(first, { streak: 1, medal: false });

  assert.deepEqual(resolveChallenge(first, 'side'), { streak: 0, medal: false });
  assert.deepEqual(resolveChallenge(resolveChallenge(first, 'success'), 'success'), {
    streak: 2,
    medal: true,
  });
});

test('最终瓶底中心在界外时，即使首次落点居中也不获得窄台靶心', () => {
  const target = { left: 180, right: 260 };
  const centeredImpact = { x: 220 };
  assert.deepEqual(
    resolveNarrowCenter({ result: 'success', x: 180, angle: 0, firstImpact: centeredImpact }, target),
    { medal: false, range: { left: 620 / 3, right: 700 / 3 } },
  );
  assert.equal(resolveNarrowCenter({ result: 'success', x: 260, angle: 0, firstImpact: centeredImpact }, target).medal, false);
  assert.equal(resolveNarrowCenter({ result: 'success', x: 700 / 3, angle: 0 }, target).medal, true);
  assert.equal(resolveNarrowCenter({ result: 'side', x: 220, angle: 0 }, target).medal, false);
  assert.equal(resolveNarrowCenter({ result: 'success', x: 620 / 3 - 0.01, angle: 0 }, target).medal, false);
});

test('窄台靶心按瓶底两顶点的中心判定，并包含中央三分之一的边界', () => {
  const target = { left: 180, right: 260 };
  assert.deepEqual(narrowCenterRange(target), { left: 620 / 3, right: 700 / 3 });
  const angle = 8 * Math.PI / 180;
  const outside = { x: 620 / 3 + 3, y: 350, angle };
  const base = vertices(outside).slice(0, 2);
  assert.ok((base[0].x + base[1].x) / 2 < 620 / 3);
  assert.equal(resolveNarrowCenter({ ...outside, result: 'success' }, target).medal, false);
  const [leftBase, rightBase] = vertices({ x: 0, y: 0, angle });
  const offset = (leftBase.x + rightBase.x) / 2;
  const boundary = { result: 'success', x: 620 / 3 - offset, y: 350, angle };
  assert.equal(resolveNarrowCenter(boundary, target).medal, true);
});

test('左右逢稳只记录停靠时的立稳，两侧可按任意顺序完成', () => {
  const empty = { left: false, right: false, medal: false };
  const started = startDockChallenge();
  assert.deepEqual(started, empty);
  assert.deepEqual(resolveDockChallenge(started, 'success', null), empty);

  for (const [first, other] of [['left', 'right'], ['right', 'left']]) {
    const oneDock = { ...empty, [first]: true };
    const landed = resolveDockChallenge(started, 'success', first);
    assert.deepEqual(landed, oneDock);
    const repeated = resolveDockChallenge(landed, 'success', first);
    assert.deepEqual(repeated, oneDock);
    const missed = resolveDockChallenge(repeated, 'edge', other);
    assert.deepEqual(missed, oneDock);
    assert.deepEqual(resolveDockChallenge(missed, 'success', other), {
      left: true, right: true, medal: true,
    });
    assert.deepEqual(startDockChallenge(), empty);
  }
});
