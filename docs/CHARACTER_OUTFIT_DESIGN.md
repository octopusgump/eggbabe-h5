---
version: "1.0"
updated: "2026-11-23"
name: "eggbabe 角色服装设计规范 & 生图提示词指南"
description: "蛋宝宝双角色（玉兔 Yutu / 锦鲤 Koi）换装美术设计、Chroma-Key 生图 Prompt、抠图后处理与跨端 PNG 交付质检规范。"
companionTo: "DESIGN_SYSTEM.md"
scope:
  - wechat-miniprogram
  - h5

palette:
  maxColorsPerOutfit: 3
  style: "low-saturation tactile handmade"
  boundaryNote: "独立于 DESIGN_SYSTEM.md 的 UI 固定色板；角色服装使用低饱和手作色域，页面 UI 控件仍严格遵守 DESIGN_SYSTEM.md。"

globalBans:
  - pink-cheek-blush
  - food-costume-dress
  - high-saturation-neon-or-garish-red-gold
  - ambiguous-3d-muzzle-geometry
  - glossy-plastic-or-tight-spandex
  - webp-delivery

chromaKey:
  aspectRatio: "1:1"
  singlePortraitOnly: true
  screens:
    blue:
      hex: "#0044FF"
      useWhen:
        - "outfit-contains-green"
        - "translucent-glass-dome-or-prop"
    green:
      hex: "#00FF00"
      useWhen:
        - "outfit-contains-blue-or-slate"
        - "warm-or-neutral-palette-without-green"

characters:
  yutu:
    displayName: "玉兔 (Yutu)"
    material: "奶油色短绒羊毛毡 (cream needle-felted wool)"
    proportion: "头大身圆潮玩直立全身"
    identityLocks:
      - "大圆深棕眼（带纯白眼白圈）"
      - "灰蓝色倒三角鼻"
      - "轻微笑嘴"
      - "脸颊两侧各 3 根灰蓝色胡须印"
      - "双长兔耳干净完整竖立露在帽子/兜帽外部"
    propHand: "viewer-right-paw"
    blinkMode: "frame-swap"
    deliveryFrames:
      - "default"
      - "_closed"
      - "_doze"
    thumbnailPattern: "thumbs/yutu_set_<id>.png"
  koi:
    displayName: "锦鲤 (Koi)"
    material: "奶油白短卷毛 (cream bouclé / terry fleece)"
    proportion: "头身一体圆球形 + 两条短腿圆润小雨靴"
    identityLocks:
      - "头顶竖立暖焦糖棕毛绒小背鳍"
      - "身体两侧暖焦糖棕圆侧鳍自然探出"
      - "大圆白眼球（纯黑大瞳孔 + 白色高光点）"
      - "极简黑色弯弧微笑嘴（无鼻、无胡须）"
      - "圆润小雨靴（默认鹅黄，可随套装换色）"
    propHand: "optional-integrated"
    blinkMode: "webgl-eye-shader"
    deliveryFrames:
      - "default"
    thumbnailPattern: "thumbs/koi_set_<id>.png"
    catalogFields:
      - "eyeLUV"
      - "eyeRUV"

delivery:
  format: "PNG"
  forbiddenFormats:
    - "WebP"
  compressionCmd: "pngquant --quality=80-95 --speed=3 --strip"
  targetDir: "assets/shared/png/"
  forbiddenDir: "assets/shared/webp/"
  legacyDirs:
    - "assets/v2b/work/"
    - "assets/koi-v2b/work/"
  qa:
    cornerAlpha: 0
    maxAlignErrorPx: 1.5
    alignReference: "tex_base.png"
    zeroWhiteFringe: true
    zeroSpill: true
    zeroGroundShadow: true
  webgl:
    premultiplyAlpha: true
    blendFunc: "gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)"
    mipmapFilter: "LINEAR_MIPMAP_LINEAR"
---

# eggbabe 角色服装设计规范 & 生图提示词指南（玉兔 Yutu / 锦鲤 Koi）

> **定位**：与全局 UI 设计系统 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) 配套的**角色美术与资产生产专项规范**。所有结构化约束与交付阈值以顶部 **YAML Frontmatter** 为准；本文覆盖双角色本体锁定、服装审美原则、标准生图 Prompt 模板及双端 PNG 交付质检。
>
> **与 UI 规范的色板边界**：角色服装采用低饱和手作色域（每套 `2–3` 色），不受 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) 固定 UI Hex 色值限制；但承载换装的界面按钮、抽屉、轻提示与背景容器，仍须严格遵守 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)。

---

## 1. 双角色本体锁定（不可妥协）

### 1.1 玉兔（Yutu）

| 维度 | 锁定要求 |
| --- | --- |
| 材质与体型 | 奶油色短绒羊毛毡直立小兔，保持原版头大身圆的潮玩比例与正面直立全身站姿 |
| 五官与表情 | 大圆深棕眼（带纯白眼白圈）、灰蓝色倒三角鼻、轻微笑嘴、脸颊两侧各 3 根灰蓝色胡须印 |
| 结构与红线 | **绝对禁止粉色/红色腮红或红晕**；**两只长兔耳必须干净、完整地竖立露在帽子/兜帽外面**，不得压塌、弯折或遮挡 |
| 道具位 | 单手（画面右侧爪子）拿一个圆润、一眼可辨识的小道具 |

### 1.2 锦鲤（Koi）

| 维度 | 锁定要求 |
| --- | --- |
| 材质与体型 | 奶油白短卷毛（bouclé / terry fleece）**头身一体的圆球形**小鱼玩具，两条短腿配圆润小雨靴（默认鹅黄，可随套装换色） |
| 特征与五官 | 头顶竖立暖焦糖棕毛绒小背鳍、身体两侧各一只暖焦糖棕圆侧鳍、大圆白眼球（纯黑大瞳孔 + 白色高光点）、极简黑色弯弧微笑嘴（无鼻、无胡须） |
| 结构与红线 | **绝对禁止粉色腮红**；服装须顺应**圆球形头身一体轮廓**（包球连体兜帽、蛋壳、雨衣、水手领、浴衣等），两侧焦糖色小侧鳍自然探出，双脚小雨靴保持圆润稳重 |

---

## 2. 通用核心设计原则（DOs）

1. **强轮廓包裹感（Hooded & Wrapped Silhouette）**
   - **玉兔优先**：动物伪装兜帽、巴拉克拉法头套、法式针织包头帽、针织三角头巾、羊羔绒护耳雷锋帽、盘头毛巾卷、大褶兜帽袍。
   - **锦鲤优先**：动物/恐龙连体包球套（霸王龙、三角龙、剑龙、破壳恐龙）、雨衣兜帽、大蘑菇帽、玻璃球宇航头盔、水手帽/厨师帽。
2. **反差萌 × 文化热梗 × 软萌日常（Theme Pillars）**
   - **动物反差伪装**：大灰狼、小鲨鱼、森林锯齿怪、卡皮巴拉、小绵羊、小企鹅、雨天青蛙、各式小恐龙。
   - **文化 / IP / 热梗手作化**：GTA 劫匪头套、原力喝汤兜帽、贝克街侦探、海拉鲁毛线勇者、摸鱼渔夫。
   - **高质感日常 / 治愈氛围**：泡泡浴袍、韩系芭蕾针织、法式雏菊头巾、Y2K 拍立得、手冲咖啡师、星月占星、小黄鸭雨衣、夏日浴衣、烘焙厨师。
3. **真实手作织物肌理（Tactile Materials）**
   - 强调**羊毛毡（needle-felted wool）、粗棒针/绞花针织（chunky cable knit）、珊瑚绒（coral fleece）、羊羔绒（sherpa bouclé）、华夫格毛巾（waffle weave）、灯芯绒（corduroy）、粗麻布、哑光磨砂雨衣布**，与角色本体绒毛自然融合。
4. **低饱和克制配色（2–3 Colors Max）**
   - 单套主色控制在 **2–3 个以内**，偏爱奶油白、燕麦色、暖炭灰、焦糖棕、鹅黄、干枯玫瑰粉、鼠尾草绿、雾霾蓝、烟熏灰紫，整体干净耐看。
5. **简洁讨巧的小道具**
   - 玉兔由画面右侧爪子单手持圆润易辨识的小物件（`$` 钱袋、牛角包、小黄鸭、小蘑菇、抹茶杯、拍立得、小咸鱼、拿铁杯等），不喧宾夺主。

---

## 3. 避坑红线（DON'Ts）

- **拒绝食物成精裙**：不要把松饼、奶油裱花、草莓等食物直接堆砌成杂乱衣服或歪戴的小饼干帽。
- **拒绝高饱和刺眼配色**：避免荧光色、大红大金与繁琐刺绣（除非明确做节日限定款，且仍须控制饱和度与细节密度）。
- **拒绝脸颊粉色腮红**：两只角色均保持干净无腮红。
- **拒绝歧义几何细节**：动物兜帽的口鼻刺绣保持平整极简（平面刺绣），避免多余立体鼓包或竖向裂隙。
- **拒绝亮面塑料 / 紧身衣质感**：科幻、超英、雨具等题材一律转译为哑光磨砂布、绗缝棉、羊毛毡、粗针织等软糯手作质感。

---

## 4. 标准生图 Prompt 模板（Chroma-Key 1:1 单人母图）

生成生产素材时，**每套单独输出 1 张 1:1 全身母图**（禁止 2×2 拼图），以角色基础贴图 `tex_base.png` 作为第一张参考图，并严格锁定正面单一机位。

- **幕布选色规则**：
  - 服装含**绿色**或**半透明玻璃球** → 纯平 **蓝幕 `#0044FF`**；
  - 服装含**蓝色/灰蓝**或纯暖色无绿 → 纯平 **绿幕 `#00FF00`**。

### 4.1 玉兔（Yutu）Prompt 模板

```text
Single full-body front-facing standing toy portrait of the adorable cream needle-felted wool bunny from the first reference image wearing <OUTFIT_THEME>: <HOOD_OR_HAT_DESCRIPTION> snugly wrapping its round head (with both long upright cream bunny ears poking cleanly straight out of the top), <BODY_OUTFIT_DESCRIPTION>, and holding a plump cute <PROP_DESCRIPTION> in its right paw (viewer's right side).
Keep exact face and body identity from the first reference image: big round dark brown eyes with pure white sclera rings, small grey-blue inverted triangle nose, gentle small smile, 3 grey-blue whisker marks on each cheek, strictly NO pink cheek blush, soft muted 2-3 color palette (<COLORS>), realistic tactile <MATERIALS> textures.
Isolated floating on a 100% FLAT SOLID UNIFORM CHROMA-KEY <BLUE (#0044FF) | GREEN (#00FF00)> BACKGROUND with ZERO floor, ZERO horizon line, ZERO cast shadow, ZERO ground shadow, ZERO vignette, ZERO <blue | green> bounce light on the toy.
Crisp studio macro photography, centered with generous solid <blue | green> margin all around.
```

### 4.2 锦鲤（Koi）Prompt 模板

```text
Single full-body front-facing standing toy portrait of the adorable round cream terry-fleece koi fish plush toy from the first reference image wearing <OUTFIT_THEME>: <HOOD_OR_ONESIE_DESCRIPTION> snugly wrapping its spherical round body (keeping its two warm caramel-brown plush side fins poking out cleanly on the left and right, and matching matte rounded rain boots on its two short legs).
Keep exact face and body identity from the first reference image: round spherical cream bouclé body, two big round white eyes with glossy black pupils, simple curved black stitched smile, NO nose, strictly NO pink cheek blush, soft muted 2-3 color palette (<COLORS>), realistic tactile <MATERIALS> textures.
Isolated floating on a 100% FLAT SOLID UNIFORM CHROMA-KEY <BLUE (#0044FF) | GREEN (#00FF00)> BACKGROUND with ZERO floor, ZERO horizon line, ZERO cast shadow, ZERO ground shadow, ZERO vignette, ZERO <blue | green> bounce light on the toy.
Crisp studio macro photography, centered with generous solid <blue | green> margin all around.
```

---

## 5. 工程交付、抠图与质检规范（H5 + 微信小程序双端兼容）

### 5.1 格式与目录规范

- **统一压缩 PNG，严禁 WebP**：全部线上贴图、缩略图 Icon 与舞台背景统一使用以下命令压缩为透明 PNG：
  ```bash
  pngquant --quality=80-95 --speed=3 --strip <input.png>
  ```
- **目标交付目录**：统一存放在 `assets/shared/png/`（禁止使用或保留 `assets/shared/webp/`）。
  > 注：`assets/shared/png/` 为新管线目标交付结构；仓库现有 `assets/v2b/work/` 与 `assets/koi-v2b/work/` 为历史工作目录，随管线升级逐步迁移。

### 5.2 角色交付物差异

| 角色 | 眨眼方案 | 单套必交贴图 | 缩略图与配置 |
| --- | --- | --- | --- |
| **玉兔（Yutu）** | 序列帧切换 | 3 张：默认帧 + `_closed` 闭眼帧 + `_doze` 瞌睡帧 | `thumbs/yutu_set_<id>.png` |
| **锦鲤（Koi）** | WebGL Eye Shader 实时眨眼 | 1 张：主贴图 | `thumbs/koi_set_<id>.png`，并在 `catalog.json` 记录 `eyeLUV` / `eyeRUV` |

### 5.3 抠图后处理与 WebGL 渲染要点

- **零白边抠图**：扣色后必须执行**暖色去溢色（warm despill）**与**半透明边缘 3 轮前景向内 RGB 补色（inward edge bleed）**，防止奶油绒毛与帽檐残留绿/蓝反光或灰白毛边。
- **半透明玻璃件**：含气泡头盔或玻璃道具时须使用蓝幕，并在玻璃罩区域通过蓝通道衰减反算光学 Alpha 与中性白高光色。
- **WebGL 纹理渲染**：对齐画布后上传至 POT 纹理，开启 `generateMipmap` + `LINEAR_MIPMAP_LINEAR` + `UNPACK_PREMULTIPLY_ALPHA_WEBGL = true`，混合模式固定使用 `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`。

### 5.4 交付质检红线

- [ ] 四角 `alpha == 0`，四周留白不裁切高帽、长耳或尾鳍。
- [ ] 叠加非纯色场景底图放大检查：零白边、零绿/蓝溢色、脚底与腿间零地面阴影残留。
- [ ] 眼睛中心与脚底相对 `tex_base.png` 像素对齐误差 `<= 1.5px`。
- [ ] 全量产物均为 `pngquant` 压缩 PNG，无任何 `.webp` 残留。

---

## 附录：新增宠物接入 Checklist

当蛋宝宝新增第 3、4 只宠物时，按以下清单同步扩展顶部 YAML 与正文，避免破坏既有结构：

1. **本体锁定卡**：补齐材质与体型比例、五官特征、不可遮挡的关键轮廓部件（如耳/鳍/尾）与强制禁止项。
2. **轮廓与道具偏好**：列出适配该体型的首选头饰/服装剪裁与道具承载方式。
3. **专属 Prompt 模板**：沿用第 4 节 Chroma-Key 尾段约束，仅替换本体身份与服装结构槽位。
4. **交付与渲染协议**：明确眨眼方案（帧切换 vs Shader）、单套产出帧数、缩略图命名 `thumbs/<pet>_set_<id>.png` 及 `catalog.json` 所需 UV 字段。
