# Eagle Framework Agent Guide

> 这个仓库是 Eagle Framework 框架本身，不是使用 Eagle 生成的业务项目。
> 在这里维护的是 Eagle runtime 分发源、Agent/Skill 定义、规范文档、组件蓝图和 Eagle CLI。

## 工作边界

- 优先把修改限制在用户明确要求的范围内。
- 不要在本仓库运行 `/discuss`、`/dev`、`/fix`、`/refactor` 等 Eagle Skills；这些命令是给安装了 Eagle 的目标项目使用的。
- 不要把本仓库当作 Go/Python/Next.js/Flutter 业务项目来开发业务功能。
- 不要删除或重写 `.eagle/knowledge/`、`.eagle/memory/`、`.eagle/tasks/` 这类运行期积累目录，除非用户明确要求。
- 保留用户已有改动；遇到无关 dirty files 时不要回滚。

## 目录速查

```text
eagle-framework/
├── bin/
│   └── eagle.js                    # CLI 入口
├── cli/
│   └── commands.js                 # install / uninstall / sense / map
├── plugin/                         # runtime 分发源
│   ├── claude/                     # Claude Code runtime
│   │   ├── .claude-plugin/         # Claude 插件市场清单
│   │   ├── agents/                 # Claude Agent 定义
│   │   ├── skills/                 # Claude Skill 定义
│   │   ├── hooks/                  # SessionStart 等钩子
│   │   └── scripts/                # 钩子脚本
│   └── codex/                      # Codex runtime
│       ├── .codex-plugin/
│       ├── agents/
│       └── skills/
├── payload/
│   ├── rules-go/                   # Go 编码规范
│   ├── rules-python/               # Python 编码规范
│   ├── rules-nextjs/               # Next.js 编码规范
│   ├── rules-flutter/              # Flutter 编码规范
│   └── component-auth/             # 跨端组件蓝图
├── templates/                      # 新项目模板（仅 new-project 场景使用）
├── README.md                       # 用户文档
└── CLAUDE.md                       # Claude Code 专用说明
```

## 常用命令

```bash
npm install
npm run install:user
npm run install:project
npm run uninstall:user
npm run uninstall:project
node bin/eagle.js install --project
node bin/eagle.js uninstall --project
node bin/eagle.js sense
```

`install --project` 和 `uninstall --project` 是交互式命令，会修改当前目录；测试前先确认工作目录和预期影响。

## 修改规范

- 规范位于 `payload/rules-{go,python,nextjs,flutter}/`。
- 每套规范都有 `INDEX.md`，修改或新增规范文件后同步更新对应索引。
- 三套规范尽量保持结构平行：`code-style.md`、`project-structure.md`、`testing.md`。
- 写规范时描述约束、模式和反例，不要夹带一次性业务实现。

## 修改 Agent 和 Skill

- Claude Agent 文件路径：`plugin/claude/agents/{name}.md`。
- Claude Skill 文件路径：`plugin/claude/skills/{name}/SKILL.md`。
- Codex runtime 路径：`plugin/codex/agents/` 和 `plugin/codex/skills/`，由 `npm run sync:codex` 从 Claude 源生成。
- 修改 Claude Agent/Skill 后运行 `npm run sync:codex`，不要手工双写两套 runtime。
- Agent frontmatter 至少包含 `name` 和 `description`。
- Skill 中引用 Agent 时使用 Agent frontmatter 的 `name` 字段值，例如 `eagle-analyst`。
- 修改 Agent/Skill 后，检查相关命令说明、README 表格和插件清单是否也需要同步。

## 修改组件蓝图

- 组件蓝图位于 `payload/component-{component}/`。
- 组件是跨端功能决策文档，不是可直接复制运行的业务代码。
- 一个完整组件通常包含：
  - `spec.md`：接口契约、数据结构、错误语义。
  - `knowledge.md`：设计决策、注意事项、踩坑记录。
  - `go/pattern.md`：Go 后端实现模式。
  - `python/pattern.md`：Python 后端实现模式。
  - `nextjs/pattern.md`：Next.js Web 实现模式。
  - `flutter/pattern.md`：Flutter 移动端实现模式。
- 新增组件时优先补齐三端 pattern；如果暂缺某端，要在文档中写明原因和后续补齐点。

## 修改 CLI 和模板

- CLI 入口是 `bin/eagle.js`，命令实现位于 `cli/commands.js`，要求 Node.js `>=18.0.0`。
- 模板位于 `templates/{go,python,nextjs,flutter}/`，变量格式使用 `{{PROJECT_NAME}}`。
- 修改安装、卸载或感知逻辑后，至少手动检查对应命令路径。
- 涉及文件删除、复制、写入用户目录时，要保持幂等和可恢复；不要静默删除用户积累的数据。

## 自用功能取舍

- 默认保留：全生命周期管理、代码库地图、质量门禁、跨会话长期记忆、配置系统。
- 默认暂缓：多运行时适配、复杂 worktree、自动 PR 发布、capability 市场、重型供应链扫描。
- 新增能力时先接入 `.eagle/config.json` 和相关 Skill，再考虑 CLI 自动化。

## 验证建议

- 文档或规范改动：检查 Markdown 渲染、链接和目录名称是否准确。
- Agent/Skill 改动：检查 frontmatter、路径引用和名称引用是否一致。
- CLI 改动：运行相关 `node bin/eagle.js ...` 命令，在临时目录中验证更稳妥。
- 模板改动：确认 new-project 场景下生成文件名和变量替换正确。

## 提交前检查

- `git status --short`
- `rg --files` 确认新增文件位置符合预期。
- 只提交与当前任务相关的文件。
- 不要把临时测试目录、依赖目录、构建产物或个人本地配置提交进仓库。
