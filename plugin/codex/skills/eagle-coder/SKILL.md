---
name: eagle-coder
description: "原子 Skill。只负责一件事：实现指定 Wave 的代码，原子 commit。 Use this Codex skill when the user asks for the matching Eagle workflow or explicitly invokes $eagle-coder."
---

# eagle-coder

<!-- Generated from plugin/claude. Run `npm run sync:codex` after editing Claude skills. -->

Codex invocation: `$eagle-coder`. Legacy Claude slash-command examples are preserved below for workflow compatibility.

# /eagle:coder — 代码实现

> 原子 Skill。只负责一件事：实现指定 Wave 的代码，原子 commit。
> 不测试，不审查，不规划。

---

## 调用方式

```
/eagle:coder {slug} {wave-id}     ← 实现指定 Wave
/eagle:coder {slug} {wave-id} fix ← 修复模式（修复测试失败或审查 CRITICAL 问题）
由编排 Skill 调用
```

---

## 输入

- `.eagle/tasks/{slug}/PLAN.md`（读取指定 Wave 的范围 + 最小验证）
- Wave ID（如 `1.1`）
- 模式：`implement`（默认）/ `fix`（传入失败原因）
- fix 模式额外输入：失败原因描述（TEST.md 或 REVIEW.md 中的问题）

---

## 执行步骤

### 1. 读取上下文

- 读 PLAN.md → 获取 Wave 的范围、涉及栈、最小验证条件
- 读 `.eagle/codebase/` → 获取项目结构、测试命令和本地约定
- 读 `.eagle/rules/{stack}/` → 加载该 Wave 涉及栈的编码规范
- **只加载该 Wave 涉及的栈规范**（Wave 标注 `go` 就只读 go 规范，不读 nextjs）
- 读 `.eagle/knowledge/` → 查找相关已有知识

### 2. 召唤 eagle-coder

传入：
- Wave 范围和验收标准
- 涉及栈的编码规范
- 项目知识（.eagle/knowledge/ 相关部分）
- fix 模式时：额外传入失败原因

Eagle-coder 实现代码，**每完成一个原子步骤立即 commit**：
```
feat(scope): 描述      ← 新功能
fix(scope): 描述       ← Bug 修复
refactor(scope): 描述  ← 重构
```

Commit message 末尾附加：
```
Eagle auto-commit — task: {slug}, wave: {wave-id}
```

### 3. 报告完成

输出实现摘要：
```
✅ Wave {wave-id} 实现完成

改动文件：
  - {文件路径}（{新增/修改/删除}）

Commit：{N} 次
  - {commit hash} {commit message}
```

---

## fix 模式

收到 fix 模式调用时：
- 读取失败原因（来自 TEST.md 失败的测试 / REVIEW.md 中的 CRITICAL 问题）
- 定向修复，不重做整个 Wave
- commit 消息含 `fix:` 前缀

---

## 硬性约束

1. **只实现指定 Wave** — 不实现其他 Wave 的内容，不提前做后面的事
2. **只读涉及栈的规范** — Wave 标注 `go` 就不读 python/nextjs/flutter 规范
3. **原子 commit** — 每个逻辑步骤单独 commit，不攒大 commit
4. **不跑测试** — 测试交给 /eagle:tester
5. **遵守编码规范** — 必须符合 `.eagle/rules/{stack}/` 中的规范
6. **遵守代码库地图** — 新增结构必须符合 `.eagle/codebase/CONVENTIONS.md`，确需偏离时记录原因
