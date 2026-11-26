/* ==========================================================================
   EggBabe 拾物伴手礼袋 & 3D 全息典藏卡统一配置与抽取引擎 (UMD)
   - 零新增生图：100% 复用 assets/shared/catalog.json 现成 41 件小物件与双宠穿搭 PNG
   - 温和反焦虑：每袋 3 张不重复；未收集小物件 4.5x 权重优先；每 3 袋保底「祈愿典藏」
   - 合规适配：支持 wx-mp-ordinary 模式文案降噪，绝不出现赌博/付费抽卡表述
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeHoloConfig = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const PACK_SIZE = 3;
  const PITY_THRESHOLD = 3;

  const PACK_BRAND = Object.freeze({
    logo: "EGGBABE",
    seriesCode: "拾物伴手礼 · S01",
    tearHint: "◀ 横向撕开封口 ⟶",
    footerLeft: "EGGBABE // KEEPSAKE",
    footerRight: "3 张小物件全息卡",
    microSpec: "暖橡木多宝收藏格 · 伴手礼袋",
    backHeadline: "41 件旅途与居家小物件\n每袋 3 张 · 新物自动摆入多宝格",
    backSpec: "EGGBABE COMPANION EDITION · 2026"
  });

  // 4 套蛋宝宝专属和纸铝箔伴手礼袋主题配色（对齐 Design System 暖色系）
  const PACK_THEMES = Object.freeze([
    {
      name: "雾松抹茶",
      code: "MTC-01",
      color: "#4B6B46",
      highlight: "#B9D48C",
      shadow: "#1E301C"
    },
    {
      name: "桂花暖金",
      code: "OSM-02",
      color: "#B47A3C",
      highlight: "#F3D38D",
      shadow: "#472C12"
    },
    {
      name: "晚霞桃粉",
      code: "PCH-03",
      color: "#B86B66",
      highlight: "#F5C2B7",
      shadow: "#4A2221"
    },
    {
      name: "月夜青瓷",
      code: "CEL-04",
      color: "#3F5E72",
      highlight: "#9CC4D9",
      shadow: "#162633"
    }
  ]);

  // 温和蛋宝宝品级定义（与原版全息渲染档位一一映射）
  const TIER_META = Object.freeze({
    common: {
      rank: 1,
      tierLabel: "旅途日常",
      rarityMark: "★",
      aura: "rgba(182, 162, 134, 0.34)",
      shockColor: "#E8D5B7",
      autoFlip: true,
      peekName: "暖木日常气息"
    },
    holo: {
      rank: 3,
      tierLabel: "玉兔心意",
      rarityMark: "★★",
      aura: "rgba(157, 182, 91, 0.62)",
      shockColor: "#B7D97A",
      autoFlip: false,
      peekName: "玉兔柔光闪耀"
    },
    ultra: {
      rank: 4,
      tierLabel: "锦鲤心意",
      rarityMark: "★★",
      aura: "rgba(240, 184, 86, 0.68)",
      shockColor: "#F6C967",
      autoFlip: false,
      peekName: "锦鲤暖金微光"
    },
    secret: {
      rank: 5,
      tierLabel: "祈愿典藏",
      rarityMark: "★★★",
      aura: "rgba(235, 168, 128, 0.78)",
      shockColor: "#F4B9AE",
      autoFlip: false,
      peekName: "祈愿虹彩典藏"
    }
  });

  // 按品类定制分区全息卡面配色（哑光铭牌确保中文极高对比度）
  const CATEGORY_THEMES = Object.freeze({
    daily: {
      rarity: "common",
      tag: "旅途日常",
      frameBg: "linear-gradient(155deg, #F0E6D7 0%, #D9C6AE 48%, #B3997C 100%)",
      plaqueBg: "linear-gradient(180deg, rgba(255, 252, 246, 0.96), rgba(244, 236, 224, 0.97))",
      edgeColor: "#9B8368",
      textColor: "#2C2218",
      windowBg:
        "radial-gradient(84% 64% at 50% 26%, rgba(255, 250, 238, 0.92) 0%, rgba(235, 215, 185, 0.45) 50%, transparent 78%), " +
        "linear-gradient(170deg, #E8D9C3 0%, #C6AE90 62%, #8F7558 100%)"
    },
    yutu: {
      rarity: "holo",
      tag: "玉兔专属",
      frameBg: "linear-gradient(155deg, #E5EFDA 0%, #BDD1A4 48%, #7F9A66 100%)",
      plaqueBg: "linear-gradient(180deg, rgba(250, 253, 246, 0.96), rgba(236, 244, 226, 0.97))",
      edgeColor: "#6B8254",
      textColor: "#172613",
      windowBg:
        "radial-gradient(82% 62% at 50% 24%, rgba(255, 253, 234, 0.88) 0%, rgba(188, 222, 148, 0.44) 48%, transparent 78%), " +
        "linear-gradient(170deg, #B5D092 0%, #6D8F56 58%, #344D2B 100%)"
    },
    koi: {
      rarity: "ultra",
      tag: "锦鲤专属",
      frameBg: "linear-gradient(155deg, #FBF0D6 0%, #EBC785 48%, #BA8841 100%)",
      plaqueBg: "linear-gradient(180deg, rgba(255, 251, 242, 0.96), rgba(248, 236, 212, 0.97))",
      edgeColor: "#A67634",
      textColor: "#2B1E0D",
      windowBg:
        "radial-gradient(84% 62% at 50% 24%, rgba(255, 248, 220, 0.9) 0%, rgba(246, 188, 108, 0.46) 48%, transparent 78%), " +
        "linear-gradient(170deg, #EAB26A 0%, #B86D3A 58%, #592C1A 100%)"
    },
    shared: {
      rarity: "secret",
      tag: "祈愿共有",
      frameBg: "linear-gradient(150deg, #FDF2D5 0%, #E7C178 36%, #D79C91 72%, #9A6857 100%)",
      plaqueBg: "linear-gradient(180deg, rgba(255, 252, 245, 0.97), rgba(249, 238, 228, 0.98))",
      edgeColor: "#9E6E52",
      textColor: "#26160E",
      windowBg:
        "radial-gradient(86% 64% at 50% 26%, rgba(255, 245, 212, 0.92) 0%, rgba(244, 185, 174, 0.46) 46%, transparent 76%), " +
        "radial-gradient(90% 60% at 50% 92%, rgba(92, 46, 56, 0.72) 0%, transparent 72%), " +
        "linear-gradient(168deg, #E8B88A 0%, #B46C6E 54%, #3D2234 100%)"
    }
  });

  function resolveAssetPath(relPath, assetPrefix) {
    const p = String(relPath || "").trim();
    if (!p) return "";
    if (/^(https?:|data:|blob:|\/|\.\.?\/)/i.test(p)) return p;
    const prefix = assetPrefix === undefined ? "../../" : String(assetPrefix);
    return prefix + p.replace(/^\/+/, "");
  }

  function extractShortTrait(item) {
    const raw = (item.stories && (item.stories.yutu || item.stories.koi)) || item.story || item.sourceHint || "";
    const cleaned = String(raw).replace(/\s+/g, " ").trim();
    if (cleaned.length <= 22) return cleaned;
    return cleaned.slice(0, 21) + "…";
  }

  /**
   * 将 catalog.json 的 41 件小物件映射为全息卡池
   */
  function buildKeepsakeCardPool(catalog, assetPrefix) {
    const list = catalog && Array.isArray(catalog.keepsakes) ? catalog.keepsakes : [];
    const total = list.length || 41;
    return list.map((ks, index) => {
      const catKey = CATEGORY_THEMES[ks.category] ? ks.category : "daily";
      const theme = CATEGORY_THEMES[catKey];
      const tier = TIER_META[theme.rarity];
      return {
        id: ks.id,
        name: ks.name,
        category: catKey,
        categoryLabel: ks.categoryLabel || theme.tag,
        tag: ks.categoryLabel || theme.tag,
        trait: extractShortTrait(ks),
        story: ks.story || (ks.stories && (ks.stories.yutu || ks.stories.koi)) || "",
        stories: ks.stories || null,
        sourceHint: ks.sourceHint || "",
        clue: ks.clue || "",
        serial: String(index + 1).padStart(3, "0") + "/" + String(total).padStart(3, "0"),
        rarity: theme.rarity,
        rarityMark: tier.rarityMark,
        rarityLabel: tier.tierLabel,
        frameBg: theme.frameBg,
        plaqueBg: theme.plaqueBg,
        edgeColor: theme.edgeColor,
        textColor: theme.textColor,
        windowBg: theme.windowBg,
        image: resolveAssetPath(ks.img, assetPrefix),
        lineImage: resolveAssetPath(ks.lineImg, assetPrefix),
        rawImg: ks.img,
        rawLineImg: ks.lineImg
      };
    });
  }

  function weightedPick(candidates, weightFn, rand) {
    if (!candidates.length) return null;
    let total = 0;
    const weights = candidates.map((item) => {
      const w = Math.max(0.01, Number(weightFn(item)) || 1);
      total += w;
      return w;
    });
    let r = rand() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  /**
   * 抽取 1 袋 3 张不重复小物件卡：
   * - 未解锁小物件 4.5 倍高权重优先，降低重复挫败感
   * - 第 3 张（压轴位）偏向玉兔/锦鲤专属或祈愿典藏
   * - 每 3 袋（pityCount >= 2）必出至少 1 张「祈愿典藏（shared）」
   */
  function rollEggBabePack(opts) {
    const options = opts || {};
    const pool = Array.isArray(options.pool) ? options.pool : [];
    const packSize = Math.max(1, Math.min(options.packSize || PACK_SIZE, pool.length || PACK_SIZE));
    const unlockedSet = new Set(Array.isArray(options.unlockedIds) ? options.unlockedIds : []);
    const pityCount = Math.max(0, Number(options.pityCount) || 0);
    const rand = typeof options.randomFn === "function" ? options.randomFn : Math.random;

    if (!pool.length) {
      return { entries: [], topRarity: "common", maxRank: 1, hitSecret: false };
    }

    const picked = [];
    const usedIds = new Set();

    const byRarity = {
      common: pool.filter((c) => c.rarity === "common"),
      holo: pool.filter((c) => c.rarity === "holo"),
      ultra: pool.filter((c) => c.rarity === "ultra"),
      secret: pool.filter((c) => c.rarity === "secret")
    };

    const pickFromList = (list) => {
      const avail = list.filter((c) => !usedIds.has(c.id));
      const source = avail.length ? avail : pool.filter((c) => !usedIds.has(c.id));
      if (!source.length) return null;
      const item = weightedPick(source, (c) => (unlockedSet.has(c.id) ? 1 : 4.5), rand);
      if (item) usedIds.add(item.id);
      return item;
    };

    const rollBucket = (weightsMap) => {
      const entries = Object.entries(weightsMap).filter(([k]) => byRarity[k] && byRarity[k].length > 0);
      const sum = entries.reduce((acc, [, w]) => acc + w, 0);
      let r = rand() * sum;
      for (const [key, w] of entries) {
        r -= w;
        if (r <= 0) return key;
      }
      return entries[entries.length - 1][0];
    };

    // 1) 前两张：温和混合日常 + 双宠专属（偶尔直接出祈愿典藏）
    for (let i = 0; i < packSize - 1; i++) {
      const bucket = i === 0
        ? rollBucket({ common: 52, holo: 22, ultra: 22, secret: 4 })
        : rollBucket({ common: 26, holo: 34, ultra: 34, secret: 6 });
      const card = pickFromList(byRarity[bucket]);
      if (card) picked.push(card);
    }

    // 2) 压轴第 3 张：每 3 袋触发保底祈愿典藏，其余高概率出双宠专属/祈愿典藏
    const forceSecret = pityCount >= PITY_THRESHOLD - 1 && byRarity.secret.length > 0;
    const finalBucket = forceSecret
      ? "secret"
      : rollBucket({ secret: 22, ultra: 39, holo: 39 });
    const finalCard = pickFromList(byRarity[finalBucket]);
    if (finalCard) picked.push(finalCard);

    // 补足到 packSize
    while (picked.length < packSize) {
      const extra = pickFromList(pool);
      if (!extra) break;
      picked.push(extra);
    }

    // 按品级从低到高排入，让最亮眼的压轴卡落在黄金中心/压轴位
    picked.sort((a, b) => (TIER_META[a.rarity]?.rank || 1) - (TIER_META[b.rarity]?.rank || 1));

    let topRarity = "common";
    let maxRank = 1;
    const entries = picked.map((def) => {
      const rank = TIER_META[def.rarity]?.rank || 1;
      if (rank >= maxRank) {
        maxRank = rank;
        topRarity = def.rarity;
      }
      return { def };
    });

    return {
      entries,
      topRarity,
      maxRank,
      hitSecret: topRarity === "secret"
    };
  }

  /**
   * 构造「我的收藏卡 · 实体蛋纪念档案」3D 全息身份卡数据（一蛋一份 · 身份与纪念）
   */
  function buildEntityEggCardData(opts) {
    const options = opts || {};
    const petId = options.petId === "yutu" ? "yutu" : "koi";
    const store = options.store || {};
    const catalog = options.catalog || {};
    const assetPrefix = options.assetPrefix === undefined ? "./" : options.assetPrefix;

    const petStore = (store.pets && store.pets[petId]) || {};
    const petCatalog = (catalog.pets && catalog.pets[petId]) || {};
    const items = Array.isArray(petCatalog.items) ? petCatalog.items : [];
    const equippedId = petStore.equippedSetId || (petId === "yutu" ? "set_cozy_knit" : "set_duck");
    const outfitObj = items.find((it) => it.id === equippedId) || items[0] || null;
    const outfitName = options.outfitName || (outfitObj && outfitObj.name) || "原生毛绒";
    const outfitImage = options.outfitImage
      || resolveAssetPath(
        (outfitObj && (outfitObj.tex || outfitObj.thumb))
          || (petId === "yutu" ? "assets/shared/png/yutu_set_cozy_knit.png" : "assets/shared/png/koi_set_duck.png"),
        assetPrefix
      );

    const isYutu = petId === "yutu";
    const companion = store.companion || {};
    const user = store.user || {};
    const care = options.care || petStore.care || { hunger: 70, hygiene: 75 };
    const totalDays = Math.max(1, Number(companion.totalCompanionDays || companion.companionDays || 1));
    const firstMetAt = companion.firstMetAt || "2026-11-24";
    const publicId = user.publicId || "EB-000000";
    const unlockedCount = store.curioCabinet && Array.isArray(store.curioCabinet.unlockedIds)
      ? store.curioCabinet.unlockedIds.length
      : 0;

    const MOOD_ACCENTS = {
      JOY: "#F3C85F",
      CALM: "#9DB65B",
      EXCITEMENT: "#F2995E",
      CURIOSITY: "#7BBFD4",
      CARE: "#F4B9AE",
      ANXIETY: "#B7A6DC",
      FRUSTRATION: "#C9987B",
      FATIGUE: "#D9B47C"
    };

    const moodInfo = options.moodInfo || {};
    const moodKey = moodInfo.moodKey || (petStore.dailyMood && petStore.dailyMood.moodKey) || "JOY";
    const moodIcon = moodInfo.icon || "😊";
    const moodLabel = moodInfo.label || "愉快";
    const moodAccent = MOOD_ACCENTS[moodKey] || "#E8C97A";

    const hunger = typeof care.hunger === "number" ? care.hunger : 70;
    const hygiene = typeof care.hygiene === "number" ? care.hygiene : 75;
    let statusLabel = options.statusLabel || "";
    if (!statusLabel) {
      if (hunger < 30) statusLabel = "肚子咕噜中";
      else if (hygiene < 30) statusLabel = "想洗香香";
      else statusLabel = "桌边陪伴中";
    }

    const personaLabel = options.personaLabel || (isYutu ? "嘴硬心软冷幽默" : "慢半拍温柔派");

    // 借鉴万智牌五色法球环：5 颗实时陪伴状态法球（无冰冷数字条）
    const orbs = [
      { id: "energy", label: "元气", color: "#F5C45E", lit: hunger >= 35 },
      { id: "clean", label: "舒心", color: "#87CBE0", lit: hygiene >= 35 },
      { id: "mood", label: "心情", color: moodAccent, lit: !moodInfo.overriddenByCare },
      { id: "outfit", label: "穿搭", color: "#F4B9AE", lit: !!equippedId },
      { id: "bond", label: "陪伴", color: "#9DB65B", lit: totalDays >= 1 }
    ];

    return {
      kind: "entity-egg",
      petId,
      name: petStore.name || (isYutu ? "糯米团子" : "锦小鲤"),
      prototypeLabel: isYutu ? "玉兔原型" : "锦鲤原型",
      tag: isYutu ? "YT · 实体蛋" : "KOI · 实体蛋",
      trait: `身穿 · ${outfitName}`,
      serial: publicId,
      rarity: isYutu ? "secret" : "ultra",
      rarityMark: "✦",
      rarityLabel: "一蛋一份 · 典藏",
      image: outfitImage,
      frameBg: isYutu
        ? "linear-gradient(150deg, #F8F3E4 0%, #D9E5C7 42%, #9DB65B 100%)"
        : "linear-gradient(150deg, #FDF4DE 0%, #F1CA88 44%, #C98249 100%)",
      plaqueBg: "linear-gradient(180deg, rgba(255, 253, 248, 0.97), rgba(246, 241, 232, 0.98))",
      edgeColor: isYutu ? "#6B7E45" : "#9E6632",
      textColor: "#1C2418",
      windowBg: isYutu
        ? "radial-gradient(84% 62% at 50% 24%, rgba(255, 252, 236, 0.94) 0%, rgba(186, 214, 146, 0.45) 48%, transparent 78%), linear-gradient(170deg, #DCE7CA 0%, #8CA66B 62%, #3D5233 100%)"
        : "radial-gradient(84% 62% at 50% 24%, rgba(255, 248, 224, 0.94) 0%, rgba(244, 185, 134, 0.48) 48%, transparent 78%), linear-gradient(170deg, #F4CFA0 0%, #C67C4E 60%, #5B2E22 100%)",
      backMeta: {
        eyebrow: "EGGBABE · 陪伴纹章",
        publicId,
        firstMetAt,
        totalDays,
        outfitName,
        ownerNickname: user.nickname || "蛋宝好友",
        unlockedCount,
        moodKey,
        moodIcon,
        moodLabel,
        moodAccent,
        statusLabel,
        personaLabel,
        orbs,
        moodQuote: options.moodQuote || (moodInfo.text ? `“${moodInfo.text}”` : (isYutu
          ? "“长耳朵听见风声的时候，就想和你靠在一起发会儿呆。”"
          : "“我想了想，觉得遇到你的那天运气特别好。”")),
        batchNote: `EGGBABE · 陪伴第 ${totalDays} 天`
      }
    };
  }

  return {
    PACK_SIZE,
    PITY_THRESHOLD,
    PACK_BRAND,
    PACK_THEMES,
    TIER_META,
    CATEGORY_THEMES,
    resolveAssetPath,
    buildKeepsakeCardPool,
    rollEggBabePack,
    buildEntityEggCardData
  };
});
