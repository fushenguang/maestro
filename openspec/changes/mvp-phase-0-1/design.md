## Context

本次变更实现 Maestro 产品管线的 Phase 0（Feed）和 Phase 1（Intent Dialogue）UI，以及支撑它们的 LLM 服务层。

**当前状态**：数据层（SQLite schema、Tauri CRUD commands、db.ts 客户端）已由 `mvp-data-layer` 变更完成。路由树已有 `$id.tsx` layout 但缺少 feed 和 intent 子路由。LLM 服务层（`src-tauri/src/llm/`）尚不存在。

**约束**：
- 本地优先：所有持久化操作必须通过 Tauri commands → SQLite，不允许直接写 Supabase
- LLM 调用走 OpenAI-compatible API，API key 用 Tauri secure store 存储（用户自管）
- A2UI 协议不引入外部 npm 包，用轻量 React 组件代替
- MVP 不支持文件上传到远程存储，文件内容只读取本地文本

## Goals / Non-Goals

**Goals:**
- Phase 0 Feed：文本输入 + URL 输入 + 本地文件读取 + Source chips（单选）+ GitHub repo 增强抓取 + 提交触发 LLM 分析生成 `problem_statement`
- Phase 1 Intent Dialogue：历史对话展示 + 多轮问答 + Intent Canvas 实时更新 + `intent_clarity` 计分 + 解锁条件联动
- LLM 服务层：OpenAI-compatible streaming SSE，通过 Tauri event 系统推送流式内容到前端
- 路由注册：`/ideas/new`、`/ideas/$id/feed`、`/ideas/$id/intent` 正确挂载到路由树

**Non-Goals:**
- A2UI 完整协议（Phase 1 仅用简单 JSON 问题列表 → React 渲染）
- Supabase Realtime subscription（MVP 阶段用轮询或直接 invoke 更新）
- 文件上传到 Supabase Storage
- Phase 2–5 UI

## Decisions

### 决策 1：LLM 服务层架构 — Rust trait + reqwest streaming

**选择**：在 `src-tauri/src/llm/` 实现一个 Rust provider trait，`reqwest` streaming 读取 SSE 流，通过 `tauri::Emitter` emit 事件到前端窗口。

**理由**：
- reqwest 已在 Cargo.toml，无新依赖
- Tauri event 系统天然支持前后端通信，比 HTTP SSE 端点更适合桌面 app
- Rust 层做 streaming 解析，前端只消费 `llm://stream/{event_id}` 事件

**替代方案**：前端直接调 LLM API（放弃：暴露 API key；绕过 Rust 安全边界）

**实现**：
```
src-tauri/src/llm/
  mod.rs       — 模块入口，re-export
  provider.rs  — LlmProvider trait + OpenAICompatibleProvider 实现
  config.rs    — 从 Tauri secure store 读取 api_key + base_url
  streaming.rs — SSE 解析 + Tauri event emit 逻辑
src-tauri/src/commands/llm.rs — Tauri commands 入口
```

Tauri command 签名：
```rust
#[tauri::command]
pub async fn llm_chat_stream(
    window: tauri::Window,
    app: tauri::AppHandle,
    payload: ChatPayload,
    event_id: String,
) -> Result<String, AppError>
// 流式内容通过 window.emit("llm-stream-{event_id}", chunk) 推送
// 完成时 emit "llm-stream-{event_id}-done"
// 错误时 emit "llm-stream-{event_id}-error"
```

### 决策 2：A2UI Surface — 轻量 React 问题渲染器

**选择**：不引入 `@a2ui/react` 包。LLM 生成结构化 JSON 问题列表，前端用 `<A2UIForm>` 组件渲染。

**理由**：proposal 明确说"先用简单的 LLM prompt 生成问题列表，不用 A2UI 协议"。引入未知外部包会增加不确定性。

**问题列表 JSON 结构**（LLM 输出）：
```ts
interface A2UIQuestion {
  id: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'textarea';
}
```

**组件边界**（与设计图一致）：
- A2UI `<A2UIForm>` 只托管 LLM 生成的问题区（有 "opus generated" badge）
- 对话历史、Intent Canvas、Confirmed Assumptions 都是普通 React 组件

### 决策 3：Feed 提交流程 — 先创建 idea，再异步 LLM 分析

**选择**：
1. 点击提交 → 调用 `db.ideas.create()` 写入 SQLite
2. 拿到 `idea.id` 后立即跳转到 `/ideas/$id/feed`
3. Feed 页面在 mount 时触发 `llm_chat_stream` 分析，结果写回 `idea.problem_statement`

**理由**：避免提交按钮阻塞等待 LLM；用户在 LLM 运行时可以看到进度；失败可以重试而不丢失数据。

### 决策 4：多轮对话逻辑 — 前端驱动轮次，后端持久化

**选择**：前端维护当前 `round` 状态，每轮提交时：
1. 将用户答案写入 `dialogue_messages`（role: 'user'）
2. 调用 `llm_chat_stream` 生成 LLM 响应
3. LLM 响应含两部分：`canvas_update`（JSON diff）+ `next_questions`（JSON）
4. 将 LLM 响应写入 `dialogue_messages`（role: 'opus'）
5. Upsert `intent_canvas`，更新 `intent_clarity` 和 `open_questions_count`

**intent_clarity 计算**（前端 + LLM 协作）：
- LLM 在响应 JSON 中返回 `clarity_score`（0-100）
- 前端将其写入 `idea.intentClarity`
- `>= 85` 且 `openQuestionsCount === 0` 时解锁 Phase 2

### 决策 5：路由结构 — 扁平子路由

**选择**：
- `/ideas/new` — 独立页面，不在 `$id` layout 下（因为还没有 idea id）
- `/ideas/$id/feed` — 在 `$id` layout 下（有 PhaseSidebar）
- `/ideas/$id/intent` — 在 `$id` layout 下

**理由**：与现有 PhaseSidebar + `$id` layout 模式一致，保持导航连贯。

PhaseSidebar 需要补充点击导航到对应路由（当前只有 `onPhaseClick` callback，没有实际跳转）。

## Risks / Trade-offs

- **LLM 响应 JSON 解析失败** → 回退：将 LLM 原始文本展示为对话消息，不更新 canvas；前端 graceful degradation
- **Tauri secure store 未配置** → 引导用户到 Settings 页面配置 API key；在 LLM 调用前检测并提前报错
- **reqwest streaming + Tauri emit 并发** → event_id 隔离，每次调用唯一 UUID，避免竞争条件
- **A2UI JSON schema 变动** → 因为是内部格式，可随时调整；不对外暴露
- **GitHub API rate limit（未认证）** → 降级：显示 URL 即可，不展示 star/README；不阻塞提交流程
