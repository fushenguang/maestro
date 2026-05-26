## Context

Phase 2（Boundary Definition）和 Phase 3（Validation Gate）是 Maestro 最核心的差异化功能。目前 mvp-phase-0-1 已完成，LLM service、Feed、Intent Dialogue 路由和组件均已就位。本次在此基础上增量实现：

- `src/routes/_app/ideas/$id/boundary.tsx` — Scope Canvas 网格 + 锁定机制
- `src/routes/_app/ideas/$id/validation.tsx` — 双面板验证 + verdict banner
- `src-tauri/src/github/` — GitHub API client，用于 `.maestro/` artifact 提交

**当前状态**：
- LLM streaming、DB helper（`db.*`）、TanStack Router 注册模式均已有先例可参考
- PhaseSidebar 已支持 phase unlock 条件判断，只需补充 Phase 2–3 的路由和解锁条件
- `@a2ui/react` 仅在 `IntentDialogueA2UIZone.tsx` 使用，Phase 2–3 不引入

**约束**：
- 0.5px 边框是设计语言核心细节，需在 `tailwind.config.ts` 扩展 `borderWidth`
- Intent Canvas 数据是 Phase 2 Scope 生成的直接输入，必须通过 DB 读取已有字段
- 合约不可变性在 Rust 应用层执行，JS 层不做 DB 触发器

## Goals / Non-Goals

**Goals:**
- 实现 Phase 2 Scope Canvas：LLM 首次生成、inline 编辑、confirm/reject、自定义添加、永久锁定
- 实现 Phase 3 Validation Gate：顺序双 LLM Pass（advocate → prosecutor）、流式面板、verdict banner、re-run
- 实现 GitHub 提交模块：`lock_boundary` 时 commit `.maestro/boundary.json`
- 确保 PhaseSidebar 解锁条件正确：Phase 4（boundary_locked_at）、Phase 5（validation_verdict = 'go'）
- 支持 `tailwind.config.ts` 中 `borderWidth: { '0.5': '0.5px' }` 扩展

**Non-Goals:**
- Phase 4–5 UI（本 change 不涉及）
- Scope alignment check（v0.1 后期）
- 完整 `.maestro/` artifact suite（仅 `boundary.json`）
- A2UI 在 Phase 2–3 的使用（仅 Phase 1 使用）
- 非技术创始人 UX（v0.2 范围）

## Decisions

### D1：Phase 2 LLM 调用方式 — Tauri command + 前端 hook

**选择**：复用已有 `llm_chat_stream` Tauri command + `useLLMStream` hook，不引入新的后端 endpoint。

**理由**：LLM service 已完整实现，避免重复造轮子。Phase 2 的 Scope 生成和 Phase 3 的双 Pass 均通过同一 `callLLM()` 调用，只是 system prompt 不同。

**替代方案**：新建 Rust command（`generate_scope_items`、`run_validation`）——增加了不必要的 Rust 层抽象，而业务逻辑（prompt 构建、JSON 解析）在 React 层更易迭代。

---

### D2：Phase 3 顺序双 Pass — 串行而非并行

**选择**：Pass A（advocate）完成后再触发 Pass B（prosecutor），advocate 面板先显示，prosecutor 面板显示加载态。

**理由**：交互规范明确要求「Pass A 完成后立即显示左面板，同时开始 Pass B」。串行执行也符合「对抗性验证」的叙事——先看到支持方案，再看到挑战——而非两面同时出现削弱对抗感。

**替代方案**：并行调用 LLM——更快，但违反 interaction spec 和产品意图。

---

### D3：Scope Items 存储 — DB 表 `scope_items`

**选择**：Scope items 持久化到 SQLite `scope_items` 表（已在 data spec 定义），通过 `db.scopeItems.*` helper 访问，与 `intent_canvas` 同层级。

**字段**：`id, idea_id, type (in_scope|out_of_scope|open_question), title, description, status (confirmed|needs_confirm|pending), source (opus|user), tags, sort_order`

**理由**：复用已有 DB helper 模式，不引入新的状态管理复杂度。source 字段区分 Opus 生成项和用户添加项，re-analyze 时只删除 `source='opus'` 的记录，用户项保留。

---

### D4：GitHub 提交 — Rust module `src-tauri/src/github/`

**选择**：新建 `src-tauri/src/github/` 模块，使用 `reqwest` 调用 GitHub Contents API（`PUT /repos/{owner}/{repo}/contents/{path}`），从 Tauri secure store 读取 GitHub token。

**理由**：GitHub token 已通过 OAuth 获取并存入 Tauri store，Rust 层直接调用 API 比在前端 fetch 更安全（token 不暴露给 WebView）。

**替代方案**：前端 JS 调用 GitHub API——会将 token 暴露给 WebView context，违反安全原则。

---

### D5：0.5px 边框 — tailwind.config.ts 显式扩展

**选择**：在 `tailwind.config.ts` 的 `theme.extend.borderWidth` 添加 `'0.5': '0.5px'`，全局可用 `border-[0.5px]` utility。

**理由**：设计语言规定所有边框为 0.5px，Tailwind 默认最小为 1px。需显式扩展。

```ts
// tailwind.config.ts
theme: {
  extend: {
    borderWidth: {
      '0.5': '0.5px',
    },
  },
}
```

---

### D6：Verdict 计算 — 前端 `computeVerdict()` 函数

**选择**：verdict 在前端基于 evidence_items 计算：有 `fatal` 类型 evidence → `no_go`；双方证据数量接近（≤2 差距）且无 fatal → `ambiguous`；otherwise → `go`。同时持久化到 `validation_reports.verdict` 字段。

**理由**：简单的规则逻辑，不需要 Rust 层参与。Sonnet 实现 verdict JSON 时应包含 `verdict` 字段，前端 parse 后写入 DB。

## Risks / Trade-offs

- **LLM 输出格式不稳定** → Mitigation：所有 LLM 响应通过 Zod schema 验证，parse 失败时显示友好错误，允许用户 re-run。

- **GitHub API 速率限制** → Mitigation：每次 lock_boundary 仅调用一次 PUT Contents API，不存在循环调用风险。OAuth token 的速率限制（5000 req/h）远高于使用频率。

- **0.5px 边框在某些屏幕上不可见** → Mitigation：这是设计决策，仅在 HiDPI（Retina）屏幕上有明显效果，Tauri 桌面 app 目标用户使用 Mac，符合场景。

- **顺序 LLM 调用增加等待时间（~30-40s total）** → Mitigation：使用 streaming 逐字显示，配合 loading step 文案（「searching for market evidence...」等）减轻感知等待。每个 Pass 独立 stream 渲染。

- **Scope item inline edit 与 LLM 重新生成冲突** → Mitigation：re-analyze 删除 `source='opus'` 记录，保留用户手动添加的记录（`source='user'`）。已 confirmed 的 Opus 项目在 re-analyze 前需用户确认。

## Migration Plan

1. **新增路由**：注册 `boundary.tsx`、`validation.tsx` 到 TanStack Router（`apps/desktop/src/router.tsx`）
2. **新增 DB schema**：在 SQLite migration 文件中添加 `scope_items`、`validation_reports`、`evidence_items` 表
3. **新增 Rust module**：`src-tauri/src/github/` + `src-tauri/src/commands/github.rs`，注册到 `lib.rs`
4. **更新 PhaseSidebar**：补充 Phase 4（boundary）和 Phase 5（validation）的解锁条件
5. **更新 tailwind.config.ts**：添加 `borderWidth: { '0.5': '0.5px' }`
6. **无回滚需求**：所有新增，无对现有路由/数据的破坏性变更

## Open Questions

- `@a2ui/react` 版本兼容性：Phase 1 已有先例，Phase 2–3 不引入，无风险。
- GitHub token scope：OAuth 登录时已请求 `repo` scope（write access），足以 commit `.maestro/`。如果 idea 没有设置 `github_repo`，lock_boundary 时跳过 GitHub 提交，仅做本地状态更新。
