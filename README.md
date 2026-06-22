# 🦅 Eagle Framework

> 一套全自动的全栈开发 Agent 框架，适用于 Go · Python · React · Flutter 项目。
> 只有 `/discuss` 阶段需要人工确认，其余全程自动执行。

---

## 核心理念

```
你输入需求
    ↓
/discuss → 确认 PLAN.md    ← 唯一的人工介入点
    ↓
全自动执行
coder → git commit（原子）→ tester → reviewer → knowledge-writer
```

---

## 安装

### 一键安装（推荐）

```bash
npx eagle install
```

交互式询问安装级别：
- **用户级** — 复制 Eagle skills / agents / hooks / scripts 到 `~/.claude/`，全局生效
- **项目级** — 复制 Eagle skills / agents / hooks / scripts 到当前项目 `.claude/`，并初始化 `.eagle/`

或直接指定级别：

```bash
npx eagle install --user      # 仅安装到 ~/.claude/
npx eagle install --project   # 仅安装到当前项目
npx eagle install --all       # 两层都安装
```

### 分步安装

**第一步：安装用户级能力（可选，一次性）**

```bash
npx eagle install --user
```

复制 `plugin/agents`、`plugin/skills`、`plugin/hooks`、`plugin/scripts` 到 `~/.claude/`，并写入 Eagle 的 SessionStart hook。重启 Claude Code 后，`eagle-*` skills 和 agents 全局可用。

**第二步：接入业务项目（项目级，每个项目一次）**

```bash
cd my-project
npx eagle install --project
```

项目级安装不会询问项目名或技术栈，也不会生成业务目录。它只会：
- 复制 Eagle skills / agents / hooks / scripts 到当前项目 `.claude/`
- 初始化 `.eagle/` 上下文
- 复制通用编码规范（`.eagle/rules/`）
- 复制组件蓝图（`.eagle/components/`）
- 初始化生命周期、质量门禁、长期记忆
- 自动扫描现有项目并生成 `.eagle/codebase/`

---

## 可用命令

| 命令 | 说明 |
|------|------|
| `/new-project` | 从 0 创建新项目时使用：先澄清项目目标，再生成项目上下文和路线图 |
| `/new-project sense` | 感知现有项目技术栈（只读） |
| `/discuss <需求>` | **所有开发的统一入口**：需求澄清（含竞品图/交互设计）→ Phase + Wave 规划 → 并行执行 → 零交互 |
| `/dev` | 快捷执行：已有 PLAN.md 时跳过澄清，直接全自动执行；无 PLAN.md 时自动转 /discuss |
| `/fix <描述>` | Bug 快捷入口：预填 Bug 类型，直接进入 /discuss 结构化澄清 → 全自动修复 |
| `/refactor <目标>` | 重构快捷入口：预填重构类型，进入 /discuss 规划 → 分 Wave 执行 |
| `/lifecycle` | 项目全生命周期管理：维护 PROJECT / ROADMAP / STATE / phases |
| `/map-codebase` | 扫描现有项目并生成 `.eagle/codebase/` 代码库地图 |
| `/gate` | 质量门禁：检查 plan / done 阶段是否满足交付底线 |
| `/memory` | 跨会话长期记忆：沉淀决策、模式、踩坑和恢复上下文 |
| `/config` | 配置系统：维护 `.eagle/config.json` 工作流策略 |

CLI 辅助命令：

```bash
eagle map   # 扫描现有项目并刷新 .eagle/codebase/
```

---

## 框架结构

```
eagle-framework/
│
├── bin/
│   └── eagle.js                    ← npx / CLI 入口脚本（很薄）
│
├── cli/
│   └── commands.js                 ← install / uninstall / sense / map 实现
│
├── plugin/                         ← Claude Code 插件（全局，所有项目共享）
│   ├── agents/                     ← analyst / coder / tester / reviewer / knowledge-writer / debugger
│   ├── skills/                     ← discuss / dev / new-project / fix / refactor / gate / memory ...
│   ├── hooks/hooks.json            ← SessionStart 自动检测项目类型
│   └── scripts/detect_project.py
│
├── payload/                         ← npx 映射复制到项目 .eagle/ 的内容
│   ├── rules-go/                   ← Go 编码规范（安装到 .eagle/rules/go/）
│   ├── rules-python/               ← Python 编码规范（安装到 .eagle/rules/python/）
│   ├── rules-react/                ← React 编码规范（安装到 .eagle/rules/react/）
│   ├── rules-flutter/              ← Flutter 编码规范（安装到 .eagle/rules/flutter/）
│   └── component-auth/             ← Auth 组件蓝图（安装到 .eagle/components/auth/）
│
├── templates/                      ← 新项目模板（仅 new-project 场景使用）
│   ├── go/                         ← go.mod / main.go / config.yaml
│   ├── react/                      ← package.json / vite.config.ts
│   └── flutter/                    ← pubspec.yaml
│
├── .claude-plugin/marketplace.json ← 插件市场清单
└── package.json
```

---

## 项目安装后的结构

```
my-project/
├── .claude/
│   ├── agents/         ← eagle-* agents
│   ├── skills/         ← eagle-* skills
│   ├── hooks/eagle/    ← Eagle hook 快照
│   ├── scripts/eagle/  ← Eagle 脚本快照
│   └── settings.json   ← 项目级 SessionStart hook
├── .eagle/
│   ├── config.json     ← 工作流配置（生命周期 / 门禁 / 记忆 / 代码库地图）
│   ├── PROJECT.md      ← 项目目标、用户、约束、长期决策
│   ├── ROADMAP.md      ← 里程碑、Phase、Backlog
│   ├── STATE.md        ← 当前状态、阻塞、最近决策、下一步
│   ├── rules/          ← 编码规范（npx 复制，静态快照）
│   ├── components/     ← 组件蓝图（npx 复制，静态快照）
│   ├── codebase/       ← 代码库地图（STACK / STRUCTURE / TESTING / CONVENTIONS）
│   ├── gates/          ← 质量门禁
│   ├── knowledge/      ← 项目知识（开发中自动积累）
│   ├── memory/         ← 踩坑记忆（开发中自动积累）
│   ├── phases/         ← 阶段级上下文和交付记录
│   └── tasks/          ← 任务目录（PLAN.md / TEST.md / REVIEW.md）
└── ...                 ← 你的现有业务代码（Eagle 不强制目录结构）
```

**两层分工**：
- **插件层**（全局）：Skills + Agents + Hooks — 所有项目共享，Claude Code 重启自动更新
- **项目层**（私有）：rules + components + knowledge + memory — 项目启动时 npx 复制，各自独立

---

## 自用工作流取舍

Eagle 借鉴 GSD 的结构，但默认只保留快速迭代最需要的部分：

**必要，默认启用**
- 全生命周期管理：`PROJECT.md` / `ROADMAP.md` / `STATE.md`
- 代码库地图：`.eagle/codebase/`
- 质量门禁：plan 前检查、done 前检查
- 长期记忆：`.eagle/knowledge/` + `.eagle/memory/`
- 配置系统：`.eagle/config.json`

**暂缓，不默认实现**
- 多运行时适配（Codex / Gemini / Cursor / Windsurf 等）
- 复杂 worktree / 多工作区隔离
- 自动 PR 创建和发布流水线
- 大规模命令路由器和 capability 市场
- 重型安全/供应链扫描

这套默认值更适合个人快速开发：新项目初始化后，先有地图、状态、门禁和记忆，再逐步自动化。

---

## 组件（Component）概念

组件 = **跨端功能蓝图**，不是可复制的代码，而是可复用的决策。

```
.eagle/components/auth/
├── spec.md          ← 接口契约（API 定义、数据结构、错误语义）
├── knowledge.md     ← 设计决策、踩坑、注意事项
├── go/pattern.md    ← Go 后端实现模式
├── react/pattern.md ← React Web 实现模式
└── flutter/pattern.md ← Flutter 移动端实现模式
```

当 analyst 收到"做登录"需求时，先查 `components/auth/`，按已有决策实现，避免重复踩坑。

**提取新组件**：项目中实现了新的跨端功能后，手动将成熟实现抽象回框架仓库，下次 npx 时其他项目自动获得。

---

## 技术栈

| 层次 | 技术 |
|------|------|
| Go 后端 | Gin + sqlx + slog + testify |
| React Web | Vite + TypeScript + Zustand + TanStack Query + Tailwind + Vitest + RTL |
| Flutter | Riverpod + GoRouter + Dio + flutter_secure_storage + mocktail |

---

## 卸载

Eagle 有两层安装，可以分开或一起卸载。

### 一键卸载

```bash
npx eagle uninstall
```

交互式询问卸载级别，或直接指定：

```bash
npx eagle uninstall --user      # 删除 ~/.claude/ 中 Eagle runtime
npx eagle uninstall --project   # 删除当前项目 .claude/ 中 Eagle runtime 和 .eagle/
npx eagle uninstall --all       # 彻底卸载两层
```

### 用户级卸载

```bash
npx eagle uninstall --user
```

自动删除 `~/.claude/agents/eagle-*`、`~/.claude/skills/eagle-*`、`~/.claude/hooks/eagle/`、`~/.claude/scripts/eagle/`，并清理 Eagle 的 SessionStart hook。也会清理旧版 `pluginMarketplaces` / `enabledPlugins` 注册。

### 项目级卸载

```bash
cd my-project
npx eagle uninstall --project
```

自动删除：
- 当前项目 `.claude/agents/eagle-*`
- 当前项目 `.claude/skills/eagle-*`
- 当前项目 `.claude/hooks/eagle/`
- 当前项目 `.claude/scripts/eagle/`
- 当前项目 `.eagle/`
- `.gitignore` 中的 Eagle 条目

---

## 本地开发

```bash
# 克隆框架仓库
git clone git@github.com:yourname/eagle-framework.git
cd eagle-framework

# 安装依赖（仅 npx 脚本需要，框架本身无 npm 依赖）
npm install

# 测试 npx 脚本
node bin/eagle.js install --project
```

### 在本地项目中引用 Eagle

开发 Eagle 本身时，推荐用 `npm link` 把当前框架链接成全局本地命令：

```bash
cd C:\Users\loco9\Desktop\eagle-framework
npm link

cd C:\path\to\your-project
eagle install --project
```

如果还没有安装用户级 Eagle，先执行一次：

```bash
cd C:\Users\loco9\Desktop\eagle-framework
eagle install --user
```

不想使用 `npm link` 时，也可以直接调用本地入口：

```bash
cd C:\path\to\your-project
node C:\Users\loco9\Desktop\eagle-framework\bin\eagle.js install --project
```

项目结构变化后刷新代码库地图：

```bash
eagle map
```

---

## 贡献

1. 更新规范：修改 `payload/rules-{stack}/` 下的文档，同步更新 `INDEX.md`
2. 更新 Agent/Skill：修改 `plugin/agents/` 或 `plugin/skills/`
3. 新增组件：在 `payload/component-{name}/` 下创建目录，包含 `spec.md` + `knowledge.md` + 三端 `pattern.md`
4. 提交前测试 `node bin/eagle.js install --project` 对现有项目无侵入接入的行为
