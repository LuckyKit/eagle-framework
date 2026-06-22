# /eagle:gate — 质量门禁

> 在计划、执行、测试、审查和完成前检查最小必要质量门禁。

## 调用方式

```text
/eagle:gate {slug}
/eagle:gate {slug} plan
/eagle:gate {slug} done
```

## 门禁来源

- `.eagle/config.json`
- `.eagle/gates/QUALITY-GATES.md`
- `.eagle/tasks/{slug}/DISCUSSION.md`
- `.eagle/tasks/{slug}/PLAN.md`
- `.eagle/tasks/{slug}/TEST.md`
- `.eagle/tasks/{slug}/REVIEW.md`
- `.eagle/codebase/`

## plan 门禁

开始编码前必须满足：

- `DISCUSSION.md` 存在，目标和边界明确。
- `PLAN.md` 存在，并包含验收标准。
- Wave 依赖关系清楚。
- 涉及栈对应的 `.eagle/rules/{stack}/INDEX.md` 存在。
- 已阅读 `.eagle/codebase/` 中相关地图。

## done 门禁

任务完成前必须满足：

- `TEST.md` 存在，记录了实际命令和结果。
- `REVIEW.md` 存在，且没有 CRITICAL。
- 若有失败测试，必须明确标注为已修复、延期或超出范围。
- 关键决策写入 `.eagle/knowledge/INDEX.md`。
- 踩坑、失败尝试或风险写入 `.eagle/memory/INDEX.md`。

## 输出格式

```markdown
# Gate Report

## Result
PASS / FAIL

## Blocking Issues
- [ ] ...

## Warnings
- ...

## Next Action
...
```

## 硬性约束

1. **只检查，不修复**。
2. **有阻塞项时必须 FAIL**。
3. **不要跳过 memory gate**，自用框架最值钱的是积累可复用经验。
