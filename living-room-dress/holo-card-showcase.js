/* ==========================================================================
   EggBabe · 3D 分区全息典藏卡独立检视器（UMD）
   - 场景 1：设置 →「我的收藏卡 · 实体蛋纪念档案」（一蛋一份 3D 全息身份卡 + 背面档案）
   - 场景 2：收藏柜 → 小物件详情「3D 全息赏玩」（全息卡面 + 背面冷幽默微故事/双宠切换）
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeHoloCardShowcase = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  let modalEl = null;
  let cardEl = null;
  let frontEl = null;
  let rafId = 0;
  let flipped = false;
  let currentRy = 0;
  let targetRy = 0;
  let currentRx = 0;
  let targetRx = 0;
  let currentFlip = 0;
  let pointerInside = false;
  let activeBackAction = null;
  let activeKeepsakeItem = null;
  let activeStoryPet = "yutu";
  let lastFrameMs = 0;
  let clockSec = 0;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.id = "eb-holo-card-modal";
    modalEl.className = "eb-holo-modal";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.setAttribute("aria-label", "3D 全息典藏卡检视");
    modalEl.hidden = true;

    modalEl.addEventListener("click", (ev) => {
      if (ev.target === modalEl) close();
    });
    document.body.appendChild(modalEl);

    window.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && modalEl && !modalEl.hidden) close();
    });

    return modalEl;
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function startLoop() {
    stopLoop();
    lastFrameMs = performance.now();
    const step = (nowMs) => {
      if (!modalEl || modalEl.hidden || !cardEl) {
        rafId = 0;
        return;
      }
      const dt = Math.min(0.05, (nowMs - lastFrameMs) / 1000);
      lastFrameMs = nowMs;
      clockSec += dt;

      if (!pointerInside) {
        targetRx = Math.cos(clockSec * 1.15) * 6;
        targetRy = Math.sin(clockSec * 0.9) * 12;
      }
      const targetFlipAngle = flipped ? 180 : 0;
      const smooth = 1 - Math.exp(-dt * 10);
      currentRx += (targetRx - currentRx) * smooth;
      currentRy += (targetRy - currentRy) * smooth;
      currentFlip += (targetFlipAngle - currentFlip) * (1 - Math.exp(-dt * 9));

      cardEl.style.transform =
        `rotateX(${currentRx.toFixed(2)}deg) rotateY(${(currentRy + currentFlip).toFixed(2)}deg)`;

      if (frontEl) {
        const nx = clamp(currentRy / 22, -1, 1);
        const ny = clamp(currentRx / 22, -1, 1);
        cardEl.style.setProperty("--px", (50 + nx * 50).toFixed(1));
        cardEl.style.setProperty("--py", (50 - ny * 50).toFixed(1));
        cardEl.style.setProperty("--hyp", Math.min(1, Math.hypot(nx, ny)).toFixed(3));
      }

      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function bindCardPointer(stageEl) {
    const updatePointer = (ev) => {
      if (!cardEl) return;
      const rect = cardEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const hx = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      const hy = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
      pointerInside = true;
      const sign = flipped ? -1 : 1;
      targetRx = (0.5 - hy) * 28;
      targetRy = (hx - 0.5) * 34 * sign;
    };

    stageEl.addEventListener("pointermove", updatePointer);
    stageEl.addEventListener("pointerdown", updatePointer);
    stageEl.addEventListener("pointerleave", () => { pointerInside = false; });
    stageEl.addEventListener("pointerup", () => {
      if (pointerInside) {
        setTimeout(() => { pointerInside = false; }, 650);
      }
    });
  }

  function renderModal(card, opts) {
    const host = ensureModal();
    const options = opts || {};
    const isEntity = card.kind === "entity-egg";
    const ordinary = !!options.isOrdinary;

    flipped = false;
    currentRx = 0;
    currentRy = -18;
    currentFlip = 0;
    pointerInside = false;
    activeBackAction = typeof options.onOpenCurio === "function" ? options.onOpenCurio : null;

    const eyebrowText = isEntity ? "MY EGG · 实体蛋全息收藏卡" : "KEEPSAKE · 3D 全息典藏赏玩";
    const serialText = isEntity
      ? card.serial
      : (ordinary ? "蛋宝宝留存" : `NO. ${card.serial}`);

    let backBodyHtml = "";
    if (isEntity && card.backMeta) {
      const m = card.backMeta;
      const keepsakeLine = ordinary ? `已留存 ${m.unlockedCount} 件` : `${m.unlockedCount} / 41 件`;
      backBodyHtml = `
        <div>
          <div class="eb-holo-back__eyebrow">${escapeHtml(m.eyebrow)}</div>
          <h3 class="eb-holo-back__title">${escapeHtml(card.name)} · ${escapeHtml(card.prototypeLabel)}</h3>
          <div class="eb-holo-back__divider"></div>
        </div>
        <div class="eb-holo-back__meta">
          <div class="eb-holo-back__cell">
            <span class="eb-holo-back__label">蛋宝宝号</span>
            <span class="eb-holo-back__val">${escapeHtml(m.publicId)}</span>
          </div>
          <div class="eb-holo-back__cell">
            <span class="eb-holo-back__label">陪伴天数</span>
            <span class="eb-holo-back__val">累计 ${m.totalDays} 天</span>
          </div>
          <div class="eb-holo-back__cell">
            <span class="eb-holo-back__label">初遇日期</span>
            <span class="eb-holo-back__val">${escapeHtml(m.firstMetAt)}</span>
          </div>
          <div class="eb-holo-back__cell">
            <span class="eb-holo-back__label">多宝收藏</span>
            <span class="eb-holo-back__val">${escapeHtml(keepsakeLine)}</span>
          </div>
        </div>
        <p class="eb-holo-back__story">${escapeHtml(m.moodQuote)}</p>
        <div class="eb-holo-back__foot">${escapeHtml(m.batchNote)}</div>
      `;
    } else {
      const hasDual = !!(card.stories && card.stories.yutu && card.stories.koi);
      const storyText = hasDual
        ? (card.stories[activeStoryPet] || card.stories.yutu)
        : (card.story || card.trait || "");
      backBodyHtml = `
        <div>
          <div class="eb-holo-back__eyebrow">EGGBABE · 拾物手记</div>
          <h3 class="eb-holo-back__title">${escapeHtml(card.name)}</h3>
          <div class="eb-holo-back__divider"></div>
        </div>
        <p class="eb-holo-back__story" id="eb-holo-back-story">${escapeHtml(storyText)}</p>
        ${hasDual ? `
          <div style="display:flex;justify-content:center;gap:8px;">
            <button class="eb-holo-btn eb-holo-btn--pet-seg${activeStoryPet === "yutu" ? " is-active" : ""}" type="button" data-holo-story-pet="yutu">🐰 玉兔记忆</button>
            <button class="eb-holo-btn eb-holo-btn--pet-seg${activeStoryPet === "koi" ? " is-active" : ""}" type="button" data-holo-story-pet="koi">🐟 锦鲤记忆</button>
          </div>
        ` : ""}
        <div class="eb-holo-back__foot">${escapeHtml(card.tag)} · ${escapeHtml(card.rarityLabel)}</div>
      `;
    }

    host.innerHTML = `
      <div class="eb-holo-modal__top">
        <span class="eb-holo-modal__eyebrow">${escapeHtml(eyebrowText)}</span>
        <button id="eb-holo-close-btn" class="eb-holo-modal__close" type="button" aria-label="关闭全息卡">×</button>
      </div>

      <div id="eb-holo-stage" class="eb-holo-stage">
        <div
          id="eb-holo-card"
          class="eb-holo-card rarity-${escapeHtml(card.rarity || "holo")}"
          style="--card-frame-bg:${card.frameBg};--card-plaque-bg:${card.plaqueBg};--card-edge-color:${card.edgeColor};--card-text-color:${card.textColor};--card-window-bg:${card.windowBg};"
          role="button"
          tabindex="0"
          aria-label="拖动倾斜查看全息反光，轻触翻转卡背"
        >
          <i class="eb-holo-card__edge eb-holo-card__edge--1"></i>
          <i class="eb-holo-card__edge eb-holo-card__edge--2"></i>

          <div class="eb-holo-card__front" id="eb-holo-front">
            <i class="eb-holo-card__bevel"></i>
            <div class="eb-holo-card__window"><i class="eb-holo-card__vignette"></i></div>
            <i class="eb-holo-card__holo"></i>
            <i class="eb-holo-card__glare"></i>
            <div class="eb-holo-card__plaque">
              <div class="eb-holo-card__head">
                <b class="eb-holo-card__name">${escapeHtml(card.name)}</b>
                <span class="eb-holo-card__tag">${escapeHtml(card.tag)}</span>
              </div>
              <p class="eb-holo-card__trait">${escapeHtml(card.trait || "")}</p>
              <div class="eb-holo-card__foot">
                <span class="eb-holo-card__serial">${escapeHtml(serialText)}</span>
                <span class="eb-holo-card__rarity">${escapeHtml(card.rarityMark || "✦")} ${escapeHtml(card.rarityLabel || "")}</span>
              </div>
            </div>
            <i class="eb-holo-card__clearcoat"></i>
          </div>

          <div class="eb-holo-card__pop">
            <img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" draggable="false" />
          </div>

          <div class="eb-holo-card__back">${backBodyHtml}</div>
        </div>
      </div>

      <p class="eb-holo-modal__hint">滑动倾斜赏玩全息折射 · 轻触卡牌翻转背面档案</p>

      <div class="eb-holo-modal__actions">
        <button id="eb-holo-flip-btn" class="eb-holo-btn" type="button">↻ 翻转背面</button>
        ${activeBackAction ? `<button id="eb-holo-curio-btn" class="eb-holo-btn eb-holo-btn--primary" type="button">🪵 前往多宝收藏格</button>` : ""}
      </div>
    `;

    cardEl = host.querySelector("#eb-holo-card");
    frontEl = host.querySelector("#eb-holo-front");
    const stageEl = host.querySelector("#eb-holo-stage");
    const flipBtn = host.querySelector("#eb-holo-flip-btn");

    const toggleFlip = () => {
      flipped = !flipped;
      if (flipBtn) flipBtn.textContent = flipped ? "↻ 转回正面" : "↻ 翻转背面";
      if (typeof options.onTap === "function") options.onTap();
    };

    bindCardPointer(stageEl);

    host.querySelector("#eb-holo-close-btn")?.addEventListener("click", () => {
      if (typeof options.onTap === "function") options.onTap();
      close();
    });

    flipBtn?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleFlip();
    });

    cardEl?.addEventListener("click", (ev) => {
      if (ev.target && ev.target.closest && ev.target.closest("[data-holo-story-pet]")) return;
      ev.stopPropagation();
      toggleFlip();
    });

    host.querySelector("#eb-holo-curio-btn")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const fn = activeBackAction;
      close();
      if (typeof fn === "function") fn();
    });

    host.querySelectorAll("[data-holo-story-pet]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        activeStoryPet = btn.dataset.holoStoryPet === "koi" ? "koi" : "yutu";
        host.querySelectorAll("[data-holo-story-pet]").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.holoStoryPet === activeStoryPet);
        });
        const storyEl = host.querySelector("#eb-holo-back-story");
        if (storyEl && activeKeepsakeItem && activeKeepsakeItem.stories) {
          storyEl.textContent = activeKeepsakeItem.stories[activeStoryPet] || activeKeepsakeItem.stories.yutu || "";
        }
      });
    });

    host.hidden = false;
    startLoop();
  }

  function openEntityEggCard(opts) {
    const Config = window.EggBabeHoloConfig;
    if (!Config) return;
    activeKeepsakeItem = null;
    const card = Config.buildEntityEggCardData(opts);
    renderModal(card, opts);
  }

  function openKeepsakeCard(keepsakeItem, opts) {
    const Config = window.EggBabeHoloConfig;
    if (!Config || !keepsakeItem) return;
    const options = opts || {};
    const pool = Config.buildKeepsakeCardPool({ keepsakes: [keepsakeItem] }, options.assetPrefix || "./");
    const card = pool[0];
    if (!card) return;
    if (options.serial) card.serial = options.serial;
    activeKeepsakeItem = card;
    activeStoryPet = options.activePetId === "koi" ? "koi" : "yutu";
    renderModal(card, options);
  }

  function close() {
    stopLoop();
    if (modalEl) {
      modalEl.hidden = true;
      modalEl.innerHTML = "";
    }
    cardEl = null;
    frontEl = null;
  }

  return {
    openEntityEggCard,
    openKeepsakeCard,
    close
  };
});
