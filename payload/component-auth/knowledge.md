# Auth 组件 — 设计知识与踩坑

---

## 关键设计决策

### 1. 为什么用双 Token（access + refresh）而不是单 Token？

**问题**：JWT 一旦签发无法撤销（直到过期）。

**解决**：
- access_token 短期（1小时），即使泄露损失有限
- refresh_token 存数据库，登出时删除，实现真正的撤销
- 代价：每次刷新需要查一次 DB，可接受

**踩坑**：如果 refresh_token 也做成无状态 JWT（不存 DB），则无法主动登出（用户删 APP 重装后旧 token 仍有效）。

### 2. access_token 为什么存内存不存 localStorage？

**安全原因**：localStorage 可被 XSS 攻击读取。内存中的变量只有当前页面 JS 能访问，XSS 注入的代码也在同域，但刷新页面后 token 消失（需要 refresh）。

**实践影响**：
- 页面刷新后需要用 refresh_token 自动获取新的 access_token
- App 启动时检查是否有 refresh_token，有则静默刷新

### 3. 密码重置流程（本组件不包含，记录扩展点）

如需密码重置：
- 发送带一次性 token 的重置邮件
- token 存 DB，使用后删除，有效期 15 分钟
- 不要用 JWT 做重置 token（无法主动失效）

---

## 常见踩坑

### 坑 1：并发刷新 Token 导致 race condition

**问题**：用户多个 Tab 同时发现 access_token 过期，都去请求 refresh，导致 refresh_token 被用了两次（第二次失败）。

**解决方案**：
- Web 端：用 singleton promise，第一个 refresh 请求发出后，后续请求等待同一个 promise
- 后端：refresh_token 使用时做原子操作（SELECT ... FOR UPDATE 或使用 token rotation）

**Token Rotation 方案**：每次刷新时旧 refresh_token 失效，返回新的 refresh_token。

### 坑 2：Flutter dispose 后调用 setState

**问题**：网络请求还在进行，Widget 被 dispose 后回调触发 setState，导致崩溃。

**解决**：用 Riverpod 的 AsyncNotifier，状态跟 Widget 生命周期解耦，避免此问题。

### 坑 3：JWT 的 exp 字段时区问题

JWT 的 `exp` 是 Unix 时间戳（UTC），但如果服务器时区设置错误，会导致 Token 立即过期或永不过期。

**检查**：签发时 `time.Now().Add(1 * time.Hour)` — Go 的 `time.Now()` 是本地时间但 Unix() 总是 UTC，安全。

---

## 测试重点

- 密码哈希：不能存明文，不能用 MD5/SHA1
- Token 过期：需要时间模拟（Mock `time.Now`）
- 并发刷新：用 goroutine 模拟多 Tab 同时刷新
- 登出后 refresh_token 失效：确保 DB 中记录被删除
- 邮箱大小写：注册时 lower-case 存储，登录时 lower-case 比较
