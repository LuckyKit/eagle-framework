# Next.js 代码风格规范

> App Router 模式 (v14+)，TypeScript 优先，Server Component 优先

## 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 页面文件 | `page.tsx` 固定命名 | `app/dashboard/page.tsx` |
| 布局文件 | `layout.tsx` 固定命名 | `app/dashboard/layout.tsx` |
| 加载状态 | `loading.tsx` 固定命名 | `app/orders/loading.tsx` |
| 错误边界 | `error.tsx` 固定命名 | `app/checkout/error.tsx` |
| 路由目录 | kebab-case | `app/user-profile/`, `app/order-list/` |
| 动态路由 | `[slug]` / `[...slug]` | `app/posts/[id]/page.tsx` |
| 组件文件 | PascalCase | `UserCard.tsx`, `LoginForm.tsx` |
| 客户端组件 | 同组件，加 `'use client'` 首行 | `'use client'` → `SearchInput.tsx` |
| Hook 文件 | camelCase，use 前缀 | `useAuth.ts`, `useOrderList.ts` |
| Store 文件 | camelCase，store 后缀 | `authStore.ts`, `cartStore.ts` |
| Server Action 文件 | camelCase，actions 后缀 | `userActions.ts` |
| 工具函数 | camelCase | `formatPrice.ts`, `cn.ts` |
| 类型/接口 | PascalCase，I 不作前缀 | `User`, `OrderItem`, `ApiResponse` |
| 环境变量 | 客户端 `NEXT_PUBLIC_` 前缀 | `NEXT_PUBLIC_API_URL` |

---

## 组件类型

### Server Component（默认）

Next.js App Router 中**所有组件默认都是 Server Component**。无需 `'use client'` 声明。

```tsx
// app/posts/page.tsx — 默认 Server Component
import { PostCard } from './PostCard'
import { db } from '@/lib/db'

interface PostsPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const { page } = await searchParams
  const posts = await db.post.findMany({
    skip: (Number(page) - 1) * 20 || 0,
    take: 20,
  })

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

**规则**：
- 可以直接使用 `async/await` 获取数据
- 不能使用 `useState`、`useEffect`、`useContext` 等 React Hooks
- 不能使用浏览器 API（`window`、`document`、`localStorage`）
- 不能绑定事件处理器（`onClick`、`onChange`），除非传递给 Client Component
- 可以 import Client Component，但不能 import Server Component 到 Client Component（除非作为 children 透传）

### Client Component

需要交互（事件、状态、副作用、浏览器 API）时必须显式声明。

```tsx
// components/SearchInput.tsx
'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/Input'

interface SearchInputProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export function SearchInput({ onSearch, placeholder = '搜索...' }: SearchInputProps) {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(() => onSearch(query))
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
    </form>
  )
}
```

**规则**：
- 文件首行必须是 `'use client'`
- 可以使用所有 React Hooks
- 可以绑定事件处理器
- 可以访问浏览器 API
- `'use client'` 标记的是**客户端边界**——该组件及其所有子组件都会在客户端渲染

### 边界下沉原则

将 Client Component 推到离数据源最近的叶子节点，最小化客户端 JS 体积。

```tsx
// ✅ Server Component 包裹 Client Component
// app/dashboard/page.tsx（Server）
import { Suspense } from 'react'
import { DashboardStats } from './DashboardStats'     // Server
import { FilterPanel } from './FilterPanel'           // Client ('use client')

export default function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>
      <FilterPanel />
    </div>
  )
}
```

---

## Props 类型定义

```tsx
// ✅ 用 interface 定义 props
interface UserCardProps {
  user: User
  avatarSize?: 'sm' | 'md' | 'lg'
  onEdit?: (id: string) => void
  className?: string
}

export function UserCard({ user, avatarSize = 'md', onEdit, className }: UserCardProps) {
  return (
    <div className={cn('rounded-lg p-4', className)}>
      <Avatar user={user} size={avatarSize} />
      <h3>{user.name}</h3>
      {onEdit && (
        <button onClick={() => onEdit(user.id)}>编辑</button>
      )}
    </div>
  )
}
```

**规则**：
- Props 必须使用 `interface` 定义，不用 `type` 或 inline 类型
- `className` 作为可选 prop，用 `cn()` 合并
- 回调 prop 用 `on` 前缀（`onEdit`、`onDelete`、`onSubmit`）
- 不用 `React.FC`（直接 function 声明更清晰）
- Page Props 使用 Next.js 约定的 `params` 和 `searchParams`，类型为 `Promise`
- Server Action prop 命名用 `action` 前缀（`createUserAction`）

---

## 导入规范

```tsx
// 1. Next.js 内置
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'

// 2. React
import { useState, useEffect, Suspense } from 'react'

// 3. 第三方库
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { z } from 'zod'

// 4. @/components（UI 组件）
import { Button } from '@/components/ui/Button'
import { UserCard } from '@/components/UserCard'

// 5. @/lib / @/hooks / @/types
import { db } from '@/lib/db'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/types'

// 6. 同级和子目录相对导入
import { Avatar } from './Avatar'
import { formatDate } from '../lib/formatDate'
```

配置 `tsconfig.json` 路径别名：`@` → `./src` 或无 `src` 时为项目根目录。

---

## Server Actions

### 定义

```ts
// lib/actions/userActions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const createUserSchema = z.object({
  name: z.string().min(2, '姓名至少2个字符'),
  email: z.string().email('请输入有效的邮箱'),
})

export async function createUser(formData: FormData) {
  const session = await auth()
  if (!session) throw new Error('未登录')

  const raw = Object.fromEntries(formData)
  const parsed = createUserSchema.safeParse(raw)

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const user = await db.user.create({ data: parsed.data })
  revalidatePath('/users')
  return { user }
}
```

### 调用

```tsx
// 在 Client Component 中使用
'use client'

import { useActionState } from 'react'
import { createUser } from '@/lib/actions/userActions'
import type { ActionState } from '@/types'

const initialState: ActionState = { errors: {} }

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUser, initialState)

  return (
    <form action={formAction}>
      <input name="name" required />
      {state.errors?.name && <p className="text-red-500">{state.errors.name}</p>}

      <input name="email" type="email" required />
      {state.errors?.email && <p className="text-red-500">{state.errors.email}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? '创建中...' : '创建用户'}
      </Button>
    </form>
  )
}
```

**规则**：
- Server Action 文件必须以 `'use server'` 为首行
- 从 Client Component 调用时使用 `useActionState`（Next.js 14+）
- 从 Server Component 调用时直接 `await`，无需 `useActionState`
- 操作完成后必须调用 `revalidatePath` 或 `revalidateTag` 刷新缓存
- 所有输入必须在 Server Action 内用 Zod 等服务端校验，**不能信任客户端校验结果**
- Server Action 内可以安全访问数据库、文件系统、环境变量

---

## 数据获取

### Server Component 内直接获取（推荐）

```tsx
// app/posts/[id]/page.tsx — Server Component
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'

interface PostPageProps {
  params: Promise<{ id: string }>
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params
  const post = await db.post.findUnique({ where: { id } })

  if (!post) notFound()

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

### TanStack Query 用于客户端获取

```ts
// hooks/useSearchPosts.ts
import { useQuery } from '@tanstack/react-query'
import { postApi } from '@/api/postApi'

export function useSearchPosts(query: string) {
  return useQuery({
    queryKey: ['posts', 'search', query],
    queryFn: () => postApi.search(query),
    enabled: query.length >= 2,
  })
}
```

**规则**：
- 初始/页面数据在 Server Component 中获取，props 向下传递
- 用户交互触发的数据（搜索、筛选、分页）用 TanStack Query
- 数据层函数（`postApi.ts`）与服务端组件共享，不重复写 fetch
- `fetch` 在 Server Component 中自动去重并缓存，无需额外配置

---

## 状态管理

| 层次 | 工具 | 适用场景 |
|------|------|---------|
| 本地状态 | `useState` / `useReducer` | 单组件内的 UI 状态（展开/折叠、表单值） |
| 服务端状态 | TanStack Query | 来自 API 的数据，含缓存/更新/失效 |
| 全局客户端状态 | Zustand | 认证信息、用户偏好、全局通知 |
| URL 共享状态 | `useSearchParams` / `nuqs` | 需要可分享、可书签保存的状态（筛选条件、分页） |

**原则**：能用 URL 表达的状态放 URL，能用 Server Component 获取的数据不走客户端。

### Zustand Store 写法

```ts
// stores/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: User | null
  token: string | null
  login: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'auth-storage' }
  )
)
```

### URL 状态示例

```tsx
// components/ProductFilters.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function ProductFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentCategory = searchParams.get('category') ?? 'all'

  function handleCategoryChange(category: string) {
    const params = new URLSearchParams(searchParams)
    params.set('category', category)
    router.push(`/products?${params.toString()}`)
  }

  return (
    <select
      value={currentCategory}
      onChange={(e) => handleCategoryChange(e.target.value)}
    >
      <option value="all">全部</option>
      <option value="electronics">电子产品</option>
      <option value="clothing">服装</option>
    </select>
  )
}
```

---

## 错误处理

### error.tsx 边界

```tsx
// app/products/error.tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

interface ProductsErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ProductsError({ error, reset }: ProductsErrorProps) {
  useEffect(() => {
    console.error('Product page error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center gap-4">
      <h2>加载失败</h2>
      <p>{error.message}</p>
      <Button onClick={reset}>重试</Button>
    </div>
  )
}
```

**规则**：
- `error.tsx` 必须声明 `'use client'`
- `reset()` 函数会重新渲染该 segment，不刷新整页
- `error` 对象不会传递到客户端生产环境（仅显示泛化消息），用 `digest` 匹配服务端日志
- 每个路由 segment 可以有自己的 `error.tsx`，错误冒泡向上

### Server Component 内 try/catch

```tsx
// Server Component 中的防御式获取
export default async function DashboardPage() {
  try {
    const stats = await db.stats.aggregate()
    return <Dashboard stats={stats} />
  } catch {
    return <p className="text-muted-foreground">统计数据暂时不可用</p>
  }
}
```

### useActionState 表单错误

```tsx
// 返回带 errors 的状态
'use server'

export async function updateProfile(prevState: ActionState, formData: FormData) {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }
  await db.user.update({ /* ... */ })
  revalidatePath('/profile')
  return { success: true }
}
```

---

## 图片与字体

### next/image

```tsx
import Image from 'next/image'

// ✅ 本地图片 — 自动 width/height，无需手动指定
import heroImage from '@/public/hero.jpg'

export function HeroBanner() {
  return (
    <Image
      src={heroImage}
      alt="首页横幅"
      placeholder="blur"          // 本地图片支持 blur 占位
      priority                    // LCP 图片加 priority
    />
  )
}

// ✅ 远程图片 — 必须在 next.config 配置 remotePatterns
export function RemoteAvatar({ url, name }: { url: string; name: string }) {
  return (
    <Image
      src={url}
      alt={name}
      width={48}
      height={48}
      className="rounded-full"
    />
  )
}
```

**规则**：
- 始终提供有意义的 `alt` 文本，纯装饰图片用 `alt=""`
- 首屏最大图片（LCP）添加 `priority` 属性
- 远程图片必须在 `next.config.ts` 的 `images.remotePatterns` 中声明域名
- 不用 `<img>` 原生标签，除非有特殊需求

### next/font

```ts
// app/layout.tsx
import { Inter, Noto_Sans_SC } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-sc',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${notoSansSC.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

```ts
// tailwind.config.ts — 对应 CSS 变量
const config: Config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        noto: ['var(--font-noto-sans-sc)'],
      },
    },
  },
}
```

**规则**：
- 使用 `next/font/google` 加载 Google Fonts，零外部网络请求
- 使用 CSS 变量（`variable`）让字体可在任意组件中切换
- 通过 `subsets` 指定需要的字符集，减小字体文件体积

---

## Metadata 与 SEO

### 静态 Metadata

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'MyApp',
    template: '%s | MyApp',
  },
  description: '下一代全栈应用',
  metadataBase: new URL('https://example.com'),
  openGraph: {
    type: 'website',
    siteName: 'MyApp',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
}
```

### 动态 generateMetadata

```tsx
// app/posts/[id]/page.tsx
import type { Metadata } from 'next'
import { db } from '@/lib/db'

interface PostPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { id } = await params
  const post = await db.post.findUnique({ where: { id } })

  if (!post) return { title: '未找到' }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.coverUrl, width: 1200, height: 630 }],
    },
  }
}

export default async function PostPage({ params }: PostPageProps) {
  // ...
}
```

**规则**：
- 每个页面必须提供 `title` 和 `description`
- 使用 `template` 模板自动拼接页面标题
- 动态页面使用 `generateMetadata`，参数与 page 组件一致
- `metadataBase` 在根布局设置一次
- OG 图片推荐 1200x630 尺寸

---

## 样式规范

Tailwind CSS 为首选方案，复杂样式用 CSS Modules。

### cn() 工具函数

```ts
// lib/cn.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 使用示例

```tsx
import { cn } from '@/lib/cn'

interface CardProps {
  variant?: 'default' | 'outline'
  className?: string
  children: React.ReactNode
}

export function Card({ variant = 'default', className, children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-6',
        variant === 'outline' && 'border-gray-200 bg-transparent',
        variant === 'default' && 'border-transparent bg-white shadow-sm',
        className
      )}
    >
      {children}
    </div>
  )
}
```

**规则**：
- 所有接收 `className` 的组件必须用 `cn()` 合并样式
- 避免动态拼接 Tailwind 类名字符串（`bg-${color}-500`）——PurgeCSS 无法识别
- 需要复杂样式时使用 CSS Modules 文件（`Component.module.css`）
- 设计系统 token 通过 CSS 变量定义，在 `globals.css` 中导入

### CSS Modules（复杂样式备选）

```css
/* components/Editor.module.css */
.editor {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
}
.toolbar {
  border-bottom: 1px solid var(--border);
}
```

```tsx
import styles from './Editor.module.css'

export function Editor() {
  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>...</div>
    </div>
  )
}
```

---

## 性能优化

### 动态导入与懒加载

```tsx
import dynamic from 'next/dynamic'

// 按需加载重型组件
const HeavyChart = dynamic(
  () => import('@/components/HeavyChart').then(mod => mod.HeavyChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,  // 禁用 SSR（如需浏览器 API）
  }
)
```

### Suspense 边界

```tsx
import { Suspense } from 'react'
import { PostsList } from './PostsList'
import { PostsSkeleton } from './PostsSkeleton'

export default function PostsPage() {
  return (
    <div>
      <h1>文章</h1>
      <Suspense fallback={<PostsSkeleton />}>
        <PostsList />
      </Suspense>
    </div>
  )
}
```

```tsx
// PostsList.tsx — 数据获取下沉到此组件
export async function PostsList() {
  const posts = await db.post.findMany({ orderBy: { createdAt: 'desc' } })
  return posts.map(post => <PostCard key={post.id} post={post} />)
}
```

**规则**：
- 将 async 数据获取下沉到独立组件，外层用 `<Suspense>` 包裹——实现流式渲染
- `loading.tsx` 仅覆盖首屏，精确粒度用 `<Suspense>`
- 重型纯客户端组件用 `dynamic(() => import(...), { ssr: false })`
- 优先使用 `next/dynamic` 而非 `React.lazy`

### 流式渲染

Next.js App Router 自动支持流式渲染：页面在 Server Component 数据就绪后逐步发送 HTML，`<Suspense>` 边界内的内容独立流式发送。

---

## 禁止的写法（反模式）

```tsx
// ❌ 在 Server Component 中使用 Hooks
export default function Page() {
  const [count, setCount] = useState(0)  // 报错
  return <div>{count}</div>
}
// ✅ 提取到 Client Component
// 'use client' → export function Counter() { const [count, setCount] = useState(0) ... }

// ❌ 在 Client Component 中直接 import Server Component
'use client'
import { ServerOnlyComponent } from './ServerOnly'  // 会导致 ServerOnlyComponent 变成客户端组件
// ✅ 通过 children prop 传入，或改为 Client Component

// ❌ 在 Server Component 中使用浏览器 API
export default function Page() {
  const width = window.innerWidth  // 报错：window is not defined
}
// ✅ 在 Client Component 或 useEffect 中使用

// ❌ 忽略 loading 和 error 边界
// 每个有数据获取的路由 segment 都应提供 loading.tsx 和 error.tsx

// ❌ 不使用 Suspense 包裹 async 组件
export default function Page() {
  return <AsyncDataComponent />  // 阻塞整个页面
}
// ✅ <Suspense fallback={<Skeleton />}><AsyncDataComponent /></Suspense>

// ❌ 在 Server Action 外修改数据且不重验证
async function deletePost(id: string) {
  await db.post.delete({ where: { id } })
  // 缺少 revalidatePath/revalidateTag —— UI 不会更新
}

// ❌ 客户端状态替代 URL
// 筛选条件存 useState 导致刷新后丢失且不可分享
// ✅ 用 useSearchParams 或 nuqs 管理可分享状态

// ❌ 在 'use client' 文件顶层使用 async 函数
'use client'
export async function ClientComponent() { ... }  // 不报错但无效，客户端不执行 await

// ❌ 混用 Pages Router 和 App Router
// 统一使用 App Router，不混用 `pages/` 和 `app/` 目录

// ❌ 过度使用 'use client'
// 把整个页面标记为 Client Component 导致 JS 体积膨胀
// ✅ 只把需要交互的部分提取为 Client Component
```
