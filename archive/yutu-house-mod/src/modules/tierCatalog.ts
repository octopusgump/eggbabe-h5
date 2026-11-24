import type { RoomId } from './roomIds'
import { ROOM_GEOM_INDEX } from './roomIds'
import type { HouseGeom } from '../types/geom'
import { polyAabb, type Aabb } from './bounds'

export type ClayPiece = {
  kind: 'box' | 'pad' | 'cylinder'
  x: number
  z: number
  y?: number
  sx: number
  sy: number
  sz: number
  color: number
}

export type RoomTierDef = {
  pieces: ClayPiece[]
}

export type RoomLayout = {
  id: RoomId
  aabb: Aabb
  /** Nudge bake layer in world px */
  align: { dx: number; dy: number }
  tiers: Record<number, RoomTierDef>
}

const FLOOR = 0xf4f1d4
const WOOD = 0xc4a06a
const GREEN = 0x9ecf7a
const PINK = 0xf0b8c8
const BLUE = 0xb8d4e8
const CREAM = 0xe7d7b4

function tier2(id: RoomId): ClayPiece[] {
  switch (id) {
    case 'bedroom':
      return [
        { kind: 'pad', x: 0, z: 0, sx: 2.4, sy: 0.1, sz: 1.6, color: GREEN },
        { kind: 'box', x: -0.5, z: 0.2, y: 0.35, sx: 1.1, sy: 0.35, sz: 0.75, color: GREEN },
        { kind: 'box', x: 0.55, z: -0.35, y: 0.2, sx: 0.35, sy: 0.2, sz: 0.35, color: WOOD },
        { kind: 'box', x: -0.6, z: -0.4, y: 0.2, sx: 0.35, sy: 0.2, sz: 0.35, color: WOOD },
      ]
    case 'cafe':
      return [
        { kind: 'pad', x: 0, z: 0, sx: 2.2, sy: 0.08, sz: 1.8, color: FLOOR },
        { kind: 'cylinder', x: 0.3, z: 0.1, y: 0.25, sx: 0.5, sy: 0.5, sz: 0.5, color: CREAM },
        { kind: 'box', x: -0.45, z: 0.3, y: 0.22, sx: 0.7, sy: 0.25, sz: 0.45, color: WOOD },
      ]
    case 'kitchen':
      return [
        { kind: 'pad', x: 0, z: 0, sx: 2.3, sy: 0.08, sz: 1.7, color: 0xe8e0d0 },
        { kind: 'box', x: -0.55, z: 0, y: 0.45, sx: 0.5, sy: 0.9, sz: 0.55, color: 0xfff5e6 },
        { kind: 'box', x: 0.4, z: -0.2, y: 0.2, sx: 0.9, sy: 0.3, sz: 0.5, color: WOOD },
      ]
    case 'sunroom':
      return [
        { kind: 'pad', x: 0, z: 0, sx: 2.1, sy: 0.08, sz: 1.6, color: FLOOR },
        { kind: 'box', x: -0.2, z: 0.15, y: 0.35, sx: 0.85, sy: 0.45, sz: 0.55, color: WOOD },
        { kind: 'cylinder', x: 0.55, z: -0.25, y: 0.2, sx: 0.25, sy: 0.35, sz: 0.25, color: GREEN },
        { kind: 'cylinder', x: -0.55, z: -0.35, y: 0.18, sx: 0.2, sy: 0.25, sz: 0.2, color: PINK },
      ]
  }
}

function tier3(id: RoomId): ClayPiece[] {
  const base = tier2(id)
  if (id === 'bedroom') {
    return [
      ...base,
      { kind: 'box', x: 0.1, z: 0.45, y: 0.15, sx: 0.4, sy: 0.25, sz: 0.4, color: PINK },
      { kind: 'cylinder', x: 0.65, z: 0.35, y: 0.25, sx: 0.22, sy: 0.4, sz: 0.22, color: BLUE },
    ]
  }
  if (id === 'sunroom') {
    return [
      ...base,
      { kind: 'cylinder', x: 0, z: -0.45, y: 0.22, sx: 0.28, sy: 0.4, sz: 0.28, color: GREEN },
      { kind: 'box', x: 0.35, z: 0.4, y: 0.12, sx: 0.35, sy: 0.2, sz: 0.3, color: PINK },
    ]
  }
  return base
}

export function buildRoomLayouts(geom: HouseGeom): RoomLayout[] {
  const ids: RoomId[] = ['bedroom', 'cafe', 'kitchen', 'sunroom']
  return ids.map((id) => {
    const room = geom.rooms[ROOM_GEOM_INDEX[id]]
    const aabb = polyAabb(room.poly)
    const tiers: Record<number, RoomTierDef> = {
      2: { pieces: tier2(id) },
    }
    if (id === 'bedroom' || id === 'sunroom') {
      tiers[3] = { pieces: tier3(id) }
    }
    return { id, aabb, align: { dx: 4, dy: 6 }, tiers }
  })
}

/** Fallback to highest defined tier when config missing */
export function resolveTier(layout: RoomLayout, tier: number): number {
  if (tier <= 1) return 1
  const keys = Object.keys(layout.tiers)
    .map(Number)
    .sort((a, b) => a - b)
  let best = 1
  for (const k of keys) {
    if (k <= tier) best = k
  }
  return best
}