import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  createBotanicalArtTexture,
  createBoucleBumpTexture,
  createGinghamTexture,
  createOakFloorTexture,
  createWallpaperTexture,
} from './textures'
import {
  BUNNY_SPRITES,
  COZY_ACCESSORIES,
  COZY_ROOMS,
  type CozyActionDef,
  type CozyRoomId,
} from './catalog'

type Theme = 'day' | 'night'

type ObstacleCircle = { x: number; z: number; r: number }

/**
 * Pure-code 2.5D Photorealistic Cream Miniature Dollhouse Room (Three.js + PBR Canvas Textures + PCFSoftShadowMap).
 * Supports 4 themed cutaway rooms, click-to-walk on floor, drag-to-orbit micro parallax,
 * plush Yutu billboard with 8 pixel-aligned accessories, and Day / Warm-Lamp Night lighting.
 */
export class CozyRoom25D {
  private readonly host: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly roomRoot = new THREE.Group()
  private readonly furnitureGroup = new THREE.Group()
  private readonly floorPlane: THREE.Mesh

  // Lights
  private readonly hemiLight: THREE.HemisphereLight
  private readonly sunLight: THREE.DirectionalLight
  private readonly fillLight: THREE.DirectionalLight
  private readonly lampLight: THREE.PointLight
  private readonly windowGlowMat: THREE.MeshBasicMaterial

  // Shared PBR materials
  private readonly matWallpaper: THREE.MeshStandardMaterial
  private readonly matOakFloor: THREE.MeshStandardMaterial
  private readonly matOakWood: THREE.MeshStandardMaterial
  private readonly matCreamBoucle: THREE.MeshStandardMaterial
  private readonly matSageBoucle: THREE.MeshStandardMaterial
  private readonly matRugBoucle: THREE.MeshStandardMaterial
  private readonly matCeramic: THREE.MeshStandardMaterial
  private readonly matLeaf: THREE.MeshStandardMaterial
  private readonly matLampShade: THREE.MeshStandardMaterial

  // Plush Yutu composite canvas sprite
  private readonly bunnyGroup = new THREE.Group()
  private readonly bunnyMesh: THREE.Mesh
  private readonly bunnyShadow: THREE.Mesh
  private readonly bunnyCanvas = document.createElement('canvas')
  private readonly bunnyCtx: CanvasRenderingContext2D
  private readonly bunnyTex: THREE.CanvasTexture
  private readonly imgCache = new Map<string, HTMLImageElement>()

  // State
  private roomId: CozyRoomId = 'living'
  private headId: string | null = null
  private neckId: string | null = null
  private theme: Theme = 'day'
  private active = false
  private rafId = 0
  private lastT = performance.now()
  private curFace: 'base' | 'closed' | 'doze' = 'base'
  private compositeDirty = true

  // Kinematics & camera orbit
  private pos = new THREE.Vector2(0.15, 0.45)
  private target = new THREE.Vector2(0.15, 0.45)
  private walking = false
  private walkPhase = 0
  private emote: { kind: 'pet' | 'nap' | 'happy' | 'sway'; start: number; end: number } | null = null
  private nextBlink = performance.now() + 2600
  private blinkUntil = 0
  private yaw = 0 // subtle drag orbit (-0.28..0.28 rad)
  private targetYaw = 0
  private obstacles: ObstacleCircle[] = []

  // Pointer helpers
  private readonly raycaster = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()
  private dragStart: { x: number; y: number; yaw0: number; moved: boolean } | null = null

  constructor(
    host: HTMLElement,
    private readonly cb: {
      onPet: () => void
      onFloorTap: (screenPctX: number, screenPctY: number) => void
    },
  ) {
    this.host = host
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.06
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'room25d-canvas'
    host.appendChild(this.renderer.domElement)

    // Mild telephoto 2.5D perspective framing the full miniature dollhouse plinth cleanly
    this.camera = new THREE.PerspectiveCamera(27, 390 / 560, 0.1, 60)
    this.camera.position.set(6.25, 5.55, 6.65)
    this.camera.lookAt(0, 0.65, 0)

    // Lighting rig
    this.hemiLight = new THREE.HemisphereLight(0xfff7ea, 0xd8b892, 1.05)
    this.scene.add(this.hemiLight)

    // Soft natural daylight pouring from left sheer-curtain window
    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.35)
    this.sunLight.position.set(-4.2, 5.8, 2.8)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.set(1024, 1024)
    this.sunLight.shadow.camera.near = 1
    this.sunLight.shadow.camera.far = 18
    const d = 3.4
    this.sunLight.shadow.camera.left = -d
    this.sunLight.shadow.camera.right = d
    this.sunLight.shadow.camera.top = d
    this.sunLight.shadow.camera.bottom = -d
    this.sunLight.shadow.bias = -0.0008
    this.sunLight.shadow.radius = 4
    this.scene.add(this.sunLight)

    this.fillLight = new THREE.DirectionalLight(0xffe8cc, 0.38)
    this.fillLight.position.set(4.5, 3.2, 4.5)
    this.scene.add(this.fillLight)

    this.lampLight = new THREE.PointLight(0xffcf82, 0.3, 5.5, 1.6)
    this.lampLight.position.set(0.8, 1.6, -1.1)
    this.roomRoot.add(this.lampLight)

    // Procedural PBR Materials
    const wallTex = createWallpaperTexture()
    const oakTex = createOakFloorTexture()
    const boucleBump = createBoucleBumpTexture()

    this.matWallpaper = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.92,
      metalness: 0.0,
    })
    this.matOakFloor = new THREE.MeshStandardMaterial({
      map: oakTex,
      roughness: 0.66,
      metalness: 0.04,
    })
    this.matOakWood = new THREE.MeshStandardMaterial({
      color: 0xcf9b64,
      roughness: 0.62,
      metalness: 0.04,
    })
    this.matCreamBoucle = new THREE.MeshStandardMaterial({
      color: 0xeed9be,
      bumpMap: boucleBump,
      bumpScale: 0.032,
      roughness: 0.96,
      metalness: 0.0,
    })
    this.matSageBoucle = new THREE.MeshStandardMaterial({
      color: 0xc2ceb0,
      bumpMap: boucleBump,
      bumpScale: 0.034,
      roughness: 0.96,
      metalness: 0.0,
    })
    this.matRugBoucle = new THREE.MeshStandardMaterial({
      color: 0xf4e6d0,
      bumpMap: boucleBump,
      bumpScale: 0.04,
      roughness: 0.98,
      metalness: 0.0,
    })
    this.matCeramic = new THREE.MeshStandardMaterial({
      color: 0xf5ede0,
      roughness: 0.45,
      metalness: 0.03,
    })
    this.matLeaf = new THREE.MeshStandardMaterial({
      color: 0x6f9446,
      roughness: 0.68,
      metalness: 0.02,
    })
    this.matLampShade = new THREE.MeshStandardMaterial({
      color: 0xfff0cf,
      emissive: 0xffd185,
      emissiveIntensity: 0.4,
      roughness: 0.5,
    })
    this.windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff8ea })

    // Build cutaway 2.5D room shell
    this.floorPlane = this.buildRoomShell()
    this.roomRoot.add(this.furnitureGroup)
    this.scene.add(this.roomRoot)

    // Plush Yutu high-res billboard standing in 2.5D space
    this.bunnyCanvas.width = 512
    this.bunnyCanvas.height = 955
    this.bunnyCtx = this.bunnyCanvas.getContext('2d')!
    this.bunnyTex = new THREE.CanvasTexture(this.bunnyCanvas)
    this.bunnyTex.colorSpace = THREE.SRGBColorSpace
    const bMat = new THREE.MeshBasicMaterial({
      map: this.bunnyTex,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: true,
    })
    // Aspect ratio 600 / 1119 = 0.536; height ~1.58 world units so Yutu looks adorable & clear
    const bGeo = new THREE.PlaneGeometry(0.86, 1.6)
    bGeo.translate(0, 0.8, 0)
    this.bunnyMesh = new THREE.Mesh(bGeo, bMat)
    this.bunnyGroup.add(this.bunnyMesh)

    // Soft contact shadow right under Yutu's feet
    const shCanvas = document.createElement('canvas')
    shCanvas.width = 128
    shCanvas.height = 128
    const shCtx = shCanvas.getContext('2d')!
    const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 58)
    grad.addColorStop(0, 'rgba(72,46,20,0.42)')
    grad.addColorStop(0.6, 'rgba(72,46,20,0.14)')
    grad.addColorStop(1, 'rgba(72,46,20,0)')
    shCtx.fillStyle = grad
    shCtx.fillRect(0, 0, 128, 128)
    const shTex = new THREE.CanvasTexture(shCanvas)
    this.bunnyShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }),
    )
    this.bunnyShadow.rotation.x = -Math.PI / 2
    this.bunnyShadow.position.y = 0.025
    this.bunnyGroup.add(this.bunnyShadow)

    this.roomRoot.add(this.bunnyGroup)

    this.bindPointer()
    this.preloadImages()
    this.rebuildFurniture()
    this.applyTheme()
    this.resize()
  }

  private buildRoomShell(): THREE.Mesh {
    const W = 3.8
    const H = 2.65
    const T = 0.16

    // Rounded miniature dollhouse plinth base (clean cream bevel)
    const base = new THREE.Mesh(
      new RoundedBoxGeometry(W + 0.24, 0.24, W + 0.24, 4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xf5ece0, roughness: 0.85 }),
    )
    base.position.y = -0.13
    base.receiveShadow = true
    this.roomRoot.add(base)

    // Oak wood floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), this.matOakFloor)
    floor.position.y = -0.02
    floor.receiveShadow = true
    this.roomRoot.add(floor)

    // Back wall (-Z)
    const backWall = new THREE.Mesh(new RoundedBoxGeometry(W + T, H, T, 3, 0.04), this.matWallpaper)
    backWall.position.set(-T / 2, H / 2, -W / 2 - T / 2)
    backWall.receiveShadow = true
    this.roomRoot.add(backWall)

    // Left wall (-X)
    const leftWall = new THREE.Mesh(new RoundedBoxGeometry(T, H, W + T, 3, 0.04), this.matWallpaper)
    leftWall.position.set(-W / 2 - T / 2, H / 2, -T / 2)
    leftWall.receiveShadow = true
    this.roomRoot.add(leftWall)

    // Clean cream baseboards
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0xefe3d2, roughness: 0.85 })
    const skBack = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, 0.04), skirtMat)
    skBack.position.set(0, 0.08, -W / 2 + 0.02)
    skBack.receiveShadow = true
    const skLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, W), skirtMat)
    skLeft.position.set(-W / 2 + 0.02, 0.08, 0)
    skLeft.receiveShadow = true
    this.roomRoot.add(skBack, skLeft)

    // Left sunlit window glow + sheer linen pleated curtain (signature IMG_4791 look)
    const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.55), this.windowGlowMat)
    winGlow.rotation.y = Math.PI / 2
    winGlow.position.set(-W / 2 + 0.015, 1.52, 0.35)
    this.roomRoot.add(winGlow)

    const curtainMat = new THREE.MeshStandardMaterial({
      color: 0xfbf4e8,
      roughness: 0.95,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
    })
    for (let i = 0; i < 7; i++) {
      const pleat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.065, 1.72, 10, 1, true),
        curtainMat,
      )
      pleat.scale.set(0.55, 1, 1.4)
      pleat.position.set(-W / 2 + 0.08, 1.55, -0.32 + i * 0.22)
      this.roomRoot.add(pleat)
    }

    return floor
  }

  private buildShellSofa(): THREE.Group {
    const g = new THREE.Group()
    // Cream tufted seat cushion
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.65, 0.22, 24), this.matCreamBoucle)
    seat.position.y = 0.12
    seat.castShadow = true
    seat.receiveShadow = true
    g.add(seat)

    // 7 plump scalloped bouclé shell petals curving snugly around the back
    const petalGeo = new THREE.CapsuleGeometry(0.18, 0.34, 10, 16)
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.56 + (i / 6) * Math.PI * 1.12
      const p = new THREE.Mesh(petalGeo, this.matCreamBoucle)
      p.scale.set(1.12, 0.94, 0.72)
      p.position.set(Math.sin(a) * 0.48, 0.38, -Math.cos(a) * 0.44)
      p.rotation.y = -a
      p.rotation.x = -0.18
      p.castShadow = true
      p.receiveShadow = true
      g.add(p)
    }

    // Soft sage-tinted bouclé wrap bolster cushions in front-sides (1:1 IMG_4791 detail!)
    const bolsterGeo = new THREE.SphereGeometry(0.22, 16, 14)
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.42 + (i / 5) * Math.PI * 1.16
      const b = new THREE.Mesh(bolsterGeo, this.matSageBoucle)
      b.scale.set(1.18, 0.78, 1.05)
      b.position.set(Math.sin(a) * 0.56, 0.17, -Math.cos(a) * 0.5)
      b.castShadow = true
      b.receiveShadow = true
      g.add(b)
    }
    return g
  }

  private buildOakSideTable(withCake = false): THREE.Group {
    const g = new THREE.Group()
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.065, 24), this.matOakWood)
    top.position.y = 0.52
    top.castShadow = true
    top.receiveShadow = true
    g.add(top)

    const legGeo = new THREE.CylinderGeometry(0.042, 0.036, 0.52, 12)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4
      const leg = new THREE.Mesh(legGeo, this.matOakWood)
      leg.position.set(Math.cos(a) * 0.24, 0.26, Math.sin(a) * 0.24)
      leg.rotation.z = -Math.cos(a) * 0.1
      leg.rotation.x = Math.sin(a) * 0.1
      leg.castShadow = true
      g.add(leg)
    }

    if (withCake) {
      // Matte ceramic cake stand + miniature strawberry shortcake
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.06, 18), this.matCeramic)
      stand.position.set(-0.04, 0.58, -0.02)
      const cake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.145, 0.13, 18),
        new THREE.MeshStandardMaterial({ color: 0xfff5e6, roughness: 0.85 }),
      )
      cake.position.set(-0.04, 0.67, -0.02)
      const berry = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xe36270, roughness: 0.55 }),
      )
      berry.position.set(-0.04, 0.76, -0.02)
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.11, 16), this.matCeramic)
      mug.position.set(0.18, 0.61, 0.1)
      g.add(stand, cake, berry, mug)
    } else {
      // Ceramic pot + lush green plant + small ceramic teacup (1:1 IMG_4791!)
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.22, 18), this.matCeramic)
      pot.position.set(-0.04, 0.66, -0.04)
      pot.castShadow = true
      g.add(pot)

      const leafGeo = new THREE.SphereGeometry(0.085, 10, 8)
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        const r = 0.06 + (i % 3) * 0.045
        const lf = new THREE.Mesh(leafGeo, this.matLeaf)
        lf.scale.set(1.25, 0.55, 0.75)
        lf.position.set(-0.04 + Math.cos(a) * r, 0.82 + (i % 3) * 0.06, -0.04 + Math.sin(a) * r)
        lf.rotation.y = -a
        lf.rotation.z = 0.35
        lf.castShadow = true
        g.add(lf)
      }

      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.11, 16), this.matCeramic)
      cup.position.set(0.18, 0.61, 0.12)
      cup.castShadow = true
      g.add(cup)
    }
    return g
  }

  private buildPlushRug(radius = 1.12, mat = this.matRugBoucle): THREE.Mesh {
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.03, 0.035, 36), mat)
    rug.position.y = 0.018
    rug.receiveShadow = true
    return rug
  }

  private buildCozyBed(): THREE.Group {
    const g = new THREE.Group()
    // Headboard & frame
    const head = new THREE.Mesh(new RoundedBoxGeometry(1.52, 0.92, 0.12, 4, 0.05), this.matOakWood)
    head.position.set(0, 0.46, -0.82)
    head.castShadow = true
    const frame = new THREE.Mesh(new RoundedBoxGeometry(1.52, 0.24, 1.72, 4, 0.05), this.matOakWood)
    frame.position.set(0, 0.14, 0)
    frame.castShadow = true
    frame.receiveShadow = true
    // Mattress + gingham quilt
    const quiltMat = new THREE.MeshStandardMaterial({
      map: createGinghamTexture(),
      roughness: 0.92,
    })
    const mattress = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.26, 1.62, 4, 0.09), quiltMat)
    mattress.position.set(0, 0.34, 0.02)
    mattress.castShadow = true
    mattress.receiveShadow = true
    // Two fluffy pillows
    const pillowGeo = new RoundedBoxGeometry(0.56, 0.18, 0.36, 4, 0.08)
    const p1 = new THREE.Mesh(pillowGeo, this.matCreamBoucle)
    p1.position.set(-0.34, 0.52, -0.52)
    p1.rotation.x = 0.16
    const p2 = new THREE.Mesh(pillowGeo, this.matCreamBoucle)
    p2.position.set(0.34, 0.52, -0.52)
    p2.rotation.x = 0.16
    g.add(head, frame, mattress, p1, p2)
    return g
  }

  private buildNightstandLamp(): THREE.Group {
    const g = new THREE.Group()
    const stand = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.48, 0.44, 3, 0.04), this.matOakWood)
    stand.position.y = 0.24
    stand.castShadow = true
    stand.receiveShadow = true
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 16), this.matCeramic)
    base.position.y = 0.56
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.18, 18), this.matLampShade)
    shade.position.y = 0.72
    g.add(stand, base, shade)
    return g
  }

  private buildWallArt(): THREE.Group {
    const g = new THREE.Group()
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.9, 0.05, 2, 0.015), this.matOakWood)
    frame.castShadow = true
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.78),
      new THREE.MeshStandardMaterial({ map: createBotanicalArtTexture(), roughness: 0.9 }),
    )
    art.position.z = 0.028
    g.add(frame, art)
    return g
  }

  private buildWallShelf(): THREE.Group {
    const g = new THREE.Group()
    const shelf = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.07, 0.28, 2, 0.02), this.matOakWood)
    shelf.castShadow = true
    g.add(shelf)
    const m1 = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.16, 14), this.matCeramic)
    m1.position.set(-0.32, 0.11, 0)
    const m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.16, 14), this.matCeramic)
    m2.position.set(-0.06, 0.11, 0)
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.15, 14), this.matCeramic)
    pot.position.set(0.32, 0.11, 0)
    g.add(m1, m2, pot)
    // Tiny trailing leaves
    for (let i = 0; i < 6; i++) {
      const lf = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), this.matLeaf)
      lf.position.set(0.32 + Math.sin(i) * 0.09, 0.18 - i * 0.06, 0.08)
      g.add(lf)
    }
    return g
  }

  private buildMatchaBeanbag(): THREE.Group {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.56, 22, 16), this.matSageBoucle)
    body.scale.set(1.12, 0.68, 1.05)
    body.position.y = 0.34
    body.castShadow = true
    body.receiveShadow = true
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), this.matSageBoucle)
    back.scale.set(1.05, 1.0, 0.82)
    back.position.set(-0.16, 0.56, -0.14)
    back.castShadow = true
    g.add(body, back)
    return g
  }

  private rebuildFurniture() {
    while (this.furnitureGroup.children.length > 0) {
      this.furnitureGroup.remove(this.furnitureGroup.children[0])
    }
    this.obstacles = []

    if (this.roomId === 'living') {
      const rug = this.buildPlushRug(1.18)
      rug.position.set(0.15, 0.018, 0.45)
      this.furnitureGroup.add(rug)

      const sofa = this.buildShellSofa()
      sofa.position.set(-0.82, 0, -0.78)
      sofa.rotation.y = 0.42
      this.furnitureGroup.add(sofa)
      this.obstacles.push({ x: -0.82, z: -0.78, r: 0.92 })

      const table = this.buildOakSideTable(false)
      table.position.set(1.12, 0, -0.65)
      this.furnitureGroup.add(table)
      this.obstacles.push({ x: 1.12, z: -0.65, r: 0.56 })

      this.lampLight.position.set(-0.9, 1.8, -0.8)
    } else if (this.roomId === 'bedroom') {
      const rug = new THREE.Mesh(
        new RoundedBoxGeometry(1.7, 0.03, 1.18, 3, 0.04),
        this.matRugBoucle,
      )
      rug.position.set(0.15, 0.015, 0.72)
      rug.receiveShadow = true
      this.furnitureGroup.add(rug)

      const bed = this.buildCozyBed()
      bed.position.set(-0.42, 0, -0.78)
      this.furnitureGroup.add(bed)
      this.obstacles.push({ x: -0.42, z: -0.78, r: 1.05 })

      const lamp = this.buildNightstandLamp()
      lamp.position.set(0.95, 0, -1.2)
      this.furnitureGroup.add(lamp)
      this.obstacles.push({ x: 0.95, z: -1.2, r: 0.45 })

      const art = this.buildWallArt()
      art.position.set(0.2, 1.65, -1.86)
      this.furnitureGroup.add(art)

      this.lampLight.position.set(0.95, 0.95, -1.1)
    } else if (this.roomId === 'cafe') {
      const rug = this.buildPlushRug(1.05, this.matCreamBoucle)
      rug.position.set(0.1, 0.018, 0.35)
      this.furnitureGroup.add(rug)

      const shelf = this.buildWallShelf()
      shelf.position.set(0.45, 1.72, -1.75)
      this.furnitureGroup.add(shelf)

      const table = this.buildOakSideTable(true)
      table.position.set(0.92, 0, -0.58)
      this.furnitureGroup.add(table)
      this.obstacles.push({ x: 0.92, z: -0.58, r: 0.56 })

      const sofa = this.buildShellSofa()
      sofa.scale.setScalar(0.88)
      sofa.position.set(-0.92, 0, -0.72)
      sofa.rotation.y = 0.55
      this.furnitureGroup.add(sofa)
      this.obstacles.push({ x: -0.92, z: -0.72, r: 0.82 })

      this.lampLight.position.set(0.45, 1.5, -1.3)
    } else {
      // matcha
      const rug = this.buildPlushRug(1.1)
      rug.position.set(0.15, 0.018, 0.38)
      this.furnitureGroup.add(rug)

      const bean = this.buildMatchaBeanbag()
      bean.position.set(-0.78, 0, -0.78)
      bean.rotation.y = 0.5
      this.furnitureGroup.add(bean)
      this.obstacles.push({ x: -0.78, z: -0.78, r: 0.72 })

      const table = this.buildOakSideTable(false)
      table.position.set(1.02, 0, -0.62)
      this.furnitureGroup.add(table)
      this.obstacles.push({ x: 1.02, z: -0.62, r: 0.56 })

      const lamp = this.buildNightstandLamp()
      lamp.position.set(1.15, 0, -1.32)
      this.furnitureGroup.add(lamp)
      this.obstacles.push({ x: 1.15, z: -1.32, r: 0.42 })

      this.lampLight.position.set(1.15, 0.95, -1.2)
    }

    // Ensure Yutu isn't standing inside newly placed furniture
    this.ensureValidPos()
  }

  private ensureValidPos() {
    for (const o of this.obstacles) {
      const dx = this.pos.x - o.x
      const dz = this.pos.y - o.z
      const d = Math.hypot(dx, dz)
      if (d < o.r + 0.36) {
        this.pos.set(0.15, 0.65)
        this.target.copy(this.pos)
        this.walking = false
      }
    }
  }

  private preloadImages() {
    const urls = [
      ...Object.values(BUNNY_SPRITES),
      ...COZY_ACCESSORIES.map((a) => a.layer),
    ]
    for (const u of urls) {
      const im = new Image()
      im.onload = () => {
        this.compositeDirty = true
      }
      im.src = u
      this.imgCache.set(u, im)
    }
  }

  private redrawBunnyTexture() {
    if (!this.compositeDirty) return
    const baseUrl = BUNNY_SPRITES[this.curFace]
    const baseImg = this.imgCache.get(baseUrl)
    if (!baseImg || !baseImg.complete || baseImg.naturalWidth === 0) return

    const ctx = this.bunnyCtx
    const w = this.bunnyCanvas.width
    const h = this.bunnyCanvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(baseImg, 0, 0, w, h)

    if (this.neckId) {
      const def = COZY_ACCESSORIES.find((a) => a.id === this.neckId)
      const im = def ? this.imgCache.get(def.layer) : undefined
      if (im && im.complete && im.naturalWidth > 0) ctx.drawImage(im, 0, 0, w, h)
    }
    if (this.headId) {
      const def = COZY_ACCESSORIES.find((a) => a.id === this.headId)
      const im = def ? this.imgCache.get(def.layer) : undefined
      if (im && im.complete && im.naturalWidth > 0) ctx.drawImage(im, 0, 0, w, h)
    }

    this.bunnyTex.needsUpdate = true
    this.compositeDirty = false
  }

  private bindPointer() {
    const dom = this.renderer.domElement
    dom.addEventListener('pointerdown', (e) => {
      if (!this.active) return
      e.stopPropagation()
      this.dragStart = { x: e.clientX, y: e.clientY, yaw0: this.targetYaw, moved: false }
      try {
        dom.setPointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
    })
    dom.addEventListener('pointermove', (e) => {
      if (!this.dragStart) return
      const dx = e.clientX - this.dragStart.x
      const dy = e.clientY - this.dragStart.y
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) this.dragStart.moved = true
      if (this.dragStart.moved) {
        this.targetYaw = Math.max(-0.32, Math.min(0.32, this.dragStart.yaw0 + dx * 0.0042))
      }
    })
    const up = (e: PointerEvent) => {
      if (!this.dragStart) return
      const d = this.dragStart
      this.dragStart = null
      if (d.moved || e.type === 'pointercancel') return

      const rect = dom.getBoundingClientRect()
      this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      this.raycaster.setFromCamera(this.ndc, this.camera)

      // Check bunny pet hit first
      if (this.raycaster.intersectObject(this.bunnyMesh, false).length > 0) {
        this.playEmote('pet', 1100)
        this.cb.onPet()
        return
      }

      // Check 2.5D floor click-to-walk
      const hits = this.raycaster.intersectObject(this.floorPlane, false)
      if (hits.length > 0) {
        const local = this.roomRoot.worldToLocal(hits[0].point.clone())
        const tx = Math.max(-1.42, Math.min(1.42, local.x))
        const tz = Math.max(-1.35, Math.min(1.42, local.z))
        // Push out of obstacle circles softly
        let px = tx
        let pz = tz
        for (const o of this.obstacles) {
          const ddx = px - o.x
          const ddz = pz - o.z
          const dist = Math.hypot(ddx, ddz)
          const minR = o.r + 0.34
          if (dist < minR) {
            const ang = dist > 0.001 ? Math.atan2(ddz, ddx) : Math.PI / 4
            px = o.x + Math.cos(ang) * minR
            pz = o.z + Math.sin(ang) * minR
          }
        }
        px = Math.max(-1.42, Math.min(1.42, px))
        pz = Math.max(-1.35, Math.min(1.42, pz))
        this.target.set(px, pz)
        this.walking = this.pos.distanceTo(this.target) > 0.08
        this.emote = null
        this.cb.onFloorTap(
          ((e.clientX - rect.left) / rect.width) * 100,
          ((e.clientY - rect.top) / rect.height) * 100,
        )
      }
    }
    dom.addEventListener('pointerup', up)
    dom.addEventListener('pointercancel', up)
  }

  setRoom(id: CozyRoomId) {
    if (this.roomId === id) return
    this.roomId = id
    this.rebuildFurniture()
  }

  setAccessories(head: string | null, neck: string | null) {
    if (this.headId === head && this.neckId === neck) return
    this.headId = head
    this.neckId = neck
    this.compositeDirty = true
  }

  setTheme(theme: Theme) {
    this.theme = theme
    this.applyTheme()
  }

  private applyTheme() {
    const bMat = this.bunnyMesh.material as THREE.MeshBasicMaterial
    if (this.theme === 'night') {
      this.hemiLight.color.setHex(0x8fa1cc)
      this.hemiLight.groundColor.setHex(0x524136)
      this.hemiLight.intensity = 0.62
      this.sunLight.color.setHex(0xa8bdf0)
      this.sunLight.intensity = 0.45
      this.fillLight.intensity = 0.16
      this.lampLight.intensity = 2.6
      this.matLampShade.emissiveIntensity = 1.45
      this.windowGlowMat.color.setHex(0x6c7ea8)
      bMat.color.setHex(0xd8c6b2)
    } else {
      this.hemiLight.color.setHex(0xfff7ea)
      this.hemiLight.groundColor.setHex(0xd8b892)
      this.hemiLight.intensity = 1.08
      this.sunLight.color.setHex(0xfff1d6)
      this.sunLight.intensity = 1.38
      this.fillLight.intensity = 0.42
      this.lampLight.intensity = 0.3
      this.matLampShade.emissiveIntensity = 0.4
      this.windowGlowMat.color.setHex(0xfff9ec)
      bMat.color.setHex(0xffffff)
    }
  }

  playEmote(kind: CozyActionDef['emote'], durationMs: number) {
    const t = performance.now()
    this.walking = false
    this.emote = { kind, start: t, end: t + durationMs }
  }

  setActive(on: boolean) {
    this.active = on
    this.renderer.domElement.hidden = !on
    if (on) {
      this.resize()
      if (!this.rafId) {
        this.lastT = performance.now()
        this.loop()
      }
    } else if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  resize() {
    const w = Math.max(100, this.host.clientWidth || 390)
    const h = Math.max(100, this.host.clientHeight || 540)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  private loop = () => {
    if (!this.active) return
    const t = performance.now()
    const dt = Math.min(0.05, (t - this.lastT) / 1000)
    this.lastT = t

    // Smooth camera orbit damping
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 8)
    this.roomRoot.rotation.y = this.yaw

    let bob = 0
    let sx = 1
    let sy = 1
    let rotZ = 0
    let face: 'base' | 'closed' | 'doze' = 'base'

    if (this.walking) {
      const to = this.target.clone().sub(this.pos)
      const dist = to.length()
      const speed = 1.65
      if (dist <= speed * dt) {
        this.pos.copy(this.target)
        this.walking = false
        this.walkPhase = 0
      } else {
        to.normalize().multiplyScalar(speed * dt)
        this.pos.add(to)
        this.walkPhase += dt * 4.2
        const f = this.walkPhase % 1
        const h = Math.sin(f * Math.PI)
        bob = h * 0.16
        sy = 1 + 0.05 * h - 0.03 * (1 - h)
        sx = 1 - 0.03 * h + 0.03 * (1 - h)
        rotZ = Math.sin(f * Math.PI * 2) * 0.06
      }
    } else if (this.emote && t < this.emote.end) {
      const e = this.emote
      const u = (t - e.start) / (e.end - e.start)
      if (e.kind === 'pet') {
        const sq = Math.sin(u * Math.PI * 2.5) * (1 - u)
        sy = 1 - 0.12 * sq
        sx = 1 + 0.1 * sq
        bob = Math.max(0, Math.sin(u * Math.PI)) * 0.08
        face = 'closed'
      } else if (e.kind === 'nap') {
        const br = Math.sin((t / 1000) * 2.0)
        sy = 1 + 0.025 * br
        sx = 1 - 0.015 * br
        rotZ = Math.sin((t / 1000) * 1.2) * 0.04
        face = 'doze'
      } else if (e.kind === 'happy') {
        const hop = Math.abs(Math.sin(u * Math.PI * 3))
        bob = hop * 0.24
        sy = 1 + 0.06 * hop
        sx = 1 - 0.04 * hop
        rotZ = Math.sin(u * Math.PI * 6) * 0.06
        face = hop > 0.45 ? 'closed' : 'base'
      } else {
        const sway = Math.sin(u * Math.PI * 4)
        rotZ = sway * 0.07
        bob = Math.abs(sway) * 0.05
        face = Math.sin(u * Math.PI * 2) > 0.25 ? 'closed' : 'base'
      }
    } else {
      if (this.emote && t >= this.emote.end) this.emote = null
      const br = Math.sin((t / 1000) * 2.4)
      sy = 1 + 0.016 * br
      sx = 1 - 0.008 * br
      if (t > this.nextBlink) {
        this.blinkUntil = t + 140
        this.nextBlink = t + 2600 + Math.random() * 2600
      }
      if (t < this.blinkUntil) face = 'closed'
    }

    if (face !== this.curFace) {
      this.curFace = face
      this.compositeDirty = true
    }
    this.redrawBunnyTexture()

    this.bunnyGroup.position.set(this.pos.x, 0, this.pos.y)
    // Billboard Yutu cleanly toward camera while respecting room yaw
    this.bunnyMesh.quaternion.copy(this.camera.quaternion)
    this.bunnyMesh.rotation.order = 'YXZ'
    this.bunnyMesh.rotation.y -= this.yaw
    this.bunnyMesh.rotation.z = rotZ
    this.bunnyMesh.position.y = bob
    this.bunnyMesh.scale.set(sx, sy, 1)
    const shScale = Math.max(0.68, 1 - bob * 1.2)
    this.bunnyShadow.scale.setScalar(shScale)

    this.renderer.render(this.scene, this.camera)
    this.rafId = requestAnimationFrame(this.loop)
  }

  getRoomName() {
    return COZY_ROOMS.find((r) => r.id === this.roomId)?.name ?? '阳光客厅'
  }
}
