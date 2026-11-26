/* ==========================================================================
   EggBabe P5 内置轻小游戏 UI 模块（按需懒加载：native-minigames-ui.js）
   - 包含《听你说》《寻宝翻翻乐》《暖炉烘焙拍》《小院牧歌》4 款内置轻游艺
   - 由 module-loader.js 在用户点击房间游艺入口时与 p5-rooms-and-games.js 一起按需拉取
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeNativeMinigames = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  function open(gameId, ctx) {
    const {
      $,
      P5Data,
      Store,
      state,
      crossStore,
      sfx,
      sharedUrl,
      getPetName,
      getAllKeepsakes,
      renderSnackTray,
      nativeMgTitleEl,
      nativeMgBodyEl,
      finishNativeMinigame,
      setCleanup
    } = ctx;

    if (!nativeMgBodyEl || !P5Data) return;

    if (gameId === "listen-qa-legacy") {
      if (nativeMgTitleEl) nativeMgTitleEl.textContent = "💬 听你说";
      const questions = P5Data.pickListenSessionQuestions(Store.getUtc8DateKey() + ":" + Date.now());
      let step = 0;
      const tags = [];
      const renderStep = () => {
        const q = questions[step];
        nativeMgBodyEl.innerHTML = `
          <div class="mg-question-card">
            <span class="mg-question-cat">${q.category} · 第 ${step + 1} / ${questions.length} 题</span>
            <p class="mg-question-text">${q.question}</p>
            <div class="mg-option-list">
              ${q.options.map((opt, idx) => `<button class="mg-option-btn" type="button" data-opt-idx="${idx}">${opt.text}</button>`).join("")}
            </div>
            <div id="mg-listen-reply" class="mg-pet-reply" hidden style="margin-top:10px;"></div>
          </div>
        `;
        nativeMgBodyEl.querySelectorAll("[data-opt-idx]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const opt = q.options[Number(btn.dataset.optIdx)];
            if (!opt) return;
            sfx.tap();
            tags.push(opt.tag);
            const rep = $("mg-listen-reply");
            if (rep) {
              rep.textContent = `${getPetName(state.petId)}：${opt.reply}`;
              rep.hidden = false;
            }
            nativeMgBodyEl.querySelectorAll("[data-opt-idx]").forEach((b) => { b.disabled = true; });
            setTimeout(() => {
              step += 1;
              if (step < questions.length) {
                renderStep();
              } else {
                const dk = Store.getUtc8DateKey();
                const firstToday = crossStore.companion.dailyListenClaimedDate !== dk;
                crossStore.companion.dailyListenClaimedDate = dk;
                const reward = firstToday ? 10 : 0;
                const tagHtml = `<p class="mg-result-box__sub">今日伙伴印象签：${tags.map((t) => `「${t}」`).join(" ")}</p>`;
                finishNativeMinigame("listen_qa", reward, firstToday ? "听你说完成 +10✦" : "今天已经聊过一轮啦", tagHtml);
              }
            }, 680);
          });
        });
      };
      renderStep();
      return;
    }

    if (gameId === "treasure-memory") {
      if (nativeMgTitleEl) nativeMgTitleEl.textContent = "🃏 寻宝翻翻乐";
      const allKs = getAllKeepsakes();
      const pool = allKs.slice().sort(() => Math.random() - 0.5).slice(0, 6);
      const deck = pool.concat(pool).map((item, idx) => ({ idx, item, open: false, matched: false })).sort(() => Math.random() - 0.5);
      let firstCard = null;
      let lockBoard = false;
      let matchedPairs = 0;

      const renderBoard = () => {
        nativeMgBodyEl.innerHTML = `
          <p class="bookshelf-hub-head__sub" style="margin:0;">翻开相同的 6 对纪念小物（已配对 ${matchedPairs} / 6）</p>
          <div class="mg-memory-grid">
            ${deck.map((c, i) => `
              <button class="mg-memory-card${c.open ? " is-open" : ""}${c.matched ? " is-matched" : ""}" type="button" data-card-i="${i}">
                ${(c.open || c.matched) ? `<img src="${sharedUrl(c.item.img)}" alt="${c.item.name}" />` : "🪵"}
              </button>
            `).join("")}
          </div>
        `;
        nativeMgBodyEl.querySelectorAll("[data-card-i]").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (lockBoard) return;
            const c = deck[Number(btn.dataset.cardI)];
            if (!c || c.open || c.matched) return;
            sfx.tap();
            c.open = true;
            if (!firstCard) {
              firstCard = c;
              renderBoard();
              return;
            }
            if (firstCard.item.id === c.item.id) {
              firstCard.matched = true;
              c.matched = true;
              firstCard = null;
              matchedPairs += 1;
              renderBoard();
              if (matchedPairs >= 6) {
                setTimeout(() => finishNativeMinigame("treasure_memory", 10, "寻宝翻翻乐通关！"), 260);
              }
            } else {
              lockBoard = true;
              renderBoard();
              setTimeout(() => {
                firstCard.open = false;
                c.open = false;
                firstCard = null;
                lockBoard = false;
                renderBoard();
              }, 520);
            }
          });
        });
      };
      renderBoard();
      return;
    }

    if (gameId === "bakery-tap") {
      if (nativeMgTitleEl) nativeMgTitleEl.textContent = "🔥 暖炉烘焙拍";
      let hits = 0;
      let pos = 10;
      let dir = 1;
      let rafId = 0;
      const targetHits = 3;
      const craftedSnack = Math.random() < 0.5 ? P5Data.CRAFTED_SNACKS[0] : P5Data.CRAFTED_SNACKS[1];

      nativeMgBodyEl.innerHTML = `
        <div class="mg-bakery-oven">
          <div style="font-size:32px;">🧁</div>
          <div style="font-weight:800;font-size:15px;margin-top:4px;">正在烤制「${craftedSnack.name}」</div>
          <p id="mg-bakery-status" class="bookshelf-hub-head__sub">火候指针落进绿色甜香区时拍一下！（0 / ${targetHits}）</p>
          <div class="mg-bakery-track">
            <div class="mg-bakery-sweet"></div>
            <div id="mg-bakery-cursor" class="mg-bakery-cursor" style="left:10%;"></div>
          </div>
          <button id="btn-mg-bakery-tap" class="btn btn--primary btn--small" type="button"><span class="btn-text">🔥 拍一下翻烤</span></button>
        </div>
      `;
      const cursorEl = $("mg-bakery-cursor");
      const statusEl = $("mg-bakery-status");
      const tick = () => {
        pos += dir * 1.45;
        if (pos >= 94) { pos = 94; dir = -1; }
        if (pos <= 6) { pos = 6; dir = 1; }
        if (cursorEl) cursorEl.style.left = pos.toFixed(1) + "%";
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      if (typeof setCleanup === "function") setCleanup(() => cancelAnimationFrame(rafId));

      $("btn-mg-bakery-tap")?.addEventListener("click", () => {
        if (pos >= 36 && pos <= 64) {
          sfx.star();
          hits += 1;
          if (statusEl) statusEl.textContent = `火候刚刚好！香喷喷～（${hits} / ${targetHits}）`;
          if (hits >= targetHits) {
            cancelAnimationFrame(rafId);
            Store.addCraftedSnack(crossStore, craftedSnack.id, 1);
            renderSnackTray();
            finishNativeMinigame(
              "bakery_tap",
              10,
              `${craftedSnack.name} 出炉啦！`,
              `<p class="mg-result-box__sub">已存入零食罐，打开「喂食」即可投喂给它～</p>`
            );
          }
        } else {
          sfx.tap();
          if (statusEl) statusEl.textContent = `再等指针滑到中间绿色区拍一下哦（${hits} / ${targetHits}）`;
        }
      });
      return;
    }

    if (gameId === "meadow-breeze") {
      if (nativeMgTitleEl) nativeMgTitleEl.textContent = "🌿 小院牧歌";
      let caught = 0;
      const goal = 5;
      nativeMgBodyEl.innerHTML = `
        <p id="mg-meadow-status" class="bookshelf-hub-head__sub" style="margin:0;">轻触接住 5 朵随风飘来的桂花瓣（0 / ${goal}）</p>
        <div id="mg-meadow-field" class="mg-meadow-field"></div>
      `;
      const fieldEl = $("mg-meadow-field");
      const statusEl = $("mg-meadow-status");
      const spawnPetal = () => {
        if (!fieldEl || caught >= goal) return;
        fieldEl.innerHTML = "";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mg-meadow-target";
        btn.textContent = Math.random() < 0.5 ? "🌼" : "🍃";
        btn.style.left = (12 + Math.random() * 72).toFixed(1) + "%";
        btn.style.top = (14 + Math.random() * 64).toFixed(1) + "%";
        btn.addEventListener("click", () => {
          sfx.tap();
          caught += 1;
          if (statusEl) statusEl.textContent = `接住了一朵小院桂花！（${caught} / ${goal}）`;
          if (caught >= goal) {
            finishNativeMinigame("meadow_breeze", 8, "小院微风收集完成！");
          } else {
            spawnPetal();
          }
        });
        fieldEl.appendChild(btn);
      };
      spawnPetal();
    }
  }

  return { open };
});
