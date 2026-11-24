import { dt, gesture, holdTime, launch, step, world } from './physics.mjs';
import { levels, sceneAt } from './levels.mjs';
import { createProgressStore } from './progress.mjs';
import {
  medalLevels, narrowCenterRange, resolveChallenge, resolveDockChallenge, resolveNarrowCenter, startChallenge, startDockChallenge,
} from './challenge.mjs';
import { advanceKoi, impactDuration } from './effects.mjs';
import { createRoomRenderer } from './room.mjs';
import { sound } from './sound.mjs';
import { createAppearanceScreen } from './appearance-screen.mjs';
import { koiAppearance } from './appearances.mjs';

const byId = id => document.getElementById(id);
const buttonById = id => /** @type {HTMLButtonElement} */ (byId(id));
const canvas = /** @type {HTMLCanvasElement} */ (byId('court'));
const courtContext = canvas.getContext('2d');
const draw = createRoomRenderer(canvas);
const landscape = matchMedia('(orientation: landscape) and (pointer: coarse)');
const progress = createProgressStore(browserStorage());
const levelPicker = /** @type {HTMLDialogElement} */ (byId('level-picker'));
const levelOptions = levels.map(({ id, title }) => {
  const button = document.createElement('button');
  const label = document.createElement('span');
  const state = document.createElement('span');
  button.type = 'button';
  label.textContent = `第 ${id} 关 ${title}`;
  state.className = 'level-option-status';
  button.append(label, state);
  byId('level-options').append(button);
  return { id, button, state };
});
const chooseLevelButton = buttonById('choose-level');
const nextButton = buttonById('next');
const soundButton = buttonById('sound');
const chapterButton = buttonById('continue-chapter');
const wordmark = /** @type {HTMLElement} */ (document.querySelector('.wordmark'));
const backButton = buttonById('page-back');
const resultChallengesButton = buttonById('result-challenges');
const challengesButton = buttonById('open-challenges');
const startStreakButton = buttonById('start-streak');
const playScreen = byId('play');
const home = byId('home');
const challengesScreen = byId('challenges');
const appearanceScreen = byId('appearances');
const appearanceButton = buttonById('open-appearances');
const appearanceMenu = createAppearanceScreen(appearanceScreen, progress, () => {
  syncSound();
  syncNavigation();
});
const medalEntries = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-medal]'));
const readout = byId('readout');
const timer = byId('timer');
const holdBar = /** @type {HTMLProgressElement} */ (byId('progress'));
const status = byId('status');
const detail = byId('detail');

const outcomes = {
  success: ['立稳成功', '瓶底稳稳留在了目标上。'],
  side: ['瓶子倒下了', '微调上划速度，让瓶底先落下。'],
  cap: ['瓶盖先着地', '改一下上划速度，让瓶底朝下落。'],
  edge: ['擦边滑落', '试着瞄准亮起区域的中央。'],
  miss: ['掉到地面', '留意目标的位置，微调上划方向。'],
  'wrong-target': ['落到了旁边', '让瓶子在亮起的目标上站稳。'],
  unsteady: ['瓶身没站稳', '微调上划速度，再试一次。']
};
const challengeInfo = Object.freeze({
  'book-stack': Object.freeze({
    level: medalLevels['book-stack'], title: '书堆双稳',
    description: '第 2 关 · 连续立稳两次，点亮技巧勋章。',
    earnedDescription: '第 2 关 · 技巧勋章已点亮，可再次挑战。',
    instruction: '连续立稳两次；失手后从 0 开始。',
  }),
  'narrow-platform': Object.freeze({
    level: medalLevels['narrow-platform'], title: '窄台靶心',
    description: '第 4 关 · 让瓶底中心立稳在中央三分之一。',
    earnedDescription: '第 4 关 · 窄台靶心已点亮，可再次挑战。',
    instruction: '让瓶底中心在中央三分之一内立稳。',
  }),
  'both-docks': Object.freeze({
    level: medalLevels['both-docks'], title: '左右逢稳',
    description: '第 5 关 · 左右停靠点各立稳一次。',
    earnedDescription: '第 5 关 · 左右逢稳已点亮，可再次挑战。',
    instruction: '趁托盘停靠时，在左右两端各立稳一次。',
  }),
});
let currentMenu = 'home';
let level = null;
let challenge = null;
let streakRound = null;
let offerChallengeEntry = false;
let layout;
let shot = null;
let pointer = null;
let landingCue = null;
let landingTarget = null;
let impactAt = null;
let heldBefore = false;
let settledTargetLeft = 0;
let stageTime = 0;
let accumulator = 0;
let lastFrameTime = null;
let frameId = 0;
let paused = false;
let shortSwipe = false;
let consecutiveFailure = { kind: '', count: 0 };
let correction = '';

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function syncSound() {
  const enabled = progress.state.sound;
  soundButton.setAttribute('aria-pressed', String(enabled));
  setText(soundButton, enabled ? '声音开' : '声音关');
}

function syncNavigation() {
  const { cleared, personalRecord } = progress.state;
  const chapterComplete = cleared === levels.length;
  const playingLevel = Boolean(level) && !challenge && !streakRound;
  const playingChallenge = Boolean(challenge || streakRound);
  chooseLevelButton.hidden = !playingLevel;
  chooseLevelButton.disabled = paused;
  if (playingLevel) setText(chooseLevelButton, `第 ${level.id} 关`);
  wordmark.hidden = home.hidden;
  backButton.hidden = !home.hidden;
  setText(backButton, playingChallenge ? '返回挑战' : '返回首页');
  setText(chapterButton, chapterComplete ? '选关重玩' : cleared ? '继续闯关' : '开始闯关');
  if (chapterComplete) chapterButton.setAttribute('aria-haspopup', 'dialog');
  else chapterButton.removeAttribute('aria-haspopup');
  startStreakButton.disabled = cleared === 0;
  setText(startStreakButton, cleared === 0 ? '未解锁' : '开始连翻');
  byId('streak-unlock').hidden = cleared > 0;
  byId('challenge-score').hidden = cleared === 0;
  setText(byId('challenge-record'), personalRecord + ' 次');
  for (const { id, button, state } of levelOptions) {
    button.disabled = paused || id > cleared + 1;
    button.dataset.cleared = String(id <= cleared);
    setText(state, id <= cleared ? '已通过' : id > cleared + 1 ? '已锁定' : '可游玩');
    if (playingLevel && id === level.id) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  nextButton.hidden = !level || Boolean(challenge || streakRound) || level.id > cleared;
  nextButton.disabled = paused;
  setText(nextButton, level?.id === levels.length ? '选关重玩' : '下一关');
  if (level?.id === levels.length) nextButton.setAttribute('aria-haspopup', 'dialog');
  else nextButton.removeAttribute('aria-haspopup');
  resultChallengesButton.hidden = !offerChallengeEntry;
  resultChallengesButton.disabled = paused;
  byId('storage-note').hidden = progress.persistent;
  if (!appearanceScreen.hidden) appearanceMenu.render();
  for (const entry of medalEntries) {
    const medal = entry.dataset.medal;
    const earned = progress.state.medals.includes(medal);
    const info = challengeInfo[medal];
    const unlocked = cleared >= info.level;
    entry.dataset.earned = String(earned);
    setText(entry.querySelector('.medal-description'), !unlocked ? `通过第 ${info.level} 关后解锁。`
      : earned ? info.earnedDescription : info.description);
    const button = entry.querySelector('button');
    button.disabled = !unlocked;
    setText(button, !unlocked ? '未解锁' : earned ? '再次挑战' : '开始挑战');
  }
}

function showPause() {
  byId('pause-layer').hidden = !paused;
  const rotated = landscape.matches;
  setText(byId('pause-title'), rotated ? '转回竖屏继续' : '已暂停');
  setText(byId('pause-note'), rotated ? '回到竖屏后，点继续接着玩。' : '点继续，从刚才的位置接着玩。');
  buttonById('resume').disabled = rotated || document.hidden;
}

function stopFrame() {
  cancelAnimationFrame(frameId);
  frameId = 0;
  lastFrameTime = null;
}

function showMenu(menu = 'home') {
  stopFrame();
  if (menu !== 'appearances') appearanceMenu.stopPreview();
  currentMenu = menu;
  level = null;
  challenge = null;
  streakRound = null;
  offerChallengeEntry = false;
  pointer = null;
  paused = false;
  home.hidden = menu !== 'home';
  challengesScreen.hidden = menu !== 'challenges';
  appearanceScreen.hidden = menu !== 'appearances';
  playScreen.hidden = true;
  syncNavigation();
}

function showLevelPicker() {
  if (paused || levelPicker.open) return;
  pointer = null;
  stopFrame();
  levelPicker.showModal();
}

function closeLevelPicker() {
  levelPicker.close();
  schedule();
}

function showChallenges(focus = byId('challenges-title')) {
  showMenu('challenges');
  focus.focus();
}

function enterLevel(id, streak = false) {
  const selected = levels[id - 1];
  if (!selected || id > progress.state.cleared + 1) return;
  stopFrame();
  level = selected;
  challenge = null;
  streakRound = streak ? { count: 0, newRecord: false } : null;
  offerChallengeEntry = false;
  paused = document.hidden || landscape.matches;
  home.hidden = true;
  challengesScreen.hidden = true;
  appearanceScreen.hidden = true;
  playScreen.hidden = false;
  layout = sceneAt(id, 0);
  stageTime = 0;
  accumulator = 0;
  shot = null;
  pointer = null;
  landingCue = null;
  landingTarget = null;
  impactAt = null;
  heldBefore = false;
  shortSwipe = false;
  correction = '';
  consecutiveFailure = { kind: '', count: 0 };
  setText(byId('level-title'), streak ? '连翻到底' : level.title);
  setText(byId('level-count'), level.id + ' / ' + levels.length);
  byId('level-count').hidden = streak;
  byId('streak-scores').hidden = !streak;
  byId('challenge-eyebrow').hidden = true;
  byId('challenge-progress').hidden = true;
  byId('center-challenge-note').hidden = true;
  byId('dock-progress').hidden = true;
  setText(byId('instruction'), streak ? '在木台上连续立稳，第一次失手即结算。'
    : progress.state.seen.includes(id) ? '在高亮目标上立稳。' : level.hint);
  syncNavigation();
  showPause();
  render();
  schedule();
}

function enterChallenge(id) {
  const info = Object.values(challengeInfo).find(entry => entry.level === id);
  if (!info || progress.state.cleared < info.level) return;
  enterLevel(id);
  const docks = id === challengeInfo['both-docks'].level;
  const books = id === challengeInfo['book-stack'].level;
  challenge = docks ? startDockChallenge() : startChallenge();
  setText(byId('level-title'), info.title);
  if (books) syncChallenge();
  else setText(byId('level-count'), '第 ' + id + ' 关');
  if (docks) syncDockChallenge();
  setText(byId('instruction'), info.instruction);
  byId('challenge-eyebrow').hidden = false;
  byId('challenge-progress').hidden = !books;
  byId('center-challenge-note').hidden = !isNarrowChallenge();
  byId('dock-progress').hidden = !docks;
  syncNavigation();
  showPause();
  render();
}

function syncChallenge() {
  setText(byId('level-count'), challenge.streak + ' / 2');
  setText(byId('challenge-streak'), challenge.streak + ' / 2');
  for (const [index, mark] of [...byId('streak-marks').querySelectorAll('i')].entries()) {
    mark.dataset.lit = String(index < challenge.streak);
  }
}

function syncDockChallenge() {
  for (const [dock, label] of [['left', '左端'], ['right', '右端']]) {
    const mark = byId('dock-' + dock);
    mark.dataset.lit = String(challenge[dock]);
    setText(mark, label + (challenge[dock] ? ' 已立稳' : ' 待立稳'));
  }
}

function isNarrowChallenge() {
  return Boolean(challenge) && level.id === challengeInfo['narrow-platform'].level;
}

function isDockChallenge() {
  return Boolean(challenge) && level.id === challengeInfo['both-docks'].level;
}

function centerZone() {
  if (!isNarrowChallenge()) return null;
  const range = narrowCenterRange(layout.target);
  return { ...range, y: layout.target.y };
}

function playCue(kind) {
  if (progress.state.sound && !paused) sound.play(kind);
}

function predictImpact(initialShot) {
  let predicted = initialShot;
  let time = stageTime;
  while (!predicted.firstImpact && !predicted.result) {
    time += dt;
    predicted = step(predicted, sceneAt(level.id, time));
  }
  return predicted.firstImpact;
}

function throwBottle(velocity) {
  if (progress.state.sound) sound.unlock();
  if (streakRound && shot?.result && shot.result !== 'success') {
    streakRound = { count: 0, newRecord: false };
  }
  const firstThrow = !streakRound && progress.teach(level.id);
  if (firstThrow && !challenge) setText(byId('instruction'), '在高亮目标上立稳。');
  if (firstThrow || offerChallengeEntry) {
    offerChallengeEntry = false;
    syncNavigation();
  }
  shot = launch(velocity);
  landingCue = predictImpact(shot);
  landingTarget = null;
  impactAt = null;
  heldBefore = false;
  shortSwipe = false;
  correction = '';
  render();
  schedule();
}

function diagnose() {
  if (level.id === 2 && shot.top + 42 >= layout.target.y) {
    return ['height', '划快一点，把瓶子抛过书堆顶面。'];
  }
  if (level.id === 5 && (shot.result === 'edge' || shot.result === 'wrong-target' || shot.result === 'unsteady')) {
    return ['timing', '下一处停靠点亮起时提前出手。'];
  }
  const x = shot.firstImpact?.x ?? shot.x;
  if (shot.result === 'edge' || shot.result === 'miss' || shot.result === 'wrong-target') {
    if (x > layout.target.right - 12) return ['right', '落点偏右了，下一投少向右斜一点。'];
    if (x < layout.target.left + 12) return ['left', '落点偏左了，下一投向右斜一点。'];
  }
  return [shot.result, outcomes[shot.result][1]];
}

function settle() {
  if (streakRound) {
    streakRound = shot.result === 'success'
      ? { count: streakRound.count + 1, newRecord: false }
      : { ...streakRound, newRecord: progress.recordStreak(streakRound.count) };
    if (shot.result !== 'success') syncNavigation();
  } else if (challenge) {
    if (isDockChallenge()) {
      const updated = resolveDockChallenge(challenge, shot.result, layout.dock);
      if (updated.medal && !challenge.medal) progress.awardMedal('both-docks');
      challenge = updated;
      syncDockChallenge();
    } else if (isNarrowChallenge()) {
      if (resolveNarrowCenter(shot, layout.target).medal) progress.awardMedal('narrow-platform');
    } else {
      challenge = resolveChallenge(challenge, shot.result);
      if (challenge.medal) progress.awardMedal('book-stack');
      syncChallenge();
    }
    syncNavigation();
  }
  if (shot.result === 'success') {
    settledTargetLeft = layout.target.left;
    consecutiveFailure = { kind: '', count: 0 };
    if (!challenge && !streakRound) {
      const firstClear = progress.pass(level.id);
      offerChallengeEntry = (level.id === 1 && firstClear) || level.id === levels.length;
    }
    syncNavigation();
    playCue('success');
    return;
  }
  const [kind, tip] = diagnose();
  consecutiveFailure = { kind, count: kind === consecutiveFailure.kind ? consecutiveFailure.count + 1 : 1 };
  if (consecutiveFailure.count >= 2) correction = tip;
  playCue(shot.result === 'edge' || shot.result === 'miss' ? shot.result : 'topple');
}

function statusForFrame() {
  if (streakRound && shot?.result) {
    const turns = shot.airTurns === null ? '' : '空中翻转 ' + shot.airTurns.toFixed(1) + ' 圈。';
    if (shot.result === 'success') return ['success', '本投已立稳', turns + '再上划继续连翻。'];
    const record = streakRound.newRecord ? '新纪录！' : '';
    const [title, tip] = outcomes[shot.result];
    return ['fail', '本轮结束', record + title + '。' + turns + (correction || tip)];
  }
  if (isDockChallenge() && shot?.result === 'success') {
    if (challenge.medal) {
      return ['success', '「左右逢稳」已完成', '勋章已点亮。可重投或返回选关。'];
    }
    const remaining = challenge.left ? '右端' : '左端';
    return ['success', '本投已立稳', '再上划，瞄准' + remaining + '的停靠点。'];
  }
  if (isNarrowChallenge() && shot?.result === 'success') {
    return resolveNarrowCenter(shot, layout.target).medal
      ? ['success', '获得「窄台靶心」勋章', '瓶底中心在中央三分之一内立稳！可重投或返回选关。']
      : ['success', '本投已立稳', '瓶底中心在中央范围外，还需瞄准金色区域。'];
  }
  if (challenge?.medal && shot?.result === 'success') {
    return ['success', '获得「书堆双稳」勋章', '两次连续立稳！勋章已点亮，可重投或返回选关。'];
  }
  if (challenge && shot?.result === 'success') {
    return ['success', '第一次立稳成功', '连续进度 1 / 2，再上划一次完成挑战。'];
  }
  if (challenge && level.id === challengeInfo['book-stack'].level && shot?.result && shot.result !== 'success') {
    return ['fail', outcomes[shot.result][0], '连续立稳已归零，再上划从 0 / 2 重新挑战。'];
  }
  if (!shot) {
    if (shortSwipe) return ['idle', '再向上划一点', '在画面里向上滑动，松手出瓶。'];
    if (level.kind === 'sliding-tray' && layout.nextDock) {
      return ['idle', '下一处停靠点已亮', '提前上划，把瓶子抛向光圈。'];
    }
    return ['idle', '等你出手', '在高亮目标上站稳 0.45 秒。'];
  }
  if (shot.result) {
    const [title, hint] = outcomes[shot.result];
    const slipped = shot.result === 'edge' && heldBefore ? '瓶底滑离目标，立稳计时已归零。' : hint;
    return [shot.result === 'success' ? 'success' : 'fail', title, correction || slipped];
  }
  if (shot.hold > 0) return ['settling', '正在立稳', '保持低速，等进度走满。'];
  if (heldBefore) return ['interrupted', '立稳计时已中断', '留意瓶底是否还留在台面上。'];
  if (shot.firstImpact) return ['landing', '落地了，还在晃', '等瓶底平下来，留意水线。'];
  return ['air', '翻转中', '留意瓶子的落点。'];
}

function render() {
  const pose = shot?.result === 'success' && level.kind === 'sliding-tray'
    ? { ...shot, x: shot.x + layout.target.left - settledTargetLeft }
    : shot ?? world.initial;
  draw({
    level, layout, pose, stageTime, appearance: progress.state.equippedAppearance,
    centerZone: centerZone(),
    cue: shot && !shot.firstImpact && !shot.result ? landingCue : null,
    impact: shot?.firstImpact ?? null,
    outcomeTarget: landingTarget,
    impactAge: impactAt === null ? Infinity : stageTime - impactAt
  });
  const [phase, title, hint] = statusForFrame();
  if (readout.dataset.phase !== phase) readout.dataset.phase = phase;
  setText(status, title);
  setText(detail, hint);
  const held = Math.min(shot?.hold ?? 0, holdTime);
  setText(timer, held.toFixed(2) + ' / ' + holdTime.toFixed(2) + ' 秒');
  if (holdBar.value !== held) holdBar.value = held;
  if (streakRound) {
    setText(byId('streak-round'), streakRound.count + ' 次');
    setText(byId('streak-record'), progress.state.personalRecord + ' 次');
  }
  const medalEarned = challenge?.medal || isNarrowChallenge() && progress.state.medals.includes('narrow-platform');
  setText(byId('action-note'), streakRound && shot?.result && shot.result !== 'success' ? '上划开始新一轮'
    : medalEarned && shot?.result === 'success' ? '勋章已获得 · 可以上划重投'
    : progress.state.cleared === levels.length && level.id === levels.length && !challenge
      ? '首章通关 · 也可以上划重投'
      : shot?.result ? '再向上划一次重扔' : '在画面里上划投掷');
}

function needsFrame() {
  return progress.state.equippedAppearance === koiAppearance
    || level.kind === 'sliding-tray' || Boolean(shot && !shot.result)
    || (impactAt !== null && stageTime - impactAt < impactDuration);
}

function schedule() {
  if (level && !frameId && !paused && !levelPicker.open && needsFrame()) frameId = requestAnimationFrame(tick);
}

function tick(time) {
  frameId = 0;
  if (paused || levelPicker.open) return;
  if (lastFrameTime !== null) accumulator += Math.min((time - lastFrameTime) / 1000, 0.05);
  lastFrameTime = time;
  while (accumulator >= dt) {
    stageTime += dt;
    layout = sceneAt(level.id, stageTime);
    if (shot && !shot.result) {
      const after = step(shot, layout);
      if (!shot.firstImpact && after.firstImpact) {
        impactAt = stageTime;
        if (after.firstImpact.onTarget) playCue('contact');
      }
      if ((!shot.touchedTarget && after.touchedTarget) || after.balanceSurface === 'target') {
        landingTarget = layout.target;
      }
      shot = after;
      if (shot.hold > 0) heldBefore = true;
      if (shot.result) settle();
    }
    if (progress.state.equippedAppearance === koiAppearance) {
      const age = impactAt === null ? Infinity : stageTime - impactAt;
      advanceKoi(courtContext, shot ?? world.initial, age, stageTime);
    }
    accumulator -= dt;
  }
  render();
  if (needsFrame()) schedule();
  else lastFrameTime = null;
}

function canThrow() {
  return Boolean(level) && !paused && !levelPicker.open && (!shot || Boolean(shot.result));
}

canvas.addEventListener('pointerdown', event => {
  if (!canThrow() || !event.isPrimary || event.button !== 0 || pointer) return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointerup', event => {
  if (pointer?.id !== event.pointerId) return;
  const scale = world.width / canvas.getBoundingClientRect().width;
  const velocity = gesture(
    (event.clientX - pointer.x) * scale, (pointer.y - event.clientY) * scale,
    (event.timeStamp - pointer.time) / 1000
  );
  pointer = null;
  if (!canThrow()) return;
  if (velocity) throwBottle(velocity);
  else if (!shot) {
    shortSwipe = true;
    render();
  }
});
function cancelPointer(event) {
  if (pointer?.id === event.pointerId) pointer = null;
}
canvas.addEventListener('pointercancel', cancelPointer);
canvas.addEventListener('lostpointercapture', cancelPointer);

function onAvailabilityChange() {
  if (!level) return;
  if (document.hidden || landscape.matches) {
    paused = true;
    pointer = null;
    stopFrame();
    sound.mute();
  }
  syncNavigation();
  showPause();
}
document.addEventListener('visibilitychange', onAvailabilityChange);
landscape.addEventListener('change', onAvailabilityChange);
byId('resume').addEventListener('click', () => {
  if (document.hidden || landscape.matches) return;
  paused = false;
  if (progress.state.sound) sound.unlock();
  syncNavigation();
  showPause();
  schedule();
});
soundButton.addEventListener('click', () => {
  const enabled = !progress.state.sound;
  progress.setSound(enabled);
  if (enabled && !paused) sound.unlock();
  else sound.mute();
  syncSound();
  syncNavigation();
});
for (const { id, button } of levelOptions) {
  button.addEventListener('click', () => {
    if (!levelPicker.open || button.disabled) return;
    if (id === level?.id) {
      closeLevelPicker();
      return;
    }
    levelPicker.close();
    enterLevel(id);
    chooseLevelButton.focus();
  });
}
for (const button of document.querySelectorAll('button[data-start-challenge]')) {
  button.addEventListener('click', () => {
    if (paused) return;
    enterChallenge(Number(button.getAttribute('data-start-challenge')));
    backButton.focus();
  });
}
chooseLevelButton.addEventListener('click', showLevelPicker);
byId('cancel-level-picker').addEventListener('click', closeLevelPicker);
levelPicker.addEventListener('cancel', event => {
  event.preventDefault();
  closeLevelPicker();
});
nextButton.addEventListener('click', () => {
  if (paused || !level || level.id > progress.state.cleared) return;
  if (level.id < levels.length) enterLevel(level.id + 1);
  else showLevelPicker();
});
chapterButton.addEventListener('click', () => {
  const { cleared } = progress.state;
  if (cleared < levels.length) enterLevel(cleared + 1);
  else showLevelPicker();
});
function enterStreak() {
  if (paused || !progress.state.cleared) return;
  enterLevel(1, true);
  backButton.focus();
}
startStreakButton.addEventListener('click', enterStreak);
challengesButton.addEventListener('click', () => showChallenges());
resultChallengesButton.addEventListener('click', () => {
  if (!paused) showChallenges();
});
appearanceButton.addEventListener('click', () => {
  progress.refresh();
  syncSound();
  appearanceMenu.resetPreview();
  showMenu('appearances');
  appearanceScreen.focus();
});
backButton.addEventListener('click', () => {
  if (streakRound || challenge) {
    const trigger = streakRound ? startStreakButton
      : /** @type {HTMLButtonElement} */ (challengesScreen.querySelector(`[data-start-challenge="${level.id}"]`));
    showChallenges(trigger);
    return;
  }
  const trigger = currentMenu === 'challenges' ? challengesButton
    : currentMenu === 'appearances' ? appearanceButton : chapterButton;
  showMenu();
  trigger.focus();
});
wordmark.addEventListener('click', event => {
  event.preventDefault();
  showMenu();
  chapterButton.focus();
});
syncSound();
showMenu();
