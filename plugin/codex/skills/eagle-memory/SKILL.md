---
name: eagle-memory
description: "捕获和回忆跨会话可复用的项目经验，避免每个新会话都从零开始。 Use this Codex skill when the user asks for the matching Eagle workflow or explicitly invokes $eagle-memory."
---

# eagle-memory

<!-- Generated from plugin/claude. Run `npm run sync:codex` after editing Claude skills. -->

Codex invocation: `$eagle-memory`. Legacy Claude slash-command examples are preserved below for workflow compatibility.

# /eagle:memory — 长期记忆

> 捕获和回忆跨会话可复用的项目经验，避免每个新会话都从零开始。

## 调用方式

```text
/eagle:memory recall
/eagle:memory capture {slug}
/eagle:memory note "..."
```

## 存储位置

- `.eagle/knowledge/INDEX.md` — 可复用决策、架构模式、组件实现经验。
- `.eagle/memory/INDEX.md` — 踩坑、失败尝试、调试结论、不要再做的事。
- `.eagle/threads/` — 跨会话但不属于某个具体任务的上下文。

## recall

开始任务前读取：

- `.eagle/PROJECT.md`
- `.eagle/STATE.md`
- `.eagle/codebase/README.md`
- `.eagle/knowledge/INDEX.md`
- `.eagle/memory/INDEX.md`

然后输出与当前任务相关的摘要。

## capture

任务完成后，从 `PLAN.md`、`TEST.md`、`REVIEW.md` 和实际 diff 中提炼：

- 新增或确认的设计决策。
- 可复用实现模式。
- 测试或审查发现的风险。
- 下次应该避免的坑。

## 记录格式

```markdown
## YYYY-MM-DD - {topic}

- Decision: ...
- Pattern: ...
- Pitfall: ...
- Applies to: go/python/nextjs/flutter/all
- Source: .eagle/tasks/{slug}/...
```

## 硬性约束

1. **只记录可复用内容**，不要流水账。
2. **失败经验和限制比成功摘要更重要**。
3. **记录必须带来源**，方便回溯。
