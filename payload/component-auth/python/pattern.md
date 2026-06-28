# Auth — Python/FastAPI 后端实现模式

---

## 目录结构

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── auth.py              ← 登录/刷新/登出/当前用户 路由
│   ├── core/
│   │   ├── config.py                ← Settings（SECRET_KEY, JWT 过期时间等）
│   │   └── security.py              ← JWT 签发/验证 + 密码哈希 + 认证依赖
│   ├── models/
│   │   └── user.py                  ← SQLAlchemy User 模型
│   ├── schemas/
│   │   └── auth.py                  ← Pydantic 请求/响应模型
│   ├── services/
│   │   └── auth.py                  ← AuthService（业务逻辑层）
│   ├── db/
│   │   └── session.py               ← 数据库会话（get_db 依赖）
│   └── main.py                      ← FastAPI 应用入口 + 中间件注册
```

---

## 配置

```python
# app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # JWT
    SECRET_KEY: str          # openssl rand -hex 32
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # bcrypt
    BCRYPT_ROUNDS: int = 12

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 核心实现模式

### JWT 签发/验证

```python
# app/core/security.py
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.core.config import settings

ALGORITHM = settings.ALGORITHM

def create_access_token(user_id: str, email: str) -> str:
    """签发 access_token，有效期 1 小时"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(user_id: str, email: str) -> tuple[str, str, datetime]:
    """签发 refresh_token，有效期 7 天，返回 (token, jti, expires_at)"""
    import uuid
    jti = uuid.uuid4().hex
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": jti,
        "type": "refresh",
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)
    return token, jti, expire

def decode_token(token: str) -> dict | None:
    """验证并解码 token，失败返回 None"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
```

### 密码哈希

```python
# app/core/security.py (续)
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    """对明文密码做 bcrypt 哈希"""
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    """验证明文与哈希是否匹配"""
    return pwd_context.verify(plain, hashed)
```

### 用户模型

```python
# app/models/user.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

### Pydantic Schema

```python
# app/schemas/auth.py
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginResponse(TokenResponse):
    expires_in: int
    user: "UserOut"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str

    class Config:
        from_attributes = True
```

### Service 层

```python
# app/services/auth.py
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, RefreshToken
from app.core.security import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, verify_password,
)
from app.core.config import settings

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, email: str, password: str, name: str) -> User:
        email = email.lower().strip()

        from sqlalchemy import select
        existing = await self.db.scalar(select(User).where(User.email == email))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="email already exists",
            )

        user = User(
            email=email,
            name=name,
            hashed_password=hash_password(password),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def login(self, email: str, password: str) -> dict:
        email = email.lower().strip()

        from sqlalchemy import select
        user = await self.db.scalar(select(User).where(User.email == email))
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid credentials",  # 不区分"邮箱不存在"和"密码错误"
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="user account is disabled",
            )

        return await self._issue_tokens(user)

    async def refresh(self, refresh_token_str: str) -> dict:
        payload = decode_token(refresh_token_str)
        if payload is None or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid refresh token",
            )

        jti = payload.get("jti")

        from sqlalchemy import select
        stored = await self.db.scalar(
            select(RefreshToken).where(RefreshToken.jti == jti)
        )
        if stored is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="refresh token revoked",
            )

        # Token Rotation：删除旧的 refresh_token，签发一对新的
        await self.db.delete(stored)
        await self.db.commit()

        user = await self.db.scalar(
            select(User).where(User.id == payload["sub"])
        )
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="user not found",
            )

        return await self._issue_tokens(user)

    async def logout(self, refresh_token_str: str) -> None:
        payload = decode_token(refresh_token_str)
        if payload is None:
            return  # token 无效不算错误，登出是幂等的

        jti = payload.get("jti")
        from sqlalchemy import select, delete
        stored = await self.db.scalar(
            select(RefreshToken).where(RefreshToken.jti == jti)
        )
        if stored:
            await self.db.delete(stored)
            await self.db.commit()

    async def _issue_tokens(self, user: User) -> dict:
        """签发 access + refresh token，将 refresh 的 jti 写入数据库"""
        access_token = create_access_token(str(user.id), user.email)
        refresh_token, jti, expires_at = create_refresh_token(str(user.id), user.email)

        rt_record = RefreshToken(
            user_id=user.id,
            jti=jti,
            expires_at=expires_at,
        )
        self.db.add(rt_record)
        await self.db.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
            },
        }
```

### 路由层

```python
# app/api/v1/auth.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.auth import LoginRequest, LoginResponse, RefreshRequest, UserOut
from app.services.auth import AuthService
from app.core.security import get_current_user
from app.models.user import User
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(
    body: LoginRequest,    # 注册复用 LoginRequest schema（含 name 可扩展）
    db: AsyncSession = Depends(get_db),
):
    name = body.email.split("@")[0]  # 简单默认 name，生产环境应单独提供 name 字段
    user = await AuthService(db).register(body.email, body.password, name)
    return user


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    return await AuthService(db).login(body.email, body.password)


@router.post("/refresh", response_model=LoginResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    return await AuthService(db).refresh(body.refresh_token)


@router.post("/logout")
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    await AuthService(db).logout(body.refresh_token)
    return {"detail": "logged out"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
```

### 认证依赖

```python
# app/core/security.py (认证依赖部分)
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,  # 可选认证时设为 False，强制认证时手动抛 401
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """强制认证：从 Authorization: Bearer <token> 中解析当前用户"""
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token payload",
        )

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="user account is disabled",
        )

    return user


async def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """可选认证：已登录返回 User，未登录返回 None（不抛 401）"""
    if token is None:
        return None
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None
```

### 中间件

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.auth import router as auth_router

app = FastAPI(title="My App", version="1.0.0")

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_router)
```

如需自定义请求日志或请求 ID 注入，添加纯 ASGI 中间件：

```python
# app/middleware/request_context.py
import uuid
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("app")

class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        start = time.monotonic()

        response = await call_next(request)

        elapsed = time.monotonic() - start
        logger.info(
            "request_id=%s method=%s path=%s status=%d elapsed=%.3fs",
            request_id, request.method, request.url.path, response.status_code, elapsed,
        )
        response.headers["X-Request-ID"] = request_id
        return response
```

```python
# app/main.py 中注册
from app.middleware.request_context import RequestContextMiddleware

app.add_middleware(RequestContextMiddleware)
```

### 错误处理

```python
# app/core/error_handlers.py
from fastapi import Request
from fastapi.responses import JSONResponse

async def unauthorized_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"detail": str(exc) if hasattr(exc, "detail") else "unauthorized"},
    )

async def forbidden_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={"detail": str(exc) if hasattr(exc, "detail") else "forbidden"},
    )

async def conflict_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc) if hasattr(exc, "detail") else "conflict"},
    )
```

```python
# app/main.py 中注册
from fastapi import HTTPException
from app.core.error_handlers import (
    unauthorized_handler, forbidden_handler, conflict_handler,
)

app.add_exception_handler(401, unauthorized_handler)
app.add_exception_handler(403, forbidden_handler)
app.add_exception_handler(409, conflict_handler)
```

---

## 关键注意事项

1. **登录失败不泄露信息**：统一返回 `"invalid credentials"`，不区分"邮箱不存在"和"密码错误"（防用户枚举攻击）

2. **邮箱统一 lower-case**：注册和登录时都对 email 做 `.lower().strip()`，避免大小写问题导致重复账号或登录失败

3. **bcrypt rounds 不低于 12**：生产环境建议 12（约 250ms/次），低于 10 太弱，高于 14 显著增加登录延迟

4. **Token 类型区分**：JWT payload 中必须包含 `"type": "access"` 或 `"type": "refresh"`，防止 refresh_token 被当作 access_token 使用来访问受保护接口

5. **Token Rotation**：刷新时删除旧的 refresh_token 并签发新的，确保每次刷新旧 token 立即失效。这是防范 refresh_token 泄露的关键措施

6. **并发刷新保护**：如果多 Tab 同时刷新，会导致两次请求竞争同一 refresh_token。解决方案是将刷新逻辑放在数据库事务中，使用 `SELECT ... FOR UPDATE` 锁定行：

    ```python
    # 在 refresh 方法中对 refresh_tokens 行加锁
    from sqlalchemy import update, select

    # 使用 SELECT ... FOR UPDATE 防止并发刷新同一 token
    stored = await self.db.scalar(
        select(RefreshToken)
        .where(RefreshToken.jti == jti)
        .with_for_update()
    )
    ```
    前端也可以做 singleton promise 避免并发请求。

7. **Secret 管理**：`SECRET_KEY` 必须通过环境变量注入，绝不能硬编码或提交到版本控制中。使用 `openssl rand -hex 32` 生成

8. **access_token 短期化**：保持 15-60 分钟。越短越安全（即使泄露损失也有限），但不宜短到影响用户体验（前端频繁刷新）

9. **OAuth2PasswordBearer 的 tokenUrl 不是请求路径**：它是 OpenAPI 文档中 "Authorize" 按钮指向的登录端点路径，不要写成外部 URL

10. **依赖注入层级**：认证依赖通过 `Depends(get_current_user)` 注入到路由函数签名中，FastAPI 会自动调用并缓存同一请求内的结果。不要在 Service 层或 Model 层做认证判断

11. **异步数据库会话**：使用 `AsyncSession` 而非同步 `Session`，否则会阻塞事件循环。数据库驱动的选择也要匹配（如 `asyncpg` 对应 PostgreSQL）

12. **Refresh Token 存储**：jti 必须唯一索引（`unique=True, index=True`），通过 jti 查找和删除 refresh_token，而非通过 token 全文匹配。JWT 本身不存入数据库
