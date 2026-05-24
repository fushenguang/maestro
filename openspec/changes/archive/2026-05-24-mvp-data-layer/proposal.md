# mvp-data-layer

## Why

当前桌面应用（Tauri shell + GitHub auth）没有任何本地数据持久化层。Phase 0–5 的所有产品数据——对话历史、Intent Canvas、Scope Items、验证报告、合同——都需要本地存储，并同步到 Supabase。

在实现任何 Phase UI 之前必须先有稳固的数据层，否则各 Phase 的 UI change 无从依赖。

**架构决策（来自 `openspec/specs/product.md`）：**
- 本地 SQLite 是主存储（source of truth）
- Supabase 是远端 sync 目标，不是主读写路径
- 合同不可变约束在 Rust 应用层实现，不依赖 DB trigger

## What Changes

### 1. tauri-plugin-sql 集成

- `apps/desktop/src-tauri/Cargo.toml` 添加 `tauri-plugin-sql` 依赖（SQLite feature）
- `apps/desktop/src-tauri/src/lib.rs` 注册 plugin
- 初次启动时自动创建数据库文件（`$APPDATA/maestro/maestro.db`）

### 2. SQLite Schema（初始化迁移）

创建 `apps/desktop/src-tauri/src/db/migrations/` 目录，实现 schema 初始化：

核心表（按依赖顺序）：
1. `profiles` — 用户资料（1:1 with auth.users）
2. `ideas` — 产品核心实体（含完整状态机字段）
3. `dialogue_messages` — Intent Dialogue 对话历史
4. `intent_canvas` — Phase 1 输出（1:1 per idea）
5. `assumption_items` — Phase 1-2 假设条目
6. `scope_items` — Phase 2 范围条目
7. `validation_reports` — Phase 3 验证报告（1:1 per idea）
8. `evidence_items` — Phase 3 证据条目
9. `contracts` — Phase 4 产品合同（1:1 per idea）
10. `evolution_nodes` — Phase 5 演进节点
11. `openspec_changes` — Phase 5 openspec changes
12. `arch_decision_logs` — Phase 5 架构决策日志
13. `feedback_signals` — Phase 5 市场信号
14. `idea_events` — 审计日志

### 3. Rust Command Layer

`apps/desktop/src-tauri/src/commands/` 目录下按模块组织：

- `ideas.rs`：`get_ideas`、`get_idea`、`create_idea`、`update_idea`（含合同不可变检查）、`delete_idea`（草稿期才允许）
- `profiles.rs`：`get_profile`、`upsert_profile`
- `dialogue.rs`：`get_dialogue_messages`、`add_dialogue_message`
- `intent.rs`：`get_intent_canvas`、`upsert_intent_canvas`
- `boundary.rs`：`get_scope_items`、`upsert_scope_item`、`lock_boundary`
- `validation.rs`：`get_validation_report`、`upsert_validation_report`、`get_evidence_items`、`add_evidence_item`
- `contracts.rs`：`get_contract`、`sign_contract`（不可逆，检查所有必填字段）
- `evolution.rs`：`get_evolution_nodes`、`create_evolution_node`

### 4. 合同不可变约束（Rust 层）

`update_idea` command 在 Rust 中检查：若 `contract_signed_at` 已设置，则拒绝修改 `deadline`、`success_metric`、`target_n`、`product_type`，返回错误。

### 5. Supabase Sync 骨架

`apps/desktop/src-tauri/src/sync/` 目录：
- `queue.rs`：本地写操作入队列（SQLite `sync_queue` 表）
- `worker.rs`：后台 worker，每 30 秒尝试将队列中的操作发送到 Supabase REST API
- 失败时保留队列，下次重试（指数退避）

## Impact

- **新增**：`src-tauri/src/db/`、`src-tauri/src/commands/`、`src-tauri/src/sync/`
- **修改**：`Cargo.toml`、`src-tauri/src/lib.rs`（注册 commands）
- **新增 TypeScript bindings**：Tauri command 调用的 TypeScript 封装 `apps/desktop/src/lib/db.ts`

## Out of scope（显式不做）

- 任何 Phase UI 组件
- LLM 调用集成（数据层只存储，不调用）
- GitHub API 集成
- 真实的 Supabase 数据同步逻辑完整实现（骨架即可，v0.1 不依赖 sync 完整性）
- Supabase Realtime 订阅（本地 SQLite 是主源，不需要 Realtime）
