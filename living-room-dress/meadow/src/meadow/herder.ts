import * as THREE from 'three'
import { blobShadow } from './materials'
import type { PetId } from './storeBridge'

/**
 * 2.5D Real Equipped Plush Partner Standee (Option A) with Mario Ice-Skating Feel:
 * - Renders the player's actual Yutu / Koi high-res plush PNG outfit
 * - Includes soft inverted ice reflection right below the boots
 * - Expressive Mario high-friction braking lean-back, jitter, & dash lean-forward
 */
export type HerderState = {
  group: THREE.Group
  billboard: THREE.Group
  card: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  reflection: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  shadow: THREE.Mesh
  petId: PetId
  facing: number
  facingCurrent: number
  phase: number
  baseHeight: number
  leanCurrent: number
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
  geo.translate(0, baseHeight * 0.5, 0)

  const mat = new THREE.MeshBasicMaterial({
    color: 0xfffdf8,
    transparent: true,
    alphaTest: 0.06,
    side: THREE.DoubleSide,
    depthWrite: true,
  })

  const card = new THREE.Mesh(geo, mat)
  card.renderOrder = 3
  card.visible = false
  billboard.add(card)

  // Soft inverted ice reflection underneath the boots (Penguin Pushers icy sheen cue)
  const reflGeo = new THREE.PlaneGeometry(baseHeight * 0.72, baseHeight)
  reflGeo.translate(0, baseHeight * 0.5, 0)
  const reflMat = new THREE.MeshBasicMaterial({
    color: 0xbfe2ec,
    transparent: true,
    opacity: 0.28,
    alphaTest: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const reflection = new THREE.Mesh(reflGeo, reflMat)
  reflection.scale.set(1, -0.52, 1)
  reflection.position.set(0, 0.04, -0.04)
  reflection.renderOrder = 1
  reflection.visible = false
  billboard.add(reflection)

  const shadow = blobShadow(0.76, 0.54, 0.75)
  shadow.position.set(0.06, 0.032, 0.08)
  group.add(shadow)

  if (outfitUrl || fallbackUrl) {
    loadPartnerSprite(outfitUrl || fallbackUrl, fallbackUrl, (tex, aspect) => {
      mat.map?.dispose()
      mat.map = tex
      mat.needsUpdate = true

      reflMat.map = tex
      reflMat.needsUpdate = true

      const nextGeo = new THREE.PlaneGeometry(baseHeight * aspect, baseHeight)
      nextGeo.translate(0, baseHeight * 0.5, 0)
      card.geometry.dispose()
      card.geometry = nextGeo

      const nextRefl = new THREE.PlaneGeometry(baseHeight * aspect, baseHeight)
      nextRefl.translate(0, baseHeight * 0.5, 0)
      reflection.geometry.dispose()
      reflection.geometry = nextRefl

      card.visible = true
      reflection.visible = true
    })
  }

  return {
    group,
    billboard,
    card,
    reflection,
    shadow,
    petId,
    facing: 1,
    facingCurrent: 1,
    phase: 0,
    baseHeight,
    leanCurrent: 0,
  }
}

export function orientHerderToCamera(state: HerderState, camera: THREE.Camera) {
  state.billboard.quaternion.copy(camera.quaternion)
}

export type HerderMotionVisual = {
  speedRatio: number
  screenVelX: number
  skidIntensity: number
  dashing: boolean
  time: number
}

export function stepHerder(
  state: HerderState,
  dt: number,
  motion: HerderMotionVisual,
) {
  const { speedRatio, screenVelX, skidIntensity, dashing, time } = motion
  if (Math.abs(screenVelX) > 0.16 && skidIntensity < 0.25) {
    state.facing = screenVelX >= 0 ? 1 : -1
  }
  state.facingCurrent += (state.facing - state.facingCurrent) * Math.min(1, dt * 15)
  const flipX =
    Math.abs(state.facingCurrent) < 0.08
      ? state.facing >= 0
        ? 0.08
        : -0.08
      : state.facingCurrent

  // Target body lean:
  // - Skidding: dramatic Mario backward brace opposite to slide direction!
  // - Dashing: eager forward dive tilt!
  // - Normal skating: gentle speed lean + waddle
  const slideSign = screenVelX >= 0 ? 1 : -1
  let targetLean = 0
  if (skidIntensity > 0.08) {
    targetLean = slideSign * (0.28 + skidIntensity * 0.14)
  } else if (dashing) {
    targetLean = -slideSign * 0.24
  } else if (speedRatio > 0.12) {
    targetLean = -slideSign * 0.08 * speedRatio + Math.cos(state.phase) * 0.065 * speedRatio
  }
  state.leanCurrent += (targetLean - state.leanCurrent) * Math.min(1, dt * 16)

  if (skidIntensity > 0.08) {
    // Digging heels into the ice: compressed squash + crisp friction tremble
    const jitter = Math.sin(time * 58) * 0.028 * skidIntensity
    const crouch = 0.09 * skidIntensity
    state.card.position.set(jitter, 0, 0)
    state.card.scale.set(flipX * (1 + crouch * 1.1), 1 - crouch, 1)
    state.card.rotation.z = state.leanCurrent
    state.shadow.scale.set(0.88, 0.62, 1)
  } else if (dashing) {
    state.card.position.set(0, 0.14, 0)
    state.card.scale.set(flipX * 1.12, 0.9, 1)
    state.card.rotation.z = state.leanCurrent
    state.shadow.scale.set(0.84, 0.5, 1)
  } else if (speedRatio > 0.08) {
    state.phase += dt * (8.5 + speedRatio * 5.2)
    const hop = Math.abs(Math.sin(state.phase))
    const squash = Math.sin(state.phase * 2) * 0.055 * speedRatio
    state.card.position.set(0, hop * 0.2 * speedRatio, 0)
    state.card.scale.set(flipX * (1 - squash), 1 + squash * 1.15, 1)
    state.card.rotation.z = state.leanCurrent
    const sScale = 1 - hop * 0.14 * speedRatio
    state.shadow.scale.set(0.76 * sScale, 0.54 * sScale, 1)
  } else {
    state.phase += dt * 2.6
    const breathe = Math.sin(state.phase) * 0.018
    state.card.position.set(0, 0, 0)
    state.card.scale.set(flipX * (1 - breathe * 0.5), 1 + breathe, 1)
    state.card.rotation.z = state.leanCurrent
    state.shadow.scale.set(0.76, 0.54, 1)
  }

  // Mirror horizontal flip & subtle lean onto the ice reflection
  state.reflection.scale.set(state.card.scale.x, -0.52 * state.card.scale.y, 1)
  state.reflection.rotation.z = -state.card.rotation.z * 0.6
  state.reflection.position.y = 0.04 - state.card.position.y * 0.45
}

export function resetHerder(state: HerderState) {
  state.phase = 0
  state.facing = 1
  state.facingCurrent = 1
  state.leanCurrent = 0
  state.card.position.set(0, 0, 0)
  state.card.rotation.set(0, 0, 0)
  state.card.scale.set(1, 1, 1)
  state.reflection.scale.set(1, -0.52, 1)
  state.reflection.rotation.set(0, 0, 0)
  state.shadow.visible = true
  state.shadow.scale.set(0.76, 0.54, 1)
}
