import type { HouseGeom } from './types/geom'
import { BAKE_REVISION, loadSave, writeSave, type HouseSave } from './types/houseSave'
import { House2D } from './house/House2D'
import { ModuleLayers } from './house/ModuleLayers'
import { buildRoomLayouts } from './modules/tierCatalog'
import { MAX_TIER, ROOM_GEOM_INDEX, ROOM_IDS, ROOM_LABEL, type RoomId } from './modules/roomIds'
import { VW, VH } from './house/constants'

export class HouseApp {
  private save: HouseSave
  private house!: House2D
  private modules!: ModuleLayers
  private layouts!: ReturnType<typeof buildRoomLayouts>
  private panelRoom: RoomId | null = null

  constructor(
    private readonly stageRoot: HTMLElement,
    private readonly geom: HouseGeom,
  ) {
    this.save = loadSave()
    this.layouts = buildRoomLayouts(geom)
  }

  mount() {
    this.house = new House2D(this.stageRoot, this.geom)
    this.modules = new ModuleLayers(this.house.world, this.layouts)
    this.modules.bindLayouts(this.layouts)

    const top = document.createElement('div')
    top.id = 'top'
    top.innerHTML =
      '<div id="title">玉兔的小屋</div><div id="chips-slot"></div><button id="upgrade" type="button" hidden>升级房间</button>'
    this.stageRoot.appendChild(top)
    const upgradeBtn = top.querySelector('#upgrade') as HTMLButtonElement
    upgradeBtn.id = 'upgrade'

    this.house.mountTopBar(top)
    this.refreshChips()

    this.house.onRoomChange((i) => {
      const id = ROOM_IDS.find((r) => ROOM_GEOM_INDEX[r] === i)
      if (id) this.panelRoom = id
      upgradeBtn.hidden = !id
      if (id) this.setUpgradeLabel(upgradeBtn, id)
    })

    upgradeBtn.onclick = (e) => {
      e.stopPropagation()
      if (this.panelRoom) this.upgradeRoom(this.panelRoom)
    }

    for (let i = 0; i < ROOM_IDS.length; i++) {
      const chip = this.house.getChip(i)
      chip?.addEventListener('dblclick', (e) => {
        e.stopPropagation()
        this.panelRoom = ROOM_IDS[i]
        upgradeBtn.hidden = false
        this.setUpgradeLabel(upgradeBtn, ROOM_IDS[i])
      })
    }

    const hint = document.createElement('div')
    hint.id = 'hint'
    hint.textContent = '点地板走动 · Lv1 与原画一致；双击房间名或点「升级房间」看粘土模块'
    this.stageRoot.appendChild(hint)

    const label = document.createElement('div')
    label.id = 'label'
    this.stageRoot.appendChild(label)

    void this.modules.applyTiers(this.save).then(() => this.house.start())
  }

  private setUpgradeLabel(btn: HTMLButtonElement, id: RoomId) {
    const tier = this.save.roomTiers[id]
    const max = MAX_TIER[id]
    if (tier >= max) {
      btn.textContent = `${ROOM_LABEL[id]} 已满级`
      btn.disabled = true
    } else {
      btn.textContent = `升级 ${ROOM_LABEL[id]} → Lv.${tier + 1}`
      btn.disabled = false
    }
  }

  private upgradeRoom(id: RoomId) {
    const tier = this.save.roomTiers[id]
    const max = MAX_TIER[id]
    if (tier >= max) return
    this.save = {
      ...this.save,
      roomTiers: { ...this.save.roomTiers, [id]: tier + 1 },
      bakeRevision: BAKE_REVISION,
    }
    writeSave(this.save)
    this.refreshChips()
    void this.modules.applyTiers(this.save)
    const btn = this.stageRoot.querySelector('#upgrade') as HTMLButtonElement
    this.setUpgradeLabel(btn, id)
    this.showToast(`${ROOM_LABEL[id]} → Lv.${tier + 1}`)
  }

  private refreshChips() {
    ROOM_IDS.forEach((id, i) => {
      const tier = this.save.roomTiers[id]
      this.house.setChipLabel(i, `${ROOM_LABEL[id]} Lv.${tier}`)
    })
  }

  private showToast(text: string) {
    const label = this.stageRoot.querySelector('#label') as HTMLElement
    label.textContent = text
    label.classList.add('on')
    setTimeout(() => label.classList.remove('on'), 1400)
  }

  static fit() {
    const k = Math.min(innerWidth / VW, innerHeight / VH)
    const fit = document.getElementById('fit')
    if (fit) fit.style.transform = `translate(-50%,-50%) scale(${k})`
  }
}