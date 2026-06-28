---
name: eagle-fix
description: "编排 Skill。Bug 修复专用流程，在 /eagle:dev 基础上增加 bug 专项处理。 Use this Codex skill when the user asks for the matching Eagle workflow or explicitly invokes $eagle-fix."
---

# eagle-fix

<!-- Generated from plugin/claude. Run `npm run sync:codex` after editing Claude skills. -->

Codex invocation: `$eagle-fix`. Legacy Claude slash-command examples are preserved below for workflow compatibility.

# /eagle:fix — Bug 修复（编排）

> 编排 Skill。Bug 修复专用流程，在 /eagle:dev 基础上增加 bug 专项处理。
> 维护 STATE.json 和任务状态，全程可中断恢复。

---

## 触发方式

```
/eagle:fix <Bug 描述>   ← 从头开始
/eagle:fix {slug}       ← 恢复已有修复任务
```

---

## 与 /eagle:dev 的差异

| | /eagle:dev | /eagle:fix |
|---|---|---|
| discuss 类型 | feature / iteration / refactor | bug（预填） |
| discuss 模板 | 通用 + 前端专项 | Bug 专项（当前/期望/复现） |
| coder 要求 | 实现功能 | 修复 + 必须新增回归测试 |
| knowledge-writer | 知识 + 可选 memory | 必须写 memory（踩坑记录） |
| commit prefix | feat / refactor | fix |

---

## 执行流程

与 /eagle:dev 完全相同，以下字段预设：

```json
{
  "type": "bug",
  "stage": "discuss"
}
```

discuss 阶段传入 `type: "bug"` → /eagle:discuss 使用 Bug 专项模板。

### Bug 专项 STATE.json 字段

```json
{
  "bugInfo": {
    "currentBehavior": "...",
    "expectedBehavior": "...",
    "reproSteps": "...",
    "severity": "critical / major / minor"
  }
}
```

discuss 确认后从 DISCUSSION.md 提取写入。

---

## coder 额外要求

在每个 Wave 的 /eagle:coder 调用中额外传入：
> "这是 Bug 修复任务，除实现修复外，必须新增覆盖该 Bug 场景的回归测试。"

---

## knowledge-writer 额外要求

调用 /eagle:knowledge-writer 时额外传入：
> "必须将 Bug 根因、触发条件、修复方案写入 .eagle/memory/（不可跳过）。"

---

## 完成报告

```
✅ /eagle:fix 完成

Bug：{描述摘要}
根因：{analyst 的一句话根因}
涉及端：{stacks}

修复：
  Wave {id}：{改动摘要}
  新增回归测试：{N} 个

测试：全量通过（{X}/{Y}）
审查：无 CRITICAL 问题

踩坑记录：已写入 .eagle/memory/
```

---

## 硬性约束

继承 /eagle:dev 全部约束，额外：
1. **回归测试必须新增** — 没有覆盖 Bug 场景的测试，coder 必须补
2. **memory 必须写** — 不允许跳过 knowledge-writer 的 memory 写入
3. **commit 含 fix:** — `fix(scope): 描述`
