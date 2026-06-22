# React 代码风格规范

## 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `UserCard.tsx`, `LoginForm.tsx` |
| 组件名 | PascalCase | `export function UserCard()` |
| Hook 文件 | camelCase，use 前缀 | `useAuth.ts`, `useOrderList.ts` |
| Hook 函数 | camelCase，use 前缀 | `export function useAuth()` |
| Store 文件 | camelCase，store 后缀 | `authStore.ts`, `cartStore.ts` |
| 工具函数 | camelCase | `formatPrice.ts`, `parseDate.ts` |
| 类型/接口 | PascalCase，I 不作前缀 | `User`, `OrderItem`, `ApiResponse` |
| 常量 | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| CSS 类名 | Tailwind 内联，自定义类用 kebab-case | `.card-header` |

---

## 组件规范

### 函数式组件（唯一写法）

```tsx
// ✅ 标准组件写法
interface UserCardProps {
  user: User
  onEdit?: (id: string) => void
  className?: string
}

export function UserCard({ user, onEdit, className }: UserCardProps) {
  return (
    <div className={cn('rounded-lg p-4', className)}>
      <h3>{user.name}</h3>
      {onEdit && (
        <button onClick={() => onEdit(user.id)}>编辑</button>
      )}
    </div>
  )
}
```

**规则**：
- **Props 必须定义 interface**，不用 `any` 或 inline 类型
- `className` 可选 prop，用 `cn()` 合并
- 回调 prop 命名用 `on` 前缀（`onEdit`, `onDelete`, `onSubmit`）
- 不用 `React.FC`（直接 function 声明更清晰）
- 组件只做 UI 渲染，业务逻辑抽到 Hook

### 组件大小控制

- 单组件不超过 150 行
- 子 UI 超过 30 行提取为子组件（文件内或独立文件）
- JSX 超过 4 层嵌套考虑提取

---

## Hooks 规范

```tsx
// ✅ 自定义 Hook 标准写法
export function useOrderList(userId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', userId],
    queryFn: () => orderApi.list(userId),
    enabled: !!userId,
  })

  return { orders: data ?? [], isLoading, error }
}

// 使用
function OrderPage() {
  const { orders, isLoading } = useOrderList(user.id)
  // ...
}
```

**规则**：
- Hook 只返回组件需要的最小数据集
- 不在 Hook 内做 UI 操作（toast/modal 等）
- 有副作用的 Hook 必须处理 cleanup

```tsx
// ✅ cleanup 示例
export function useWebSocket(url: string) {
  useEffect(() => {
    const ws = new WebSocket(url)
    // ...
    return () => ws.close()  // cleanup 必须
  }, [url])
}
```

---

## 状态管理规范

### 三层状态策略

| 层次 | 工具 | 适用场景 |
|------|------|---------|
| 本地状态 | `useState` / `useReducer` | 单组件内的 UI 状态（展开/折叠、表单值） |
| 服务端状态 | TanStack Query | 来自 API 的数据，含缓存/更新/失效 |
| 全局客户端状态 | Zustand | 认证信息、用户偏好、购物车 |

**原则**：能用本地状态解决的，不用全局；服务端数据统一走 React Query。

### Zustand Store 写法

```ts
// stores/authStore.ts
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

### React Query 写法

```ts
// api/userApi.ts — API 函数独立
export const userApi = {
  get: (id: string) => apiClient.get<User>(`/users/${id}`),
  create: (data: CreateUserDto) => apiClient.post<User>('/users', data),
}

// hooks/useUser.ts — Query Hook
export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => userApi.get(id),
  })
}

// hooks/useCreateUser.ts — Mutation Hook
export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: userApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

---

## TypeScript 规范

```ts
// ✅ 明确类型，不用 any
interface ApiResponse<T> {
  data: T
  message: string
  code: number
}

// ✅ 用 type 组合，用 interface 定义对象形态
type UserRole = 'admin' | 'user' | 'guest'

interface User {
  id: string
  name: string
  role: UserRole
  createdAt: Date
}

// ❌ 禁止 any
const handleData = (data: any) => { ... }  // 改为泛型或具体类型

// ✅ 泛型
const handleData = <T>(data: T): T => data
```

**规则**：
- `tsconfig.json` 开启 `strict: true`
- 禁止 `@ts-ignore`（可用 `@ts-expect-error` 并写原因注释）
- API 请求/响应必须有完整类型定义

---

## 错误处理

```tsx
// ✅ API 错误处理
function OrderList() {
  const { orders, isLoading, error } = useOrderList()

  if (error) {
    return <ErrorBoundaryFallback error={error} />
  }

  if (isLoading) {
    return <Skeleton />
  }

  return <ul>{orders.map(o => <OrderItem key={o.id} order={o} />)}</ul>
}

// ✅ 全局错误边界（每个路由页面套一层）
<ErrorBoundary fallback={<ErrorPage />}>
  <OrderList />
</ErrorBoundary>
```

---

## 导入规范

```tsx
// 1. React 和框架
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 2. 第三方库
import { useQuery } from '@tanstack/react-query'
import { cn } from 'clsx'

// 3. 内部模块（绝对路径 alias）
import { useAuthStore } from '@/stores/authStore'
import { userApi } from '@/api/userApi'
import type { User } from '@/types'

// 4. 组件（同目录或子目录）
import { Avatar } from './Avatar'
```

配置 `tsconfig.json` 路径别名：`@` → `./src`

---

## 禁止的写法

```tsx
// ❌ 裸 index 作为 key
items.map((item, index) => <Item key={index} />)
// ✅ 用稳定 ID
items.map(item => <Item key={item.id} />)

// ❌ 直接修改 state
state.user.name = 'new'
// ✅ 不可变更新
setState(prev => ({ ...prev, user: { ...prev.user, name: 'new' } }))

// ❌ 在 useEffect 缺失依赖
useEffect(() => { fetchUser(userId) }, [])  // 缺 userId
// ✅ 完整依赖
useEffect(() => { fetchUser(userId) }, [userId])
```
