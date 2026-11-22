# 蛋宝宝装扮屋 · Uni-app 一码双端工程（`eggbabe-uni/`）

**一套 Vue 3 代码，确定性编译输出 H5 网页 + 原生微信小程序（及抖音小程序）**，并结合远程 `assets/shared/catalog.json` 实现**小迭代免审核热更新**。

## 日常开发与发布流程

### 1. 小版本迭代（加新套装 / 新背景 / 改名称与顺序）— **0 审核、1 分钟生效**
直接更新仓库根目录的 `assets/shared/catalog.json` 并推送到 `main`，H5 与已上线的微信小程序会在下次打开时自动拉取最新清单，无需重新打包或提交微信审核。

### 2. 大版本迭代（改 UI 布局 / 加新互动玩法）— **H5 秒验 + 一键出小程序包**
```bash
cd eggbabe-uni
npm install

# 1) 本地 H5 实时预览
npm run dev:h5

# 2) 构建线上 H5（输出到 eggbabe-uni/site/，推送后 GitHub Pages 直接访问）
npm run build:h5

# 3) 确定性编译原生微信小程序包（输出到 eggbabe-uni/dist/build/mp-weixin/）
npm run build:mp-weixin

# 4) 后期切企业主体：一键编译抖音小程序包
npm run build:mp-toutiao
```

## 导入微信开发者工具
1. 运行 `npm run build:mp-weixin`。
2. 打开 **微信开发者工具** →「导入项目」→ 选择 `eggbabe-uni/dist/build/mp-weixin/`。
3. 填入你的个人小程序 `AppID` 即可真机预览、上传并提交审核。
