[project]
name = "{{PROJECT_NAME}}"
version = "0.1.0"
description = ""
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy[asyncio]>=2.0.30",
    "asyncpg>=0.29.0",
    "pydantic>=2.7.0",
    "pydantic-settings>=2.3.0",
    "alembic>=1.13.0",
    "structlog>=24.0.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.2.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
    "pytest-cov>=5.0.0",
    "pytest-mock>=3.14.0",
    "mypy>=1.10.0",
    "ruff>=0.4.0",
]

[tool.ruff]
line-length = 120
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",   # pycodestyle errors
    "F",   # pyflakes
    "I",   # isort
    "N",   # pep8-naming
    "UP",  # pyupgrade
    "B",   # flake8-bugbear
    "SIM", # flake8-simplify
]

[tool.ruff.format]
quote-style = "double"

[tool.pytest.ini_options]
asyncio_mode = "auto"
