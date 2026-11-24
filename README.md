# eggbabe-h5

蛋宝宝（Eggbabe）互动毛绒 H5 与小程序统一仓库。**`main` 分支为 GitHub Pages 唯一线上发布源**。

## 唯一对外线上主链接

**https://octopusgump.github.io/eggbabe-h5/**

打开即直接进入 **蛋宝宝破壳起居室与装扮屋（小程序 1:1 同源 UI 版）**：
- **1:1 复刻小程序破壳房间体验**：官方三屏连续全景（白天 / 落日 / 黑夜）+ 玉兔/锦鲤全套 8 种日常动作全景、左上三阶陪伴星星牌与双模小挂钟、左下 3D 信封、右下 3D 开盖百宝箱、竖红线折角信笺与 `#FAFAF8` 纪念册；
- **全量换装与背景免锁即穿**：锦鲤 12 套全身装、玉兔 24 套全身装、12 套舞台背景（破壳起居室 + 11 套插画小屋），支持 `780×1688` 高清手机壁纸与零 Token 带妆拍立得导出；
- **右侧 3D 喂食 / 洗澡 / 装扮胶囊栏**：3D 哑光小零食拖拽/点击投喂、搓澡珠光泡泡与冲水欢跳、原版 `PetStage` 四大情绪互动剧场；
- **隐藏验收工具**：URL 追加 `?demo=1` 或 `2.4s` 内连点左上状态牌 5 次可展开时段/状态/角色/养成验收菜单。

> 历史实验原型与上一代页面已统一收敛至 **[历史归档索引](https://octopusgump.github.io/eggbabe-h5/archive/)**（`archive/`）。

---

## 目录索引

| 路径 | 说明 |
| :--- | :--- |
| [`index.html`](index.html) | 唯一对外主入口（直接呈现 [`living-room-dress/`](living-room-dress/)） |
| [`living-room-dress/`](living-room-dress/) | **主版本工程**：破壳起居室 × 专属装扮屋 × 3D 喂食搓澡 × 零 Token 带妆明信片 |
| [`assets/shared/catalog.json`](assets/shared/catalog.json) | 换装与背景统一热更新清单（全仓强制压缩 PNG，零 `.webp`） |
| [`eggbabe-uni/`](eggbabe-uni/) | Uni-app Vue 3 小程序双端编译工程（保留用于 `npm run build:mp-weixin`） |
| [`docs/prd/`](docs/prd/0002-living-room-fitting-and-postcard.md) | **产品需求文档（PRD）**：[`0001` 轻陪伴电子宠物](docs/prd/0001-light-companion-pet.md) · [`0002` 破壳起居室、试衣间与带妆明信片](docs/prd/0002-living-room-fitting-and-postcard.md) |
| [`archive/`](archive/index.html) | **历史版本统一归档**：四房玉兔小屋（`yutu-house` / `yutu-house-mod`）、3D 牧场（`danbaobao-meadow`）、早期网格 Demo |
| [`AGENTS.md`](AGENTS.md) | 项目强制规范（PNG-only 与玉兔审美红线） |