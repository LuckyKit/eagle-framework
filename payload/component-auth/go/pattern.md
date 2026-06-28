# Auth — Go 后端实现模式

---

## 目录结构

```
backend/internal/
├── handler/
│   └── auth.go          ← AuthHandler（HTTP 层）
├── service/
│   └── auth.go          ← AuthService + 接口定义
├── repository/
│   └── auth_repo.go     ← token 存储 + user 查询
├── domain/
│   └── user.go          ← User 实体
└── middleware/
    └── auth.go          ← JWT 验证中间件
```

---

## 核心实现模式

### JWT 签发/验证

```go
// pkg/jwt/jwt.go
type Claims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    jwt.RegisteredClaims
}

func Sign(userID, email, secret string, expiry time.Duration) (string, error) {
    claims := Claims{
        UserID: userID,
        Email:  email,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            ID:        uuid.NewString(),  // jti，用于 refresh token 的 DB 存储
        },
    }
    return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func Parse(tokenStr, secret string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
        if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
        }
        return []byte(secret), nil
    })
    if err != nil {
        return nil, fmt.Errorf("jwt.Parse: %w", err)
    }
    claims, ok := token.Claims.(*Claims)
    if !ok || !token.Valid {
        return nil, errors.New("invalid token")
    }
    return claims, nil
}
```

### 认证中间件

```go
// internal/middleware/auth.go
func RequireAuth(jwtSecret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
            c.Abort()
            return
        }

        tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
        claims, err := jwtpkg.Parse(tokenStr, jwtSecret)
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
            c.Abort()
            return
        }

        // 注入用户信息到 context
        c.Set("user_id", claims.UserID)
        c.Set("user_email", claims.Email)
        c.Next()
    }
}

// 在路由中使用
authGroup := r.Group("/api")
authGroup.Use(middleware.RequireAuth(cfg.JWT.Secret))
{
    authGroup.GET("/auth/me", authHandler.Me)
}
```

### 密码哈希

```go
// 哈希
func HashPassword(plain string) (string, error) {
    hashed, err := bcrypt.GenerateFromPassword([]byte(plain), 12)
    if err != nil {
        return "", fmt.Errorf("bcrypt.Hash: %w", err)
    }
    return string(hashed), nil
}

// 验证
func VerifyPassword(plain, hashed string) error {
    return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(plain))
    // 返回 nil 表示匹配，返回 bcrypt.ErrMismatchedHashAndPassword 表示不匹配
}
```

### Service 层

```go
// internal/service/auth.go
type UserRepository interface {
    FindByEmail(ctx context.Context, email string) (*domain.User, error)
    Create(ctx context.Context, user *domain.User) error
}

type RefreshTokenRepository interface {
    Save(ctx context.Context, userID, jti string, expiry time.Time) error
    Exists(ctx context.Context, jti string) (bool, error)
    Delete(ctx context.Context, jti string) error
}

type AuthService struct {
    users  UserRepository
    tokens RefreshTokenRepository
    cfg    JWTConfig
    log    *slog.Logger
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*LoginResult, error) {
    user, err := s.users.FindByEmail(ctx, strings.ToLower(email))
    if err != nil {
        return nil, ErrInvalidCredentials  // 不泄露"邮箱不存在"
    }
    if err := VerifyPassword(password, user.Password); err != nil {
        return nil, ErrInvalidCredentials
    }
    return s.issueTokens(ctx, user)
}

func (s *AuthService) issueTokens(ctx context.Context, user *domain.User) (*LoginResult, error) {
    accessToken, err := jwtpkg.Sign(user.ID, user.Email, s.cfg.Secret, time.Hour)
    if err != nil {
        return nil, fmt.Errorf("sign access token: %w", err)
    }

    refreshToken, err := jwtpkg.Sign(user.ID, user.Email, s.cfg.Secret, 7*24*time.Hour)
    if err != nil {
        return nil, fmt.Errorf("sign refresh token: %w", err)
    }

    // 解析 jti 存 DB
    claims, _ := jwtpkg.Parse(refreshToken, s.cfg.Secret)
    if err := s.tokens.Save(ctx, user.ID, claims.ID, claims.ExpiresAt.Time); err != nil {
        return nil, fmt.Errorf("save refresh token: %w", err)
    }

    return &LoginResult{
        AccessToken:  accessToken,
        RefreshToken: refreshToken,
        ExpiresIn:    3600,
        User:         user,
    }, nil
}
```

---

## 关键注意事项

1. 登录失败统一返回 `ErrInvalidCredentials`，不区分"邮箱不存在"和"密码错误"（防枚举）
2. 邮箱存储和比较前必须 `strings.ToLower()`
3. bcrypt cost 不低于 12（cost=10 太弱，cost=14 太慢）
4. refresh_token 的 jti 入 DB 时检查唯一性（race condition 防护）
