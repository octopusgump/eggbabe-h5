# 玉兔换装 H5 — 背景与上下文（v2b WebGL）

## 仓库

- **GitHub**：<https://github.com/octopusgump/eggbabe-h5>
- **分支**：换装工程在 **`main`**；`yutu-house/` 为已交接的小屋 HTML demo，**保留、不删除**。

## 上下文包（canonical）

策划与 v2b 资产以压缩包为准：

- **`yutu_context_bundle_946c.zip`** / **`yutu_context_bundle.zip`**（同一套 v2b 资产，后缀因打包批次不同）
- 内含：剧情/方案 A 说明、**`yutu_mesh_demo.html`**（WebGL mesh 基线）、v2b 贴图与 mesh 相关文件、破壳/走路等资源索引

**P0（已完成）**：v2b 树已迁入 `assets/v2b/`；路径对照见 [`docs/V2B_BUNDLE_MAP.md`](docs/V2B_BUNDLE_MAP.md)。

## v2b 资产路径（本仓库约定）

当前 **946c / ae36 bundle** 实际结构（非空目录细拆）：

```text
assets/v2b/
  yutu_mesh_demo.html    # P1 对照金标准
  work/
    tex_*.png
    template.html, build.py, inject_dress.py
    dress/extract/       # 8 配饰 + meta.json + thumb_*
```

后续 Vite 工程从上述路径引用；mesh 在 demo 内为 WebGL grid，无单独 glTF 文件。

### 基线 Demo

- **`yutu_mesh_demo.html`** — v2b WebGL **grid / mesh** 换装演示；`PLAN.md` P1 要求与之行为对齐后再 Vite 化。
- **不是** Canvas 2D 叠图层方案。

## 与 `yutu-house/` 的关系

| 目录 | 内容 | 技术 |
|------|------|------|
| `yutu-house/` | 无桥版玉兔小屋单文件 HTML | DOM + 内嵌 WebP，已交接完成 |
| `src/` + `assets/v2b/` | 破壳换装走路小屋（方案 A） | **WebGL mesh**，Vite+TS |

两棵子树 **目录隔离**；换装流程结尾可 **视觉对齐** 小屋，但 **默认不要求** 修改 `yutu-house/` 内文件。

## 产品切片（方案 A）

- **破壳换装走路小屋** — 线性流程，**仅一次换装**（见 `PLAN.md` §3）
- MVP：**2 上衣 + 2 裙子 + 8 配饰**，WebGL mesh 槽位切换（bundle 现仅有 **8 配饰**，上衣/裙子待补）

### 配饰已知瑕疵（bundle 交接，修图优先级待拍板）

- 条纹围巾：空洞与色块感
- 皇冠：齿尖之间残留白底
- 花环：内耳边缘白色毛刺
- 毛线帽、草莓帽偏大；草帽偏小
- 焦糖围巾：一角有小缺口
- 闭眼睫毛：较 `refs/closed_eyes_darkcircles_ref.png` 略长

视觉基线仍以 **`assets/v2b/yutu_mesh_demo.html`** 为准：奶油毛色、网格清晰、闭眼睫毛与眼下蓝灰痕。

## 与 eggbabe-miniprogram 的关系（硬约束）

- **零耦合**：不修改 `octopusgump/eggbabe-miniprogram`，不提交 PR 到该仓库，不设 submodule。
- 不把本 H5 接入微信小程序；不同步用户存档、登录态或 PRD 内未确认的玩法。
- 小程序侧 PRD/CONTEXT 仅供 **世界观与美术风格参考**，不是本仓库的实现依赖。

## 分支说明

- **`main`**：v2b WebGL 换装规划 + 后续工程 + `yutu-house/` 全量内容。
- **`yutu-house`**：历史默认分支名；应与 `main` 上 `yutu-house/` 目录内容一致时，以 **`main`** 为协作基准。

## 参考文档

- 实施计划：`PLAN.md`（v2b WebGL，含 P0–P5）
- v2b 路径对照：`docs/V2B_BUNDLE_MAP.md`
- 小屋交接：`yutu-house/HANDOFF.md`、`yutu-house/PROMPT.md`
- 建仓备忘：`docs/CREATE_REPO.md`