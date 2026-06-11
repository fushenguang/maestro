# Maestro — Agent Entrypoint

**Maestro** is a local-first desktop app (Tauri v2 + React) that guides founders from raw idea to shipped product through a structured, AI-assisted pipeline.

## Navigation Table

| I need to… | Start here |
|---|---|
| Understand what this product does and its boundaries | [`openspec/specs/product.md`](./openspec/specs/product.md) |
| Read UI / data / interaction specs | [`docs/references/mvp/`](./docs/references/mvp/) |
| Understand architecture decisions | [`docs/architecture/vision.md`](./docs/architecture/vision.md) |
| Develop the desktop app (Tauri / React) | [`apps/desktop/AGENTS.md`](./apps/desktop/AGENTS.md) |

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | React 19 + TanStack Router + Zustand |
| UI components | shadcn/ui + Tailwind CSS |
| Local storage | SQLite (via Tauri plugin) |
| Remote sync | Supabase (PostgreSQL + Auth) |
| AI | LLM pool (Claude Opus 4 primary, Sonnet 4.6 secondary) |
| Shared types | `@maestro/types` (workspace package) |
| Build system | Turborepo + pnpm workspaces |

## Do Not

- **Do not** read `docs/references/SPEC.md`, `docs/references/AGENTS.md`, or any file under `docs/references/docs/` as implementation guidance — these describe an older Symphony/Linear orchestrator product that is no longer being built.
- **Do not** use `docs/references/AGENTS.md` as the canonical AGENTS reference — use this file and the per-directory AGENTS.md files linked above.
