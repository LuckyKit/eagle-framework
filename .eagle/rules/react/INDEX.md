# React 编码规范索引

> 更新时间：2026-06-21
> 适用：`web/` 目录的所有 React 代码

---

## 核心规范（写代码前必读）

| 文件 | 内容 | 优先级 |
|------|------|--------|
| [code-style.md](code-style.md) | 组件规范、Hooks 规范、Props 类型、命名 | ⭐⭐⭐ |
| [project-structure.md](project-structure.md) | 目录组织、路由、状态管理层次 | ⭐⭐⭐ |
| [testing.md](testing.md) | 组件测试、Hook 测试、集成测试 | ⭐⭐ |

---

## 技术栈约定

- **React 版本**：18+
- **构建工具**：Vite
- **语言**：TypeScript（严格模式）
- **路由**：React Router v6
- **状态管理**：Zustand（全局）/ useState（本地）
- **数据获取**：TanStack Query (React Query)
- **样式**：Tailwind CSS
- **测试**：Vitest + React Testing Library

---

## 快速查找

### 我要写新组件

1. 读 [code-style.md](code-style.md) — 组件规范 + Props 类型

### 我要写新 Hook

1. 读 [code-style.md](code-style.md) — Hook 命名 + 规范

### 我要组织路由/页面

1. 读 [project-structure.md](project-structure.md) — 目录约定

### 我要写测试

1. 读 [testing.md](testing.md) — RTL 写法 + Mock 规范
