# Flutter 编码规范索引

> 更新时间：2026-06-21
> 适用：`mobile/` 目录的所有 Flutter 代码

---

## 核心规范（写代码前必读）

| 文件 | 内容 | 优先级 |
|------|------|--------|
| [code-style.md](code-style.md) | Widget 规范、命名约定、错误处理、日志 | ⭐⭐⭐ |
| [project-structure.md](project-structure.md) | 目录组织、Feature 划分、依赖注入 | ⭐⭐⭐ |
| [testing.md](testing.md) | Widget 测试、Unit 测试、Mock 规范 | ⭐⭐ |

---

## 技术栈约定

- **Flutter 版本**：3.x（稳定版）
- **语言**：Dart 3+（空安全，严格模式）
- **状态管理**：Riverpod 2.x
- **路由**：GoRouter
- **网络**：Dio + Retrofit
- **本地存储**：flutter_secure_storage（敏感）/ SharedPreferences（普通）
- **依赖注入**：Riverpod Provider
- **测试**：flutter_test + mocktail

---

## 快速查找

### 我要写新 Widget

1. 读 [code-style.md](code-style.md) — Widget 规范 + 命名

### 我要写状态逻辑

1. 读 [code-style.md](code-style.md) — Riverpod Provider 规范

### 我要组织 Feature

1. 读 [project-structure.md](project-structure.md) — Feature-first 目录

### 我要写测试

1. 读 [testing.md](testing.md) — Widget 测试 + Mock 写法
