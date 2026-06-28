# 项目模板参考

> `/new-project` skill 生成项目骨架时参考此文档

## 模板文件位置

框架仓库 `templates/` 目录，`.tpl` 后缀，变量用 `{{VAR}}` 占位：

| 模板文件 | 生成目标 | 变量 |
|---------|---------|------|
| `templates/go/go.mod.tpl` | `backend/go.mod` | `{{PROJECT_NAME}}` |
| `templates/go/main.go.tpl` | `backend/cmd/server/main.go` | `{{PROJECT_NAME}}` |
| `templates/go/config.yaml.tpl` | `backend/config/config.yaml` | — |
| `templates/nextjs/package.json.tpl` | `web/package.json` | `{{PROJECT_NAME}}` |
| `templates/nextjs/next.config.ts.tpl` | `web/next.config.ts` | — |
| `templates/flutter/pubspec.yaml.tpl` | `mobile/pubspec.yaml` | `{{PROJECT_NAME}}` |

## 骨架文件生成原则

1. **不覆盖已有文件** — 目标路径已存在时跳过并提示
2. **变量替换** — `{{PROJECT_NAME}}` 替换为用户输入的项目名
3. **gitignore 追加** — 敏感文件追加到已有 `.gitignore`，不覆盖

## npx 复制规范的路径约定

- 规范来源：框架仓库 `payload/rules-{stack}/`
- 目标位置：项目 `.eagle/rules/{stack}/`
- 组件来源：框架仓库 `payload/component-*`
- 目标位置：项目 `.eagle/components/`
