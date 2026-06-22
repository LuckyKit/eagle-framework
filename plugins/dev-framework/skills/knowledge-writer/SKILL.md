# /eagle:knowledge-writer — 知识沉淀

> 原子 Skill。只负责一件事：任务完成后沉淀知识和记忆。
> 不改业务代码，不做测试。

---

## 调用方式

```
/eagle:knowledge-writer {slug}   ← 用户直接调用
由编排 Skill 调用（任务收尾时）
```

---

## 输入

- `.eagle/tasks/{slug}/PLAN.md`
- `.eagle/tasks/{slug}/TEST.md`
- `.eagle/tasks/{slug}/REVIEW.md`
- 本次任务修改的文件列表

---

## 执行步骤

### 召唤 eagle-knowledge-writer

分析任务全貌，判断写入位置：

**写 `.eagle/knowledge/`（稳定的架构/模式知识）：**
- 新引入的技术模式或设计决策
- 跨组件复用的实现方式
- 架构决策及原因

**写 `.eagle/memory/`（踩坑 / 经验记录）：**
- Bug 根因 + 触发条件（bug 类型任务必写）
- 意外发现的问题和解决方案
- WARNING 级别审查问题的背景说明

**跳过条件：**
- 如果任务是常规实现，无特殊决策，无踩坑 → 可以不写，但必须明确说明跳过原因

---

## 输出

在 REVIEW.md 末尾或单独报告中说明：

```
📚 知识沉淀完成

写入 .eagle/knowledge/:
  - {文件路径}：{一句话说明写了什么}

写入 .eagle/memory/:
  - {文件路径}：{一句话说明写了什么}

跳过：{如有跳过，说明原因}
```

---

## 硬性约束

1. **不改业务代码** — 只写 .eagle/knowledge/ 和 .eagle/memory/
2. **bug 任务必须写 memory** — 根因和触发条件不能丢
3. **写内容要可搜索** — 文件名和标题用关键词，方便 analyst 后续查找
4. **不重复已有内容** — 先检查是否已有相关条目，追加而非重写
