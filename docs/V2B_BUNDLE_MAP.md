# v2b 上下文包 → 仓库路径对照（P0）

来源压缩包：`yutu_context_bundle.zip`（本机上传名 `yutu_context_bundle_ae36.zip`，39 文件；与文档中的 **946c bundle** 为同一套 v2b 资产，文件名仅版本后缀不同）。

## 换装 WebGL 基线（已入库）

| Bundle 内路径 | 仓库路径 | 说明 |
|---------------|----------|------|
| `v2b/yutu_mesh_demo.html` | `assets/v2b/yutu_mesh_demo.html` | **P1 金标准**：单文件 WebGL grid mesh + 奶油底栏 8 格换装 |
| `v2b/work/template.html` | `assets/v2b/work/template.html` | 构建模板（未内联进 demo 时的源码） |
| `v2b/work/build.py` | `assets/v2b/work/build.py` | 单文件打包脚本 |
| `v2b/work/inject_dress.py` | `assets/v2b/work/inject_dress.py` | 配饰注入管线脚本 |
| `v2b/work/tex_base.png` | `assets/v2b/work/tex_base.png` | 睁眼基色贴图 |
| `v2b/work/tex_closed.png` | `assets/v2b/work/tex_closed.png` | 轻闭眼 / 抚摸 |
| `v2b/work/tex_doze.png` | `assets/v2b/work/tex_doze.png` | 打瞌睡 + 眼下痕 |
| `v2b/work/dress/extract/*` | `assets/v2b/work/dress/extract/*` | 8 配饰正片、`_full`、缩略图、`meta.json` |

本地验收：用浏览器打开 `assets/v2b/yutu_mesh_demo.html`（`file://` 或任意静态服务均可；demo 为内联资源单文件）。

## 方案 A 其它资源（bundle 有、**本 P0 未提交**）

仍保留在 zip / 策划交接，P4 串联时再按需迁入（避免与 `yutu-house/` 重复提交小屋单文件）。

| Bundle 内路径 | 用途 |
|---------------|------|
| `yutu_hatch_demo.html` | 破壳段参考 |
| `yutu_walk_demo.html` | 走路段参考 |
| `yutu_house_demo.html` | 小屋（仓库已有 `yutu-house/yutu_house_demo.html`） |
| `work/bg_from_koi_jump_demo.jpeg` | 换装房间背景（v2b demo 当前多为内联，未单独引用） |
| `yutu_turnaround_new.jpg` | 四视图官方原图 |
| `refs/closed_eyes_darkcircles_ref.png` | 闭眼黑眼圈参考 |
| `CONTEXT.md` | 策划交接长文（瑕疵清单等已摘要进根 `CONTEXT.md`） |

## MVP 与 bundle 现状

- Bundle 内 **已落地 8 件配饰**（6 头饰 + 2 围巾），槽位见 `assets/v2b/work/dress/extract/meta.json`。
- **2 上衣 + 2 裙子** 为 `PLAN.md` MVP 目标，**尚未包含在此 bundle**；P2 前需美术/管线补素材或扩 extract。