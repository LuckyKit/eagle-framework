# 🦅 Eagle Framework

> 一套全自动的全栈开发 Agent 框架，适用于 Go · React · Flutter 的 Monorepo 项目。
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
- **用户级** — 自动写入 `~/.claude/settings.json`，注册插件，全局生效，重启 Claude Code 即可用
- **项目级** — 在当前目录初始化项目骨架（规范 + 组件蓝图 + 技术栈模板）

或直接指定级别：

```bash
npx eagle install --user      # 仅注册全局插件
npx eagle install --project   # 仅初始化当前项目
npx eagle install --all       # 两层都安装
```

### 分步安装

**第一步：注册 Claude Code 插件（用户级，一次性）**

```bash
npx eagle install --user
```

修改 `~/.claude/settings.json`，添加 `pluginMarketplaces` 和 `enabledPlugins`，重启 Claude Code 后 `/discuss`、`/dev`、`/fix`、`/refactor`、`/new-project` 全局可用。

**第二步：初始化新项目（项目级，每个项目一次）**

```bash
cd my-new-project
npx eagle install --project
```

交互式选择技术栈，自动生成：
- 项目目录结构（`backend/` / `web/` / `mobile/`）
- 编码规范（`.eagle/rules/`）
- 组件蓝图（`.eagle/components/`）
- 项目骨架文件

---

## 可用命令

| 命令 | 说明 |
|------|------|
| `/new-project` | 项目脚手架：选技术栈 → 创建目录 → 复制规范 → 生成骨架 → git init |
| `/new-project sense` | 感知现有项目技术栈（只读） |
| `/discuss <需求>` | **所有开发的统一入口**：需求澄清（含竞品图/交互设计）→ Phase + Wave 规划 → 并行执行 → 零交互 |
| `/dev` | 快捷执行：已有 PLAN.md 时跳过澄清，直接全自动执行；无 PLAN.md 时自动转 /discuss |
| `/fix <描述>` | Bug 快捷入口：预填 Bug 类型，直接进入 /discuss 结构化澄清 → 全自动修复 |
| `/refactor <目标>` | 重构快捷入口：预填重构类型，进入 /discuss 规划 → 分 Wave 执行 |

---

## 框架结构

```
eagle-framework/
│
├── plugins/dev-framework/          ← Claude Code 插件（全局，所有项目共享）
│   ├── agents/                     ← analyst / coder / tester / reviewer / knowledge-writer / debugger
│   ├── skills/                     ← discuss / dev / new-project / fix / refactor
│   ├── hooks/hooks.json            ← SessionStart 自动检测项目类型
│   └── scripts/detect_project.py
│
├── .eagle/                           ← npx 复制到项目的内容
│   ├── rules/
│   │   ├── go/                     ← Go 编码规范（4 个文档）
│   │   ├── react/                  ← React 编码规范（4 个文档）
│   │   └── flutter/                ← Flutter 编码规范（4 个文档）
│   └── components/
│       └── auth/                   ← Auth 组件蓝图（spec + knowledge + 三端实现模式）
│
├── templates/                      ← 项目骨架模板
│   ├── go/                         ← go.mod / main.go / config.yaml
│   ├── react/                      ← package.json / vite.config.ts
│   └── flutter/                    ← pubspec.yaml
│
├── bin/create.js                   ← npx 入口脚本
├── .claude-plugin/marketplace.json ← 插件市场清单
└── package.json
```

---

## 项目安装后的结构

```
my-project/
├── .eagle/
│   ├── rules/          ← 编码规范（npx 复制，静态快照）
│   ├── components/     ← 组件蓝图（npx 复制，静态快照）
│   ├── knowledge/      ← 项目知识（开发中自动积累）
│   ├── memory/         ← 踩坑记忆（开发中自动积累）
│   └── tasks/          ← 任务目录（PLAN.md / TEST.md / REVIEW.md）
├── backend/            ← Go 后端
├── web/                ← React Web
└── mobile/             ← Flutter App
```

**两层分工**：
- **插件层**（全局）：Skills + Agents + Hooks — 所有项目共享，Claude Code 重启自动更新
- **项目层**（私有）：rules + components + knowledge + memory — 项目启动时 npx 复制，各自独立

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
npx eagle uninstall --user      # 仅移除全局插件注册
npx eagle uninstall --project   # 仅清理当前项目 .eagle/
npx eagle uninstall --all       # 彻底卸载两层
```

### 用户级卸载

```bash
npx eagle uninstall --user
```

自动从 `~/.claude/settings.json` 移除 `pluginMarketplaces` 和 `enabledPlugins` 中的 Eagle 条目，重启 Claude Code 后生效。

### 项目级卸载

```bash
cd my-project
npx eagle uninstall --project
```

交互式删除：
- `.eagle/rules/` — 编码规范快照（安全删除）
- `.eagle/components/` — 组件蓝图快照（安全删除）
- `.eagle/QUICKSTART.md`
- 可选：`.eagle/knowledge/` / `.eagle/memory/` / `.eagle/tasks/`（你积累的数据，默认保留，单独询问）
- 自动清理 `.gitignore` 中的 Eagle 条目

> `.eagle/knowledge/` 和 `.eagle/memory/` 是你在项目中积累的知识，不会默默删除，会单独询问。

---

## 本地开发

```bash
# 克隆框架仓库
git clone git@github.com:yourname/eagle-framework.git
cd eagle-framework

# 安装依赖（仅 npx 脚本需要，框架本身无 npm 依赖）
npm install

# 测试 npx 脚本
node bin/create.js install --project
```

---

## 贡献

1. 更新规范：修改 `.eagle/rules/{stack}/` 下的文档，同步更新 `INDEX.md`
2. 更新 Agent/Skill：修改 `plugins/dev-framework/agents/` 或 `skills/`
3. 新增组件：在 `.eagle/components/` 下创建新目录，包含 `spec.md` + `knowledge.md` + 三端 `pattern.md`
4. 提交前测试 `bin/create.js init` 在空目录的行为
