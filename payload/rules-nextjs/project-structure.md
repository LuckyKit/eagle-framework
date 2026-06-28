# Next.js 项目结构规范

> 适用于 Next.js 14+ App Router 项目

## 目录布局

```
web/
├── src/
│   ├── app/                       ← Next.js App Router（文件即路由）
│   │   ├── layout.tsx             ← 根布局（Server Component，必须）
│   │   ├── page.tsx               ← 首页 /
│   │   ├── loading.tsx            ← 根 loading 状态
│   │   ├── error.tsx              ← 根 error boundary
│   │   ├── not-found.tsx          ← 全局 404 页面
│   │   ├── (auth)/                ← 路由组（未认证页面）
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx         ← auth 路由组布局
│   │   ├── (dashboard)/           ← 路由组（认证后页面）
│   │   │   ├── layout.tsx         ← dashboard 布局（含侧边栏/顶栏）
│   │   │   ├── page.tsx           ← /dashboard
│   │   │   ├── loading.tsx        ← dashboard 子路由 loading
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx       ← /dashboard/orders
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx   ← /dashboard/orders/:id
│   │   │   └── users/
│   │   │       └── page.tsx
│   │   └── api/                   ← Route Handlers
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts
│   │       └── orders/
│   │           ├── route.ts       ← /api/orders
│   │           └── [id]/
│   │               └── route.ts   ← /api/orders/:id
│   ├── components/                ← 全局通用组件（不含业务逻辑）
│   │   ├── ui/                    ← 原子组件（Button, Input, Modal, Dropdown）
│   │   └── layout/                ← 布局组件（Header, Sidebar, Footer）
│   ├── features/                  ← 按功能模块划分（核心目录）
│   │   ├── auth/
│   │   │   ├── components/        ← 该 feature 专属组件
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   ├── hooks/             ← 该 feature 专属 Hook
│   │   │   ├── actions.ts         ← Server Actions（'use server'）
│   │   │   └── types.ts           ← 该 feature 专属类型
│   │   ├── orders/
│   │   │   ├── components/
│   │   │   │   ├── OrderList.tsx
│   │   │   │   └── OrderCard.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useOrderList.ts
│   │   │   │   └── useCreateOrder.ts
│   │   │   ├── actions.ts         ← Server Actions
│   │   │   └── types.ts
│   │   └── users/
│   ├── hooks/                     ← 全局客户端 Hook（跨 feature 复用）
│   │   ├── useDebounce.ts
│   │   └── usePagination.ts
│   ├── stores/                    ← Zustand Store（仅客户端）
│   │   └── authStore.ts
│   ├── lib/                       ← 工具函数（Server/Client 通用）
│   │   ├── cn.ts                  ← className 合并（clsx + tailwind-merge）
│   │   ├── formatters.ts          ← 日期/金额格式化
│   │   └── validators.ts          ← 表单校验（zod）
│   ├── types/                     ← 全局类型定义
│   │   ├── api.ts                 ← API 请求/响应类型
│   │   └── models.ts              ← 领域模型类型
│   └── middleware.ts              ← Next.js Middleware（Edge Runtime）
├── public/
│   ├── favicon.ico
│   └── images/
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── .env.local                     ← 本地环境变量（不提交 git）
├── .env.production                ← 生产环境变量（CI/CD 注入）
└── package.json
```

---

## Server / Client Component 规则

Next.js App Router 中所有组件**默认都是 Server Component**。只有需要交互（事件处理、Hooks、浏览器 API）时才标记为 Client Component。

### 标记 Client Component

```tsx
// components/ui/Modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'

export function Modal({ open, onClose, children }: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className={cn('fixed inset-0 z-50', !open && 'hidden')}>
      {/* ... */}
    </div>
  )
}
```

### 组件分层原则

```
Server Components（页面/布局/数据获取）
  └── Client Components（交互叶子节点）
       └── RSC 子节点（通过 children prop 透传）
```

**规则**：
- **布局组件（layout.tsx）**：保持 Server Component，不做数据获取以外的事
- **页面组件（page.tsx）**：Server Component 负责数据获取，交互逻辑抽到 Client Component
- **组件树**：尽量将 `'use client'` 边界推到叶子节点，不要整棵子树全部 Client
- **Server Component 不可传递给 Client Component 的 props**：函数、类实例、Date 等不可序列化对象（只能传原始值 + 普通对象）
- 需要 useState / useEffect / 事件处理的组件才加 `'use client'`

---

## Feature 模块规范

Feature = 一个完整的业务功能域（如认证、订单、用户管理）。

### Feature 内部结构

```
features/orders/
├── components/
│   ├── OrderList.tsx              ← 列表组件（Client Component）
│   ├── OrderCard.tsx              ← 列表项
│   ├── OrderForm.tsx              ← 创建/编辑表单
│   └── OrderDetail.tsx            ← 详情展示
├── hooks/
│   ├── useOrderList.ts            ← 列表数据 Hook（TanStack Query）
│   └── useCreateOrder.ts          ← 创建操作 Hook
├── actions.ts                     ← Server Actions（'use server'）
└── types.ts                       ← Feature 私有类型
```

### Server Actions 位置

Server Actions 放在 Feature 根目录的 `actions.ts` 中，不放在 `app/api/` 下（Route Handler 留给需要开放 API 的场景）。

```ts
// features/orders/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createOrderSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
})

export async function createOrder(formData: FormData) {
  const parsed = createOrderSchema.safeParse({
    title: formData.get('title'),
    amount: Number(formData.get('amount')),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // 数据库操作
  // await db.order.create({ data: parsed.data })

  revalidatePath('/dashboard/orders')
  return { success: true }
}
```

**规则**：
- Feature 内的组件/Hook 不直接 import 其他 Feature 的内部文件
- Feature 间共享的数据通过全局 Store 或 Props/Params 传递
- Feature 可以 import `components/`、`hooks/`、`lib/`、`types/` 等全局目录
- `actions.ts` 中的函数在 Client Component 中直接 `import` 调用，走 RPC 通信

---

## 路由组织

Next.js App Router 通过文件夹和特殊文件名定义路由。文件名即路由约定，不需要额外的路由器配置。

### 路由组（Route Group）

路由组 `(name)` 不影响 URL 路径，仅用于组织文件：
- `(auth)` — 未认证页面（/login, /register）
- `(dashboard)` — 认证后页面（/dashboard, /orders）
- `(marketing)` — 对外页面（/about, /blog）

```tsx
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // 认证校验（Server Component）
  // const session = await getServerSession(authOptions)
  // if (!session) redirect('/login')

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1">
        <Header />
        {children}
      </main>
    </div>
  )
}
```

### 动态路由

| 文件路径 | URL 匹配 |
|---------|---------|
| `app/orders/[id]/page.tsx` | `/orders/123` |
| `app/orders/[...slug]/page.tsx` | `/orders/a/b/c`（Catch-all） |
| `app/orders/[[...slug]]/page.tsx` | `/orders/a/b/c` 及 `/orders`（Optional Catch-all） |

### 特殊文件约定

| 文件 | 作用 | 渲染类型 |
|------|------|---------|
| `page.tsx` | 路由 UI | Server 默认 |
| `layout.tsx` | 嵌套布局（跨页面持久化） | Server 默认 |
| `loading.tsx` | Suspense fallback（自动包裹 page） | Server 默认 |
| `error.tsx` | Error Boundary（捕获子组件错误） | **必须是 Client** |
| `not-found.tsx` | 404 UI（替换默认 notFound） | Server 默认 |
| `route.ts` | API Route Handler（返回 Response） | Server 默认 |
| `template.tsx` | 类似 layout 但每次导航重新挂载 | Server 默认 |

**规则**：
- 每个路由目录下 `page.tsx` 是必须的（否则 URL 不可访问）
- `layout.tsx` 中的状态跨导航保持，`template.tsx` 每次重新创建
- `error.tsx` 必须加 `'use client'`（依赖 componentDidCatch）
- 路由鉴权放在 `layout.tsx` 或 `middleware.ts`，不散落在每个 page 里
- 页面组件的命名习惯保持 `PascalCase`，但文件名遵循约定（`page.tsx` / `layout.tsx`）

---

## 数据获取模式

### Server Component 直接获取（推荐）

```tsx
// app/(dashboard)/orders/page.tsx
import { OrderCard } from '@/features/orders/components/OrderCard'

async function getOrders() {
  // 直接在 Server Component 中 fetch/查库
  const res = await fetch('http://api.example.com/orders', {
    next: { revalidate: 60 },      // ISR: 每 60 秒重建
  })
  return res.json()
}

export default async function OrdersPage() {
  const orders = await getOrders()

  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  )
}
```

### 客户端数据获取（TanStack Query）

对于需要客户端交互（搜索、筛选、分页、乐观更新）的场景，使用 TanStack Query：

```ts
// features/orders/hooks/useOrderList.ts
'use client'

import { useQuery } from '@tanstack/react-query'

export function useOrderList(filters: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => fetch(`/api/orders?${new URLSearchParams(filters)}`).then(r => r.json()),
    staleTime: 30_000,
  })
}
```

**规则**：
- **优先 Server Component fetch** — 减少客户端 JS 体积
- **TanStack Query 仅用于客户端交互场景** — 搜索/筛选/无限滚动/乐观更新
- **不要混用** — 同一个数据不要在 Server Component 获取后再通过 props 传给 TanStack Query（需要 initialData 再 hydrate）
- ISR 用 `fetch` 的 `next.revalidate` 或 `export const revalidate` 控制

---

## Server Actions 规范

Server Actions 是 Next.js 的 RPC 机制，允许 Client Component 直接调用服务端函数。

### 文件组织

```
features/{name}/actions.ts     ← Feature 级别的 Server Actions
```

### 定义和调用

```ts
// features/auth/actions.ts
'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type LoginState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  // 调用认证服务
  // const session = await authService.login(parsed.data)
  // cookies().set('session', session.token, { httpOnly: true, secure: true })

  return {}
}
```

```tsx
// features/auth/components/LoginForm.tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { login, type LoginState } from '../actions'

const initialState: LoginState = {}

export function LoginForm() {
  const [state, formAction] = useFormState(login, initialState)

  return (
    <form action={formAction}>
      <input name="email" type="email" />
      {state.fieldErrors?.email && <p className="text-red-500">{state.fieldErrors.email}</p>}
      <input name="password" type="password" />
      {state.fieldErrors?.password && <p className="text-red-500">{state.fieldErrors.password}</p>}
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? '登录中...' : '登录'}
    </button>
  )
}
```

**规则**：
- Server Actions **必须** `'use server'` 声明（文件顶端或函数顶端）
- 参数和返回值必须可序列化
- 输入校验用 `zod`（与 React 的 form 校验保持一致）
- 支持 `useFormState` / `useFormStatus` 管理表单状态
- 操作执行后调用 `revalidatePath()` 或 `revalidateTag()` 刷新缓存
- 敏感操作（登录、支付）放在 Server Action 中，不暴露为 Route Handler
- Server Action 禁止直接返回数据库模型（泄露字段），应返回精简 DTO

---

## Middleware 模式

`src/middleware.ts` 运行在 Edge Runtime，在请求到达应用程序之前执行。

```ts
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedPaths = ['/dashboard', '/orders', '/users']
const authPaths = ['/login', '/register']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  // 匹配受保护路径
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path))
  const isAuthPage = authPaths.includes(pathname)

  // 未登录访问受保护页面 → 重定向到登录
  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 已登录访问 auth 页面 → 重定向到 dashboard
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
}
```

**规则**：
- `middleware.ts` 放在 `src/` 根目录（优先级大于项目根目录）
- `matcher` 精确匹配需要拦截的路径，避免不必要的执行
- Middleware 运行在 Edge Runtime（无 Node APIs，受限 API 集）
- 简单鉴权/重定向放 middleware；数据库查询放在 `layout.tsx` 中
- 不在 middleware 中做重计算（影响每个请求）

---

## 环境变量

```bash
# .env.local（不提交 git，本地开发用）
DATABASE_URL=postgresql://localhost:5432/mydb
AUTH_SECRET=local-secret-key

# .env.production（CI/CD 注入，不提交 git）
DATABASE_URL=postgresql://prod-host:5432/mydb
AUTH_SECRET=prod-secret-key
```

```ts
// 环境变量访问方式
const dbUrl = process.env.DATABASE_URL           // 服务端可访问
const apiKey = process.env.NEXT_PUBLIC_API_URL   // 客户端可访问（NEXT_PUBLIC_ 前缀）
```

**规则**：
- 客户端可访问的环境变量**必须**以 `NEXT_PUBLIC_` 开头
- `NEXT_PUBLIC_*` 的值在构建时内联到客户端 bundle，不要在客户端环境变量中存放密钥
- 服务端环境变量无前缀要求，在 Server Component / Route Handler / Server Action 中通过 `process.env` 直接访问
- `.env.local` 和 `.env.production` 不提交 git（务必加 `.gitignore`）
- `.env`（可选）可提交，仅含公开默认值和无敏感信息的本地开发默认值
- 开发环境变量变更后需重启 dev server

---

## 文件命名约定

| 文件内容 | 命名 | 示例 |
|---------|------|------|
| 路由页面 | 约定名（不可改） | `page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx` |
| Route Handler | 约定名（不可改） | `route.ts` |
| React 组件 | PascalCase.tsx | `UserCard.tsx` |
| 自定义 Hook | camelCase.ts（以 use 开头） | `useOrderList.ts` |
| Server Actions | actions.ts（约定名） | `features/auth/actions.ts` |
| Zustand Store | camelCase + Store.ts | `authStore.ts` |
| 类型定义 | camelCase 或 types.ts | `models.ts` |
| 工具函数 | camelCase.ts | `formatters.ts` |
| 布局组件 | PascalCase.tsx | `Header.tsx` |

**规则**：
- App Router 特殊文件名（`page` / `layout` / `loading` / `error` / `not-found` / `route`）固定不变
- 普通组件/PascalCase，Hook/camelCase+use前缀，与 React 规范一致
- 页面所在的目录名使用 URL 友好的 kebab-case（如 `order-detail`），但极少使用 — 优先用 `[id]` 等动态段

---

## 路径别名配置

Next.js 原生支持 `@/` 别名，映射到 `src/`。

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

```ts
// 使用示例
import { Button } from '@/components/ui/Button'
import { useOrderList } from '@/features/orders/hooks/useOrderList'
import { cn } from '@/lib/cn'
import type { User } from '@/types/models'
```

Next.js 在编译时自动解析 `@/` 别名，无需在 `next.config.ts` 中额外配置 `webpack` 或 `turbopack` alias。
