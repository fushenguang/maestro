# ADR.md — 架构决策记录（Architecture Decision Records）

> **用途**：记录重要的架构决策、决策背景和被拒绝的备选方案。
> AI Agent 在修改架构相关代码时，必须先查阅此文件，理解决策背景后再提出修改建议。

---

## ADR-001：使用 child_process.spawn 而非 Worker Thread 做 Agent 隔离

**日期**：2026-05  
**状态**：已采纳

### 背景
AgentRunner 需要运行长时任务（数分钟到数十分钟），需要进程级隔离以防止一个 Agent 的崩溃影响整个系统。

### 决策
每个 AgentRunner 在独立的 `child_process.spawn` 子进程中运行。

### 理由
- Worker Thread 共享内存，一个 thread 的未捕获异常可能污染主进程状态
- `child_process` 提供真正的操作系统进程隔离，崩溃不影响主进程
- 可以通过 `process.kill(pid)` 精确终止特定 Agent
- 更接近 Elixir/BEAM 原版的进程隔离模型
- 50 个并发子进程对现代操作系统完全无压力

### 被拒绝的方案
- **Worker Thread**：内存共享，隔离不彻底，放弃
- **独立 Docker 容器**：开销过大，对内部工具过度设计，放弃

---

## ADR-002：Orchestrator 使用 Redux-like Reducer 管理状态

**日期**：2026-05  
**状态**：已采纳

### 背景
Orchestrator 需要管理多个并发 Agent 的状态，原版 Elixir 使用 GenServer 消息队列天然保证串行化。TypeScript 缺少这种原生机制。

### 决策
所有状态变更通过纯函数 `orchestratorReducer(state, action) => newState` 实现，`dispatch()` 是唯一的状态变更入口。

### 理由
- 纯函数 reducer 易于单元测试（不需要 mock 任何异步操作）
- 所有状态变更集中在一处，便于调试和追踪
- `dispatch()` 是同步的，Node.js 单线程保证不会并发调用
- 状态快照方便序列化到 DB（持久化恢复）

### 被拒绝的方案
- **直接在各处修改 `this.state`**：难以追踪状态变更来源，race condition 风险，放弃
- **XState 状态机库**：增加学习成本和依赖，对此规模过度设计，放弃

---

## ADR-003：使用 AI SDK v6 替代直接 stdio 协议与 Codex 通信

**日期**：2026-05  
**状态**：已采纳

### 背景
原版 Symphony 通过 `stdio` JSON-RPC 与 Codex CLI 进程通信（AppServer 协议）。

### 决策
使用 Vercel AI SDK v6 直接调用 Claude API（`generateText` + `maxSteps` agent loop），完全省去 Codex CLI 中间进程。

### 理由
- AI SDK v6 的 `maxSteps` 参数原生支持 agent loop，无需手动实现 while 循环
- 类型安全的工具调用（Zod schema）
- 统一的流式 API，方便未来切换或组合模型
- 省去维护 stdio 通信协议的复杂性
- AI SDK v6 内置 MCP 支持，为未来扩展留口

### 被拒绝的方案
- **直接 Anthropic SDK**：失去 AI SDK 的 agent loop 抽象和跨 provider 兼容性
- **保留 stdio 协议**：维护成本高，依赖 Codex CLI 版本，放弃

### 未来兼容性
如果需要对接其他以 CLI 形式提供的 AI Agent，可以新增 `AppServerClientStdio` 实现同一接口，与 AI SDK 实现并存。

---

## ADR-004：使用 Supabase 替代原版内存状态

**日期**：2026-05  
**状态**：已采纳

### 背景
原版 Symphony 所有运行状态在内存中，进程重启后丢失。这对内部工具来说是可接受的，但会导致：
- 重启后无法知道哪些 Issue 正在运行中
- 无法在 UI 中查看历史运行记录
- 无法从手机端查看运行状态

### 决策
使用自部署 Supabase（PostgreSQL + Realtime）作为状态持久化和实时推送的基础设施。

### 理由
- Orchestrator 重启后可从 DB 恢复状态（reconcile）
- Supabase Realtime 让 UI 被动消费状态变更，无需轮询
- 移动端可以通过相同的 Supabase 连接查看实时状态
- 自部署保证数据不出内网
- Drizzle ORM 提供类型安全的查询，无运行时 schema 问题

### 被拒绝的方案
- **SQLite**：Realtime 支持差，移动端跨设备同步困难，放弃
- **Redis**：需要额外维护，Supabase 已经包含 PostgreSQL，不必引入更多基础设施

---

## ADR-005：Turborepo monorepo 中 packages/core 独立于 Tauri

**日期**：2026-05  
**状态**：已采纳

### 背景
Symphony 核心逻辑（Orchestrator、AgentRunner 等）需要同时在桌面应用和未来的 CLI 中使用。

### 决策
将所有核心逻辑放在 `packages/core`（纯 Node.js，无 Tauri 依赖），Tauri 应用通过 sidecar 模式运行 core 包，或通过 IPC 通信。

### 理由
- `packages/core` 可独立测试，无需启动 Tauri
- CLI 应用（`apps/cli`）可直接 import `@symphony/core`，无需 Tauri 层
- 未来如果需要服务端部署（非桌面模式），core 包可直接使用
- 符合关注点分离原则：业务逻辑与 UI 框架解耦

### Tauri 层的职责
- 文件系统权限声明（capability 系统）
- 系统托盘
- 原生窗口管理
- 调用 Node.js sidecar（运行 core 包）

---

## ADR-006：CLI 应用暂时只实现规格文档，不实现代码

**日期**：2026-05  
**状态**：已采纳

### 背景
CLI 应用面向其他 AI Agent 提供接口，但目前优先级低于桌面和移动应用。

### 决策
在 `apps/cli/` 目录下只放置规格文档（`docs/14-CLI-SPEC.md`），代码实现推迟到桌面应用稳定后。

### 理由
- 避免过早投入开发资源在低优先级功能上
- CLI 的 API 设计依赖核心功能的稳定，过早实现可能需要大量返工
- 规格文档已经明确了接口契约，AI Agent 未来可以直接根据规格生成代码

---

## ADR-007：shadcn/ui 组件集中在 packages/ui，apps 不直接安装

**日期**：2026-05  
**状态**：已采纳

### 背景
shadcn/ui 在 monorepo 中的典型用法有两种：每个 app 独立安装，或共享一个 UI 包。

### 决策
所有 shadcn/ui 组件安装在 `packages/ui`，通过 `@symphony/ui` 导出给所有应用使用。

### 理由
- 保证跨应用的视觉一致性（桌面端和移动端 Web 视图共享同一组件库）
- 只需在一处升级组件版本
- 避免同一组件在多个 app 中重复定制化

### 注意事项
- 移动端（Expo RN）使用 NativeWind，不能直接使用 shadcn/ui 的 HTML 组件
- 对于需要原生 RN 组件的情况，在 `packages/ui` 中提供平台适配版本（`.native.tsx` 后缀）
