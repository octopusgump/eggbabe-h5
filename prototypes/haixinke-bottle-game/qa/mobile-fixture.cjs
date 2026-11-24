const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');

const url = 'http://game.test/';
const assets = new Set([
  'index.html', 'style.css', 'play.mjs', 'physics.mjs', 'levels.mjs', 'progress.mjs',
  'challenge.mjs', 'effects.mjs', 'room.mjs', 'sound.mjs',
  'appearances.mjs', 'appearance-screen.mjs', 'logo.png',
  'medal-streak.png', 'medal-book-stack.png', 'medal-narrow-platform.png', 'medal-both-docks.png',
]);

async function routeGame(page) {
  await page.route(url + '**', async route => {
    const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
    if (!assets.has(name)) return route.fulfill({ status: 404 });
    const contentType = {
      mjs: 'text/javascript',
      css: 'text/css',
      html: 'text/html',
      png: 'image/png',
    }[name.split('.').pop()];
    await route.fulfill({ body: await readFile(resolve(__dirname, '..', name)), contentType });
  });
}

function swipe(court, duration, dx = 0, cancel = false) {
  return court.evaluate((canvas, { duration, dx, cancel }) => {
    const { left, top, width } = canvas.getBoundingClientRect();
    const scale = width / 360;
    const init = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch', bubbles: true };
    // Synthetic pointer events do not register an active pointer with the browser.
    canvas.setPointerCapture = () => {};
    const dispatch = (kind, time, x, y) => {
      const event = new PointerEvent('pointer' + kind, { ...init, clientX: left + x * scale, clientY: top + y * scale });
      Object.defineProperty(event, 'timeStamp', { value: time });
      canvas.dispatchEvent(event);
    };
    dispatch('down', 100, 160, 280);
    if (cancel) dispatch('cancel', 100 + duration / 2, 160 + dx / 2, 235);
    dispatch('up', 100 + duration, 160 + dx, 190);
  }, { duration, dx, cancel });
}

module.exports = { routeGame, swipe, url };
