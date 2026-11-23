# AGENTS.md — eggbabe-h5 项目规范与记忆

## 1. 资源格式规范（强制）
- **统一使用压缩 PNG（`assets/shared/png/`），严禁使用或保留 `assets/shared/webp/` 目录。**
- **原因**：本项目需同时兼容 **H5 与微信小程序**（含小程序 `<image>`、Canvas 2D 与 WebGL `createImage()`）；WebP 在部分 iOS 微信客户端与开发者工具中存在解码兼容隐患，而 PNG 全端 100% 原生兼容。
- **压缩标准**：新资源入库前统一使用 `pngquant --quality=80-95 --speed=3 --strip` 生成高质量压缩 PNG，放置于：
  - 角色贴图：`assets/shared/png/yutu_*.png`、`assets/shared/png/koi_*.png`
  - 服装抽屉缩略图 Icon：`assets/shared/png/thumbs/*.png`
  - 舞台背景：`assets/shared/png/bgs/*.png`
- [`assets/shared/catalog.json`](assets/shared/catalog.json) 中所有图片路径必须指向 `assets/shared/png/*.png`。

## 2. 玉兔 (Yutu) 服装设计审美规范
- **DOs**：包头感/兜帽感（长兔耳必须干净、完整地竖立露在外面）；反差萌动物伪装、文化/热梗与软萌居家日常；真实羊毛毡/粗棒针/珊瑚绒/华夫格肌理；低饱和 2–3 色；单手圆润讨巧小道具。
- **DON'Ts**：拒绝把食物直接堆成衣服；拒绝高饱和红金民俗喜庆风；**严禁在玉兔脸上添加粉色腮红**；绝对保持原版大圆深棕眼、灰蓝倒三角鼻与两侧各 3 根灰蓝胡须。
- **生成流水线**：使用 `chroma-transparent-character-png` 规范（1:1 绿/蓝幕无影母图 → `assets/v2b/work/prepare_yutu_sets.py` 抠图对齐 → `pngquant` 压缩至 `assets/shared/png/` → 更新 `assets/shared/catalog.json` → `npm --prefix eggbabe-uni run build:h5`）。
