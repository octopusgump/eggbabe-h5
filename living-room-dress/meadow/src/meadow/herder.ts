import * as THREE from 'three'
import { blobShadow } from './materials'
import type { PetId } from './storeBridge'

/**
 * 2.5D Real Equipped Plush Partner Standee (Option A):
 * Renders the player's actual Yutu / Koi high-res plush PNG outfit from EggBabe
 * with auto-cropped feet alignment, camera-facing billboarding, smooth L/R flip,
 * elastic squash-and-stretch running hop, and warm ground contact shadow.
 */
export type HerderState = {
  group: THREE.Group
  billboard: THREE.Group
  card: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  shadow: THREE.Mesh
  petId: PetId
  facing: number
  facingCurrent: number
  phase: number
  baseHeight: number
  fallRoll: number
}

const TARGET_HEIGHT_BY_PET: Record<PetId, number> = {
  yutu: 2.38,
  koi: 2.02,
}

function cropImageToTightTexture(img: HTMLImageElement) {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const probe = document.createElement('canvas')
  probe.width = w
  probe.height = h
  const pctx = probe.getContext('2d')
  if (!pctx) {
    const tex = new THREE.Texture(img)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return { tex, aspect: w / Math.max(1, h) }
  }
  pctx.drawImage(img, 0, 0)
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  try {
    const data = pctx.getImageData(0, 0, w, h).data
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (data[(y * w + x) * 4 + 3] > 20) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }
  } catch {
    minX = 0
    minY = 0
    maxX = w - 1
    maxY = h - 1
  }
  if (maxX <= minX || maxY <= minY) {
    minX = 0
    minY = 0
    maxX = w - 1
    maxY = h - 1
  }
  const pad = 6
  const sx = Math.max(0, minX - pad)
  const sy = Math.max(0, minY - pad)
  const sw = Math.min(w - sx, maxX - minX + pad * 2)
  const sh = Math.min(h - sy, maxY - minY + pad * 2)

  const out = document.createElement('canvas')
  const maxDim = 512
  const scale = Math.min(1, maxDim / Math.max(sw, sh))
  out.width = Math.max(2, Math.round(sw * scale))
  out.height = Math.max(2, Math.round(sh * scale))
  const octx = out.getContext('2d')!
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height)

  const tex = new THREE.CanvasTexture(out)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return { tex, aspect: out.width / Math.max(1, out.height) }
}

function loadPartnerSprite(
  url: string,
  fallbackUrl: string,
  onReady: (tex: THREE.Texture, aspect: number) => void,
) {
  const tryLoad = (src: string, isFallback: boolean) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const { tex, aspect } = cropImageToTightTexture(img)
      onReady(tex, aspect)
    }
    img.onerror = () => {
      if (!isFallback && fallbackUrl && fallbackUrl !== src) {
        tryLoad(fallbackUrl, true)
      }
    }
    img.src = src
  }
  tryLoad(url, false)
}

export function createHerder(
  petId: PetId = 'yutu',
  outfitUrl = '',
  fallbackUrl = '',
): HerderState {
  const group = new THREE.Group()
  group.name = `herder_${petId}`

  const billboard = new THREE.Group()
  group.add(billboard)

  const baseHeight = TARGET_HEIGHT_BY_PET[petId]
  const geo = new THREE.PlaneGeometry(baseHeight * 0.72, baseHeight)
  // Shift pivot to bottom center (feet touch y = 0)
  geo.translate(0, baseHeight * 0.5, 0)

  const mat = new THREE.MeshBasicMaterial({
    color: 0xfffdf8,
    transparent: true,
    alphaTest: 0.06,
    side: THREE.DoubleSide,
    depthWrite: true,
  })

  const card = new THREE.Mesh(geo, mat)
  card.renderOrder = 2
  billboard.add(card)

  const shadow = blobShadow(0.76, 0.54, 0.96)
  shadow.position.set(0.06, 0.03, 0.08)
  group.add(shadow)

  if (outfitUrl || fallbackUrl) {
    loadPartnerSprite(outfitUrl || fallbackUrl, fallbackUrl, (tex, aspect) => {
      mat.map?.dispose()
      mat.map = tex
      mat.needsUpdate = true
      const nextGeo = new THREE.PlaneGeometry(baseHeight * aspect, baseHeight)
      nextGeo.translate(0, baseHeight * 0.5, 0)
      card.geometry.dispose()
      card.geometry = nextGeo
    })
  }

  return {
    group,
    billboard,
    card,
    shadow,
    petId,
    facing: 1,
    facingCurrent: 1,
    phase: 0,
    baseHeight,
    fallRoll: 0,
  }
}

export function orientHerderToCamera(state: HerderState, camera: THREE.Camera) {
  // Align billboard cleanly toward camera so the plush partner always looks crisp & sculptural
  state.billboard.quaternion.copy(camera.quaternion)
}

export function stepHerder(
  state: HerderState,
  dt: number,
  power: number,
  screenDirX = 0,
) {
  if (Math.abs(screenDirX) > 0.14) {
    state.facing = screenDirX >= 0 ? 1 : -1
  }
  state.facingCurrent += (state.facing - state.facingCurrent) * Math.min(1, dt * 14)
  const flipX = Math.abs(state.facingCurrent) < 0.08 ? (state.facing >= 0 ? 0.08 : -0.08) : state.facingCurrent

  if (power > 0.08) {
    state.phase += dt * (8.5 + power * 4.5)
    const hop = Math.abs(Math.sin(state.phase))
    const squash = Math.sin(state.phase * 2) * 0.055 * power
    state.card.position.y = hop * 0.24 * power
    state.card.scale.set(
      flipX * (1 - squash),
      1 + squash * 1.15,
      1,
    )
    state.card.rotation.z = Math.cos(state.phase) * 0.075 * power
    const sScale = 1 - hop * 0.16 * power
    state.shadow.scale.set(0.76 * sScale, 0.54 * sScale, 1)
  } else {
    state.phase += dt * 2.6
    const breathe = Math.sin(state.phase) * 0.018
    state.card.position.y += (0 - state.card.position.y) * Math.min(1, dt * 10)
    state.card.scale.set(
      flipX * (1 - breathe * 0.5),
      1 + breathe,
      1,
    )
    state.card.rotation.z += (0 - state.card.rotation.z) * Math.min(1, dt * 10)
    state.shadow.scale.set(0.76, 0.54, 1)
  }
}

export function stepHerderFall(state: HerderState, u: number) {
  state.card.position.y = 0
  state.card.rotation.z = u * Math.PI * 1.45 * (state.facing >= 0 ? -1 : 1)
  state.card.scale.set(state.facing * (1 - u * 0.18), 1 - u * 0.18, 1)
  state.shadow.visible = false
}

export function resetHerder(state: HerderState) {
  state.phase = 0
  state.facing = 1
  state.facingCurrent = 1
  state.card.position.set(0, 0, 0)
  state.card.rotation.set(0, 0, 0)
  state.card.scale.set(1, 1, 1)
  state.shadow.visible = true
  state.shadow.scale.set(0.76, 0.54, 1)
}
