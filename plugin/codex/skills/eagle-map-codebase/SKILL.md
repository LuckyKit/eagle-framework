---
name: eagle-map-codebase
description: "扫描现有项目，生成或刷新 `.eagle/codebase/`，让后续规划和实现不用每次重新理解项目结构。 Use this Codex skill when the user asks for the matching Eagle workflow or explicitly invokes $eagle-map-codebase."
---

# eagle-map-codebase

<!-- Generated from plugin/claude. Run `npm run sync:codex` after editing Claude skills. -->

Codex invocation: `$eagle-map-codebase`. Legacy Claude slash-command examples are preserved below for workflow compatibility.

# /eagle:map-codebase — 代码库地图

> 扫描现有项目，生成或刷新 `.eagle/codebase/`，让后续规划和实现不用每次重新理解项目结构。

## 调用方式

```text
/eagle:map-codebase
```

也可以在终端运行：

```bash
eagle map
```

## 何时使用

- 初始化一个已有项目后。
- 新增、移动或删除主要目录后。
- 开始一个跨端或跨模块任务前。
- Agent 对项目结构不确定时。

## 执行步骤

1. 读取 `.eagle/config.json` 中的 `codebaseMap` 配置。
2. 扫描项目目录，跳过 `.git`、`.eagle`、`node_modules`、`dist`、`build`、`coverage`、`.dart_tool` 等生成目录。
3. 生成或刷新：
   - `.eagle/codebase/STACK.md`
   - `.eagle/codebase/STRUCTURE.md`
   - `.eagle/codebase/TESTING.md`
   - `.eagle/codebase/CONVENTIONS.md`
4. 如果项目结构发生显著变化，更新 `.eagle/STATE.md` 的 `Recent Decisions` 或 `Next Actions`。

## 输出要求

- 地图必须是摘要，不要把所有源码复制进 `.eagle/codebase/`。
- `STRUCTURE.md` 只保留高信号目录和文件。
- `CONVENTIONS.md` 记录“后续 Agent 应该遵守的本地模式”。

## 硬性约束

1. **不改业务代码** — 只读项目并写 `.eagle/codebase/`。
2. **不覆盖人工补充的生命周期文档** — 不重写 `PROJECT.md`、`ROADMAP.md`、`STATE.md`。
3. **地图用于导航，不是完整索引** — 避免膨胀。
