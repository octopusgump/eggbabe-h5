# eggbabe-h5

蛋宝宝（Eggbabe）互动毛绒 H5 与小程序统一仓库。**`main` 分支为 GitHub Pages 唯一线上发布源**。

## 唯一对外线上主链接

**https://octopusgump.github.io/eggbabe-h5/**

打开即直接进入 **蛋宝宝装扮屋（Uni-app 一码双端正式版）**：
- 锦鲤 12 套全身套装、玉兔 8 款配饰、11 套小屋背景自由搭配
- 摸头 / 跳跃 / 眨眼 WebGL 互动动画 + 一键导出 780×1688 高清壁纸
- 舞台右侧悬浮 UI Icon 一键切换扩展场景：
  - **🏠 小屋** → [玉兔小屋 · 模块升级版](https://octopusgump.github.io/eggbabe-h5/yutu-house-mod.html)（2D 寻路 + 四房粘土模块）
  - **🐑 牧场** → [蛋宝宝牧场](https://octopusgump.github.io/eggbabe-h5/danbaobao-meadow.html)（Three.js 3D 小羊草场）

> 旧版链接 `assets/dress_pets_demo.html` 已做 0 秒自动重定向至主链接；历史单页基线仅保留在仓库内作构建与资产对照，不再对外展示。

---

## 一码双端与热更新架构（`eggbabe-uni/`）

详见 [`eggbabe-uni/README.md`](eggbabe-uni/README.md)：

1. **一码双端编译**：同一套 Vue 3 + Vite 代码（`eggbabe-uni/src/pages/index/index.vue` + 跨端 WebGL 引擎 `petStage.js` + 壁纸导出 `wallpaperExporter.js`）：
   - `npm run build:h5` → 输出到 [`eggbabe-uni/site/`](eggbabe-uni/site/)（推送 `main` 即通过根入口上线）
   - `npm run build:mp-weixin` → 输出标准原生微信小程序包 `eggbabe-uni/dist/build/mp-weixin/`
   - `npm run build:mp-toutiao` → 预留抖音小程序构建
2. **远程内容热更新（免审核小迭代）**：
   - 统一清单：[`assets/shared/catalog.json`](assets/shared/catalog.json)（11 套背景 + 锦鲤 12 套装 + 玉兔 8 配饰）
   - H5 与微信小程序启动时均通过 `eggbabe-uni/src/config/catalogLoader.js` 拉取线上清单（离线自动回退本地快照）

---

## 目录索引

| 路径 | 说明 |
| :--- | :--- |
| [`index.html`](index.html) | 唯一对外主入口（直接呈现 `eggbabe-uni/site/` + 右侧小屋/牧场 UI Icon） |
| [`eggbabe-uni/`](eggbabe-uni/) | **主工程**：Uni-app Vue 3 一码双端装扮与轻陪伴电子宠物（H5 + 微信小程序） |
| [`docs/prd/`](docs/prd/0001-light-companion-pet.md) | **产品需求文档（PRD）**：[`0001` 轻陪伴电子宠物](docs/prd/0001-light-companion-pet.md) · [`0002` 破壳起居室、试衣间与带妆明信片](docs/prd/0002-living-room-fitting-and-postcard.md) |
| [`living-room-dress/`](living-room-dress/) | **破壳起居室 × 专属试衣间**：小程序 1:1 同源三屏全景、WebGL 试衣台与零 Token 带妆明信片 |
| [`assets/shared/catalog.json`](assets/shared/catalog.json) | 换装与背景统一热更新清单 |
| [`yutu-house-mod/`](yutu-house-mod/) | 玉兔小屋模块升级版工程（路线 B） |
| [`danbaobao-meadow/`](danbaobao-meadow/) | 蛋宝宝牧场 Three.js 工程 |
| [`yutu-house/`](yutu-house/) | 早期无桥玉兔小屋单文件交接归档 |
| [`PLAN.md`](PLAN.md) / [`CONTEXT.md`](CONTEXT.md) | 历史规划与技术基线记录 |