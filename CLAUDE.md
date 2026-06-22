# Eagle Framework — Claude Code 配置

> 这是框架仓库本身，不是使用 Eagle 的项目。
> 在这里开发的是 Skills、Agents、规范文档，不是业务代码。

---

## 这个仓库是什么

Eagle Framework 是一套通过 Claude Code 插件 + npx 分发的全栈开发 Agent 框架，适用于 Go + Python + React + Flutter 项目。

**你在这个仓库里的任务**通常是：
- 更新/新增编码规范（`payload/rules-*`）
- 更新/新增 Agent 定义（`plugin/agents/`）
- 更新/新增 Skill 定义（`plugin/skills/`）
- 维护组件蓝图（`payload/component-*`）
- 维护 Eagle CLI 入口和命令实现（`bin/eagle.js` + `cli/`）
- 维护生命周期、代码库地图、质量门禁、长期记忆和配置系统

---

## 目录结构速查

```
eagle-framework/
├── bin/
│   └── eagle.js              ← CLI 入口
├── cli/
│   └── commands.js           ← install / uninstall / sense / map
├── plugin/                   ← Claude Code 插件主体（全局生效）
│   ├── agents/               ← Agent 定义（analyst/coder/tester/reviewer/knowledge-writer/debugger）
│   ├── skills/               ← Skill 定义（discuss/dev/new-project/fix/refactor）
│   ├── hooks/hooks.json      ← SessionStart 钩子
│   └── scripts/              ← 钩子脚本
├── payload/
│   ├── rules-go/             ← Go 编码规范
│   ├── rules-python/         ← Python 编码规范
│   ├── rules-react/          ← React 编码规范
│   ├── rules-flutter/        ← Flutter 编码规范
│   └── component-auth/       ← 组件蓝图（auth 等，含 spec/knowledge/三端 pattern）
├── templates/                ← 新项目模板（.tpl 文件，仅 new-project 场景使用）
├── .claude-plugin/
│   └── marketplace.json      ← 插件市场清单
└── package.json
```

---

## 修改规范时注意

1. **每套规范都有 INDEX.md** — 修改规范文件后同步更新对应的 INDEX.md 快速查找表
2. **格式参考现有文件** — `payload/rules-go/code-style.md` 是标准格式参考
3. **保持规范平行** — Go/Python/React/Flutter 的规范文件名一致（`code-style.md` / `project-structure.md` / `testing.md`）

## 修改 Agent/Skill 时注意

1. **Agent frontmatter 必填字段**：`name`、`description`
2. **Skill 文件路径**：`plugin/skills/{name}/SKILL.md`
3. **Agent 文件路径**：`plugin/agents/{name}.md`
4. **Skill 中引用 Agent**：用 agent 的 `name` 字段值（如 `eagle-analyst`）

## 修改组件蓝图时注意

1. **组件 = 文档不是代码** — 描述模式和决策，不提供可直接运行的代码
2. **三端必须都覆盖** — `go/pattern.md` + `react/pattern.md` + `flutter/pattern.md`
3. **spec.md 是接口契约** — 后端 API 定义在这里，前端/移动端依此实现

## 修改生命周期能力时注意

1. **自用优先** — 只保留快速迭代新项目真正高频的能力
2. **必要能力**：生命周期、代码库地图、质量门禁、长期记忆、配置系统
3. **暂缓能力**：多运行时适配、复杂 worktree、自动 PR、capability 市场、重型安全扫描
4. **CLI 与 Skill 要同步** — `cli/commands.js` 生成的 `.eagle/` 产物必须和 `plugin/skills/` 里的说明一致

---

## 不在这个仓库做的事

- 不运行实际业务代码
- 不执行测试（这是框架，不是被测项目）
- 不使用 `/discuss` `/dev` 等 Skills（这些 Skills 是给使用框架的项目用的）
