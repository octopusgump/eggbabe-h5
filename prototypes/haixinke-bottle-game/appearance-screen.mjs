import { appearances, koiAppearance } from './appearances.mjs';
import { advanceKoi, paintBottle } from './effects.mjs';
import { dt } from './physics.mjs';

export function createAppearanceScreen(screen, progress, onEquip) {
  const document = screen.ownerDocument;
  const canvas = /** @type {HTMLCanvasElement} */ (screen.querySelector('#bottle-preview'));
  const ctx = canvas.getContext('2d');
  const caption = screen.querySelector('#appearance-caption');
  const equip = /** @type {HTMLButtonElement} */ (screen.querySelector('#equip-appearance'));
  const options = screen.querySelector('.appearance-options');
  let preview = appearances[0];
  let frameId = 0;
  let lastFrameTime = null;
  let elapsed = 0;
  let accumulator = 0;
  const previewPose = { x: 0, y: 0, angle: 0 };

  const choices = appearances.map(appearance => {
    const button = document.createElement('button');
    button.type = 'button';
    const name = document.createElement('strong');
    name.textContent = appearance.name;
    const condition = document.createElement('small');
    condition.textContent = appearance.condition;
    const status = document.createElement('span');
    button.append(name, condition, status);
    button.addEventListener('click', () => {
      preview = appearance;
      render();
    });
    options.append(button);
    return { appearance, button, status };
  });

  function render() {
    const { equippedAppearance, unlockedAppearances } = progress.state;
    for (const { appearance, button, status } of choices) {
      button.setAttribute('aria-pressed', String(appearance === preview));
      status.textContent = appearance.id === equippedAppearance ? '使用中'
        : unlockedAppearances.includes(appearance.id) ? '已解锁' : '未解锁';
    }
    const equipped = preview.id === equippedAppearance;
    equip.disabled = equipped || !unlockedAppearances.includes(preview.id);
    equip.textContent = equipped ? '使用中' : '使用此瓶子';
    caption.textContent = preview.name + (equipped ? ' · 使用中' : ' · 预览');
    paintPreview();
    if (preview.id === koiAppearance) {
      if (!frameId) frameId = requestAnimationFrame(tick);
    } else {
      stopPreview();
    }
  }

  function paintPreview() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(2.25, 2.25);
    const pose = preview.id === koiAppearance ? { ...previewPose, elapsed } : previewPose;
    paintBottle(ctx, pose, Infinity, preview.id);
    ctx.restore();
  }

  function tick(time) {
    if (lastFrameTime !== null) accumulator += Math.min((time - lastFrameTime) / 1000, 0.05);
    lastFrameTime = time;
    while (accumulator >= dt) {
      elapsed += dt;
      advanceKoi(ctx, previewPose, Infinity, elapsed);
      accumulator -= dt;
    }
    paintPreview();
    frameId = requestAnimationFrame(tick);
  }

  function stopPreview() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrameTime = null;
    accumulator = 0;
  }

  equip.addEventListener('click', () => {
    progress.equipAppearance(preview.id);
    onEquip();
  });

  return {
    render,
    stopPreview,
    resetPreview() {
      preview = appearances.find(appearance => appearance.id === progress.state.equippedAppearance) ?? appearances[0];
    },
  };
}
