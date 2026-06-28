# Next.js 测试规范

> 适用于 Next.js 14+ App Router 项目

## 工具栈

- **Jest** — 测试运行器（Next.js 默认集成）
- **React Testing Library (RTL)** — 组件测试（用户行为视角）
- **@testing-library/user-event** — 模拟用户操作
- **MSW (Mock Service Worker)** — API Mock（网络层拦截）
- **Playwright** — E2E 浏览器测试（可选，集成测试阶段使用）

---

## 核心原则

**测试用户行为，不测实现细节。**

```tsx
// ❌ 测试实现细节
expect(component.state.isLoading).toBe(true)
expect(component.instance().fetchData).toHaveBeenCalled()

// ✅ 测试用户可见的行为
expect(screen.getByRole('progressbar')).toBeInTheDocument()
expect(screen.getByText('订单已创建')).toBeInTheDocument()
```

---

## 文件结构

测试文件与源文件同目录放置，使用 `__tests__/` 目录：

```
web/
├── app/
│   ├── (main)/
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   └── __tests__/
│   │   │       └── OrdersPage.test.tsx
│   │   └── layout.tsx
│   └── api/
│       └── orders/
│           ├── route.ts
│           └── __tests__/
│               └── route.test.ts
├── components/
│   ├── OrderCard.tsx
│   └── __tests__/
│       └── OrderCard.test.tsx
├── hooks/
│   ├── useOrderList.ts
│   └── __tests__/
│       └── useOrderList.test.ts
├── actions/
│   ├── createOrder.ts
│   └── __tests__/
│       └── createOrder.test.ts
└── middleware.ts
test/                        ← 全局测试辅助（可选集中放置）
├── setup.ts
├── helpers/
│   └── renderWithProviders.tsx
└── mocks/
    ├── handlers.ts
    └── server.ts
```

---

## Jest 配置

```ts
// jest.config.ts
import nextJest from 'next/jest'

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterSetup: ['<rootDir>/test/setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/web/$1',
  },
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'web/**/*.{ts,tsx}',
    '!web/**/*.d.ts',
    '!web/**/layout.tsx',
    '!web/**/loading.tsx',
    '!web/**/error.tsx',
    '!web/**/not-found.tsx',
    '!web/**/route.ts',
  ],
}

export default createJestConfig(customJestConfig)
```

---

## 测试命令

```bash
# 运行全部测试
npm test

# Watch 模式（仅运行变更相关测试）
npm test -- --watch

# 生成覆盖率报告
npm test -- --coverage

# 运行特定文件
npm test -- OrdersPage.test.tsx

# 运行特定目录
npm test -- web/app/orders
```

---

## Server Component 测试

Server Component 是 async 函数，使用 `await` 直接调用后验证输出。

```tsx
// web/app/orders/__tests__/OrdersPage.test.tsx

import { render, screen } from '@testing-library/react'
import OrdersPage from '../page'

// Mock 数据获取函数
jest.mock('@/lib/data', () => ({
  fetchOrders: jest.fn(),
}))

const mockOrders: Order[] = [
  { id: '1', title: '订单A', status: 'pending', amount: 99.5 },
  { id: '2', title: '订单B', status: 'completed', amount: 200.0 },
]

describe('OrdersPage (Server Component)', () => {
  it('renders order list from fetched data', async () => {
    const { fetchOrders } = await import('@/lib/data')
    ;(fetchOrders as jest.Mock).mockResolvedValue(mockOrders)

    // Server Component 直接 await 渲染
    const jsx = await OrdersPage()
    render(jsx)

    expect(screen.getByText('订单A')).toBeInTheDocument()
    expect(screen.getByText('订单B')).toBeInTheDocument()
  })

  it('renders empty state when no orders', async () => {
    const { fetchOrders } = await import('@/lib/data')
    ;(fetchOrders as jest.Mock).mockResolvedValue([])

    const jsx = await OrdersPage()
    render(jsx)

    expect(screen.getByText('暂无订单')).toBeInTheDocument()
  })

  it('renders error state when fetch fails', async () => {
    const { fetchOrders } = await import('@/lib/data')
    ;(fetchOrders as jest.Mock).mockRejectedValue(new Error('Server Error'))

    const jsx = await OrdersPage()
    render(jsx)

    expect(screen.getByText('加载失败，请重试')).toBeInTheDocument()
  })
})
```

### Mock 服务端数据获取

```ts
// 测试中覆盖数据获取模块
jest.mock('@/lib/db', () => ({
  db: {
    query: {
      orders: {
        findMany: jest.fn().mockResolvedValue([
          { id: '1', title: '订单A', status: 'pending' },
        ]),
      },
    },
  },
}))
```

---

## Client Component 测试

Client Component 使用标准 RTL 渲染，模拟用户交互。

```tsx
// web/components/__tests__/OrderCard.test.tsx

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderCard } from '../OrderCard'

const mockOrder: Order = {
  id: '1',
  title: '测试订单',
  status: 'pending',
  amount: 99.5,
}

describe('OrderCard', () => {
  it('displays order information', () => {
    render(<OrderCard order={mockOrder} />)

    expect(screen.getByText('测试订单')).toBeInTheDocument()
    expect(screen.getByText('¥99.50')).toBeInTheDocument()
    expect(screen.getByText('待处理')).toBeInTheDocument()
  })

  it('calls onEdit when edit button clicked', async () => {
    const onEdit = jest.fn()
    const user = userEvent.setup()

    render(<OrderCard order={mockOrder} onEdit={onEdit} />)
    await user.click(screen.getByRole('button', { name: '编辑' }))

    expect(onEdit).toHaveBeenCalledWith('1')
  })

  it('does not show edit button when onEdit not provided', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
  })
})
```

---

## Hook 测试

使用 `renderHook` 测试自定义 Hook。

```tsx
// web/hooks/__tests__/useOrderList.test.ts

import { renderHook, waitFor } from '@testing-library/react'
import { useOrderList } from '../useOrderList'

describe('useOrderList', () => {
  it('returns orders from API on success', async () => {
    const { result } = renderHook(() => useOrderList(), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.orders).toHaveLength(2)
    expect(result.current.orders[0].title).toBe('订单A')
  })

  it('returns error when API fails', async () => {
    server.use(
      http.get('/api/orders', () => HttpResponse.json({}, { status: 500 }))
    )

    const { result } = renderHook(() => useOrderList(), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.error).toBeTruthy())
  })
})
```

---

## Server Action 测试

Server Action 是纯函数，直接调用后验证返回值和副作用。

```ts
// web/actions/__tests__/createOrder.test.ts

import { createOrder } from '../createOrder'
import { revalidatePath } from 'next/cache'

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// Mock 数据层
jest.mock('@/lib/db', () => ({
  db: {
    order: {
      create: jest.fn(),
    },
  },
}))

describe('createOrder (Server Action)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates order and revalidates path on success', async () => {
    const { db } = await import('@/lib/db')
    ;(db.order.create as jest.Mock).mockResolvedValue({
      id: 'new-1',
      title: '新订单',
    })

    const formData = new FormData()
    formData.append('title', '新订单')
    formData.append('amount', '150')

    const result = await createOrder({ message: '' }, formData)

    expect(result.message).toBe('订单创建成功')
    expect(db.order.create).toHaveBeenCalledWith({
      title: '新订单',
      amount: 150,
    })
    expect(revalidatePath).toHaveBeenCalledWith('/orders')
  })

  it('returns error when validation fails', async () => {
    const formData = new FormData()
    formData.append('title', '')  // 标题不能为空
    formData.append('amount', '150')

    const result = await createOrder({ message: '' }, formData)

    expect(result.message).toBe('标题不能为空')
  })

  it('handles database error gracefully', async () => {
    const { db } = await import('@/lib/db')
    ;(db.order.create as jest.Mock).mockRejectedValue(new Error('DB Error'))

    const formData = new FormData()
    formData.append('title', '新订单')
    formData.append('amount', '150')

    const result = await createOrder({ message: '' }, formData)

    expect(result.message).toBe('创建失败，请稍后重试')
  })
})
```

### Mock revalidatePath / revalidateTag / redirect

```ts
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))
```

---

## Route Handler 测试

直接调用 Route Handler 函数，构造 `NextRequest` 对象传入。

```ts
// web/app/api/orders/__tests__/route.test.ts

import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

describe('GET /api/orders', () => {
  it('returns order list with status 200', async () => {
    const { db } = await import('@/lib/db')
    ;(db.order.findMany as jest.Mock).mockResolvedValue([
      { id: '1', title: '订单A', status: 'pending' },
    ])

    const request = new NextRequest('http://localhost/api/orders')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('订单A')
  })

  it('returns 500 on database error', async () => {
    const { db } = await import('@/lib/db')
    ;(db.order.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'))

    const request = new NextRequest('http://localhost/api/orders')
    const response = await GET(request)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Internal Server Error')
  })
})

describe('POST /api/orders', () => {
  it('creates order and returns 201', async () => {
    const { db } = await import('@/lib/db')
    ;(db.order.create as jest.Mock).mockResolvedValue({
      id: 'new-1',
      title: '新订单',
    })

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({ title: '新订单', amount: 150 }),
    })
    const response = await POST(request)

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.title).toBe('新订单')
  })

  it('returns 400 for invalid body', async () => {
    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })
})
```

---

## Middleware 测试

Middleware 是纯函数，构造 `NextRequest` 传入后断言 `NextResponse`。

```ts
// web/__tests__/middleware.test.ts

import { middleware } from '../middleware'
import { NextRequest, NextResponse } from 'next/server'

describe('middleware', () => {
  it('redirects unauthenticated users to login', async () => {
    const request = new NextRequest('http://localhost/dashboard')

    const response = await middleware(request)

    expect(response?.status).toBe(307)
    expect(response?.headers.get('Location')).toBe('/login')
  })

  it('allows authenticated users through', async () => {
    const request = new NextRequest('http://localhost/dashboard')
    request.cookies.set('session', 'valid-token')

    const response = await middleware(request)

    // 无重定向即为放行
    expect(response?.status).not.toBe(307)
  })

  it('allows requests to public routes', async () => {
    const request = new NextRequest('http://localhost/login')

    const response = await middleware(request)

    expect(response?.status).not.toBe(307)
  })

  it('adds security headers', async () => {
    const request = new NextRequest('http://localhost/any-page')

    const response = await middleware(request)
    const modified = NextResponse.next()
    modified.headers.set('X-Frame-Options', 'DENY')

    expect(response?.headers.get('X-Frame-Options')).toBe('DENY')
  })
})
```

---

## Mock 模式

### Mock next/navigation

```ts
// test/mocks/next-navigation.ts

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/current-path',
  useSearchParams: () => new URLSearchParams('page=1'),
  useParams: () => ({ id: '1' }),
  redirect: jest.fn(),
}))

// 在测试中使用
import { useRouter } from 'next/navigation'

it('navigates to detail page', async () => {
  const router = useRouter()
  const user = userEvent.setup()

  render(<OrderCard order={mockOrder} />)
  await user.click(screen.getByRole('link', { name: '查看详情' }))

  expect(router.push).toHaveBeenCalledWith('/orders/1')
})
```

### Mock next-auth

```ts
// test/mocks/next-auth.ts

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      user: {
        id: 'user-1',
        name: '测试用户',
        email: 'test@example.com',
        role: 'admin',
      },
      expires: '2099-12-31T23:59:59.999Z',
    },
    status: 'authenticated',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

// 在测试中覆盖特定 Session 状态
import { useSession } from 'next-auth/react'

it('shows login button for unauthenticated user', () => {
  ;(useSession as jest.Mock).mockReturnValue({
    data: null,
    status: 'unauthenticated',
  })

  render(<UserMenu />)
  expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()
})

it('shows admin menu for admin user', () => {
  ;(useSession as jest.Mock).mockReturnValue({
    data: {
      user: { id: '1', name: '管理员', role: 'admin' },
    },
    status: 'authenticated',
  })

  render(<UserMenu />)
  expect(screen.getByText('管理后台')).toBeInTheDocument()
})
```

### Mock TanStack Query

```tsx
// test/helpers/renderWithProviders.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement, ReactNode } from 'react'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,       // 测试中不重试
        gcTime: 0,          // 立即回收缓存
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions
) {
  const queryClient = createTestQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient }
}

export function createQueryWrapper() {
  const queryClient = createTestQueryClient()
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}
```

### Mock next/headers 和 next/cookies

```ts
// Server Component 测试时 Mock 只读 API
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: jest.fn((name: string) => {
      if (name === 'session') return { value: 'mock-token' }
      return undefined
    }),
    set: jest.fn(),
    delete: jest.fn(),
  }),
  headers: () => new Map([['user-agent', 'test']]),
}))
```

---

## API Mock（MSW）

```ts
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/orders', () => {
    return HttpResponse.json([
      { id: '1', title: '订单A', status: 'pending' },
      { id: '2', title: '订单B', status: 'completed' },
    ])
  }),

  http.post('/api/orders', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: '3', ...body }, { status: 201 })
  }),
]

// test/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```ts
// test/setup.ts（Jest 全局 setup）
import { server } from './mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### 测试中覆盖 Handler

```tsx
it('shows error when API fails', async () => {
  server.use(
    http.get('/api/orders', () => {
      return HttpResponse.json({ error: 'Server Error' }, { status: 500 })
    })
  )

  renderWithProviders(<OrderListPage />)
  expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument()
})
```

---

## 表单测试

```tsx
it('submits form with valid data', async () => {
  const onSubmit = jest.fn()
  const user = userEvent.setup()

  render(<LoginForm onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText('邮箱'), 'test@example.com')
  await user.type(screen.getByLabelText('密码'), 'password123')
  await user.click(screen.getByRole('button', { name: '登录' }))

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })
})

it('shows validation error for invalid email', async () => {
  const user = userEvent.setup()

  render(<LoginForm onSubmit={jest.fn()} />)

  await user.type(screen.getByLabelText('邮箱'), 'not-an-email')
  await user.click(screen.getByRole('button', { name: '登录' }))

  expect(await screen.findByText('请输入有效邮箱')).toBeInTheDocument()
})
```

---

## 集成测试（E2E with Playwright）

E2E 测试覆盖关键用户流程，使用 Playwright 操作真实浏览器。

```ts
// e2e/orders.spec.ts
import { test, expect } from '@playwright/test'

test.describe('订单管理流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/orders')
  })

  test('用户可以查看订单列表', async ({ page }) => {
    await expect(page.getByText('订单列表')).toBeVisible()
    await expect(page.getByRole('row')).toHaveCount(4) // 表头 + 3 条数据
  })

  test('用户可以创建新订单', async ({ page }) => {
    await page.click('button:has-text("新建订单")')
    await page.fill('[name="title"]', 'Playwright 订单')
    await page.fill('[name="amount"]', '299')
    await page.click('button:has-text("提交")')

    await expect(page.getByText('订单创建成功')).toBeVisible()
    await expect(page.getByText('Playwright 订单')).toBeVisible()
  })

  test('用户可以删除订单', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept())
    await page.click('button:has-text("删除"):first-of-type')

    await expect(page.getByText('订单已删除')).toBeVisible()
  })
})
```

E2E 测试命令：

```bash
# 运行 E2E 测试
npx playwright test

# 带 UI 模式运行
npx playwright test --ui

# 运行特定文件
npx playwright test e2e/orders.spec.ts
```

---

## 覆盖率要求

| 指标 | 最低阈值 |
|------|---------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

**必测项（不可跳过）：**
- 所有 Server Action 必须有测试
- 所有 Route Handler 必须有正常路径和错误路径测试
- 所有含业务逻辑的 Client Component 必须测试用户交互
- 所有自定义 Hook 必须有测试
- Middleware 必须有测试

**可以不测：**
- layout.tsx（纯布局文件）
- loading.tsx（加载骨架屏）
- error.tsx / not-found.tsx（框架文件）
- 纯展示型 Server Component（无数据获取、无条件分支）

---

## 测试编写惯例

### 命名规范

```tsx
describe('组件/函数名', () => {
  it('should <期望行为> when <条件>', () => { /* ... */ })

  // 示例
  it('should display order title when data loaded', () => { /* ... */ })
  it('should show error message when API fails', () => { /* ... */ })
  it('should call onSubmit with form data when submitted', () => { /* ... */ })
})
```

### Arrange-Act-Assert

```tsx
it('should display order information', () => {
  // Arrange — 准备测试数据和 Mock
  const order = { id: '1', title: '测试订单', status: 'pending' }

  // Act — 触发行为
  render(<OrderCard order={order} />)

  // Assert — 断言结果
  expect(screen.getByText('测试订单')).toBeInTheDocument()
  expect(screen.getByText('待处理')).toBeInTheDocument()
})
```

### 测试数据工厂

```ts
// test/factories/order.ts
export function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    title: '测试订单',
    status: 'pending',
    amount: 99.5,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

// 使用
it('shows completed badge for completed orders', () => {
  const order = createOrder({ status: 'completed' })
  render(<OrderCard order={order} />)
  expect(screen.getByText('已完成')).toBeInTheDocument()
})
```

### 异步等待

```tsx
// ✅ 用 findBy* / waitFor 等待异步渲染结果
expect(await screen.findByText('订单A')).toBeInTheDocument()

await waitFor(() => {
  expect(screen.getByText('加载完成')).toBeInTheDocument()
})

// ✅ 等待元素消失
await waitFor(() => {
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

// ❌ 不要用 act() 包裹渲染
act(() => { render(<Component />) })
```

---

## 禁止的写法

```tsx
// ❌ 用 container.querySelector（依赖 DOM 结构）
container.querySelector('.user-card-title')
// ✅ 用语义化查询
screen.getByRole('heading', { name: '用户名' })

// ❌ 直接断言内部 state/ref
expect(ref.current.value).toBe('xxx')
// ✅ 断言 UI 表现
expect(screen.getByDisplayValue('xxx')).toBeInTheDocument()

// ❌ 用 shallow render（无法测真实行为）
shallow(<OrderCard order={order} />)
// ✅ 用 render（测完整渲染）
render(<OrderCard order={order} />)

// ❌ 用 Jest timer mock 等待异步（不可靠）
jest.advanceTimersByTime(5000)
// ✅ 用 findBy* / waitFor 等待真实渲染结果
await screen.findByText('数据加载完成')

// ❌ 在 Server Component 测试中使用 RTL render 的 act
// Server Component 直接 await 即可，不需要 act
```
