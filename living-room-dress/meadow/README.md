# 蛋宝宝牧场（3D 粘土赶小羊）

Vite + TypeScript + Three.js，正式并入蛋宝宝 H5 主工程「活动列表」，UI 与 3D 配色全面对齐 [`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md) v1.0。

## 在线入口

- **蛋宝宝主界面**：首页右侧/工具箱「活动」→「蛋宝宝牧场」
- **独立页面**：`https://octopusgump.github.io/eggbabe-h5/living-room-dress/meadow/site/`（根目录 `danbaobao-meadow.html` 自动跳转至此）

## 本地开发与构建

```bash
cd living-room-dress/meadow
npm install
npm run dev      # 本地调试
npm run build    # tsc 类型检查 + Vite 产出相对路径 site/
```

## 核心特性

- **25 秒快节奏三关卡**：1 关「晴日草场」→ 2 关「溪流北坡」→ 3 关「暖丘溪谷」
- **出战伙伴 3D 上场**：自动读取 `cross-end-store.js` 当前伙伴，渲染 3D 粘土玉兔（竖立长兔耳、无腮红）或锦鲤牧羊形象
- **蛋宝宝存档与星星闭环**：单局结算自动写入 `awardActivityStars`（+2✦ ~ +12✦，遵循每日 45✦ 软上限，满额改赠 +5 EXP），并通过 `postMessage` 实时同步主房间 HUD
- **全屏自适应 + 双操作支持**：无固定画框黑边，支持移动端虚拟摇杆与桌面端 WASD / 方向键、开局等待态轻提示、暂停选关卡片与全局静音联动