export type CozyRoomId = 'living' | 'bedroom' | 'cafe' | 'matcha'
export type AccSlot = 'head' | 'neck'
export type CozyActionId = 'pet' | 'nap' | 'coffee' | 'sun'

export type CozyRoomDef = {
  id: CozyRoomId
  name: string
  subtitle: string
  bg: string
  thumb: string
  /** Optional warm night-lamp halo position (% of stage) */
  lamp?: { x: number; y: number; size: number }
  /** Optional coffee steam origin (% of stage) */
  steam?: { x: number; y: number }
  /** Greeting when switching into this room */
  line: string
}

export type CozyAccDef = {
  id: string
  name: string
  slot: AccSlot
  layer: string
  thumb: string
}

export type CozyActionDef = {
  id: CozyActionId
  name: string
  icon: string
  line: string
  emote: 'pet' | 'nap' | 'happy' | 'sway'
  particle: 'heart' | 'sparkle' | 'note' | 'zzz'
  durationMs: number
}

const base = import.meta.env.BASE_URL

export const COZY_ROOMS: CozyRoomDef[] = [
  {
    id: 'living',
    name: '阳光客厅',
    subtitle: '贝壳沙发 · 绒地毯',
    bg: `${base}cozy/rooms/living.webp`,
    thumb: `${base}cozy/rooms/thumb_living.webp`,
    lamp: { x: 20, y: 38, size: 220 },
    line: '贝壳沙发软乎乎的，晒太阳最舒服啦 ☀️',
  },
  {
    id: 'bedroom',
    name: '奶油卧室',
    subtitle: '小夜灯 · 植物画',
    bg: `${base}cozy/rooms/bedroom.webp`,
    thumb: `${base}cozy/rooms/thumb_bedroom.webp`,
    lamp: { x: 89, y: 40, size: 170 },
    line: '壁架上的小夜灯暖融融的，好安心~',
  },
  {
    id: 'cafe',
    name: '手冲咖啡角',
    subtitle: '陶瓷杯 · 垂吊绿植',
    bg: `${base}cozy/rooms/cafe.webp`,
    thumb: `${base}cozy/rooms/thumb_cafe.webp`,
    lamp: { x: 18, y: 36, size: 200 },
    steam: { x: 76, y: 24 },
    line: '闻到焦糖拿铁的香气了嘛 ☕',
  },
  {
    id: 'matcha',
    name: '抹茶休闲角',
    subtitle: '懒人坐垫 · 原木几',
    bg: `${base}cozy/rooms/matcha.webp`,
    thumb: `${base}cozy/rooms/thumb_matcha.webp`,
    lamp: { x: 18, y: 38, size: 200 },
    line: '坐在抹茶小坐垫上发会儿呆吧 🍵',
  },
]

export const COZY_ACCESSORIES: CozyAccDef[] = [
  {
    id: 'beanie',
    name: '毛线帽',
    slot: 'head',
    layer: `${base}cozy/acc/acc_beanie.webp`,
    thumb: `${base}cozy/acc/thumb_beanie.webp`,
  },
  {
    id: 'strawberry',
    name: '草莓帽',
    slot: 'head',
    layer: `${base}cozy/acc/acc_strawberry.webp`,
    thumb: `${base}cozy/acc/thumb_strawberry.webp`,
  },
  {
    id: 'straw',
    name: '小草帽',
    slot: 'head',
    layer: `${base}cozy/acc/acc_straw.webp`,
    thumb: `${base}cozy/acc/thumb_straw.webp`,
  },
  {
    id: 'crown',
    name: '小皇冠',
    slot: 'head',
    layer: `${base}cozy/acc/acc_crown.webp`,
    thumb: `${base}cozy/acc/thumb_crown.webp`,
  },
  {
    id: 'flower',
    name: '小花环',
    slot: 'head',
    layer: `${base}cozy/acc/acc_flower.webp`,
    thumb: `${base}cozy/acc/thumb_flower.webp`,
  },
  {
    id: 'bow',
    name: '蝴蝶结',
    slot: 'head',
    layer: `${base}cozy/acc/acc_bow.webp`,
    thumb: `${base}cozy/acc/thumb_bow.webp`,
  },
  {
    id: 'scarf_caramel',
    name: '焦糖围巾',
    slot: 'neck',
    layer: `${base}cozy/acc/acc_scarf_caramel.webp`,
    thumb: `${base}cozy/acc/thumb_scarf_caramel.webp`,
  },
  {
    id: 'scarf_stripe',
    name: '条纹围巾',
    slot: 'neck',
    layer: `${base}cozy/acc/acc_scarf_stripe.webp`,
    thumb: `${base}cozy/acc/thumb_scarf_stripe.webp`,
  },
]

export const COZY_ACTIONS: CozyActionDef[] = [
  {
    id: 'pet',
    name: '摸头贴贴',
    icon: '🥰',
    line: '嘿嘿，耳朵痒痒的，最喜欢你啦 ♥',
    emote: 'pet',
    particle: 'heart',
    durationMs: 1600,
  },
  {
    id: 'nap',
    name: '眯眼打盹',
    icon: '💤',
    line: '暖呼呼的，眯一小会儿…',
    emote: 'nap',
    particle: 'zzz',
    durationMs: 3200,
  },
  {
    id: 'coffee',
    name: '喝热拿铁',
    icon: '☕',
    line: '温热的奶泡甜到心里啦~',
    emote: 'sway',
    particle: 'sparkle',
    durationMs: 2400,
  },
  {
    id: 'sun',
    name: '开心蹦跶',
    icon: '✨',
    line: '今天也是被阳光抱住的一天！',
    emote: 'happy',
    particle: 'note',
    durationMs: 2000,
  },
]

export const BUNNY_SPRITES = {
  base: `${base}cozy/bunny/base.webp`,
  closed: `${base}cozy/bunny/closed.webp`,
  doze: `${base}cozy/bunny/doze.webp`,
}
