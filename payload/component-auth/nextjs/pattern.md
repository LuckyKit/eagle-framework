# Auth — Next.js 实现模式

> 使用 next-auth (Auth.js v5)，基于 App Router、Server Components 和 Server Actions。

---

## 目录结构

```
src/
├── app/
│   ├── (auth)/                    ← 路由组：认证页面（无保护）
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/               ← 路由组：受保护页面
│   │   ├── layout.tsx             ← 内嵌 AuthGuard
│   │   └── dashboard/
│   │       └── page.tsx
│   ├── api/
│   │   └── auth/
│   │       └── me/
│   │           └── route.ts       ← 受保护的 Route Handler
│   └── layout.tsx                 ← 根布局（SessionProvider）
├── auth/
│   ├── auth.config.ts             ← next-auth 配置（providers, callbacks, JWT）
│   ├── auth.ts                    ← auth() / signIn / signOut 导出
│   ├── middleware.ts              ← Edge Middleware（路由保护）
│   └── actions.ts                 ← Server Actions（login, register, logout）
├── features/
│   └── auth/
│       ├── components/
│       │   ├── LoginForm.tsx       ← Client Component（useActionState）
│       │   ├── RegisterForm.tsx
│       │   └── AuthGuard.tsx       ← 客户端路由守卫
│       ├── hooks/
│       │   └── useAuth.ts         ← 基于 useSession 的封装 hook
│       ├── stores/
│       │   └── authStore.ts       ← Zustand（客户端补充状态）
│       └── types.ts
└── lib/
    └── api-client.ts              ← 服务端 fetch 封装（自动带 Authorization）
```

---

## 核心实现模式

### next-auth 配置（Auth.js v5）

```ts
// src/auth/auth.config.ts
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // JWT 回调：登录时写入 token，后续每次请求透传
    async jwt({ token, user }) {
      if (user) {
        // 首次登录（user 只在 signIn 时有值）
        token.id = user.id
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
        token.expiresAt = user.expiresAt
      }

      // 检查 access_token 是否过期
      if (Date.now() < (token.expiresAt as number)) {
        return token // 未过期，直接返回
      }

      // 过期时用 refresh_token 换取新 token
      return await refreshAccessToken(token)
    },

    // Session 回调：决定 client 端 useSession() 能拿到什么
    async session({ session, token }) {
      session.user.id = token.id as string
      session.accessToken = token.accessToken as string
      session.error = token.error as string | undefined
      return session
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith("/(dashboard)")

      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false // 未登录 → 重定向到 /login
      }

      // 已登录用户访问 /login → 重定向到 /dashboard
      if (isLoggedIn && nextUrl.pathname.startsWith("/login")) {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }

      return true
    },
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 调用后端 /auth/login，返回 { id, email, name, accessToken, refreshToken, expiresAt }
        const res = await fetch(`${process.env.API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        })

        if (!res.ok) return null // 返回 null 触发登录失败

        const data = await res.json()

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
        }
      },
    }),
  ],

  session: {
    strategy: "jwt", // JWT 策略（非 database session）
  },

  // HttpOnly cookie 配置（不暴露给 JS）
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
} satisfies NextAuthConfig
```

### JWT 刷新逻辑

```ts
// src/auth/auth.config.ts（续）
async function refreshAccessToken(token: any) {
  try {
    const res = await fetch(`${process.env.API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    })

    if (!res.ok) throw new Error("Refresh failed")

    const data = await res.json()

    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }
  } catch (error) {
    // refresh 失败 → 标记错误，session 回调会清除
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}
```

### 导出 auth / signIn / signOut

```ts
// src/auth/auth.ts
import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

// handlers: { GET, POST } — 给 Route Handler 用（api/auth/[...nextauth]/route.ts）
// auth: 服务端获取 session 的函数（Server Components / Route Handlers / Server Actions）
// signIn / signOut: Server Actions 可直接调用的方法
```

---

### Middleware（路由保护）

```ts
// src/auth/middleware.ts
import { auth as authMiddleware } from "@/auth/auth"

// 只匹配需要保护的路由
export default authMiddleware((req) => {
  // 可选：在这里做细粒度控制（角色检查等）
  // if (req.auth && !req.auth.user?.roles?.includes("admin")) { ... }
})

export const config = {
  // 只拦截 (dashboard) 路由组和 API 路由
  matcher: [
    "/(dashboard)/:path*",
    "/api/auth/me/:path*",
    // 排除静态资源和 next-auth 自身路由
    "/((?!api/auth/nextauth|_next/static|_next/image|favicon.ico).*)",
  ],
}
```

### Route Groups 模式

```
src/app/
├── (auth)/           ← 无需认证的页面（login, register）
│   ├── layout.tsx     ← 独立的布局（纯 UI，不调用 auth()）
│   └── login/
│       └── page.tsx
├── (dashboard)/      ← 需要认证的页面
│   └── layout.tsx     ← 调用 auth() 检查 session，未登录则 redirect
```

```tsx
// src/app/(dashboard)/layout.tsx
import { auth } from "@/auth/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="dashboard-layout">
      <DashboardSidebar user={session.user} />
      <main>{children}</main>
    </div>
  )
}
```

---

### Server Actions（登录 / 登出）

```ts
// src/auth/actions.ts
"use server"

import { signIn, signOut } from "@/auth/auth"
import { AuthError } from "next-auth"

// 登录 Server Action
export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: "/dashboard", // 成功后重定向
    })
  } catch (error) {
    if (error instanceof AuthError) {
      // CredentialsSignin 错误 → 返回可展示的消息
      if (error.type === "CredentialsSignin") {
        return { error: "邮箱或密码错误" }
      }
      return { error: "登录服务异常，请稍后再试" }
    }
    throw error // 重定向错误（next-auth 用 throw 实现 redirect）
  }
}

// 登出 Server Action
export async function logoutAction() {
  // 1. 调用后端 /auth/logout 让 refresh_token 失效
  const session = await auth()
  if (session?.refreshToken) {
    await fetch(`${process.env.API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    }).catch(() => {
      // 后端注销失败不影响前端登出
    })
  }

  // 2. 清除 next-auth session
  await signOut({ redirectTo: "/login" })
}
```

### Login Form（Client Component + useActionState）

```tsx
// src/features/auth/components/LoginForm.tsx
"use client"

import { useActionState } from "react"
import { loginAction } from "@/auth/actions"

const initialState = { error: "" }

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState)

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="password">密码</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      {state?.error && (
        <p className="text-red-500" role="alert">{state.error}</p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? "登录中..." : "登录"}
      </button>
    </form>
  )
}
```

---

### Session 管理

#### 服务端获取 Session

```ts
// 在 Server Component、Route Handler、Server Action 中
import { auth } from "@/auth/auth"

// Server Component
export default async function Page() {
  const session = await auth()
  // session.user.id / session.user.email / session.accessToken
  return <div>Hello, {session?.user?.name}</div>
}

// Route Handler
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  // ...
}

// Server Action
export async function serverAction() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  // ...
}
```

#### 客户端获取 Session（useSession + SessionProvider）

```tsx
// src/app/layout.tsx — 根布局包裹 SessionProvider
import { SessionProvider } from "next-auth/react"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

```tsx
// 任意 Client Component 中使用
"use client"

import { useSession } from "next-auth/react"

export function UserAvatar() {
  const { data: session, status } = useSession()

  if (status === "loading") return <Skeleton />
  if (status === "unauthenticated") return <LoginLink />

  return <Avatar src={session?.user?.image} name={session?.user?.name} />
}
```

---

### 客户端用户状态（Zustand）

> next-auth 的 `useSession` 已覆盖大部分场景。Zustand 用于补充 next-auth session 不包含的客户端临时状态。

```ts
// src/features/auth/stores/authStore.ts
import { create } from "zustand"

interface AuthStoreState {
  // 客户端独有的 UI 状态（不存敏感数据）
  isLoginModalOpen: boolean
  intendedRoute: string | null  // 登录后跳回的目标路由

  openLoginModal: () => void
  closeLoginModal: () => void
  setIntendedRoute: (route: string | null) => void
}

export const useAuthStore = create<AuthStoreState>()((set) => ({
  isLoginModalOpen: false,
  intendedRoute: null,

  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),
  setIntendedRoute: (route) => set({ intendedRoute: route }),
}))
```

> 注意：accessToken 不存 Zustand — 它存在于 HttpOnly cookie 的 JWT 中，客户端不可读。需要 token 的操作通过服务端 `auth()` 获取。

---

### useAuth Hook（客户端封装）

```ts
// src/features/auth/hooks/useAuth.ts
"use client"

import { useSession } from "next-auth/react"

export function useAuth() {
  const { data: session, status, update } = useSession()

  return {
    user: session?.user ?? null,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    // 强制刷新 session（触发 JWT 回调中的 token 刷新）
    refresh: () => update(),
  }
}
```

---

### AuthGuard（客户端路由守卫组件）

```tsx
// src/features/auth/components/AuthGuard.tsx
"use client"

import { useAuth } from "../hooks/useAuth"
import { redirect } from "next/navigation"
import { useAuthStore } from "../stores/authStore"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const setIntendedRoute = useAuthStore((s) => s.setIntendedRoute)

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!isAuthenticated) {
    // 记录当前路径，登录后跳回
    if (typeof window !== "undefined") {
      setIntendedRoute(window.location.pathname)
    }
    redirect("/login")
  }

  return <>{children}</>
}
```

### Server Component 认证检查模式

```tsx
// 直接在 Server Component 中检查（无需客户端 AuthGuard）
import { auth } from "@/auth/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // 可选：角色检查
  if (session.user.role !== "admin") {
    redirect("/403")
  }

  return <DashboardContent user={session.user} />
}
```

---

### API Route Handler 保护

```ts
// src/app/api/auth/me/route.ts
import { auth } from "@/auth/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    )
  }

  // accessToken 在后端 JWT 中，服务端可读取
  const res = await fetch(`${process.env.API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: "failed to fetch user" },
      { status: res.status }
    )
  }

  const user = await res.json()
  return NextResponse.json(user)
}
```

### 服务端 fetch 封装（自动带认证头）

```ts
// src/lib/api-client.ts
import { auth } from "@/auth/auth"

type FetchOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>
}

export async function serverFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const session = await auth()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  // 服务端自动注入 accessToken
  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`
  }

  const res = await fetch(`${process.env.API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    // 服务端不处理 401 重定向（Middleare 已拦截），直接抛错
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error ?? "request failed")
  }

  return res.json()
}
```

---

### 错误处理

```ts
// src/features/auth/types.ts
export enum AuthErrorCode {
  EMAIL_EXISTS = "email already exists",
  INVALID_CREDENTIALS = "invalid credentials",
  TOKEN_EXPIRED = "token expired",
  TOKEN_INVALID = "invalid token",
  REFRESH_REVOKED = "refresh token revoked",
  FORBIDDEN = "forbidden",
}

// auth.config.ts JWT 回调里的 refreshAccessToken 已覆盖 token 过期场景。
// 如果 refresh 也失败，session.error 会被设为 "RefreshAccessTokenError"。
// session 回调检测到 error 后可以在客户端处理：

// src/features/auth/hooks/useSessionMonitor.ts
"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function useSessionMonitor() {
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      // refresh token 也已过期 → 强制登出
      signOut({ redirect: false }).then(() => {
        router.push("/login")
      })
    }
  }, [session?.error, router])
}
```

```tsx
// Server Component 级别的错误处理
import { auth } from "@/auth/auth"

export default async function ProtectedServerPage() {
  const session = await auth()

  if (session?.error === "RefreshAccessTokenError") {
    // Session 已失效但 middleware 未触发更新
    return <SessionExpiredDialog />
  }

  if (!session?.user) {
    return null // middleware 已处理，理论上不会走到这里
  }

  return <PageContent />
}
```

---

## 关键注意事项

1. **accessToken 不暴露给客户端 JS**：存于 HttpOnly cookie 的 JWT 中，客户端不可读。需要 accessToken 的场景发送给服务端，由 `auth()` 提取后通过 `serverFetch` 转发。
2. **不要混用 Middleware 和 layout 保护**：Middleware (`authConfig.matcher`) 做路由级拦截；layout 做辅助检查（角色控制）。避免双重判断导致无限重定向。
3. **`signIn` / `signOut` 在 Server Action 中调用**：不要从 Client Component 直接调用 `signIn("credentials", ...)` — 通过 `useActionState` + Server Action 间接调用，避免将 credentials 暴露在客户端 bundle 中。
4. **refresh token 的 HttpOnly cookie 由后端 Set-Cookie**：登录响应中后端设置 `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax`。前端无需处理。
5. **Middleware 跑在 Edge Runtime**：不要在 middleware 里做 DB 查询或调用后端 API — 只做 session cookie 验证和重定向。
6. **`authConfig.matcher` 的负向匹配要谨慎**：必须排除 `_next/static`、`_next/image`、`favicon.ico`，否则静态资源也会触发 middleware。
7. **路由组 `(auth)` 和 `(dashboard)` 不影响 URL**：用户看到的 URL 是 `/login`、`/dashboard`，不带路由组前缀。路由组只影响 layout 继承。
8. **Zustand 只存 UI 状态**：不存 token、不存敏感用户数据。session 相关的状态全部走 `useSession()`。
9. **登出要两步**：先调后端 `/auth/logout` 删除 refresh_token，再调 `signOut()` 清除本地 session cookie。
10. **CSRF 保护**：next-auth 的 Credentials provider 内置 CSRF token（`authjs.csrf-token` cookie），在 Server Action 中调用 `signIn` 会自动校验，无需额外配置。
