## ADDED Requirements

### Requirement: Phase 2 boundary route renders scope canvas
The system SHALL provide a `/ideas/:id/boundary` route that displays scope items in a 2-column grid. When `scope_items` is empty on first visit, the system SHALL automatically trigger LLM analysis using the `intent_canvas` content to generate 5–8 scope items.

#### Scenario: First visit auto-generates scope items
- **WHEN** user navigates to `/ideas/:id/boundary` and `scope_items` for this idea is empty
- **THEN** the system starts LLM analysis with a loading state showing "opus is defining the problem domain..."
- **THEN** 5–8 scope items (mix of `in_scope`, `out_of_scope`, `open_question`) are inserted to the DB
- **THEN** the scope canvas grid renders with the generated items

#### Scenario: Returning visit shows existing items
- **WHEN** user navigates to `/ideas/:id/boundary` and `scope_items` already exist
- **THEN** the system renders the existing items immediately without triggering LLM analysis

---

### Requirement: Scope item status transitions
The system SHALL allow users to confirm, edit, and re-classify each scope item.

#### Scenario: Confirm a needs_confirm item
- **WHEN** user clicks `[confirm]` on a `needs_confirm` scope item
- **THEN** item `status` is set to `confirmed` and the card border changes to green accent

#### Scenario: Inline edit a scope item
- **WHEN** user clicks `[edit]` on a scope item
- **THEN** the item's `title` and `description` become editable inline textarea fields
- **WHEN** user clicks `[save]`
- **THEN** the DB record is patched and the card returns to view mode

#### Scenario: Mark open question as in scope
- **WHEN** user clicks `[mark in scope]` on an `open_question` item with `status='pending'`
- **THEN** item `type` is set to `in_scope` and `status` to `confirmed`

#### Scenario: Mark open question as out of scope
- **WHEN** user clicks `[mark out scope]` on an `open_question` item with `status='pending'`
- **THEN** item `type` is set to `out_of_scope` and `status` to `confirmed`

---

### Requirement: User can add custom scope items
The system SHALL allow users to add custom scope items that are preserved across re-analysis.

#### Scenario: Add a custom scope item
- **WHEN** user clicks `[+ add item]` and fills in type, title, description, then clicks `[add]`
- **THEN** a new scope item is inserted with `source='user'`
- **THEN** the item appears in the scope canvas grid immediately

#### Scenario: Custom items survive re-analyze
- **WHEN** user triggers re-analysis
- **THEN** only items with `source='opus'` are deleted
- **THEN** items with `source='user'` remain in the grid

---

### Requirement: Re-analyze scope items
The system SHALL allow users to regenerate LLM-generated scope items while preserving user-created items.

#### Scenario: Re-analyze with confirmation
- **WHEN** user clicks `[re-analyze]`
- **THEN** a confirmation dialog appears: "this will regenerate the scope canvas · confirmed items will be preserved"
- **WHEN** user confirms
- **THEN** all `source='opus'` scope items are deleted from DB
- **THEN** LLM analysis re-runs and generates new items

---

### Requirement: Lock boundary is permanent and blocks further editing
The system SHALL allow users to permanently lock the boundary definition when all items are confirmed. Locking is irreversible.

#### Scenario: Lock button disabled when items need confirmation
- **WHEN** any scope item has `status='needs_confirm'` or is an `open_question` with `status='pending'`
- **THEN** the `[lock boundary ↗]` button is disabled
- **WHEN** user hovers the disabled button
- **THEN** a tooltip appears: "N items need confirmation before locking"

#### Scenario: Lock boundary with confirmation modal
- **WHEN** all scope items are confirmed and user clicks `[lock boundary ↗]`
- **THEN** a confirmation modal appears: "locking boundary is permanent. future changes must be made through the evolution axis."
- **WHEN** user clicks `[lock permanently]`
- **THEN** `ideas.boundary_locked_at` is set to now()
- **THEN** Phase 3 (validation) is unlocked
- **THEN** user is navigated to `/ideas/:id/validation` with a toast: "boundary locked · validation gate unlocked"

#### Scenario: GitHub commit on lock (when repo is set)
- **WHEN** boundary is locked and `ideas.github_repo` is set
- **THEN** `.maestro/boundary.json` is committed to the linked GitHub repository via the Rust GitHub module
- **THEN** `ideas.boundary_export_sha` is updated with the commit SHA

#### Scenario: Lock skips GitHub commit when repo not set
- **WHEN** boundary is locked and `ideas.github_repo` is null
- **THEN** lock completes successfully without GitHub commit
- **THEN** a toast appears: "boundary locked · connect a GitHub repo to export artifacts"
