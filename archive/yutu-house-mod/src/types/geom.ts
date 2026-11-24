export type Point = [number, number]

export type Occluder = {
  name: string
  poly: Point[]
  hole?: Point[]
  base: Point[]
  img?: string
  box?: [number, number, number, number]
}

export type RoomGeom = {
  name: string
  poly: Point[]
  target: Point
}

export type HouseGeom = {
  outer: Point[]
  obst: Point[][]
  occ: Occluder[]
  rooms: RoomGeom[]
  start: Point
  light: {
    w: number
    h: number
    cell: number
    rgb: number[][][]
  }
}