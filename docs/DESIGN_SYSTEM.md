---
version: "1.0"
updated: "2026-11-23"
name: "蛋宝宝 Design System"
description: "蛋宝宝跨端（微信小程序 / H5）全局界面设计系统，定义可跨页面复用的色彩、排版、几何、动效与核心组件规范。"
scope:
  - wechat-miniprogram
  - h5
baseWidth: "375px"
miniProgramScale: 2

colors:
  brand:
    ink: "#002900"
    ink-pressed: "#001A00"
    ink-border-soft: "rgba(0, 41, 0, 0.24)"
    egg-green: "#9DB65B"
    egg-yellow: "#EDE78E"
    egg-pink: "#F4B9AE"
  neutral:
    text: "#1A1A1A"
    text-muted: "#5C5C5C"
    text-faint: "#8C8C88"
    canvas: "#FFFFFF"
    page: "#FAFAF8"
    hairline: "#E5E3DF"
    hairline-strong: "#CFCBC4"
    ink-surface: "#E5EBE5"
  semantic:
    green-surface: "#F5F8ED"
    green-on-tint: "#54632C"
    yellow-surface: "#FAFAEF"
    yellow-on-tint: "#6E6B35"
    pink-surface: "#FFF6F5"
    pink-on-tint: "#80625D"
    error: "#D9463C"
    error-surface: "#FDECEA"
    error-on-solid: "#FFFFFF"
  overlay:
    notice-bg: "rgba(18, 21, 18, 0.72)"
    notice-bg-alert: "rgba(39, 27, 23, 0.78)"
    notice-border: "rgba(255, 255, 255, 0.16)"
    notice-text: "#FFFFFF"
  deprecated:
    - "#3F5A47"
    - "#ACC861"
    - "#F1EC9A"
    - "#FFC5BA"
    - "#C33F36"

shadows:
  raised: "0 1px 2px rgba(0, 41, 0, 0.06), 0 2px 4px rgba(0, 41, 0, 0.04)"
  floating: "0 4px 12px rgba(0, 41, 0, 0.10)"
  notice: "0 4px 12px rgba(0, 0, 0, 0.18)"

typography:
  fontFamily: "PingFang SC, Helvetica Neue, Microsoft YaHei, sans-serif"
  maxFontWeight: 600
  bodyRange: "12px-15px"
  minReadable: "10px"
  scale:
    title-strong:
      fontSize: "15px"
      fontWeight: 600
    body:
      fontSize: "15px"
      fontWeight: 400
    button-small:
      fontSize: "14px"
      fontWeight: 500
    caption:
      fontSize: "12px"
      fontWeight: 400
    notice:
      fontSize: "11px"
      fontWeight: 600

radii:
  card: "16px"
  pill: "999px"
  circle: "50%"
  egg: "50% 50% 50% 50% / 58% 58% 42% 42%"

sizing:
  action-circle: "56px"
  action-segment: "56px"
  button-default: "48px"
  button-small: "40px"
  nav-bar: "56px"
  list-row-min: "52px"
  notice-min: "32px"

spacing:
  card-padding: "24px"
  list-row-px: "20px"
  switch-row-py: "14px"
  notice-px: "14px"

borders:
  hairline: "0.5px"
  button-outline: "1.5px"

blur:
  notice: "6px"

motion:
  press:
    duration: "160ms-180ms"
    easing: "ease-out"
    scale: 0.98
    opacity: 0.9
  dynamic-card-enter:
    duration: "240ms"
    easing: "ease-out"
    translateY: "6px"
  dynamic-card-leave:
    duration: "180ms"
    easing: "ease-in"
    translateY: "4px"
  memory-highlight-max: "400ms"
  notice-fade:
    duration: "180ms"
    easing: "ease-out"
  notice-duration: "1800ms"

components:
  button:
    radius: "{radii.pill}"
    defaultHeight: "{sizing.button-default}"
    smallHeight: "{sizing.button-small}"
    disabledOpacity: 0.4
    variants:
      primary:
        background: "{colors.brand.ink}"
        backgroundPressed: "{colors.brand.ink-pressed}"
        color: "{colors.neutral.canvas}"
      secondary:
        background: "transparent"
        border: "{borders.button-outline} solid {colors.brand.ink}"
        color: "{colors.brand.ink}"
      secondary-soft:
        background: "transparent"
        border: "{borders.button-outline} solid {colors.brand.ink-border-soft}"
        color: "{colors.brand.ink}"
      danger:
        background: "{colors.semantic.error}"
        color: "{colors.semantic.error-on-solid}"
  card:
    radius: "{radii.card}"
    padding: "{spacing.card-padding}"
    variants:
      base:
        background: "{colors.neutral.canvas}"
        border: "{borders.hairline} solid {colors.neutral.hairline}"
        shadow: "{shadows.raised}"
      tint-green:
        background: "{colors.semantic.green-surface}"
        color: "{colors.semantic.green-on-tint}"
      tint-yellow:
        background: "{colors.semantic.yellow-surface}"
        color: "{colors.semantic.yellow-on-tint}"
      tint-pink:
        background: "{colors.semantic.pink-surface}"
        color: "{colors.semantic.pink-on-tint}"
  nav-bar:
    height: "{sizing.nav-bar}"
    titleColor: "{colors.brand.ink}"
    defaultBg: "{colors.neutral.canvas}"
    canvasPageBg: "{colors.neutral.page}"
    backPressedBg: "{colors.neutral.ink-surface}"
  list-row:
    minHeight: "{sizing.list-row-min}"
    paddingX: "{spacing.list-row-px}"
    background: "{colors.neutral.canvas}"
    pressedBg: "{colors.neutral.ink-surface}"
    divider: "{colors.neutral.hairline}"
  switch-row:
    paddingY: "{spacing.switch-row-py}"
    activeColor: "{colors.brand.egg-green}"
  inline-notice:
    minHeight: "{sizing.notice-min}"
    paddingX: "{spacing.notice-px}"
    radius: "{radii.pill}"
    background: "{colors.overlay.notice-bg}"
    alertBackground: "{colors.overlay.notice-bg-alert}"
    border: "{borders.hairline} solid {colors.overlay.notice-border}"
    color: "{colors.overlay.notice-text}"
    shadow: "{shadows.notice}"
    blur: "{blur.notice}"
    pointerEvents: "none"
  egg-avatar:
    radius: "{radii.egg}"
    shadow: "{shadows.floating}"
  floating-action:
    size: "{sizing.action-circle}"
    radius: "{radii.circle}"
    background: "{colors.neutral.canvas}"
    shadow: "{shadows.floating}"
---

# 蛋宝宝 Design System v1.0

> **定位**：团队（设计、前端、评审与 AI 协作）跨端统一的全局界面设计规范。所有静态 Token 以文件顶部 **YAML Frontmatter** 为唯一事实来源（`375px` 设计稿 `px` 基准）；正文聚焦原则、语义分工、组件行为与禁用红线。

## 使用与边界

1. **优先复用**：新增页面或修改控件时，先从本文的 Token、动效和组件中取用；确实需要新语义色或全局 Token 时，**先补充进顶部 YAML 与本文，再在业务代码中使用**。
2. **页面例外不回写全局**：场景页的季节渐变、首页氛围色、空态展示大字（如 `21px / 42rpx`）属于页面排版例外，不要沉淀为全局 Token。
3. **职责边界**：本文仅覆盖**可跨页面复用的通用 UI 规范**。具体产品流程、剧情与对话规则、单页业务入口逻辑及包装/官网/品牌 VI 由各端 PRD 独立维护；角色服装美术、生图 Prompt 与贴图交付规范见配套专项文档 [CHARACTER_OUTFIT_DESIGN.md](CHARACTER_OUTFIT_DESIGN.md)。

---

## 1. 设计原则

1. **一个页面只有一个视觉焦点**：场景页以角色与空间为主，回忆详情以物件或明信片为主，工具与说明退居次级。
2. **界面服务于陪伴**：保持安静、温暖、可触摸的克制质感；避免通用后台卡片墙、游戏化图鉴与奖励话术。
3. **图片承载场景，原生界面承载信息**：标题、日期、正文、按钮与状态由原生/DOM 界面渲染，不要烘焙进场景图。

---

## 2. 色彩与阴影

色值定义见顶部 `colors` 与 `shadows`；严禁在页面样式中另写近似绿、近似灰。

### 2.1 色彩语义分工

| 分组 | Token | 用途与边界 |
| --- | --- | --- |
| 主色 | `ink` / `ink-pressed` / `ink-border-soft` | 主操作填充与按下态、主描边、次级弱描边、导航标题 |
| 中性文字 | `text` / `text-muted` / `text-faint` | 依次用于一级正文、二级说明、三级辅助信息/右侧值/分组标签 |
| 中性表面与线 | `page` / `canvas` / `hairline` / `hairline-strong` / `ink-surface` | `page` 为暖白页面底，`canvas` 为卡片与导航表面；细线分隔内容；`ink-surface` 用于列表按下态与中性提示底 |
| 品牌点缀 | `egg-green` / `egg-yellow` / `egg-pink` | **仅作小面积点缀与状态色**（如开关开启、蛋壳黄粉渐变占位），不要铺成大段正文底色 |
| 语义浅底 | `green-*` / `yellow-*` / `pink-*` | 浅色提示卡片需搭配同色系深字；**回忆与羁绊区块使用 `pink-surface` + `pink-on-tint`，不要改成绿色卡片** |
| 危险与错误 | `error` / `error-surface` / `error-on-solid` | 危险按钮实心填充与错误说明文字统一用 `error`（`#D9463C`），异常高亮底使用 `error-surface` |

### 2.2 阴影规则

阴影统一带轻微墨绿调（`rgba(0, 41, 0, ...)`），**禁止使用纯黑重阴影**（仅半透明深色轻提示浮层例外）：

- `raised`：普通白底卡片，配合 `hairline` 细边框与暖白页面底拉开层次。
- `floating`：蛋形头像、浮起快捷入口等悬浮元素。
- `notice`：仅用于标准轻提示 `inline-notice`。

### 2.3 废弃色黑名单

旧 PRD §16 品牌色（见 YAML `colors.deprecated`：`#3F5A47`、`#ACC861`、`#F1EC9A`、`#FFC5BA`、`#C33F36`）已全面废弃，**禁止作为设计系统或新页面的色彩来源**。

---

## 3. 字体与排版

- **字体栈**：沿用顶部 `typography.fontFamily`（`PingFang SC` 优先及系统回退）。
- **字重上限 `600`**：PingFang SC 无真正 `700` 粗体，**禁止写 `700` 触发合成粗体**；视觉层级优先依靠字号差与留白，而非加粗。
- **可读范围**：正文优先 `12–15px`（`24–30rpx`），辅助文字不低于 `10px`（`20rpx`）。

| Token | 基准尺寸（`px` / `rpx`） | 字重 | 适用场景 |
| --- | --- | --- | --- |
| `title-strong` | `15px` / `30rpx` | `600` | 导航标题、主/次/危险默认按钮、强调型列表主文 |
| `body` | `15px` / `30rpx` | `400` | 常规正文、标准列表标签 |
| `button-small` | `14px` / `28rpx` | `500` | `button` 的 `size=small` 变体 |
| `caption` | `12px` / `24rpx` | `400` | 列表右侧现值、开关说明、分组标签、辅助说明 |
| `notice` | `11px` / `22rpx` | `600` | `inline-notice` 标准轻提示（单行） |

> 尚未建立全局展示字阶；场景空态等大号标题属于页面排版例外，不纳入全局 Token。

---

## 4. 形状、触控与布局

- **紧凑图标操作**：
  - 单个独立操作：`56×56px`（`112×112rpx`）正圆。
  - 两个及以上同组操作：收纳进同一个胶囊容器，每一段保持 `56×56px`（`112×112rpx`）。
- **按钮形态约束**：所有操作按钮**只用正圆或胶囊（`pill`）**，禁止做成中圆角矩形。
- **容器圆角**：卡片、输入框、确认弹层与底部面板使用中大圆角；标准卡片圆角 `16px`（`32rpx`）、内边距 `24px`（`48rpx`）。
- **蛋形专属边界**：`radii.egg`（`50% 50% 50% 50% / 58% 58% 42% 42%`）**只用于蛋形头像与破壳相关视觉**，禁止当作通用圆角。
- **底部安全区**：固定在屏幕底部的操作栏与页面末尾，必须在常规底部垫高之外叠加 `env(safe-area-inset-bottom)`。

---

## 5. 动效与无障碍

具体时长与位移值见顶部 `motion`：

- **常规按压**：所有按钮及可点击浮起入口统一 `160–180ms ease-out`、`scale(0.98)`、`opacity: 0.9`；禁用态取消点击反馈。
- **动态卡片**：仅对**随状态动态新增或移除**的卡片使用进出场动画（入场 `240ms ease-out` 淡入并上移 `6px / 12rpx` 归位；离场 `180ms ease-in` 淡出并下移 `4px / 8rpx`）。**常驻列表严禁在每次进页时播放入场动画。**
- **情绪节点上限**：回忆卡高光不超过 `400ms`；更长或更显著的动画只留给破壳等核心情绪节点。
- **减少动态效果（Reduced Motion）**：响应系统 `prefers-reduced-motion` 或对应无障碍设置，停用位移、缩放、旋转与循环装饰动画，保留颜色或透明度可表达的静态状态及全部交互入口。

---

## 6. 核心组件

### 6.1 按钮 `button`

- **变体**：`primary`（实心深绿白字）、`secondary`（透明底 + `1.5px / 3rpx` 深绿描边）、`secondary-soft`（透明底 + `1.5px / 3rpx` 弱深绿描边，字仍为 `ink`）、`danger`（实心错误红白字）。
- **尺寸与状态**：默认高 `48px`（`96rpx`），`size=small` 高 `40px`（`80rpx`）；`disabled` 整体 `opacity: 0.4` 且不响应点击与按压缩放。

### 6.2 卡片 `card`

- **`base`**：白底 + 细边框 + `raised` 阴影，用于在暖白页面底上承托主信息块。
- **`tint-green` / `tint-yellow`**：以浅底色 + 同色系深字区分提示信息，不叠加多余边框。
- **回忆 / 羁绊区块**：使用 `pink-surface` + `pink-on-tint`（若组件暂未内置 `tint-pink` 变体，页面按此 Token 组合实现，不要改用绿色卡片）。

### 6.3 导航栏 `nav-bar`

- 内容行高 `56px`（`112rpx`），与圆形返回按钮等高；组件内部自动按设备状态栏高度留位。
- 标题采用 `title-strong` + `ink`，超长单行省略。
- 默认白底 `canvas` + 底部分隔线；画布类页面可切为页面底 `page` 并隐藏底部分隔线。
- 返回按钮按下态：底色 `ink-surface`，`scale(0.98)`。

### 6.4 列表家族 `list-row` / `switch-row` / `collapse-item`

- **`list-row`**：最小高 `52px`（`104rpx`）、左右内边距 `20px`（`40rpx`）；现值放右侧用 `caption` + `text-faint`；可跳转、编辑或拉起选择器的行展示右箭头；组末按需隐藏底部分隔线；按下态铺 `ink-surface`。
- **`switch-row`**：上下内边距 `14px`（`28rpx`），左侧标题 `15px` + 说明 `caption`/`text-faint`，右侧开关开启色用 `egg-green`。
- **`collapse-item`**：问题标题用一级文字 `text`，分类标题用二级文字 `text-muted`。

### 6.5 标准轻提示 `inline-notice`

用于**已经发生、无需用户再决策**的短结果反馈（如「已清空，可以撤销」「蛋壳已更新」）。同类反馈严禁另做其他配色或形状。

- **外观与行为**：胶囊形（高 `≥32px / 64rpx`、水平内边距 `14px / 28rpx`）、单行白字 `notice`、深色半透明底（常规 `notice-bg`，失败或需立即处理用 `notice-bg-alert`）、轻描边与 `notice` 阴影；可叠加 `6px / 12rpx` 背景模糊，但**不能依赖模糊才可读清**。仅 `180ms ease-out` 淡入淡出，停留约 `1800ms`，无倒计时/进度条；设置 `pointer-events: none` 不阻挡底层操作，语义为状态提示而非按钮。
- **文案公式**：一句话写清**「结果 + 必要的下一步」**；禁用「成功啦」「太棒了」等感叹话术；同一结果不要在导航栏、轻提示与系统 Toast 中重复播报。
- **严禁替代以下 4 类界面**：
  1. 需要确认或承担后果的操作 → 用白色确认卡片或底部面板。
  2. 角色说话 → 用既定对白气泡。
  3. 表单校验错误 → 贴在对应输入字段旁。
  4. 持续加载、空态、可重试失败 → 用页面内固定状态区块。

### 6.6 头像与浮起快捷入口

- **`egg-avatar`**：采用 `radii.egg` 非对称蛋形轮廓 + `floating` 阴影；用户头像缺图时作为统一兜底形状。
- **浮起圆形快捷入口**：用于页面角落的悬浮次级入口，采用 `56×56px`（`112×112rpx`）正圆、白底、轻描边与背景模糊，按下反馈 `scale(0.98)`。

---

## 7. 跨端实现映射（微信小程序 & H5）

设计稿统一以 `375px` 宽度为基准，双端按固定倍率换算，保证视觉尺寸完全一致：

| 规范项 | 基准值（H5 / CSS `px`） | 小程序（WXSS `rpx`） |
| --- | --- | --- |
| 通用尺寸 / 字号 / 间距 / 圆角 | `1px` | `2rpx` |
| 细分隔线 `borders.hairline` | `0.5px`（或按需 `1px`） | `1rpx` |
| 按钮描边 `borders.button-outline` | `1.5px` | `3rpx` |
| 按钮高度（默认 / 小 / 圆形操作） | `48px` / `40px` / `56px` | `96rpx` / `80rpx` / `112rpx` |
| 卡片圆角 / 内边距 | `16px` / `24px` | `32rpx` / `48rpx` |
| 列表行最小高 / 左右内边距 | `52px` / `20px` | `104rpx` / `40rpx` |

- **微信小程序**：全局色值对照同步维护于 `miniprogram/app.wxss`；基础组件路径位于 `miniprogram/components/`，底部导航位于 `miniprogram/custom-tab-bar/`；样式统一书写 `rpx`。
- **H5 / Web**：推荐将顶部 YAML Token 映射为 CSS Custom Properties（如 `--eb-color-ink`），直接使用 `px` 基准；移动端页面需开启 `viewport-fit=cover` 以使 `env(safe-area-inset-bottom)` 生效。

---

## 8. 评审红线（Do's & Don'ts）

- **做（Do）**：
  - 优先复用既有 Token 与组件；新语义色先入表后开发。
  - 始终保持单页单一视觉焦点，原生渲染文字信息，尊重系统减少动态效果设置。
  - 所有固定底栏叠加安全区留白，轻提示仅用一句话讲清「结果 + 下一步」。
- **不做（Don't）**：
  - 不用旧 PRD §16 废弃 5 色（含 `#C33F36`），不私造近似绿/近似灰，不用纯黑重阴影。
  - 不给 PingFang SC 写 `font-weight: 700`。
  - 不把按钮做成中圆角矩形，不把蛋形圆角泛化到普通卡片或容器。
  - 不给常驻列表加每次进页的入场动画，不用 `inline-notice` 替代确认弹层、表单报错或固定空/加载态。
