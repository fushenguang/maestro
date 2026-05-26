## ADDED Requirements

### Requirement: Phase 3 validation route runs sequential dual-pass LLM analysis
The system SHALL provide a `/ideas/:id/validation` route that runs two sequential LLM passes (advocate then prosecutor) when first visited. Pass A (advocate) results SHALL be displayed before Pass B (prosecutor) completes.

#### Scenario: First visit auto-triggers validation run
- **WHEN** user navigates to `/ideas/:id/validation` and no `validation_reports` record exists for this idea
- **THEN** Pass A (advocate) is triggered automatically with system prompt: "find the strongest case FOR this idea"
- **THEN** the advocate panel shows streaming loading steps: "searching for market evidence...", "finding proof of the problem...", "building the case for go..."
- **WHEN** Pass A completes
- **THEN** the advocate panel renders evidence items immediately
- **THEN** Pass B (prosecutor) starts automatically

#### Scenario: Pass B runs after Pass A completes
- **WHEN** Pass A is complete and evidence items are rendered
- **THEN** Pass B (prosecutor) begins with system prompt: "find the strongest case AGAINST this idea. your role is prosecutor."
- **THEN** the prosecutor panel shows streaming loading steps: "challenging your assumptions...", "looking for fatal risks...", "stress-testing the model...", "forming the case against..."
- **WHEN** Pass B completes
- **THEN** both panels are fully rendered
- **THEN** the verdict banner is computed and displayed

#### Scenario: Returning visit shows completed report
- **WHEN** user navigates to `/ideas/:id/validation` and a completed `validation_reports` record exists
- **THEN** both panels render immediately with existing evidence items and verdict banner

---

### Requirement: Dual-panel layout shows advocate and prosecutor evidence side by side
The system SHALL display the validation results in a two-panel layout: left panel for advocate (green), right panel for prosecutor (red/amber).

#### Scenario: Advocate panel renders evidence cards
- **WHEN** Pass A is complete
- **THEN** the left panel displays: "case for" badge (green), evidence items with supporting/risk/fatal type badges, and go_reasons list

#### Scenario: Prosecutor panel renders evidence cards with fatal risks highlighted
- **WHEN** Pass B is complete
- **THEN** the right panel displays: "case against" badge (red), evidence items, and risks list
- **THEN** any evidence item with `badge='fatal'` is highlighted with a red border

---

### Requirement: Verdict banner synthesizes both passes and determines outcome
The system SHALL compute a verdict after both passes complete and display it in a synthesis banner below both panels. The verdict SHALL be one of: `go`, `no_go`, or `ambiguous`.

#### Scenario: Go verdict activates proceed button
- **WHEN** verdict is `go`
- **THEN** a green synthesis banner displays: "opus verdict: go · {synthesisNotes}"
- **THEN** `[accept · proceed ↗]` button is active
- **WHEN** user clicks `[accept · proceed ↗]`
- **THEN** `ideas.validation_verdict` is set to `'go'` and `ideas.validation_completed_at` is set to now()
- **THEN** user is navigated to `/ideas/:id/contract`

#### Scenario: No-go verdict makes close idea the primary CTA
- **WHEN** verdict is `no_go`
- **THEN** a red synthesis banner displays: "opus verdict: no-go · {synthesisNotes}"
- **THEN** any `fatal` evidence item in the prosecutor panel is highlighted
- **THEN** `[close idea]` is the primary CTA
- **THEN** `[proceed anyway]` is shown as a text link with a warning icon

#### Scenario: Ambiguous verdict shows equal-weight CTAs
- **WHEN** verdict is `ambiguous` (no fatal risks but evidence is roughly balanced)
- **THEN** an amber synthesis banner displays: "ambiguous · prosecutor found real risks but no fatal ones"
- **THEN** `[accept risks · proceed]` and `[close idea]` are shown as equal-weight buttons
- **WHEN** user clicks `[accept risks · proceed]`
- **THEN** a confirmation dialog appears: "the prosecutor found N risks. proceeding means you own these risks."
- **WHEN** user confirms
- **THEN** system treats verdict as `go` and navigates to contract

---

### Requirement: Re-run validation deletes existing report and reruns both passes
The system SHALL allow users to re-run the full dual-pass validation.

#### Scenario: Re-run with confirmation
- **WHEN** user clicks `[re-analyze]` after validation is complete
- **THEN** a confirmation dialog appears: "this will re-run both advocate and prosecutor passes · ~20 seconds"
- **WHEN** user confirms
- **THEN** existing `validation_reports` row and all `evidence_items` for this idea are deleted
- **THEN** both passes run again from the beginning (same as first visit)

---

### Requirement: Phase 3 unlock requires locked boundary
The system SHALL prevent access to Phase 3 until boundary has been locked.

#### Scenario: Phase 3 locked when boundary not locked
- **WHEN** `ideas.boundary_locked_at` is null
- **THEN** the Phase 3 (validation) item in PhaseSidebar shows locked state with tooltip: "lock boundary definition first"
- **THEN** navigating directly to `/ideas/:id/validation` redirects to `/ideas/:id/boundary`
