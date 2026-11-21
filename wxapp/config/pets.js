const { assetUrl } = require("./cdn");

const KOI_SETS = [
  { id: "set_duck", name: "小黄鸭雨衣", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_duck.png", thumb: "assets/koi-v2b/work/sets/thumb_set_duck.png" },
  { id: "set_yukata", name: "夏日祭浴衣", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_yukata.png", thumb: "assets/koi-v2b/work/sets/thumb_set_yukata.png" },
  { id: "set_sailor", name: "小海军水手", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_sailor.png", thumb: "assets/koi-v2b/work/sets/thumb_set_sailor.png" },
  { id: "set_strawberry_pj", name: "草莓睡衣", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_strawberry_pj.png", thumb: "assets/koi-v2b/work/sets/thumb_set_strawberry_pj.png" },
  { id: "set_mushroom", name: "森林小蘑菇", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_mushroom.png", thumb: "assets/koi-v2b/work/sets/thumb_set_mushroom.png" },
  { id: "set_baker", name: "小厨师烘焙", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_baker.png", thumb: "assets/koi-v2b/work/sets/thumb_set_baker.png" },
  { id: "set_astronaut", name: "复古宇航员", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_astronaut.png", thumb: "assets/koi-v2b/work/sets/thumb_set_astronaut.png" },
  { id: "set_lion", name: "新年小醒狮", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_lion.png", thumb: "assets/koi-v2b/work/sets/thumb_set_lion.png" },
  { id: "set_trex", name: "暴走霸王龙", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_trex.png", thumb: "assets/koi-v2b/work/sets/thumb_set_trex.png" },
  { id: "set_triceratops", name: "针织三角龙", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_triceratops.png", thumb: "assets/koi-v2b/work/sets/thumb_set_triceratops.png" },
  { id: "set_eggshell_dino", name: "破壳小恐龙", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_eggshell_dino.png", thumb: "assets/koi-v2b/work/sets/thumb_set_eggshell_dino.png" },
  { id: "set_stego", name: "粉黄小剑龙", price: 20, tex: "assets/koi-v2b/work/sets/tex_set_stego.png", thumb: "assets/koi-v2b/work/sets/thumb_set_stego.png" }
];

const YUTU_ACCESSORIES = [
  { id: "strawberry", slot: "head", name: "草莓针织帽", x: 126, y: 176, w: 349, h: 276 },
  { id: "crown", slot: "head", name: "小皇冠", x: 156, y: 187, w: 288, h: 288 },
  { id: "beanie", slot: "head", name: "暖绒毛线帽", x: 141, y: 117, w: 319, h: 337 },
  { id: "bow", slot: "head", name: "甜心蝴蝶结", x: 236, y: 228, w: 280, h: 304 },
  { id: "flower", slot: "head", name: "春日花环", x: 79, y: 279, w: 443, h: 231 },
  { id: "straw", slot: "head", name: "田园小草帽", x: 151, y: 187, w: 298, h: 308 },
  { id: "scarf_stripe", slot: "neck", name: "条纹围巾", x: 60, y: 560, w: 486, h: 267 },
  { id: "scarf_caramel", slot: "neck", name: "焦糖围巾", x: 51, y: 588, w: 482, h: 328 }
];

const PETS = {
  koi: {
    id: "koi",
    label: "锦鲤",
    drawerTitle: "套装 (12)",
    mode: "sets",
    canvasW: 640,
    canvasH: 780,
    // 舞台坐标采用逻辑 390 x 844 空间；脚底位于 y=412，完整露出在底栏抽屉上方
    scale: 0.403614,
    feetStageX: 195,
    feetStageY: 412,
    // 导出 780 x 1688 高清壁纸时的比例与脚底落点
    exportScale: 0.88,
    exportFeetX: 390,
    exportFeetY: 1312,
    cx: 328,
    feetY: 771,
    neck: { x: 328, y: 613 },
    head: { x: 328, y: 398, rx: 255, ry: 149 },
    earL: { x: 310, y: 179 },
    earR: { x: 346, y: 179 },
    bodyY: 505,
    earAmp: 0.35,
    useEyeShader: true,
    // NPOT 直接映射 0..1 UV，按 640 x 780 归一化
    eyeLUV: [247.59 / 640, 375.36 / 780, 56.0 / 640, 54.0 / 780],
    eyeRUV: [396.73 / 640, 377.26 / 780, 56.0 / 640, 54.0 / 780],
    textures: {
      base: assetUrl("assets/koi-v2b/work/sets/tex_base_ext.png"),
      closed: assetUrl("assets/koi-v2b/work/sets/eyes_closed.png"),
      doze: assetUrl("assets/koi-v2b/work/sets/eyes_doze.png")
    },
    items: KOI_SETS.map((s) => ({
      id: s.id,
      slot: "set",
      name: s.name,
      price: s.price,
      texUrl: assetUrl(s.tex),
      thumbUrl: assetUrl(s.thumb)
    }))
  },
  yutu: {
    id: "yutu",
    label: "玉兔",
    drawerTitle: "配饰 (8)",
    mode: "accessories",
    canvasW: 600,
    canvasH: 1119,
    scale: 0.295,
    feetStageX: 195,
    feetStageY: 412,
    exportScale: 0.70,
    exportFeetX: 390,
    exportFeetY: 1312,
    cx: 301,
    feetY: 1105,
    neck: { x: 301, y: 668 },
    head: { x: 301, y: 520, rx: 215, ry: 200 },
    earL: { x: 205, y: 348 },
    earR: { x: 405, y: 348 },
    bodyY: 870,
    earAmp: 1.0,
    useEyeShader: false,
    eyeLUV: [0, 0, 1, 1],
    eyeRUV: [0, 0, 1, 1],
    textures: {
      base: assetUrl("assets/v2b/work/tex_base.png"),
      closed: assetUrl("assets/v2b/work/tex_closed.png"),
      doze: assetUrl("assets/v2b/work/tex_doze.png")
    },
    items: YUTU_ACCESSORIES.map((it) => ({
      ...it,
      texUrl: assetUrl(`assets/v2b/work/dress/extract/acc_${it.id}.png`),
      thumbUrl: assetUrl(`assets/v2b/work/dress/extract/thumb_${it.id}.png`)
    }))
  }
};

module.exports = {
  PETS
};
