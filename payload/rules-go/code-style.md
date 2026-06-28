# Go 代码风格规范

## 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 包名 | 小写单词，无下划线 | `userauth`, `payment` |
| 导出类型/函数 | PascalCase | `UserService`, `CreateOrder` |
| 未导出函数/变量 | camelCase | `parseToken`, `maxRetries` |
| 常量 | PascalCase（导出）/ camelCase（未导出） | `DefaultTimeout`, `maxRetries` |
| 接口 | 单方法接口加 -er 后缀 | `Reader`, `Stringer`, `UserFetcher` |
| 结构体 | PascalCase，名词 | `UserRepository`, `PaymentGateway` |
| 测试函数 | `Test{FunctionName}_{scenario}` | `TestCreateUser_DuplicateEmail` |

---

## 错误处理

### 强制规则

1. **每个 error 必须处理或显式忽略**（用 `_` 并注释原因）
2. **包装错误要加上下文**，用 `%w` 保留原始错误链

```go
// ✅ 正确：包装错误
func (r *UserRepo) FindByID(ctx context.Context, id int64) (*User, error) {
    user, err := r.db.QueryRowContext(ctx, querySQL, id)
    if err != nil {
        return nil, fmt.Errorf("userRepo.FindByID id=%d: %w", id, err)
    }
    return user, nil
}

// ❌ 错误：裸返回错误，无上下文
return nil, err
```

3. **哨兵错误**（已知错误类型）用 `errors.Is`/`errors.As` 检查

```go
var ErrUserNotFound = errors.New("user not found")

// 定义
if rows == 0 {
    return nil, ErrUserNotFound
}

// 检查
if errors.Is(err, ErrUserNotFound) {
    return c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
}
```

4. **不要在底层 panic**，只在程序启动阶段（配置加载失败、必需依赖不可用）使用 panic

---

## 接口设计

### 接口定义原则

- **接口在消费者一侧定义**，不在实现包定义
- **小接口优于大接口**，一个接口最多 3-5 个方法

```go
// ✅ 正确：在 service 包定义 repository 接口
// internal/service/user.go
type UserRepository interface {
    FindByID(ctx context.Context, id int64) (*User, error)
    Save(ctx context.Context, user *User) error
}

// internal/repository/user_repo.go 实现上面的接口（不引用接口定义）
```

### 依赖注入

构造函数接收接口，不接收具体类型：

```go
// ✅
type UserService struct {
    repo UserRepository
    log  *slog.Logger
}

func NewUserService(repo UserRepository, log *slog.Logger) *UserService {
    return &UserService{repo: repo, log: log}
}
```

---

## 日志规范

使用标准库 `log/slog`，结构化日志：

```go
import "log/slog"

// 初始化（main.go 或 bootstrap）
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelInfo,
}))
slog.SetDefault(logger)

// 使用
slog.InfoContext(ctx, "user_created",
    slog.Int64("user_id", user.ID),
    slog.String("email", user.Email),
)

slog.ErrorContext(ctx, "db_query_failed",
    slog.String("query", "FindByID"),
    slog.Int64("id", id),
    slog.String("error", err.Error()),
)
```

**规则**：
- `action` 作为第一个参数（动词_名词格式），如 `"user_created"`, `"order_failed"`
- 关键业务事件必须 INFO 日志
- 错误必须 ERROR 日志，带 error 字段
- 禁止 `fmt.Println` 调试日志

---

## 上下文（Context）

```go
// ✅ 函数第一个参数必须是 ctx
func (s *UserService) Create(ctx context.Context, req CreateUserReq) (*User, error)

// ✅ 传递 ctx 给所有下游调用
user, err := s.repo.FindByID(ctx, req.ID)

// ❌ 不要用 context.Background() 在业务代码深层
// 只在程序入口/顶层使用 context.Background()
```

---

## 代码组织

### 包大小控制

- 一个包专注一个业务领域
- 文件超过 500 行考虑拆分
- 禁止循环依赖

### 函数长度

- 单函数不超过 60 行（超出说明职责不单一）
- 嵌套层级不超过 4 层

### 注释

```go
// UserService 处理用户核心业务逻辑。
// 依赖 UserRepository 接口，支持 Mock。
type UserService struct { ... }

// CreateUser 创建用户，邮箱唯一性由数据库约束保证。
// 返回 ErrEmailDuplicated 当邮箱已存在。
func (s *UserService) CreateUser(ctx context.Context, req CreateUserReq) (*User, error) { ... }
```

规则：导出类型和函数必须有注释，内部函数只在逻辑不直观时注释。

---

## HTTP Handler 规范（Gin）

```go
// handler/user.go
func (h *UserHandler) CreateUser(c *gin.Context) {
    var req CreateUserReq
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
        return
    }

    user, err := h.svc.Create(c.Request.Context(), req)
    if err != nil {
        if errors.Is(err, service.ErrEmailDuplicated) {
            c.JSON(http.StatusConflict, ErrorResponse{Error: "邮箱已存在"})
            return
        }
        slog.ErrorContext(c.Request.Context(), "create_user_failed", slog.String("error", err.Error()))
        c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "内部错误"})
        return
    }

    c.JSON(http.StatusCreated, user)
}
```

**规则**：
- Handler 只做：绑定请求、调用 Service、返回响应，不含业务逻辑
- 错误响应统一格式：`{"error": "描述"}`
- HTTP 状态码语义正确：200/201/400/401/403/404/409/500
- 所有 Handler 从 `c.Request.Context()` 传 ctx

---

## 响应结构

```go
// 统一错误响应
type ErrorResponse struct {
    Error string `json:"error"`
}

// 分页响应
type PageResponse[T any] struct {
    Items []T  `json:"items"`
    Total int  `json:"total"`
    Page  int  `json:"page"`
    Size  int  `json:"size"`
}
```

---

## Goroutine 安全

```go
// ✅ 启动 goroutine 必须处理 panic
go func() {
    defer func() {
        if r := recover(); r != nil {
            slog.Error("goroutine_panic", slog.Any("recover", r))
        }
    }()
    // 业务逻辑
}()

// ✅ 使用 errgroup 处理并发任务
g, ctx := errgroup.WithContext(ctx)
g.Go(func() error {
    return fetchUserData(ctx)
})
g.Go(func() error {
    return fetchOrderData(ctx)
})
if err := g.Wait(); err != nil {
    return fmt.Errorf("parallel_fetch: %w", err)
}
```
