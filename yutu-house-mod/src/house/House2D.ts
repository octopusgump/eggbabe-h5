import type { HouseGeom, Point } from '../types/geom'
import { BH, HOUSE_CY, SMIN, SMAX, VH, VW, WH, WW } from './constants'
import { houseAsset as asset, OCC_IMAGES } from './assets'

type WalkApi = {
  goTo: (wp: Point) => boolean
  st: { p: Point; room: number; walking: boolean }
  cam: { x: number; y: number; s: number }
  world: HTMLElement
}

/** 2D house runtime — ported from yutu-house/src/template.html */
export class House2D {
  readonly G: HouseGeom
  readonly stage: HTMLElement
  readonly world: HTMLElement
  private readonly cam = { x: 0, y: 0, s: 0.55 }
  private readonly st = {
    p: [0, 0] as Point,
    path: [] as Point[],
    seg: 0,
    walking: false,
    face: 1,
    phase: 0,
    follow: true,
    lastDrag: -1e9,
    nextBlink: 2600,
    blinkUntil: 0,
    arriveT: -1e9,
    room: 0,
    roomCb: null as null | ((i: number) => void),
  }
  private NV: [number, number][][] = []
  private NODES: Point[] = []
  private OCC: { o: HouseGeom['occ'][0]; el: HTMLElement }[] = []
  private readonly SPR: Record<'F' | 'C' | 'S', HTMLImageElement>
  private cv!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private bun!: HTMLElement
  private body!: HTMLElement
  private shadow!: HTMLElement
  private LREF = 1
  private chips!: HTMLElement

  constructor(stage: HTMLElement, geom: HouseGeom) {
    this.G = geom
    this.stage = stage
    this.st.p = [...geom.start]
    stage.className = ''
    stage.style.cssText =
      'position:absolute;inset:0;overflow:hidden;background:#2b2412;touch-action:none;cursor:pointer'

    const blur = document.createElement('img')
    blur.id = 'blur'
    blur.src = asset('house_s.webp')
    blur.alt = ''
    blur.style.cssText =
      'position:absolute;left:-40px;top:-40px;width:470px;height:924px;object-fit:cover;filter:blur(18px) brightness(.62) saturate(1.1);pointer-events:none'
    stage.appendChild(blur)

    this.world = document.createElement('div')
    this.world.id = 'world'
    this.world.style.cssText =
      'position:absolute;left:0;top:0;width:864px;height:1152px;transform-origin:0 0;will-change:transform'

    const bg = document.createElement('img')
    bg.className = 'bg'
    bg.src = asset('house.webp')
    bg.alt = ''
    bg.style.cssText =
      'position:absolute;left:0;top:0;width:864px;height:1152px;pointer-events:none;-webkit-mask-image:linear-gradient(transparent 0,#000 90px,#000 1060px,transparent 1152px);mask-image:linear-gradient(transparent 0,#000 90px,#000 1060px,transparent 1152px)'
    this.world.appendChild(bg)

    geom.occ.forEach((o, i) => {
      const el = document.createElement('img')
      el.id = `oc${i}`
      el.className = 'occ'
      el.src = OCC_IMAGES[i]
      let pos = 'position:absolute;pointer-events:none'
      if (o.box) {
        const [x0, y0, x1, y1] = o.box
        pos += `;left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px`
      }
      el.style.cssText = pos
      this.world.appendChild(el)
      this.OCC.push({ o: geom.occ[i], el })
    })

    const rip = document.createElement('div')
    rip.id = 'ripple'
    rip.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:30'
    this.world.appendChild(rip)

    this.bun = document.createElement('div')
    this.bun.id = 'bun'
    this.bun.style.cssText =
      'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:10'
    this.shadow = document.createElement('div')
    this.shadow.id = 'shadow'
    this.shadow.style.cssText =
      'position:absolute;left:-19px;top:-6px;width:38px;height:13px;border-radius:50%;background:radial-gradient(closest-side,rgba(45,24,8,.6),rgba(45,24,8,.28) 60%,rgba(45,24,8,0))'
    this.body = document.createElement('div')
    this.body.id = 'body'
    this.body.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0'
    this.cv = document.createElement('canvas')
    this.cv.id = 'cv'
    this.cv.style.cssText = `position:absolute;bottom:0;height:${BH}px`
    this.body.appendChild(this.cv)
    this.bun.append(this.shadow, this.body)
    this.world.appendChild(this.bun)
    stage.appendChild(this.world)

    const vig = document.createElement('div')
    vig.id = 'vig'
    vig.style.cssText =
      'position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 75% at 50% 50%,rgba(0,0,0,0) 55%,rgba(16,10,2,.5) 100%)'
    stage.appendChild(vig)

    this.SPR = {
      F: mkImg(asset('front.webp')),
      C: mkImg(asset('closed.webp')),
      S: mkImg(asset('side.webp')),
    }
    stage.append(this.SPR.F, this.SPR.C, this.SPR.S)

    this.ctx = this.cv.getContext('2d')!
    this.buildNav()
    this.LREF =
      this.G.rooms.reduce((s, r) => s + luma(light(this.G, r.target[0], r.target[1] - 30)), 0) /
      this.G.rooms.length
    this.st.room = roomOf(this.st.p, this.G)
    this.bindInput(rip)
  }

  mountTopBar(host: HTMLElement) {
    this.chips = document.createElement('div')
    this.chips.id = 'chips'
    this.chips.style.cssText = 'display:flex;gap:6px;margin-top:10px;pointer-events:auto;flex-wrap:wrap'
    host.querySelector('#chips-slot')?.appendChild(this.chips)
    this.G.rooms.forEach((r, i) => {
      const c = document.createElement('div')
      c.className = 'chip'
      c.dataset.roomIndex = String(i)
      c.textContent = r.name
      c.onpointerdown = (e) => e.stopPropagation()
      c.onclick = (e) => {
        e.stopPropagation()
        this.goTo(r.target)
      }
      this.chips.appendChild(c)
    })
    this.setRoomUI(this.st.room)
  }

  onRoomChange(cb: (i: number) => void) {
    this.st.roomCb = cb
  }

  getChip(i: number) {
    return this.chips?.children[i] as HTMLElement | undefined
  }

  setChipLabel(i: number, text: string) {
    const c = this.getChip(i)
    if (c) c.textContent = text
  }

  setRoomUI(i: number) {
    if (!this.chips) return
    ;[...this.chips.children].forEach((c, k) => c.classList.toggle('on', k === i))
  }

  getWalkApi(): WalkApi {
    return {
      goTo: (wp) => this.goTo(wp),
      st: this.st,
      cam: this.cam,
      world: this.world,
    }
  }

  async start() {
    await Promise.all(
      Object.values(this.SPR).map((i) =>
        i.complete ? Promise.resolve() : new Promise<void>((r) => (i.onload = () => r())),
      ),
    )
    this.cam.x = this.st.p[0] * this.cam.s - VW / 2
    clampCam(this.cam)
    this.loop()
  }

  private buildNav() {
    const G = this.G
    const ALL = [G.outer, ...G.obst]
    const NODES: Point[] = []
    ALL.forEach((poly) => poly.forEach((p) => walk(p, G) && NODES.push(p)))
    this.NODES = NODES
    const NV: [number, number][][] = NODES.map(() => [])
    for (let i = 0; i < NODES.length; i++) {
      for (let j = i + 1; j < NODES.length; j++) {
        if (vis(NODES[i], NODES[j], G)) {
          const d = D(NODES[i], NODES[j])
          NV[i].push([j, d])
          NV[j].push([i, d])
        }
      }
    }
    this.NV = NV
  }

  goTo(wp: Point) {
    const q = snap(wp, this.G)
    if (!q) return false
    const path = findPath(this.st.p, q, this.G, this.NODES, this.NV)
    if (!path) return false
    this.st.path = path.filter((v, i, a) => i === 0 || D(v, a[i - 1]) > 0.5)
    this.st.seg = 0
    this.st.walking = this.st.path.length > 1
    this.st.follow = true
    return true
  }

  private bindInput(rip: HTMLElement) {
    const ptrs = new Map<number, Point>()
    let pinch: { d: number; s: number } | null = null
    let down: { s: Point; cx: number; cy: number; moved: boolean } | null = null
    const toStage = (clientX: number, clientY: number) => {
      const r = this.stage.getBoundingClientRect()
      return [(clientX - r.left) * (VW / r.width), (clientY - r.top) * (VH / r.height)] as Point
    }
    const toWorld = (s: Point) => [(s[0] + this.cam.x) / this.cam.s, (s[1] + this.cam.y) / this.cam.s] as Point

    this.stage.addEventListener('pointerdown', (e) => {
      const s = toStage(e.clientX, e.clientY)
      ptrs.set(e.pointerId, s)
      try {
        this.stage.setPointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]
        pinch = { d: D(a, b), s: this.cam.s }
        down = null
        return
      }
      down = { s, cx: this.cam.x, cy: this.cam.y, moved: false }
    })
    this.stage.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return
      const s = toStage(e.clientX, e.clientY)
      ptrs.set(e.pointerId, s)
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()]
        zoomAt(this.cam, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], pinch.s * (D(a, b) / pinch.d))
        this.st.follow = false
        this.st.lastDrag = now()
        return
      }
      if (!down) return
      const dx = s[0] - down.s[0]
      const dy = s[1] - down.s[1]
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) down.moved = true
      if (down.moved) {
        this.cam.x = down.cx - dx
        this.cam.y = down.cy - dy
        clampCam(this.cam)
        this.st.follow = false
        this.st.lastDrag = now()
      }
    })
    const up = (e: PointerEvent) => {
      ptrs.delete(e.pointerId)
      if (pinch) {
        if (ptrs.size < 2) {
          pinch = null
          down = null
        }
        return
      }
      if (!down) return
      const d = down
      down = null
      if (d.moved || e.type === 'pointercancel') return
      this.goTo(toWorld(toStage(e.clientX, e.clientY)))
    }
    this.stage.addEventListener('pointerup', up)
    this.stage.addEventListener('pointercancel', up)
    this.stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        zoomAt(this.cam, toStage(e.clientX, e.clientY), this.cam.s * Math.exp(-e.deltaY * 0.0015))
        this.st.follow = false
        this.st.lastDrag = now()
      },
      { passive: false },
    )
    void rip
  }

  private loop = () => {
    const t = now()
    const SPEED = 110
    const HOP = 0.28
    const dt = Math.min(0.05, (t - this.last) / 1000)
    this.last = t

    if (this.st.walking) {
      let move = SPEED * dt
      while (move > 0 && this.st.seg < this.st.path.length - 1) {
        const a = this.st.p
        const b = this.st.path[this.st.seg + 1]
        const d = D(a, b)
        if (d > 1e-3) {
          const dx = b[0] - a[0]
          if (Math.abs(dx) > 0.25 * d) this.st.face = dx > 0 ? 1 : -1
        }
        if (d <= move) {
          this.st.p = [...b]
          this.st.seg++
          move -= d
        } else {
          this.st.p = [a[0] + ((b[0] - a[0]) * move) / d, a[1] + ((b[1] - a[1]) * move) / d]
          move = 0
        }
      }
      this.st.phase += dt / HOP
      if (this.st.seg >= this.st.path.length - 1) {
        this.st.walking = false
        this.st.arriveT = t
        this.st.phase = 0
      }
      const r = roomOf(this.st.p, this.G)
      if (r >= 0 && r !== this.st.room) {
        this.st.room = r
        this.setRoomUI(r)
        this.st.roomCb?.(r)
      }
    }

    let bob = 0
    let sx = 1
    let sy = 1
    let rot = 0
    let side = false
    if (this.st.walking) {
      const f = this.st.phase % 1
      const h = Math.sin(f * Math.PI)
      bob = -h * 7
      const land = f < 0.12 ? 1 - f / 0.12 : f > 0.9 ? (f - 0.9) / 0.1 : 0
      sy = 1 - 0.07 * land + 0.03 * h
      sx = 1 + 0.06 * land - 0.015 * h
      rot = this.st.face * (2.5 + 1.5 * Math.sin(f * Math.PI * 2))
      side = true
    } else {
      const a = (t - this.st.arriveT) / 1000
      if (a < 0.35) {
        const k = Math.sin((a / 0.35) * Math.PI)
        sy = 1 - 0.08 * k
        sx = 1 + 0.07 * k
        side = a < 0.12
      }
      const br = Math.sin((t / 1000) * 2 * Math.PI * 2.6)
      sy *= 1 + 0.018 * br
      sx *= 1 - 0.008 * br
    }
    if (!this.st.walking && t > this.st.nextBlink) {
      this.st.blinkUntil = t + 140
      this.st.nextBlink = t + 2400 + Math.random() * 2600
    }
    const blink = !this.st.walking && t < this.st.blinkUntil
    drawBunny(
      this.ctx,
      this.cv,
      side ? this.SPR.S : blink ? this.SPR.C : this.SPR.F,
      tintAt(this.st.p, this.G, this.LREF),
    )
    this.body.style.transform = `translateY(${bob}px) rotate(${rot}deg) scale(${sx * (side ? this.st.face : 1)},${sy})`
    this.shadow.style.transform = `scale(${1 + bob / 18})`
    this.bun.style.transform = `translate(${this.st.p[0]}px,${this.st.p[1]}px)`
    for (const { o, el } of this.OCC) {
      el.classList.toggle('front', this.st.p[1] < baseY(o.base, this.st.p[0]) - 1)
    }
    if (this.st.follow && t - this.st.lastDrag > 2500) {
      const k = Math.min(1, dt * 3)
      const ox = this.cam.x
      const oy = this.cam.y
      this.cam.x = this.st.p[0] * this.cam.s - VW / 2
      this.cam.y = (this.st.p[1] - 40) * this.cam.s - VH / 2
      clampCam(this.cam)
      this.cam.x = ox + (this.cam.x - ox) * k
      this.cam.y = oy + (this.cam.y - oy) * k
    }
    this.world.style.transform = `translate(${-this.cam.x}px,${-this.cam.y}px) scale(${this.cam.s})`
    requestAnimationFrame(this.loop)
  }

  private last = performance.now()
}

function mkImg(src: string) {
  const i = document.createElement('img')
  i.hidden = true
  i.src = src
  return i
}

const now = () => performance.now()
const D = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

function inPoly(p: Point, poly: Point[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + b[0])
      c = !c
  }
  return c
}

function distSeg(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)
  t = Math.max(0, Math.min(1, t))
  const q: Point = [a[0] + dx * t, a[1] + dy * t]
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q }
}

function onEdge(p: Point, poly: Point[], e = 0.8) {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (distSeg(p, poly[i], poly[j]).d < e) return true
  }
  return false
}

function walk(p: Point, G: HouseGeom) {
  if (!(inPoly(p, G.outer) || onEdge(p, G.outer))) return false
  for (const o of G.obst) if (inPoly(p, o) && !onEdge(p, o)) return false
  return true
}

function segX(a: Point, b: Point, c: Point, d: Point) {
  const o = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const d1 = o(c, d, a)
  const d2 = o(c, d, b)
  const d3 = o(a, b, c)
  const d4 = o(a, b, d)
  return d1 * d2 < -1e-6 && d3 * d4 < -1e-6
}

function vis(a: Point, b: Point, G: HouseGeom) {
  const ALL = [G.outer, ...G.obst]
  for (const poly of ALL) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if (segX(a, b, poly[i], poly[j])) return false
    }
  }
  const n = Math.max(2, Math.ceil(D(a, b) / 10))
  for (let k = 1; k < n; k++) {
    const t = k / n
    if (!walk([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], G)) return false
  }
  return true
}

function findPath(a: Point, b: Point, G: HouseGeom, NODES: Point[], NV: [number, number][][]) {
  if (vis(a, b, G)) return [a, b]
  const n = NODES.length
  const S = n
  const T = n + 1
  const dist = new Array(n + 2).fill(1e9)
  const prev = new Array(n + 2).fill(-1)
  const done = new Array(n + 2).fill(false)
  const toT = NODES.map((p) => (vis(p, b, G) ? D(p, b) : -1))
  dist[S] = 0
  const adjS: [number, number][] = []
  NODES.forEach((p, i) => {
    if (vis(a, p, G)) adjS.push([i, D(a, p)])
  })
  for (;;) {
    let u = -1
    for (let i = 0; i < n + 2; i++) {
      if (!done[i] && dist[i] < 1e9 && (u < 0 || dist[i] < dist[u])) u = i
    }
    if (u < 0) break
    done[u] = true
    if (u === T) break
    const adj = u === S ? adjS : NV[u]
    for (const [v, d] of adj) {
      if (dist[u] + d < dist[v]) {
        dist[v] = dist[u] + d
        prev[v] = u
      }
    }
    if (u < n && toT[u] >= 0 && dist[u] + toT[u] < dist[T]) {
      dist[T] = dist[u] + toT[u]
      prev[T] = u
    }
  }
  if (prev[T] < 0) return null
  const out: Point[] = []
  for (let v = T; v !== -1; v = prev[v]) {
    out.unshift(v === S ? a : v === T ? b : NODES[v])
  }
  return out
}

function snap(wp: Point, G: HouseGeom) {
  if (walk(wp, G)) return wp
  let best: { q: Point; d: number } | null = null
  for (let r = 3; r <= 42; r += 3) {
    for (let k = 0; k < 24; k++) {
      const an = (k / 24) * Math.PI * 2
      const q: Point = [wp[0] + Math.cos(an) * r, wp[1] + Math.sin(an) * r * 0.8]
      if (walk(q, G)) {
        const d = D(wp, q)
        if (!best || d < best.d) best = { q, d }
      }
    }
  }
  return best ? best.q : null
}

function roomOf(p: Point, G: HouseGeom) {
  for (let i = 0; i < G.rooms.length; i++) if (inPoly(p, G.rooms[i].poly)) return i
  return -1
}

function baseY(base: Point[], x: number) {
  if (x <= base[0][0]) return base[0][1]
  for (let i = 0; i < base.length - 1; i++) {
    const a = base[i]
    const b = base[i + 1]
    if (x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])
  }
  return base[base.length - 1][1]
}

function light(G: HouseGeom, x: number, y: number) {
  const L = G.light
  const fx = Math.max(0, Math.min(L.w - 1.001, x / L.cell - 0.5))
  const fy = Math.max(0, Math.min(L.h - 1.001, y / L.cell - 0.5))
  const x0 = fx | 0
  const y0 = fy | 0
  const tx = fx - x0
  const ty = fy - y0
  const c = [0, 0, 0]
  for (let k = 0; k < 3; k++) {
    const a = L.rgb[y0][x0][k]
    const b = L.rgb[y0][x0 + 1][k]
    const c2 = L.rgb[y0 + 1][x0][k]
    const d = L.rgb[y0 + 1][x0 + 1][k]
    c[k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c2 * (1 - tx) + d * tx) * ty
  }
  return c
}

const luma = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]

function tintAt(p: Point, G: HouseGeom, LREF: number) {
  const c = light(G, p[0], p[1] - 34)
  const l = luma(c)
  const k = Math.max(0.74, Math.min(1.0, 0.9 * Math.pow(l / LREF, 0.55)))
  const m = Math.max(c[0], c[1], c[2])
  const t = c.map((v) => Math.round(255 * k * (0.6 + (0.4 * v) / m)))
  return `rgb(${t[0]},${t[1]},${t[2]})`
}

const RES = 3
let curSpr = ''
let curTint = ''

function drawBunny(
  ctx: CanvasRenderingContext2D,
  cv: HTMLCanvasElement,
  spr: HTMLImageElement,
  tint: string,
) {
  const key = spr.id + tint
  if (key === curSpr + curTint) return
  curSpr = spr.id
  curTint = tint
  const h = BH * RES
  const w = Math.round((spr.naturalWidth * h) / spr.naturalHeight)
  if (cv.width !== w || cv.height !== h) {
    cv.width = w
    cv.height = h
  }
  cv.style.height = `${BH}px`
  cv.style.width = `${w / RES}px`
  cv.style.left = `${-w / RES / 2}px`
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(spr, 0, 0, w, h)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(spr, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
}

function clampCam(cam: { x: number; y: number; s: number }) {
  const w = WW * cam.s
  const h = WH * cam.s
  cam.x = w <= VW ? -(VW - w) / 2 : Math.max(0, Math.min(w - VW, cam.x))
  cam.y = h <= VH ? HOUSE_CY * cam.s - VH / 2 - 8 : Math.max(0, Math.min(h - VH, cam.y))
}

function zoomAt(cam: { x: number; y: number; s: number }, s: Point, ns: number) {
  ns = Math.max(SMIN, Math.min(SMAX, ns))
  const w = [(s[0] + cam.x) / cam.s, (s[1] + cam.y) / cam.s] as Point
  cam.s = ns
  cam.x = w[0] * ns - s[0]
  cam.y = w[1] * ns - s[1]
  clampCam(cam)
}