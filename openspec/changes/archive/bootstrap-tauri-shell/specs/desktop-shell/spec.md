## ADDED Requirements

### Requirement: Tauri v2 desktop shell exists and builds

The repository SHALL contain a Tauri v2 desktop application at `apps/desktop/` that builds without errors. The shell SHALL satisfy:

- Tauri version pinned to `2.11.0` (no `^` range) for both `@tauri-apps/api` and `@tauri-apps/cli` and the Rust crate `tauri`
- Single window titled "Maestro" with `identifier` set in `tauri.conf.json`
- Renders a React 19 root with at least one shadcn/ui `<Button>` component on the index route
- TanStack Router configured with at minimum a root layout and an index route
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` exits 0
- `pnpm typecheck` exits 0 across the workspace

#### Scenario: Type check across workspace
- **WHEN** `pnpm typecheck` is run from repo root
- **THEN** the command exits 0 with no TS errors in `apps/desktop/`

#### Scenario: Rust side compiles
- **WHEN** `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` is run
- **THEN** the command exits 0

#### Scenario: shadcn Button rendered on index
- **WHEN** the index route source is inspected
- **THEN** it imports a Button from `@/components/ui/button` and renders it at least once

### Requirement: Monorepo skeleton aligned with reference docs

The repository SHALL use pnpm workspaces with the directory layout prescribed by [docs/references/docs/02-MONOREPO-SETUP.md](../../../docs/references/docs/02-MONOREPO-SETUP.md). At minimum:

- Root `package.json` declares `private: true`, `packageManager: "pnpm@9.x.x"`, and `engines.node: ">=20 <25"`
- `pnpm-workspace.yaml` declares `packages: [apps/*, packages/*]`
- `turbo.json` defines tasks `build`, `dev`, `typecheck`, `lint` with `typecheck` having `dependsOn: ["^typecheck"]`
- `tsconfig.base.json` enforces `strict: true`

Apps and packages directories may be empty in this change beyond `apps/desktop/`; future changes add them.

#### Scenario: Workspace declaration
- **WHEN** `pnpm-workspace.yaml` is read
- **THEN** it lists `apps/*` and `packages/*`

#### Scenario: Turbo task graph
- **WHEN** `turbo.json` is read
- **THEN** the `typecheck` task declares `dependsOn: ["^typecheck"]`

### Requirement: Architecture vision charter is normative

The repository SHALL ship `docs/architecture/vision.md` as a normative charter. The file MUST contain explicit statements committing the project to:

1. **Agent runtime abstraction** = AppServer Protocol (per [docs/references/SPEC.md](../../../docs/references/SPEC.md))
2. **Preferred OSS core runtime dependency** = codex SDK
3. **LLM provider abstraction is mandatory** — providers MUST be pluggable and configurable
4. **First supported provider** = MiniMax (OpenAI-compatible interface)

The file's frontmatter MUST contain `version: 1`, `last_reviewed: <ISO date>`, and `normative: true`. Subsequent OpenSpec changes that contradict this charter MUST first amend `vision.md` (bumping `version`).

#### Scenario: Charter contains all four commitments
- **WHEN** `grep -q "codex SDK" docs/architecture/vision.md && grep -q -i "minimax" docs/architecture/vision.md && grep -q -i "AppServer Protocol" docs/architecture/vision.md && grep -q -i "pluggable" docs/architecture/vision.md` is run
- **THEN** the command exits 0

#### Scenario: Charter is normative
- **WHEN** `vision.md` frontmatter is parsed
- **THEN** it contains `normative: true` and a `version` integer

### Requirement: No business credentials introduced in bootstrap

This change SHALL NOT introduce any environment variables or code referencing Linear, Supabase, Anthropic, OpenAI, or any LLM provider. The bootstrap is a pure shell.

#### Scenario: No credential references in source
- **WHEN** `grep -RE "ANTHROPIC_API_KEY|OPENAI_API_KEY|LINEAR_API_KEY|SUPABASE_URL" apps/ packages/` is run after this change is applied
- **THEN** the command exits non-zero (no matches)
