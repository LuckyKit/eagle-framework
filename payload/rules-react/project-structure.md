# React 项目结构规范

## 目录布局

```
web/
├── src/
│   ├── api/                 ← API 调用函数（按资源分文件）
│   │   ├── userApi.ts
│   │   ├── orderApi.ts
│   │   └── client.ts        ← Axios 实例 + 拦截器
│   ├── components/          ← 全局通用组件（不含业务逻辑）
│   │   ├── ui/              ← 原子组件（Button, Input, Modal）
│   │   └── layout/          ← 布局组件（Header, Sidebar, PageLayout）
│   ├── features/            ← 按功能模块划分（核心目录）
│   │   ├── auth/
│   │   │   ├── components/  ← 该 feature 专属组件
│   │   │   ├── hooks/       ← 该 feature 专属 Hook
│   │   │   ├── stores/      ← 该 feature 专属 Store（可选）
│   │   │   └── types.ts     ← 该 feature 专属类型
│   │   ├── orders/
│   │   └── users/
│   ├── hooks/               ← 全局通用 Hook（跨 feature 复用）
│   │   ├── useDebounce.ts
│   │   └── usePagination.ts
│   ├── stores/              ← 全局 Zustand Store
│   │   └── authStore.ts
│   ├── types/               ← 全局类型定义
│   │   ├── api.ts           ← API 请求/响应类型
│   │   └── models.ts        ← 领域模型类型
│   ├── lib/                 ← 工具函数
│   │   ├── cn.ts            ← className 合并
│   │   ├── formatters.ts    ← 日期/金额格式化
│   │   └── validators.ts    ← 表单校验
│   ├── router/
│   │   ├── index.tsx        ← 路由定义
│   │   └── ProtectedRoute.tsx
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Feature 模块规范

Feature = 一个完整的业务功能域（如认证、订单、用户管理）。

### Feature 内部结构

```
features/orders/
├── components/
│   ├── OrderList.tsx        ← 列表组件
│   ├── OrderCard.tsx        ← 列表项
│   └── OrderForm.tsx        ← 创建/编辑表单
├── hooks/
│   ├── useOrderList.ts      ← 列表数据 Hook
│   └── useCreateOrder.ts    ← 创建操作 Hook
└── types.ts                 ← Feature 私有类型
```

**规则**：
- Feature 内的组件/Hook 不直接 import 其他 Feature 的内部文件
- Feature 间共享的数据通过全局 Store 或 Props 传递
- Feature 可以 import `components/`、`hooks/`、`api/`、`types/` 等全局目录

---

## 路由组织

```tsx
// router/index.tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: <ProtectedRoute><DashboardPage /></ProtectedRoute>,
      },
      {
        path: 'orders',
        element: <ProtectedRoute><Outlet /></ProtectedRoute>,
        children: [
          { index: true, element: <OrderListPage /> },
          { path: ':id', element: <OrderDetailPage /> },
          { path: 'new', element: <CreateOrderPage /> },
        ],
      },
    ],
  },
  { path: '/login', element: <LoginPage /> },
])
```

**规则**：
- 每个路由对应 `features/{name}/` 下的 Page 组件
- 受保护路由统一用 `ProtectedRoute` 包裹
- 路由懒加载（`React.lazy`）用于大型 Feature

---

## API Client 规范

```ts
// api/client.ts
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
})

// 请求拦截：注入 Token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：统一错误处理
apiClient.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)
```

---

## 环境变量

```bash
# .env（提交到 git，只含公开默认值）
VITE_API_BASE_URL=http://localhost:8080

# .env.local（不提交，覆盖本地配置）
VITE_API_BASE_URL=http://localhost:3000

# .env.production（CI/CD 注入）
VITE_API_BASE_URL=https://api.example.com
```

**规则**：
- 所有环境变量 `VITE_` 前缀（Vite 约定）
- `.env.local` 和 `.env.production` 不提交 git
- 代码中通过 `import.meta.env.VITE_XXX` 访问

---

## 文件命名约定

| 文件内容 | 命名 | 示例 |
|---------|------|------|
| React 组件 | PascalCase.tsx | `UserCard.tsx` |
| 自定义 Hook | camelCase.ts | `useOrderList.ts` |
| Zustand Store | camelCase + Store.ts | `authStore.ts` |
| API 函数集 | camelCase + Api.ts | `userApi.ts` |
| 类型定义 | camelCase 或 types.ts | `models.ts` |
| 工具函数 | camelCase.ts | `formatters.ts` |
| 页面组件 | PascalCase + Page.tsx | `OrderListPage.tsx` |

---

## 路径别名配置

```ts
// vite.config.ts
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

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
