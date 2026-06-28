---
name: eagle-config
description: "读取和维护 `.eagle/config.json`，控制 Eagle 的自用工作流策略。 Use this Codex skill when the user asks for the matching Eagle workflow or explicitly invokes $eagle-config."
---

# eagle-config

<!-- Generated from plugin/claude. Run `npm run sync:codex` after editing Claude skills. -->

Codex invocation: `$eagle-config`. Legacy Claude slash-command examples are preserved below for workflow compatibility.

# /eagle:config — 配置系统

> 读取和维护 `.eagle/config.json`，控制 Eagle 的自用工作流策略。

## 调用方式

```text
/eagle:config show
/eagle:config set qualityGates.review.blockSeverity CRITICAL
```

## 配置文件

路径：`.eagle/config.json`

核心区块：

- `workflow` — 生命周期、代码库地图、质量门禁、长期记忆是否启用。
- `qualityGates` — plan/test/review/memory 门禁策略。
- `memory` — 决策和踩坑记录约定。
- `codebaseMap` — 扫描范围、排除目录、最大文件数。

## 修改规则

- 修改前读取完整 JSON。
- 保留未知字段，避免破坏用户手写配置。
- 修改后输出变更摘要。
- JSON 必须保持 2 空格缩进。

## 默认建议

自用快速迭代项目建议开启：

- `workflow.lifecycle`
- `workflow.codebaseMap`
- `workflow.qualityGates`
- `workflow.longTermMemory`
- `workflow.requireReviewBeforeDone`

暂缓开启：

- 多运行时适配。
- 复杂 worktree 工作区。
- 自动 PR 发布。

## 硬性约束

1. **不静默删除配置字段**。
2. **配置错误时先备份再修复**。
3. **不要把环境密钥写入 config.json**。
