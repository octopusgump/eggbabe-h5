# 玉兔换装 H5 — 背景与上下文

## 为什么单独建 `eggbabe-h5`

- **蛋贝贝 / 玉兔**相关玩法需要在 H5 上快速试玩和演示，但小程序仓库发布链路重、与 PRD 耦合紧。
- **玉兔小屋**已以无桥版 HTML 交接包形式存在（本仓库 `yutu-house/`），证明「独立 repo + 浏览器打开」可行。
- **换装小游戏**是下一增量：同样放在独立仓库，避免误改小程序或 merge 到 eggbabe 主工程。

仓库地址：<https://github.com/octopusgump/eggbabe-h5>

## 与 `yutu-house` 的关系

| 内容 | 路径 | 状态 |
|------|------|------|
| 玉兔小屋无桥 demo | `yutu-house/` | 已完成交接，单文件 `yutu_house_demo.html` |
| 玉兔换装 MVP | 根目录 `src/` + `assets/`（待建） | 方案 A：2 上衣 + 2 裙子 |

两子项目 **共享同一 Git 仓库**，目录隔离；换装开发 **不要求** 改动小屋 demo，除非产品明确要求联动。

## 产品范围（方案 A）

- 角色：玉兔（Yutu），与小程序世界观一致，但 **无登录、无云存档**。
- 玩法：点选上衣 / 裙子，实时合成角色立绘。
- 内容量：2 tops × 2 skirts = 4 套可见组合，用于 MVP 验收与美术流程试跑。

## 技术约束

- **Vite + TypeScript**：与团队现代前端习惯一致，便于 Cursor Agent 增量开发。
- **Standalone**：不依赖小程序 bridge、不引用微信 JSSDK（除非后续明确要分享页）。
- **资源**：服装与身体分图层；`assets/` 纳入 Git 或 Git LFS（大文件时再加 LFS，当前仅占位）。

## 分支策略

- **`main`**：换装规划 + 后续工程 + 保留 `yutu-house/` 全量内容（当前 `main` 已包含小屋文件）。
- **`yutu-house`**：历史分支，仅含小屋交接提交；与 `main` 上 `yutu-house/` 目录 **内容对齐**，新工作请以 `main` 为准。

若 GitHub 默认分支仍为 `yutu-house`，请在仓库设置中改为 **`main`**（见 `README.md`）。

## 硬约束（从小屋交接延续）

- 不修改 `octopusgump/eggbabe-miniprogram` 仓库
- 不把 H5 demo 自动接入小程序
- 不确定需求先与 Bohao 确认，再扩大范围

## 参考

- 小屋交接：`yutu-house/HANDOFF.md`、`yutu-house/PROMPT.md`
- 建仓备忘：`docs/CREATE_REPO.md`