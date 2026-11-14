# 创建与同步 `eggbabe-h5` 仓库

本文记录独立 H5 仓库的创建方式，便于在其他机器复现。目标仓库：

**<https://github.com/octopusgump/eggbabe-h5>**

## 新建仓库（仅需一次）

```bash
gh repo create octopusgump/eggbabe-h5 \
  --public \
  --description "eggbabe mini game — Yutu dress-up H5 (standalone)" \
  --clone
```

或网页：**New repository** → 名称 `eggbabe-h5` → Public → 不勾选多余模板。

## 推送与默认分支

推荐 **默认分支为 `main`**：

```bash
cd eggbabe-h5
git checkout -b main
git add README.md PLAN.md CONTEXT.md docs/ assets/ .gitignore
git commit -m "chore: docs and plan for yutu dress-up H5"
git push -u origin main
```

在 GitHub：**Settings → General → Default branch** → 选择 **`main`** → Update。

保留 `yutu-house` 分支（可选）：

```bash
git push -u origin yutu-house
```

`main` 应包含 `yutu-house/` 目录全量内容；`yutu-house` 分支可为仅小屋的历史快照。

## 与小程序仓库隔离

- **不要** 把本仓库作为 `eggbabe-miniprogram` 的 submodule 除非产品明确要求。
- 克隆换装项目：

```bash
git clone https://github.com/octopusgump/eggbabe-h5.git
cd eggbabe-h5
git checkout main
```

## 后续：Vite 脚手架（换装 MVP）

```bash
npm create vite@latest . -- --template vanilla-ts
npm install
npm run dev
```

具体交互与素材目录以 `PLAN.md` 为准。