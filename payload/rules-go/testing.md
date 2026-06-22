# Go 测试规范

## 工具栈

- `testing`（标准库）
- `github.com/stretchr/testify/assert` — 断言
- `github.com/stretchr/testify/mock` — Mock
- `github.com/stretchr/testify/require` — 致命断言（失败立即停止）

---

## 表驱动测试（Table-Driven Tests）

**所有含多个场景的测试必须用表驱动写法**：

```go
func TestCreateUser(t *testing.T) {
    tests := []struct {
        name    string
        req     CreateUserReq
        mockFn  func(*MockUserRepository)
        wantErr error
    }{
        {
            name: "success",
            req:  CreateUserReq{Email: "a@b.com", Name: "Alice"},
            mockFn: func(m *MockUserRepository) {
                m.On("FindByEmail", mock.Anything, "a@b.com").Return(nil, ErrNotFound)
                m.On("Save", mock.Anything, mock.AnythingOfType("*domain.User")).Return(nil)
            },
            wantErr: nil,
        },
        {
            name: "duplicate_email",
            req:  CreateUserReq{Email: "dup@b.com", Name: "Bob"},
            mockFn: func(m *MockUserRepository) {
                m.On("FindByEmail", mock.Anything, "dup@b.com").Return(&domain.User{}, nil)
            },
            wantErr: ErrEmailDuplicated,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            repo := new(MockUserRepository)
            tt.mockFn(repo)

            svc := NewUserService(repo, slog.Default())
            _, err := svc.CreateUser(context.Background(), tt.req)

            if tt.wantErr != nil {
                assert.ErrorIs(t, err, tt.wantErr)
            } else {
                require.NoError(t, err)
            }
            repo.AssertExpectations(t)
        })
    }
}
```

---

## Mock 规范（testify/mock）

**Mock 定义放在 `_test.go` 文件里**（或单独 `mocks/` 包）：

```go
// internal/service/mocks_test.go
type MockUserRepository struct {
    mock.Mock
}

func (m *MockUserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
    args := m.Called(ctx, email)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepository) Save(ctx context.Context, user *domain.User) error {
    args := m.Called(ctx, user)
    return args.Error(0)
}
```

**规则**：
- Mock 实现接口的所有方法
- 每个测试结束调 `repo.AssertExpectations(t)` 验证调用
- 用 `mock.Anything` 匹配不关心的参数，关键参数要精确匹配

---

## 文件命名规范

```
internal/service/
├── user.go              ← 实现
├── user_test.go         ← 单元测试（同包）
├── user_integration_test.go  ← 集成测试
└── mocks_test.go        ← Mock 定义
```

**规则**：
- 单元测试与被测文件同包（可访问私有函数）
- 集成测试用 `_integration_test.go` 后缀，需要真实依赖

---

## HTTP Handler 测试

```go
func TestUserHandler_CreateUser(t *testing.T) {
    tests := []struct {
        name       string
        body       string
        mockFn     func(*MockUserService)
        wantStatus int
    }{
        {
            name: "success",
            body: `{"email":"a@b.com","name":"Alice"}`,
            mockFn: func(m *MockUserService) {
                m.On("CreateUser", mock.Anything, mock.AnythingOfType("CreateUserReq")).
                    Return(&domain.User{ID: 1, Email: "a@b.com"}, nil)
            },
            wantStatus: http.StatusCreated,
        },
        {
            name:       "invalid_json",
            body:       `{invalid}`,
            mockFn:     func(m *MockUserService) {},
            wantStatus: http.StatusBadRequest,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            svc := new(MockUserService)
            tt.mockFn(svc)

            h := NewUserHandler(svc)
            r := gin.New()
            r.POST("/users", h.CreateUser)

            req := httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(tt.body))
            req.Header.Set("Content-Type", "application/json")
            w := httptest.NewRecorder()

            r.ServeHTTP(w, req)

            assert.Equal(t, tt.wantStatus, w.Code)
            svc.AssertExpectations(t)
        })
    }
}
```

---

## 集成测试（数据库）

```go
// 使用 testcontainers-go 或固定 test DB
func TestUserRepository_Save(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }

    db := setupTestDB(t)  // 连接测试数据库，运行 migration
    repo := NewUserRepository(db)

    user := &domain.User{Email: "test@example.com", Name: "Test"}
    err := repo.Save(context.Background(), user)
    require.NoError(t, err)
    assert.NotZero(t, user.ID)

    found, err := repo.FindByEmail(context.Background(), "test@example.com")
    require.NoError(t, err)
    assert.Equal(t, user.ID, found.ID)
}
```

---

## 覆盖率要求

```bash
# 运行测试 + 生成覆盖率报告
go test ./... -race -coverprofile=coverage.out
go tool cover -html=coverage.out

# CI 最低覆盖率
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out | grep total | awk '{print $3}'
# 目标：核心 service/ 层 ≥ 80%
```

---

## 测试命名约定

```go
// 格式：Test{函数名}_{场景}
func TestCreateUser_Success(t *testing.T) {}
func TestCreateUser_DuplicateEmail(t *testing.T) {}
func TestCreateUser_InvalidEmail(t *testing.T) {}

// 子测试（表驱动）的 name 字段使用 snake_case
{ name: "success" }
{ name: "duplicate_email" }
{ name: "missing_required_field" }
```

---

## 禁止的写法

```go
// ❌ 不用 if 检查错误，用 require
if err != nil {
    t.Fatal(err)
}
// ✅
require.NoError(t, err)

// ❌ 不用 == 比较
if got != want {
    t.Errorf(...)
}
// ✅
assert.Equal(t, want, got)

// ❌ 测试间共享状态
var globalDB *sqlx.DB  // 全局测试状态导致测试污染
// ✅ 每个测试独立 setup
```
