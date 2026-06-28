# Next.js 编码规范索引

> 更新时间：2026-06-28
> 适用：`web/` 目录的所有 Next.js 代码

---

## 核心规范（写代码前必读）

| 文件 | 内容 | 优先级 |
|------|------|--------|
| [code-style.md](code-style.md) | 组件规范、Server/Client Component 边界、Server Actions 写法、Props 类型、命名 | ⭐⭐⭐ |
| [project-structure.md](project-structure.md) | App Router 目录组织、路由约定、文件命名、状态管理层次、中间件 | ⭐⭐⭐ |
| [testing.md](testing.md) | Server Component 测试、Client Component 测试、Server Actions 测试、集成测试 | ⭐⭐ |

---

## 技术栈约定

- **框架**：Next.js 14+（App Router，文件路由）
- **语言**：TypeScript（严格模式）
- **默认**：Server Components，仅交互组件标记 `'use client'`
- **数据变更**：Server Actions（表单提交 / `revalidatePath` / `revalidateTag`）
- **API 端点**：Route Handlers（`route.ts`）
- **状态管理**：Zustand（客户端全局状态）+ TanStack Query（服务端缓存）
- **样式**：Tailwind CSS
- **测试**：Jest + React Testing Library
- **国际化**：next-intl
- **认证**：next-auth（Auth.js v5）
- **SEO**：Metadata API（`generateMetadata` / `metadata` 导出）
- **鉴权重定向**：Middleware（`middleware.ts`）

---

## 快速查找

### 我要写新页面 / 新路由

1. 读 [project-structure.md](project-structure.md) — App Router 目录约定 + `layout.tsx` / `page.tsx` / `loading.tsx` / `error.tsx` 规则

### 我要写新组件

1. 先判断：有没有交互/状态/浏览器 API？没有 → Server Component（默认），有 → `'use client'`
2. 读 [code-style.md](code-style.md) — 组件规范 + Props 类型 + `'use client'` 边界规则

### 我要写数据变更（表单 / 提交 / 删除）

1. 读 [code-style.md](code-style.md) — Server Actions 写法 + `revalidatePath` / `revalidateTag` 规范

### 我要写 API 端点

1. 读 [code-style.md](code-style.md) — Route Handlers 写法（`route.ts` + HTTP 方法导出）

### 我要写测试

1. 读 [testing.md](testing.md) — Jest + RTL 写法 + Server Component / Server Action Mock 规范

### 我要加鉴权 / 路由保护

1. 读 [project-structure.md](project-structure.md) — Middleware（`middleware.ts`）+ next-auth 集成

### 我要做 SEO

1. 读 [code-style.md](code-style.md) — Metadata API（`generateMetadata` / `metadata` 导出）+ Open Graph 约定
