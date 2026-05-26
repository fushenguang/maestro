## ADDED Requirements

### Requirement: GitHub commit module sends `.maestro/` artifacts to linked repository
The system SHALL provide a Rust module (`src-tauri/src/github/`) that can commit files to a GitHub repository using the Contents API. The module SHALL read the GitHub OAuth token from Tauri secure store and never expose it to the WebView layer.

#### Scenario: Commit boundary.json on lock
- **WHEN** boundary lock is triggered and `ideas.github_repo` is set
- **THEN** the Rust `github_commit_file` command is invoked with `path=".maestro/boundary.json"` and the serialized boundary content
- **THEN** a PUT request is made to `https://api.github.com/repos/{owner}/{repo}/contents/.maestro/boundary.json`
- **THEN** the response `commit.sha` is stored in `ideas.boundary_export_sha`

#### Scenario: GitHub API error is surfaced to user
- **WHEN** the GitHub API call fails (network error, 403 forbidden, repo not found)
- **THEN** the boundary lock still completes locally (state is saved to SQLite)
- **THEN** a toast appears: "boundary locked · github commit failed: {error} · retry in integrations"

#### Scenario: Token not available skips commit gracefully
- **WHEN** no GitHub token is found in Tauri secure store
- **THEN** the commit is skipped
- **THEN** lock completes with toast: "boundary locked · sign in with GitHub to enable artifact commits"

---

### Requirement: Tailwind 0.5px border width is available globally
The system SHALL extend `tailwind.config.ts` to support a `0.5` border width token, enabling `border-[0.5px]` utility class across all components.

#### Scenario: 0.5px border renders on scope item cards
- **WHEN** a scope item card renders with `border-[0.5px]` class
- **THEN** the border renders at 0.5px on HiDPI displays

#### Scenario: borderWidth extension does not break existing borders
- **WHEN** `tailwind.config.ts` is updated with `borderWidth: { '0.5': '0.5px' }`
- **THEN** all existing components using `border`, `border-2`, etc. continue to render correctly

---

### Requirement: PhaseSidebar unlock conditions include Phase 2 and Phase 3
The system SHALL update `PhaseSidebar.tsx` to enforce the correct unlock conditions for boundary (Phase 2) and validation (Phase 3) phases.

#### Scenario: Boundary phase unlocks after intent completes
- **WHEN** `idea.intentClarity >= 85` and `idea.openQuestionsCount === 0`
- **THEN** the boundary phase item in PhaseSidebar is unlocked and navigable

#### Scenario: Validation phase unlocks after boundary is locked
- **WHEN** `idea.boundaryLockedAt` is not null
- **THEN** the validation phase item in PhaseSidebar is unlocked and navigable

#### Scenario: Locked phase shows tooltip on hover
- **WHEN** user hovers a locked phase item
- **THEN** a tooltip displays the unlock requirement (e.g., "lock boundary definition first")
