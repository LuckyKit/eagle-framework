# /new-project — 项目初始化

> 纯脚手架工具：创建目录结构、复制编码规范、生成骨架文件。
> 完成后用 /discuss 开始功能开发。

---

## 触发方式

```
/new-project        ← 交互式选栈，初始化新项目
/new-project sense  ← 感知现有项目技术栈
```

---

## 场景一：全新项目

### 步骤 1：询问项目信息

```
🦅 Eagle 项目初始化

项目名称（将用于 go.mod / package.json）：
选择技术栈（可多选）：
  [1] Go 后端（backend/）
  [2] React Web（web/）
  [3] Flutter 移动端（mobile/）

示例输入：1 2 3（全选）或 1 2（Go + React）
```

等待用户选择。

### 步骤 2：创建目录结构

根据选择创建：

```bash
# 通用
mkdir -p .eagle/rules .eagle/components .eagle/knowledge .eagle/memory .eagle/tasks

# Go
mkdir -p backend/cmd/server
mkdir -p backend/internal/{handler/middleware,service,repository,domain,bootstrap}
mkdir -p backend/pkg/{apperr,pagination}
mkdir -p backend/config backend/migrations

# React
mkdir -p web/src/{api,hooks,stores,types,lib,router}
mkdir -p web/src/components/{ui,layout}
mkdir -p web/src/features
mkdir -p web/test/mocks web/public

# Flutter
mkdir -p mobile/lib/core/{constants,exceptions,extensions,network,router,theme}
mkdir -p mobile/lib/{features,shared/{widgets,providers}}
mkdir -p mobile/test/helpers
```

### 步骤 3：复制编码规范

根据选择的栈，从框架复制 `.eagle/rules/{stack}/` 到项目：
- Go → `code-style.md`, `project-structure.md`, `testing.md`, `INDEX.md`
- React → 同上
- Flutter → 同上

### 步骤 4：复制组件蓝图

将框架 `.eagle/components/` 完整复制到项目 `.eagle/components/`。

### 步骤 5：生成骨架文件

**Go：**
- `backend/go.mod`（模块名用项目名）
- `backend/cmd/server/main.go`（含 graceful shutdown）
- `backend/config/config.yaml`
- `backend/.gitignore`

**React：**
- `web/package.json`（项目名，含标准依赖）
- `web/vite.config.ts`（含 Vitest 配置 + `@` 路径别名）
- `web/.gitignore`
- `web/.env`（VITE_API_BASE_URL 占位）

**Flutter：**
- `mobile/pubspec.yaml`（项目名，含 Riverpod + GoRouter + Dio 等标准依赖）
- `mobile/.gitignore`

骨架来源：从框架 `templates/` 目录读取 `.tpl` 文件，替换 `{{PROJECT_NAME}}`。

### 步骤 6：初始化 git

```bash
git init
# 追加到 .gitignore（不覆盖已有内容）
echo "\n# Eagle — 项目私有\n.eagle/knowledge/\n.eagle/memory/\n.eagle/tasks/" >> .gitignore
git add .
git commit -m "chore: init project with Eagle Framework"
```

### 步骤 7：完成报告

```
✅ 项目初始化完成

项目名：{name}
技术栈：{选择的栈}
编码规范：.eagle/rules/ 已就绪
组件蓝图：.eagle/components/ 已就绪

下一步：
  运行 /discuss 开始功能开发
  或直接描述你要做什么，/discuss 会帮你规划
```

---

## 场景二：感知现有项目（`/new-project sense`）

只读，不改任何文件。检测：

```
backend/go.mod       存在 → Go 后端
web/package.json     存在 → React Web
mobile/pubspec.yaml  存在 → Flutter 移动端
.eagle/               存在 → Eagle 框架项目
```

输出：

```
🦅 项目感知结果

技术栈：Go + React
Eagle 规范：
  ✅ .eagle/rules/go/
  ✅ .eagle/rules/react/
  ❌ .eagle/rules/flutter/（未使用该栈）

任务历史：.eagle/tasks/（{N} 个任务）
可用命令：/discuss /dev /fix /refactor
```

如果 `.eagle/` 不存在，询问是否初始化（只初始化 `.eagle/` 目录，不改业务代码）。

---

## 硬性约束

1. **不覆盖已有文件** — 目标文件存在时跳过并提示
2. **git 初始化可选** — 已有 `.git` 时跳过
3. **sense 模式只读** — 不修改任何文件
4. **不做需求分析** — 这是脚手架工具，需求分析交给 /discuss
