# 破壳起居室 × 专属试衣间 × 零 Token 带妆明信片（小程序 1:1 同源全景版）

对应规范文档：[`docs/prd/0002-living-room-fitting-and-postcard.md`](../docs/prd/0002-living-room-fitting-and-postcard.md)

## 核心特性
1. **1:1 复刻 `eggbabe-miniprogram` 破壳主场景视觉与动效**：
   - 官方 `2823 × 1672` 连续三屏全景（左屏原木小床 · 中屏书桌软木垫 · 右屏纱帘大窗与圆边几），覆盖 `白天 / 落日 / 黑夜` 三时段与玉兔、锦鲤全套 8 种日常动作全景（睡觉、小憩、发呆、涂涂画画、看书、打游戏、听音乐、看窗外）；
   - 左上三阶可展开陪伴星星牌（`.pet-mood-tab--post-hatch`，含哑光挤捏陪伴星、滚字动效与每日心情）+ 可切换圆盘指针/数字电子小挂钟（`.room-clock`）；
   - 顶中三屏指示点（`.screen-dots`）、中场 `34vh` 双层场景反馈栈（`.scene-feedback-stack`）、左下 3D 信封/伙伴圆标与右下 3D 开盖百宝箱（`.companion-toolbox`）；
   - 右上验收工具默认隐藏，支持 `?demo=1` 或 `2.4s` 内连点左上状态牌 5 次唤出。
2. **同场景推镜「专门试衣间」**：
   - 点击右下 3D 针织衣架圆钮或桌面微距原木小立镜，镜头推近书桌软木垫，自动计算全身安全框（长耳与裙摆零遮挡）；
   - 接入 [`../assets/shared/catalog.json`](../assets/shared/catalog.json) 全量套装（玉兔 24 套 + 锦鲤 12 套），支持未拥有限定款**免费上身动态试穿（Try-Before-You-Buy）**与陪伴星星滚字解锁。
3. **零 Token 带妆插画拍立得 × 竖红线折角信笺 × 纪念册**：
   - 前端确定性 WebGL 姿态快照 + 场景接触软阴影 + 环境光染色合成纯净画心；
   - 嵌入小程序同款竖红线折角信笺（`.today-companion-letter`），收下后钉上房间白墙并存入 `#FAFAF8` 全屏画布「纪念册」（`遇见 | 明信片` 双页签，仅存轻量 JSON 元数据，零存储溢出隐患）。

## 资源重生成
```bash
python3 living-room-dress/prepare_scene_assets.py
```
所有图片资产严格遵守 [`AGENTS.md`](../AGENTS.md) 压缩 PNG 规范（零 `.webp`）。
