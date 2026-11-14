# 玉兔换装 H5 — 实施计划（方案 A）

## 目标

在 **独立仓库** `eggbabe-h5` 中交付一版可游玩的玉兔换装 H5，与小程序代码仓库解耦，便于 Cursor / 本地快速迭代。

## 方案 A（已选）

**最小可玩换装**：固定底图 + 分层叠加，用户切换装扮选项即时预览。

| 品类 | 数量 | 说明 |
|------|------|------|
| 上衣（top） | 2 | 互斥，同一时间只穿一件 |
| 裙子（skirt） | 2 | 互斥，同一时间只穿一条 |
| 组合数 | 4 | 2×2，无需背包或存档即可验收 |

不做方案 B（多场景、衣橱 UI、存档同步小程序）直至方案 A 可演示。

## 技术栈

- **构建**：Vite + TypeScript
- **运行环境**：手机浏览器 H5（竖屏 ~390×844 视口）
- **渲染**：Canvas 2D 或分层 `<img>` / CSS（按素材形式二选一，优先与美术出图一致）
- **仓库**：<https://github.com/octopusgump/eggbabe-h5>，默认分支 `main`

## 目录结构（目标）

```text
eggbabe-h5/
  README.md
  PLAN.md
  CONTEXT.md
  docs/
  assets/          # 立绘与服装 PNG/WebP（.gitkeep 占位至素材入库）
  src/             # Vite 入口与换装逻辑（待初始化）
  yutu-house/      # 既有小屋 demo，与换装工程并列，不互相耦合
```

## 里程碑

1. **文档与仓库** — README、PLAN、CONTEXT、`assets/.gitkeep`，`main` 为默认分支说明清晰
2. **脚手架** — `npm create vite@latest`（vanilla-ts 或 react-ts，按团队习惯），配置 `base` 与静态资源路径
3. **核心交互** — 加载底图 + 2 top + 2 skirt；按钮或缩略图切换；合成预览
4. **抛光** — 安全区、触控反馈、加载态；可选导出截图
5. **验收** — 四种组合均可切换，无小程序依赖，无 eggbabe-miniprogram 改动

## 非目标（本阶段）

- 不修改 `octopusgump/eggbabe-miniprogram`
- 不把换装 demo 接入微信小程序
- 不重做 `yutu-house` 3D/单文件 HTML 为小游戏引擎

## 风险与依赖

- **素材**：需确认立绘锚点与服装图层尺寸一致（见 `CONTEXT.md`）
- **性能**：WebP + 预加载四组合可减少切换闪烁