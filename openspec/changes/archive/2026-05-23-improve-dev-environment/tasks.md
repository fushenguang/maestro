# Tasks: improve-dev-environment

## Acceptance Criteria

- **AC1** `test -f openspec/AGENTS.md` — openspec agent entrypoint 存在
- **AC2** `test -f apps/desktop/AGENTS.md` — desktop agent entrypoint 存在
- **AC3** `grep -q "product.md" AGENTS.md` — 根 AGENTS.md 引用 product boundary
- **AC4** `grep -q "openspec/AGENTS.md" AGENTS.md` — 根 AGENTS.md 引用 openspec AGENTS
- **AC5** `test -f packages/types/package.json` — shared types 包存在
- **AC6** `grep -q "@maestro/types" apps/desktop/package.json` — desktop 依赖 types 包
- **AC7** `test -f apps/desktop/.env.example` — env example 存在
- **AC8** `grep -q "VITE_SUPABASE_URL" apps/desktop/.env.example` — env 变量记录正确
- **AC9** `grep -q "test" turbo.json` — turbo 有 test 任务
- **AC10** `pnpm install && pnpm typecheck` 退出码 0

## Tasks

### 1. 根 `AGENTS.md` 重写

- [x] 1.1 删除所有 Symphony / Linear / Orchestrator 相关内容
- [x] 1.2 写明产品核心使命（一句话）
- [x] 1.3 添加文档导航表：需要做什么 → 先读哪个文件
  - 理解产品边界 → `openspec/specs/product.md`
  - 创建新 change → `openspec/AGENTS.md`
  - UI/数据/交互规格 → `docs/references/mvp/`
  - 架构决策 → `docs/architecture/vision.md`
  - 开发桌面应用 → `apps/desktop/AGENTS.md`
- [x] 1.4 添加技术栈速查（Tauri v2 + React 19 + SQLite + Supabase sync + LLM pool）
- [x] 1.5 添加「禁止事项」：不要读 docs/references/SPEC.md 等旧 Symphony 文档作为实现依据

### 2. `openspec/AGENTS.md` 新建

- [x] 2.1 说明 openspec 目录结构：`config.yaml`、`specs/`、`changes/`、`changes/archive/`
- [x] 2.2 说明 change 工作流：explore → proposal → design → tasks → implement → archive
- [x] 2.3 说明 `specs/` 目录作用（cross-cutting capability specs，`product.md` 是核心）
- [x] 2.4 添加注意事项：
  - 实现任何 change 前先读 `openspec/specs/product.md`
  - `changes/archive/` 只读，不得修改
  - `config.yaml` 的 context 是 agent 的起点，定期检查是否过期

### 3. `apps/desktop/AGENTS.md` 新建

- [x] 3.1 说明桌面应用的职责（Tauri v2 shell + React UI）
- [x] 3.2 目录结构说明：
  - `src/` — React UI（routes, components, store, lib）
  - `src-tauri/src/` — Rust backend（Tauri commands, SQLite, sync）
- [x] 3.3 Tauri 开发规范：
  - 所有数据操作通过 `tauri::command` 进行，不直接访问文件系统
  - SQLite 操作在 Rust 层，TypeScript 层只调用 command
  - 合同不可变在 Rust `update_idea` command 中检查
- [x] 3.4 本地开发启动：`pnpm dev`（在 apps/desktop 目录）
- [x] 3.5 shadcn/ui 约定：所有 UI 组件用 shadcn，不自己写基础组件

### 4. `packages/types` 包创建

- [x] 4.1 `packages/types/package.json`：`name: "@maestro/types"`，`main: "./src/index.ts"`，no dependencies
- [x] 4.2 `packages/types/tsconfig.json`：extends `../../tsconfig.base.json`
- [x] 4.3 `packages/types/src/enums/status.ts`：
  - `IdeaStatus`: `draft | active | at_risk | in_market | force_closed | closed_no_go`
  - `ProductType`: `paid | opensource | internal`
  - `SuccessMetric`: `paid_users | github_stars | weekly_downloads | url_reachable`
  - `FeedSourceType`: `text | url | github | file`
  - `UserType`: `technical | domain_expert`
  - `ProductStage`: `build | launch | scale`
- [x] 4.4 `packages/types/src/models/profile.ts`：`Profile` interface（对应 DB profiles 表）
- [x] 4.5 `packages/types/src/models/idea.ts`：`Idea` interface（对应 DB ideas 表，全部字段 camelCase）
- [x] 4.6 `packages/types/src/models/intent-canvas.ts`：`IntentCanvas`、`FieldStatus` type
- [x] 4.7 `packages/types/src/models/scope-item.ts`：`ScopeItem`，`ScopeItemType`，`ScopeItemStatus`
- [x] 4.8 `packages/types/src/models/validation.ts`：`ValidationReport`、`EvidenceItem`、`ValidationVerdict`
- [x] 4.9 `packages/types/src/models/contract.ts`：`Contract` interface
- [x] 4.10 `packages/types/src/models/evolution.ts`：`EvolutionNode`、`OpenspecChange`
- [x] 4.11 `packages/types/src/ui/product-row.ts`：`ProductRow`（dashboard 展示专用）
- [x] 4.12 `packages/types/src/index.ts`：re-export all
- [x] 4.13 `apps/desktop/package.json` 添加依赖：`"@maestro/types": "workspace:*"`

### 5. Turborepo 优化

- [x] 5.1 `turbo.json` 添加 `test` 任务（`dependsOn: ["^build"]`，`outputs: []`）
- [x] 5.2 `turbo.json` 为 `build`、`typecheck` 添加 `inputs` 字段
- [x] 5.3 根 `package.json` 添加 `"test": "turbo run test"` script

### 6. `apps/desktop/.env.example`

- [x] 6.1 创建 `.env.example`，包含 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_GITHUB_CLIENT_ID`，每个变量附注释说明
- [x] 6.2 确认 `.env.local` 已在 `.gitignore` 中

### 7. `README.md` 更新

- [x] 7.1 删除当前唯一的一行 Symphony 描述
- [x] 7.2 写产品一句话介绍
- [x] 7.3 写 prerequisites（Node ≥ 20、pnpm ≥ 9、Rust toolchain、Tauri CLI）
- [x] 7.4 写快速启动：`pnpm install` → `cp apps/desktop/.env.example apps/desktop/.env.local` → 填写环境变量 → `pnpm dev`
- [x] 7.5 写项目结构简介（`apps/desktop`、`packages/types`、`openspec/`、`docs/`）
