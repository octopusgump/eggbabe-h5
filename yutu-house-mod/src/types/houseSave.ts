import type { RoomId } from '../modules/roomIds'

export const SAVE_KEY = 'yutu-house-mod-save'
export const BAKE_REVISION = 3

export type HouseSave = {
  roomTiers: Record<RoomId, number>
  useLiveThree: boolean
  bakeRevision: number
}

export const defaultSave = (): HouseSave => ({
  roomTiers: { bedroom: 1, cafe: 1, kitchen: 1, sunroom: 1 },
  useLiveThree: false,
  bakeRevision: BAKE_REVISION,
})

export function loadSave(): HouseSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return defaultSave()
    const parsed = JSON.parse(raw) as HouseSave
    return {
      ...defaultSave(),
      ...parsed,
      roomTiers: { ...defaultSave().roomTiers, ...parsed.roomTiers },
    }
  } catch {
    return defaultSave()
  }
}

export function writeSave(save: HouseSave) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save))
}