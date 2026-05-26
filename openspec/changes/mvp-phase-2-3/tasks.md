## 1. Foundation — DB Schema & Tailwind

- [x] 1.1 Add `borderWidth: { '0.5': '0.5px' }` to `tailwind.config.ts` under `theme.extend`
- [x] 1.2 Create SQLite migration: add `scope_items` table (`id, idea_id, type, title, description, status, source, tags, sort_order, created_at, updated_at`)
- [x] 1.3 Create SQLite migration: add `validation_reports` table (`id, idea_id, advocate_completed_at, prosecutor_completed_at, verdict, synthesis_notes, created_at`)
- [x] 1.4 Create SQLite migration: add `evidence_items` table (`id, idea_id, report_id, pass_type, title, description, badge, sort_order`)
- [x] 1.5 Add DB helper functions in `src/lib/db.ts`: `scopeItems.list(ideaId)`, `scopeItems.create(item)`, `scopeItems.update(id, patch)`, `scopeItems.deleteOpusItems(ideaId)`
- [x] 1.6 Add DB helper functions in `src/lib/db.ts`: `validationReports.get(ideaId)`, `validationReports.create(ideaId)`, `validationReports.update(id, patch)`, `evidenceItems.create(item)`, `evidenceItems.deleteByIdea(ideaId)`

## 2. LLM Prompts — Phase 2 & 3

- [x] 2.1 Add `buildScopeAnalysisPrompt(intentCanvas, problemStatement)` to `src/lib/llm-prompts.ts` — returns system + user message for generating scope items JSON
- [x] 2.2 Add `buildAdvocatePrompt(intentCanvas, scopeItems)` to `src/lib/llm-prompts.ts` — advocate role prompt
- [x] 2.3 Add `buildProsecutorPrompt(intentCanvas, scopeItems)` to `src/lib/llm-prompts.ts` — prosecutor role prompt, include "your job is to kill it" framing
- [x] 2.4 Define Zod schemas for LLM response parsing: `ScopeItemsResponse` (array of scope items with type/title/description) and `ValidationPassResponse` (evidence items array + synthesis + verdict)

## 3. GitHub Integration — Rust Module

- [x] 3.1 Create `src-tauri/src/github/mod.rs` — module entry, re-exports `commit_file`
- [x] 3.2 Create `src-tauri/src/github/client.rs` — `GitHubClient` struct with `reqwest` async client; reads `github_token` from Tauri secure store via `AppHandle`
- [x] 3.3 Create `src-tauri/src/github/commit.rs` — `commit_file(owner, repo, path, content, message)` function using GitHub Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`); returns commit SHA
- [x] 3.4 Create `src-tauri/src/commands/github.rs` — `github_commit_file` Tauri command wrapping `commit_file`; returns `Result<String, String>` (SHA or error message)
- [x] 3.5 Register `github` module in `src-tauri/src/lib.rs` and add `github_commit_file` to the invoke handler in `src-tauri/src/commands/mod.rs`
- [x] 3.6 Add `serde_json` serialization for `.maestro/boundary.json` in `src-tauri/src/github/commit.rs` — struct: `{ ideaId, lockedAt, problemStatement, inScope, outOfScope, intentCanvas, confirmedAssumptions }`

## 4. Phase 2 — Boundary Definition Route

- [x] 4.1 Create `src/routes/_app/ideas/$id/boundary.tsx` — page component with route guard (redirect to `/ideas/$id/intent` if `idea.intentClarity < 85`)
- [x] 4.2 Create `src/components/boundary/ScopeCanvas.tsx` — 2-column grid rendering `ScopeItem[]`; passes item and callbacks to `ScopeItemCard`
- [x] 4.3 Create `src/components/boundary/ScopeItemCard.tsx` — renders single scope item; shows type badge (`in_scope`/`out_of_scope`/`open_question`), status, confirm/edit/mark actions; `needs_confirm` cards have border accent, `open_question` cards have dashed border + 60% opacity
- [x] 4.4 Create `src/components/boundary/AddItemForm.tsx` — inline form below grid with type select, title input, description textarea, [add] button; inserts with `source='user'`
- [x] 4.5 Implement LLM-based scope generation in `boundary.tsx`: on first visit, call `callLLM` with `buildScopeAnalysisPrompt`, parse with `ScopeItemsResponse` Zod schema, bulk insert to `scope_items` via `db.scopeItems.create`
- [x] 4.6 Implement re-analyze flow in `boundary.tsx`: show confirmation dialog, call `db.scopeItems.deleteOpusItems(ideaId)`, re-trigger LLM generation
- [x] 4.7 Implement lock boundary flow in `boundary.tsx`: compute `canLock` condition, show confirmation modal, set `idea.boundaryLockedAt`, invoke `github_commit_file` Tauri command (if `idea.githubRepo` set), navigate to validation with toast
- [x] 4.8 Add `[export as agent context]` button: serializes `boundary.json` and calls `github_commit_file`; show toast with commit result
- [x] 4.9 Register `boundary.tsx` in `src/router.tsx` as a child of the `$id` layout route

## 5. Phase 3 — Validation Gate Route

- [x] 5.1 Create `src/routes/_app/ideas/$id/validation.tsx` — page component with route guard (redirect to `/ideas/$id/boundary` if `idea.boundaryLockedAt` is null)
- [x] 5.2 Create `src/components/validation/AdvocatePanel.tsx` — left panel with green "case for" badge, `EvidenceCard[]`, loading steps animation; accepts `evidenceItems` and `isLoading` props
- [x] 5.3 Create `src/components/validation/ProsecutorPanel.tsx` — right panel with red "case against" badge, `EvidenceCard[]` (fatal items highlighted), loading steps animation
- [x] 5.4 Create `src/components/validation/EvidenceCard.tsx` — renders single evidence item with icon, title, description, and badge (`proves_problem`/`adjacent_signal`/`adoption_risk`/`evidence_gap`); fatal badge gets red border
- [x] 5.5 Create `src/components/validation/VerdictBanner.tsx` — synthesis banner below both panels; green for `go`, red for `no_go`, amber for `ambiguous`; renders appropriate CTAs per verdict type
- [x] 5.6 Implement sequential dual-pass logic in `validation.tsx`: on first visit, call Pass A with `buildAdvocatePrompt`, parse response, insert advocate `evidence_items`, update `validation_reports.advocate_completed_at`, then call Pass B with `buildProsecutorPrompt`, parse response, insert prosecutor `evidence_items`, compute verdict, update report
- [x] 5.7 Implement `computeVerdict(evidenceItems)` function: returns `no_go` if any item has `badge='fatal'`, `ambiguous` if evidence counts are within 2 and no fatal, else `go`
- [x] 5.8 Implement verdict action handlers in `validation.tsx`: go → set `idea.validationVerdict='go'` + `idea.validationCompletedAt` + navigate to contract; no_go → show close confirmation; ambiguous → show accept risks confirmation
- [x] 5.9 Implement re-run validation: confirmation dialog, delete existing report + evidence items, re-trigger both passes
- [x] 5.10 Register `validation.tsx` in `src/router.tsx` as a child of the `$id` layout route

## 6. PhaseSidebar — Unlock Conditions Update

- [x] 6.1 Update `PhaseSidebar.tsx` phase unlock conditions: Phase 4 (boundary) requires `idea.intentClarity >= 85 && idea.openQuestionsCount === 0`; Phase 5 (validation) requires `idea.boundaryLockedAt !== null`; Phase 6 (contract) requires `idea.validationVerdict === 'go'`
- [x] 6.2 Update `PhaseSidebar.tsx` lock tooltips: boundary → "intent clarity must reach 85% · resolve open questions"; validation → "lock boundary definition first"; contract → "validation gate must return 'go'"

## 7. Typecheck & Verification

- [x] 7.1 Run `pnpm typecheck` in `apps/desktop` and fix any TypeScript errors
- [x] 7.2 Run `cargo build` in `apps/desktop/src-tauri` and fix any Rust compile errors
- [x] 7.3 Verify `border-[0.5px]` utility works by checking at least one component uses it without Tailwind purge issues
