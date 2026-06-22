# Go 项目结构规范

## 目录布局

```
backend/
├── cmd/
│   └── server/
│       └── main.go          ← 程序入口，只做组装
├── internal/                ← 私有代码（外部包不可导入）
│   ├── handler/             ← HTTP Handler（Gin 路由处理）
│   │   ├── user.go
│   │   ├── order.go
│   │   └── middleware/
│   │       ├── auth.go
│   │       └── logging.go
│   ├── service/             ← 业务逻辑层
│   │   ├── user.go          ← 包含 UserService + UserRepository 接口
│   │   └── order.go
│   ├── repository/          ← 数据访问层（实现 service 中定义的接口）
│   │   ├── user_repo.go
│   │   └── order_repo.go
│   ├── domain/              ← 领域模型（纯 struct，无依赖）
│   │   ├── user.go
│   │   └── order.go
│   └── bootstrap/           ← 应用初始化（依赖注入、路由注册）
│       ├── app.go
│       └── routes.go
├── pkg/                     ← 可公开复用的工具包
│   ├── apperr/              ← 应用级错误定义
│   ├── pagination/          ← 分页工具
│   └── validator/           ← 参数校验
├── config/
│   ├── config.go            ← 配置结构体
│   └── config.yaml          ← 默认配置（敏感值从环境变量读取）
├── migrations/              ← 数据库迁移文件（goose 或 migrate）
│   ├── 001_create_users.sql
│   └── 002_create_orders.sql
├── go.mod
├── go.sum
└── Makefile
```

---

## 分层职责

### 1. Handler 层

**职责**：HTTP 协议适配（请求解析、响应序列化、状态码）

```go
// internal/handler/user.go
type UserHandler struct {
    svc UserService  // 依赖接口
}

func (h *UserHandler) CreateUser(c *gin.Context) {
    // 1. 绑定请求
    // 2. 调用 service
    // 3. 返回响应
}
```

**禁止**：Handler 层不写数据库查询、不含业务逻辑

### 2. Service 层

**职责**：业务规则、事务协调、错误语义

```go
// internal/service/user.go

// 接口在 service 层定义（消费者端）
type UserRepository interface {
    FindByEmail(ctx context.Context, email string) (*domain.User, error)
    Save(ctx context.Context, user *domain.User) error
}

type UserService struct {
    repo UserRepository
    log  *slog.Logger
}

func (s *UserService) CreateUser(ctx context.Context, req CreateUserReq) (*domain.User, error) {
    // 业务规则在这里
    existing, err := s.repo.FindByEmail(ctx, req.Email)
    if err != nil && !errors.Is(err, ErrNotFound) {
        return nil, fmt.Errorf("check_email: %w", err)
    }
    if existing != nil {
        return nil, ErrEmailDuplicated
    }
    // ...
}
```

**禁止**：Service 层不处理 HTTP（不用 gin.Context）

### 3. Repository 层

**职责**：数据库 CRUD，SQL 查询，错误转换

```go
// internal/repository/user_repo.go
type UserRepository struct {
    db *sqlx.DB
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
    var user domain.User
    err := r.db.GetContext(ctx, &user, `SELECT * FROM users WHERE email = $1`, email)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, service.ErrNotFound  // 转换为领域错误
    }
    if err != nil {
        return nil, fmt.Errorf("db.FindByEmail: %w", err)
    }
    return &user, nil
}
```

### 4. Domain 层

**职责**：纯数据结构，无外部依赖

```go
// internal/domain/user.go
type User struct {
    ID        int64     `db:"id" json:"id"`
    Email     string    `db:"email" json:"email"`
    Name      string    `db:"name" json:"name"`
    CreatedAt time.Time `db:"created_at" json:"created_at"`
}
```

---

## 依赖注入（bootstrap）

**不使用第三方 DI 框架**，手动组装：

```go
// internal/bootstrap/app.go
func NewApp(cfg *config.Config) (*gin.Engine, error) {
    // 1. 数据库
    db, err := sqlx.Connect("postgres", cfg.DatabaseURL)
    if err != nil {
        return nil, fmt.Errorf("db connect: %w", err)
    }

    // 2. Repository
    userRepo := repository.NewUserRepository(db)

    // 3. Service
    userSvc := service.NewUserService(userRepo, slog.Default())

    // 4. Handler
    userHandler := handler.NewUserHandler(userSvc)

    // 5. Router
    r := gin.New()
    r.Use(middleware.Logging(), middleware.Recovery())
    routes.Register(r, userHandler)

    return r, nil
}
```

---

## 配置管理

```go
// config/config.go
type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    JWT      JWTConfig
}

type ServerConfig struct {
    Port    int    `mapstructure:"port"`
    Timeout int    `mapstructure:"timeout"`
}

type DatabaseConfig struct {
    URL     string `mapstructure:"url"`
    MaxConn int    `mapstructure:"max_conn"`
}

// 加载：优先环境变量，回退 yaml
func Load() (*Config, error) {
    viper.AutomaticEnv()
    viper.SetConfigFile("config/config.yaml")
    // ...
}
```

**规则**：
- 所有配置从环境变量或 yaml 读取，不硬编码
- 敏感值（密钥、密码）只从环境变量读取，不写入 yaml
- `.env` 文件不提交 git（`.gitignore` 排除）

---

## Makefile 约定

```makefile
.PHONY: run test lint migrate

run:
    go run cmd/server/main.go

test:
    go test ./... -v -race -coverprofile=coverage.out

lint:
    golangci-lint run

migrate-up:
    goose -dir migrations postgres $(DATABASE_URL) up

migrate-down:
    goose -dir migrations postgres $(DATABASE_URL) down
```

---

## 模块依赖规则

```
cmd → bootstrap → handler → service → repository → domain
                                    ↘ domain
```

- 每层只依赖下层
- `domain` 不依赖任何其他层
- 禁止循环依赖
- `pkg/` 可被任何层引用
