export const ROOM_IDS = ['bedroom', 'cafe', 'kitchen', 'sunroom'] as const
export type RoomId = (typeof ROOM_IDS)[number]

/** Index in geom.rooms[] — same order as chips in yutu-house demo */
export const ROOM_GEOM_INDEX: Record<RoomId, number> = {
  bedroom: 0,
  cafe: 1,
  kitchen: 2,
  sunroom: 3,
}

export const ROOM_LABEL: Record<RoomId, string> = {
  bedroom: '卧室',
  cafe: '咖啡角',
  kitchen: '小厨房',
  sunroom: '阳光房',
}

export const MAX_TIER: Record<RoomId, number> = {
  bedroom: 3,
  cafe: 2,
  kitchen: 2,
  sunroom: 3,
}