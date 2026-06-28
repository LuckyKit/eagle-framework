# Python 代码风格规范

## 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 函数/变量 | snake_case | `get_user_by_id`, `max_retries` |
| 类名 | PascalCase | `UserService`, `OrderRepository` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT`, `MAX_PAGE_SIZE` |
| 私有成员 | `_` 前缀 | `_parse_token()`, `_validate_email()` |
| 模块/文件名 | snake_case | `user_service.py`, `order_repository.py` |
| 测试函数 | `test_{function}_{scenario}` | `test_create_user_duplicate_email` |

```python
# ✅ 正确
MAX_RETRY_COUNT = 3

class UserAuthenticator:
    def __init__(self, db_session: AsyncSession) -> None:
        self._session = db_session  # 私有属性

    def authenticate(self, email: str, password: str) -> User | None:
        token = self._generate_token(email)
        return self._find_user(email)

    def _generate_token(self, email: str) -> str:
        ...

# ❌ 错误
class userAuth:            # 类名应为 PascalCase
    def Authenticate(...):  # 函数名应为 snake_case
```

---

## 类型标注

### 强制规则

1. **所有函数签名必须有类型标注**，包括参数和返回值
2. **使用 `|` 表示 Union**（Python 3.10+），不必显式写 `Union`
3. **`Optional[T]` 仅在语义上 T 确实为"可选"时使用**，等价于 `T | None`
4. **禁用 `typing.Any`**，除非确实无法推断类型；用 `object` 或具体类型替代

```python
from datetime import datetime

# ✅ 正确：完整类型标注
async def find_user(
    user_id: int,
    include_deleted: bool = False,
) -> User | None:
    ...

def format_date(dt: datetime, fmt: str = "%Y-%m-%d") -> str:
    ...

def paginate(items: list[dict[str, object]], page: int, size: int) -> PageResponse:
    ...

# ❌ 错误：缺少类型标注
def find_user(user_id):          # 无参数类型
    ...

def process(data) -> dict:       # data 无类型
    ...
```

### 复杂类型

```python
from collections.abc import Sequence, Mapping
from typing import TypeVar

T = TypeVar("T")

# 泛型分页响应
class PageResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int

# 灵活的输入类型
def batch_create(users: Sequence[CreateUserReq]) -> list[User]:
    ...
```

---

## Pydantic 模型

### 模型定义

```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime

class CreateUserReq(BaseModel):
    """创建用户请求体"""
    email: str = Field(..., max_length=255, pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="member", pattern=r"^(admin|member|viewer)$")
    tags: list[str] = Field(default_factory=list)

    @field_validator("email")
    @classmethod
    def email_must_be_valid(cls, v: str) -> str:
        if " " in v:
            raise ValueError("邮箱地址不能包含空格")
        return v.strip().lower()

class UserResponse(BaseModel):
    """用户响应体"""
    id: int
    email: str
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}  # 启用 ORM 模式
```

### 规则

- **请求/响应都用 Pydantic 模型**，不裸用 `dict`
- 用 `model_config = {"from_attributes": True}`，不用已废弃的 `class Config: orm_mode = True`
- 用 `model_validate(obj)` 构造模型实例，不用已废弃的 `from_orm()`
- `Field()` 优先提供约束：`min_length` / `max_length` / `pattern` / `ge` / `le`
- 必填字段用 `Field(...)`（`...` 即 `Ellipsis`），可选字段给 `default`

```python
# ✅ 正确
user = UserResponse.model_validate(db_user)

# ❌ 错误
user = UserResponse.from_orm(db_user)  # 已废弃
```

---

## Async/Await

### FastAPI 端点

所有 IO 密集型端点定义为 `async def`，数据库/HTTP/文件操作必须 `await`。

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    req: CreateUserReq,
    session: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await user_service.create(session, req)
    return UserResponse.model_validate(user)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    session: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await user_service.find_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserResponse.model_validate(user)
```

### 数据库会话

```python
# ✅ 使用异步 SQLAlchemy
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# Repository 层
class UserRepository:
    async def find_by_email(self, session: AsyncSession, email: str) -> User | None:
        stmt = select(UserModel).where(UserModel.email == email)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

# ❌ 错误：同步 IO 在异步上下文中
def find_user(email: str):           # 缺少 async
    return session.query(UserModel).filter(...).first()  # 同步查询
```

### 并发请求

```python
import asyncio

async def fetch_order_details(order_id: int) -> OrderDetail:
    user_task = asyncio.create_task(user_service.get_user(user_id))
    items_task = asyncio.create_task(order_service.get_items(order_id))
    user, items = await user_task, await items_task  # 并发执行
    ...
```

---

## 错误处理

### 自定义异常层级

```python
# app/exceptions.py

class AppError(Exception):
    """应用基类异常"""
    def __init__(self, message: str, code: str = "INTERNAL_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)

class NotFoundError(AppError):
    def __init__(self, resource: str, identifier: object) -> None:
        super().__init__(
            message=f"{resource} 不存在: {identifier}",
            code="NOT_FOUND",
        )

class DuplicateError(AppError):
    def __init__(self, field: str, value: object) -> None:
        super().__init__(
            message=f"{field} 已存在: {value}",
            code="DUPLICATE",
        )

class UnauthorizedError(AppError):
    def __init__(self, message: str = "未授权访问") -> None:
        super().__init__(message=message, code="UNAUTHORIZED")
```

### FastAPI 异常处理器

```python
# app/handlers.py
from fastapi import Request
from fastapi.responses import JSONResponse

async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=_http_status(exc.code),
        content={"error": exc.message, "code": exc.code},
    )

def _http_status(code: str) -> int:
    return {
        "NOT_FOUND": 404,
        "DUPLICATE": 409,
        "UNAUTHORIZED": 401,
        "FORBIDDEN": 403,
        "VALIDATION": 422,
    }.get(code, 500)

# main.py 中注册
app.add_exception_handler(AppError, app_error_handler)
```

### HTTPException 使用

```python
from fastapi import HTTPException

# ✅ 仅在无法用自定义异常时使用 HTTPException
# 例如：FastAPI 中间件、依赖注入守卫
async def verify_token(token: str = Header(...)) -> dict[str, object]:
    if not token:
        raise HTTPException(status_code=401, detail="缺少认证令牌")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="无效令牌")
    return payload
```

### 规则

- **不裸用 `except Exception`**，捕获具体的异常类型
- **不要静默吞异常**，至少记录日志
- 业务逻辑抛自定义异常，HTTP 层通过异常处理器统一转换
- `try` 块范围尽量小，只包裹可能异常的代码

```python
# ✅ 正确
try:
    user = await repo.find_by_email(session, email)
except IntegrityError as e:
    logger.error("duplicate_email", email=email, error=str(e))
    raise DuplicateError("email", email) from e

# ❌ 错误
try:
    do_everything()
except Exception:   # 裸 except，吞掉所有异常
    pass
```

---

## 结构化日志

使用 `structlog`，键值对形式，禁止 `print()`。

```python
# app/logging.py
import structlog

def setup_logging() -> None:
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.dev.ConsoleRenderer(),  # 开发环境；生产用 JSONRenderer
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

logger = structlog.get_logger()
```

### 使用方式

```python
# ✅ 正确：结构化键值对
logger.info("user_created", user_id=user.id, email=user.email, role=user.role)
logger.error("db_query_failed", query="find_by_email", email=email, error=str(e))

# 绑定上下文
log = logger.bind(request_id=request_id)
log.info("request_started", path=path, method=method)

# ❌ 错误：print 调试
print(f"user created: {user.id}")    # 不允许
logger.info(f"user created: {user.id}")  # 不允许 f-string message

# ❌ 错误：message 不允许 f-string，结构化数据应作为键值对
logger.info(f"user {user.id} created")  # 不允许
```

### 规则

- `event`（第一个位置参数）用 snake_case 动作描述，如 `"user_created"`, `"payment_failed"`
- 关键业务操作必须记录 INFO 日志（创建/更新/删除）
- 所有错误必须记录 ERROR 日志，附带 `error=str(e)`
- 第二个参数开始全部用 `key=value` 键值对
- 开发环境用 `ConsoleRenderer`，生产环境用 `JSONRenderer`
- **禁止 `print()` 和 `logging` 模块**

---

## 依赖注入

### FastAPI Depends 模式

```python
# app/dependencies.py
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

def get_user_service(
    session: AsyncSession = Depends(get_db),
) -> UserService:
    return UserService(UserRepository(session))

def get_auth_service(
    session: AsyncSession = Depends(get_db),
) -> AuthService:
    return AuthService(UserRepository(session), token_secret=settings.TOKEN_SECRET)
```

### Service / Repository 分层

```python
# app/repositories/user_repo.py
class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_email(self, email: str) -> User | None:
        stmt = select(UserModel).where(UserModel.email == email)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, user: UserModel) -> User:
        self._session.add(user)
        await self._session.flush()
        return user

# app/services/user_service.py
class UserService:
    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    async def create_user(self, req: CreateUserReq) -> User:
        existing = await self._repo.find_by_email(req.email)
        if existing:
            raise DuplicateError("email", req.email)
        user = UserModel(email=req.email, name=req.name)
        return await self._repo.create(user)
```

### 规则

- 构造函数接收依赖，不自行创建
- `Depends()` 用于组装对象图，不用于在 Service 内部调用
- Repository 只做数据访问，Service 做业务逻辑，Router 只做请求调度
- 单例服务（如配置读取器）通过 `lru_cache` 或模块级变量实现

---

## 导入排序

严格遵守三段式导入顺序，每段之间空一行：

1. **标准库** — `os`, `json`, `datetime`, `typing`, `asyncio`, `collections.abc`
2. **第三方库** — `fastapi`, `sqlalchemy`, `pydantic`, `structlog`, `httpx`
3. **内部模块** — 以 `app.` 开头

```python
# ✅ 正确
import asyncio
from datetime import datetime, timezone
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from app.core.config import settings
from app.models.user import UserModel
from app.schemas.user import CreateUserReq, UserResponse
from app.services.user_service import UserService

# ❌ 错误：顺序混乱
from app.services.user_service import UserService
from fastapi import APIRouter   # 第三方应在前
import asyncio                  # 标准库应在最前
from app.models.user import UserModel
```

### 规则

- 用 `isort` 自动排序，配置 `profile = "black"`
- 禁止 `from module import *`
- 导入具体名称优于导入整个模块，除非模块名本身即是含义清晰的命名空间

---

## 函数与方法长度

- **单个函数/方法不超过 50 行**（不含 docstring 和装饰器）
- 超出说明职责不单一，应拆分为更小的私有方法
- **嵌套层级不超过 4 层**

```python
# ✅ 正确：拆分职责
async def create_user(
    self, session: AsyncSession, req: CreateUserReq
) -> User:
    await self._validate_no_duplicate(session, req.email)
    user = self._build_user_model(req)
    await self._save_user(session, user)
    await self._send_welcome_email(user)
    logger.info("user_created", user_id=user.id, email=user.email)
    return user

# ❌ 错误：一个函数做太多事，超过 50 行
async def create_user(self, session, req):
    # 验证、构建、保存、发邮件、记录日志全部写在一个函数里
    ...
```

---

## API 端点风格

### Router 组织

```python
# app/routers/users.py
from fastapi import APIRouter, Depends, Path, Query, status

router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"],
)

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建用户",
)
async def create_user(
    req: CreateUserReq,
    session: AsyncSession = Depends(get_db),
    svc: UserService = Depends(get_user_service),
) -> UserResponse:
    """创建新用户，邮箱必须唯一。"""
    user = await svc.create_user(session, req)
    return UserResponse.model_validate(user)

@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="获取用户详情",
)
async def get_user(
    user_id: int = Path(..., ge=1, description="用户ID"),
    session: AsyncSession = Depends(get_db),
    svc: UserService = Depends(get_user_service),
) -> UserResponse:
    user = await svc.find_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserResponse.model_validate(user)

@router.get(
    "/",
    response_model=PageResponse[UserResponse],
    summary="分页查询用户列表",
)
async def list_users(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
    svc: UserService = Depends(get_user_service),
) -> PageResponse[UserResponse]:
    users, total = await svc.list_paginated(session, page, size)
    return PageResponse(items=users, total=total, page=page, size=size)
```

### 规则

- 使用 `APIRouter` 按资源/领域拆分路由文件
- 每个端点指定 `response_model` 和 `status_code`
- 路径参数用 `Path()`，查询参数用 `Query()`，均提供描述和校验
- `Path(..., ge=1)` 中的 `...` 表示必填
- 端点要写 `summary` 和 docstring（用于自动生成 OpenAPI 文档）
- HTTP 方法语义正确：GET 查询、POST 创建、PUT 全量更新、PATCH 部分更新、DELETE 删除

---

## 配置管理

### pydantic-settings

```python
# app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """应用配置，自动从 .env 文件和环境变量加载"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # 应用
    APP_NAME: str = "MyApp"
    APP_ENV: str = "development"  # development | staging | production
    DEBUG: bool = False

    # 数据库
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/mydb"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10

    # 认证
    TOKEN_SECRET: str = "change-me-in-production"
    TOKEN_EXPIRE_MINUTES: int = 60

    # 外部服务
    REDIS_URL: str = "redis://localhost:6379/0"
    S3_ENDPOINT: str | None = None

settings = Settings()
```

### 规则

- 所有环境变量大写，用 `Field` 或类型默认值提供默认值
- 敏感配置不设默认值，启动时缺失则抛错
- 区分 `development` / `staging` / `production` 环境
- 配置由 `settings` 模块级单例统一访问，不在各处重复 `os.getenv()`
- `.env` 文件不入库，提供 `.env.example` 模板

---

## 反模式

以下是 Python/FastAPI 项目中常见的错误做法：

### 1. 同步 IO 在异步上下文

```python
# ❌ 错误：在 async 函数中调用同步阻塞操作
async def get_user(user_id: int):
    time.sleep(1)                              # 同步 sleep
    user = session.query(User).filter(...).first()  # 同步 ORM
    data = requests.get("https://api.example.com")  # 同步 HTTP
    return user

# ✅ 正确
async def get_user(user_id: int):
    await asyncio.sleep(1)
    user = await repo.find_by_id(session, user_id)  # 异步 ORM
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://api.example.com")
    return user
```

### 2. 裸异常捕获

```python
# ❌ 错误
try:
    await do_something()
except:              # 裸 except，吞掉包括 KeyboardInterrupt 在内的所有异常
    pass

# ✅ 正确
try:
    await do_something()
except ValueError as e:
    logger.error("invalid_value", error=str(e))
    raise AppError("处理失败") from e
```

### 3. 不用 Pydantic 校验输入

```python
# ❌ 错误：裸 dict
@router.post("/users")
async def create_user(data: dict):   # 无校验
    name = data.get("name")
    ...

# ✅ 正确
@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(req: CreateUserReq):  # Pydantic 模型自动校验
    ...
```

### 4. 直接在端点写业务逻辑

```python
# ❌ 错误：业务逻辑混在 Router 里
@router.post("/users")
async def create_user(req: CreateUserReq, session: AsyncSession = Depends(get_db)):
    existing = await session.execute(select(UserModel).where(UserModel.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="邮箱已存在")
    user = UserModel(email=req.email, name=req.name)
    session.add(user)
    await session.commit()
    return user

# ✅ 正确：Router 只做调度，业务在 Service
@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    req: CreateUserReq,
    svc: UserService = Depends(get_user_service),
) -> UserResponse:
    user = await svc.create_user(req)
    return UserResponse.model_validate(user)
```

### 5. 硬编码配置

```python
# ❌ 错误
TOKEN_SECRET = "my-secret-key"

# ✅ 正确
from app.core.config import settings
secret = settings.TOKEN_SECRET
```

### 6. 用 `from_orm` / `orm_mode`

```python
# ❌ 错误：已废弃的 API
class UserResponse(BaseModel):
    class Config:
        orm_mode = True

user = UserResponse.from_orm(db_user)

# ✅ 正确
class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

user = UserResponse.model_validate(db_user)
```

### 7. 不处理数据库会话异常

```python
# ❌ 错误：commit 失败不回滚
async def get_db():
    session = AsyncSessionLocal()
    yield session
    await session.commit()

# ✅ 正确：异常时回滚
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```
