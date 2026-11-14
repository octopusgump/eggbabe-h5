# 玉兔换装 H5 — 实施计划（v2b · WebGL mesh）

官方仓库：**<https://github.com/octopusgump/eggbabe-h5>**（`main`）

> **不是** Canvas 2D 分层立绘方案。以 **v2b `yutu_mesh_demo.html`** 的 **WebGL + 网格（grid）mesh** 管线为唯一技术基线。

---

## 1. 目标

在独立仓库 `eggbabe-h5` 交付 **方案 A** 玉兔 H5 小游戏切片：**破壳 → 单次换装 → 走路 → 小屋**，与 `octopusgump/eggbabe-miniprogram` **零耦合**。

## 2. 技术基线（v2b）

| 项 | 说明 |
|----|------|
| 参考 Demo | `yutu_mesh_demo.html`（v2b）— WebGL 场景、角色 mesh、UV/grid 换装逻辑 |
| 渲染 | **WebGL**（Three.js 或 demo 同等栈），mesh 贴图 / 材质槽切换 |
| 禁止 | 用 Canvas 2D 叠图替代 mesh 换装作为主实现 |
| 视口 | 手机竖屏 ~390×844 |

开发前先能在本地 **1:1 打开/对照** v2b mesh demo，再迁入 Vite 工程。

## 3. 剧情 — 方案 A（破壳换装走路小屋）

**一条线性短片式流程**，全文 **只有一次换装环节**：

1. **破壳** — 玉兔从蛋/壳中出場（可用 v2b 破壳动画或简版状态机）
2. **换装（唯一一次）** — 玩家在衣橱 UI 中搭配服装与配饰，点击「完成」后 **锁定装扮**，流程中 **不可再次打开衣橱**
3. **走路** — 玉兔沿预设路径行走（侧视/斜视 mesh 动画与 v2b 一致）
4. **小屋** — 进入玉兔小屋场景收尾（可与本仓库 `yutu-house/` 视觉对齐，**不要求**改小屋交接 HTML）

不做多轮衣橱、不做存档回小程序、不做方案 B（多场景大地图）。

## 4. MVP 内容量

| 品类 | 数量 | 规则 |
|------|------|------|
| 上衣（top） | 2 | 互斥 |
| 裙子（skirt） | 2 | 互斥 |
| 配饰（accessory） | 8 | 可多选叠加（帽/发饰/手持等，按 v2b 槽位定义） |

验收：任意合法组合可在 WebGL mesh 上即时预览；完成换装后锁定并进入走路段。

## 5. 工程栈

- **Vite + TypeScript**
- 静态资源：`assets/v2b/`（见 `CONTEXT.md`）
- 单元测试 / E2E：按 P3 落地后再定（非 P0 阻塞项）

## 6. 目标目录（`main`）

```text
eggbabe-h5/
  README.md
  PLAN.md
  CONTEXT.md
  assets/v2b/          # v2b mesh、贴图、音频（自 context bundle 迁入）
  src/                 # Vite 入口、WebGL 场景、换装状态机（待初始化）
  docs/
  yutu-house/          # 既有小屋 demo，保留不删、与换装工程目录隔离
```

## 7. 阶段 P0–P5

### P0 — 仓库与上下文

- [ ] `main` 上本文档（v2b WebGL 版）与 `CONTEXT.md` 就位
- [ ] 解压 **`yutu_context_bundle_946c.zip`**，将 v2b 资产落到 **`assets/v2b/`**
- [ ] 记录 `yutu_mesh_demo.html` 与 bundle 内路径对照表（写在 `CONTEXT.md` 或 `docs/`）

### P1 — WebGL grid 基线

- [ ] 复现/对照 **`yutu_mesh_demo.html`**：网格、mesh 加载、默认材质
- [ ] 确认 WebGL 在目标机型可用；不可用时有明确 fallback 文案（非静默黑屏）

### P2 — Mesh 换装槽位

- [ ] 实现 2 top、2 skirt、8 accessory 的 **mesh/材质槽** 切换 API
- [ ] 与 v2b demo 行为对齐（切换无闪烁、槽位互斥规则正确）

### P3 — Vite + TypeScript 迁移

- [ ] `npm create vite` 脚手架，`src/` 承载场景与 UI
- [ ] 资源从 `assets/v2b/` 引用；生产构建可静态托管
- [ ] 开发态 `npm run dev` 与预览链路文档化（`README.md`）

### P4 — 方案 A 流程串联

- [ ] 状态机：**破壳 → 单次换装 UI → 锁定 → 走路 → 小屋**
- [ ] **硬性**：换装完成后禁用衣橱入口；无第二段换装
- [ ] 走路与小屋至少达到可演示长度（动画可占位，流程必须可走通）

### P5 — 验收与抛光

- [ ] MVP 清单（2+2+8）全可切换；完成装后整条剧情无断点
- [ ] 触控、安全区、加载进度；性能在 mid-range 手机可接受
- [ ] 不修改 `eggbabe-miniprogram`；产出验收说明 / 录屏

## 8. 非目标

- 不实现 Canvas 2D 分层换装作为主路径
- 不 merge、不 submodule、不同步到 `octopusgump/eggbabe-miniprogram`
- 不把本 H5 接入微信小程序发布链路
- 不重写 `yutu-house/yutu_house_demo.html` 为 WebGL 工程（除非产品单独立项）

## 9. 仓库与协作

- **唯一官方远程**：`octopusgump/eggbabe-h5` — <https://github.com/octopusgump/eggbabe-h5>
- **默认工作分支**：`main`
- **勿** 将 Cursor 临时目录、本地 `/workspace` 克隆或 sandbox 路径当作 canonical remote；PR、文档、资产版本以 **GitHub `octopusgump/eggbabe-h5@main`** 为准
- 历史分支 `yutu-house` 仅保留小屋交接快照；新换装开发以 `main` 为准