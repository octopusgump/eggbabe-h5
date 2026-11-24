// Requires Playwright and its Chromium browser. Run with node game/qa/mobile-acceptance.cjs.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { routeGame, swipe, url } = require('./mobile-fixture.cjs');

const portrait = { width: 430, height: 600 };
const rightDockLeadInMs = 267;
const leftDockLaunchMs = 7750;
const shotWindowMs = 2000;

async function freezeClock(page) {
  const start = new Date();
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 60_000));
}

async function launchChapter(page) {
  await routeGame(page);
  await page.goto(url);
  await page.getByRole('button', { name: '开始闯关', exact: true }).click();
}

async function checkMedalArt(page) {
  await routeGame(page);
  await page.goto(url);
  await page.getByRole('button', { name: '挑战', exact: true }).click();
  const images = page.locator('#challenges .medal-art');
  assert.equal(await images.count(), 4);
  const sources = [];
  for (const image of await images.all()) {
    const source = await image.evaluate(async element => {
      await element.decode();
      return element.currentSrc;
    });
    assert.notEqual(await image.evaluate(element => getComputedStyle(element).filter), 'none');
    sources.push(source);
  }
  assert.equal(new Set(sources).size, 4);
}

async function checkBrowserTouch(page) {
  await launchChapter(page);
  const session = await page.context().newCDPSession(page);
  try {
    const { x, y, width, height } = await page.locator('#court').boundingBox();
    const start = { x: x + width * 0.45, y: y + height * 0.67 };
    const timestamp = Date.now() / 1000;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start], timestamp });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ ...start, y: start.y - height * 0.2 }], timestamp: timestamp + 0.09,
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: timestamp + 0.137 });
    await page.getByRole('status').getByText('翻转中', { exact: true }).waitFor({ timeout: 3000 });
    assert.equal(await page.evaluate(() => scrollY), 0);

    await session.send('Input.synthesizeScrollGesture', {
      x: 5, y: 450, yDistance: -240, speed: 600, gestureSourceType: 'touch', preventFling: true,
    });
    await page.waitForFunction(() => scrollY > 0, null, { timeout: 3000 });
  } finally {
    await session.detach();
  }
}

async function checkFrozenShot(page, mode) {
  const resume = page.getByRole('button', { name: '继续', exact: true });
  const snapshot = () => page.evaluate(() => ({
    room: document.querySelector('#court').toDataURL(),
    hold: document.querySelector('#progress').value,
    message: document.querySelector('[role=status]').textContent,
  }));
  const visibility = hidden => page.evaluate(hidden => {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  const before = await snapshot();
  if (mode === 'background') await visibility(true);
  else await page.setViewportSize({ width: portrait.height, height: portrait.width });

  await resume.waitFor({ timeout: 3000 });
  assert.equal(await resume.isDisabled(), true);
  await page.clock.runFor(5000);
  assert.deepEqual(await snapshot(), before);

  if (mode === 'background') await visibility(false);
  else await page.setViewportSize(portrait);
  await page.locator('#resume:enabled').waitFor({ timeout: 3000 });
  await page.clock.runFor(250);
  assert.deepEqual(await snapshot(), before);
  await resume.click();
}

async function waitForHold(page) {
  const progress = page.getByRole('progressbar', { name: '立稳进度' });
  for (let frame = 0; frame < 100 && Number(await progress.getAttribute('value')) === 0; frame++) {
    await page.clock.runFor(16);
  }
  await page.getByRole('status').getByText('正在立稳', { exact: true }).waitFor({ timeout: 3000 });
  assert.ok(Number(await progress.getAttribute('value')) < 0.45);
}

async function checkLevelPicker(page) {
  await launchChapter(page);
  await freezeClock(page);
  const court = page.locator('#court');
  const picker = page.getByRole('dialog', { name: '选关', exact: true });
  const currentLevel = page.locator('.toolbar').getByRole('button', { name: '第 1 关', exact: true });
  const cancel = picker.getByRole('button', { name: '取消', exact: true });
  const resume = page.getByRole('button', { name: '继续', exact: true });
  const snapshot = () => court.evaluate(canvas => canvas.toDataURL());
  const status = page.getByRole('status');
  await swipe(court, 137);
  await page.clock.runFor(250);
  const airborne = await snapshot();

  await currentLevel.click({ timeout: 3000 });
  await picker.waitFor({ timeout: 3000 });
  const currentRow = picker.getByRole('button', { name: '第 1 关 桌上首飞 可游玩', exact: true });
  const locked = picker.getByRole('button', { name: '第 2 关 书山登顶 已锁定', exact: true });
  assert.equal(await currentRow.isEnabled(), true);
  assert.equal(await locked.isDisabled(), true);
  await page.clock.runFor(5000);
  assert.equal(await snapshot(), airborne);
  await cancel.click();
  await picker.waitFor({ state: 'hidden', timeout: 3000 });
  assert.equal(await snapshot(), airborne);

  await waitForHold(page);
  const hold = page.getByRole('progressbar', { name: '立稳进度' });
  const heldValue = await hold.getAttribute('value');
  const settlingFrame = await snapshot();
  await currentLevel.click();
  await page.clock.runFor(5000);
  assert.equal(await snapshot(), settlingFrame);
  assert.equal(await hold.getAttribute('value'), heldValue);
  await cancel.click();
  await picker.waitFor({ state: 'hidden', timeout: 3000 });
  assert.equal(await hold.getAttribute('value'), heldValue);
  await page.clock.runFor(2000);
  await status.getByText('立稳成功', { exact: true }).waitFor({ timeout: 3000 });

  await swipe(court, 137);
  await page.clock.runFor(250);
  const interrupted = await snapshot();
  await currentLevel.click();
  await picker.getByRole('button', { name: '第 1 关 桌上首飞 已通过', exact: true }).click();
  await picker.waitFor({ state: 'hidden', timeout: 3000 });
  assert.equal(await snapshot(), interrupted);

  await currentLevel.click();
  await page.evaluate(() => {
    for (const hidden of [true, false]) {
      Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  await cancel.click();
  await resume.waitFor({ timeout: 3000 });
  await page.clock.runFor(2000);
  assert.equal(await snapshot(), interrupted);
  await resume.click();
  await page.clock.runFor(2000);
  await status.getByText('立稳成功', { exact: true }).waitFor({ timeout: 3000 });
}

async function checkChapter(page) {
  await launchChapter(page);
  const court = page.locator('#court');
  const progress = page.getByRole('progressbar', { name: '立稳进度' });
  const status = page.getByRole('status');
  const button = name => page.getByRole('button', { name, exact: true });
  const title = async name => assert.equal(await status.locator('strong').textContent(), name);
  const heading = name => page.getByRole('heading', { name, exact: true }).waitFor({ timeout: 3000 });
  const medal = name => page.getByRole('region', { name, exact: true });
  const checkChallengeUnlocks = async cleared => {
    await button('返回首页').click();
    await button('挑战').click();
    for (const [name, level] of [['书堆双稳', 2], ['窄台靶心', 4], ['左右逢稳', 5]]) {
      const entry = medal(name);
      if (level > cleared) {
        assert.equal(await entry.getByRole('button', { name: '未解锁' }).isDisabled(), true);
        await entry.getByText(`通过第 ${level} 关后解锁。`, { exact: true }).waitFor({ timeout: 3000 });
      } else {
        await entry.getByRole('button', { name: '开始挑战' }).click();
        await heading(name);
        await button('返回挑战').click();
      }
    }
    await button('返回首页').click();
    await button('继续闯关').click();
  };
  const shot = async (duration, dx = 0, settleMs = shotWindowMs) => {
    await swipe(court, duration, dx);
    await page.clock.runFor(settleMs);
  };

  await freezeClock(page);
  await swipe(court, 137, 0, true);
  await page.clock.runFor(2000);
  await title('等你出手');
  assert.equal(await button('下一关').isVisible(), false);

  assert.equal(await button('声音关').getAttribute('aria-pressed'), 'false');
  await shot(90, 0, 2500);
  await title('瓶子倒下了');
  await shot(95, -46);
  await title('擦边滑落');
  await shot(137);
  await title('立稳成功');
  assert.equal(await button('挑战').isVisible(), true);
  await button('下一关').click();
  await heading('书山登顶');
  await shot(115);
  await title('立稳成功');
  await checkChallengeUnlocks(2);
  await heading('右边有位');
  for (let attempt = 0; attempt < 2; attempt++) {
    await shot(137, -15);
    await title('落到了旁边');
    assert.equal(await button('下一关').isVisible(), false);
  }
  await status.getByText('落点偏左了，下一投向右斜一点。').waitFor({ timeout: 3000 });
  await shot(130, 25);
  await title('立稳成功');
  await button('下一关').click();
  await heading('一瓶之地');
  await page.getByText('瞄准窄台中央，微调斜划角度。').waitFor({ timeout: 3000 });
  await shot(130, 25);
  await title('立稳成功');
  await checkChallengeUnlocks(4);
  await heading('接瓶专线');
  await title('下一处停靠点已亮');
  await page.clock.runFor(rightDockLeadInMs);
  await swipe(court, 135, 30);
  await page.clock.runFor(250);
  await title('翻转中');
  await checkFrozenShot(page, 'background');
  await checkFrozenShot(page, 'landscape');

  await waitForHold(page);
  assert.equal(await button('选关重玩').isVisible(), false);
  await checkFrozenShot(page, 'background');
  await checkFrozenShot(page, 'landscape');
  await page.clock.runFor(1500);
  await title('立稳成功');
  assert.equal(Number(await progress.getAttribute('value')), 0.45);
  assert.equal(await button('挑战').isVisible(), true);

  const reloadChallenges = async () => {
    await page.reload();
    await button('挑战').click();
  };
  const earned = async name => {
    const entry = medal(name);
    await entry.getByRole('button', { name: '再次挑战' }).waitFor({ timeout: 3000 });
    assert.equal(await entry.locator('.medal-art').evaluate(element => getComputedStyle(element).filter), 'none');
  };
  await reloadChallenges();
  await medal('书堆双稳').getByRole('button', { name: '开始挑战' }).click();
  await heading('书堆双稳');
  await shot(115);
  await title('第一次立稳成功');
  await shot(115);
  await title('获得「书堆双稳」勋章');
  await reloadChallenges();
  await earned('书堆双稳');
  await medal('窄台靶心').getByRole('button', { name: '开始挑战' }).click();
  await heading('窄台靶心');
  await shot(130, 25);
  await title('获得「窄台靶心」勋章');
  await reloadChallenges();
  await earned('窄台靶心');
  await medal('左右逢稳').getByRole('button', { name: '开始挑战' }).click();
  await heading('左右逢稳');
  await page.clock.runFor(rightDockLeadInMs);
  await shot(135, 30);
  await title('本投已立稳');
  await page.getByText('右端 已立稳').waitFor({ timeout: 3000 });
  await shot(75, 250);
  await title('掉到地面');
  await page.getByText('右端 已立稳').waitFor({ timeout: 3000 });
  await page.clock.runFor(leftDockLaunchMs - rightDockLeadInMs - 2 * shotWindowMs);
  await shot(135, -33);
  await title('「左右逢稳」已完成');
  await reloadChallenges();
  await earned('左右逢稳');

  await button('声音关').click();
  await page.reload();
  assert.equal(await button('声音开').getAttribute('aria-pressed'), 'true');
  await button('选关重玩').click();
  await page.getByRole('dialog', { name: '选关', exact: true })
    .getByRole('button', { name: /第 4 关.*一瓶之地.*已通过/ }).click();
  await page.getByText('在高亮目标上立稳。').waitFor({ timeout: 3000 });
}

async function checkSingleSettlement(page) {
  await launchChapter(page);
  await freezeClock(page);
  const court = page.locator('#court');
  const status = page.getByRole('status');
  const button = name => page.getByRole('button', { name, exact: true });
  await swipe(court, 137);
  await page.clock.runFor(2000);
  await button('挑战').click();
  const streakArt = page.getByRole('region', { name: '连翻到底', exact: true }).locator('.medal-art');
  assert.equal(await streakArt.evaluate(element => getComputedStyle(element).filter), 'none');
  await button('开始连翻').click();
  await page.getByRole('heading', { name: '连翻到底', exact: true }).waitFor({ timeout: 3000 });
  await swipe(court, 137);
  await page.clock.runFor(250);
  await status.getByText('翻转中', { exact: true }).waitFor({ timeout: 3000 });
  await checkFrozenShot(page, 'background');
  await waitForHold(page);
  await checkFrozenShot(page, 'landscape');
  const count = page.locator('#streak-round');
  assert.equal(await count.textContent(), '0 次');
  await page.clock.runFor(5000);
  assert.equal(await count.textContent(), '1 次');
  const back = page.locator('.toolbar').getByRole('button', { name: '返回挑战', exact: true });
  assert.ok((await back.boundingBox()).x < (await page.locator('#sound').boundingBox()).x);
  await back.click({ timeout: 3000 });
  await page.getByRole('heading', { name: '挑战', exact: true }).waitFor({ timeout: 3000 });
  assert.equal(await court.isVisible(), false);
  assert.equal(await page.locator('#challenge-record').textContent(), '0 次');
  await button('开始连翻').click();
  assert.equal(await count.textContent(), '0 次');
}

async function checkBlockedStorage(page) {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
  });
  await launchChapter(page);
  const court = page.locator('#court');
  const status = page.getByRole('status');
  await freezeClock(page);
  await swipe(court, 90);
  await page.getByText('本次进度无法跨次保存。').waitFor({ timeout: 3000 });
  await page.clock.runFor(2500);
  await status.getByText('瓶子倒下了').waitFor({ timeout: 3000 });
  await swipe(court, 137);
  await page.clock.runFor(2000);
  await page.getByRole('button', { name: '下一关' }).click();
  await page.getByRole('heading', { name: '书山登顶' }).waitFor({ timeout: 3000 });
  await page.reload();
  await page.getByRole('button', { name: '开始闯关' }).waitFor({ timeout: 3000 });
}

async function main() {
  const browser = await chromium.launch();
  try {
    for (const check of [checkMedalArt, checkLevelPicker, checkBrowserTouch, checkChapter, checkSingleSettlement, checkBlockedStorage]) {
      const page = await browser.newPage({ viewport: portrait, isMobile: true, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error));
      await check(page);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Mobile Chromium passed the shared level picker, touch gestures, all five levels, silent feedback, pause and single settlement, medals, reload, and blocked storage.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
