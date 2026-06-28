# Python 测试规范

## 工具栈

- `pytest` — 测试运行器
- `pytest-asyncio` — 异步测试支持
- `httpx.AsyncClient` — 异步 HTTP 客户端（用于测试 FastAPI 端点）
- `FastAPI TestClient` — 同步测试客户端（简单场景）
- `unittest.mock.AsyncMock` — 异步 Mock
- `pytest-mock` — pytest 原生 mock 集成
- `pytest-cov` — 覆盖率报告

```bash
# 安装测试依赖
pip install pytest pytest-asyncio pytest-mock pytest-cov httpx
```

---

## 测试文件位置与命名

```
app/
├── services/
│   ├── user_service.py
│   └── user_service_test.py        ← 单元测试（同目录）
├── api/
│   ├── routes/
│   │   ├── users.py
│   │   └── users_test.py           ← 端点测试（同目录）
│   └── dependencies_test.py
├── repositories/
│   ├── user_repo.py
│   └── user_repo_integration_test.py  ← 集成测试（需要真实数据库）
└── tests/                          ← 集中测试目录（可选，项目根）
    ├── conftest.py                 ← 全局 fixtures
    ├── factories.py                ← 测试数据工厂
    └── e2e/
        └── test_login_flow.py
```

**规则**：
- 测试文件以 `test_` 开头或 `_test` 结尾（pytest 默认发现规则）
- 与源码文件对应放置，单元测试放在同一目录
- 集成测试使用 `_integration_test` 后缀区分
- `conftest.py` 放共享 fixtures（pytest 自动发现该目录下的 conftest）

---

## Fixtures（conftest.py）

### 异步 HTTP 客户端

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import create_app
from app.config import get_settings
from app.models import Base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def engine():
    """会话级引擎，所有测试共享。"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    return engine


@pytest.fixture(autouse=True)
async def setup_db(engine):
    """每个测试前自动建表，结束后不删表（或按需清理）。"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # 可选：每个测试后清理
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(engine):
    """返回一个事务级 session，测试结束后自动回滚。"""
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        async with session.begin():
            yield session
        await session.rollback()


@pytest.fixture
def app(db_session):
    """创建 FastAPI 应用实例，注入测试依赖。"""
    from app.api.dependencies import get_db

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    return app


@pytest.fixture
async def client(app):
    """异步 HTTP 客户端，用于测试 API 端点。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def auth_headers(client):
    """提供认证头，用于需要登录的接口测试。"""
    # 假设创建了一个测试用户并登录
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "TestPass123!"
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

### 测试数据工厂（Factories）

```python
# tests/factories.py
from app.models import User
from app.schemas import CreateUserReq


async def create_test_user(db_session, **overrides) -> User:
    """创建一个测试用户，支持字段覆盖。"""
    defaults = {
        "email": "test@example.com",
        "name": "Test User",
        "hashed_password": "hashed_secret",
        "is_active": True,
    }
    defaults.update(overrides)
    user = User(**defaults)
    db_session.add(user)
    await db_session.flush()
    return user


def build_create_user_req(**overrides) -> dict:
    """构造 CreateUserReq 请求体字典。"""
    defaults = {
        "email": "new@example.com",
        "name": "New User",
        "password": "StrongPass1!",
    }
    defaults.update(overrides)
    return defaults
```

---

## API 端点测试

使用 `httpx.AsyncClient` 对 FastAPI 应用发送请求，验证状态码和响应 JSON。

```python
# app/api/routes/users_test.py
import pytest
from httpx import AsyncClient


class TestCreateUser:
    """POST /api/v1/users"""

    @pytest.mark.asyncio
    async def test_create_user_success(self, client: AsyncClient):
        """正常创建用户，返回 201 和新用户数据。"""
        payload = {"email": "alice@example.com", "name": "Alice", "password": "Pass123!"}

        resp = await client.post("/api/v1/users", json=payload)

        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "alice@example.com"
        assert data["name"] == "Alice"
        assert "id" in data
        assert "password" not in data  # 密码不应返回

    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self, client: AsyncClient, db_session):
        """重复邮箱，返回 409 Conflict。"""
        # 先新建一个用户
        await create_test_user(db_session, email="dup@example.com")

        resp = await client.post("/api/v1/users", json={
            "email": "dup@example.com",
            "name": "Dup",
            "password": "Pass123!",
        })

        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_create_user_invalid_email(self, client: AsyncClient):
        """无效邮箱格式，返回 422。"""
        resp = await client.post("/api/v1/users", json={
            "email": "not-an-email",
            "name": "Bad",
            "password": "Pass123!",
        })

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_user_unauthorized(self, client: AsyncClient):
        """未登录创建用户，返回 401（如接口需要认证）。"""
        payload = {"email": "anon@example.com", "name": "Anon", "password": "Pass123!"}

        resp = await client.post("/api/v1/users", json=payload)

        assert resp.status_code == 401


class TestGetUser:
    """GET /api/v1/users/{user_id}"""

    @pytest.mark.asyncio
    async def test_get_user_found(self, client: AsyncClient, db_session):
        """查询存在的用户，返回 200。"""
        user = await create_test_user(db_session, email="find@example.com")

        resp = await client.get(f"/api/v1/users/{user.id}")

        assert resp.status_code == 200
        assert resp.json()["email"] == "find@example.com"

    @pytest.mark.asyncio
    async def test_get_user_not_found(self, client: AsyncClient):
        """查询不存在的用户，返回 404。"""
        resp = await client.get("/api/v1/users/99999")

        assert resp.status_code == 404
```

---

## Service 层测试（业务逻辑隔离）

Mock 掉 repository 层，只测试业务逻辑。

```python
# app/services/user_service_test.py
import pytest
from unittest.mock import AsyncMock
from app.services.user_service import UserService
from app.repositories.user_repo import UserRepository
from app.exceptions import DuplicateEmailError, UserNotFoundError


class TestUserServiceCreateUser:

    @pytest.mark.asyncio
    async def test_create_user_success(self):
        """正常流程：邮箱不存在，保存成功。"""
        # Arrange
        repo = AsyncMock(spec=UserRepository)
        repo.find_by_email.return_value = None
        repo.save.return_value = None

        svc = UserService(repo)

        # Act
        user = await svc.create_user(email="new@example.com", name="New", password="pw")

        # Assert
        assert user.email == "new@example.com"
        repo.find_by_email.assert_awaited_once_with("new@example.com")
        repo.save.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self):
        """邮箱已存在，抛 DuplicateEmailError。"""
        repo = AsyncMock(spec=UserRepository)
        repo.find_by_email.return_value = {"id": 1, "email": "dup@example.com"}

        svc = UserService(repo)

        with pytest.raises(DuplicateEmailError):
            await svc.create_user(email="dup@example.com", name="Dup", password="pw")

        repo.save.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_create_user_invalid_email(self):
        """邮箱格式无效，抛 ValidationError（不调 repo）。"""
        repo = AsyncMock(spec=UserRepository)

        svc = UserService(repo)

        with pytest.raises(ValueError, match="Invalid email"):
            await svc.create_user(email="bad", name="Bad", password="pw")

        repo.find_by_email.assert_not_awaited()
```

---

## Repository 测试（集成测试 / 真实数据库）

对真实测试数据库进行读写，每次测试后回滚事务。

```python
# app/repositories/user_repo_integration_test.py
import pytest
from app.repositories.user_repo import UserRepository
from app.models import User


@pytest.mark.asyncio
class TestUserRepositorySave:

    async def test_save_creates_user(self, db_session):
        """保存新用户，成功写入并能查回。"""
        repo = UserRepository(db_session)

        user = User(email="save@example.com", name="Save", hashed_password="hash")
        result = await repo.save(user)

        assert result.id is not None
        assert result.email == "save@example.com"

        # 从数据库查回验证
        found = await repo.find_by_email("save@example.com")
        assert found is not None
        assert found.email == "save@example.com"

    async def test_save_with_duplicate_email(self, db_session):
        """重复邮箱保存抛 IntegrityError。"""
        repo = UserRepository(db_session)
        user1 = User(email="dup@example.com", name="First", hashed_password="h1")
        await repo.save(user1)

        user2 = User(email="dup@example.com", name="Second", hashed_password="h2")

        with pytest.raises(Exception):  # 或具体 IntegrityError
            await repo.save(user2)


@pytest.mark.asyncio
class TestUserRepositoryFindByEmail:

    async def test_find_by_email_existing(self, db_session):
        """查询存在的邮箱，返回用户。"""
        repo = UserRepository(db_session)
        await repo.save(User(email="found@example.com", name="Found", hashed_password="h"))

        result = await repo.find_by_email("found@example.com")

        assert result is not None
        assert result.name == "Found"

    async def test_find_by_email_nonexistent(self, db_session):
        """查询不存在的邮箱，返回 None。"""
        repo = UserRepository(db_session)

        result = await repo.find_by_email("no@example.com")

        assert result is None
```

---

## Mock 模式

### AsyncMock（用于异步依赖）

```python
from unittest.mock import AsyncMock, patch


# 直接注入 AsyncMock 实例（推荐）
@pytest.mark.asyncio
async def test_with_async_mock():
    mock_repo = AsyncMock()
    mock_repo.find_by_id.return_value = {"id": 1}

    svc = MyService(mock_repo)
    result = await svc.get_user(1)

    assert result["id"] == 1
    mock_repo.find_by_id.assert_awaited_once_with(1)


# 使用 patch 装饰器替换模块级别的异步函数
@pytest.mark.asyncio
@patch("app.services.email_service.send_async", new_callable=AsyncMock)
async def test_with_patch(mock_send):
    mock_send.return_value = {"status": "sent"}

    svc = NotificationService()
    result = await svc.notify("alice@example.com")

    mock_send.assert_awaited_once_with("alice@example.com")
```

### pytest-mock（mocker fixture）

```python
@pytest.mark.asyncio
async def test_with_mocker(mocker, db_session):
    """用 mocker 打补丁，适合需要局部 mock 的场景。"""
    # 将异步函数 mock 掉
    mock_fetch = mocker.patch(
        "app.external.payment.charge",
        new_callable=AsyncMock,
        return_value={"txn_id": "txn_123"},
    )

    svc = PaymentService(db_session)
    result = await svc.process_payment(order_id=42)

    assert result["txn_id"] == "txn_123"
    mock_fetch.assert_awaited_once()
```

### Mock 规范

```python
# ✅ 用 spec 约束 Mock，确保只调用真实存在的方法
mock_repo = AsyncMock(spec=UserRepository)

# ✅ 链式调用用 return_value 链
mock_repo.find_by_id.return_value = mock_user

# ✅ 按需设置 side_effect 模拟异常
mock_repo.find_by_id.side_effect = UserNotFoundError("not found")

# ✅ 验证调用
mock_repo.save.assert_awaited_once()
mock_repo.find_by_email.assert_not_awaited()

# ❌ 不用 spec 容易误调不存在的方法
mock_repo = AsyncMock()  # 任何属性访问都返回 Mock

# ❌ 不对未调用的 mock 做 assert（测试结束自动清理即可）
```

---

## 参数化测试（Parametrized Tests）

用 `@pytest.mark.parametrize` 覆盖多场景，避免重复代码。

```python
@pytest.mark.parametrize(
    "email, password, expected_status, expected_field",
    [
        ("", "Pass123!", 422, "email"),                    # 空邮箱
        ("a@b.com", "", 422, "password"),                   # 空密码
        ("a@b.com", "123", 422, "password"),                # 密码太短
        ("not-email", "Pass123!", 422, "email"),             # 非法邮箱
        ("a@b.com", "12345678", 422, "password"),            # 无大写字母
        ("a@b.com", "ABCDEFGHI", 422, "password"),           # 无数字
    ],
)
@pytest.mark.asyncio
async def test_create_user_validation(client, email, password, expected_status, expected_field):
    """参数化验证：各字段的校验规则。"""
    resp = await client.post("/api/v1/users", json={
        "email": email,
        "name": "Test",
        "password": password,
    })

    assert resp.status_code == expected_status
    errors = resp.json().get("detail", [])
    # 验证错误中包含期望的字段名
    field_names = [e.get("loc", [None])[-1] for e in errors]
    assert expected_field in field_names
```

```python
# 对 service 层也做参数化
@pytest.mark.parametrize(
    "role, can_delete",
    [
        ("admin", True),
        ("moderator", True),
        ("user", False),
        ("guest", False),
    ],
)
@pytest.mark.asyncio
async def test_can_delete_user(role, can_delete):
    """不同角色对删除权限的判断。"""
    svc = PermissionService()
    assert svc.can_delete(role) == can_delete
```

---

## 覆盖率

```bash
# 运行全部测试并生成终端覆盖率报告
pytest --cov=app --cov-report=term

# 生成 HTML 覆盖率报告（可在浏览器查看逐行覆盖情况）
pytest --cov=app --cov-report=html

# 指定最小覆盖率，不达标则失败（CI 用）
pytest --cov=app --cov-report=term --cov-fail-under=80

# 只对 service 层要求高覆盖率
pytest --cov=app/services --cov-fail-under=80

# 排除测试文件本身的覆盖统计
pytest --cov=app --cov-report=term --ignore=tests/
```

**覆盖率目标**：

| 层 | 最低覆盖率 | 说明 |
|---|-----------|------|
| `app/services/` | 80% | 核心业务逻辑，必须充分测试 |
| `app/api/routes/` | 70% | 端点测试覆盖正常 + 异常路径 |
| `app/repositories/` | 60% | 以集成测试为主，难以覆盖全部分支 |

**配置文件**（`pyproject.toml` 或 `setup.cfg`）：

```ini
[tool.coverage.run]
source = ["app"]
omit = ["*/migrations/*", "*/tests/*"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
    "if __name__ == .__main__.:",
]
```

---

## 测试命令速查

```bash
# 运行全部测试
pytest

# 详细输出（显示每个测试名 + pass/fail）
pytest -v

# 运行指定文件
pytest app/services/user_service_test.py

# 运行指定测试类/方法
pytest app/services/user_service_test.py::TestCreateUser::test_create_user_success

# 运行匹配关键字的测试
pytest -k "create_user"

# 运行并输出到控制台（不捕获 print）
pytest -s

# 首次失败即停止
pytest -x

# 运行最后失败的测试（自动读取 .pytest_cache）
pytest --lf

# 带覆盖率
pytest --cov=app --cov-report=term

# 带覆盖率并生成 HTML
pytest --cov=app --cov-report=html

# 跳过集成测试（conftest 中标记或用 -m 过滤）
pytest -m "not integration"

# 仅运行集成测试
pytest -m integration
```

---

## 测试命名约定

```python
# 类名格式：Test{被测类/功能名}
class TestCreateUser:
    """POST /api/v1/users"""
    ...

class TestUserServiceCreateUser:
    """UserService.create_user()"""
    ...

# 方法名格式：test_{被测方法}_{场景}
async def test_create_user_success(self, client): ...
async def test_create_user_duplicate_email(self, client): ...
async def test_create_user_invalid_email(self, client): ...
async def test_create_user_unauthorized(self, client): ...

# 参数化测试的 ids 明确场景
@pytest.mark.parametrize(
    "email,password,expected",
    [
        ("", "Pass1!", 422),
        ("a@b.com", "", 422),
    ],
    ids=["missing_email", "missing_password"],  # 自定义 id，报告清晰
)
```

---

## 禁止的写法

```python
# ❌ 共享可变状态（测试间互相污染）
global_user = None  # 模块级变量，多测试间共享

@pytest.mark.asyncio
async def test_a(client):
    global global_user
    global_user = await client.post("/api/v1/users", json={...})  # 写入全局
    ...

@pytest.mark.asyncio
async def test_b(client):
    assert global_user is not None  # 依赖 test_a 先执行


# ✅ 每个测试独立 setup，用 fixtures 注入
@pytest.mark.asyncio
async def test_a(client, db_session):
    user = await create_test_user(db_session)  # 独立创建
    ...


# ❌ 测试间有顺序依赖
@pytest.mark.order(1)  # 依赖顺序插件 — 禁止使用
async def test_first(client): ...

@pytest.mark.order(2)
async def test_second(client): ...


# ✅ 每个测试可独立运行（--lf、-k 不依赖顺序）
async def test_create_then_get(client):
    """单个测试内完成完整流程。"""
    ...


# ❌ 在测试中用 sleep 等待异步
async def test_async_operation(client):
    await client.post("/api/v1/tasks/start", json={})
    await asyncio.sleep(2)  # 脆断，CI 环境不稳定
    resp = await client.get("/api/v1/tasks/status")
    assert resp.json()["status"] == "done"


# ✅ 轮询等待直到条件满足（带超时）
async def test_async_operation(client):
    await client.post("/api/v1/tasks/start", json={})
    resp = await _wait_for_status(client, task_id=1, expected="done", timeout=10)
    assert resp.json()["status"] == "done"

async def _wait_for_status(client, task_id, expected, timeout):
    """轮询等待状态，超时抛异常。"""
    for _ in range(timeout * 10):
        resp = await client.get(f"/api/v1/tasks/{task_id}")
        if resp.json()["status"] == expected:
            return resp
        await asyncio.sleep(0.1)
    raise TimeoutError(f"Task {task_id} did not reach {expected}")


# ❌ 不用 assert 校验
def test_create_user(client):
    resp = client.post("/api/v1/users", json={...})
    # 没有 assert — 测试永远通过


# ✅ 每个测试必须有明确的 assert
def test_create_user(client):
    resp = client.post("/api/v1/users", json={...})
    assert resp.status_code == 201


# ❌ 测试不互斥的断言应拆分，不堆到一个测试里
async def test_user_flow(client):
    """一个测试里验证创建、列表、更新、删除 — 失败时原因不明。"""
    ...


# ✅ 各场景独立测试
async def test_create_user(client): ...
async def test_list_users(client): ...
async def test_update_user(client): ...
async def test_delete_user(client): ...
```
