# /eagle:tester — 测试执行

> 原子 Skill。只负责一件事：执行测试，输出 TEST.md。
> 不改代码，不审查。

---

## 调用方式

```
/eagle:tester {slug} {wave-id}   ← 最小验证（Wave 完成后）
/eagle:tester {slug} full        ← 全量测试（所有 Wave 完成后）
由编排 Skill 调用
```

---

## 两种模式

### minimal 模式（每 Wave 完成后）

- 只验证该 Wave 在 PLAN.md 中声明的"最小验证"条件
- 运行范围：该 Wave 涉及的测试文件
- 目标：快速确认 Wave 没有明显错误，不做全覆盖
- 输出：`.eagle/tasks/{slug}/waves/{wave-id}/TEST.md`

### full 模式（所有 Wave 完成后）

- 运行所有测试
- 按栈分别执行：
  - Go：`go test ./...`
  - React：`npm test` / `vitest run`
  - Flutter：`flutter test`
- 输出：`.eagle/tasks/{slug}/TEST.md`

---

## 输出格式

```markdown
# 测试报告

## 模式
{minimal wave-1.1 / full}

## 执行命令
{实际执行的命令}

## 结果
- 总计：{X} 个测试
- 通过：{Y} 个
- 失败：{Z} 个

## 失败详情（如有）
### {测试名}
{失败原因}
{堆栈（如有）}

## 结论
{PASS / FAIL}
```

---

## 结论判断

- 所有测试通过 → `PASS`，报告给编排 Skill 继续
- 有失败 → `FAIL`，报告给编排 Skill 触发 /eagle:coder fix 模式

---

## 硬性约束

1. **不改代码** — 发现问题只报告，不修复
2. **minimal 模式只跑 Wave 范围** — 不扩大测试范围
3. **full 模式跑所有栈** — 不遗漏任何栈的测试
4. **失败原因必须详细** — 编排 Skill 需要把失败原因传给 coder
