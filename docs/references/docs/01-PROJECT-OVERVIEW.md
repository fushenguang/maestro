# 01-PROJECT-OVERVIEW.md — 项目全景与设计决策

> **文档用途**：让 AI Agent 理解"我们在构建什么、为什么这样构建、核心权衡是什么"。
> 阅读顺序：首先阅读本文档，再按需跳转具体模块文档。

---

## 1. 项目定位

**Symphony-TS** 是 [openai/symphony](https://github.com/openai/symphony) 的 TypeScript 重新实现。

原版 Symphony 是一个将 Linear 等项目管理工具与 AI Coding Agent（Codex）连接的自动化调度框架——它将 Issue 转化为孤立的、由 AI 自主完成的开发任务。

本项目目标：
- 完全实现 `SPEC.md` 中的 MUST 条款
- 使用 TypeScript 替代 Elixir，完全掌控代码栈
- 提供桌面应用（Tauri v2，优先）+ 移动应用（Expo RN）的图形界面
- AI 编码模型使用 Claude Sonnet 4.6（通过 Anthropic API）
- 数据持久化使用自部署 Supabase（替代 Elixir 原版的内存状态）
- 后续通过 CLI 应用向其他 AI Agent 提供接口

---

## 2. 与原版 Symphony 的关键差异

| 维度 | openai/symphony (Elixir) | symphony-ts (本项目) |
|---|---|---|
| 实现语言 | Elixir/OTP | TypeScript + Rust (Tauri 层) |
| 并发模型 | BEAM GenServer + 进程 | Node.js event loop + child_process |
| 状态持久化 | 内存（进程重启丢失） | Supabase PostgreSQL（持久化） |
| AI 模型 | OpenAI Codex | Claude Sonnet 4.6 |
| 用户界面 | Phoenix LiveView（终端/Web） | Tauri 桌面 + Expo 移动 |
| Issue Tracker | Linear（硬编码） | 插件化 TrackerPort 接口 |
| 部署 | 单机守护进程 | 桌面应用内置 + 可选独立服务 |

---

## 3. 核心架构：Poll → Dispatch → Execute 循环

```
┌─────────────────────────────────────────────────────┐
│                    Orchestrator                      │
│  ┌─────────┐    ┌──────────┐    ┌─────────────────┐ │
│  │  Poll   │───▶│ Dispatch │───▶│  AgentRunner(s) │ │
│  │ (30s)   │    │ (状态机) │    │  (child_process)│ │
│  └─────────┘    └──────────┘    └─────────────────┘ │
│       │                │                 │           │
│       ▼                ▼                 ▼           │
│  ┌─────────┐    ┌──────────┐    ┌─────────────────┐ │
│  │ Linear  │    │ Supabase │    │  Claude Sonnet  │ │
│  │ Tracker │    │ (状态持久)│   │  4.6 (AI SDK)   │ │
│  └─────────┘    └──────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │  Tauri UI │
                    │  (Desktop)│
                    └───────────┘
```

---

## 4. 六个核心设计决策及其理由

### 决策 1：用 Supabase 替代内存状态

**原版问题**：Elixir 版本重启后所有运行状态丢失，无法跨会话恢复。

**我们的选择**：所有 Orchestrator 运行状态写入 Supabase，进程重启后从 DB 恢复。

**影响**：
- Orchestrator 需要在启动时执行 reconciliation（从 DB 恢复状态）
- 状态变更必须同时更新内存状态和 DB（双写）
- Supabase Realtime 驱动 UI 实时更新，无需轮询

### 决策 2：child_process 而非 Worker Thread

**理由**：每个 AgentRunner 是长时任务（可能运行数十分钟），需要真正的进程级隔离。Worker Thread 共享内存，一个 Agent 的异常状态可能污染整个进程，也无法使用 `child_process.kill` 干净终止。

**实现约束**：AgentRunner 以 fire-and-monitor 模式启动，Orchestrator 通过 IPC 事件接收状态，永远不 `await` AgentRunner 的完成。

### 决策 3：TrackerPort 接口抽象

**理由**：虽然初始实现对接 Linear，但架构必须允许未来接入 GitHub Issues、Jira、自定义系统等。

**实现**：所有 Tracker 操作通过 `TrackerPort` interface，`LinearTracker` 是第一个实现。切换 Tracker 只需替换 adapter，Orchestrator 无需修改。

### 决策 4：WORKFLOW.md 热加载

**理由**：团队在工作时可能需要调整 Agent 的 prompt 或配置，不应该要求重启应用。

**实现**：`chokidar` 监听文件变更，新配置在下一个 tick 周期生效。如果新配置解析失败，保留上一个已知有效配置继续运行。

### 决策 5：Tauri v2 作为桌面壳

**理由**：内部工具，性能和安装包体积比 Electron 重要。Tauri v2 原生支持 iOS/Android，未来可以从同一 Rust 核心扩展到移动端。

**约束**：Orchestrator 核心逻辑在 Node.js sidecar 中运行（`packages/core`），Tauri Rust 层负责系统集成（文件系统权限、进程管理、系统托盘）。

### 决策 6：AI SDK v6 而非直接调用 Anthropic API

**理由**：AI SDK v6 提供统一的流式 API、Agent loop 控制、工具调用类型安全、MCP 支持。未来切换或组合模型无需重写 Agent 逻辑。

---

## 5. 并发模型与限制

**目标并发**：10–50 个同时运行的 Agent。

Node.js 的事件循环是单线程的，但我们的 Agent 全部在子进程中运行，所以实际并发来自操作系统进程调度，不受 Node.js 单线程限制。

```
Node.js 主进程（Orchestrator）
    ├── child_process #1 (Agent for Issue #101) → Claude API
    ├── child_process #2 (Agent for Issue #102) → Claude API
    ├── child_process #3 (Agent for Issue #103) → Claude API
    ...
    └── child_process #50 (Agent for Issue #150) → Claude API
```

**并发上限**：由 `WORKFLOW.md` 中的 `agent.max_concurrent_agents` 配置，默认 5，最大建议 50（受 Claude API rate limit 和磁盘空间约束）。

---

## 6. 数据流与关键路径

```
1. Orchestrator.tick() 每 30s 触发
2. LinearTracker.fetchActiveIssues() → IssueRecord[]
3. Orchestrator.reconcile() 对比内存状态与 DB 状态
4. Orchestrator.dispatchCandidates() 为新 Issue 启动 AgentRunner
5. AgentRunner.run() → WorkspaceManager.create() → AppServerClient.start()
6. AppServerClient 向 Claude Sonnet 4.6 发送 prompt（含 Issue 上下文）
7. Claude 执行编码任务，通过 linear_graphql 动态工具更新 Issue 状态
8. AgentRunner 将进度事件写入 Supabase
9. Supabase Realtime 推送到 Tauri UI，实时更新 Dashboard
10. Issue 到达终止状态 → AgentRunner 结束 → WorkspaceManager.cleanup()
```

---

## 7. 禁止事项（Anti-patterns）

这些是已知的陷阱，Agent 不得引入：

```typescript
// ❌ 禁止：在 Orchestrator tick 中直接 await AgentRunner
await agentRunner.run(issue); // 会阻塞整个调度循环

// ❌ 禁止：在 async 回调中直接修改 Orchestrator 状态
someAsyncOp().then(() => {
  this.state.running[issueId] = 'done'; // race condition
});

// ❌ 禁止：使用 Worker Thread 做 Agent 隔离
new Worker('./agent-runner.js'); // 不是真正的进程隔离

// ❌ 禁止：Workspace 路径未验证
const ws = path.join(config.root, issueId); // 如果 issueId 含 ../，将逃逸

// ❌ 禁止：直接使用 any 类型
const data: any = await fetchIssue(); // 必须用 Zod 验证

// ✅ 正确：fire-and-monitor 模式
const runner = new AgentRunner(issue);
runner.on('status', (event) => this.dispatch({ type: 'AGENT_STATUS', event }));
runner.start(); // 不 await，通过事件通信
```
