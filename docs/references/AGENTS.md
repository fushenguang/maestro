# AGENTS.md — Symphony-TS Project Agent Entrypoint

> **面向 AI Coding Agent 的项目导航文件。**
> 这是你在此 monorepo 中工作时应该首先阅读的文件。
> 所有文档遵循 RFC 风格：MUST / SHOULD / MAY 有明确含义。

---

## 快速定位

| 你要做的事 | 先读这份文档 |
|---|---|
| 理解整体项目架构 | [`docs/01-PROJECT-OVERVIEW.md`](./docs/01-PROJECT-OVERVIEW.md) |
| 搭建开发环境 | [`docs/02-MONOREPO-SETUP.md`](./docs/02-MONOREPO-SETUP.md) |
| 理解数据模型与 Supabase schema | [`docs/03-DATA-LAYER.md`](./docs/03-DATA-LAYER.md) |
| 实现 Symphony Orchestrator 核心 | [`docs/04-ORCHESTRATOR.md`](./docs/04-ORCHESTRATOR.md) |
| 实现 AI Agent Runner（Codex 集成） | [`docs/05-AGENT-RUNNER.md`](./docs/05-AGENT-RUNNER.md) |
| 实现 Issue Tracker 集成（Linear 等） | [`docs/06-TRACKER-INTEGRATION.md`](./docs/06-TRACKER-INTEGRATION.md) |
| 实现 Workspace 管理 | [`docs/07-WORKSPACE-MANAGER.md`](./docs/07-WORKSPACE-MANAGER.md) |
| 实现 WORKFLOW.md 配置系统 | [`docs/08-WORKFLOW-CONFIG.md`](./docs/08-WORKFLOW-CONFIG.md) |
| 构建 Tauri 桌面应用（优先） | [`docs/09-TAURI-DESKTOP.md`](./docs/09-TAURI-DESKTOP.md) |
| 构建 iOS / Android 移动端 | [`docs/10-MOBILE-APP.md`](./docs/10-MOBILE-APP.md) |
| 集成 AI SDK v6（Vercel） | [`docs/11-AI-SDK-INTEGRATION.md`](./docs/11-AI-SDK-INTEGRATION.md) |
| 实现 UI 组件层（shadcn/ui） | [`docs/12-UI-COMPONENTS.md`](./docs/12-UI-COMPONENTS.md) |
| 实现实时 Dashboard | [`docs/13-DASHBOARD.md`](./docs/13-DASHBOARD.md) |
| 编写 CLI 应用文档（规格，暂不实现代码） | [`docs/14-CLI-SPEC.md`](./docs/14-CLI-SPEC.md) |
| 理解类型系统与共享 schema | [`docs/15-TYPE-SYSTEM.md`](./docs/15-TYPE-SYSTEM.md) |
| 测试策略 | [`docs/16-TESTING.md`](./docs/16-TESTING.md) |
| CI/CD 与发布 | [`docs/17-CICD.md`](./docs/17-CICD.md) |
| 安全边界与信任模型 | [`docs/18-SECURITY.md`](./docs/18-SECURITY.md) |

---

## 技术栈速查

```
运行时核心
  语言:         TypeScript (strict mode)
  包管理:       pnpm 9.x + workspaces
  Monorepo:     Turborepo (latest)
  规格依据:     openai/symphony SPEC.md (Apache 2.0)

应用层
  桌面:         Tauri v2.11.x (Rust 后端 + WebView 前端)
  移动端:       React Native (Expo SDK 54) via Tauri mobile
  AI 编码模型:  Claude Sonnet 4.6 (via Anthropic API)

前端
  UI 框架:      React 19 + TypeScript
  UI 组件库:    shadcn/ui (Tailwind CSS v4)
  AI SDK:       Vercel AI SDK v6 (@ai-sdk/anthropic)

数据层
  数据库:       Supabase (自部署 PostgreSQL + Realtime)
  ORM:          Drizzle ORM
  实时:         Supabase Realtime (WebSocket)

后端服务（Tauri sidecar 或 Node.js）
  HTTP:         Hono (轻量, TypeScript-first)
  验证:         Zod v3
  日志:         Pino

CLI（规格阶段，代码后续实现）
  框架:         Commander.js 或 Yargs
  交互:         Inquirer.js + Ora
```

---

## Monorepo 结构预览

```
symphony-ts/
├── AGENTS.md                    ← 你在这里
├── SPEC.md                      ← 从 openai/symphony 复制的规格文件（只读）
├── WORKFLOW.md                  ← 工作流配置（agents 会读取这个文件）
│
├── apps/
│   ├── desktop/                 ← Tauri v2 桌面应用（优先）
│   │   ├── src/                 ← React 前端
│   │   └── src-tauri/          ← Rust 后端
│   ├── mobile/                  ← Expo React Native（iOS + Android）
│   └── cli/                     ← CLI 应用（规格阶段，代码待实现）
│
├── packages/
│   ├── core/                    ← Symphony 核心逻辑（Orchestrator, Runner 等）
│   ├── ui/                      ← 共享 UI 组件（shadcn/ui 封装）
│   ├── db/                      ← Supabase + Drizzle schema 和 client
│   ├── ai/                      ← AI SDK 封装和 prompt 管理
│   ├── tracker/                 ← Issue Tracker 适配器（Linear 等）
│   └── config/                  ← 共享 TypeScript/ESLint/Prettier 配置
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 关键约束（所有 Agent 必须遵守）

1. **SPEC.md 是实现合同**：所有 MUST 条款必须实现，SHOULD 条款应该实现，MAY 条款可选。
2. **类型安全优先**：所有模块间通信必须有 Zod schema 验证，绝不使用 `any`。
3. **状态变更单点化**：Orchestrator 的状态变更必须走 `dispatch(action)` 单一入口，禁止在 async 回调中直接修改状态。
4. **进程隔离**：每个 AgentRunner 必须运行在独立子进程（`child_process.spawn`），不得使用 Worker Thread。
5. **路径安全**：Workspace 路径操作必须验证不逃逸根目录（path traversal 防护）。
6. **AI 模型锁定**：编码任务使用 `claude-sonnet-4-6`，不得在代码中硬编码其他模型，通过配置引入。
