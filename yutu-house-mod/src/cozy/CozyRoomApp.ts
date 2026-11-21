import {
  BUNNY_SPRITES,
  COZY_ACCESSORIES,
  COZY_ACTIONS,
  COZY_ROOMS,
  type CozyActionDef,
  type CozyRoomId,
} from './catalog'
import { sound } from '../shared/sound'
import { VW, VH } from '../house/constants'

import type { CozyRoom25D } from './CozyRoom25D'

type Theme = 'day' | 'night'
type DrawerTab = 'rooms' | 'acc' | 'actions'
type ViewMode = 'close' | '25d'

type CozySave = {
  room: CozyRoomId
  head: string | null
  neck: string | null
  theme: Theme
  muted: boolean
  mode: ViewMode
}

const SAVE_KEY = 'yutu-cozy-room-save-v1'

function loadSave(): CozySave {
  const def: CozySave = {
    room: 'living',
    head: null,
    neck: null,
    theme: 'day',
    muted: false,
    mode: 'close',
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return def
    const parsed = JSON.parse(raw) as Partial<CozySave>
    return {
      room: COZY_ROOMS.some((r) => r.id === parsed.room) ? (parsed.room as CozyRoomId) : def.room,
      head: typeof parsed.head === 'string' ? parsed.head : null,
      neck: typeof parsed.neck === 'string' ? parsed.neck : null,
      theme: parsed.theme === 'night' ? 'night' : 'day',
      muted: Boolean(parsed.muted),
      mode: parsed.mode === '25d' ? '25d' : 'close',
    }
  } catch {
    return def
  }
}

function writeSave(s: CozySave) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(s))
}

const PET_LINES = [
  '嘿嘿，耳朵痒痒的~',
  '最喜欢被摸头啦 ♥',
  '毛绒绒贴贴好暖和',
  '再多陪我呆一会儿嘛',
]

const IDLE_LINES = [
  '窗边的阳光好温柔呀 ☀️',
  '点点地板我可以走过去哦',
  '试试给我换个小帽子吧~',
  '今天也是慢悠悠的一天',
]

export class CozyRoomApp {
  private save: CozySave
  private tab: DrawerTab = 'rooms'
  private drawerCollapsed = false
  private room25d: CozyRoom25D | null = null
  private room25dHost!: HTMLElement
  private modeSwitchEl!: HTMLElement
  private modeToastEl!: HTMLElement
  private modeToastTimer = 0

  // Bunny kinematic & emote state
  private bx = 50 // % of scene width (24..76)
  private targetX = 50
  private walkPhase = 0
  private walking = false
  private emote: { kind: 'pet' | 'nap' | 'happy' | 'sway'; start: number; end: number } | null = null
  private nextBlink = performance.now() + 2600
  private blinkUntil = 0
  private lastUserAt = performance.now()
  private nextIdleAt = performance.now() + 9000
  private lastT = performance.now()

  // DOM refs
  private frame!: HTMLElement
  private sceneEl!: HTMLElement
  private bgImg!: HTMLImageElement
  private nightTint!: HTMLElement
  private lampHalo!: HTMLElement
  private steamHost!: HTMLElement
  private fxHost!: HTMLElement
  private bunnyWrap!: HTMLElement
  private bunnyBody!: HTMLElement
  private bunnyImg!: HTMLImageElement
  private headImg!: HTMLImageElement
  private neckImg!: HTMLImageElement
  private bunnyShadow!: HTMLElement
  private bubbleEl!: HTMLElement
  private drawerEl!: HTMLElement
  private gridEl!: HTMLElement
  private tabsEl!: HTMLElement
  private hudTop!: HTMLElement
  private photoExitBtn!: HTMLButtonElement
  private bubbleTimer = 0
  private curSprite = ''

  constructor(private readonly root: HTMLElement) {
    this.save = loadSave()
    const q = new URLSearchParams(location.search)
    const r = q.get('room')
    if (r && COZY_ROOMS.some((x) => x.id === r)) {
      this.save.room = r as CozyRoomId
    }
    const th = q.get('theme')
    if (th === 'night' || th === 'day') {
      this.save.theme = th
    }
    const m = q.get('mode')
    if (m === '25d' || m === 'close') {
      this.save.mode = m
    }
    sound.setMuted(this.save.muted)
  }

  mount() {
    this.root.innerHTML = ''
    this.frame = document.createElement('div')
    this.frame.id = 'cozy-frame'
    this.root.appendChild(this.frame)

    // ── Upper photorealistic room stage ──
    this.sceneEl = document.createElement('div')
    this.sceneEl.id = 'cozy-scene'
    this.frame.appendChild(this.sceneEl)

    this.bgImg = document.createElement('img')
    this.bgImg.id = 'room-bg'
    this.bgImg.alt = ''
    this.bgImg.draggable = false
    this.sceneEl.appendChild(this.bgImg)

    this.nightTint = document.createElement('div')
    this.nightTint.id = 'night-tint'
    this.sceneEl.appendChild(this.nightTint)

    this.lampHalo = document.createElement('div')
    this.lampHalo.id = 'lamp-halo'
    this.sceneEl.appendChild(this.lampHalo)

    this.steamHost = document.createElement('div')
    this.steamHost.id = 'steam-host'
    this.sceneEl.appendChild(this.steamHost)

    // Sunlit gentle dust motes
    const motes = document.createElement('div')
    motes.id = 'sun-motes'
    ;[
      [18, 22, 0],
      [28, 36, 1.4],
      [22, 48, 2.7],
      [36, 28, 0.8],
      [44, 42, 2.1],
    ].forEach(([x, y, delay]) => {
      const m = document.createElement('div')
      m.className = 'mote'
      m.style.left = `${x}%`
      m.style.top = `${y}%`
      m.style.animationDelay = `${delay}s`
      motes.appendChild(m)
    })
    this.sceneEl.appendChild(motes)

    // Plush Yutu hero rig
    this.bunnyWrap = document.createElement('div')
    this.bunnyWrap.id = 'bunny-wrap'

    this.bunnyShadow = document.createElement('div')
    this.bunnyShadow.id = 'bunny-shadow'

    this.bunnyBody = document.createElement('div')
    this.bunnyBody.id = 'bunny-body'

    this.bunnyImg = document.createElement('img')
    this.bunnyImg.className = 'bunny-layer'
    this.bunnyImg.alt = '玉兔'
    this.bunnyImg.draggable = false

    this.neckImg = document.createElement('img')
    this.neckImg.className = 'bunny-layer acc-layer'
    this.neckImg.alt = ''
    this.neckImg.draggable = false
    this.neckImg.hidden = true

    this.headImg = document.createElement('img')
    this.headImg.className = 'bunny-layer acc-layer'
    this.headImg.alt = ''
    this.headImg.draggable = false
    this.headImg.hidden = true

    this.bunnyBody.append(this.bunnyImg, this.neckImg, this.headImg)

    this.bubbleEl = document.createElement('div')
    this.bubbleEl.id = 'bunny-bubble'

    this.bunnyWrap.append(this.bunnyShadow, this.bunnyBody, this.bubbleEl)
    this.sceneEl.appendChild(this.bunnyWrap)

    // Pure-code 2.5D miniature room container (lazy-initialized on demand)
    this.room25dHost = document.createElement('div')
    this.room25dHost.id = 'room25d-host'
    this.room25dHost.hidden = true
    this.sceneEl.appendChild(this.room25dHost)

    this.fxHost = document.createElement('div')
    this.fxHost.id = 'fx-host'
    this.sceneEl.appendChild(this.fxHost)

    // Floating speech / status pill for 2.5D mode
    this.modeToastEl = document.createElement('div')
    this.modeToastEl.id = 'mode-toast'
    this.sceneEl.appendChild(this.modeToastEl)

    // Minimal floating top controls with Close-up | 2.5D pill switch
    this.hudTop = document.createElement('div')
    this.hudTop.id = 'hud-top'
    this.hudTop.innerHTML = `
      <div id="mode-switch" role="tablist">
        <button class="mode-btn on" data-mode="close" type="button">近景</button>
        <button class="mode-btn" data-mode="25d" type="button">2.5D</button>
      </div>
      <div class="top-btns">
        <button id="btn-theme" class="top-btn" type="button" title="晴朗午后 / 暖灯星夜">${this.save.theme === 'night' ? '🌙' : '☀️'}</button>
        <button id="btn-mute" class="top-btn" type="button" title="音效">${this.save.muted ? '🔇' : '🔊'}</button>
        <button id="btn-photo" class="top-btn" type="button" title="拍照纯享">📷</button>
      </div>
    `
    this.sceneEl.appendChild(this.hudTop)
    this.modeSwitchEl = this.hudTop.querySelector('#mode-switch') as HTMLElement

    this.modeSwitchEl.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation()
        const m = btn.dataset.mode as ViewMode
        if (m === this.save.mode) return
        sound.toggle()
        this.save.mode = m
        writeSave(this.save)
        void this.applyMode(true)
      }
    })

    const themeBtn = this.hudTop.querySelector('#btn-theme') as HTMLButtonElement
    themeBtn.onclick = (e) => {
      e.stopPropagation()
      sound.toggle()
      this.save.theme = this.save.theme === 'day' ? 'night' : 'day'
      writeSave(this.save)
      this.applyTheme()
      themeBtn.textContent = this.save.theme === 'night' ? '🌙' : '☀️'
      this.say(this.save.theme === 'night' ? '暖灯点亮啦，晚安好梦 🌙' : '拉开窗帘，晒晒暖阳 ☀️', 2200)
    }

    const muteBtn = this.hudTop.querySelector('#btn-mute') as HTMLButtonElement
    muteBtn.onclick = (e) => {
      e.stopPropagation()
      this.save.muted = !this.save.muted
      sound.setMuted(this.save.muted)
      writeSave(this.save)
      muteBtn.textContent = this.save.muted ? '🔇' : '🔊'
      if (!this.save.muted) sound.toggle()
    }

    const photoBtn = this.hudTop.querySelector('#btn-photo') as HTMLButtonElement
    photoBtn.onclick = (e) => {
      e.stopPropagation()
      sound.toggle()
      this.setPhotoMode(true)
    }

    // Photo exit pill
    this.photoExitBtn = document.createElement('button')
    this.photoExitBtn.id = 'photo-exit'
    this.photoExitBtn.type = 'button'
    this.photoExitBtn.textContent = '退出拍照'
    this.photoExitBtn.hidden = true
    this.photoExitBtn.onclick = (e) => {
      e.stopPropagation()
      sound.toggle()
      this.setPhotoMode(false)
    }
    this.frame.appendChild(this.photoExitBtn)

    // ── Lower IMG_4791-style cream drawer ──
    this.drawerEl = document.createElement('div')
    this.drawerEl.id = 'cozy-drawer'
    this.drawerEl.innerHTML = `
      <button id="drawer-handle" type="button" aria-label="展开或收起面板"><span></span></button>
      <div id="drawer-tabs">
        <button class="tab-btn on" data-tab="rooms" type="button">房间 (${COZY_ROOMS.length})</button>
        <button class="tab-btn" data-tab="acc" type="button">配饰 (${COZY_ACCESSORIES.length})</button>
        <button class="tab-btn" data-tab="actions" type="button">互动 (${COZY_ACTIONS.length})</button>
      </div>
      <div id="drawer-grid"></div>
    `
    this.frame.appendChild(this.drawerEl)
    this.tabsEl = this.drawerEl.querySelector('#drawer-tabs') as HTMLElement
    this.gridEl = this.drawerEl.querySelector('#drawer-grid') as HTMLElement

    const handleBtn = this.drawerEl.querySelector('#drawer-handle') as HTMLButtonElement
    handleBtn.onclick = () => {
      sound.toggle()
      this.drawerCollapsed = !this.drawerCollapsed
      this.frame.classList.toggle('collapsed', this.drawerCollapsed)
      setTimeout(() => this.room25d?.resize(), 360)
    }

    this.tabsEl.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
      btn.onclick = () => {
        sound.toggle()
        const t = btn.dataset.tab as DrawerTab
        if (this.drawerCollapsed) {
          this.drawerCollapsed = false
          this.frame.classList.remove('collapsed')
        }
        this.tab = t
        this.tabsEl.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('on', b === btn))
        this.renderGrid()
      }
    })

    // Stage interactions: tap bunny to pet, tap floor to stroll
    this.bunnyBody.addEventListener('click', (e) => {
      e.stopPropagation()
      this.noteUser()
      this.petBunny()
    })

    this.sceneEl.addEventListener('click', (e) => {
      if (this.save.mode === '25d') return
      this.noteUser()
      const rect = this.sceneEl.getBoundingClientRect()
      const pctX = ((e.clientX - rect.left) / rect.width) * 100
      const pctY = ((e.clientY - rect.top) / rect.height) * 100
      if (pctY < 35) return
      const clamped = Math.max(22, Math.min(78, pctX))
      this.walkTo(clamped)
      this.spawnRipple(pctX, pctY)
      sound.tap()
    })

    // Preload bunny sprites
    Object.values(BUNNY_SPRITES).forEach((src) => {
      const i = new Image()
      i.src = src
    })

    this.applyRoom(false)
    this.applyAccessories()
    this.applyTheme()
    this.renderGrid()
    this.setSprite(BUNNY_SPRITES.base)
    void this.applyMode(false)
    setTimeout(() => this.say('欢迎来到我的奶油小屋 ✨', 2600), 650)

    this.loop()
  }

  private async applyMode(announce: boolean) {
    const is25d = this.save.mode === '25d'
    this.frame.classList.toggle('mode-25d', is25d)
    this.modeSwitchEl.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === this.save.mode)
    })

    if (is25d) {
      this.room25dHost.hidden = false
      if (!this.room25d) {
        const { CozyRoom25D } = await import('./CozyRoom25D')
        this.room25d = new CozyRoom25D(this.room25dHost, {
          onPet: () => {
            this.noteUser()
            sound.pet()
            this.burst('heart', 10)
            const line = PET_LINES[Math.floor(Math.random() * PET_LINES.length)]
            this.say(line, 2200)
          },
          onFloorTap: (px, py) => {
            this.noteUser()
            this.spawnRipple(px, py)
            sound.tap()
          },
        })
      }
      this.room25d.setRoom(this.save.room)
      this.room25d.setAccessories(this.save.head, this.save.neck)
      this.room25d.setTheme(this.save.theme)
      this.room25d.setActive(true)
      if (announce) this.say('点地板自由走动 · 左右拖拽可旋转 2.5D 小屋 ✨', 2600)
    } else {
      this.room25d?.setActive(false)
      this.room25dHost.hidden = true
      if (announce) this.say('已切回实拍近景模式 ✨', 1800)
    }
  }

  private noteUser() {
    this.lastUserAt = performance.now()
    this.nextIdleAt = this.lastUserAt + 9500
  }

  private setPhotoMode(on: boolean) {
    this.frame.classList.toggle('photo-mode', on)
    this.hudTop.hidden = on
    this.drawerEl.hidden = on
    this.photoExitBtn.hidden = !on
    setTimeout(() => this.room25d?.resize(), 360)
  }

  private applyRoom(announce: boolean) {
    const def = COZY_ROOMS.find((r) => r.id === this.save.room) ?? COZY_ROOMS[0]
    this.bgImg.classList.add('fade')
    const next = new Image()
    next.onload = () => {
      this.bgImg.src = def.bg
      this.bgImg.classList.remove('fade')
    }
    next.src = def.bg
    if (!this.bgImg.src) this.bgImg.src = def.bg

    this.room25d?.setRoom(this.save.room)

    // Warm night lamp halo position
    if (def.lamp) {
      this.lampHalo.style.left = `${def.lamp.x}%`
      this.lampHalo.style.top = `${def.lamp.y}%`
      this.lampHalo.style.width = `${def.lamp.size}px`
      this.lampHalo.style.height = `${def.lamp.size}px`
    }

    // Coffee steam wisps
    this.steamHost.innerHTML = ''
    if (def.steam) {
      for (let i = 0; i < 3; i++) {
        const w = document.createElement('div')
        w.className = 'steam'
        w.style.left = `${def.steam.x + (i - 1) * 3}%`
        w.style.top = `${def.steam.y}%`
        w.style.animationDelay = `${i * 1.1}s`
        this.steamHost.appendChild(w)
      }
    }

    if (announce) {
      this.say(def.line, 2600)
      this.burst('sparkle', 8)
    }
  }

  private applyAccessories() {
    const headDef = COZY_ACCESSORIES.find((a) => a.id === this.save.head)
    const neckDef = COZY_ACCESSORIES.find((a) => a.id === this.save.neck)
    if (headDef) {
      this.headImg.src = headDef.layer
      this.headImg.hidden = false
    } else {
      this.headImg.hidden = true
    }
    if (neckDef) {
      this.neckImg.src = neckDef.layer
      this.neckImg.hidden = false
    } else {
      this.neckImg.hidden = true
    }
    this.room25d?.setAccessories(this.save.head, this.save.neck)
  }

  private applyTheme() {
    this.frame.classList.toggle('night', this.save.theme === 'night')
    this.room25d?.setTheme(this.save.theme)
  }

  private renderGrid() {
    this.gridEl.innerHTML = ''

    if (this.tab === 'rooms') {
      for (const room of COZY_ROOMS) {
        const active = this.save.room === room.id
        const card = document.createElement('button')
        card.type = 'button'
        card.className = `item-card${active ? ' active' : ''}`
        card.innerHTML = `
          <div class="card-thumb room-thumb">
            <img src="${room.thumb}" alt="${room.name}" draggable="false" />
            ${active ? '<span class="check-badge">✓</span>' : ''}
          </div>
          <div class="card-name">${room.name}</div>
          <div class="card-sub">${room.subtitle}</div>
        `
        card.onclick = () => {
          this.noteUser()
          if (this.save.room === room.id) return
          sound.upgrade()
          this.save.room = room.id
          writeSave(this.save)
          this.applyRoom(true)
          this.renderGrid()
        }
        this.gridEl.appendChild(card)
      }
      return
    }

    if (this.tab === 'acc') {
      for (const acc of COZY_ACCESSORIES) {
        const active = this.save[acc.slot] === acc.id
        const card = document.createElement('button')
        card.type = 'button'
        card.className = `item-card${active ? ' active' : ''}`
        card.innerHTML = `
          <div class="card-thumb acc-thumb">
            <img src="${acc.thumb}" alt="${acc.name}" draggable="false" />
            ${active ? '<span class="check-badge">✓</span>' : ''}
          </div>
          <div class="card-name">${acc.name}</div>
          <div class="card-sub">${acc.slot === 'head' ? '头饰' : '颈饰'}</div>
        `
        card.onclick = () => {
          this.noteUser()
          sound.interact()
          this.save[acc.slot] = active ? null : acc.id
          writeSave(this.save)
          this.applyAccessories()
          this.playEmote('happy', 900)
          if (!active) {
            this.burst('sparkle', 8)
            this.say(`戴上${acc.name}好看吗 ✨`, 2100)
          }
          this.renderGrid()
        }
        this.gridEl.appendChild(card)
      }
      return
    }

    // Actions tab
    for (const act of COZY_ACTIONS) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'item-card'
      card.innerHTML = `
        <div class="card-thumb action-thumb">
          <span class="action-emoji">${act.icon}</span>
        </div>
        <div class="card-name">${act.name}</div>
        <div class="card-sub">治愈互动</div>
      `
      card.onclick = () => {
        this.noteUser()
        this.triggerAction(act)
      }
      this.gridEl.appendChild(card)
    }
  }

  private triggerAction(act: CozyActionDef) {
    if (act.id === 'pet') sound.pet()
    else sound.interact()
    this.walking = false
    this.playEmote(act.emote, act.durationMs)
    this.say(act.line, act.durationMs + 300)
    this.burst(act.particle, 10)
  }

  private petBunny() {
    sound.pet()
    this.walking = false
    this.playEmote('pet', 1100)
    this.burst('heart', 10)
    const line = PET_LINES[Math.floor(Math.random() * PET_LINES.length)]
    this.say(line, 2200)
  }

  private walkTo(pctX: number) {
    this.emote = null
    this.targetX = pctX
    this.walking = Math.abs(pctX - this.bx) > 1.2
  }

  private playEmote(kind: 'pet' | 'nap' | 'happy' | 'sway', durationMs: number) {
    const t = performance.now()
    this.emote = { kind, start: t, end: t + durationMs }
    this.room25d?.playEmote(kind, durationMs)
  }

  private say(text: string, durationMs = 2400) {
    if (this.save.mode === '25d') {
      this.modeToastEl.textContent = text
      this.modeToastEl.classList.add('on')
      clearTimeout(this.modeToastTimer)
      this.modeToastTimer = window.setTimeout(() => {
        this.modeToastEl.classList.remove('on')
      }, durationMs)
      return
    }
    this.bubbleEl.textContent = text
    this.bubbleEl.classList.add('on')
    clearTimeout(this.bubbleTimer)
    this.bubbleTimer = window.setTimeout(() => {
      this.bubbleEl.classList.remove('on')
    }, durationMs)
  }

  private spawnRipple(pctX: number, pctY: number) {
    const el = document.createElement('div')
    el.className = 'floor-ripple'
    el.style.left = `${pctX}%`
    el.style.top = `${pctY}%`
    this.fxHost.appendChild(el)
    setTimeout(() => el.remove(), 600)
  }

  private burst(kind: 'heart' | 'sparkle' | 'note' | 'zzz', count = 9) {
    const map: Record<typeof kind, { glyphs: string[]; colors: string[] }> = {
      heart: { glyphs: ['♥', '♡'], colors: ['#ff8ba7', '#ffb3c6'] },
      sparkle: { glyphs: ['✦', '✧', '★'], colors: ['#f4c66a', '#ffe8a8', '#e6a85c'] },
      note: { glyphs: ['♪', '♫'], colors: ['#e5a45c', '#f29cb8', '#89c49e'] },
      zzz: { glyphs: ['Z', 'z', '✦'], colors: ['#c2925e', '#e3c08d'] },
    }
    const cfg = map[kind]
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div')
      el.className = 'cozy-particle'
      el.textContent = cfg.glyphs[i % cfg.glyphs.length]
      el.style.color = cfg.colors[i % cfg.colors.length]
      el.style.left = `${this.bx + (Math.random() - 0.5) * 16}%`
      el.style.top = `${52 + (Math.random() - 0.5) * 14}%`
      const dx = (Math.random() - 0.5) * 90
      const dy = -40 - Math.random() * 65
      el.style.setProperty('--dx', `${dx.toFixed(1)}px`)
      el.style.setProperty('--dy', `${dy.toFixed(1)}px`)
      el.style.fontSize = `${14 + Math.random() * 9}px`
      el.style.animationDelay = `${(Math.random() * 0.18).toFixed(2)}s`
      this.fxHost.appendChild(el)
      setTimeout(() => el.remove(), 1150)
    }
  }

  private setSprite(src: string) {
    if (this.curSprite === src) return
    this.curSprite = src
    this.bunnyImg.src = src
  }

  private loop = () => {
    const t = performance.now()
    const dt = Math.min(0.05, (t - this.lastT) / 1000)
    this.lastT = t

    // Gentle autonomous idle behavior
    if (!this.walking && !this.emote && t >= this.nextIdleAt) {
      if (Math.random() < 0.45) {
        this.playEmote('nap', 3200)
        this.burst('zzz', 4)
        this.say('有点困困的，眯一会儿 💤', 2400)
      } else {
        const nextX = 28 + Math.random() * 44
        this.walkTo(nextX)
        if (Math.random() < 0.55) {
          this.say(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)], 2200)
        }
      }
      this.nextIdleAt = t + 10000 + Math.random() * 5000
    }

    let bob = 0
    let sx = 1
    let sy = 1
    let rot = 0
    let sprite = BUNNY_SPRITES.base

    if (this.walking) {
      const diff = this.targetX - this.bx
      const speed = 26 // % per second
      const step = speed * dt
      if (Math.abs(diff) <= step) {
        this.bx = this.targetX
        this.walking = false
        this.walkPhase = 0
      } else {
        this.bx += Math.sign(diff) * step
        this.walkPhase += dt * 3.6
        const f = this.walkPhase % 1
        const h = Math.sin(f * Math.PI)
        bob = -h * 14
        sy = 1 + 0.04 * h - 0.03 * (1 - h)
        sx = 1 - 0.025 * h + 0.025 * (1 - h)
        rot = Math.sign(diff) * Math.sin(f * Math.PI * 2) * 3.5
      }
    } else if (this.emote && t < this.emote.end) {
      const e = this.emote
      const u = (t - e.start) / (e.end - e.start)
      if (e.kind === 'pet') {
        const sq = Math.sin(u * Math.PI * 2.5) * (1 - u)
        sy = 1 - 0.1 * sq
        sx = 1 + 0.09 * sq
        bob = -Math.max(0, Math.sin(u * Math.PI)) * 6
        sprite = BUNNY_SPRITES.closed
      } else if (e.kind === 'nap') {
        const br = Math.sin((t / 1000) * 1.9)
        sy = 1 + 0.022 * br
        sx = 1 - 0.012 * br
        rot = Math.sin((t / 1000) * 1.1) * 2.4
        sprite = BUNNY_SPRITES.doze
      } else if (e.kind === 'happy') {
        const hop = Math.abs(Math.sin(u * Math.PI * 3))
        bob = -hop * 18
        sy = 1 + 0.05 * hop
        sx = 1 - 0.035 * hop
        rot = Math.sin(u * Math.PI * 6) * 3.5
        sprite = hop > 0.45 ? BUNNY_SPRITES.closed : BUNNY_SPRITES.base
      } else {
        const sway = Math.sin(u * Math.PI * 4)
        rot = sway * 4
        bob = -Math.abs(sway) * 5
        sprite = Math.sin(u * Math.PI * 2) > 0.25 ? BUNNY_SPRITES.closed : BUNNY_SPRITES.base
      }
    } else {
      if (this.emote && t >= this.emote.end) this.emote = null
      const br = Math.sin((t / 1000) * 2.4)
      sy = 1 + 0.014 * br
      sx = 1 - 0.007 * br
      if (t > this.nextBlink) {
        this.blinkUntil = t + 140
        this.nextBlink = t + 2600 + Math.random() * 2600
      }
      if (t < this.blinkUntil) sprite = BUNNY_SPRITES.closed
    }

    this.setSprite(sprite)
    this.bunnyWrap.style.left = `${this.bx}%`
    this.bunnyBody.style.transform = `translateY(${bob.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
    this.bunnyShadow.style.transform = `translateX(-50%) scale(${Math.max(0.7, 1 + bob / 45).toFixed(3)})`

    requestAnimationFrame(this.loop)
  }

  static fit() {
    const pad = 16
    const k = Math.min((innerWidth - pad) / VW, (innerHeight - pad) / VH, 1.15)
    const fit = document.getElementById('fit')
    if (fit) fit.style.transform = `translate(-50%,-50%) scale(${k})`
  }
}
