# eggbabe-H5

玉兔（Yutu）换装小游戏 — 独立 H5 仓库，与 `eggbabe-miniprogram` 分离。

**仓库**：<https://github.com/octopusgump/eggbabe-h5>

## 默认分支

| 分支 | 用途 |
|------|------|
| **`main`** | 换装 H5 规划、文档与后续 Vite+TS 工程（**推荐默认分支**） |
| `yutu-house` | 玉兔小屋无桥版 HTML 交接包（历史默认分支，内容与 `main` 上的 `yutu-house/` 目录一致） |

在 GitHub 仓库 **Settings → General → Default branch** 中请将默认分支设为 **`main`**。

## 换装小游戏（主项目）

- 方案 A MVP：2 件上衣 + 2 件裙子（见 `PLAN.md`、`CONTEXT.md`）
- 技术栈：Vite + TypeScript，纯 H5，不接小程序
- 占位资源目录：`assets/`

## 玉兔小屋 Demo（已有）

浏览器打开 [`yutu-house/yutu_house_demo.html`](yutu-house/yutu_house_demo.html)。说明见 [`yutu-house/HANDOFF.md`](yutu-house/HANDOFF.md)。未接入小程序。

## 蛋宝宝牧场（一期 H5）

[`danbaobao-meadow/`](danbaobao-meadow/)：Three.js 草场观览（11 羊、方圈四角口、拖羊/旋转/缩放）。本地：

```bash
cd danbaobao-meadow && npm install && npm run dev
```

## 本地开发（换装 MVP 脚手架落地后）

```bash
npm install
npm run dev
```