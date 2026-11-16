import type { HouseSave } from '../types/houseSave'
import type { RoomLayout } from '../modules/tierCatalog'
import { ROOM_LABEL, type RoomId } from '../modules/roomIds'
import { resolveTier } from '../modules/tierCatalog'
import { plateToArtMatrix } from '../bake/homography'
import { lightRef, tintAt } from '../shared/tint'
import type { HouseGeom, Point } from '../types/geom'
import type { RoomModule } from '../modules/RoomModule'
import type { bakeRoomModule as BakeFn } from '../bake/bakeRoom'

const Z_BEHIND = 4
const Z_FRONT = 20

function ROOM_IDS_FROM_LAYOUTS(layouts: Map<RoomId, RoomLayout>) {
  return [...layouts.keys()]
}

export class ModuleLayers {
  private readonly world: HTMLElement
  private readonly geom: HouseGeom
  private readonly bakeEls = new Map<RoomId, HTMLImageElement>()
  private readonly liveCanvas = new Map<RoomId, HTMLCanvasElement>()
  private mods = new Map<RoomId, RoomModule>()
  private cache = new Map<string, string>()
  private layouts = new Map<RoomId, RoomLayout>()
  private getBunnyPos: (() => Point) | null = null
  private depthRaf = 0
  private LREF: number
  private bakeRoom: typeof BakeFn | null = null
  private engineReady: Promise<void> | null = null

  constructor(world: HTMLElement, layouts: RoomLayout[], geom: HouseGeom) {
    this.world = world
    this.geom = geom
    this.LREF = lightRef(geom)

    for (const layout of layouts) {
      this.layouts.set(layout.id, layout)

      const img = document.createElement('img')
      img.alt = ROOM_LABEL[layout.id]
      img.draggable = false
      img.dataset.room = layout.id
      img.className = 'module-bake'
      img.style.cssText =
        'position:absolute;left:0;top:0;opacity:0;transition:opacity .35s ease;pointer-events:none;transform-origin:0 0;will-change:transform,opacity;z-index:4'
      this.world.insertBefore(img, world.querySelector('#ripple') ?? null)
      this.bakeEls.set(layout.id, img)

      const canvas = document.createElement('canvas')
      canvas.className = 'module-live'
      canvas.dataset.room = layout.id
      canvas.style.cssText = img.style.cssText
      this.world.insertBefore(canvas, world.querySelector('#ripple') ?? null)
      this.liveCanvas.set(layout.id, canvas)
    }
  }

  private ensureEngine() {
    if (!this.engineReady) {
      this.engineReady = (async () => {
        const { RoomModule, bakeRoomModule } = await import('../bake/lazy')
        this.bakeRoom = bakeRoomModule
        for (const [id, layout] of this.layouts) {
          this.mods.set(id, new RoomModule(layout))
        }
      })()
    }
    return this.engineReady
  }

  bindLayouts(layouts: RoomLayout[]) {
    for (const l of layouts) this.layouts.set(l.id, l)
  }

  trackBunny(getPos: () => Point) {
    this.getBunnyPos = getPos
    if (!this.depthRaf) {
      const tick = () => {
        this.updateDepth()
        this.depthRaf = requestAnimationFrame(tick)
      }
      this.depthRaf = requestAnimationFrame(tick)
    }
  }

  updateDepth(p?: Point) {
    const pos = p ?? this.getBunnyPos?.()
    if (!pos) return
    for (const [id, layout] of this.layouts) {
      const z = pos[1] < layout.frontY - 1 ? Z_FRONT : Z_BEHIND
      const img = this.bakeEls.get(id)
      const live = this.liveCanvas.get(id)
      if (img) img.style.zIndex = String(z)
      if (live) live.style.zIndex = String(z)
    }
  }

  refitAll() {
    for (const mod of this.mods.values()) mod.refit()
    this.cache.clear()
  }

  async applyTiers(save: HouseSave) {
    const needsEngine = ROOM_IDS_FROM_LAYOUTS(this.layouts).some((id) => {
      const layout = this.layouts.get(id)!
      return resolveTier(layout, save.roomTiers[id] ?? 1) > 1
    })

    if (!needsEngine) {
      for (const img of this.bakeEls.values()) img.style.opacity = '0'
      for (const live of this.liveCanvas.values()) live.style.opacity = '0'
      return
    }

    await this.ensureEngine()
    const tasks: Promise<void>[] = []
    for (const [id, mod] of this.mods) {
      const tier = save.roomTiers[id] ?? 1
      mod.rebuild(tier)
      const img = this.bakeEls.get(id)!
      const live = this.liveCanvas.get(id)!
      const resolved = resolveTier(mod.layout, tier)

      if (resolved <= 1) {
        img.style.opacity = '0'
        live.style.opacity = '0'
        continue
      }

      if (save.useLiveThree) {
        img.style.opacity = '0'
        tasks.push(this.drawLive(id, mod, live))
      } else {
        live.style.opacity = '0'
        tasks.push(this.showBake(id, mod, img, resolved, save.bakeRevision))
      }
    }
    await Promise.all(tasks)
    this.updateDepth()
  }

  private placePlate(el: HTMLElement, cssW: number, cssH: number, layout: RoomLayout, mod: RoomModule) {
    el.style.width = `${cssW}px`
    el.style.height = `${cssH}px`
    el.style.left = '0'
    el.style.top = '0'
    const plate = mod.getPlateQuad()
    el.dataset.plate = JSON.stringify(plate)
    el.dataset.art = JSON.stringify(layout.artQuad)
    const matrix = plateToArtMatrix(plate, layout.artQuad)
    el.style.transform = matrix
  }

  private async showBake(
    id: RoomId,
    mod: RoomModule,
    img: HTMLImageElement,
    tier: number,
    rev: number,
  ) {
    const layout = this.getLayout(id)
    const { cssW, cssH } = mod.getCanvasSize()
    const key = `${id}:${tier}:${cssW}x${cssH}:r${rev}`
    let url = this.cache.get(key)
    if (!url) {
      const tint = tintAt(layout.tintAt, this.geom, this.LREF)
      const baked = await this.bakeRoom!(mod, tint)
      url = baked.url
      this.cache.set(key, url)
    }
    this.placePlate(img, cssW, cssH, layout, mod)
    await new Promise<void>((resolve) => {
      if (img.src === url && img.complete) {
        resolve()
        return
      }
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = url!
    })
    img.style.opacity = '1'
  }

  private async drawLive(id: RoomId, mod: RoomModule, canvas: HTMLCanvasElement) {
    const layout = this.getLayout(id)
    const { canvasW, canvasH, cssW, cssH } = mod.getCanvasSize()
    canvas.width = canvasW
    canvas.height = canvasH
    this.placePlate(canvas, cssW, cssH, layout, mod)
    const THREE = await import('three')
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    })
    try {
      renderer.setSize(canvasW, canvasH, false)
      mod.renderTo(renderer, canvasW, canvasH)
      canvas.style.opacity = '1'
    } finally {
      renderer.dispose()
    }
  }

  private getLayout(id: RoomId) {
    const l = this.layouts.get(id)
    if (!l) throw new Error(`layout ${id}`)
    return l
  }
}
