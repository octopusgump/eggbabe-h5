import * as THREE from 'three'

type SkidMark = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  age: number
  life: number
  baseOpacity: number
}

type SprayParticle = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  age: number
  life: number
  vx: number
  vy: number
  vz: number
  gravity: number
  baseOpacity: number
}

const marks: SkidMark[] = []
const sprays: SprayParticle[] = []

const markGeo = new THREE.PlaneGeometry(1, 1)
markGeo.rotateX(-Math.PI / 2)

const sprayGeo = new THREE.SphereGeometry(0.085, 7, 6)

const MAX_MARKS = 160
const MAX_SPRAYS = 90

/** Etches a frosted skid / belly-slide mark onto the ice that fades gently over time */
export function spawnSkidMark(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  angle: number,
  length: number,
  width: number,
  isBrake = false,
) {
  if (marks.length >= MAX_MARKS) {
    const oldest = marks.shift()
    if (oldest) {
      oldest.mesh.parent?.remove(oldest.mesh)
      oldest.mesh.material.dispose()
    }
  }
  const mat = new THREE.MeshBasicMaterial({
    color: isBrake ? 0xffffff : 0xf4fcff,
    transparent: true,
    opacity: isBrake ? 0.84 : 0.48,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(markGeo, mat)
  mesh.position.set(x, y + 0.036, z)
  mesh.rotation.y = angle
  mesh.scale.set(Math.max(0.22, length), 1, Math.max(0.08, width))
  scene.add(mesh)
  marks.push({
    mesh,
    age: 0,
    life: isBrake ? 3.8 : 2.4,
    baseOpacity: mat.opacity,
  })
}

/** Dual boot-edge frost tracks left when Mario-braking on ice */
export function spawnTwinSkidMarks(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  dirX: number,
  dirZ: number,
  intensity: number,
) {
  const len = Math.hypot(dirX, dirZ) || 1
  const ux = dirX / len
  const uz = dirZ / len
  const px = -uz * 0.22
  const pz = ux * 0.22
  const angle = Math.atan2(-uz, ux)
  const segLen = 0.36 + intensity * 0.3
  const segW = 0.1 + intensity * 0.06
  spawnSkidMark(scene, x + px, y, z + pz, angle, segLen, segW, true)
  spawnSkidMark(scene, x - px, y, z - pz, angle, segLen, segW, true)
}

/** Ice-crystal & snow frost spray bursting forward during hard Mario braking */
export function spawnIceSpray(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  dirX: number,
  dirZ: number,
  intensity: number,
  count = 4,
  color = 0xffffff,
) {
  const len = Math.hypot(dirX, dirZ) || 1
  const ux = dirX / len
  const uz = dirZ / len
  for (let i = 0; i < count; i++) {
    if (sprays.length >= MAX_SPRAYS) {
      const old = sprays.shift()
      if (old) {
        old.mesh.parent?.remove(old.mesh)
        old.mesh.material.dispose()
      }
    }
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(sprayGeo, mat)
    const spread = (Math.random() - 0.5) * 1.05
    const sideX = -uz * spread
    const sideZ = ux * spread
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.3,
      y + 0.14 + Math.random() * 0.12,
      z + (Math.random() - 0.5) * 0.3,
    )
    const s = 0.95 + Math.random() * (0.85 + intensity * 0.75)
    mesh.scale.setScalar(s)
    scene.add(mesh)
    const fwd = (1.6 + Math.random() * 2.4) * (0.65 + intensity * 0.75)
    sprays.push({
      mesh,
      age: 0,
      life: 0.4 + Math.random() * 0.24,
      vx: ux * fwd + sideX * 1.5,
      vy: 1.65 + Math.random() * 1.45 * (0.6 + intensity * 0.65),
      vz: uz * fwd + sideZ * 1.5,
      gravity: 6.6,
      baseOpacity: 0.92,
    })
  }
}

/** Joyful golden / cream star puff burst when a sheep lands inside a pen */
export function spawnPenBurst(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  isGolden: boolean,
) {
  const palette = isGolden
    ? [0xffe074, 0xfff5be, 0xf2b94b]
    : [0xfff8df, 0xd8ebaa, 0xffe69c]
  const count = isGolden ? 14 : 9
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.3
    const speed = 1.6 + Math.random() * 1.8
    const mat = new THREE.MeshBasicMaterial({
      color: palette[i % palette.length],
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(sprayGeo, mat)
    mesh.position.set(x, y + 0.55, z)
    mesh.scale.setScalar(isGolden ? 1.45 : 1.15)
    scene.add(mesh)
    sprays.push({
      mesh,
      age: 0,
      life: 0.52 + Math.random() * 0.24,
      vx: Math.cos(a) * speed,
      vy: 2.4 + Math.random() * 1.6,
      vz: Math.sin(a) * speed,
      gravity: 6.2,
      baseOpacity: 0.95,
    })
  }
}

export function stepTrails(dt: number) {
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i]
    m.age += dt
    const u = m.age / m.life
    if (u >= 1) {
      m.mesh.parent?.remove(m.mesh)
      m.mesh.material.dispose()
      marks.splice(i, 1)
      continue
    }
    const fade = u < 0.35 ? 1 : 1 - (u - 0.35) / 0.65
    m.mesh.material.opacity = m.baseOpacity * fade
  }

  for (let i = sprays.length - 1; i >= 0; i--) {
    const p = sprays[i]
    p.age += dt
    const u = p.age / p.life
    if (u >= 1) {
      p.mesh.parent?.remove(p.mesh)
      p.mesh.material.dispose()
      sprays.splice(i, 1)
      continue
    }
    p.vy -= p.gravity * dt
    p.mesh.position.x += p.vx * dt
    p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt)
    p.mesh.position.z += p.vz * dt
    p.mesh.material.opacity = p.baseOpacity * (1 - u)
    p.mesh.scale.multiplyScalar(1 - dt * 0.85)
  }
}

export function clearTrails() {
  for (const m of marks) {
    m.mesh.parent?.remove(m.mesh)
    m.mesh.material.dispose()
  }
  marks.length = 0
  for (const p of sprays) {
    p.mesh.parent?.remove(p.mesh)
    p.mesh.material.dispose()
  }
  sprays.length = 0
}
