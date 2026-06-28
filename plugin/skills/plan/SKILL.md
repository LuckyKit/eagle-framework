# /eagle:plan — 方案规划

> 原子 Skill。只负责一件事：读取 DISCUSSION.md，生成 Phase + Wave 计划，输出 PLAN.md。
> 不写代码，不澄清需求。

---

## 调用方式

```
/eagle:plan {slug}     ← 用户直接调用（需已有 DISCUSSION.md）
由编排 Skill 调用      ← /eagle:dev / /eagle:fix 内部调用
```

---

## 输入

- `.eagle/tasks/{slug}/DISCUSSION.md`
- 项目技术栈信息（从 DISCUSSION.md 的"涉及端"读取）
- `.eagle/PROJECT.md` / `.eagle/ROADMAP.md` / `.eagle/STATE.md`
- `.eagle/codebase/` 中与本任务相关的地图
- `.eagle/gates/QUALITY-GATES.md`

---

## 执行步骤

### 1. 召唤 eagle-analyst

传入 DISCUSSION.md 全文，让 analyst 生成：

规划前必须先读取：
- 项目级目标和约束：`.eagle/PROJECT.md`
- 当前路线图：`.eagle/ROADMAP.md`
- 当前状态：`.eagle/STATE.md`
- 代码库地图：`.eagle/codebase/STACK.md`、`STRUCTURE.md`、`CONVENTIONS.md`、`TESTING.md`

**Phase 规划原则：**
- 每个 Phase = 端到端可独立交付的里程碑
- Phase 不应该是"后端 Phase"+"前端 Phase"这种按技术层拆分，而是按功能里程碑拆

**Wave 规划原则：**
- 每个 Wave = 单次可独立实现和最小验证的代码批次（≤1 天工作量）
- Wave 必须标注：涉及的栈（go / react / flutter）、依赖的其他 Wave
- **没有依赖关系的 Wave 必须标注为可并行**

**栈分配原则：**
- 同一功能的后端和前端通常不能并行（前端依赖 API）
- 不同功能模块的 Wave 如果无数据依赖，可以并行
- 文档、配置类 Wave 通常可并行于开发 Wave

---

### 2. PLAN.md 格式

```markdown
# {任务标题}

## 元信息
- slug: {slug}
- 类型: {feature/bug/iteration/refactor}
- 涉及端: {go/react/flutter}

## 设计决策
{analyst 的关键技术选型、架构决策、竞品参考要点}

## Phase 1: {里程碑标题}
> 交付目标：{一句话，端到端可验证}

### Wave 1.1: {标题}
- 栈: go
- depends_on: []
- 并行: ✅ 可与 Wave 1.3 并行
- 范围:
  - {具体实现内容}
- 最小验证:
  - [ ] {最关键的验证点，不超过 3 条}

### Wave 1.2: {标题}
- 栈: go
- depends_on: ["1.1"]
- 并行: ❌
- 范围:
  - {具体实现内容}
- 最小验证:
  - [ ] {验证点}

### Wave 1.3: {标题}
- 栈: react
- depends_on: ["1.2"]
- 并行: ❌
- 范围:
  - {具体实现内容}
- 最小验证:
  - [ ] {验证点}

## Phase 2: ...
```

---

### 3. 展示并确认

将 PLAN.md 摘要展示给用户：

```
📋 方案已就绪

Phase 1: {标题}（{N} 个 Wave）
  Wave 1.1 — {标题} [go] 🔀 可并行
  Wave 1.2 — {标题} [go] ← 依赖 1.1
  Wave 1.3 — {标题} [react] ← 依赖 1.2

Phase 2: {标题}（{M} 个 Wave）
  ...

并行批次：
  批次 A：Wave 1.1（同时开始）
  批次 B：Wave 1.2（A 完成后）
  批次 C：Wave 1.3（B 完成后）

确认开始执行？确认后全程零交互。
```

用户确认后，写入 PLAN.md，结束。

---

## 输出

- `.eagle/tasks/{slug}/PLAN.md`

---

## 硬性约束

1. **不澄清需求** — 需求来自 DISCUSSION.md，有疑问基于文件内容做最合理假设
2. **Phase 必须端到端可交付** — 不按技术层拆（禁止"Phase 1 = 后端，Phase 2 = 前端"）
3. **Wave 依赖必须标注清楚** — 漏标依赖会导致并行执行出错
4. **最小验证不超过 3 条** — 每 Wave 验证要简洁，全量测试由编排 Skill 统一跑
5. **用户确认后才写 PLAN.md** — 不在确认前写文件
6. **必须通过 plan gate** — 验收标准、依赖关系、涉及文件和验证方式缺失时不允许进入编码
