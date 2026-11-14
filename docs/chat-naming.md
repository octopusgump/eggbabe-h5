# chat-naming（窗口命名）

> **Agent 用副本**：`.cursor/skills/chat-naming/SKILL.md`（与此文内容一致；改规则时请两处同步，或只改 SKILL 再拷到本文。）  
> **打包**：`.cursor/skills/chat-naming.skill`

---

```yaml
---
name: chat-naming
description: 会话标题统一为「模型 | 内容」或（同项目≥3 个活动窗口）「模型 | 项目 · 内容」。Claude：Fable/Opus/Sonnet/Haiku；Cursor Cloud：仅 C2.5。开新窗、派子 agent、批量整理标题、用户问窗口叫什么时必用。Cursor 用 rename-chat（仅当前会话）；Claude 用 create_session / set_session_title。
---
```

## 窗口命名

列表里靠标题认：**谁在干（模型）**、**干什么（内容）**、**审核还是修复（内容开头）**。老板不看分支名。

### 拼标题（按顺序）

1. **模型** — Claude Code：`Fable` / `Opus` / `Sonnet` / `Haiku`（首字母大写；不写 `claude-`、不写版本号）。Cursor Cloud：**只写 `C2.5`**（不写 Composer / composer-2.5）。
2. **要不要项目名** — 同一仓库/项目 **同时 ≥3 个活动窗口** → 用 `模型 | 项目 · 内容`；否则 `模型 | 内容`。同一批窗口 **要么都带项目名，要么都不带**。
3. **内容** — ≤10 个汉字（英文缩写、数字各算 1 字；项目名、中点不计入）。总管固定 **`主窗口 · <项目>`**（写在内容段）。审核以 **`审核`**、修复以 **`修复`** 开头。不写「窗口」「任务」、不写进度（进行中/已完成）。
4. **符号** — 半角 `|`、`·`，两侧各一空一格。

```text
<模型> | <内容>              # 1～2 个窗口
<模型> | <项目> · <内容>      # 同项目 ≥3 个窗口
```

### 示例（核心）

| 场景 | ✅ | ❌ |
|------|----|----|
| Cursor 总管 | `C2.5 \| 玉兔小屋 · 主窗口` | `Composer \| 玉兔小屋`、`玉兔小屋 基线理解` |
| Claude 总管 | `Fable \| 主窗口 · 技术标` | `Claude Code Session` |
| 多窗口·写 | `Opus \| 技术标 · 同步节 meta` | `Opus \| 母版改版同步项目节`（未带项目） |
| 多窗口·审 | `Sonnet \| 技术标 · 审核插图库` | `Sonnet \| 审核插图库`（缺项目） |
| 反例 | — | 分支名、PR 号、`T1`、全角 `｜` |

超字先删修饰词（一下、相关、功能），再缩短对象名。

### 何时执行

| 时机 | Claude Code | Cursor Cloud |
|------|-------------|--------------|
| 开新会话 | `create_session` 的 title 直接按格式 | 同上（若支持）或首条消息后 `rename-chat` |
| 改当前会话名 | `set_session_title` | **`rename-chat`（只能改本会话）** |
| 批量整理 | `list_sessions` + `set_session_title` | 列出建议名，用户列表里手改 |
| 派子 agent | `description` 可省略模型，如「审核 xxx」 | Task `description` 同上 |
| 第 3 个同项目窗口出现 | 给该线已有窗口（含主窗口）补同一项目名 | 同上 |
| 汇报 | 用窗口标题指代，不用 T1/PR 号 | 同上 |

### 别做过头

- 任务不变不改名（**补项目名**除外）。
- 四五个字够清楚就别凑满十字。
- 名字只负责辨认，不写进度。

---

## 附录：扩展示例（可选）

| 场景 | ✅ | ❌ |
|------|----|----|
| 写代码 | `Opus \| 移除旧预览链路` | `T1 移除 ONLYOFFICE…（Opus）` |
| 写代码 | `Sonnet \| 原文轻预览模块` | `feature/claude-tender-light-preview` |
| 页面 UI | `Sonnet \| 标书工作台页面` | `T3 标书填写工作台 UI 实现` |
| 审核 | `Sonnet \| 审核轻预览模块` | `Review PR #219` |
| 修复 | `Sonnet \| 修复轻预览定位` | `fix followup for review comments` |
| Figma | `Sonnet \| Figma 补工作台` | `把六张板建进 Figma` |
| 文档 | `Sonnet \| 补协作规则` | `docs update` |
| 跑批 | `Sonnet \| 技术标 · 许昌胖东来` | `Sonnet｜技术标全本｜许昌`（全角竖线） |