/* =========================================================================
 * EggBabe H5 · 「听你说」治愈轻问答（1:1 复刻 eggbabe-miniprogram）
 * - 对齐服务：listen-rules.js / listen-adapter.js / pages/listen/listen.js
 * - 题库覆盖：5 大生活维度共 26 组（130 道单选+自由补充），精准匹配专属伙伴回信
 * - 结算联动：当日首组完成奖励 +10✦ 星星，记录 dailyEventLog 并实时同步主房间
 * ========================================================================= */
(function () {
  "use strict";

  const Store = window.EggBabeStore || window.EggBabeCrossEndStore;
  const catalog = window.__EGGBABE_CATALOG__ || window.EGGBABE_CATALOG || { pets: {} };
  const bank = window.__EGGBABE_LISTEN_BANK__ || { categories: [] };
  const storageAdapter = Store.createStorageAdapter();

  const LISTEN_REWARD_STARS = 10;
  const DAILY_MINIGAME_STAR_CAP = 45;

  const params = new URLSearchParams(window.location.search);
  const isEmbedded = params.get("embed") === "1" || window.parent !== window;
  if (isEmbedded) {
    document.body.classList.add("is-embedded");
  }

  const $ = (id) => document.getElementById(id);
  const standaloneTitleEl = $("standalone-title");
  const standaloneStarPillEl = $("standalone-star-pill");

  const viewQuestionEl = $("view-question");
  const viewFeedbackEl = $("view-feedback");
  const viewChoicesEl = $("view-choices");
  const viewEndEl = $("view-end");

  const qCategoryBadgeEl = $("q-category-badge");
  const qGroupTitleEl = $("q-group-title");
  const btnSwitchTopicEl = $("btn-switch-topic");
  const qCountEl = $("q-count");
  const qProgressFillEl = $("q-progress-fill");
  const questionScrollEl = $("question-scroll");
  const qContextNoteEl = $("q-context-note");
  const qTextEl = $("q-text");
  const qOptionsEl = $("q-options");
  const btnAddNoteEl = $("btn-add-note");
  const supplementEl = $("listen-supplement");
  const qErrorEl = $("q-error");
  const btnPrevQEl = $("btn-prev-q");
  const btnNextQEl = $("btn-next-q");
  const nextBtnLabelEl = $("next-btn-label");

  const fbKickerEl = $("fb-kicker");
  const fbQuoteCopyEl = $("fb-quote-copy");
  const fbAwardBoxEl = $("fb-award-box");
  const fbStarImgEl = $("fb-star-img");
  const fbAwardPlusEl = $("fb-award-plus");
  const fbThankBoxEl = $("fb-thank-box");
  const fbRewardTextEl = $("fb-reward-text");
  const fbPetImgEl = $("fb-pet-img");
  const fbPetCaptionEl = $("fb-pet-caption");
  const btnFbContinueEl = $("btn-fb-continue");
  const btnFbReturnEl = $("btn-fb-return");

  const choicesListEl = $("choices-list");
  const historySectionEl = $("history-section");
  const historyListEl = $("history-list");
  const btnChoicesReturnEl = $("btn-choices-return");

  const endTitleEl = $("end-title");
  const endTextEl = $("end-text");
  const endPetImgEl = $("end-pet-img");
  const btnEndReviewEl = $("btn-end-review");
  const btnEndReturnEl = $("btn-end-return");

  // 轻量 Web Audio 治愈音效
  let audioCtx = null;
  function playTone(freq, endFreq, dur, gainVal) {
    try {
      const store = loadStore();
      if (store.settings && store.settings.sfxOn === false) return;
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
      gain.gain.setValueAtTime(gainVal || 0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur);
    } catch (_) {}
  }
  const sfx = {
    tap: () => playTone(520, 680, 0.06, 0.038),
    soft: () => playTone(440, 587.33, 0.09, 0.038),
    award: () => {
      playTone(523.25, 659.25, 0.14, 0.055);
      setTimeout(() => playTone(659.25, 783.99, 0.18, 0.055), 110);
      setTimeout(() => playTone(783.99, 1046.5, 0.26, 0.055), 230);
    }
  };

  /* ---------- 1:1 复刻 listen-rules.js 核心匹配算法 ---------- */
  function groupById(groupId) {
    for (const category of (bank.categories || [])) {
      const group = (category.groups || []).find((g) => g.id === groupId);
      if (group) return { category, group };
    }
    return null;
  }

  function selectedOptionId(answers, questionId) {
    return answers && answers[questionId] ? answers[questionId].optionId : "";
  }

  function isGroupComplete(group, answers) {
    return (group.questions || []).every((q) =>
      (q.options || []).some((opt) => opt.id === selectedOptionId(answers, q.id))
    );
  }

  function selectFeedback(group, answers) {
    if (!isGroupComplete(group, answers)) return null;
    const matches = (group.matchedFeedback || [])
      .filter((fb) =>
        (fb.requiredAnswers || []).every((req) => req.optionIds.includes(selectedOptionId(answers, req.questionId))) &&
        !(fb.excludedAnswers || []).some((exc) => exc.optionIds.includes(selectedOptionId(answers, exc.questionId)))
      )
      .map((fb) => ({
        feedback: fb,
        support: new Set((fb.requiredAnswers || []).map((r) => r.questionId)).size
      }));

    const highest = matches.length ? Math.max(...matches.map((m) => m.support)) : 0;
    const best = matches.filter((m) => m.support === highest);
    const chosen = best.length === 1 ? best[0].feedback : group.fallbackFeedback;
    return {
      id: chosen ? chosen.id : "fallback",
      type: chosen ? chosen.type : "fallback",
      petFeedback: (chosen && chosen.petFeedback) || "谢谢你把这些小事慢慢说给我听。"
    };
  }

  /* ---------- Store 读写与当前带妆宠物立绘解析 ---------- */
  function loadStore() {
    const store = Store.loadOrMigrateStore(storageAdapter, catalog).store;
    if (!store.listeningState || typeof store.listeningState !== "object") {
      store.listeningState = {
        cursors: {},
        day: { date: "", categories: [], rewardedToday: false },
        draft: null,
        history: []
      };
    }
    if (!store.listeningState.cursors) store.listeningState.cursors = {};
    if (!store.listeningState.day) store.listeningState.day = { date: "", categories: [], rewardedToday: false };
    if (!Array.isArray(store.listeningState.history)) store.listeningState.history = [];
    return store;
  }

  function saveStore(store) {
    storageAdapter.setJSON(Store.STORAGE_KEY, store);
    standaloneStarPillEl.textContent = `✦ ${Number(store.companion.starBalance || 0)}`;
  }

  function resolvePetPortraitInfo(store) {
    const petId = store.activePetId === "yutu" ? "yutu" : "koi";
    const petState = (store.pets && store.pets[petId]) || {};
    const petName = petState.name || Store.DEFAULT_PET_NAMES[petId] || "蛋宝宝";
    const pCfg = catalog.pets && catalog.pets[petId];
    let imgRel = petId === "yutu" ? "assets/shared/png/yutu_base.png" : "assets/shared/png/koi_body.png";
    let outfitName = "原生毛绒";
    if (pCfg) {
      const setId = petState.equippedSetId;
      const setItem = setId && Array.isArray(pCfg.items) ? pCfg.items.find((x) => x.id === setId) : null;
      if (setItem && setItem.tex) {
        imgRel = setItem.tex;
        outfitName = setItem.name || outfitName;
      } else if (pCfg.textures && pCfg.textures.base) {
        imgRel = pCfg.textures.base;
      }
    }
    return {
      petId,
      petName,
      outfitName,
      imgUrl: "../../" + String(imgRel).replace(/^\.?\//, "")
    };
  }

  function getAvailableCategories(ls, todayKey) {
    const completedToday = ls.day && ls.day.date === todayKey ? (ls.day.categories || []) : [];
    return (bank.categories || []).filter((cat) => {
      const cursor = Number(ls.cursors[cat.id] || 0);
      return !completedToday.includes(cat.id) && cursor < (cat.groups || []).length;
    });
  }

  function isAllExhausted(ls) {
    return (bank.categories || []).every((cat) => Number(ls.cursors[cat.id] || 0) >= (cat.groups || []).length);
  }

  /* ---------- 视图状态切换 ---------- */
  let awardTransitionTimer = null;

  function setView(viewName) {
    viewQuestionEl.hidden = viewName !== "question";
    viewFeedbackEl.hidden = viewName !== "feedback";
    viewChoicesEl.hidden = viewName !== "choices";
    viewEndEl.hidden = viewName !== "end";
  }

  function startCategoryGroup(categoryId) {
    const store = loadStore();
    const todayKey = Store.getUtc8DateKey();
    const ls = store.listeningState;
    if (ls.day.date !== todayKey) {
      ls.day = { date: todayKey, categories: [], rewardedToday: false };
    }

    const avail = getAvailableCategories(ls, todayKey);
    if (!avail.length) {
      saveStore(store);
      renderEndView(store);
      return;
    }

    const chosenCat = categoryId
      ? avail.find((c) => c.id === categoryId) || avail[0]
      : avail[Math.floor(Math.random() * avail.length)];

    const cursor = Number(ls.cursors[chosenCat.id] || 0);
    const group = chosenCat.groups[cursor];
    ls.draft = {
      groupId: group.id,
      categoryId: chosenCat.id,
      questionIndex: 0,
      answers: {},
      startedAt: Date.now()
    };
    saveStore(store);
    renderQuestionView(store);
  }

  function renderQuestionView(store) {
    const st = store || loadStore();
    const draft = st.listeningState.draft;
    if (!draft) {
      renderChoicesView(st);
      return;
    }
    const entry = groupById(draft.groupId);
    if (!entry) {
      st.listeningState.draft = null;
      saveStore(st);
      renderChoicesView(st);
      return;
    }

    setView("question");
    standaloneTitleEl.textContent = "听你说";

    const qIdx = Math.max(0, Math.min(4, Number(draft.questionIndex || 0)));
    const question = entry.group.questions[qIdx];
    const ans = (draft.answers && draft.answers[question.id]) || { optionId: "", text: "" };

    qCategoryBadgeEl.textContent = entry.category.name;
    qGroupTitleEl.textContent = entry.group.title;
    qCountEl.textContent = `${qIdx + 1} / ${entry.group.questions.length}`;
    qProgressFillEl.style.width = `${((qIdx + 1) / entry.group.questions.length) * 100}%`;

    if (entry.group.contextNote) {
      qContextNoteEl.textContent = entry.group.contextNote;
      qContextNoteEl.hidden = false;
    } else {
      qContextNoteEl.hidden = true;
    }

    qTextEl.textContent = question.text;
    qErrorEl.hidden = true;

    qOptionsEl.innerHTML = "";
    let isOtherSelected = false;
    (question.options || []).forEach((opt) => {
      const checked = ans.optionId === opt.id;
      if (checked && opt.type === "other") isOtherSelected = true;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option" + (checked ? " option--selected" : "");
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", checked ? "true" : "false");
      btn.innerHTML =
        `<span class="option-label">${opt.label}</span>` +
        `<span class="radio">${checked ? '<span class="radio-dot"></span>' : ""}</span>`;
      btn.addEventListener("click", () => {
        sfx.tap();
        selectOption(question, opt);
      });
      qOptionsEl.appendChild(btn);
    });

    const hasText = Boolean(ans.text && ans.text.trim());
    const showNoteBox = isOtherSelected || hasText;
    supplementEl.value = ans.text || "";
    supplementEl.hidden = !showNoteBox;
    btnAddNoteEl.hidden = !ans.optionId || showNoteBox;

    btnPrevQEl.hidden = qIdx === 0;
    const hasSelected = Boolean(ans.optionId);
    btnNextQEl.disabled = !hasSelected;
    btnNextQEl.classList.toggle("primary--disabled", !hasSelected);
    nextBtnLabelEl.textContent = qIdx === entry.group.questions.length - 1 ? "完成回答" : "下一题";
    questionScrollEl.scrollTop = 0;
  }

  function selectOption(question, opt) {
    const store = loadStore();
    const draft = store.listeningState.draft;
    if (!draft) return;
    const prev = (draft.answers && draft.answers[question.id]) || { optionId: "", text: "" };
    draft.answers[question.id] = {
      optionId: opt.id,
      text: supplementEl.hidden ? (prev.text || "") : supplementEl.value.slice(0, 500)
    };
    saveStore(store);
    renderQuestionView(store);
    if (opt.type === "other") {
      setTimeout(() => {
        supplementEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        supplementEl.focus();
      }, 60);
    }
  }

  btnAddNoteEl.addEventListener("click", () => {
    sfx.tap();
    btnAddNoteEl.hidden = true;
    supplementEl.hidden = false;
    setTimeout(() => {
      supplementEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      supplementEl.focus();
    }, 40);
  });

  supplementEl.addEventListener("input", () => {
    const store = loadStore();
    const draft = store.listeningState.draft;
    if (!draft) return;
    const entry = groupById(draft.groupId);
    if (!entry) return;
    const q = entry.group.questions[draft.questionIndex];
    if (!draft.answers[q.id]) draft.answers[q.id] = { optionId: "", text: "" };
    draft.answers[q.id].text = supplementEl.value.slice(0, 500);
    saveStore(store);
  });

  btnPrevQEl.addEventListener("click", () => {
    const store = loadStore();
    const draft = store.listeningState.draft;
    if (!draft || draft.questionIndex <= 0) return;
    sfx.tap();
    draft.questionIndex -= 1;
    saveStore(store);
    renderQuestionView(store);
  });

  btnSwitchTopicEl.addEventListener("click", () => {
    sfx.tap();
    const store = loadStore();
    store.listeningState.draft = null;
    saveStore(store);
    renderChoicesView(store);
  });

  btnNextQEl.addEventListener("click", () => {
    const store = loadStore();
    const draft = store.listeningState.draft;
    if (!draft) return;
    const entry = groupById(draft.groupId);
    if (!entry) return;
    const q = entry.group.questions[draft.questionIndex];
    const ans = draft.answers && draft.answers[q.id];
    if (!ans || !ans.optionId) return;

    if (!supplementEl.hidden) {
      ans.text = supplementEl.value.slice(0, 500);
    }

    if (draft.questionIndex < entry.group.questions.length - 1) {
      sfx.soft();
      draft.questionIndex += 1;
      saveStore(store);
      renderQuestionView(store);
      return;
    }

    // 第 5 题完成结算！
    completeCurrentGroup(store, entry);
  });

  function completeCurrentGroup(store, entry) {
    const ls = store.listeningState;
    const draft = ls.draft;
    const todayKey = Store.getUtc8DateKey();
    if (ls.day.date !== todayKey) {
      ls.day = { date: todayKey, categories: [], rewardedToday: false };
    }

    const fb = selectFeedback(entry.group, draft.answers);
    const petInfo = resolvePetPortraitInfo(store);

    // 推进该分类游标 & 标记今日已完成该分类
    const curCursor = Number(ls.cursors[entry.category.id] || 0);
    if (entry.group.categoriesIndex === undefined) {
      const idxInCat = entry.category.groups.findIndex((g) => g.id === entry.group.id);
      if (idxInCat >= curCursor) ls.cursors[entry.category.id] = idxInCat + 1;
    }
    if (!ls.day.categories.includes(entry.category.id)) {
      ls.day.categories.push(entry.category.id);
    }

    // 结算当日首组 +10✦ 星星（调用底座 awardActivityStars 统一计入每日 45✦ 软上限、溢出返 +5 EXP 并写入 listen_qa 日记事件）
    let awardedStars = 0;
    if (!ls.day.rewardedToday) {
      if (typeof Store.awardActivityStars === "function") {
        const res = Store.awardActivityStars(store, LISTEN_REWARD_STARS, {
          dateKey: todayKey,
          petId: petInfo.petId,
          miniGameId: "listen_qa"
        });
        awardedStars = Number(res && res.starsAwarded || 0);
      } else {
        if (!store.companion.dailyMiniGameStars || typeof store.companion.dailyMiniGameStars !== "object") {
          store.companion.dailyMiniGameStars = {};
        }
        const earnedToday = Number(store.companion.dailyMiniGameStars[todayKey] || 0);
        const remainCap = Math.max(0, DAILY_MINIGAME_STAR_CAP - earnedToday);
        awardedStars = Math.min(LISTEN_REWARD_STARS, remainCap);
        if (awardedStars > 0) {
          store.companion.starBalance = Number(store.companion.starBalance || 0) + awardedStars;
          store.companion.dailyMiniGameStars[todayKey] = earnedToday + awardedStars;
        }
        Store.recordDailyEvent(store, todayKey, petInfo.petId, { miniGame: "listen_qa", countsAsEffective: true });
      }
      ls.day.rewardedToday = true;
    } else {
      Store.recordDailyEvent(store, todayKey, petInfo.petId, { miniGame: "listen_qa", countsAsEffective: true });
    }

    const record = {
      groupId: entry.group.id,
      categoryId: entry.category.id,
      categoryName: entry.category.name,
      title: entry.group.title,
      petFeedback: fb.petFeedback,
      petId: petInfo.petId,
      petName: petInfo.petName,
      dateKey: todayKey
    };
    ls.history = [record].concat(ls.history.filter((r) => r.groupId !== record.groupId)).slice(0, 30);
    ls.draft = null;
    saveStore(store);

    // 通知宿主房间同步星星与有效陪伴天数
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          type: "eggbabe:listen-complete",
          groupId: record.groupId,
          title: record.title,
          awardedStars,
          starBalance: store.companion.starBalance
        }, "*");
      } catch (_) {}
    }

    renderFeedbackView(store, record, awardedStars);
  }

  function renderFeedbackView(store, record, awardedStars) {
    clearTimeout(awardTransitionTimer);
    setView("feedback");

    const todayKey = Store.getUtc8DateKey();
    const avail = getAvailableCategories(store.listeningState, todayKey);
    standaloneTitleEl.textContent = avail.length === 0 ? "明天再来" : "听你说";

    fbKickerEl.textContent = `${record.categoryName} · ${record.title}`;
    fbQuoteCopyEl.textContent = record.petFeedback;

    const petInfo = resolvePetPortraitInfo(store);
    fbPetImgEl.src = petInfo.imgUrl;
    fbPetImgEl.alt = petInfo.petName;
    fbPetCaptionEl.textContent = `${petInfo.petName} · 认真听完了你说的话`;

    btnFbContinueEl.hidden = avail.length === 0;

    if (awardedStars > 0) {
      sfx.award();
      fbAwardBoxEl.hidden = false;
      fbThankBoxEl.hidden = true;
      fbAwardPlusEl.textContent = `+${awardedStars}`;
      fbStarImgEl.src = "../ui/star_squeezed.png";
      setTimeout(() => { fbStarImgEl.src = "../ui/star_neutral.png"; }, 420);
      awardTransitionTimer = setTimeout(() => {
        fbAwardBoxEl.hidden = true;
        fbRewardTextEl.textContent = "谢谢你说给我听";
        fbThankBoxEl.hidden = false;
      }, 2100);
    } else {
      sfx.soft();
      fbAwardBoxEl.hidden = true;
      fbRewardTextEl.textContent = "谢谢你说给我听";
      fbThankBoxEl.hidden = false;
    }
  }

  function renderChoicesView(store) {
    const st = store || loadStore();
    const todayKey = Store.getUtc8DateKey();
    const ls = st.listeningState;
    if (ls.day.date !== todayKey) {
      ls.day = { date: todayKey, categories: [], rewardedToday: false };
    }

    const avail = getAvailableCategories(ls, todayKey);
    if (!avail.length) {
      renderEndView(st);
      return;
    }

    setView("choices");
    standaloneTitleEl.textContent = "听你说";
    choicesListEl.innerHTML = "";

    avail.forEach((cat) => {
      const cursor = Number(ls.cursors[cat.id] || 0);
      const nextGroup = cat.groups[cursor];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option topic-option";
      btn.innerHTML =
        `<span class="topic-option__meta">` +
          `<span class="topic-option__cat">${cat.name}（第 ${cursor + 1}/${cat.groups.length} 组）</span>` +
          `<span class="option-label">${nextGroup.title}</span>` +
        `</span>` +
        `<span class="radio" aria-hidden="true"></span>`;
      btn.addEventListener("click", () => {
        sfx.tap();
        startCategoryGroup(cat.id);
      });
      choicesListEl.appendChild(btn);
    });

    // 展示往期伙伴回信留档
    const hist = ls.history || [];
    if (hist.length > 0) {
      historySectionEl.hidden = false;
      historyListEl.innerHTML = hist.slice(0, 8).map((item) => `
        <article class="history-card">
          <div class="history-card__head">
            <span>${item.categoryName} · ${item.title}</span>
            <span class="history-card__date">${item.dateKey || ""}</span>
          </div>
          <p class="history-card__quote">“${item.petFeedback}”</p>
        </article>
      `).join("");
    } else {
      historySectionEl.hidden = true;
    }
  }

  function renderEndView(store) {
    const st = store || loadStore();
    setView("end");
    const ls = st.listeningState;
    const exhausted = isAllExhausted(ls);
    const petInfo = resolvePetPortraitInfo(st);

    endPetImgEl.src = petInfo.imgUrl;
    endPetImgEl.alt = petInfo.petName;

    if (exhausted) {
      standaloneTitleEl.textContent = "听你说";
      endTitleEl.textContent = "这些小事都听你说过啦";
      endTextEl.textContent = "26 组日常小事都已经记在心里啦，如果你想重温，也可以重新翻出来聊聊。";
      btnEndReviewEl.hidden = false;
    } else {
      standaloneTitleEl.textContent = "明天再来";
      endTitleEl.textContent = "今天先聊到这里";
      endTextEl.textContent = "今天 5 个维度的小事都听你说完啦，明天我们再接着慢慢聊。";
      btnEndReviewEl.hidden = true;
    }
  }

  function returnToRoom() {
    sfx.tap();
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "eggbabe:listen-nav", target: "close" }, "*");
        return;
      } catch (_) {}
    }
    window.location.href = "../../";
  }

  btnFbContinueEl.addEventListener("click", () => {
    sfx.tap();
    renderChoicesView(loadStore());
  });
  btnFbReturnEl.addEventListener("click", returnToRoom);
  btnChoicesReturnEl.addEventListener("click", returnToRoom);
  btnEndReturnEl.addEventListener("click", returnToRoom);

  btnEndReviewEl.addEventListener("click", () => {
    sfx.tap();
    const store = loadStore();
    store.listeningState.cursors = {};
    store.listeningState.day.categories = [];
    saveStore(store);
    renderChoicesView(store);
  });

  /* ---------- 启动入口（对齐小程序 openCurrent：续答草稿 / 首访直开 / 次组选题） ---------- */
  function boot() {
    const store = loadStore();
    standaloneStarPillEl.textContent = `✦ ${Number(store.companion.starBalance || 0)}`;
    const todayKey = Store.getUtc8DateKey();
    const ls = store.listeningState;
    if (ls.day.date !== todayKey) {
      ls.day = { date: todayKey, categories: [], rewardedToday: false };
      saveStore(store);
    }

    if (ls.draft && groupById(ls.draft.groupId)) {
      renderQuestionView(store);
      return;
    }

    const avail = getAvailableCategories(ls, todayKey);
    if (!avail.length) {
      renderEndView(store);
      return;
    }

    // 对齐小程序体验：当日已完成过至少 1 组则展示「接着聊哪件小事？」列表；否则直接为你抽一组开启（右上角随时可点「换话题 ↻」）
    if ((ls.day.categories || []).length > 0) {
      renderChoicesView(store);
    } else {
      startCategoryGroup(null);
    }
  }

  boot();
})();
