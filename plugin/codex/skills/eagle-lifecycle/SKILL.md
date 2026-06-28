---
name: eagle-lifecycle
description: "维护项目级 `.eagle/PROJECT.md`、`ROADMAP.md`、`STATE.md` 和 phase 目录，让 Eagle 不只管理单个任务。 Use this Codex skill when the user asks for the matching Eagle workflow or explicitly invokes $eagle-lifecycle."
---

# eagle-lifecycle

<!-- Generated from plugin/claude. Run `npm run sync:codex` after editing Claude skills. -->

Codex invocation: `$eagle-lifecycle`. Legacy Claude slash-command examples are preserved below for workflow compatibility.

# /eagle:lifecycle — 全生命周期管理

> 维护项目级 `.eagle/PROJECT.md`、`ROADMAP.md`、`STATE.md` 和 phase 目录，让 Eagle 不只管理单个任务。

## 调用方式

```text
/eagle:lifecycle status
/eagle:lifecycle new-phase "..."
/eagle:lifecycle complete-phase {phase-id}
```

## 核心产物

- `.eagle/PROJECT.md` — 项目目标、用户、约束、长期决策。
- `.eagle/ROADMAP.md` — 当前里程碑、Phase、Backlog。
- `.eagle/STATE.md` — 当前进度、最近决策、阻塞、下一步。
- `.eagle/phases/` — 阶段级上下文、计划、验证和总结。

## status

读取核心产物并输出：

- 当前项目目标。
- 当前 Phase 和任务。
- 阻塞项。
- 下一步建议。
- 是否需要刷新代码库地图或记忆。

## new-phase

新增 Phase 时：

- 在 `ROADMAP.md` 添加 Phase。
- 创建 `.eagle/phases/{NN}-{slug}/`。
- 写入 `{NN}-CONTEXT.md` 模板。
- 更新 `STATE.md` 当前 Phase。

## complete-phase

完成 Phase 前检查：

- 所有关联任务通过 `/eagle:gate done`。
- `TEST.md` 和 `REVIEW.md` 存在。
- 关键经验已 capture 到 memory。
- `ROADMAP.md` 和 `STATE.md` 更新。

## 硬性约束

1. **项目级状态优先于单任务状态**。
2. **每次完成重要工作都更新 STATE.md**。
3. **不要把 Phase 当技术层拆分**，优先端到端可交付。
