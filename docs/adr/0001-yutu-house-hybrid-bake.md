# ADR 0001：玉兔小屋路线 B — 2D 导航 + 房间模块 Three 烘焙

## 状态

Accepted — 2026-11-16

## 背景

[`yutu-house`](../yutu-house/) 已具备 2D 寻路、门洞与遮挡；[`danbaobao-meadow`](../danbaobao-meadow/) 已验证粘土方块美学与 Three 工程。产品需要四房间 **逐档升级**，且不希望丢弃现有几何投入。

## 决策

- 主场景保持 **2D**（`House2D` 移植自交接 demo）。
- 每房间独立 **Three 正交微场景**（`RoomModule`），升级时 **烘焙为 WebP 贴片** 叠在 `#world`（默认）；可选 `useLiveThree` 实时 canvas。
- 进度存 **HouseSave**（`roomTiers` + `bakeRevision`），localStorage。
- 新工程目录 **`yutu-house-mod/`**，不替换 `yutu_house_demo.html`。

## 备选方案

| 方案 | 否决原因 |
|------|----------|
| 纯 2D 换皮 | 难以达到粘土立体感 |
| 全 Three 小屋 | 重做寻路/遮挡成本高，与交接约束冲突 |

## 后果

- 需校准 2D Shell 与 3D 模块透视（`tierCatalog.align`）。
- 双栈维护，但边界清晰：导航永不过 Three。