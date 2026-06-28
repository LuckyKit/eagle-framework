# Eagle Quick Start

这份文档面向“我有一个自己的项目，想在里面使用本地 Eagle”的场景。

Eagle 分成两层：

- 用户级安装：把默认 runtime 的 Eagle skills / agents / hooks / scripts 复制到用户目录，通常只需要做一次。
- 项目级安装：把默认 runtime 的 Eagle skills / agents / hooks / scripts 复制到当前项目，并生成 `.eagle/` 保存规范、项目状态、代码库地图、质量门禁、长期记忆。

推荐做法是先把当前 Eagle 仓库链接成本机命令，然后在任意业务项目中执行安装。

## 1. 注册本地 Eagle 命令

在 Eagle 框架仓库执行：

```bash
cd eagle-framework/
npm link
```

完成后，本机任意目录都可以使用：

```bash
eagle --help
```

如果你不想使用 `npm link`，也可以直接调用本地入口：

```bash
node ./bin/eagle.js --help
```

## 2. 安装用户级 Eagle

用户级安装只需要做一次。当前默认 runtime 是 Claude Code + Codex，会把 Eagle runtime 分发到对应客户端目录。

```bash
cd eagle-framework/
eagle install --user
```

安装后重启 Claude Code，让 `eagle-*` skills 和 agents 全局生效。

如果没有使用 `npm link`：

```bash
node ./bin/eagle.js install --user
```

## 3. 在你的业务项目中初始化 Eagle

进入你自己的项目目录：

```bash
cd /path/to/your-project
eagle install --project
```

这个命令会在当前项目里生成默认 runtime 目录和 `.eagle/`：Claude 使用 `.claude/`，Codex 使用 `.agents/skills/` 和 `.codex/agents/`，`.eagle/` 保存通用规范、组件蓝图和基础上下文，并自动扫描现有技术栈。它不会询问项目名或技术栈，也不会生成业务目录。

如果没有使用 `npm link`：

```bash
cd /path/to/your-project
node /path/to/eagle-framework/bin/eagle.js install --project
```

安装后你的项目会多出类似结构：

```text
your-project/
├── .claude/
│   ├── agents/
│   ├── skills/
│   ├── hooks/eagle/
│   ├── scripts/eagle/
│   └── settings.json
├── .eagle/
│   ├── config.json
│   ├── PROJECT.md
│   ├── ROADMAP.md
│   ├── STATE.md
│   ├── rules/
│   ├── components/
│   ├── codebase/
│   ├── gates/
│   ├── knowledge/
│   ├── memory/
│   ├── phases/
│   └── tasks/
└── ...
```

## 4. 扫描现有项目

如果你的项目已经有代码，初始化后先生成代码库地图：

```bash
eagle map
```

它会刷新：

- `.eagle/codebase/STACK.md`
- `.eagle/codebase/STRUCTURE.md`
- `.eagle/codebase/TESTING.md`
- `.eagle/codebase/CONVENTIONS.md`

这些文件会帮助 Agent 在后续开发时先理解项目，而不是每次从零开始读。

## 5. 日常开发入口

在 Claude Code 中打开你的业务项目后，推荐按这个节奏使用：

```text
/lifecycle
```

先维护项目目标、roadmap、当前状态和下一步。

```text
/map-codebase
```

当目录结构、技术栈或测试方式变化时刷新代码库地图。

```text
/discuss <你的需求>
```

用于新功能、较复杂改动、需要先澄清方案的任务。

```text
/dev
```

已有清晰计划或已有 `.eagle/tasks/*/PLAN.md` 时，直接进入实现。

```text
/fix <bug 描述>
```

用于定位和修复 bug。

```text
/gate
```

在计划前或完成前检查质量门禁。

```text
/memory
```

把项目决策、踩坑、稳定模式写入长期记忆，方便跨会话恢复上下文。

## 6. 更新 Eagle 后同步到项目

当你修改了 Eagle 框架里的 `payload/` 规范或组件蓝图后，在业务项目里重新执行：

```bash
cd /path/to/your-project
eagle install --project
```

默认不会覆盖你项目里已经存在的 `.eagle/knowledge/`、`.eagle/memory/`、`.eagle/tasks/` 等沉淀内容。

如果只是项目代码变化，通常只需要：

```bash
eagle map
```

## 7. 最小使用流程

新项目或现有项目接入 Eagle，最短路径是：

```bash
cd eagle-framework/
npm link
eagle install --user

cd /path/to/your-project
eagle install --project
eagle map
```

然后重启 Claude Code，在你的业务项目里执行：

```text
/lifecycle
/discuss <第一个要做的需求>
```
