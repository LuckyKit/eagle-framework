# Python 编码规范索引

> 更新时间：2026-06-28
> 适用：`backend/` 目录的所有 Python 代码

---

## 核心规范（写代码前必读）

| 文件 | 内容 | 优先级 |
|------|------|--------|
| [code-style.md](code-style.md) | 命名规范、类型注解、Pydantic 模型定义、异常处理、日志 | ⭐⭐⭐ |
| [project-structure.md](project-structure.md) | 目录组织、模块划分、FastAPI 路由注册、依赖管理 | ⭐⭐⭐ |
| [testing.md](testing.md) | 单元测试、异步测试、数据库 Mock、HTTP 客户端测试 | ⭐⭐ |

---

## 技术栈约定

- **Python 版本**：3.12+
- **依赖管理**：使用 `uv` 管理项目依赖和虚拟环境；安装依赖用 `uv add ...` / `uv sync`，不要手动执行 `python -m venv .venv`
- **Web 框架**：FastAPI
- **ORM**：SQLAlchemy 2.0（async 会话，`selectinload` / `joinedload` 预加载）
- **数据校验**：Pydantic v2（`model_validate` / `model_dump`）
- **日志**：`structlog`（结构化日志，绑定 `request_id` / `user_id`）
- **配置**：`pydantic-settings`（环境变量 + `.env` 文件）
- **测试**：`pytest` + `pytest-asyncio` + `httpx`（`AsyncClient`）
- **迁移**：Alembic（自动生成 + 手动审查）
- **JWT**：`python-jose`（access token + refresh token）
- **服务**：Uvicorn（`--reload` 开发 / `--workers` 生产）

---

## 快速查找

### 我要写新接口

1. 读 [project-structure.md](project-structure.md) — Router 放哪儿 + 路由注册方式
2. 读 [code-style.md](code-style.md) — 路径操作函数写法 + 依赖注入 + 响应模型

### 我要定义数据模型

1. 读 [code-style.md](code-style.md) — Pydantic Schema 定义（Request / Response / DB 模型分离）

### 我要写数据库操作

1. 读 [code-style.md](code-style.md) — SQLAlchemy 2.0 async session + 查询写法 + 关联加载

### 我要写数据库迁移

1. 读 [project-structure.md](project-structure.md) — Alembic 目录结构 + 迁移命令

### 我要处理认证和鉴权

1. 读 [code-style.md](code-style.md) — JWT 依赖注入 + `Depends(get_current_user)` 写法

### 我要写测试

1. 读 [testing.md](testing.md) — `pytest-asyncio` 配置 + `httpx.AsyncClient` 写法 + DB fixture 隔离
