# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev:app            # Full Tauri desktop app (Rust + Vite, native window)
pnpm dev                # Vite dev server only (browser at localhost:1420)

# Build & check
pnpm build              # Build all workspaces (turbo)
pnpm typecheck          # TypeScript type checking (all workspaces)
pnpm lint               # TypeScript lint (tsc --noEmit)
pnpm test               # Run vitest tests

# Testing (run from repo root)
pnpm test:functional:e2e           # Run real_case_flow binary (uses LLM)
pnpm test:functional:e2e:strict    # Same with MAESTRO_REAL_LLM_ALL=1 MAESTRO_STRICT_PARITY=1
pnpm test:functional:static        # Static functional check (node script, no LLM)
pnpm test:functional:full          # e2e + lint + test + cargo check

# Rust-only checks
cd apps/desktop/src-tauri && cargo check
cd apps/desktop/src-tauri && cargo build

# Single test
cd apps/desktop && pnpm vitest run src/__tests__/dashboard-utils.test.ts

# Add a shadcn/ui component (run from apps/desktop)
pnpm dlx shadcn@latest add <component>
```

## Architecture

This is **Maestro** — a local-first Tauri v2 desktop app that guides technical founders from raw idea to shipped product through a structured, AI-assisted pipeline (phases 0–5).

### Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust backend + WebView frontend) |
| Frontend | React 19 + Vite + TanStack Router + Zustand + shadcn/ui + Tailwind |
| Local storage | SQLite via tauri-plugin-sql (primary source of truth) |
| Remote sync | Supabase (Postgres) — backup/sync only, not primary read/write |
| LLM | Pluggable OpenAI-compatible API pool (user-managed keys) |
| Monorepo | pnpm workspaces + Turborepo |

### Product pipeline (phases 0–5)

```
0. Feed        — raw idea input (text / URL / GitHub repo)
1. Intent      — multi-round LLM clarification → intent canvas (clarity ≥ 85)
2. Boundary    — scope items locked permanently (in / out / open questions)
3. Validation  — dual-pass LLM (advocate + prosecutor) → go/no-go verdict
4. Contract    — immutable commitment: deadline + product_type + success_metric
5. Evolution   — versioned iterations via openspec changes in target repo
```

Each phase has a dedicated route under `_app/ideas/$id/<phase>.tsx` and corresponding Tauri commands in `src-tauri/src/commands/<phase>.rs`.

### Tauri command pattern

All data operations go through `#[tauri::command]` functions registered in `src-tauri/src/lib.rs`. TypeScript code calls them via `import { invoke } from '@tauri-apps/api/core'`. The `apps/desktop/src/lib/db.ts` file wraps every command in a typed singleton (`db.ideas.list()`, `db.boundary.upsert(...)`, etc.). **Never** access filesystem or SQLite directly from TypeScript.

Key Rust modules:
- `src-tauri/src/commands/` — one file per domain (ideas, dialogue, intent, boundary, validation, contracts, evolution, llm, market_signals, github, profiles)
- `src-tauri/src/db/` — SQLite init + migrations (sqlx)
- `src-tauri/src/llm/` — streaming LLM calls over SSE, config persistence in app data dir
- `src-tauri/src/sync/` — background worker that pushes sync_queue entries to Supabase every 30s
- `src-tauri/src/github/` — GitHub API client (commit files, verify repos)
- `src-tauri/src/error.rs` — unified `AppError` enum (Database, NotFound, ContractImmutable, ValidationError, LlmError, etc.)

### Frontend structure

- **Routes**: TanStack Router file-based routes in `src/routes/`. The `_app` layout route enforces auth. Idea detail routes are nested under `_app/ideas/$id/`.
- **State**: Zustand stores in `src/store/`. Currently `auth.ts` is the main store; per-idea state lives in component-local state or route loaders.
- **Data layer**: `src/lib/db.ts` — typed wrappers around `invoke()` calls. Includes JSON parsing helpers for SQLite TEXT columns that store serialized arrays.
- **LLM streaming**: `src/hooks/useLLMStream.ts` consumes Tauri events (`llm-stream-{id}`, `llm-stream-{id}-done`, `llm-stream-{id}-error`).
- **Components**: `AppShell.tsx` (sidebar + topbar layout), `PhaseSidebar.tsx` (phase navigation within ideas), shadcn/ui primitives in `src/components/ui/`.
- **Shared types**: `packages/types/src/` — `@maestro/types` workspace package. Exports model interfaces (Idea, Profile, ScopeItem, Contract, EvolutionNode, etc.), enums, and UI types.

### Contract immutability

After `contract_signed_at` is set on an idea, certain fields (product_type, deadline, success_metric, target_n) become immutable. This is enforced in the Rust `update_idea` command, not via DB triggers.

### Key architectural rules

- **Local-first**: All data is on the user's local disk (SQLite). Supabase is a remote backup/sync target only.
- **Network required**: GitHub OAuth + LLM calls mean no offline mode.
- **shadcn/ui mandatory**: All UI primitives must use shadcn/ui components. Do not hand-roll buttons, dialogs, cards, etc.
- **OpenSpec workflow**: Product changes go through `openspec/changes/<id>/` (proposal → design → tasks → implement → archive). Read `openspec/specs/product.md` before implementing any change.
- **Do not** read files under `docs/references/SPEC.md`, `docs/references/AGENTS.md`, or `docs/references/docs/` — those describe an older product that is no longer being built.
- **Conventions**: Conventional commits, English identifiers, Chinese OK for proposals/designs, 2-space indent, single quotes, semicolons.
