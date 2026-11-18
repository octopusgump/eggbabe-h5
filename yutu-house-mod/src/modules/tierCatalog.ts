import type { RoomId } from './roomIds'
import { ROOM_GEOM_INDEX } from './roomIds'
import type { HouseGeom, Point } from '../types/geom'
import { polyAabb, type Aabb } from './bounds'
import { pickFloorQuad } from '../bake/homography'

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
  /** Nudge bake layer in world px (legacy; homography placement ignores this) */
  align: { dx: number; dy: number }
  /** Floor quad in art/world px, atan2-ordered — for matrix3d */
  artQuad: Point[]
  /** Front edge Y for depth sort vs bunny foot */
  frontY: number
  /** Sample point for bake tint (room target) */
  tintAt: Point
  tiers: Record<number, RoomTierDef>
}

const WOOD = 0xc4a06a
const GREEN = 0x9ecf7a
const PINK = 0xf0b8c8
const BLUE = 0xb8d4e8
const CREAM = 0xe7d7b4

function tier2(id: RoomId): ClayPiece[] {
  switch (id) {
    case 'bedroom':
      return [
        // Rug + bed + nightstands — no full-room pad (art floor stays visible)
        { kind: 'pad', x: 0, z: 0.35, sx: 0.9, sy: 0.06, sz: 0.9, color: 0xf5f0e4 },
        { kind: 'box', x: -0.15, z: -0.15, y: 0.28, sx: 1.15, sy: 0.32, sz: 0.85, color: GREEN },
        { kind: 'box', x: 0.55, z: -0.35, y: 0.18, sx: 0.32, sy: 0.18, sz: 0.32, color: WOOD },
        { kind: 'box', x: -0.7, z: -0.35, y: 0.18, sx: 0.32, sy: 0.18, sz: 0.32, color: WOOD },
      ]
    case 'cafe':
      return [
        { kind: 'cylinder', x: 0.25, z: 0.05, y: 0.28, sx: 0.55, sy: 0.42, sz: 0.55, color: CREAM },
        { kind: 'box', x: -0.45, z: 0.25, y: 0.2, sx: 0.65, sy: 0.22, sz: 0.4, color: WOOD },
        { kind: 'box', x: 0.15, z: 0.45, y: 0.14, sx: 0.28, sy: 0.16, sz: 0.28, color: WOOD },
      ]
    case 'kitchen':
      return [
        { kind: 'box', x: -0.5, z: 0, y: 0.42, sx: 0.48, sy: 0.85, sz: 0.5, color: 0xfff5e6 },
        { kind: 'box', x: 0.35, z: -0.15, y: 0.22, sx: 0.85, sy: 0.28, sz: 0.48, color: WOOD },
        { kind: 'pad', x: 0.15, z: 0.35, sx: 0.7, sy: 0.05, sz: 0.45, color: PINK },
      ]
    case 'sunroom':
      return [
        { kind: 'box', x: -0.1, z: 0.1, y: 0.32, sx: 0.75, sy: 0.4, sz: 0.55, color: WOOD },
        { kind: 'cylinder', x: 0.55, z: -0.25, y: 0.2, sx: 0.22, sy: 0.35, sz: 0.22, color: GREEN },
        { kind: 'cylinder', x: -0.55, z: -0.3, y: 0.16, sx: 0.18, sy: 0.22, sz: 0.18, color: PINK },
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
    const artQuad = pickFloorQuad(room.poly)
    const frontY = Math.max(...artQuad.map((p) => p[1]))
    const tiers: Record<number, RoomTierDef> = {
      2: { pieces: tier2(id) },
    }
    if (id === 'bedroom' || id === 'sunroom') {
      tiers[3] = { pieces: tier3(id) }
    }
    return {
      id,
      aabb,
      align: { dx: 4, dy: 6 },
      artQuad,
      frontY,
      tintAt: [...room.target] as Point,
      tiers,
    }
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