# Go 编码规范索引

> 更新时间：2026-06-21
> 适用：`backend/` 目录的所有 Go 代码

---

## 核心规范（写代码前必读）

| 文件 | 内容 | 优先级 |
|------|------|--------|
| [code-style.md](code-style.md) | 命名规范、错误处理、接口设计、日志 | ⭐⭐⭐ |
| [project-structure.md](project-structure.md) | 目录组织、模块划分、依赖管理 | ⭐⭐⭐ |
| [testing.md](testing.md) | 单元测试、集成测试、Mock 规范 | ⭐⭐ |

---

## 技术栈约定

- **Go 版本**：1.22+
- **Web 框架**：Gin
- **数据库**：sqlx（原生 SQL 优先）/ GORM（按项目选定）
- **日志**：`log/slog`（标准库）
- **配置**：`viper`
- **测试**：`testing` + `testify/assert` + `testify/mock`
- **错误**：`fmt.Errorf("context: %w", err)` 包装

---

## 快速查找

### 我要写新接口

1. 读 [project-structure.md](project-structure.md) — Handler 放哪儿
2. 读 [code-style.md](code-style.md) — 命名 + 错误处理

### 我要写业务逻辑

1. 读 [code-style.md](code-style.md) — 接口设计 + 错误包装

### 我要写测试

1. 读 [testing.md](testing.md) — 表驱动测试 + Mock 写法
