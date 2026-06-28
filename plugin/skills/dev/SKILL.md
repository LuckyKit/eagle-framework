# /eagle:dev — 功能开发（编排）

> 编排 Skill。协调 discuss → plan → coder → tester → reviewer → knowledge-writer 完整流程。
> 维护 STATE.json 和任务状态，全程可中断恢复。

---

## 触发方式

```
/eagle:dev <需求描述>   ← 从头开始
/eagle:dev {slug}       ← 恢复已有任务（从 STATE.json 当前阶段继续）
/eagle:dev              ← 无参数时列出可恢复的任务
```

---

## STATE.json 规范

**路径**：`.eagle/tasks/{slug}/STATE.json`

```json
{
  "slug": "add-user-profile-20260621",
  "title": "用户资料功能",
  "type": "feature",
  "status": "in_progress",
  "stage": "coder",
  "stacks": ["go", "nextjs"],
  "currentWave": "1.2",
  "phases": [
    {
      "id": "1",
      "title": "后端 API",
      "status": "in_progress",
      "waves": [
        {
          "id": "1.1",
          "title": "数据库 Schema + Repository",
          "stacks": ["go"],
          "depends_on": [],
          "parallel": true,
          "status": "done",
          "completedAt": "2026-06-21T10:00:00Z"
        },
        {
          "id": "1.2",
          "title": "Service + Handler",
          "stacks": ["go"],
          "depends_on": ["1.1"],
          "parallel": false,
          "status": "in_progress",
          "startedAt": "2026-06-21T10:30:00Z"
        }
      ]
    }
  ],
  "paths": {
    "discussion": ".eagle/tasks/{slug}/DISCUSSION.md",
    "plan": ".eagle/tasks/{slug}/PLAN.md",
    "test": ".eagle/tasks/{slug}/TEST.md",
    "review": ".eagle/tasks/{slug}/REVIEW.md"
  },
  "createdAt": "2026-06-21T09:00:00Z",
  "updatedAt": "2026-06-21T10:30:00Z"
}
```

**`status` 可选值**：`planning` / `in_progress` / `paused` / `done` / `failed`

**`stage` 可选值**：`discuss` / `plan` / `coder` / `tester-minimal` / `tester-full` / `reviewer` / `knowledge-writer` / `done`

**每次阶段转换必须更新 STATE.json**，每个 Wave 状态变化也必须更新。

---

## 执行流程

### 阶段 0：入口

先读取项目级上下文：
- `.eagle/config.json`
- `.eagle/PROJECT.md`
- `.eagle/ROADMAP.md`
- `.eagle/STATE.md`
- `.eagle/codebase/README.md`（如不存在，提示先运行 `/eagle:map-codebase` 或 `eagle map`）

**有 slug 参数且存在 STATE.json** → 读取 `stage` 字段，从中断处继续

**无参数** → 扫描 `.eagle/tasks/` 中 status 为 `in_progress`/`paused` 的任务，展示列表让用户选择

**有需求描述** → 生成 slug，创建任务目录，STATE.json 初始化 `stage: "discuss"`，进入阶段 1

---

### 阶段 1：需求澄清（/eagle:discuss）

更新 STATE.json：`stage: "discuss"`

调用 `/eagle:discuss`，传入：
- 需求描述
- type: `feature`（/eagle:fix 传 `bug`）

等待用户确认 DISCUSSION.md。

确认后更新 STATE.json：`stage: "plan"`

---

### 阶段 2：方案规划（/eagle:plan）

更新 STATE.json：`stage: "plan"`

调用 `/eagle:plan {slug}`，传入 DISCUSSION.md 路径。

等待用户确认 PLAN.md。

确认后：
- 将 PLAN.md 中的 phases/waves 结构写入 STATE.json
- 更新 STATE.json：`stage: "coder"`, `currentWave: 第一个 Wave 的 ID`
- 调用 `/eagle:gate {slug} plan`，FAIL 时先修 PLAN.md，不进入编码

---

### 阶段 3：Wave 执行（/eagle:coder + /eagle:tester）

按并行批次执行 Wave：

```
确定当前批次（所有 depends_on 已完成的 Wave）
  ↓
同时调用 /eagle:coder 执行批次中每个 Wave
  ↓
每个 Wave 完成后立即调用 /eagle:tester minimal
  ↓
tester PASS → 更新 Wave status: "done" → 更新 STATE.json
tester FAIL → 调用 /eagle:coder fix 模式 → 重试一次 → 再 FAIL → Wave status: "failed"
  ↓
批次所有 Wave 完成（含 failed）→ 进入下一批次
  ↓
所有批次完成 → 进入阶段 4
```

**STATE.json 更新时机**：
- Wave 开始时：`status: "in_progress"`, `startedAt`
- Wave 通过 tester 后：`status: "done"`, `completedAt`
- Wave 失败后：`status: "failed"`, `failedReason`

**有 failed Wave 时**：
- 不中断整个任务，继续执行其他无依赖 Wave
- 阶段 3 结束时统一报告 failed Wave，等待用户决策

---

### 阶段 4：全量测试（/eagle:tester full）

更新 STATE.json：`stage: "tester-full"`

调用 `/eagle:tester {slug} full`。

- PASS → 进入阶段 5
- FAIL → 调用 `/eagle:coder fix` → 重跑 → 最多 2 次 → 仍 FAIL → 暂停报告

---

### 阶段 5：代码审查（/eagle:reviewer）

更新 STATE.json：`stage: "reviewer"`

调用 `/eagle:reviewer {slug}`。

- PASS（无 CRITICAL）→ 进入阶段 6
- FAIL（有 CRITICAL）→ 调用 `/eagle:coder fix` 传入 CRITICAL 列表 → 重跑 reviewer → 最多 2 次

---

### 阶段 6：完成门禁与知识沉淀

调用 `/eagle:gate {slug} done`。

- PASS → 继续知识沉淀
- FAIL → 暂停并报告阻塞项

更新 STATE.json：`stage: "knowledge-writer"`

调用 `/eagle:knowledge-writer {slug}`。
调用 `/eagle:memory capture {slug}`，把可复用决策和踩坑写入长期记忆。

完成后更新 STATE.json：`status: "done"`, `stage: "done"`。
同步更新 `.eagle/STATE.md` 的最近决策和下一步。

---

## 栈判断逻辑

从 STATE.json 的 `stacks` 字段（由 DISCUSSION.md 填充）决定实现范围：

| stacks | 行为 |
|--------|------|
| `["go"]` | 只实现后端 |
| `["nextjs"]` | 只实现 Web 前端 |
| `["flutter"]` | 只实现 App |
| `["go", "nextjs"]` | 后端 + Web，API 先行 |
| `["go", "nextjs", "flutter"]` | 三端，后端优先 |

每个 Wave 独立标注涉及的栈，coder 只实现该 Wave 的栈。

---

## 完成报告

```
✅ /eagle:dev 完成

任务：{slug}（{title}）
类型：{feature/bug/iteration/refactor}
涉及端：{stacks}

执行摘要：
  Phase {N} 完成，共 {M} 个 Wave
  并行批次：{K} 批
  Commit：{X} 次

测试：全量通过（{Y}/{Z}）
审查：无 CRITICAL 问题，{W} 个 WARNING（见 REVIEW.md）

知识沉淀：.eagle/knowledge/ + .eagle/memory/ 已更新

STATE.json：.eagle/tasks/{slug}/STATE.json（status: done）
```

如有 failed Wave：

```
⚠️ 以下 Wave 需要人工处理：
  Wave {id}：{失败原因}

其余 Wave 已完成。可用 /eagle:dev {slug} 恢复并继续。
```

---

## 硬性约束

1. **STATE.json 必须实时更新** — 每个阶段转换、每个 Wave 状态变化都要写入
2. **阶段转换后可随时恢复** — /eagle:dev {slug} 从 stage 字段继续，不重做已完成阶段
3. **能并行的 Wave 必须并行** — 不允许把 parallel: true 的 Wave 串行执行
4. **failed Wave 不阻塞其他无依赖 Wave** — 继续执行，最后统一报告
5. **用户只有两次交互** — discuss 确认 + plan 确认，之后零交互
6. **栈判断由 PLAN.md Wave 标注决定** — 不让 coder 自行判断实现哪个栈
7. **质量门禁不可跳过** — plan gate 和 done gate 是自用提速的底线
8. **长期记忆必须沉淀** — 完成任务时至少记录一个可复用经验或明确说明无新增
