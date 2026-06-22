# 技术栈感知参考

> 供 `/new-project sense` 模式和 `detect_project.py` 参考使用

## 检测规则

| 文件 | 判断结果 |
|------|---------|
| `backend/go.mod` | Go 后端项目 |
| `web/package.json` | React Web 项目 |
| `mobile/pubspec.yaml` | Flutter 移动端项目 |
| `.eagle/` 目录存在 | Eagle 框架项目 |

## 感知输出格式

```
🦅 Eagle Framework 项目已检测

技术栈：Go + React
编码规范：
- go 规范：.eagle/rules/go/INDEX.md
- react 规范：.eagle/rules/react/INDEX.md
知识库：.eagle/knowledge/
记忆库：.eagle/memory/
组件库：.eagle/components/

可用命令：/new-project /discuss /dev /fix /refactor
```

## 非 Eagle 项目的处理

如果当前目录没有 `.eagle/`，`detect_project.py` 静默退出（不输出任何内容），不干扰非 Eagle 项目的会话。
