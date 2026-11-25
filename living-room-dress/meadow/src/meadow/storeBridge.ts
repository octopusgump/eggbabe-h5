export type PetId = 'yutu' | 'koi'

export type HostContext = {
  petId: PetId
  petName: string
  starBalance: number
  sfxOn: boolean
  dailyEarned: number
  dailyCap: number
  isEmbedded: boolean
}

export type SettlementInput = {
  level: number
  penned: number
  total: number
  reason: 'round' | 'fall'
}

export type SettlementResult = {
  baseStars: number
  starsAwarded: number
  expAwarded: number
  capped: boolean
  starBalance: number
  dailyEarned: number
  dailyCap: number
  petReply: string
}

interface EggBabeStoreApi {
  STORAGE_KEY: string
  DAILY_MINIGAME_STAR_CAP: number
  createStorageAdapter: () => {
    getJSON: (key: string) => any
    setJSON: (key: string, val: any) => void
  }
  loadOrMigrateStore?: (adapter: any) => any
  createDefaultState?: () => any
  getUtc8DateKey: () => string
  awardActivityStars?: (
    store: any,
    stars: number,
    opts: { dateKey: string; petId: PetId; miniGameId: string },
  ) => {
    starsAwarded: number
    expAwarded: number
    capped: boolean
    earnedToday: number
    cap: number
  }
  recordDailyEvent?: (store: any, dateKey: string, petId: PetId, payload: any) => void
}

declare global {
  interface Window {
    EggBabeStore?: EggBabeStoreApi
    EggBabeCrossEndStore?: EggBabeStoreApi
  }
}

const DEFAULT_CAP = 45

function getStoreApi(): EggBabeStoreApi | null {
  return window.EggBabeStore || window.EggBabeCrossEndStore || null
}

function getTodayFallback(): string {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return now.toISOString().slice(0, 10)
}

function loadLatestStore(): { api: EggBabeStoreApi | null; adapter: any; store: any } {
  const api = getStoreApi()
  if (!api) {
    try {
      const raw = localStorage.getItem('eggbabe_cross_end_store_v1')
      return { api: null, adapter: null, store: raw ? JSON.parse(raw) : null }
    } catch {
      return { api: null, adapter: null, store: null }
    }
  }
  const adapter = api.createStorageAdapter()
  const loaded =
    typeof api.loadOrMigrateStore === 'function'
      ? api.loadOrMigrateStore(adapter)
      : adapter.getJSON(api.STORAGE_KEY) || api.createDefaultState?.()
  const store = loaded && typeof loaded === 'object' && 'store' in loaded ? loaded.store : loaded
  return { api, adapter, store }
}

export function isEmbeddedMode(): boolean {
  try {
    const qs = new URLSearchParams(window.location.search)
    return qs.get('embed') === '1' || window.parent !== window
  } catch {
    return false
  }
}

export function readHostContext(): HostContext {
  const { api, store } = loadLatestStore()
  const qs = new URLSearchParams(window.location.search)
  const qsPet = qs.get('pet')
  const rawPet = qsPet || store?.activePetId || 'yutu'
  const petId: PetId = rawPet === 'koi' ? 'koi' : 'yutu'
  const petName =
    store?.pets?.[petId]?.name || (petId === 'yutu' ? '玉兔' : '锦鲤')
  const todayKey = api ? api.getUtc8DateKey() : getTodayFallback()
  const dailyCap = api?.DAILY_MINIGAME_STAR_CAP ?? DEFAULT_CAP
  const dailyEarned = Number(store?.companion?.dailyMiniGameStars?.[todayKey] || 0)
  const starBalance = Number(store?.companion?.starBalance || 0)
  const sfxOn = store?.settings?.sfxOn !== false
  return {
    petId,
    petName,
    starBalance,
    sfxOn,
    dailyEarned,
    dailyCap,
    isEmbedded: isEmbeddedMode(),
  }
}

export function computeMeadowReward(
  penned: number,
  total: number,
  reason: 'round' | 'fall',
): number {
  if (reason === 'fall') {
    if (penned >= 6) return 6
    if (penned >= 1) return 4
    return 2
  }
  if (penned >= total) return 12
  if (penned >= 8) return 10
  if (penned >= 5) return 8
  if (penned >= 1) return 4
  return 2
}

function buildPetReply(petId: PetId, penned: number, total: number, reason: 'round' | 'fall'): string {
  if (reason === 'fall') {
    return petId === 'yutu'
      ? '哎呀脚一滑滚下草坡了，歇口气再追回来～'
      : '噗通滑出草边啦，下次绕着浅滩稳稳走！'
  }
  if (penned >= total) {
    return petId === 'yutu'
      ? '十一只小羊全进圈啦，长耳朵都快竖成天线了！'
      : '一只都没漏掉，今天草场风气真旺～'
  }
  if (penned >= 7) {
    return petId === 'yutu'
      ? '跑得毛茸茸的，小羊们基本都乖乖回家啦。'
      : '配合得真顺手，再练一局肯定全员归队！'
  }
  return petId === 'yutu'
    ? '小羊跑得挺快呀，慢慢绕到它们身后更好赶～'
    : '别急别急，贴近羊群外侧轻轻推过去就行。'
}

export function settleMeadowRound(input: SettlementInput): SettlementResult {
  const { api, adapter, store } = loadLatestStore()
  const baseStars = computeMeadowReward(input.penned, input.total, input.reason)
  const ctx = readHostContext()
  const petReply = buildPetReply(ctx.petId, input.penned, input.total, input.reason)

  if (!api || !adapter || !store) {
    return {
      baseStars,
      starsAwarded: baseStars,
      expAwarded: 0,
      capped: false,
      starBalance: ctx.starBalance + baseStars,
      dailyEarned: ctx.dailyEarned + baseStars,
      dailyCap: ctx.dailyCap,
      petReply,
    }
  }

  const todayKey = api.getUtc8DateKey()
  let starsAwarded = 0
  let expAwarded = 0
  let capped = false
  let dailyEarned = ctx.dailyEarned
  const dailyCap = api.DAILY_MINIGAME_STAR_CAP ?? DEFAULT_CAP

  if (typeof api.awardActivityStars === 'function') {
    const res = api.awardActivityStars(store, baseStars, {
      dateKey: todayKey,
      petId: ctx.petId,
      miniGameId: 'danbaobao_meadow',
    })
    starsAwarded = Number(res?.starsAwarded || 0)
    expAwarded = Number(res?.expAwarded || 0)
    capped = Boolean(res?.capped)
    dailyEarned = Number(res?.earnedToday || dailyEarned)
  } else {
    if (!store.companion) store.companion = {}
    if (!store.companion.dailyMiniGameStars) store.companion.dailyMiniGameStars = {}
    const prev = Number(store.companion.dailyMiniGameStars[todayKey] || 0)
    const remain = Math.max(0, dailyCap - prev)
    starsAwarded = Math.min(baseStars, remain)
    capped = starsAwarded < baseStars
    if (starsAwarded > 0) {
      store.companion.starBalance = Number(store.companion.starBalance || 0) + starsAwarded
      store.companion.dailyMiniGameStars[todayKey] = prev + starsAwarded
    }
    dailyEarned = prev + starsAwarded
    api.recordDailyEvent?.(store, todayKey, ctx.petId, {
      miniGame: 'danbaobao_meadow',
      countsAsEffective: true,
    })
  }

  adapter.setJSON(api.STORAGE_KEY, store)
  const starBalance = Number(store?.companion?.starBalance || 0)

  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage(
        {
          type: 'eggbabe:meadow-complete',
          level: input.level,
          penned: input.penned,
          total: input.total,
          reason: input.reason,
          starsAwarded,
          expAwarded,
          capped,
          starBalance,
        },
        '*',
      )
    } catch {
      /* ignore cross-origin restrictions */
    }
  }

  return {
    baseStars,
    starsAwarded,
    expAwarded,
    capped,
    starBalance,
    dailyEarned,
    dailyCap,
    petReply,
  }
}

export function syncSfxPreference(on: boolean) {
  const { api, adapter, store } = loadLatestStore()
  if (!api || !adapter || !store) return
  if (!store.settings || typeof store.settings !== 'object') {
    store.settings = {}
  }
  store.settings.sfxOn = Boolean(on)
  adapter.setJSON(api.STORAGE_KEY, store)
}

export function requestReturnRoom() {
  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'eggbabe:meadow-nav', target: 'room' }, '*')
      return
    } catch {
      /* fall through */
    }
  }
  window.location.href = '../../../'
}
