---
name: eagle-refactor
description: "分波次执行，每波次独立验证。无人工介入。 Use this Codex skill when the user asks for the matching Eagle workflow or explicitly invokes $eagle-refactor."
---

# eagle-refactor

<!-- Generated from plugin/claude. Run `npm run sync:codex` after editing Claude skills. -->

Codex invocation: `$eagle-refactor`. Legacy Claude slash-command examples are preserved below for workflow compatibility.

# /refactor — 大型重构

> 分波次执行，每波次独立验证。无人工介入。

---

## 触发方式

```
/refactor <重构目标描述>
/refactor  ← 无参数时提示描述目标
```

---

## 适用场景

- 大规模代码结构调整（如目录重组、分层重构）
- 性能优化重构
- 技术债务清理（如替换旧依赖、消除重复代码）
- 接口/类型重命名（影响多文件）

**不适合**：功能 Bug 修复 → 用 `/fix`；新功能开发 → 用 `/discuss` + `/dev`

---

## 执行流程

```
Phase 1: Analyze     → eagle-analyst（分析影响范围 + 制定波次计划）
Phase 2: Execute     → 按波次执行（eagle-coder × N）
Phase 3: Verify      → 每波次后验证（eagle-tester）
Phase 4: Final Check → eagle-reviewer（全量审查）
Phase 5: Wrap        → eagle-knowledge-writer
```

### Phase 1 — 分析（eagle-analyst）

召唤 `eagle-analyst`，任务是重构分析（不是功能分析）。

输出 `.eagle/tasks/refactor-{slug}/PLAN.md`，包含：
- 重构目标和范围
- 影响文件清单
- 波次计划（每波次独立、可验证）
- 每波次的验收标准

**波次划分原则**：
- 每波次不超过 10 个文件
- 每波次结束后测试必须通过
- 波次间有明确依赖顺序（如：先改 domain，再改 repository，再改 service）

示例波次计划：
```
Wave 1: 重命名 domain 层类型（3 个文件）
Wave 2: 更新 repository 层引用（2 个文件）
Wave 3: 更新 service 层引用（4 个文件）
Wave 4: 更新 handler 层 + 测试（5 个文件）
```

### Phase 2 + 3 — 分波次执行（循环）

对 PLAN.md 中的每个波次：

```
for each wave in PLAN.waves:
    1. 召唤 eagle-coder 执行当前波次
       - 传入：当前波次的文件列表 + 改动描述
       - 要求：完成后 git commit（"refactor(wave-N): 描述"）
    
    2. 召唤 eagle-tester 验证
       - 运行全量测试
       - 必须全部通过才继续下一波次
    
    3. 如果测试失败：
       - 重新召唤 eagle-coder 修复（最多 2 次）
       - 2 次后仍失败 → 停止，报告当前状态，等待用户
```

### Phase 4 — 最终审查（eagle-reviewer）

所有波次完成后，召唤 `eagle-reviewer` 做全量审查：
- 对比重构前后的代码质量
- 检查规范符合度
- 输出 `.eagle/tasks/refactor-{slug}/REVIEW.md`

### Phase 5 — 知识沉淀（eagle-knowledge-writer）

记录：
- 重构的动机和决策
- 波次执行过程中遇到的问题
- 可供未来类似重构参考的模式

---

## 完成报告

```
✅ /refactor 完成

目标：{重构目标}
波次：{N} 个波次
改动：{M} 个文件，{K} 次 commit
测试：全部通过

审查：
  - 无 CRITICAL 问题
  - {W} 个 WARNING（见 REVIEW.md）

知识沉淀：已更新 .eagle/memory/
```

---

## 中断恢复

如果重构中途失败停止：

```
/refactor {slug} resume
```

从 PLAN.md 中最后一个完成的波次继续，跳过已完成的部分。

---

## 硬性约束

1. **波次必须独立可验证** — 每波次后测试必须通过，不能攒到最后
2. **禁止混合重构和功能变更** — 重构波次只改结构，不改行为
3. **每波次独立 commit** — 方便问题定位和回滚
4. **全量测试** — 每波次跑所有测试，不只跑修改文件的测试
