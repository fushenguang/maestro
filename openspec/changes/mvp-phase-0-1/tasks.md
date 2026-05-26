## 1. LLM Service — Rust Backend

- [x] 1.1 Add `tauri-plugin-store` to Cargo.toml for secure key storage (or use tauri's built-in keychain via AppHandle)
- [x] 1.2 Create `src-tauri/src/llm/mod.rs` — module entry, re-exports
- [x] 1.3 Create `src-tauri/src/llm/config.rs` — read `llm_api_key` and `llm_base_url` from Tauri store
- [x] 1.4 Create `src-tauri/src/llm/provider.rs` — `LlmProvider` trait + `OpenAICompatibleProvider` with reqwest streaming
- [x] 1.5 Create `src-tauri/src/llm/streaming.rs` — SSE line parser, emit chunks via `window.emit("llm-stream-{event_id}", chunk)`; emit done/error events on completion
- [x] 1.6 Create `src-tauri/src/commands/llm.rs` — `llm_chat_stream` command, `llm_set_config` command, `llm_get_config` command
- [x] 1.7 Register LLM module in `src-tauri/src/lib.rs` and commands in `src-tauri/src/commands/mod.rs`

## 2. LLM Service — Frontend Hook

- [x] 2.1 Create `src/lib/llm.ts` — `callLLM(messages, eventId)` wrapper that invokes `llm_chat_stream` Tauri command
- [x] 2.2 Create `src/hooks/useLLMStream.ts` — subscribes to `llm-stream-{eventId}` events, exposes `{ text, isStreaming, error, reset }`
- [x] 2.3 Create `src/lib/llm-prompts.ts` — prompt builder functions for feed analysis and intent dialogue rounds

## 3. Phase 0 — Feed Route

- [x] 3.1 Create `src/routes/_app/ideas/new.tsx` — `/ideas/new` route (standalone page, no `$id` layout)
- [x] 3.2 Implement source chips component (`text` | `url / article` | `github repo` | `doc / file`) with single-select logic
- [x] 3.3 Implement URL input with debounced GitHub repo detection (regex `github.com/:owner/:repo`) and API fetch for README + stars
- [x] 3.4 Implement file drop zone — read `.md`, `.txt`, `.pdf` content locally, populate textarea
- [x] 3.5 Implement form submit handler: call `db.ideas.create()`, navigate to `/ideas/$id/feed`, then trigger LLM analysis in background
- [x] 3.6 Create `src/routes/_app/ideas/$id/feed.tsx` — `/ideas/$id/feed` route showing problem statement and LLM analysis progress
- [x] 3.7 Update `router.tsx` to register the new `new.tsx` route and `feed.tsx` route; wire feed to IdeasRoute children

## 4. Phase 0 — Feed: PhaseSidebar Navigation

- [x] 4.1 Update `PhaseSidebar.tsx` to use `useNavigate` and route to `/ideas/$id/feed`, `/ideas/$id/intent`, etc. on phase click

## 5. Phase 1 — Intent Dialogue Route

- [x] 5.1 Create `src/routes/_app/ideas/$id/intent.tsx` — two-column layout: left (dialogue + A2UI form zone), right (Intent Canvas panel)
- [x] 5.2 Create `src/components/intent/DialogueThread.tsx` — renders historical `dialogue_messages` grouped by round
- [x] 5.3 Create `src/components/intent/A2UIForm.tsx` — renders JSON question list as labeled inputs, shows "opus generated" badge; exposes `onSubmit(answers: Record<string, string>)`
- [x] 5.4 Create `src/components/intent/IntentCanvasPanel.tsx` — right-side panel showing canvas fields with confirmed/partial/empty states and live updates
- [x] 5.5 Create `src/components/intent/ConfirmedAssumptions.tsx` — displays the confirmed assumptions list below canvas
- [x] 5.6 Implement multi-round logic in `intent.tsx`: on submit, persist user answers via `db.dialogue.add()`, call LLM for next round, parse `canvas_update` + `next_questions` from LLM JSON response, upsert canvas via `db.intent.upsert()`, update `idea.intentClarity` and `idea.openQuestionsCount`
- [x] 5.7 Implement [skip this round] button with confirmation dialog
- [x] 5.8 Implement [history] button that expands accordion panel of past rounds
- [x] 5.9 Implement intent clarity progress display and [intent clear · next ↗] button (active when `intentClarity >= 85` and `openQuestionsCount === 0`)
- [x] 5.10 Register `intent.tsx` route in `router.tsx` as a child of `IdeasRoute`

## 6. Dashboard — New Idea Entry Point

- [x] 6.1 Update dashboard's [new idea] button to navigate to `/ideas/new`

## 7. Typecheck & Verification

- [x] 7.1 Run `pnpm typecheck` in `apps/desktop` and fix any TypeScript errors
- [x] 7.2 Run `cargo build` in `apps/desktop/src-tauri` and fix any Rust compile errors
