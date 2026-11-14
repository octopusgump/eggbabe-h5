# eggbabe-H5

玉兔（Yutu）**v2b WebGL mesh** 换装小游戏 — 独立 H5 仓库。

**GitHub**：<https://github.com/octopusgump/eggbabe-h5>

## 文档

| 文件 | 内容 |
|------|------|
| [**PLAN.md**](PLAN.md) | v2b 基线、`yutu_mesh_demo.html`、方案 A（破壳换装走路小屋）、MVP（2+2+8）、Vite+TS、阶段 **P0–P5** |
| [**CONTEXT.md**](CONTEXT.md) | `yutu_context_bundle_946c`、**`assets/v2b/`** 路径、与小程序仓库 **无耦合** |

## 自由试衣 demo（玉兔 + 锦鲤）

- **双宠物切换**：[`assets/dress_pets_demo.html`](assets/dress_pets_demo.html)（顶栏 **玉兔 | 锦鲤**）
- 玉兔：[`assets/v2b/yutu_mesh_demo.html`](assets/v2b/yutu_mesh_demo.html)
- 锦鲤：[`assets/koi-v2b/koi_mesh_demo.html`](assets/koi-v2b/koi_mesh_demo.html)

资产对照见 [`docs/V2B_BUNDLE_MAP.md`](docs/V2B_BUNDLE_MAP.md)；锦鲤说明见 [`CONTEXT.md`](CONTEXT.md) § 锦鲤。

## 其它目录

- [`yutu-house/`](yutu-house/) — 玉兔小屋无桥 HTML demo（双击 `yutu_house_demo.html`；说明见 [`HANDOFF.md`](yutu-house/HANDOFF.md)）。未接入小程序。
- [`danbaobao-meadow/`](danbaobao-meadow/) — **蛋宝宝牧场**一期：Three.js 草场（11 羊、方圈四角口、拖羊/旋转/缩放）。

## 蛋宝宝牧场 · 在线

**https://octopusgump.github.io/eggbabe-h5/danbaobao-meadow/site/**（短链：[danbaobao-meadow.html](danbaobao-meadow.html)）

## 开发（P3 脚手架落地后）

```bash
npm install
npm run dev
```