## 1. Contract Route Foundation

- [x] 1.1 Add `/ideas/:id/contract` route file and register it under idea nested routes
- [x] 1.2 Implement contract page data loading from Tauri `get_contract` and idea detail query
- [x] 1.3 Build editable contract form fields (`productType`, `deadline`, `successMetric`, `targetN`, `githubRepo`)
- [x] 1.4 Implement signed-state read-only rendering with `contractRef`, `signedAt`, and evolve CTA

## 2. Contract Signing Flow

- [x] 2.1 Implement pre-sign checklist logic (boundary locked, validation go, repo verified, user confirmations)
- [x] 2.2 Implement two-step high-friction sign modal with delayed second confirm
- [x] 2.3 Wire sign action to Tauri `sign_contract` and handle duplicate/immutable errors
- [x] 2.4 Persist and surface actionable retry state when `.maestro/contract.json` export fails

## 3. Evolution Axis Route and Node UX

- [x] 3.1 Add `/ideas/:id/evolution` route file and register it under idea nested routes
- [x] 3.2 Implement timeline rendering from `get_evolution_nodes` with status grouping and ordering
- [x] 3.3 Implement add milestone form and create node action via `create_evolution_node`
- [x] 3.4 Implement node detail expansion with linked `openspec_changes` and `arch_decision_logs` summaries

## 4. Scope Warning Gate and Openspec Controls

- [x] 4.1 Add scope-check status presentation (`clean`, `warning`, `dismissed`) on evolution node cards
- [x] 4.2 Disable trigger-openspec action while node is in `warning` state and show blocking tooltip
- [x] 4.3 Implement warning dismissal flow with required reason and persisted dismissal metadata
- [x] 4.4 Enforce arch-log-writeback-before-done rule in openspec completion state handling

## 5. Market Signals and Status Machine

- [x] 5.1 Add new Rust command module for market refresh and due-ideas status evaluation
- [x] 5.2 Implement GitHub stars fetch for `success_metric=github_stars` and persist market snapshot fields
- [x] 5.3 Implement status transition evaluator (`in_market`, `at_risk`, `force_closed`) based on deadline + target
- [x] 5.4 Register startup and hourly execution path for due-ideas market/status checks

## 6. Tauri Integration and Command Wiring

- [x] 6.1 Export market signal commands in `src-tauri/src/commands/mod.rs`
- [x] 6.2 Register new invoke handlers in `src-tauri/src/lib.rs`
- [x] 6.3 Reuse existing GitHub commit command path to export `.maestro/contract.json`
- [x] 6.4 Add structured error mapping and user-facing error messages for repo verify and market refresh failures

## 7. Verification and Regression Coverage

- [x] 7.1 Add/extend tests for contract signing gating, immutable resubmission rejection, and read-only signed view
- [x] 7.2 Add/extend tests for evolution scope-warning blocking and dismissal unlock behavior
- [x] 7.3 Add/extend tests for market refresh command and status transition edge cases (target reached, near deadline, overdue)
- [ ] 7.4 Run desktop app test suite and smoke test phase navigation from validation to contract to evolution
