import type { HouseSave } from '../types/houseSave'
import type { RoomLayout } from '../modules/tierCatalog'
import { ROOM_LABEL, type RoomId } from '../modules/roomIds'
import { RoomModule } from '../modules/RoomModule'
import { bakeRoomModule } from '../bake/bakeRoom'
import { resolveTier } from '../modules/tierCatalog'

export class ModuleLayers {
  private readonly root: HTMLElement
  private readonly bakeEls = new Map<RoomId, HTMLImageElement>()
  private readonly liveCanvas = new Map<RoomId, HTMLCanvasElement>()
  private mods = new Map<RoomId, RoomModule>()
  private cache = new Map<string, string>()

  constructor(world: HTMLElement, layouts: RoomLayout[]) {
    this.root = document.createElement('div')
    this.root.id = 'module-bakes'
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2'
    world.insertBefore(this.root, world.querySelector('#ripple') ?? null)

    for (const layout of layouts) {
      const img = document.createElement('img')
      img.alt = ROOM_LABEL[layout.id]
      img.draggable = false
      img.style.cssText =
        'position:absolute;object-fit:fill;opacity:0;transition:opacity .35s ease'
      this.positionEl(img, layout)
      this.root.appendChild(img)
      this.bakeEls.set(layout.id, img)

      const canvas = document.createElement('canvas')
      canvas.style.cssText = img.style.cssText
      canvas.className = 'module-live'
      this.positionEl(canvas, layout)
      this.root.appendChild(canvas)
      this.liveCanvas.set(layout.id, canvas)

      const mod = new RoomModule(layout)
      this.mods.set(layout.id, mod)
    }
  }

  private positionEl(el: HTMLElement, layout: RoomLayout) {
    const { x, y, w, h } = layout.aabb
    const { dx, dy } = layout.align
    el.style.left = `${x + dx}px`
    el.style.top = `${y + dy}px`
    el.style.width = `${w - dx * 2}px`
    el.style.height = `${h - dy * 2}px`
  }

  async applyTiers(save: HouseSave) {
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
        live.style.opacity = '0.92'
        tasks.push(this.drawLive(id, mod, live))
      } else {
        live.style.opacity = '0'
        tasks.push(this.showBake(id, mod, img, resolved, save.bakeRevision))
      }
    }
    await Promise.all(tasks)
  }

  private layouts = new Map<RoomId, RoomLayout>()

  bindLayouts(layouts: RoomLayout[]) {
    for (const l of layouts) this.layouts.set(l.id, l)
  }

  private getLayout(id: RoomId) {
    const l = this.layouts.get(id)
    if (!l) throw new Error(`layout ${id}`)
    return l
  }

  private async showBake(
    id: RoomId,
    mod: RoomModule,
    img: HTMLImageElement,
    tier: number,
    rev: number,
  ) {
    const layout = this.getLayout(id)
    const w = Math.max(64, Math.round(layout.aabb.w - layout.align.dx * 2))
    const h = Math.max(64, Math.round(layout.aabb.h - layout.align.dy * 2))
    const key = `${id}:${tier}:${w}:${h}:r${rev}`
    let url = this.cache.get(key)
    if (!url) {
      url = await bakeRoomModule(mod, w, h)
      this.cache.set(key, url)
    }
    img.src = url
    img.style.opacity = '0.92'
  }

  private async drawLive(id: RoomId, mod: RoomModule, canvas: HTMLCanvasElement) {
    const layout = this.getLayout(id)
    const w = Math.max(64, Math.round(layout.aabb.w - layout.align.dx * 2))
    const h = Math.max(64, Math.round(layout.aabb.h - layout.align.dy * 2))
    canvas.width = w
    canvas.height = h
    const THREE = await import('three')
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    })
    renderer.setSize(w, h, false)
    mod.renderTo(renderer, w, h)
  }
}