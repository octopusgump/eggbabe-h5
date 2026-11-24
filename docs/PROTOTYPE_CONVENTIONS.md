# eggbabe-h5 多人小程序与原型放置及命名规范

为避免仓库根目录失控、保证 GitHub Pages 链接清晰且不互相污染正式主版本，团队成员在 `eggbabe-h5` 中新增独立小程序、H5 玩法原型或实验页面时，统一遵循本规范。

---

## 1. 仓库目录分层

```text
eggbabe-h5/
├── index.html                    # 正式主入口（GitHub Pages 根路径）
├── living-room-dress/            # 正式主版本 H5
├── wxapp/                        # 正式微信小程序主工程
├── assets/shared/                # 全仓共享资产（PNG 贴图、背景、catalog.json，只读复用）
│
├── prototypes/                   # 【个人/独立原型统一入口】所有人新作原型放这里
│   ├── README.md                 # 原型索引表（登记作者、玩法、预览链接与状态）
│   └── <owner>-<feature>/        # 个人独立原型目录
│       ├── index.html            # H5 预览入口（对应线上 /prototypes/<owner>-<feature>/）
│       ├── wxapp/                # （可选）原生微信小程序代码
│       ├── assets/               # （可选）仅本原型使用的专属图片/素材
│       └── README.md             # 玩法说明、作者、当前状态
│
└── archive/                      # 已下线、已放弃或已被主版本替代的历史原型
```

> **核心原则**：**禁止直接在仓库根目录新建实验/个人目录**。所有个人原型统一放入 `prototypes/`，评审通过后再迁入主工程，不再继续的方向统一迁入 `archive/`。

---

## 2. 命名规范

全部使用 **小写英文 + 短横线（`kebab-case`）**，禁止中文、空格和特殊字符（避免 GitHub Pages URL 编码问题及微信开发者工具路径报错）。

| 场景 | 命名格式 | 正确示例 | 说明 |
| :--- | :--- | :--- | :--- |
| **原型目录名** | `prototypes/<owner>-<feature>/` | `prototypes/gump-koi-pond/`<br>`prototypes/lisa-egg-gacha/` | 2–4 个词，清晰体现**作者 + 玩法**，避免撞名 |
| **Git 开发分支** | `proto/<owner>-<feature>`<br>`feat/<feature>` | `proto/gump-koi-pond`<br>`feat/egg-gacha` | 开发期拉分支，PR 合入 `main` 后立即删除分支 |
| **正式小程序页面/子包** | `wxapp/pages/<feature>/`<br>`wxapp/subpackages/<feature>/` | `wxapp/pages/gacha/` | 合入正式 `wxapp/` 时**去掉作者前缀**，仅保留业务名 |
| **归档目录与 Tag** | `archive/<feature>/`<br>Tag: `archive/<branch>` | `archive/yutu-house-mod/`<br>`archive/yutu-house` | 放弃但需留底的实验迁入 `archive/`，未合入分支打 tag 后删分支 |

---

## 3. 线上预览链接规则

`main` 分支默认发布至 GitHub Pages（`https://octopusgump.github.io/eggbabe-h5/`）：

- 原型目录下只要包含 `index.html`，合入 `main` 后即可直接通过以下地址访问：
  ```text
  https://octopusgump.github.io/eggbabe-h5/prototypes/<owner>-<feature>/
  ```
- 如果原型基于 Vite / Uni-app 等构建工具开发，源码放在 `src/`，仅在需要线上预览时将构建入口输出到该目录的 `index.html`（或 `site/index.html`），并在本目录 `README.md` 中标明预览地址。

---

## 4. 资源与工程约束

1. **优先复用共享资产**：角色贴图、背景和目录配置优先引用 `../../assets/shared/png/` 与 `../../assets/shared/catalog.json`，避免重复提交大体积图片。
2. **个人专属素材隔离**：未经过评审入库的专属图片，放进自己目录的 `prototypes/<owner>-<feature>/assets/` 下，不要直接改动 `assets/shared/`。
3. **图片格式强制要求（兼容 H5 + iOS 微信小程序）**：
   - 统一使用压缩 PNG（建议 `pngquant --quality=80-95 --speed=3 --strip`）。
   - **严禁使用或引入 WebP**（详见根目录 [`AGENTS.md`](../AGENTS.md)）。
4. **分支清理习惯**：
   - 统一以 `main` 为基准分支拉取开发分支并发起 PR。
   - PR 合入 `main` 后勾选自动删除源分支，保持远程仓库只保留活跃分支。

---

## 5. 生命周期流转

1. **立项开发**：从 `main` 拉出 `proto/<owner>-<feature>` → 在 `prototypes/<owner>-<feature>/` 下开发 → 补充 `README.md` 并登记到 `prototypes/README.md` → 开 PR 合入 `main`。
2. **评审通过（转正）**：将代码按业务模块迁入 `living-room-dress/`（H5）或 `wxapp/`（微信小程序），去掉作者前缀；原 `prototypes/` 目录可删除或保留跳转。
3. **评审放弃 / 已替代（归档）**：将整个目录移至 `archive/<feature>/`，更新 `prototypes/README.md` 索引。
