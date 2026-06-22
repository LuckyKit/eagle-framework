# Eagle 项目快速上手

> 这个文件在每个用 Eagle 初始化的项目中都有一份，新成员从这里开始。

---

## 日常开发流程

### 1. 开发新功能

```
/discuss 实现用户登录功能，支持邮箱+密码
```

你会看到一份 PLAN.md 方案，确认后全自动执行：coder → tester → reviewer → knowledge。

### 2. 修复 Bug

```
/fix panic: runtime error: invalid memory address at handler/user.go:42
```

粘贴完整报错，自动诊断 + 修复 + 测试 + 沉淀踩坑记忆。

### 3. 大型重构

```
/refactor 将 handler 层的 DB 直接调用迁移到 repository 层
```

自动分波次执行，每波次独立验证，可随时暂停。

---

## 目录说明

```
.eagle/
├── rules/         ← 编码规范（npx 初始化时复制，不要手动修改）
│   ├── go/        ← Go 规范，coder 写 backend/ 时自动读取
│   ├── react/     ← React 规范，coder 写 web/ 时自动读取
│   └── flutter/   ← Flutter 规范，coder 写 mobile/ 时自动读取
├── components/    ← 组件蓝图（npx 初始化时复制）
│   └── auth/      ← 登录/注册/Token 刷新的三端实现模式
├── knowledge/     ← 本项目的技术知识（开发中自动积累）
│   └── INDEX.md
├── memory/        ← 踩坑记忆（开发中自动积累）
│   └── INDEX.md
└── tasks/         ← 每次 /discuss 产生的任务目录
    └── {slug}/
        ├── PLAN.md    ← analyst 的方案
        ├── TEST.md    ← tester 的测试报告
        └── REVIEW.md  ← reviewer 的审查报告
```

---

## 规范速查

| 我要… | 读这个 |
|-------|--------|
| 写 Go 代码 | `.eagle/rules/go/INDEX.md` |
| 写 React 组件 | `.eagle/rules/react/INDEX.md` |
| 写 Flutter Widget | `.eagle/rules/flutter/INDEX.md` |
| 做认证功能 | `.eagle/components/auth/spec.md` |
| 查历史踩坑 | `.eagle/memory/INDEX.md` |
| 查项目技术决策 | `.eagle/knowledge/INDEX.md` |

---

## 知识积累

`/dev` 和 `/fix` 完成后，`eagle-knowledge-writer` 会自动更新 `.eagle/knowledge/` 和 `.eagle/memory/`。

**什么时候手动补充**：实现了某个新功能（如支付集成），但该功能还不在框架的 `components/` 里。可以手动写一份组件蓝图，后续提取回框架仓库让其他项目也能受益。

---

## 注意事项

- `.eagle/knowledge/` 和 `.eagle/memory/` 已在 `.gitignore` 中，项目私有，不提交
- `.eagle/rules/` 是框架快照，更新规范请去框架仓库修改，然后重新 npx
- `tasks/` 目录同样不提交（.gitignore），任务文件是临时工作产物
