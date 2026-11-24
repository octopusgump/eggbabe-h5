// Requires Playwright and its Chromium browser. Run with node game/qa/streak.cjs.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { routeGame, swipe: swipeCourt, url } = require('./mobile-fixture.cjs');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
    await routeGame(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    const button = name => page.getByRole('button', { name, exact: true });
    const visible = locator => locator.waitFor({ state: 'visible', timeout: 3000 });
    const hidden = locator => locator.waitFor({ state: 'hidden', timeout: 3000 });
    const levelPicker = page.getByRole('dialog', { name: '选关', exact: true });
    const currentLevel = id => page.locator('.toolbar').getByRole('button', { name: `第 ${id} 关`, exact: true });
    const replayLevel = (id, name) => levelPicker.getByRole('button', { name: `第 ${id} 关 ${name} 已通过`, exact: true });
    const cancelLevelPicker = () => levelPicker.getByRole('button', { name: '取消', exact: true }).click();
    const status = page.getByRole('status');
    const round = page.locator('#streak-round');
    const record = page.locator('#streak-record');
    const court = page.locator('#court');
    const swipe = (duration, dx = 0) => swipeCourt(court, duration, dx);
    const success = n => page.waitForFunction(n => document.querySelector('#streak-round').textContent === n + ' 次', n);
    const five = async () => {
      for (let n = 1; n <= 5; n++) {
        await swipe(137);
        await success(n);
      }
    };
    const miss = async () => {
      await swipe(75, 250);
      await visible(status.getByText('本轮结束', { exact: true }));
    };
    const home = () => button('返回首页').click();
    const check = async (locator, value) => assert.equal(await locator.textContent(), value);
    const challengesTitle = page.getByRole('heading', { name: '挑战', exact: true });
    const streakEntry = page.getByRole('region', { name: '连翻到底', exact: true });
    const startStreak = streakEntry.getByRole('button', { name: /^(开始连翻|未解锁)$/ });
    const medals = ['书堆双稳', '窄台靶心', '左右逢稳'];
    const medalEntry = name => page.getByRole('region', { name, exact: true });
    const openChallenges = async () => {
      await button('挑战').click({ timeout: 3000 });
      await visible(challengesTitle);
    };
    const startStreakFromHome = async () => {
      await openChallenges();
      await startStreak.click();
    };
    const returnFromStreak = async () => {
      await button('返回挑战').click();
      await visible(challengesTitle);
      await hidden(court);
      await home();
    };
    const checkMedalsLocked = async () => {
      for (const name of medals) {
        const locked = medalEntry(name).getByRole('button', { name: '未解锁', exact: true });
        await visible(locked);
        assert.equal(await locked.isDisabled(), true);
      }
    };

    await page.goto(url);
    await visible(button('开始闯关'));
    await hidden(streakEntry);
    await openChallenges();
    await visible(startStreak);
    assert.equal(await startStreak.isDisabled(), true);
    await checkMedalsLocked();
    await button('返回首页').click();
    await visible(button('开始闯关'));
    const appearanceScreen = page.getByRole('region', { name: '瓶子外观' });
    const preview = name => appearanceScreen.getByRole('button', { name: new RegExp(name) });
    const openAppearances = () => button('换个瓶').click({ timeout: 3000 });
    const equip = appearanceScreen.getByRole('button', { name: '使用此瓶子', exact: true });
    const previewImage = () => page.locator('#bottle-preview').evaluate(canvas => canvas.toDataURL());
    await openAppearances();
    assert.equal(await appearanceScreen.getByRole('heading').count(), 0);
    await hidden(levelPicker);
    const originalPreview = await previewImage();
    let previewImages = [originalPreview];
    for (const [name, condition] of [
      ['焦糖咕噜', '五关全部通过'],
      ['瓶中余烬', '连翻到底，连续立稳5次'],
      ['瓶中有鲤', '连翻到底，连续立稳10次'],
    ]) {
      await preview(name).click();
      await visible(appearanceScreen.getByText(condition, { exact: true }));
      assert.equal(await equip.isDisabled(), true);
      previewImages = [...previewImages, await previewImage()];
    }
    assert.equal(new Set(previewImages).size, 4);
    await page.waitForFunction(image => document.querySelector('#bottle-preview').toDataURL() !== image,
      previewImages.at(-1), { timeout: 1000 });
    await button('返回首页').click();
    await button('开始闯关').click();
    await visible(page.getByRole('heading', { name: '桌上首飞' }));
    await swipe(137);
    await openChallenges();
    assert.equal(await startStreak.isEnabled(), true);
    await checkMedalsLocked();
    await startStreak.click();
    await five();
    await check(record, '0 次');
    await miss();
    await check(round, '5 次');
    await check(record, '5 次');
    await visible(status.getByText('新纪录', { exact: false }));
    await swipe(137);
    await check(round, '0 次');
    await success(1);
    await swipe(137);
    await visible(status.getByText('翻转中', { exact: true }));

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await visible(button('继续'));
    await check(round, '1 次');
    const canvasImage = () => court.evaluate(canvas => canvas.toDataURL());
    const pausedImage = await canvasImage();
    await page.waitForTimeout(200);
    assert.equal(await canvasImage(), pausedImage);
    await check(round, '1 次');
    await button('继续').click();
    await success(2);

    await page.reload();
    await visible(button('继续闯关'));
    await openChallenges();
    await check(page.locator('#challenge-record'), '5 次');
    await home();
    await button('继续闯关').click();
    await visible(page.getByRole('heading', { name: '书山登顶' }));
    await currentLevel(2).click();
    await replayLevel(1, '桌上首飞').click();
    await swipe(137);
    await visible(status.getByText('立稳成功', { exact: true }));
    await hidden(button('挑战'));
    await home();
    await startStreakFromHome();
    await check(round, '0 次');
    await five();
    await miss();
    await check(round, '5 次');
    await check(record, '5 次');
    await hidden(status.getByText('新纪录', { exact: false }));

    await page.evaluate(() => {
      const key = 'half-bottle-flip:chapter:v1';
      localStorage.setItem(key, JSON.stringify({ cleared: 5, personalRecord: 2 }));
    });
    await page.reload();
    await openAppearances();
    await preview('焦糖咕噜').click();
    await equip.click();
    await visible(appearanceScreen.getByRole('button', { name: '使用中', exact: true }));
    await button('返回首页').click();
    await startStreakFromHome();
    const creamInGame = await canvasImage();
    for (let n = 1; n <= 10; n++) {
      await swipe(137);
      await success(n);
    }
    await check(record, '2 次');
    await returnFromStreak();
    await openAppearances();
    await preview('瓶中有鲤').click();
    assert.equal(await equip.isDisabled(), true);
    await button('返回首页').click();
    await startStreakFromHome();
    for (let n = 1; n <= 10; n++) {
      await swipe(137);
      await success(n);
    }
    await miss();
    await check(record, '10 次');
    await page.reload();
    await openChallenges();
    await check(page.locator('#challenge-record'), '10 次');
    await home();
    await openAppearances();
    await visible(appearanceScreen.getByRole('button', { name: '使用中', exact: true }));
    for (const name of ['瓶中余烬', '瓶中有鲤']) {
      await preview(name).click();
      assert.equal(await equip.isEnabled(), true);
    }
    await equip.click();
    const equippedId = await page.evaluate(() => JSON.parse(
      localStorage.getItem('half-bottle-flip:chapter:v1')
    ).equippedAppearance);
    assert.equal(equippedId, 'star-sticker');
    await page.reload();
    await openAppearances();
    assert.equal(await preview('瓶中有鲤').getAttribute('aria-pressed'), 'true');
    await visible(appearanceScreen.getByRole('button', { name: '使用中', exact: true }));
    await button('返回首页').click();
    await startStreakFromHome();
    assert.notEqual(await canvasImage(), creamInGame);
    await page.waitForFunction(image => document.querySelector('#court').toDataURL() !== image,
      await canvasImage(), { timeout: 1000 });
    await returnFromStreak();
    await openAppearances();
    await preview('原瓶').click();
    await equip.click();
    await button('返回首页').click();

    await page.evaluate(() => {
      const key = 'half-bottle-flip:chapter:v1';
      const saved = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...saved, cleared: 4 }));
    });
    await page.reload();
    const viewportHeight = 640;
    const assertCourtFits = async width => {
      const { y, height } = await court.boundingBox();
      assert.ok(y >= 0 && y + height <= viewportHeight, `The court fits in the first viewport at ${width}px`);
    };

    await page.setViewportSize({ width: 320, height: viewportHeight });
    const clockStart = new Date();
    await page.clock.install({ time: clockStart });
    await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
    await button('继续闯关').click({ timeout: 3000 });
    await visible(page.getByRole('heading', { name: '接瓶专线' }));
    await visible(currentLevel(5));
    await hidden(levelPicker);
    await page.clock.runFor(267);
    await swipe(135, 30);
    await page.clock.runFor(2000);
    await visible(status.getByText('立稳成功', { exact: true }));
    await hidden(levelPicker);
    for (const name of medals) await hidden(medalEntry(name));
    await assertCourtFits(320);
    await openChallenges();
    for (const name of medals) {
      const startMedal = medalEntry(name).getByRole('button', { name: '开始挑战', exact: true });
      await visible(startMedal);
      assert.equal(await startMedal.isEnabled(), true);
    }
    await home();
    await button('选关重玩').click({ timeout: 3000 });
    await visible(levelPicker);
    await hidden(court);
    await cancelLevelPicker();
    await hidden(levelPicker);
    await visible(button('选关重玩'));
    await button('选关重玩').click({ timeout: 3000 });
    await replayLevel(1, '桌上首飞').click();

    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: viewportHeight });
      await visible(court);
      await hidden(levelPicker);
      for (const name of medals) await hidden(medalEntry(name));
      await assertCourtFits(width);
      await currentLevel(1).click({ timeout: 3000 });
      await visible(levelPicker);
      assert.equal(await levelPicker.getByRole('button', { name: /第 [1-5] 关.*已通过/ }).count(), 5);
      const { y, height } = await levelPicker.boundingBox();
      assert.ok(Math.abs(y + height - viewportHeight) < 2, `The picker is anchored to the bottom at ${width}px`);
      for (const name of medals) await hidden(medalEntry(name));
      await cancelLevelPicker();
      await hidden(levelPicker);
    }

    await home();
    await openChallenges();
    for (const name of medals) {
      await medalEntry(name).getByRole('button').click();
      await visible(page.getByRole('heading', { name, exact: true }));
      await hidden(levelPicker);
      await button('返回挑战').click();
      await visible(challengesTitle);
      await hidden(court);
    }

    await home();
    await button('选关重玩').click();
    await replayLevel(5, '接瓶专线').click();
    await visible(page.getByRole('heading', { name: '接瓶专线' }));
    await button('选关重玩').click();
    await visible(levelPicker);
    await cancelLevelPicker();
    await hidden(levelPicker);
    await visible(page.getByRole('heading', { name: '接瓶专线' }));
    assert.deepEqual(errors, []);
    console.log('Mobile Chromium passed streak play, pause, post-clear layout and navigation, appearance previews, settlement, equipping, and reload.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
