import { levels } from './levels.mjs';
import { appearances, originalAppearance } from './appearances.mjs';
import { medalLevels } from './challenge.mjs';

const storageKey = 'half-bottle-flip:chapter:v1';
const medalIds = Object.keys(medalLevels);

function progressState({ cleared, seen, sound, medals = [], personalRecord = 0, equippedAppearance = originalAppearance }) {
  const safeCleared = Number.isInteger(cleared) && cleared >= 0 && cleared <= levels.length ? cleared : 0;
  const safeSeen = Array.isArray(seen)
    ? levels.filter(level => level.id <= safeCleared + 1 && seen.includes(level.id)).map(level => level.id)
    : [];
  const safeMedals = Array.isArray(medals)
    ? medalIds.filter(id => safeCleared >= medalLevels[id] && medals.includes(id))
    : [];
  const safeRecord = safeCleared > 0 && Number.isSafeInteger(personalRecord) && personalRecord > 0 ? personalRecord : 0;
  // The saved milestones also restore unlocks for saves written before appearances existed.
  const unlockedAppearances = appearances
    .filter(appearance => appearance.unlocked(safeCleared === levels.length, safeRecord))
    .map(appearance => appearance.id);
  return Object.freeze({
    cleared: safeCleared, seen: Object.freeze(safeSeen), sound: sound === true, medals: Object.freeze(safeMedals),
    personalRecord: safeRecord,
    unlockedAppearances: Object.freeze(unlockedAppearances),
    equippedAppearance: unlockedAppearances.includes(equippedAppearance) ? equippedAppearance : originalAppearance,
  });
}

export function createProgressStore(storage) {
  let persistent = Boolean(storage);

  function read() {
    if (!persistent) return null;
    let record;
    try {
      record = storage.getItem(storageKey);
    } catch {
      persistent = false;
      return null;
    }
    try {
      const saved = JSON.parse(record);
      return saved ? progressState(saved) : null;
    } catch {
      return null;
    }
  }

  let state = read() ?? progressState({ cleared: 0, seen: [], sound: false });

  function refresh() {
    const saved = read();
    if (saved) {
      state = progressState({
        cleared: Math.max(state.cleared, saved.cleared),
        seen: [...state.seen, ...saved.seen],
        sound: saved.sound,
        medals: [...state.medals, ...saved.medals],
        personalRecord: Math.max(state.personalRecord, saved.personalRecord),
        equippedAppearance: saved.equippedAppearance,
      });
    }
  }

  function save(changes) {
    state = progressState({ ...state, ...changes });
    if (persistent) {
      try {
        storage.setItem(storageKey, JSON.stringify(state));
      } catch {
        persistent = false;
      }
    }
    return true;
  }

  return {
    get state() { return state; },
    get persistent() { return persistent; },
    refresh,
    pass(level) {
      refresh();
      return level <= levels.length && level === state.cleared + 1 ? save({ cleared: level }) : false;
    },
    teach(level) {
      refresh();
      const opened = Number.isInteger(level) && level > 0 && level <= Math.min(state.cleared + 1, levels.length);
      return opened && !state.seen.includes(level) ? save({ seen: [...state.seen, level] }) : false;
    },
    awardMedal(id) {
      refresh();
      const earned = medalIds.includes(id) && state.cleared >= medalLevels[id] && !state.medals.includes(id);
      return earned ? save({ medals: [...state.medals, id] }) : false;
    },
    recordStreak(count) {
      refresh();
      const improved = state.cleared > 0 && Number.isSafeInteger(count) && count > state.personalRecord;
      return improved ? save({ personalRecord: count }) : false;
    },
    equipAppearance(id) {
      refresh();
      return id !== state.equippedAppearance && state.unlockedAppearances.includes(id)
        ? save({ equippedAppearance: id }) : false;
    },
    setSound(enabled) {
      refresh();
      const sound = enabled === true;
      return sound !== state.sound ? save({ sound }) : false;
    },
  };
}
