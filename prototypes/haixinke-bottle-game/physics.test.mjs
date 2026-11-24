import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { dt, gesture, holdTime, launch, step, vertices, world } from './physics.mjs';

const prototypeHtml = readFileSync(
  new URL('../.scratch/bottle-flip/prototypes/feedback-retry.html', import.meta.url),
  'utf8',
);
const [, prototypeScript] = prototypeHtml.match(/<script id="flip-physics">([\s\S]+?)<\/script>/);
const reference = runInNewContext(prototypeScript + '\nFlip');

const broadDesk = { left: 34, right: 286, y: 350, active: true };
const firstLevel = { target: broadDesk, desk: null };
const bookLevel = { target: { left: 79, right: 241, y: 296, active: true }, desk: broadDesk };
const sideTray = { target: { left: 180, right: 260, y: 350, active: true }, desk: broadDesk };
const parityFields = [
  'x', 'y', 'angle', 'vx', 'vy', 'omega', 'elapsed', 'hold', 'top', 'airTurns',
  'touchedTarget', 'firstContact', 'balancing', 'quiet', 'result',
];

function run(velocity, layout) {
  let state = launch(velocity);
  for (let frame = 0; frame < 600 && !state.result; frame += 1) {
    state = step(state, layout);
  }
  assert.ok(state.result, 'every shot must eventually conclude');
  return state;
}

test('the first room reproduces the approved swipes and physics on every step', () => {
  assert.equal(dt, reference.dt);
  assert.equal(holdTime, reference.holdTime);
  assert.deepEqual(world.initial, { ...reference.initial });
  for (const input of [[0, 90, 0.137], [25, 90, 0.13], [0, 4, 0.03], [90, 20, 0.09]]) {
    const baseline = reference.gesture(...input, 'speed');
    assert.deepEqual(gesture(...input), baseline ? { ...baseline } : null);
  }
  const shots = [...Object.values(reference.demos), gesture(0, 90, 0.137)];
  for (const velocity of shots) {
    let original = reference.launch(velocity, false);
    let actual = launch(velocity);
    while (!original.result) {
      original = reference.step(original);
      actual = step(actual, firstLevel);
      for (const field of parityFields) assert.equal(actual[field], original[field], field);
    }
    assert.ok(actual.firstImpact);
  }
});

test('the book platform catches a cleared bottle on the way down', () => {
  let state = launch(gesture(0, 90, 0.115));
  assert.ok(vertices(state).some(point => point.y > bookLevel.target.y));
  let cleared = false;

  for (let frame = 0; frame < 600 && !state.result; frame += 1) {
    state = step(state, bookLevel);
    if (state.firstImpact?.onTarget) {
      assert.ok(cleared, 'a raised target must never catch a rising or overlapping bottle');
    }
    cleared ||= vertices(state).every(point => point.y <= bookLevel.target.y);
  }
  assert.equal(state.result, 'success');
  assert.equal(state.firstImpact.y, bookLevel.target.y);
});

test('standing on the ordinary desk cannot clear an offset target', () => {
  const state = run(gesture(0, 90, 0.137), sideTray);
  assert.equal(state.result, 'wrong-target');
  assert.equal(state.hold, 0);
  assert.equal(state.firstImpact.onTarget, false);
  assert.equal(state.firstImpact.y, sideTray.desk.y);
  assert.ok(run(gesture(25, 90, 0.13), sideTray).result === 'success');
});

test('a moving tray retains physical contact but interrupts the entire hold', () => {
  let state = launch(gesture(0, 90, 0.137));
  for (let frame = 0; frame < 600 && !state.result && state.hold < 0.2; frame += 1) {
    state = step(state, firstLevel);
  }
  assert.ok(!state.result);
  assert.ok(state.hold >= 0.2);

  const movingLayout = { target: { ...broadDesk, active: false }, desk: null };
  state = step(state, movingLayout);
  assert.equal(state.hold, 0);
  assert.equal(state.result, '');
  assert.equal(state.touchedTarget, true);
  assert.equal(state.firstImpact.onTarget, true);

  let dockedSteps = 0;
  while (!state.result && dockedSteps < 600) {
    state = step(state, firstLevel);
    dockedSteps += 1;
  }
  assert.equal(state.result, 'success');
  assert.ok(dockedSteps * dt >= holdTime - 1e-9);
});

test('a shot fails when a floor landing or an unsettled result ends it', () => {
  assert.equal(run(reference.demos.edge, firstLevel).result, 'edge');
  assert.equal(run(reference.demos.miss, firstLevel).result, 'miss');
  const inactive = run(gesture(0, 90, 0.137), { target: { ...broadDesk, active: false }, desk: null });
  assert.equal(inactive.result, 'unsteady');
  assert.equal(inactive.hold, 0);
});

