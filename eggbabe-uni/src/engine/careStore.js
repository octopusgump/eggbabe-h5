/**
 * 蛋宝宝轻陪伴电子宠物 · 状态管理与离线时间结算
 * - 锦鲤 / 玉兔各自独立本地存档（兼容 H5 与微信小程序）
 * - 首次进入默认 60% 饱食 / 60% 清洁，方便立即体验喂食、搓澡与升级
 * - 温和离线衰减：永不生病/不死亡；清洁 < 30 出现嗡嗡小苍蝇提醒，饱食 < 30 冒委屈饿饿气泡
 */

const STORAGE_KEY = "eggbabe_care_v1";

const HUNGER_DECAY_PER_HOUR = 5;   // 每小时下降 5 点
const HYGIENE_DECAY_PER_HOUR = 4;  // 每小时下降 4 点
const LOW_THRESHOLD = 30;
const PET_EXP_COOLDOWN_MS = 10000;

export const SNACKS_BY_PET = {
  koi: [
    { id: "dried_fish", name: "香酥小鱼干", emoji: "🐟", hunger: 22, exp: 16, reply: "咔嚓咔嚓！最爱小鱼干啦~" },
    { id: "berry_mochi", name: "草莓大福", emoji: "🍓", hunger: 26, exp: 20, reply: "软糯糯甜甜的，幸福冒泡！" },
    { id: "star_candy", name: "幸运星星糖", emoji: "🍬", hunger: 18, exp: 24, reply: "叮咚！吃掉一颗好运加倍~" }
  ],
  yutu: [
    { id: "carrot", name: "脆脆胡萝卜", emoji: "🥕", hunger: 24, exp: 16, reply: "嘎嘣脆！兔兔能量充满啦~" },
    { id: "osmanthus_cake", name: "桂花蜜糕", emoji: "🥮", hunger: 28, exp: 22, reply: "香香的桂花味，像在月宫一样~" },
    { id: "cream_berry", name: "奶油小草莓", emoji: "🍓", hunger: 20, exp: 20, reply: "酸酸甜甜，耳朵都要开心翘起来啦！" }
  ]
};

const PET_SPEECHES = {
  hungry: [
    "肚肚咕噜噜叫啦，想吃小零食~",
    "有点饿饿的，投喂我一口嘛…",
    "闻到好吃的味道了，什么时候开饭呀？"
  ],
  dirty: [
    "嗡嗡嗡…身上沾灰灰啦，帮我洗香香吧！",
    "有小苍蝇绕着飞，好想搓泡泡洗澡~",
    "毛毛有点黏糊糊，求搓澡！"
  ],
  bathDone: [
    "哗啦啦！洗得香喷喷的，毛毛好蓬松~",
    "小苍蝇都跑光啦，舒服得想转圈圈！",
    "亮晶晶的！现在是全屋最干净的小可爱~"
  ],
  petting: [
    "呼噜呼噜~ 摸头最舒服啦！",
    "嘿嘿，再多陪我玩一会儿嘛~",
    "贴贴！感觉今天会有超棒的好运！",
    "暖呼呼的手手，好喜欢你~"
  ],
  levelUp: [
    "叮咚升级啦！我们的亲密度又涨了一大截~",
    "哇！升到新等级啦，解锁更多开心能量！"
  ]
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function expForNextLevel(level) {
  return 60 + (Math.max(1, level) - 1) * 35;
}

function createDefaultPetState(now) {
  return {
    hunger: 60,
    hygiene: 60,
    exp: 0,
    level: 1,
    updatedAt: now || Date.now(),
    lastPetExpAt: 0
  };
}

function readStorage() {
  try {
    if (typeof uni !== "undefined" && typeof uni.getStorageSync === "function") {
      const raw = uni.getStorageSync(STORAGE_KEY);
      if (raw && typeof raw === "object") return raw;
      if (typeof raw === "string" && raw) return JSON.parse(raw);
    } else if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    // ignore corrupted storage
  }
  return null;
}

function writeStorage(data) {
  try {
    if (typeof uni !== "undefined" && typeof uni.setStorageSync === "function") {
      uni.setStorageSync(STORAGE_KEY, data);
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    // ignore quota errors
  }
}

export function loadCareAll(now = Date.now()) {
  const saved = readStorage();
  const state = {
    koi: createDefaultPetState(now),
    yutu: createDefaultPetState(now)
  };
  if (saved && typeof saved === "object") {
    ["koi", "yutu"].forEach((id) => {
      if (saved[id] && typeof saved[id] === "object") {
        state[id] = {
          hunger: clamp(Number(saved[id].hunger ?? 60), 0, 100),
          hygiene: clamp(Number(saved[id].hygiene ?? 60), 0, 100),
          exp: Math.max(0, Number(saved[id].exp ?? 0)),
          level: Math.max(1, Math.min(99, Math.floor(Number(saved[id].level ?? 1)))),
          updatedAt: Number(saved[id].updatedAt || now),
          lastPetExpAt: Number(saved[id].lastPetExpAt || 0)
        };
      }
    });
  }
  return state;
}

export function saveCareAll(state) {
  writeStorage(state);
}

/**
 * 按真实流逝时间结算单只宠物的饱食与清洁微衰减
 */
export function applyTimeDecay(petState, now = Date.now()) {
  const elapsedMs = Math.max(0, now - (petState.updatedAt || now));
  const hours = elapsedMs / 3600000;
  if (hours >= 0.02) {
    petState.hunger = clamp(Math.round((petState.hunger - hours * HUNGER_DECAY_PER_HOUR) * 10) / 10, 0, 100);
    petState.hygiene = clamp(Math.round((petState.hygiene - hours * HYGIENE_DECAY_PER_HOUR) * 10) / 10, 0, 100);
    petState.updatedAt = now;
  }
  return petState;
}

function addExp(petState, amount) {
  let leveledUp = false;
  petState.exp += Math.max(0, amount);
  while (petState.level < 99) {
    const need = expForNextLevel(petState.level);
    if (petState.exp >= need) {
      petState.exp -= need;
      petState.level += 1;
      leveledUp = true;
    } else {
      break;
    }
  }
  return leveledUp;
}

export function getMood(petState) {
  if (!petState) return "normal";
  if (petState.hygiene < LOW_THRESHOLD) return "dirty";
  if (petState.hunger < LOW_THRESHOLD) return "hungry";
  return "normal";
}

export function getReminderSpeech(petState) {
  const mood = getMood(petState);
  if (mood === "dirty") return pickRandom(PET_SPEECHES.dirty);
  if (mood === "hungry") return pickRandom(PET_SPEECHES.hungry);
  return "";
}

export function feedPet(allState, petId, snack, now = Date.now()) {
  const ps = allState[petId];
  if (!ps || !snack) return null;
  applyTimeDecay(ps, now);
  const beforeHunger = ps.hunger;
  ps.hunger = clamp(Math.round(ps.hunger + snack.hunger), 0, 100);
  const deltaHunger = Math.max(0, Math.round(ps.hunger - beforeHunger));
  const leveledUp = addExp(ps, snack.exp);
  ps.updatedAt = now;
  saveCareAll(allState);
  return {
    deltaHunger,
    deltaExp: snack.exp,
    leveledUp,
    level: ps.level,
    speech: leveledUp ? pickRandom(PET_SPEECHES.levelUp) : snack.reply
  };
}

export function finishBath(allState, petId, now = Date.now()) {
  const ps = allState[petId];
  if (!ps) return null;
  applyTimeDecay(ps, now);
  const beforeHygiene = ps.hygiene;
  ps.hygiene = 100;
  const deltaHygiene = Math.max(0, Math.round(100 - beforeHygiene));
  const deltaExp = 30;
  const leveledUp = addExp(ps, deltaExp);
  ps.updatedAt = now;
  saveCareAll(allState);
  return {
    deltaHygiene,
    deltaExp,
    leveledUp,
    level: ps.level,
    speech: leveledUp ? pickRandom(PET_SPEECHES.levelUp) : pickRandom(PET_SPEECHES.bathDone)
  };
}

export function interactPet(allState, petId, now = Date.now()) {
  const ps = allState[petId];
  if (!ps) return null;
  const canGainExp = now - (ps.lastPetExpAt || 0) >= PET_EXP_COOLDOWN_MS;
  let deltaExp = 0;
  let leveledUp = false;
  if (canGainExp) {
    deltaExp = 5;
    leveledUp = addExp(ps, deltaExp);
    ps.lastPetExpAt = now;
    ps.updatedAt = now;
    saveCareAll(allState);
  }
  return {
    deltaExp,
    leveledUp,
    level: ps.level,
    speech: leveledUp ? pickRandom(PET_SPEECHES.levelUp) : pickRandom(PET_SPEECHES.petting)
  };
}
