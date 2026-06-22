# Auth — React Web 实现模式

---

## 目录结构

```
web/src/features/auth/
├── components/
│   ├── LoginForm.tsx
│   └── RegisterForm.tsx
├── hooks/
│   ├── useLogin.ts
│   └── useRegister.ts
└── types.ts

web/src/
├── api/
│   └── authApi.ts       ← API 函数
├── stores/
│   └── authStore.ts     ← Zustand（全局认证状态）
└── router/
    └── ProtectedRoute.tsx
```

---

## 核心实现模式

### 认证状态（Zustand）

```ts
// stores/authStore.ts
interface AuthState {
  user: User | null
  accessToken: string | null  // 内存存储，不持久化
  login: (result: LoginResult) => void
  logout: () => void
  setAccessToken: (token: string) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,

  login: (result) => set({
    user: result.user,
    accessToken: result.access_token,
  }),

  logout: () => set({ user: null, accessToken: null }),

  setAccessToken: (token) => set({ accessToken: token }),
}))

// 注意：accessToken 不用 persist — 存内存，刷新页面后通过 refresh_token 重新获取
```

### API Client（自动 Token 刷新）

```ts
// api/client.ts
let isRefreshing = false
let refreshPromise: Promise<string> | null = null

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      // 防止并发刷新
      if (!isRefreshing) {
        isRefreshing = true
        refreshPromise = authApi.refresh()
          .then((res) => {
            useAuthStore.getState().setAccessToken(res.access_token)
            return res.access_token
          })
          .catch(() => {
            useAuthStore.getState().logout()
            window.location.href = '/login'
            throw error
          })
          .finally(() => {
            isRefreshing = false
            refreshPromise = null
          })
      }

      const newToken = await refreshPromise!
      original.headers.Authorization = `Bearer ${newToken}`
      return apiClient(original)
    }

    return Promise.reject(error)
  }
)
```

### Refresh Token（Cookie 方案）

```ts
// refresh_token 通过 httpOnly Cookie 存储（后端 Set-Cookie）
// 前端 refresh 请求时自动携带 Cookie，无需手动处理

// api/authApi.ts
export const authApi = {
  login: (data: LoginDto) =>
    apiClient.post<LoginResult>('/auth/login', data, { withCredentials: true }),

  refresh: () =>
    apiClient.post<{ access_token: string }>('/auth/refresh', null, {
      withCredentials: true,
    }),

  logout: () =>
    apiClient.post('/auth/logout', null, { withCredentials: true }),
}
```

### 路由保护

```tsx
// router/ProtectedRoute.tsx
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
```

### 页面刷新后自动恢复

```tsx
// App.tsx 或 router 顶层
function AuthInitializer({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const { login } = useAuthStore()

  useEffect(() => {
    // 尝试用 refresh_token 恢复会话
    authApi.refresh()
      .then((res) => {
        // 需要同时获取用户信息
        return apiClient.get<User>('/auth/me', {
          headers: { Authorization: `Bearer ${res.access_token}` }
        }).then((userRes) => {
          login({ access_token: res.access_token, user: userRes.data })
        })
      })
      .catch(() => {
        // refresh 失败 = 未登录，正常情况
      })
      .finally(() => setIsReady(true))
  }, [])

  if (!isReady) return <AppLoading />
  return <>{children}</>
}
```

---

## 关键注意事项

1. `access_token` 只存内存（`authStore`），不写 localStorage
2. 并发刷新用 singleton promise 防止 race condition
3. `withCredentials: true` 才能携带/接收 Cookie
4. 登出后调用后端 `/auth/logout` 删除 DB 中的 refresh_token
5. 登录成功后重定向到 `state.from`（保留用户原始目标页）
