# eggbabe-H5

玉兔（Yutu）**v2b WebGL mesh** 换装小游戏 — 独立 H5 仓库。

**GitHub**：<https://github.com/octopusgump/eggbabe-h5>

## 文档

| 文件 | 内容 |
|------|------|
| [**PLAN.md**](PLAN.md) | v2b 基线、`yutu_mesh_demo.html`、方案 A（破壳换装走路小屋）、MVP（2+2+8）、Vite+TS、阶段 **P0–P5** |
| [**CONTEXT.md**](CONTEXT.md) | `yutu_context_bundle_946c`、**`assets/v2b/`** 路径、与小程序仓库 **无耦合** |

## v2b 基线对照（P0）

浏览器打开 [`assets/v2b/yutu_mesh_demo.html`](assets/v2b/yutu_mesh_demo.html) 验收 WebGL 网格换装；资产对照见 [`docs/V2B_BUNDLE_MAP.md`](docs/V2B_BUNDLE_MAP.md)。

## 其它目录

- [`yutu-house/`](yutu-house/) — 既有玉兔小屋无桥 HTML demo（保留）；与换装 WebGL 工程并列。

## 开发（P3 脚手架落地后）

```bash
npm install
npm run dev
```