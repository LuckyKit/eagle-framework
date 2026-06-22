# /eagle:reviewer — 代码审查

> 原子 Skill。只负责一件事：审查本次任务的代码变更，输出 REVIEW.md。
> 不改代码，不测试。

---

## 调用方式

```
/eagle:tester {slug}   ← 用户直接调用（审查该任务所有变更）
由编排 Skill 调用
```

---

## 输入

- `.eagle/tasks/{slug}/PLAN.md`（获取验收标准和设计决策）
- 本次任务所有修改的文件列表（从 git log 读取）
- `.eagle/rules/{stacks}/`（编码规范，加载该任务涉及的所有栈）
- `.eagle/codebase/`（检查是否符合本地结构和约定）
- `.eagle/gates/QUALITY-GATES.md`（检查完成门禁）

---

## 执行步骤

### 召唤 eagle-reviewer

传入修改文件 + PLAN.md + 编码规范，让 reviewer：

1. 对照 PLAN.md 验收标准检查实现是否完整
2. 检查是否符合各栈编码规范
3. 发现问题分级标注：

| 级别 | 含义 | 处理方式 |
|------|------|---------|
| CRITICAL | 必须修复，否则不能交付 | 编排 Skill 触发 coder fix |
| WARNING | 建议修复，不阻塞交付 | 记录到 REVIEW.md |
| INFO | 仅供参考 | 记录到 REVIEW.md |

额外检查：
- 是否破坏 `.eagle/codebase/CONVENTIONS.md` 中记录的本地模式
- 是否需要刷新 `eagle map`
- 是否产生了应该写入 `.eagle/knowledge/` 或 `.eagle/memory/` 的经验

---

## 输出格式

文件：`.eagle/tasks/{slug}/REVIEW.md`

```markdown
# 代码审查报告

## 结论
{PASS / FAIL（有 CRITICAL 问题时为 FAIL）}

## CRITICAL（必须修复）
- [ ] {文件路径}:{行号} — {问题描述} [规范来源]

## WARNING（建议修复）
- [ ] {问题描述}

## INFO（仅供参考）
- {建议}

## 验收标准检查
- [x] {PLAN.md 中的验收条件1} — 已实现
- [ ] {PLAN.md 中的验收条件2} — 未实现（CRITICAL）
```

---

## 硬性约束

1. **不改代码** — 只审查，不修复
2. **必须引用规范来源** — CRITICAL 和 WARNING 必须注明违反了哪条规范
3. **必须检查 PLAN.md 验收标准** — 漏实现的条目标为 CRITICAL
4. **PASS/FAIL 结论明确** — 有任何 CRITICAL 就是 FAIL
5. **门禁结论明确** — REVIEW.md 必须包含是否满足 done gate 的判断
