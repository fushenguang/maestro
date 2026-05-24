# Design: mvp-data-layer

## SQLite Schema 适配说明

`docs/references/mvp/maestro-data-spec.md` 的 schema 是 PostgreSQL 写法，需要适配 SQLite：

| PostgreSQL 特性 | SQLite 适配方案 |
|---|---|
| `uuid` 类型 | `TEXT` + `lower(hex(randomblob(4)))||'-'...` 生成 UUID v4 |
| `timestamptz` | `TEXT`（ISO 8601 格式，`datetime('now')`） |
| `text[]` 数组 | `TEXT`（JSON 序列化：`'["tag1","tag2"]'`） |
| `generated always as` 计算列 | 应用层计算（Rust command 返回时计算） |
| `check constraint` | SQLite 支持，直接用 |
| `references ... on delete cascade` | SQLite 支持，需开启 `PRAGMA foreign_keys = ON` |
| DB trigger（合同不可变） | **迁移到 Rust 应用层**（`update_idea` command 检查） |

## 目录结构

```
src-tauri/src/
  lib.rs                    ← 注册 plugin + commands
  db/
    mod.rs                  ← DB 初始化，执行迁移
    migrations/
      001_initial_schema.sql ← 全部表 DDL
  commands/
    mod.rs                  ← 注册所有 commands
    ideas.rs
    profiles.rs
    dialogue.rs
    intent.rs
    boundary.rs
    validation.rs
    contracts.rs
    evolution.rs
  sync/
    mod.rs
    queue.rs
    worker.rs
  error.rs                  ← AppError 类型，统一错误处理
```

## 合同不可变 Rust 实现

```rust
// commands/ideas.rs
#[tauri::command]
pub async fn update_idea(
    state: tauri::State<'_, AppState>,
    id: String,
    update: IdeaUpdate,
) -> Result<Idea, AppError> {
    let db = state.db.lock().await;

    // 先查当前状态
    let current = db.get_idea(&id).await?;

    // 合同不可变检查
    if current.contract_signed_at.is_some() {
        if update.deadline.is_some()
            || update.success_metric.is_some()
            || update.target_n.is_some()
            || update.product_type.is_some()
        {
            return Err(AppError::ContractImmutable(id));
        }
    }

    db.update_idea(&id, update).await
}
```

## Sync Queue 设计

```sql
-- sync_queue 表（migrations 里添加）
CREATE TABLE sync_queue (
  id         TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id     TEXT NOT NULL,
  operation  TEXT NOT NULL CHECK(operation IN ('upsert', 'delete')),
  payload    TEXT NOT NULL,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
```

Worker 每 30 秒：
1. 取 `attempts < 5` 的队列条目
2. 逐条 POST 到 Supabase REST API（`/rest/v1/{table}`）
3. 成功 → DELETE from queue
4. 失败 → `attempts += 1`，记录 `last_error`，指数退避

## TypeScript Bindings

`apps/desktop/src/lib/db.ts` 封装所有 Tauri command 调用：

```typescript
import { invoke } from '@tauri-apps/api/core'
import type { Idea, Profile, IntentCanvas } from '@maestro/types'

export const db = {
  ideas: {
    list: () => invoke<Idea[]>('get_ideas'),
    get: (id: string) => invoke<Idea>('get_idea', { id }),
    create: (data: CreateIdeaInput) => invoke<Idea>('create_idea', { data }),
    update: (id: string, data: UpdateIdeaInput) => invoke<Idea>('update_idea', { id, data }),
  },
  profile: {
    get: () => invoke<Profile | null>('get_profile'),
    upsert: (data: UpsertProfileInput) => invoke<Profile>('upsert_profile', { data }),
  },
  // ... 其他模块
}
```

## 数据库文件位置

使用 Tauri 的 `app_data_dir()`：
- macOS: `~/Library/Application Support/com.cogito.maestro/maestro.db`
- Windows: `%APPDATA%\com.cogito.maestro\maestro.db`
