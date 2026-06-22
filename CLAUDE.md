# Eagle Framework — Claude Code 配置

> 这是框架仓库本身，不是使用 Eagle 的项目。
> 在这里开发的是 Skills、Agents、规范文档，不是业务代码。

---

## 这个仓库是什么

Eagle Framework 是一套通过 Claude Code 插件 + npx 分发的全栈开发 Agent 框架，适用于 Go + React + Flutter 的 Monorepo 项目。

**你在这个仓库里的任务**通常是：
- 更新/新增编码规范（`.eagle/rules/`）
- 更新/新增 Agent 定义（`plugins/dev-framework/agents/`）
- 更新/新增 Skill 定义（`plugins/dev-framework/skills/`）
- 维护组件蓝图（`.eagle/components/`）
- 维护 npx 脚手架脚本（`bin/create.js`）

---

## 目录结构速查

```
eagle-framework/
├── plugins/dev-framework/    ← Claude Code 插件主体（全局生效）
│   ├── agents/               ← Agent 定义（analyst/coder/tester/reviewer/knowledge-writer/debugger）
│   ├── skills/               ← Skill 定义（discuss/dev/new-project/fix/refactor）
│   ├── hooks/hooks.json      ← SessionStart 钩子
│   └── scripts/              ← 钩子脚本
├── .eagle/
│   ├── rules/                ← 编码规范（go/react/flutter，各 4 个文件）
│   └── components/           ← 组件蓝图（auth 等，含 spec/knowledge/三端 pattern）
├── templates/                ← 项目骨架模板（.tpl 文件）
├── bin/create.js             ← npx 入口脚本
├── .claude-plugin/
│   └── marketplace.json      ← 插件市场清单
└── package.json
```

---

## 修改规范时注意

1. **每套规范都有 INDEX.md** — 修改规范文件后同步更新对应的 INDEX.md 快速查找表
2. **格式参考现有文件** — `.eagle/rules/go/code-style.md` 是标准格式参考
3. **保持三套规范平行** — Go/React/Flutter 的规范文件名一致（`code-style.md` / `project-structure.md` / `testing.md`）

## 修改 Agent/Skill 时注意

1. **Agent frontmatter 必填字段**：`name`、`description`
2. **Skill 文件路径**：`plugins/dev-framework/skills/{name}/SKILL.md`
3. **Agent 文件路径**：`plugins/dev-framework/agents/{name}.md`
4. **Skill 中引用 Agent**：用 agent 的 `name` 字段值（如 `eagle-analyst`）

## 修改组件蓝图时注意

1. **组件 = 文档不是代码** — 描述模式和决策，不提供可直接运行的代码
2. **三端必须都覆盖** — `go/pattern.md` + `react/pattern.md` + `flutter/pattern.md`
3. **spec.md 是接口契约** — 后端 API 定义在这里，前端/移动端依此实现

---

## 不在这个仓库做的事

- 不运行实际业务代码
- 不执行测试（这是框架，不是被测项目）
- 不使用 `/discuss` `/dev` 等 Skills（这些 Skills 是给使用框架的项目用的）
