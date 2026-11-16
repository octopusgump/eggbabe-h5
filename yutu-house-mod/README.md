# 玉兔小屋 · 模块化升级（路线 B）

Vite + TypeScript + Three.js：**2D 寻路/遮挡**（[`yutu-house`](../yutu-house/)）+ **四象限粘土模块烘焙**（复用 [`danbaobao-meadow`](../danbaobao-meadow/) 材质语言）。

## 在线（合并 `main` 并部署后）

`https://octopusgump.github.io/eggbabe-h5/yutu-house-mod/site/`

## 开发

```bash
cd yutu-house-mod
npm install
npm run dev
```

资源：`geom.json` 在 `public/`；贴图仍引用 `../yutu-house/src/*.webp`（dev/build 需与仓库并列目录）。

## 玩法

- 点地板走动、拖拽缩放 — 与原 demo 一致
- 顶栏显示 **房间 Lv.n**；进入房间后点 **升级房间**，或 **双击房间 chip**
- 升级后该象限显示 Lv2+ 粘土烘焙层（localStorage `yutu-house-mod-save`）

## 资源规模（已实现配置）

- 四房 × **Lv2**；卧室、阳光房 **Lv3**
- 烘焙优先；`useLiveThree` 可在 save 里手动开启实时 WebP 画布（调试用）