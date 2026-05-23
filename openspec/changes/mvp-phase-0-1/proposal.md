# mvp-phase-0-1

## Why

数据层就绪后，第一个用户可见的 Phase 功能：Feed（输入想法）和 Intent Dialogue（AI 多轮澄清）。这是 Maestro 产品体验的起点——用户在这里把一个模糊想法转化成清晰的 Intent Canvas。

## What Changes

### Phase 0 — Feed (`/ideas/new` → `/ideas/:id/feed`)

- **输入区**：文本 textarea + URL 输入 + 文件拖拽（.md / .txt / .pdf）
- **Source chips**：`text` | `url / article` | `github repo` | `doc / file`（单选）
- **GitHub URL 检测**：匹配 `github.com/:owner/:repo`，调用 GitHub API 获取 README + stars
- **提交**：调用 `create_idea` command → 触发 LLM 分析 → 生成 `problem_statement_draft`
- **LLM 调用**：Tauri command 调用配置的模型 provider（OpenAI-compatible API）

### Phase 1 — Intent Dialogue (`/ideas/:id/intent`)

- **2 列布局**：左侧对话区 + A2UI 表单区；右侧 Intent Canvas 面板 + Assumptions + Open Questions
- **对话线程**：展示历史 `dialogue_messages`
- **A2UI 动态表单**：集成 `@a2ui/react`，SSE 流式渲染 LLM 生成的问题表单
- **多轮逻辑**：每轮提交答案 → LLM 更新 `intent_canvas`、计算 `intent_clarity`、生成下一轮
- **推进条件**：`intent_clarity >= 85` 且 `open_questions_count = 0` 时解锁 Phase 2

### LLM Service 模块

- `apps/desktop/src-tauri/src/llm/` — LLM 调用层
- `provider.rs`：OpenAI-compatible HTTP client（streaming SSE）
- `config.rs`：从 Tauri keychain 读取 API key + base URL
- SSE 流通过 Tauri event 系统推送到前端

## Impact

- **新增**：`src/routes/ideas/new.tsx`、`src/routes/ideas/$id/feed.tsx`、`src/routes/ideas/$id/intent.tsx`
- **新增**：`src-tauri/src/llm/`、`src-tauri/src/commands/llm.rs`
- **依赖**：`mvp-data-layer` 必须先完成

## Out of scope

- Phase 2–5 UI
- A2UI 服务端生成逻辑（先用简单的 LLM prompt 生成问题列表，不用 A2UI 协议，待后续优化）
- 文件上传到 Supabase Storage（Phase 0 文件输入先只支持本地读取文本内容）
