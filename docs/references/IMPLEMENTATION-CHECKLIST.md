# IMPLEMENTATION-CHECKLIST.md — 实现清单（面向 AI Agent）

> **用途**：AI Coding Agent 的实现路线图，按优先级和依赖顺序排列。
> 每个任务包含：前置依赖、验收标准、参考文档。
> **状态标记**：⬜ 未开始 / 🔄 进行中 / ✅ 完成 / ❌ 阻塞

---

## Phase 0：基础设施（无依赖，最先执行）

### P0-1 ⬜ Monorepo 基础结构初始化
**参考**：`docs/02-MONOREPO-SETUP.md`  
**任务**：
- [ ] 初始化 pnpm workspace（`pnpm-workspace.yaml`）
- [ ] 配置 `turbo.json`（所有任务类型）
- [ ] 创建 `tsconfig.base.json`（strict mode，所有约束）
- [ ] 创建所有包目录结构（`apps/*`、`packages/*`）
- [ ] 配置 ESLint + Prettier（共享配置在 `packages/config/`）
- [ ] 配置 `.env.example`（所有需要的环境变量）

**验收标准**：
```bash
pnpm install  # 无报错
pnpm typecheck  # 无错误（空项目）
pnpm lint  # 无错误
```

---

### P0-2 ⬜ Supabase 本地环境 + Schema 初始化
**参考**：`docs/03-DATA-LAYER.md`  
**前置**：P0-1  
**任务**：
- [ ] 初始化 `packages/db/`（Drizzle ORM + Supabase client）
- [ ] 定义所有 Drizzle schema（issues, agent_sessions, agent_events, workflow_configs）
- [ ] 生成并应用迁移文件
- [ ] 配置 RLS 策略（service_role 完全访问，anon 只读）
- [ ] 实现 `issueQueries`、`agentSessionQueries`、`agentEventQueries`
- [ ] 实现 Realtime 订阅封装（`realtime.ts`）
- [ ] 编写 schema 单元测试（验证类型推导正确）

**验收标准**：
```bash
supabase start
pnpm db:generate  # 生成迁移文件
pnpm db:migrate   # 应用迁移，无报错
# DB 中存在所有表
```

---

## Phase 1：Core 包（Symphony 核心逻辑）

### P1-1 ⬜ TrackerPort 接口 + Linear 适配器
**参考**：`docs/06-08-TRACKER-WORKSPACE-WORKFLOW.md`（06 部分）  
**前置**：P0-1  
**任务**：
- [ ] 定义 `TrackerPort` interface（`packages/tracker/src/port.ts`）
- [ ] 实现 `LinearTracker`（`@linear/sdk`）
  - [ ] `fetchIssues()` with state filter
  - [ ] `fetchIssue()` 单个查询
  - [ ] `executeGraphQL()` with multi-operation validation
- [ ] 实现 `MemoryTracker`（测试用）
- [ ] 为 `LinearTracker` 编写集成测试（需要 `LINEAR_API_KEY`，标记为 `@integration`）
- [ ] 为 `MemoryTracker` 编写单元测试

**验收标准**：
```bash
pnpm --filter @symphony/tracker test  # 单元测试全部通过
# LinearTracker.fetchIssues() 能正确返回 Linear Issues
```

---

### P1-2 ⬜ WorkflowLoader（WORKFLOW.md 解析 + 热加载）
**参考**：`docs/06-08-TRACKER-WORKSPACE-WORKFLOW.md`（08 部分）  
**前置**：P0-1  
**任务**：
- [ ] 定义 `WorkflowConfigSchema`（Zod，覆盖 SPEC.md 所有字段）
- [ ] 实现 `WorkflowLoader.load()`（`gray-matter` + 环境变量替换 + Zod 验证）
- [ ] 实现热加载（`chokidar`）：变更成功则通知，失败则保留上一个
- [ ] 实现 `PromptRenderer.render()`（Mustache 风格模板替换）
- [ ] 编写单元测试（有效配置、无效配置、环境变量缺失、热加载）

**验收标准**：
```bash
pnpm --filter @symphony/core test -- --grep "WorkflowLoader"
# 所有测试通过，包括：
# - 有效 WORKFLOW.md 正确解析
# - 无效配置抛出 ValidationError
# - 缺失环境变量抛出 MissingEnvError
# - 文件变更触发 reload callback
```

---

### P1-3 ⬜ WorkspaceManager（Workspace 生命周期）
**参考**：`docs/06-08-TRACKER-WORKSPACE-WORKFLOW.md`（07 部分）  
**前置**：P0-1  
**任务**：
- [ ] 实现 `WorkspaceManager.create(issueId)`
  - [ ] 路径安全验证（`safeJoin()`，防 path traversal）
  - [ ] `git clone --depth=1` 创建独立副本
  - [ ] 执行 `post_create` hook（如果配置了）
- [ ] 实现 `WorkspaceManager.cleanup(issueId, path)`
  - [ ] `fs.rm` 递归删除
  - [ ] 执行 `pre_cleanup` hook（如果配置了）
- [ ] 编写单元测试（path traversal 攻击、正常创建、清理）

**验收标准**：
```bash
pnpm --filter @symphony/core test -- --grep "WorkspaceManager"
# 特别验证：
# safeJoin('../../../etc/passwd') 抛出 PathTraversalError
# safeJoin('issue-123') 返回正确路径
```

---

### P1-4 ⬜ AI SDK 集成（packages/ai）
**参考**：`docs/10-14-MOBILE-AI-UI-CLI.md`（11 部分）  
**前置**：P0-1  
**任务**：
- [ ] 初始化 `packages/ai/`
- [ ] 配置 `@ai-sdk/anthropic` provider（`claude-sonnet-4-6`）
- [ ] 实现 `runCodingAgent()`（`generateText` + `maxSteps` agent loop）
- [ ] 定义所有工具的 Zod schema（`linear_graphql`、`read_file`、`run_command`）
- [ ] 实现系统 prompt（`SYSTEM_PROMPT` 常量）
- [ ] 编写单元测试（使用 AI SDK 的 `MockLanguageModelV1`）

**验收标准**：
```bash
pnpm --filter @symphony/ai test  # mock 测试通过
# runCodingAgent() 能完整执行一轮对话（用 mock model）
```

---

### P1-5 ⬜ AgentRunner 实现
**参考**：`docs/05-AGENT-RUNNER.md`  
**前置**：P1-2（WorkflowLoader）、P1-3（WorkspaceManager）、P1-4（AI SDK）、P0-2（DB）  
**任务**：
- [ ] 实现 `AgentRunner` 类（EventEmitter）
  - [ ] `start()` 立即返回（不阻塞），内部 `_run()` 异步执行
  - [ ] `_run()` 流程：create workspace → render prompt → create session → run agent → cleanup
  - [ ] 事件发射：`started`、`succeeded`、`failed`、`agent_event`
  - [ ] `AbortSignal` 集成（优雅终止）
- [ ] 实现 `AppServerClient`（AI SDK 封装，工具执行）
- [ ] `agent_events` 写入（fire-and-forget，不阻塞 Agent）
- [ ] 编写集成测试（使用 MemoryTracker + mock AI model）

**验收标准**：
```bash
# AgentRunner 能跑通一个完整的 mock session
# AbortSignal 触发后，AgentRunner 在 5s 内干净退出
# workspace 在任何情况下（成功/失败/abort）都被清理
```

---

### P1-6 ⬜ Orchestrator 状态机（核心，最复杂）
**参考**：`docs/04-ORCHESTRATOR.md`  
**前置**：P1-1、P1-2、P1-3、P1-5、P0-2  
**任务**：
- [ ] 实现 `OrchestratorState` 类型和 `OrchestratorAction` union
- [ ] 实现纯函数 `orchestratorReducer()`（所有 action 处理）
- [ ] 实现 `Orchestrator` 主类
  - [ ] `start()`（加载 workflow → reconcile → 启动 tick 循环）
  - [ ] `stop()`（优雅关闭所有 agent → 清理）
  - [ ] `tick()`（fetch → reconcile → retry → dispatch，带 lock）
  - [ ] `launchAgent()`（fire-and-monitor，绑定事件监听）
  - [ ] `stopAgent()`（abort + 状态更新）
  - [ ] `recoverFromDatabase()`（进程重启恢复）
  - [ ] `dispatch(action)`（状态变更唯一入口）
- [ ] 编写 reducer 单元测试（所有 action 类型）
- [ ] 编写 Orchestrator 集成测试（MemoryTracker，验证并发行为）

**验收标准**：
```bash
pnpm --filter @symphony/core test  # 所有测试通过
# 特别验证：
# - 并发 tick 被正确跳过
# - Agent 失败后正确触发退避重试
# - 超过 maxRetries 后状态变为 failed
# - 进程重启后 DB 中 running 状态重置为 idle
```

---

## Phase 2：Tauri 桌面应用（优先）

### P2-1 ⬜ Tauri 项目初始化
**参考**：`docs/09-TAURI-DESKTOP.md`  
**前置**：P0-1  
**任务**：
- [ ] `create-tauri-app` 初始化（React + TypeScript + Vite）
- [ ] 配置 `tauri.conf.json`（窗口、CSP、bundle 设置）
- [ ] 配置 `capabilities/default.json`（权限声明，最小权限原则）
- [ ] 集成 TanStack Router（文件路由）
- [ ] 集成 TanStack Query（服务端状态管理）
- [ ] 集成 Zustand（客户端状态）
- [ ] 配置 `@symphony/ui` 共享（Tailwind CSS v4 + shadcn/ui）
- [ ] 验证 `pnpm tauri dev` 可以启动

**验收标准**：
```bash
pnpm dev:desktop  # Tauri 窗口打开，显示空白 React 页面，无 console 错误
```

---

### P2-2 ⬜ Tauri IPC Commands 实现
**参考**：`docs/09-TAURI-DESKTOP.md`（Rust commands 部分）  
**前置**：P2-1  
**任务**：
- [ ] 实现 Rust commands（`orchestrator.rs`）
  - [ ] `start_orchestrator`（启动 Node.js sidecar）
  - [ ] `stop_orchestrator`
  - [ ] `get_orchestrator_status`
  - [ ] `read_workflow_file`
  - [ ] `write_workflow_file`
- [ ] 在 `lib.rs` 注册所有 commands
- [ ] 配置 Node.js sidecar（将 `packages/core` 编译为可执行文件）
- [ ] 前端 TypeScript bindings（`useSymphonyCore.ts` hook）

**验收标准**：
```bash
# invoke('get_orchestrator_status') 从前端返回正确的 Rust 结构
# invoke('read_workflow_file') 能读取 WORKFLOW.md 内容
```

---

### P2-3 ⬜ 实时 Dashboard UI
**参考**：`docs/09-TAURI-DESKTOP.md`（前端部分）、`docs/10-14-MOBILE-AI-UI-CLI.md`（12 部分）  
**前置**：P2-1、P2-2、P0-2（Supabase）  
**任务**：
- [ ] 实现 `useRealtimeIssues` hook（Supabase Realtime 订阅）
- [ ] 实现 Dashboard 页面（`routes/index.tsx`）
  - [ ] `MetricsBar`（Orchestrator 状态 + 运行数量 + 总计）
  - [ ] Running issues 列表（`IssueCard` 组件）
  - [ ] Failed issues 列表
- [ ] 实现 Issue 详情页（`routes/issues/$issueId.tsx`）
  - [ ] Issue 基本信息
  - [ ] Agent 会话历史（`agent_sessions` 列表）
  - [ ] 实时事件流（最新会话的 `agent_events`）
- [ ] 实现 Settings 页（`routes/settings/index.tsx`）
  - [ ] WORKFLOW.md 编辑器（代码编辑器或简单 textarea）
  - [ ] API key 配置（写入系统 keychain via Tauri）
  - [ ] Orchestrator 启动/停止控制
- [ ] 实现共享 UI 组件（`packages/ui/`）
  - [ ] `IssueCard`
  - [ ] `MetricsBar`
  - [ ] `AgentStatusBadge`
  - [ ] `EventLogItem`

**验收标准**：
```bash
# Dashboard 实时显示 running issues，30s 内反映 Linear 的新 Issue
# Issue 详情页能看到 Agent 运行的 event log
# Settings 页能保存 WORKFLOW.md 修改，Orchestrator 热加载生效
```

---

### P2-4 ⬜ 系统托盘 + 生命周期管理
**参考**：`docs/09-TAURI-DESKTOP.md`（系统托盘部分）  
**前置**：P2-2  
**任务**：
- [ ] 实现系统托盘（`tray-icon`）
  - [ ] Open / Quit 菜单项
  - [ ] Orchestrator 状态图标（运行中 = 绿点，停止 = 灰点）
- [ ] 窗口关闭时最小化到托盘（不退出进程）
- [ ] 应用启动时自动启动 Orchestrator（可配置）

---

### P2-5 ⬜ 桌面应用打包与分发
**参考**：`docs/17-CICD.md`  
**前置**：P2-1 ~ P2-4  
**任务**：
- [ ] 配置 `tauri-action` GitHub Actions workflow
- [ ] 配置代码签名（macOS、Windows）
- [ ] 配置自动更新（Tauri updater）
- [ ] 生成 `.dmg`（macOS）、`.exe`（Windows）、`.AppImage`（Linux）

---

## Phase 3：移动端应用

### P3-1 ⬜ Expo 项目初始化
**参考**：`docs/10-14-MOBILE-AI-UI-CLI.md`（10 部分）  
**前置**：P0-1  
**任务**：
- [ ] 初始化 Expo SDK 54 项目（`apps/mobile/`）
- [ ] 配置 Metro（monorepo 支持）
- [ ] 配置 NativeWind v5（Tailwind CSS v4）
- [ ] 配置 Expo Router v4（文件路由）
- [ ] 集成 `@symphony/db`（Supabase Realtime）

---

### P3-2 ⬜ 移动端核心页面
**前置**：P3-1、P0-2（Supabase）  
**任务**：
- [ ] Dashboard Tab（运行中的 Agent 列表）
- [ ] Issues Tab（所有 Issue + 状态）
- [ ] Issue 详情页（session log）
- [ ] Settings Tab（Orchestrator 连接配置）
- [ ] 推送通知（Agent 完成/失败时通知）

---

## Phase 4：CLI 应用（最后实现）

### P4-1 ⬜ CLI 代码实现
**参考**：`docs/10-14-MOBILE-AI-UI-CLI.md`（14 部分）、`docs/ADR.md`（ADR-006）  
**前置**：P1-6（core 稳定）  
**任务**：
- [ ] 实现所有 CLI 命令（参考 CLI SPEC）
- [ ] 实现 `--json` 输出模式
- [ ] 编写 CLI E2E 测试

---

## 实现注意事项（所有 Phase 通用）

### 每个功能实现时必须：
1. **先读相关 ADR**：理解设计决策背景再动手
2. **写 Zod schema 再写逻辑**：类型定义先行
3. **写测试再实现**（TDD 风格）：至少写好测试骨架
4. **更新此清单**：完成任务后将 ⬜ 改为 ✅

### 遇到以下情况停止并请求澄清：
- SPEC.md 与 ADR.md 存在冲突
- 需要新增 ADR 中未覆盖的架构决策
- 发现性能问题（如 DB 查询慢）需要 schema 变更
- 测试无法通过且原因不明确
