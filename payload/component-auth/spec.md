# Auth 组件 — 功能契约

> 组件类型：跨端功能蓝图（不是可运行代码）
> 涵盖：用户认证（注册/登录/登出/Token 刷新）

---

## 接口定义

### HTTP API（Go 后端）

```
POST /auth/register    → 注册
POST /auth/login       → 登录，返回 access_token + refresh_token
POST /auth/logout      → 登出（使 refresh_token 失效）
POST /auth/refresh     → 刷新 access_token
GET  /auth/me          → 获取当前用户信息（需认证）
```

### 数据结构

**注册请求**：
```json
{
  "email": "user@example.com",
  "password": "plaintext_password",
  "name": "用户名"
}
```

**登录响应**：
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "用户名"
  }
}
```

**Token 规格**：
- access_token：JWT，有效期 1 小时
- refresh_token：JWT，有效期 7 天，存储在数据库（可主动失效）

### 用户模型

```
users 表：
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
  email      VARCHAR(255) UNIQUE NOT NULL
  name       VARCHAR(100) NOT NULL
  password   VARCHAR(255) NOT NULL  -- bcrypt hash
  created_at TIMESTAMPTZ DEFAULT NOW()
  updated_at TIMESTAMPTZ DEFAULT NOW()

refresh_tokens 表：
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id    UUID REFERENCES users(id)
  token      TEXT UNIQUE NOT NULL  -- JWT 的 jti 字段
  expires_at TIMESTAMPTZ NOT NULL
  created_at TIMESTAMPTZ DEFAULT NOW()
```

---

## 核心决策

| 决策项 | 选择 | 原因 |
|--------|------|------|
| Token 方案 | JWT（双 Token） | 无状态 + 可撤销（refresh token 存 DB） |
| 密码哈希 | bcrypt（cost=12） | 业界标准，抗暴力破解 |
| access_token 存储 | 内存（JS 变量 / Flutter 变量） | 防 XSS，不持久化 |
| refresh_token 存储 | secure cookie（Web）/ secure storage（Flutter） | 防 XSS/JS 访问 |
| 登出策略 | 删除 DB 中的 refresh_token | 支持主动撤销 |
| 路由保护 | 中间件统一处理 | 不在每个 Handler 里判断 |

---

## 错误语义

| 场景 | HTTP 状态码 | 错误消息 |
|------|------------|---------|
| 邮箱已注册 | 409 | "email already exists" |
| 邮箱/密码错误 | 401 | "invalid credentials" |
| Token 过期 | 401 | "token expired" |
| Token 无效 | 401 | "invalid token" |
| refresh token 已失效 | 401 | "refresh token revoked" |
| 无权访问 | 403 | "forbidden" |
