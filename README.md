# eggbabe-h5

蛋宝宝（Eggbabe）互动毛绒 H5 与小程序统一仓库。**`main` 分支为 GitHub Pages 唯一线上发布源**（历史 `yutu-house` 分支仅作归档快照，不再作为对外链接源）。

- **仓库**：<https://github.com/octopusgump/eggbabe-h5>
- **唯一对外总入口**：<https://octopusgump.github.io/eggbabe-h5/>

---

## 线上展示入口对照（均基于 `main` 分支）

| 模块 | 状态 | 线上访问链接 | 说明 |
| :--- | :--- | :--- | :--- |
| **总入口导航页** | **唯一总入口** | <https://octopusgump.github.io/eggbabe-h5/> | 汇总全部子项目与版本说明（根目录 [`index.html`](index.html)） |
| **蛋宝宝装扮屋（Uni-app 一码双端 H5）** | **主推 · 正式版** | <https://octopusgump.github.io/eggbabe-h5/eggbabe-uni/site/> | 锦鲤 12 全身套装、玉兔 8 配饰、11 套小屋背景、WebGL 互动动画、一键导出 780×1688 高清壁纸、`catalog.json` 热更新 |
| **玉兔小屋 · 模块升级版** | 独立子项目 | <https://octopusgump.github.io/eggbabe-h5/yutu-house-mod.html> | 路线 B：2D 寻路 + 四房粘土模块烘焙升级 |
| **蛋宝宝牧场** | 独立子项目 | <https://octopusgump.github.io/eggbabe-h5/danbaobao-meadow.html> | Three.js 3D 草场（11 只小羊、方圈四角口、拖羊/旋转/缩放） |
| **双宠 iframe 试衣页** | 历史基线版（兼容） | <https://octopusgump.github.io/eggbabe-h5/assets/dress_pets_demo.html> | 顶部提供一键跳转至 Uni-app 新版装扮屋 |
| **锦鲤 / 玉兔单页 WebGL 基线** | 历史基线版 | [`assets/koi-v2b/koi_mesh_demo.html`](assets/koi-v2b/koi_mesh_demo.html) / [`assets/v2b/yutu_mesh_demo.html`](assets/v2b/yutu_mesh_demo.html) | 早期单文件内联 WebGL mesh 验收基线 |

---

## 一码双端与热更新架构（`eggbabe-uni/`）

详见 [`eggbabe-uni/README.md`](eggbabe-uni/README.md)：

1. **一码双端编译**：同一套 Vue 3 + Vite 代码（`eggbabe-uni/src/pages/index/index.vue` + 跨端 WebGL 引擎 `petStage.js` + 壁纸导出 `wallpaperExporter.js`）：
   - `npm run build:h5` → 输出到 [`eggbabe-uni/site/`](eggbabe-uni/site/)（推送 `main` 即上线）
   - `npm run build:mp-weixin` → 输出标准原生微信小程序包 `eggbabe-uni/dist/build/mp-weixin/`
   - `npm run build:mp-toutiao` → 预留抖音小程序构建
2. **远程内容热更新（免审核小迭代）**：
   - 统一远程清单：[`assets/shared/catalog.json`](assets/shared/catalog.json)（11 套背景 + 锦鲤 12 套装 + 玉兔 8 配饰）
   - H5 与微信小程序启动时均通过 `eggbabe-uni/src/config/catalogLoader.js` 拉取线上清单（离线自动回退本地快照）

---

## 项目文档与目录索引

| 路径 | 说明 |
| :--- | :--- |
| [`eggbabe-uni/`](eggbabe-uni/) | **主工程**：Uni-app Vue 3 一码双端装扮屋（H5 + 微信小程序） |
| [`assets/shared/catalog.json`](assets/shared/catalog.json) | 换装与背景统一热更新清单 |
| [`yutu-house-mod/`](yutu-house-mod/) | 玉兔小屋模块升级版工程（路线 B） |
| [`danbaobao-meadow/`](danbaobao-meadow/) | 蛋宝宝牧场 Three.js 工程 |
| [`yutu-house/`](yutu-house/) | 早期无桥玉兔小屋单文件交接归档（详见 [`yutu-house/HANDOFF.md`](yutu-house/HANDOFF.md)） |
| [`PLAN.md`](PLAN.md) / [`CONTEXT.md`](CONTEXT.md) | 历史阶段规划与 v2b WebGL mesh 基线说明 |
| [`docs/V2B_BUNDLE_MAP.md`](docs/V2B_BUNDLE_MAP.md) / [`docs/KOI_DRESS_MAP.md`](docs/KOI_DRESS_MAP.md) | 玉兔与锦鲤资产与构建说明 |