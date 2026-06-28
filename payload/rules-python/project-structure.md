# Python 项目结构规范

## 目录布局

```
backend/
├── app/
│   ├── main.py                ← FastAPI 应用入口，lifespan 事件
│   ├── api/                   ← 路由处理器（routers）
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── router.py      ← v1 路由聚合
│   │   │   ├── users.py       ← /users 端点
│   │   │   └── orders.py      ← /orders 端点
│   │   └── deps.py            ← 共享依赖项（get_db, get_current_user）
│   ├── services/              ← 业务逻辑层
│   │   ├── __init__.py
│   │   ├── user_service.py
│   │   └── order_service.py
│   ├── repositories/          ← 数据访问层（SQLAlchemy 查询）
│   │   ├── __init__.py
│   │   ├── user_repo.py
│   │   └── order_repo.py
│   ├── models/                ← SQLAlchemy ORM 模型
│   │   ├── __init__.py
│   │   ├── base.py            ← DeclarativeBase + Mixin
│   │   ├── user.py
│   │   └── order.py
│   ├── schemas/               ← Pydantic 请求/响应模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── common.py          ← PageResponse, ErrorResponse, SortOrder
│   ├── core/                  ← 应用配置、安全、异常、日志
│   │   ├── __init__.py
│   │   ├── config.py          ← pydantic-settings Settings
│   │   ├── security.py        ← JWT 生成/校验、密码哈希
│   │   ├── exceptions.py      ← 自定义异常类
│   │   └── logging.py         ← structlog 配置
│   └── db/
│       ├── __init__.py
│       ├── session.py         ← async engine + async session factory
│       └── base.py            ← DeclarativeBase 定义
├── alembic/
│   ├── versions/
│   └── env.py
├── tests/
│   ├── conftest.py            ← fixtures（async client, test DB）
│   ├── test_users.py
│   └── test_orders.py
├── alembic.ini
├── pyproject.toml
├── Dockerfile
└── .env.example
```

---

## 分层职责

### 1. API 层（Router）

**职责**：HTTP 协议适配 —— 请求解析、状态码返回、响应序列化。不含业务逻辑。

```python
# app/api/v1/users.py
from fastapi import APIRouter, Depends, status
from app.schemas.user import UserCreate, UserResponse
from app.services.user_service import UserService
from app.api.deps import get_user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    svc: UserService = Depends(get_user_service),
) -> UserResponse:
    user = await svc.create_user(body)
    return UserResponse.model_validate(user)
```

**禁止**：API 层不写数据库查询、不含业务规则、不直接操作 ORM 模型。

### 2. Service 层

**职责**：业务规则、事务协调、跨资源操作编排。返回领域对象，抛出语义化异常。

```python
# app/services/user_service.py
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserCreate
from app.models.user import User
from app.core.exceptions import ConflictException


class UserService:
    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    async def create_user(self, req: UserCreate) -> User:
        existing = await self._repo.find_by_email(req.email)
        if existing is not None:
            raise ConflictException("邮箱已注册")
        user = User(email=req.email, name=req.name)
        return await self._repo.save(user)
```

**禁止**：Service 层不接收 HTTP 请求对象（Request）、不返回 Response 对象。

### 3. Repository 层

**职责**：数据库 CRUD，SQLAlchemy 查询，将 DB 错误转换为应用异常。

```python
# app/repositories/user_repo.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def save(self, user: User) -> User:
        self._session.add(user)
        await self._session.flush()
        await self._session.refresh(user)
        return user
```

### 4. Models 层

**职责**：纯数据结构，SQLAlchemy ORM 模型定义。不含业务逻辑。

```python
# app/models/user.py
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

### 5. Schemas 层

**职责**：Pydantic 请求/响应模型，输入校验和输出序列化。

```python
# app/schemas/user.py
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="邮箱")
    name: str = Field(..., min_length=1, max_length=100, description="用户名")
    password: str = Field(..., min_length=8, max_length=128, description="密码")


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
```

```python
# app/schemas/common.py
from pydantic import BaseModel


class PageResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None
```

---

## 依赖注入

使用 FastAPI `Depends()` 手动构建链式依赖，不引入第三方 DI 容器。

```python
# app/api/deps.py
from collections.abc import AsyncGenerator
from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session_factory
from app.repositories.user_repo import UserRepository
from app.services.user_service import UserService
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """每个请求创建一个独立的数据库会话。"""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = authorization.removeprefix("Bearer ")
    payload = decode_access_token(token)
    if payload is None:
        raise UnauthorizedException("无效的访问令牌")
    user = await db.get(User, payload.sub)
    if user is None:
        raise UnauthorizedException("用户不存在")
    return user


def get_user_repo(db: AsyncSession = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_user_service(repo: UserRepository = Depends(get_user_repo)) -> UserService:
    return UserService(repo)
```

**规则**：
- `get_db` 创建 session，commit/rollback 由 deps 统一管控
- `get_current_user` 做认证，返回 ORM 对象供后续 handler 使用
- Repository → Service 的构建也通过 `Depends` 串联，不在 handler 内手动 new

---

## API 版本化

使用 URL 前缀 `/api/v1/` 进行版本隔离，通过嵌套 router 聚合。

```python
# app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1 import users, orders

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(users.router)
v1_router.include_router(orders.router)
```

```python
# app/api/v1/users.py
from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["users"])
# endpoint 最终路径：/api/v1/users
```

```python
# app/main.py
from fastapi import FastAPI
from app.api.v1.router import v1_router

app = FastAPI()
app.include_router(v1_router)
```

**原则**：
- 破坏性变更必须走新版本（`v2/`），不可直接改 `v1/`
- 新增兼容字段可以在当前版本直接扩展
- 路由 prefix 在 router 层定义，不在 `app.include_router()` 上硬编码

---

## 配置管理

使用 `pydantic-settings` 从环境变量和 `.env` 文件加载。

```python
# app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # 服务器
    server_host: str = "0.0.0.0"
    server_port: int = 8000
    debug: bool = False

    # 数据库
    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/dbname"

    # JWT
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60


settings = Settings()
```

**规则**：
- 所有配置从环境变量或 `.env` 读取，不在代码中硬编码
- 敏感值（密钥、密码）只从环境变量读取，`.env.example` 只记录 key 不填值
- `.env` 文件加入 `.gitignore`，不提交到仓库
- 使用全局单例 `settings`，模块直接 `from app.core.config import settings` 引用

---

## 数据库

使用 SQLAlchemy 2.0 异步模式，会话由 async session factory 管理。

### 引擎与会话

```python
# app/db/session.py
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=20,
    max_overflow=10,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

### 基础模型

```python
# app/db/base.py
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""
    pass
```

### Alembic 迁移约定

```ini
# alembic.ini（关键配置）
[alembic]
script_location = alembic
sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic
```

```python
# alembic/env.py（关键修改）
from app.db.base import Base
from app.models import *  # 确保所有模型被导入，autogenerate 才能检测到

target_metadata = Base.metadata
```

**迁移命令**：

```bash
# 生成迁移
alembic revision --autogenerate -m "create_users_table"

# 执行迁移
alembic upgrade head

# 回滚一步
alembic downgrade -1
```

**规则**：
- 迁移文件按顺序编号，不手动编辑已提交的 migration
- 部署时 `alembic upgrade head` 作为容器启动命令之一执行
- `Base.metadata` 不用于生产建表，仅用于 autogenerate 参考

---

## 测试

### conftest.py 共享 fixtures

```python
# tests/conftest.py
import asyncio
from collections.abc import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.db.base import Base
from app.main import app

TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost:5433/test_db"


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def async_client(engine) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
```

### 测试用例

```python
# tests/test_users.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_user(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/users/",
        json={"email": "test@example.com", "name": "Test", "password": "secret123"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test"
    assert "password" not in data
```

**规则**：
- 使用 `httpx.AsyncClient` + `ASGITransport` 测试 FastAPI，无需启动真实服务器
- 每个测试后自动 rollback，保证测试之间数据隔离
- 不 mock 数据库 —— 使用独立测试数据库
- `scope="session"` 的 fixtures 用于 engine（整个测试会话复用一次建表）

---

## 文件命名

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 模块文件 | `snake_case` | `user_service.py`, `order_repo.py` |
| 模型文件 | `snake_case`，单数 | `user.py`, `order_item.py` |
| Schema 文件 | `snake_case`，单数 | `user.py`, `common.py` |
| 测试文件 | `test_` 前缀 + 被测模块 | `test_users.py`, `test_orders.py` |
| Package 目录 | 全小写，复数为主 | `services/`, `repositories/`, `models/` |
| 类名 | PascalCase | `UserService`, `UserRepository`, `UserCreate` |
| 函数/方法 | `snake_case` | `create_user()`, `find_by_email()` |
| 私有方法 | 下划线前缀 | `_build_query()`, `_hash_password()` |

---

## 模块依赖规则

```
api → service → repository → models
         ↘ schemas（仅类型引用）
```

```
┌──────────┐
│  schemas  │  ← 纯类型定义，不依赖任何其他层
└──────────┘
┌──────────┐
│  models   │  ← 纯 ORM 定义，不依赖业务层
└──────────┘
┌──────────────┐
│  repository  │  ← 只依赖 models + db session
└──────────────┘
┌───────────┐
│  service  │  ← 只依赖 repository + models + schemas
└───────────┘
┌───────┐
│  api  │  ← 只依赖 service + schemas（通过 Depends 注入）
└───────┘
┌──────┐
│ core  │  ← 被所有层引用，自身不依赖任何业务层
└──────┘
```

**硬性规则**：

1. **api 不动 ORM 模型** —— handler 只接收 schema 输入、返回 schema 输出，不直接操作 `models.User`
2. **service 不动 HTTP 概念** —— 不引用 `Request`、`Response`、`Header`、`Depends`
3. **repository 不动业务规则** —— 只做 CRUD，不判断"是否允许创建"
4. **models 不动验证逻辑** —— 只定义表结构，不做输入校验
5. **禁止循环导入** —— 如果 `users.py` import `orders.py`，则 `orders.py` 不可 import `users.py`
6. **core 层单向引用** —— `core/` 中的安全、配置、异常模块可被任意层导入，但它们之间不可互相依赖
