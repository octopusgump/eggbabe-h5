---
name: karpathy-12rules
description: Andrej Karpathy 风格 12 条工程约束——先想后写、简单优先、手术式改动、目标驱动验收、显著步骤后 checkpoint、失败要大声说。当用户要收紧 Agent 乱猜、过度修改、不确认就跑、或引用「12 条」「Karpathy rules」时使用。默认启用 Rule 1–4、10、12；Rule 8、6 在复杂任务时加强；Rule 5、7、9、11 暂缓除非用户点名。
---

# Karpathy 12 条（项目默认）

来源：<https://github.com/multica-ai/andrej-karpathy-skills>（2025-05-20 入库）

## 启用策略（Bohao 批注）

- **立刻启用**：Rule 1–4（基础）、Rule 10（Checkpoint）、Rule 12（Fail Loud）
- **下周 / 复杂后再加**：Rule 8（先读后写）、Rule 6（Token 预算）
- **暂缓**：Rule 5、7、9、11（项目更复杂后再加）

## 核心规则（12 条）

```markdown
# CLAUDE.md — 12-rule template

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.
```

## 为什么在本仓库关注

减少 Agent 乱猜、过度修改、不确认就跑的问题；与 `shuo-ren-hua`、`ui-quick-mockup` 互补——本 skill 偏工程纪律，不替代对非工程用户的沟通方式。