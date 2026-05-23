# Maestro

A local-first desktop app that guides founders from raw idea to shipped product through a structured, AI-assisted pipeline.

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Rust toolchain (`rustup` — latest stable)
- Tauri CLI v2 (`cargo install tauri-cli --version "^2"`)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp apps/desktop/.env.example apps/desktop/.env.local
# Edit apps/desktop/.env.local and fill in the values

# 3. Start the desktop app in development mode
pnpm dev:app     # launches the full Tauri desktop app (Rust + Vite)

# Or, to run only the web UI (browser):
# pnpm dev  (from repo root)
```

## Project Structure

```
apps/desktop/     # Tauri v2 desktop application (React 19 + SQLite)
packages/types/   # Shared TypeScript types (@maestro/types)
openspec/         # Product change workflow (proposals, designs, tasks)
docs/             # Architecture and reference documentation
```

For development guidance, see [AGENTS.md](./AGENTS.md).
