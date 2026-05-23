# Tasks: mvp-data-layer

## Acceptance Criteria

- **AC1** `grep -q "tauri-plugin-sql" apps/desktop/src-tauri/Cargo.toml`
- **AC2** `test -f apps/desktop/src-tauri/src/db/migrations/001_initial_schema.sql`
- **AC3** `grep -q "create table ideas" apps/desktop/src-tauri/src/db/migrations/001_initial_schema.sql`
- **AC4** `grep -q "contract_signed_at" apps/desktop/src-tauri/src/commands/ideas.rs` — 不可变检查存在
- **AC5** `grep -q "ContractImmutable" apps/desktop/src-tauri/src/error.rs` — 错误类型定义
- **AC6** `test -f apps/desktop/src-tauri/src/sync/queue.rs`
- **AC7** `test -f apps/desktop/src/lib/db.ts` — TypeScript bindings 存在
- **AC8** `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` 退出码 0
- **AC9** `pnpm typecheck` 退出码 0

## Tasks

### 1. Cargo 依赖 + Plugin 注册

- [ ] 1.1 `Cargo.toml` 添加 `tauri-plugin-sql = { version = "2", features = ["sqlite"] }`
- [ ] 1.2 `src/lib.rs` 中 `tauri::Builder` 添加 `.plugin(tauri_plugin_sql::Builder::default().build())`
- [ ] 1.3 `tauri.conf.json` 的 `allowlist` / `permissions` 添加 sql plugin 权限

### 2. DB 初始化模块

- [ ] 2.1 `src/db/mod.rs`：`init_db(app_handle)` 函数
  - 获取 `app_data_dir()` 路径
  - 确保目录存在
  - 连接 SQLite（`sqlite:maestro.db`）
  - 执行 `PRAGMA foreign_keys = ON`
  - 执行 `PRAGMA journal_mode = WAL`
  - 运行 migrations

### 3. Migration SQL

- [ ] 3.1 `001_initial_schema.sql`，按顺序创建：
  - `profiles` 表（字段对应 data-spec，UUID 用 TEXT）
  - `ideas` 表（所有 Phase 字段，状态机 check constraint）
  - `dialogue_messages` 表
  - `intent_canvas` 表（UNIQUE on idea_id）
  - `assumption_items` 表
  - `scope_items` 表
  - `validation_reports` 表（UNIQUE on idea_id）
  - `evidence_items` 表
  - `contracts` 表（UNIQUE on idea_id）
  - `evolution_nodes` 表
  - `openspec_changes` 表
  - `arch_decision_logs` 表
  - `feedback_signals` 表
  - `idea_events` 表（审计日志）
  - `sync_queue` 表（sync worker 用）
- [ ] 3.2 所有表添加合适的 INDEX（参考 data-spec 中的 index 声明）

### 4. 错误类型

- [ ] 4.1 `src/error.rs`：定义 `AppError` enum
  - `Database(sqlx::Error)` 或类似
  - `ContractImmutable(String)` — 合同签署后不允许修改
  - `NotFound(String)`
  - `ValidationError(String)`
- [ ] 4.2 `AppError` 实现 `serde::Serialize`（Tauri command 返回错误需要序列化）

### 5. Rust Commands

- [ ] 5.1 `commands/profiles.rs`：`get_profile`、`upsert_profile`
- [ ] 5.2 `commands/ideas.rs`：
  - `get_ideas`（返回 `Vec<Idea>`，按 `updated_at DESC`）
  - `get_idea(id)`
  - `create_idea(data: CreateIdeaInput)`
  - `update_idea(id, data: UpdateIdeaInput)` ← **合同不可变检查在此**
  - `delete_idea(id)`（仅允许 `status = 'draft'`）
- [ ] 5.3 `commands/dialogue.rs`：`get_dialogue_messages(idea_id)`、`add_dialogue_message`
- [ ] 5.4 `commands/intent.rs`：`get_intent_canvas(idea_id)`、`upsert_intent_canvas`
- [ ] 5.5 `commands/boundary.rs`：
  - `get_scope_items(idea_id)`
  - `upsert_scope_item`
  - `delete_scope_item(id)`
  - `lock_boundary(idea_id)` ← 检查所有 scope_items confirmed，设置 `boundary_locked_at`
- [ ] 5.6 `commands/validation.rs`：`get_validation_report`、`upsert_validation_report`、`get_evidence_items`、`add_evidence_item`
- [ ] 5.7 `commands/contracts.rs`：
  - `get_contract(idea_id)`
  - `sign_contract(idea_id, data: SignContractInput)` ← 不可逆，设置 `contract_signed_at`，同时更新 `ideas.status = 'active'`
- [ ] 5.8 `commands/evolution.rs`：`get_evolution_nodes`、`create_evolution_node`、`get_openspec_changes`
- [ ] 5.9 `commands/mod.rs`：注册所有 commands 到 `tauri::Builder`

### 6. Sync Queue 骨架

- [ ] 6.1 `sync/queue.rs`：`enqueue(db, table, row_id, operation, payload)` 函数
- [ ] 6.2 `sync/worker.rs`：后台 task（`tauri::async_runtime::spawn`），每 30 秒执行一次
  - 读取 `sync_queue WHERE attempts < 5`
  - HTTP POST 到 Supabase REST API（从 `AppConfig` 读取 URL + anon key）
  - 成功 → delete，失败 → `attempts += 1`
- [ ] 6.3 `update_idea`、`create_idea`、`sign_contract` 等写操作完成后调用 `enqueue`

### 7. TypeScript Bindings

- [ ] 7.1 `apps/desktop/src/lib/db.ts`：封装所有 `invoke` 调用
  - 引入 `@maestro/types` 的类型
  - 每个 command 对应一个类型化函数
- [ ] 7.2 `apps/desktop/src/lib/db.ts` 导出 `db` 对象供 UI 层使用

### 8. AppState 集成

- [ ] 8.1 `src/lib.rs` 定义 `AppState`（包含 db 连接 + config）
- [ ] 8.2 `setup` hook 中初始化 DB，启动 sync worker
- [ ] 8.3 `AppState` 通过 `manage()` 注入 Tauri app
