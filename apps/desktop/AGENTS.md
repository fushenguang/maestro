# Desktop App — Agent Entrypoint

This is the Maestro desktop application: a Tauri v2 shell hosting a React 19 frontend. Local SQLite is the primary data store; Supabase handles auth and optional remote sync.

## Responsibilities

- **Tauri shell** (`src-tauri/`): system integration, SQLite persistence, Tauri commands, Supabase sync
- **React UI** (`src/`): all user-facing screens, routing, state management

## Directory Structure

```
apps/desktop/
  src/                   # React UI
    routes/              # TanStack Router file-based routes
    components/          # UI components (shadcn/ui based)
    store/               # Zustand state stores
    lib/                 # Utilities (supabase client, helpers)
  src-tauri/
    src/
      lib.rs             # Tauri command registrations
      main.rs            # App entry point
    tauri.conf.json      # Tauri configuration
    Cargo.toml           # Rust dependencies
```

## Tauri Development Rules

- **All data operations go through `tauri::command`** — never access the filesystem or SQLite directly from TypeScript.
- **SQLite operations live in Rust** — the TypeScript layer calls commands and receives typed responses only.
- **Contract immutability is enforced in Rust** — the `update_idea` command must reject mutations to immutable fields after `contract_signed_at` is set.
- Use `@tauri-apps/api/core` `invoke()` to call Rust commands from TypeScript.

## Local Development

```bash
# Full Tauri desktop app (Rust + Vite, opens native window):
pnpm dev:app        # from repo root

# Web UI only (browser, no Tauri shell):
pnpm dev            # from repo root, runs all workspaces via Turborepo
```

Environment variables must be set before starting. Copy `.env.example` to `.env.local` and fill in values.

## UI Component Convention

- **Use shadcn/ui for all base UI components** — buttons, inputs, cards, dialogs, etc.
- Do not hand-roll primitive components that shadcn already provides.
- Add new shadcn components with: `pnpm dlx shadcn@latest add <component>` (run from `apps/desktop`).
- Custom application-specific components go in `src/components/` as compositions of shadcn primitives.
