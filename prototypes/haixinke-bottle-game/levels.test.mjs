import assert from 'node:assert/strict';
import test from 'node:test';
import { levels, sceneAt } from './levels.mjs';
import { dt, gesture, launch, step } from './physics.mjs';
import { createProgressStore } from './progress.mjs';

function makeStorage() {
  const entries = new Map();
  return {
    entries,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
}

test('the chapter keeps the approved order and target geometry', () => {
  assert.deepEqual(levels.map(level => [level.id, level.title, level.kind]), [
    [1, '桌上首飞', 'desk'],
    [2, '书山登顶', 'books'],
    [3, '右边有位', 'wide-tray'],
    [4, '一瓶之地', 'narrow-tray'],
    [5, '接瓶专线', 'sliding-tray'],
  ]);
  assert.deepEqual(sceneAt(1, 0), {
    target: { left: 34, right: 286, y: 350, active: true },
    desk: null,
    nextDock: null,
    moving: false,
  });
  assert.deepEqual(sceneAt(2, 3).target, { left: 79, right: 241, y: 296, active: true });
  assert.deepEqual(sceneAt(2, 3).desk, { left: 34, right: 286, y: 350 });
  assert.deepEqual(sceneAt(3, 0).target, { left: 158, right: 282, y: 350, active: true });
  assert.deepEqual(sceneAt(4, 0).target, { left: 180, right: 260, y: 350, active: true });
});

test('the sliding tray previews its destination and activates only while docked', () => {
  const left = { left: 28, right: 152, y: 350 };
  const right = { left: 170, right: 294, y: 350 };
  assert.deepEqual(sceneAt(5, 0).target, { ...left, active: false });
  assert.deepEqual(sceneAt(5, 0).nextDock, right);
  assert.deepEqual(sceneAt(5, 0.45).target, { left: 99, right: 223, y: 350, active: false });
  assert.equal(sceneAt(5, 0).dock, null);
  assert.deepEqual(sceneAt(5, 0.9).target, { ...right, active: true });
  assert.equal(sceneAt(5, 0.9).dock, 'right');
  assert.equal(sceneAt(5, 2.499).moving, false);
  assert.equal(sceneAt(5, 2.5).moving, true);
  assert.equal(sceneAt(5, 2.5).dock, null);
  assert.deepEqual(sceneAt(5, 2.5).nextDock, left);
  assert.deepEqual(sceneAt(5, 3.401).target, { ...left, active: true });
  assert.equal(sceneAt(5, 3.401).dock, 'left');
  assert.equal(sceneAt(5, 3.401).nextDock, null);
  assert.equal(sceneAt(5, 4.999).moving, false);
  assert.deepEqual(sceneAt(5, 5), sceneAt(5, 0));
});

function playShot(level, start, dx, up, seconds) {
  let shot = launch(gesture(dx, up, seconds));
  for (let frame = 1; frame <= 500 && !shot.result; frame += 1) {
    shot = step(shot, sceneAt(level, start + frame * dt));
  }
  return shot.result;
}

test('each stage has a playable gesture and either stop can clear the sliding tray', () => {
  const winningShots = [
    [1, 0, 0, 90, 0.137],
    [2, 0, 0, 90, 0.115],
    [3, 0, 25, 90, 0.13],
    [4, 0, 25, 90, 0.13],
    [5, 0.25, 30, 90, 0.135],
    [5, 2.75, -33, 90, 0.135],
  ];
  for (const shot of winningShots) assert.equal(playShot(...shot), 'success', JSON.stringify(shot));
  assert.notEqual(playShot(5, 0.8, 30, 90, 0.135), 'success');
});

test('only the next open stage can advance and progress survives a fresh load', () => {
  const storage = makeStorage();
  const progress = createProgressStore(storage);
  assert.deepEqual(progress.state, {
    cleared: 0, seen: [], sound: false, medals: [], personalRecord: 0,
    unlockedAppearances: ['original'], equippedAppearance: 'original',
  });
  assert.equal(progress.awardMedal('book-stack'), false);
  assert.equal(progress.pass(2), false);
  assert.equal(progress.teach(2), false);
  assert.equal(progress.teach(1), true);
  assert.equal(progress.teach(1), false);
  assert.equal(progress.pass(1), true);
  assert.equal(progress.pass(1), false);
  assert.equal(progress.teach(2), true);
  assert.equal(progress.setSound(true), true);
  assert.equal(progress.setSound(true), false);
  assert.equal(progress.persistent, true);
  const resumed = createProgressStore(storage);
  assert.deepEqual(resumed.state, {
    cleared: 1, seen: [1, 2], sound: true, medals: [], personalRecord: 0,
    unlockedAppearances: ['original'], equippedAppearance: 'original',
  });
  for (let level = 2; level <= 5; level += 1) assert.equal(resumed.pass(level), true);
  assert.equal(resumed.pass(6), false);
  assert.equal(resumed.state.cleared, 5);
});

test('blocked or malformed storage still allows an in-memory chapter', () => {
  const blocked = createProgressStore({
    getItem() { throw new Error('blocked read'); },
    setItem() { throw new Error('blocked write'); },
  });
  assert.equal(blocked.persistent, false);
  assert.equal(blocked.pass(1), true);
  assert.equal(blocked.teach(2), true);
  assert.deepEqual(blocked.state, {
    cleared: 1, seen: [2], sound: false, medals: [], personalRecord: 0,
    unlockedAppearances: ['original'], equippedAppearance: 'original',
  });

  const corrupt = createProgressStore({ getItem: () => '{', setItem() {} });
  assert.deepEqual(corrupt.state, {
    cleared: 0, seen: [], sound: false, medals: [], personalRecord: 0,
    unlockedAppearances: ['original'], equippedAppearance: 'original',
  });
  assert.equal(createProgressStore(null).persistent, false);
  const blockedWrite = createProgressStore({
    getItem: () => null,
    setItem() { throw new Error('blocked write'); },
  });
  assert.equal(blockedWrite.pass(1), true);
  assert.equal(blockedWrite.persistent, false);
  assert.equal(blockedWrite.state.cleared, 1);
});

test('another tab changing a setting cannot erase a newly earned medal', () => {
  const storage = makeStorage();
  const chapter = createProgressStore(storage);
  const challenge = createProgressStore(storage);
  for (let level = 1; level <= 5; level += 1) chapter.pass(level);

  assert.equal(challenge.awardMedal('book-stack'), true);
  assert.equal(chapter.setSound(true), true);
  assert.deepEqual(createProgressStore(storage).state, {
    cleared: 5, seen: [], sound: true, medals: ['book-stack'], personalRecord: 0,
    unlockedAppearances: ['original', 'cream-label'], equippedAppearance: 'original',
  });
});

test('an existing cleared chapter unlocks 书堆双稳 and restores it with settings', () => {
  const storage = makeStorage();
  const previous = createProgressStore(storage);
  for (let level = 1; level <= 5; level += 1) previous.pass(level);
  previous.setSound(true);

  const resumed = createProgressStore(storage);
  assert.equal(resumed.awardMedal('book-stack'), true);
  assert.equal(resumed.awardMedal('book-stack'), false);
  assert.deepEqual(createProgressStore(storage).state, {
    cleared: 5,
    seen: [],
    sound: true,
    medals: ['book-stack'], personalRecord: 0,
    unlockedAppearances: ['original', 'cream-label'], equippedAppearance: 'original',
  });
});

test('窄台靶心 persists beside 书堆双稳 and merges across tabs', () => {
  const storage = makeStorage();
  const chapter = createProgressStore(storage);
  const challenge = createProgressStore(storage);
  for (let level = 1; level <= 5; level += 1) chapter.pass(level);

  assert.equal(challenge.awardMedal('narrow-platform'), true);
  assert.equal(challenge.awardMedal('narrow-platform'), false);
  assert.equal(chapter.setSound(true), true);
  assert.equal(challenge.awardMedal('book-stack'), true);
  assert.deepEqual(createProgressStore(storage).state, {
    cleared: 5, seen: [], sound: true, medals: ['book-stack', 'narrow-platform'], personalRecord: 0,
    unlockedAppearances: ['original', 'cream-label'], equippedAppearance: 'original',
  });
});

test('technique medals unlock after clearing levels 2, 4 and 5 and survive a reload', () => {
  const storage = makeStorage();
  const chapter = createProgressStore(storage);
  chapter.pass(1);
  assert.equal(chapter.awardMedal('book-stack'), false);
  chapter.pass(2);
  assert.equal(chapter.awardMedal('book-stack'), true);
  chapter.pass(3);
  assert.equal(chapter.awardMedal('narrow-platform'), false);
  chapter.pass(4);
  assert.equal(chapter.awardMedal('narrow-platform'), true);
  assert.deepEqual(createProgressStore(storage).state.medals, ['book-stack', 'narrow-platform']);
  assert.equal(chapter.awardMedal('both-docks'), false);
  assert.equal(chapter.pass(5), true);

  const challenge = createProgressStore(storage);
  assert.equal(challenge.awardMedal('both-docks'), true);
  assert.equal(challenge.awardMedal('both-docks'), false);
  assert.equal(chapter.setSound(true), true);
  assert.deepEqual(createProgressStore(storage).state, {
    cleared: 5, seen: [], sound: true, medals: ['book-stack', 'narrow-platform', 'both-docks'], personalRecord: 0,
    unlockedAppearances: ['original', 'cream-label'], equippedAppearance: 'original',
  });
});

test('个人纪录 only improves after an unlocked round settles and survives a fresh load', () => {
  const storage = makeStorage();
  const oldTab = createProgressStore(storage);
  assert.equal(oldTab.recordStreak(5), false);
  oldTab.pass(1);
  const active = createProgressStore(storage);

  assert.equal(active.recordStreak(0), false);
  assert.equal(active.recordStreak(5), true);
  assert.equal(active.recordStreak(5), false);
  assert.equal(active.recordStreak(4), false);
  assert.equal(active.recordStreak(5.5), false);
  assert.equal(oldTab.recordStreak(4), false);
  assert.equal(oldTab.setSound(true), true);

  const reloaded = createProgressStore(storage);
  assert.deepEqual(reloaded.state, {
    cleared: 1, seen: [], sound: true, medals: [], personalRecord: 5,
    unlockedAppearances: ['original', 'mint-cap'], equippedAppearance: 'original',
  });
  assert.equal(reloaded.recordStreak(6), true);
  assert.equal(createProgressStore(storage).state.personalRecord, 6);
});

test('legacy saves retain progress when loading with no valid 个人纪录', () => {
  const legacy = { cleared: 5, seen: [1, 2], sound: true, medals: ['both-docks'] };
  for (const personalRecord of [undefined, -1, '5', 1.5]) {
    const storage = makeStorage();
    storage.setItem('half-bottle-flip:chapter:v1', JSON.stringify({ ...legacy, personalRecord }));

    assert.deepEqual(createProgressStore(storage).state, {
      ...legacy, personalRecord: 0, unlockedAppearances: ['original', 'cream-label'], equippedAppearance: 'original',
    });
  }
});

test('首章通关 unlocks 焦糖咕噜 on the fifth clear and restores it', () => {
  const storage = makeStorage();
  const progress = createProgressStore(storage);
  for (let level = 1; level <= 4; level += 1) progress.pass(level);
  assert.deepEqual(progress.state.unlockedAppearances, ['original']);
  assert.equal(progress.pass(5), true);
  const restored = createProgressStore(storage).state;
  assert.deepEqual(restored.unlockedAppearances, ['original', 'cream-label']);
  assert.equal(restored.equippedAppearance, 'original');
});

test('a settled jump from 2 to 10 saves both appearance rewards with the record', () => {
  const storage = makeStorage();
  let writes = 0;
  const progress = createProgressStore({
    ...storage,
    setItem(key, value) {
      writes += 1;
      storage.setItem(key, value);
    },
  });
  progress.pass(1);
  progress.recordStreak(2);
  assert.deepEqual(progress.state.unlockedAppearances, ['original']);

  const writesBeforeSettlement = writes;
  assert.equal(progress.recordStreak(10), true);
  assert.equal(writes, writesBeforeSettlement + 1);
  const saved = JSON.parse(storage.entries.values().next().value);
  assert.equal(saved.personalRecord, 10);
  assert.deepEqual(saved.unlockedAppearances, ['original', 'mint-cap', 'star-sticker']);
  assert.equal(saved.equippedAppearance, 'original');
});

test('legacy milestones restore rewards and only unlocked appearances can be equipped', () => {
  const storage = makeStorage();
  storage.setItem('half-bottle-flip:chapter:v1', JSON.stringify({ cleared: 5, personalRecord: 3 }));
  const progress = createProgressStore(storage);
  assert.deepEqual(progress.state.unlockedAppearances, ['original', 'cream-label']);
  assert.equal(progress.recordStreak(4), true);
  assert.equal(progress.equipAppearance('mint-cap'), false);
  assert.equal(progress.recordStreak(5), true);
  assert.deepEqual(progress.state.unlockedAppearances, ['original', 'cream-label', 'mint-cap']);
  assert.equal(progress.equipAppearance('star-sticker'), false);
  assert.equal(progress.equipAppearance('unknown'), false);
  assert.equal(progress.equipAppearance('mint-cap'), true);
  assert.equal(progress.recordStreak(9), true);
  assert.equal(progress.equipAppearance('star-sticker'), false);
  assert.equal(progress.recordStreak(10), true);
  assert.ok(progress.state.unlockedAppearances.includes('star-sticker'));
  assert.equal(progress.state.equippedAppearance, 'mint-cap');
  const restored = createProgressStore(storage);
  assert.equal(restored.state.equippedAppearance, 'mint-cap');
  assert.equal(restored.equipAppearance('original'), true);
  assert.equal(progress.setSound(true), true);
  assert.equal(createProgressStore(storage).state.equippedAppearance, 'original');
});
