# React 测试规范

## 工具栈

- **Vitest** — 测试运行器（与 Vite 集成）
- **React Testing Library (RTL)** — 组件测试（用户行为视角）
- **MSW (Mock Service Worker)** — API Mock（网络层拦截）
- **@testing-library/user-event** — 模拟用户操作

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

## 组件测试

```tsx
// features/orders/components/__tests__/OrderCard.test.tsx

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
    const onEdit = vi.fn()
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
// test/setup.ts（Vitest 全局 setup）
import { beforeAll, afterAll, afterEach } from 'vitest'
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

  render(<OrderListPage />)
  expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument()
})
```

---

## 含 Provider 的组件测试

```tsx
// test/helpers/renderWithProviders.tsx
function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...options })
}

// 使用
it('fetches and displays orders', async () => {
  renderWithProviders(<OrderListPage />)

  expect(await screen.findByText('订单A')).toBeInTheDocument()
  expect(screen.getByText('订单B')).toBeInTheDocument()
})
```

---

## Hook 测试

```ts
// features/orders/hooks/__tests__/useOrderList.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { useOrderList } from '../useOrderList'

it('returns orders from API', async () => {
  const { result } = renderHook(() => useOrderList(), {
    wrapper: createQueryWrapper(),  // 包裹 QueryClientProvider
  })

  await waitFor(() => expect(result.current.isLoading).toBe(false))

  expect(result.current.orders).toHaveLength(2)
  expect(result.current.orders[0].title).toBe('订单A')
})

it('returns error when API fails', async () => {
  server.use(http.get('/api/orders', () => HttpResponse.json({}, { status: 500 })))

  const { result } = renderHook(() => useOrderList(), {
    wrapper: createQueryWrapper(),
  })

  await waitFor(() => expect(result.current.error).toBeTruthy())
})
```

---

## 表单测试

```tsx
it('submits form with valid data', async () => {
  const onSubmit = vi.fn()
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

  render(<LoginForm onSubmit={vi.fn()} />)

  await user.type(screen.getByLabelText('邮箱'), 'not-an-email')
  await user.click(screen.getByRole('button', { name: '登录' }))

  expect(await screen.findByText('请输入有效邮箱')).toBeInTheDocument()
})
```

---

## 文件结构

```
features/orders/
├── components/
│   ├── OrderCard.tsx
│   └── __tests__/
│       └── OrderCard.test.tsx
├── hooks/
│   ├── useOrderList.ts
│   └── __tests__/
│       └── useOrderList.test.ts
```

---

## vitest.config.ts

```ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx'],
    },
  },
})
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
```
