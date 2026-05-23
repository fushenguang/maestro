# mvp-phase-2-3

## Why

Phase 2（Boundary Definition）和 Phase 3（Validation Gate）是 Maestro 产品最核心的差异化功能：

- Phase 2 是"context 锁定"的实际操作——把模糊的意图变成明确的 in/out scope 边界，一旦 lock 不可更改。这是防止漂移的核心机制。
- Phase 3 的双重验证（advocate + prosecutor）是 Maestro 与所有"只告诉你好话"的 AI 工具的根本区别。

## What Changes

### Phase 2 — Boundary Definition (`/ideas/:id/boundary`)

- **Scope Items 列表**：网格展示，每条目有 type badge（in/out/open）+ status（needs_confirm/confirmed）
- **LLM 初始生成**：首次进入时触发 LLM 分析 `intent_canvas`，生成 5-8 条 scope_items
- **条目操作**：confirm、edit（inline）、标记 in/out scope
- **自定义条目**：用户可手动添加
- **Lock Boundary**：所有条目 confirmed 后启用，点击触发确认弹窗，`lock_boundary` command，提交 `.maestro/boundary.json` 到 GitHub

### Phase 3 — Validation Gate (`/ideas/:id/validation`)

- **双面板布局**：左侧 Advocate（绿色）+ 右侧 Prosecutor（红色）
- **两次顺序 LLM 调用**：Pass A（advocate 角色 prompt）→ Pass B（prosecutor 角色 prompt）
- **流式显示**：Pass A 完成后立即显示左面板，同时开始 Pass B
- **Evidence cards**：每条 evidence 有类型标记（supporting/risk/fatal）
- **Verdict banner**：`go`（绿）/ `no-go`（红）/ `ambiguous`（琥珀）
- **Re-run**：支持重新跑双重验证

### GitHub 提交集成

- Phase 2 lock 时：`apps/desktop/src-tauri/src/github/` 模块调用 GitHub API，commit `.maestro/boundary.json` 到目标 repo
- `github_repo`（`owner/repo`）必须在 idea 中设置才能 commit

## Impact

- **新增**：`src/routes/ideas/$id/boundary.tsx`、`src/routes/ideas/$id/validation.tsx`
- **新增**：`src-tauri/src/github/`（GitHub API client，commit 功能）
- **依赖**：`mvp-data-layer`、`mvp-phase-0-1`（LLM service 模块）

## Out of scope

- Phase 4–5 UI
- Scope alignment check（v0.1 后期）
- 完整的 `.maestro/` artifact suite（先只做 boundary.json）
