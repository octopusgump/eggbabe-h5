/* =========================================================================
 * EggBabe H5 · 「一起画（拾物临摹）」小游戏（1:1 复刻 eggbabe-miniprogram）
 * - 对齐服务：companion-prop-doodle.js / companion-prop-challenge.js /
 *           companion-drawing-gate.js / egg-shell-art.js
 * - 结算联动：解锁 41 件小物件入「收藏格（空木格自动摆入）」+ 奖励 +10✦ 星星
 * ========================================================================= */
(function () {
  "use strict";

  const Store = window.EggBabeStore || window.EggBabeCrossEndStore;
  const catalog = window.__EGGBABE_CATALOG__ || window.EGGBABE_CATALOG || { keepsakes: [] };
  const storageAdapter = Store.createStorageAdapter();

  const LOOK_DURATION_MS = 5000;
  const MANUAL_LOOKS = 3;
  const PROP_DRAWING_REWARD = 10;
  const DAILY_MINIGAME_STAR_CAP = 45;

  // 门禁常量：有效绘画时间缩短至 3 秒（3000ms）
  const GRID_SIZE = 10;
  const MIN_STROKES = 3;
  const MIN_ACTIVE_MS = 3000;
  const MIN_CELLS = 4;
  const IDLE_GAP_MS = 1200;
  const INCOMPLETE_HINT = "再画满 3 秒，让我看得清楚一点～";

  // 对齐 egg-shell-art.js 画笔颜色、粗细、橡皮与贴纸
  const BRUSH_SIZES = [2, 5, 8, 12, 18];
  const ERASER_SIZES = [6, 10, 15, 22, 30];
  const BRUSH_COLORS = [
    { token: "walnut-ink", name: "胡桃木墨", value: "#3A2818" },
    { token: "forest", name: "森林绿", value: "#526B4D" },
    { token: "apricot-orange", name: "杏子橙", value: "#D98652" },
    { token: "lake-blue", name: "湖水蓝", value: "#5F8FA8" },
    { token: "berry-pink", name: "莓果粉", value: "#C97682" },
    { token: "grape-purple", name: "葡萄紫", value: "#8573A3" },
    { token: "mist-sage", name: "雾松绿", value: "#AFC29A" },
    { token: "butter-yellow", name: "奶油黄", value: "#E6CE73" },
    { token: "sky-blue", name: "晴空蓝", value: "#9EC7D8" },
    { token: "wine-red", name: "葡萄酒红", value: "#7B3E52" },
    { token: "lavender", name: "浅藤紫", value: "#B9ABD2" }
  ];
  const STICKERS = [
    { type: "star", name: "星星", symbol: "✦" },
    { type: "heart", name: "爱心", symbol: "♡" },
    { type: "leaf", name: "小叶", symbol: "🌿" }
  ];

  const params = new URLSearchParams(window.location.search);
  const isEmbedded = params.get("embed") === "1" || window.parent !== window;
  if (isEmbedded) {
    document.body.classList.add("is-embedded");
  }

  const $ = (id) => document.getElementById(id);
  const standaloneStarPillEl = $("standalone-star-pill");
  const btnLookAgainEl = $("btn-look-again");
  const lookPillTextEl = $("look-pill-text");
  const btnRerollPropEl = $("btn-reroll-prop");
  const paperTargetTagEl = $("paper-target-tag");
  const paperStrokeHintEl = $("paper-stroke-hint");
  const propPeekLayerEl = $("prop-peek-layer");
  const peekBadgeEl = $("peek-badge");
  const propSketchImgEl = $("prop-sketch-img");
  const peekPropNameEl = $("peek-prop-name");
  const peekProgressFillEl = $("peek-progress-fill");
  const btnSkipPeekEl = $("btn-skip-peek");
  const canvasSlotEl = $("prop-canvas-slot");
  const canvasEl = $("doodle-canvas");
  const ctx = canvasEl.getContext("2d");
  const actionRailEl = $("canvas-action-rail");
  const btnUndoEl = $("btn-undo");
  const btnClearEl = $("btn-clear");
  const iconUndoEl = $("icon-undo");
  const iconClearEl = $("icon-clear");
  const footerEl = $("doodle-footer");
  const btnFinishDrawEl = $("btn-finish-draw");
  const brushSizeListEl = $("brush-size-list");
  const brushColorListEl = $("brush-color-list");
  const eraserSizeListEl = $("eraser-size-list");
  const stickerListEl = $("sticker-list");
  const subpanelBrushEl = $("subpanel-brush");
  const subpanelEraserEl = $("subpanel-eraser");
  const subpanelStickerEl = $("subpanel-sticker");
  const activeColorDotEl = $("active-color-dot");

  const unlockLayerEl = $("prop-unlock-layer");
  const unlockAwardWrapEl = $("unlock-award-wrap");
  const unlockStarImgEl = $("unlock-star-img");
  const unlockAwardPlusEl = $("unlock-award-plus");
  const unlockStatusPillEl = $("unlock-status-pill");
  const unlockColoredImgEl = $("unlock-colored-img");
  const unlockSketchPreviewEl = $("unlock-sketch-preview");
  const unlockPropNameEl = $("unlock-prop-name");
  const unlockGiftLineEl = $("unlock-gift-line");
  const unlockStoryEl = $("unlock-story");
  const btnUnlockOpenCurioEl = $("btn-unlock-open-curio");
  const btnUnlockNextEl = $("btn-unlock-next");
  const btnUnlockDoneEl = $("btn-unlock-done");

  // 轻量 Web Audio 反馈音效
  let audioCtx = null;
  function playTone(freq, endFreq, dur, gainVal) {
    try {
      const store = loadLatestStore();
      if (store.settings && store.settings.sfxOn === false) return;
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
      gain.gain.setValueAtTime(gainVal || 0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur);
    } catch (_) {}
  }
  const sfx = {
    tap: () => playTone(560, 740, 0.06, 0.04),
    peek: () => playTone(480, 660, 0.09, 0.045),
    warn: () => playTone(320, 260, 0.12, 0.04),
    award: () => {
      playTone(587.33, 783.99, 0.14, 0.06);
      setTimeout(() => playTone(783.99, 1046.5, 0.22, 0.065), 110);
      setTimeout(() => playTone(1046.5, 1318.5, 0.28, 0.06), 230);
    }
  };

  function loadLatestStore() {
    return Store.loadOrMigrateStore(storageAdapter, catalog).store;
  }

  function sharedAssetUrl(relPath) {
    const clean = String(relPath || "").replace(/^\.?\//, "");
    return "../../" + clean;
  }

  // 状态机
  let activeTool = "brush";
  let brushSize = 5;
  let eraserSize = 15;
  let brushColor = BRUSH_COLORS[0].value;
  let selectedSticker = STICKERS[0];

  let currentProp = null;
  let lookRemaining = MANUAL_LOOKS;
  let drawingLocked = true;
  let operations = []; // { type: 'stroke'|'sticker', tool, color, size, points: [{x,y}], symbol }
  let currentOp = null;
  let gateTracker = createGateTracker();

  let peekTimer = null;
  let peekRaf = null;
  let peekStartAt = 0;
  let gateHintTimer = null;
  let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  let logicalW = 300;
  let logicalH = 300;

  /* ---------- Gate Tracker（对齐 companion-drawing-gate.js） ---------- */
  function createGateTracker() {
    return {
      strokes: 0,
      activeMs: 0,
      cells: new Set(),
      lastActiveAt: null,
      pathLenNorm: 0
    };
  }

  function cellIndex(pt) {
    const col = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(pt.x * GRID_SIZE)));
    const row = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(pt.y * GRID_SIZE)));
    return row * GRID_SIZE + col;
  }

  function rebuildGateFromOperations(prevActiveMs) {
    const tracker = createGateTracker();
    tracker.activeMs = prevActiveMs || 0;
    operations.forEach((op) => {
      if (op.type === "stroke" && op.tool === "brush" && op.points.length > 0) {
        tracker.strokes += 1;
        for (let i = 0; i < op.points.length; i++) {
          tracker.cells.add(cellIndex(op.points[i]));
          if (i > 0) {
            tracker.pathLenNorm += Math.hypot(
              op.points[i].x - op.points[i - 1].x,
              op.points[i].y - op.points[i - 1].y
            );
          }
        }
      } else if (op.type === "sticker") {
        tracker.strokes += 1;
        tracker.cells.add(cellIndex(op.point));
      }
    });
    return tracker;
  }

  function evaluateGate(tracker) {
    const enoughStrokes = tracker.strokes >= MIN_STROKES;
    const enoughCells = tracker.cells.size >= MIN_CELLS;
    const enoughEffort = tracker.activeMs >= MIN_ACTIVE_MS || tracker.pathLenNorm >= 0.65;
    const ok = enoughStrokes && enoughCells && enoughEffort;
    return { ok, hint: ok ? "" : INCOMPLETE_HINT };
  }

  /* ---------- 选品策略：支持 ?propId 指定，否则优先抽取「尚未收集」的小物件 ---------- */
  function pickTargetProp(forceRandomNew, excludeId) {
    const allProps = Array.isArray(catalog.keepsakes) ? catalog.keepsakes : [];
    if (!allProps.length) return null;

    if (!forceRandomNew) {
      const requestedId = params.get("propId");
      if (requestedId) {
        const norm = Store.keepsakeAliasNormalizer([requestedId]);
        const cid = norm.unlockedIds[0] || requestedId;
        const exact = allProps.find((k) => k.id === cid);
        if (exact) return exact;
      }
    }

    const store = loadLatestStore();
    const petId = store.activePetId === "yutu" ? "yutu" : "koi";
    const unlockedSet = new Set((store.curioCabinet && store.curioCabinet.unlockedIds) || []);

    // 优先匹配当前宠物可共鸣 + 尚未解锁的小物件，帮助玩家填满多宝格空木格
    const uncollectedPreferred = allProps.filter((k) => {
      if (k.id === excludeId || unlockedSet.has(k.id)) return false;
      return k.category === "shared" || k.category === "daily" || k.category === petId;
    });
    if (uncollectedPreferred.length > 0) {
      return uncollectedPreferred[Math.floor(Math.random() * uncollectedPreferred.length)];
    }

    const anyUncollected = allProps.filter((k) => k.id !== excludeId && !unlockedSet.has(k.id));
    if (anyUncollected.length > 0) {
      return anyUncollected[Math.floor(Math.random() * anyUncollected.length)];
    }

    const pool = allProps.filter((k) => k.id !== excludeId);
    return (pool.length ? pool : allProps)[Math.floor(Math.random() * (pool.length || allProps.length))];
  }

  /* ---------- 画布尺寸与重绘 ---------- */
  function resizeCanvas() {
    const rect = canvasSlotEl.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    logicalW = rect.width;
    logicalH = rect.height;
    canvasEl.width = Math.round(logicalW * dpr);
    canvasEl.height = Math.round(logicalH * dpr);
    redrawAll();
  }

  function redrawAll() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalW, logicalH);

    const allOps = currentOp ? operations.concat([currentOp]) : operations;
    allOps.forEach((op) => {
      if (op.type === "stroke" && op.points.length > 0) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = op.size;
        if (op.tool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = op.color;
        }

        const pts = op.points;
        ctx.beginPath();
        const x0 = pts[0].x * logicalW;
        const y0 = pts[0].y * logicalH;
        ctx.moveTo(x0, y0);
        if (pts.length === 1) {
          ctx.lineTo(x0 + 0.1, y0 + 0.1);
        } else {
          for (let i = 1; i < pts.length - 1; i++) {
            const cx = pts[i].x * logicalW;
            const cy = pts[i].y * logicalH;
            const nx = ((pts[i].x + pts[i + 1].x) * 0.5) * logicalW;
            const ny = ((pts[i].y + pts[i + 1].y) * 0.5) * logicalH;
            ctx.quadraticCurveTo(cx, cy, nx, ny);
          }
          const last = pts[pts.length - 1];
          ctx.lineTo(last.x * logicalW, last.y * logicalH);
        }
        ctx.stroke();
        ctx.restore();
      } else if (op.type === "sticker" && op.point) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.font = "26px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = op.color || brushColor;
        ctx.fillText(op.symbol, op.point.x * logicalW, op.point.y * logicalH);
        ctx.restore();
      }
    });
    ctx.restore();
    syncActionButtons();
  }

  function syncActionButtons() {
    const hasOps = operations.length > 0;
    btnUndoEl.disabled = !hasOps;
    btnClearEl.disabled = !hasOps;
    iconUndoEl.src = hasOps
      ? "../../assets/shared/png/doodle/tool_undo.png"
      : "../../assets/shared/png/doodle/tool_undo_disabled.png";
    iconClearEl.src = hasOps
      ? "../../assets/shared/png/doodle/tool_clear.png"
      : "../../assets/shared/png/doodle/tool_clear_disabled.png";

    btnFinishDrawEl.hidden = !hasOps || !propPeekLayerEl.classList.contains("is-hidden");

    const brushCount = gateTracker.strokes;
    if (!drawingLocked) {
      if (brushCount === 0) {
        paperStrokeHintEl.textContent = "凭记忆在画纸上落笔吧";
      } else if (evaluateGate(gateTracker).ok) {
        paperStrokeHintEl.textContent = `已落笔 ${brushCount} 笔 · 可点击「画好了」`;
      } else {
        const sec = Math.min(3, (gateTracker.activeMs / 1000)).toFixed(1);
        paperStrokeHintEl.textContent = `正在临摹 · ${sec} / 3.0 秒`;
      }
    }
  }

  /* ---------- 5 秒简笔偷看控制 ---------- */
  function lookHintLabel() {
    return `👀 再看一眼 · ${lookRemaining}/${MANUAL_LOOKS} 次`;
  }

  function showGateHint(msg) {
    clearTimeout(gateHintTimer);
    btnLookAgainEl.classList.add("is-gate-hint");
    lookPillTextEl.textContent = msg;
    gateHintTimer = setTimeout(() => {
      btnLookAgainEl.classList.remove("is-gate-hint");
      lookPillTextEl.textContent = lookHintLabel();
    }, 1850);
  }

  function startPeek(isManual) {
    if (!currentProp) return;
    if (isManual) {
      if (lookRemaining <= 0) return;
      lookRemaining -= 1;
      sfx.peek();
    }
    clearTimeout(peekTimer);
    cancelAnimationFrame(peekRaf);

    drawingLocked = true;
    canvasSlotEl.style.pointerEvents = "none";
    actionRailEl.classList.add("is-dimmed");
    footerEl.classList.add("is-dimmed");
    btnFinishDrawEl.hidden = true;

    peekBadgeEl.textContent = isManual
      ? `再看一眼（剩余 ${lookRemaining}/${MANUAL_LOOKS} 次）`
      : "先看 5 秒记住轮廓";
    propPeekLayerEl.classList.remove("is-hidden");
    propPeekLayerEl.setAttribute("aria-hidden", "false");
    btnLookAgainEl.classList.toggle("is-empty", lookRemaining <= 0);
    lookPillTextEl.textContent = "正在偷看简笔线稿 · 5s";

    peekStartAt = performance.now();
    function tickProgress(now) {
      const elapsed = now - peekStartAt;
      const remainRatio = Math.max(0, 1 - elapsed / LOOK_DURATION_MS);
      peekProgressFillEl.style.transform = `scaleX(${remainRatio.toFixed(3)})`;
      const secLeft = Math.max(1, Math.ceil((LOOK_DURATION_MS - elapsed) / 1000));
      if (!btnLookAgainEl.classList.contains("is-gate-hint")) {
        lookPillTextEl.textContent = `正在看线稿 · ${secLeft}s`;
      }
      if (elapsed < LOOK_DURATION_MS) {
        peekRaf = requestAnimationFrame(tickProgress);
      }
    }
    peekRaf = requestAnimationFrame(tickProgress);

    peekTimer = setTimeout(() => {
      dismissPeek();
    }, LOOK_DURATION_MS);
  }

  function dismissPeek() {
    clearTimeout(peekTimer);
    cancelAnimationFrame(peekRaf);
    drawingLocked = false;
    canvasSlotEl.style.pointerEvents = "auto";
    propPeekLayerEl.classList.add("is-hidden");
    propPeekLayerEl.setAttribute("aria-hidden", "true");
    actionRailEl.classList.remove("is-dimmed");
    footerEl.classList.remove("is-dimmed");
    btnLookAgainEl.classList.toggle("is-empty", lookRemaining <= 0);
    lookPillTextEl.textContent = lookHintLabel();
    syncActionButtons();
  }

  /* ---------- 开启新一局临摹 ---------- */
  function startNewSession(forceRandomNew) {
    unlockLayerEl.hidden = true;
    const store = loadLatestStore();
    standaloneStarPillEl.textContent = `✦ ${Number(store.companion.starBalance || 0)}`;

    currentProp = pickTargetProp(!!forceRandomNew, currentProp ? currentProp.id : null);
    operations = [];
    currentOp = null;
    gateTracker = createGateTracker();
    lookRemaining = MANUAL_LOOKS;

    if (currentProp) {
      const unlockedSet = new Set((store.curioCabinet && store.curioCabinet.unlockedIds) || []);
      const statusSuffix = unlockedSet.has(currentProp.id) ? "已收集 · 重温临摹" : "待收入收藏格";
      paperTargetTagEl.textContent = `${currentProp.categoryLabel || "旅途日常"} · ${statusSuffix}`;
      peekPropNameEl.textContent = currentProp.name;
      propSketchImgEl.onerror = () => {
        propSketchImgEl.src = sharedAssetUrl(currentProp.img);
      };
      propSketchImgEl.src = sharedAssetUrl(currentProp.lineImg || currentProp.img);
    }

    resizeCanvas();
    redrawAll();
    startPeek(false);
  }

  /* ---------- Pointer 绘画事件 ---------- */
  function getNormPoint(ev) {
    const rect = canvasEl.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / Math.max(1, rect.width)));
    const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / Math.max(1, rect.height)));
    return { x, y };
  }

  function trackElapsed() {
    const now = Date.now();
    if (gateTracker.lastActiveAt != null) {
      const gap = now - gateTracker.lastActiveAt;
      if (gap > 0 && gap <= IDLE_GAP_MS) {
        gateTracker.activeMs += gap;
      }
    }
    gateTracker.lastActiveAt = now;
  }

  canvasEl.addEventListener("pointerdown", (ev) => {
    if (drawingLocked || !unlockLayerEl.hidden) return;
    ev.preventDefault();
    try { canvasEl.setPointerCapture(ev.pointerId); } catch (_) {}
    const pt = getNormPoint(ev);

    if (activeTool === "sticker") {
      sfx.tap();
      operations.push({
        type: "sticker",
        symbol: selectedSticker.symbol,
        color: brushColor,
        point: pt
      });
      gateTracker.strokes += 1;
      gateTracker.cells.add(cellIndex(pt));
      trackElapsed();
      redrawAll();
      return;
    }

    currentOp = {
      type: "stroke",
      tool: activeTool,
      color: brushColor,
      size: activeTool === "eraser" ? eraserSize : brushSize,
      points: [pt]
    };
    if (activeTool === "brush") {
      gateTracker.strokes += 1;
      gateTracker.cells.add(cellIndex(pt));
      trackElapsed();
    }
    redrawAll();
  });

  canvasEl.addEventListener("pointermove", (ev) => {
    if (!currentOp || drawingLocked) return;
    ev.preventDefault();
    const pt = getNormPoint(ev);
    const prev = currentOp.points[currentOp.points.length - 1];
    const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
    if (dist < 0.0025) return;
    currentOp.points.push(pt);
    if (currentOp.tool === "brush") {
      gateTracker.cells.add(cellIndex(pt));
      gateTracker.pathLenNorm += dist;
      trackElapsed();
    }
    redrawAll();
  });

  function finishPointer(ev) {
    if (!currentOp) return;
    try { canvasEl.releasePointerCapture(ev.pointerId); } catch (_) {}
    if (currentOp.tool === "brush") {
      trackElapsed();
    }
    operations.push(currentOp);
    currentOp = null;
    redrawAll();
  }

  canvasEl.addEventListener("pointerup", finishPointer);
  canvasEl.addEventListener("pointercancel", finishPointer);

  /* ---------- 工具栏初始化 ---------- */
  function initToolbars() {
    activeColorDotEl.style.background = brushColor;

    brushSizeListEl.innerHTML = "";
    BRUSH_SIZES.forEach((px) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "size-opt" + (px === brushSize ? " is-selected" : "");
      const dotPx = Math.max(4, Math.min(16, px));
      btn.innerHTML = `<span class="size-opt__dot" style="width:${dotPx}px;height:${dotPx}px;background:${brushColor}"></span><span>${px}</span>`;
      btn.addEventListener("click", () => {
        sfx.tap();
        brushSize = px;
        initToolbars();
      });
      brushSizeListEl.appendChild(btn);
    });

    brushColorListEl.innerHTML = "";
    BRUSH_COLORS.forEach((c) => {
      const sw = document.createElement("button");
      sw.type = "button";
      sw.className = "color-swatch" + (c.value === brushColor ? " is-selected" : "");
      sw.style.background = c.value;
      sw.title = c.name;
      sw.setAttribute("aria-label", c.name);
      sw.addEventListener("click", () => {
        sfx.tap();
        brushColor = c.value;
        activeTool = "brush";
        syncToolTabs();
        initToolbars();
      });
      brushColorListEl.appendChild(sw);
    });

    eraserSizeListEl.innerHTML = "";
    ERASER_SIZES.forEach((px) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "size-opt" + (px === eraserSize ? " is-selected" : "");
      const dotPx = Math.max(5, Math.min(16, Math.round(px * 0.55)));
      btn.innerHTML = `<span class="size-opt__dot" style="width:${dotPx}px;height:${dotPx}px;background:#A6ACA7"></span><span>${px}</span>`;
      btn.addEventListener("click", () => {
        sfx.tap();
        eraserSize = px;
        initToolbars();
      });
      eraserSizeListEl.appendChild(btn);
    });

    stickerListEl.innerHTML = "";
    STICKERS.forEach((st) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sticker-opt" + (st.type === selectedSticker.type ? " is-selected" : "");
      btn.textContent = `${st.symbol} ${st.name}`;
      btn.addEventListener("click", () => {
        sfx.tap();
        selectedSticker = st;
        initToolbars();
      });
      stickerListEl.appendChild(btn);
    });
  }

  function syncToolTabs() {
    document.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.tool === activeTool);
    });
    subpanelBrushEl.hidden = activeTool !== "brush";
    subpanelEraserEl.hidden = activeTool !== "eraser";
    subpanelStickerEl.hidden = activeTool !== "sticker";
  }

  document.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfx.tap();
      activeTool = btn.dataset.tool;
      syncToolTabs();
    });
  });

  btnUndoEl.addEventListener("click", () => {
    if (!operations.length || drawingLocked) return;
    sfx.tap();
    operations.pop();
    gateTracker = rebuildGateFromOperations(gateTracker.activeMs);
    redrawAll();
  });

  btnClearEl.addEventListener("click", () => {
    if (!operations.length || drawingLocked) return;
    sfx.tap();
    const prevMs = gateTracker.activeMs;
    operations = [];
    gateTracker = rebuildGateFromOperations(prevMs);
    redrawAll();
  });

  btnLookAgainEl.addEventListener("click", () => {
    if (drawingLocked) return;
    if (lookRemaining <= 0) {
      sfx.warn();
      showGateHint("再画一会儿吧");
      return;
    }
    startPeek(true);
  });

  btnSkipPeekEl.addEventListener("click", () => {
    sfx.tap();
    dismissPeek();
  });

  btnRerollPropEl.addEventListener("click", () => {
    sfx.tap();
    params.delete("propId");
    startNewSession(true);
  });

  /* ---------- 完成结算：写入收藏格（自动摆入空木格）+ 发放 +10✦ 星星 ---------- */
  function exportUserSketchDataUrl() {
    const out = document.createElement("canvas");
    out.width = 240;
    out.height = 240;
    const octx = out.getContext("2d");
    octx.fillStyle = "#F7EEE5";
    octx.fillRect(0, 0, 240, 240);
    const scale = Math.min(220 / Math.max(1, canvasEl.width), 220 / Math.max(1, canvasEl.height));
    const dw = canvasEl.width * scale;
    const dh = canvasEl.height * scale;
    octx.drawImage(canvasEl, (240 - dw) / 2, (240 - dh) / 2, dw, dh);
    return out.toDataURL("image/png");
  }

  btnFinishDrawEl.addEventListener("click", () => {
    if (drawingLocked || !currentProp) return;
    const check = evaluateGate(gateTracker);
    if (!check.ok) {
      sfx.warn();
      showGateHint(check.hint);
      return;
    }

    // 读取最新跨端 Store 结算奖励与收藏格
    const store = loadLatestStore();
    const todayKey = Store.getUtc8DateKey();
    const petId = store.activePetId === "yutu" ? "yutu" : "koi";

    const shelfSlotCount = (Store && Store.SHELF_SLOT_COUNT) || 50;
    if (!store.curioCabinet) {
      store.curioCabinet = { unlockedIds: [], deferredUnlockedIds: [], unlockedMeta: {}, shelfSlots: new Array(shelfSlotCount).fill(null) };
    }
    if (!Array.isArray(store.curioCabinet.unlockedIds)) store.curioCabinet.unlockedIds = [];
    if (!Array.isArray(store.curioCabinet.shelfSlots) || store.curioCabinet.shelfSlots.length !== shelfSlotCount) {
      store.curioCabinet.shelfSlots = Store.buildShelfSlots(store.curioCabinet.unlockedIds, store.curioCabinet.shelfSlots);
    }

    const newlyUnlocked = !store.curioCabinet.unlockedIds.includes(currentProp.id);
    let placedSlotIdx = store.curioCabinet.shelfSlots.indexOf(currentProp.id);
    if (newlyUnlocked) {
      store.curioCabinet.unlockedIds.unshift(currentProp.id);
      if (!store.curioCabinet.unlockedMeta) store.curioCabinet.unlockedMeta = {};
      store.curioCabinet.unlockedMeta[currentProp.id] = {
        unlockedAt: Store.getUtc8IsoString(),
        source: "activity:doodle_together",
        isNew: true
      };
      if (placedSlotIdx === -1) {
        const emptyIdx = store.curioCabinet.shelfSlots.indexOf(null);
        if (emptyIdx >= 0) {
          store.curioCabinet.shelfSlots[emptyIdx] = currentProp.id;
          placedSlotIdx = emptyIdx;
        }
      }
    }

    // 每日主动游艺星星软上限保护（≤45✦/日，单局 +10✦，溢出返 +5 EXP）
    let awardedStars = 0;
    if (typeof Store.awardActivityStars === "function") {
      const res = Store.awardActivityStars(store, PROP_DRAWING_REWARD, {
        dateKey: todayKey,
        petId,
        miniGameId: "doodle_prop"
      });
      awardedStars = Number(res && res.starsAwarded || 0);
      if (newlyUnlocked) {
        Store.recordDailyEvent(store, todayKey, petId, { keepsakeId: currentProp.id });
      }
    } else {
      if (!store.companion.dailyMiniGameStars || typeof store.companion.dailyMiniGameStars !== "object") {
        store.companion.dailyMiniGameStars = {};
      }
      const earnedToday = Number(store.companion.dailyMiniGameStars[todayKey] || 0);
      const remainCap = Math.max(0, DAILY_MINIGAME_STAR_CAP - earnedToday);
      awardedStars = Math.min(PROP_DRAWING_REWARD, remainCap);
      if (awardedStars > 0) {
        store.companion.starBalance = Number(store.companion.starBalance || 0) + awardedStars;
        store.companion.dailyMiniGameStars[todayKey] = earnedToday + awardedStars;
      }
      Store.recordDailyEvent(store, todayKey, petId, {
        miniGameId: "doodle_prop",
        keepsakeId: newlyUnlocked ? currentProp.id : undefined
      });
    }
    storageAdapter.setJSON(Store.STORAGE_KEY, store);

    standaloneStarPillEl.textContent = `✦ ${Number(store.companion.starBalance || 0)}`;

    // 通知宿主主房间实时刷新星星、陪伴天数与多宝收藏格
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          type: "eggbabe:doodle-complete",
          propId: currentProp.id,
          propName: currentProp.name,
          newlyUnlocked,
          placedSlotIdx,
          awardedStars,
          starBalance: store.companion.starBalance
        }, "*");
      } catch (_) {}
    }

    // 展示揭晓庆祝画面
    sfx.award();
    unlockAwardWrapEl.hidden = awardedStars <= 0;
    unlockAwardPlusEl.textContent = `+${awardedStars}`;
    unlockStarImgEl.src = "../ui/star_squeezed.png";
    setTimeout(() => { unlockStarImgEl.src = "../ui/star_neutral.png"; }, 420);

    if (newlyUnlocked) {
      unlockStatusPillEl.textContent = placedSlotIdx >= 0
        ? `✨ 新解锁！已自动摆入收藏格第 ${placedSlotIdx + 1} 格`
        : "✨ 新解锁！已收入多宝收藏格";
    } else {
      unlockStatusPillEl.textContent = awardedStars > 0
        ? "🎨 重温临摹完成 · 获赠陪伴星星"
        : "🎨 重温临摹完成（今日小游戏星星已达上限）";
    }

    unlockColoredImgEl.src = sharedAssetUrl(currentProp.img);
    unlockColoredImgEl.alt = currentProp.name;
    unlockSketchPreviewEl.src = exportUserSketchDataUrl();
    unlockPropNameEl.textContent = currentProp.name;
    unlockGiftLineEl.textContent = newlyUnlocked ? "“原来你记得它的样子！这个小物件送给你。”" : "“和你一起安静画画，总觉得时间很慢很舒服。”";
    const storyText = (currentProp.stories && currentProp.stories[petId]) || currentProp.story || "";
    unlockStoryEl.textContent = storyText;
    unlockStoryEl.hidden = !storyText;

    unlockLayerEl.hidden = false;
  });

  btnUnlockOpenCurioEl.addEventListener("click", () => {
    sfx.tap();
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          type: "eggbabe:doodle-nav",
          target: "curio",
          propId: currentProp ? currentProp.id : ""
        }, "*");
        return;
      } catch (_) {}
    }
    window.location.href = "../../?open=curio";
  });

  btnUnlockNextEl.addEventListener("click", () => {
    sfx.tap();
    params.delete("propId");
    startNewSession(true);
  });

  btnUnlockDoneEl.addEventListener("click", () => {
    sfx.tap();
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "eggbabe:doodle-nav", target: "close" }, "*");
        return;
      } catch (_) {}
    }
    window.location.href = "../../";
  });

  window.addEventListener("resize", () => {
    clearTimeout(window.__doodleResizeTimer);
    window.__doodleResizeTimer = setTimeout(resizeCanvas, 80);
  });

  initToolbars();
  syncToolTabs();
  requestAnimationFrame(() => {
    startNewSession(false);
  });
})();
