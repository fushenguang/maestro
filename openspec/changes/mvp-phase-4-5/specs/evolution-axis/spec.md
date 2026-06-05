## ADDED Requirements

### Requirement: Evolution route SHALL present node timeline and linked execution state
The system SHALL provide a `/ideas/:id/evolution` route that renders ordered evolution nodes and linked openspec execution state for the current idea.

#### Scenario: Evolution page initial load
- **WHEN** user opens `/ideas/:id/evolution`
- **THEN** the system loads `evolution_nodes` ordered by `sort_order`
- **THEN** the system loads related `openspec_changes` and recent `feedback_signals`
- **THEN** the UI renders status badges for nodes and change execution states

#### Scenario: Node card expansion for completed node
- **WHEN** user expands a node with status `done`
- **THEN** the UI shows associated openspec changes and related architecture decision logs

---

### Requirement: Creating evolution nodes MUST trigger scope alignment evaluation
The system SHALL support creating new evolution nodes and SHALL evaluate scope alignment immediately for each created or edited node description.

#### Scenario: Create planned node
- **WHEN** user submits version, name, and description in add milestone form
- **THEN** the system creates an `evolution_nodes` record with planned/current lifecycle metadata
- **THEN** the node appears in the axis timeline in order

#### Scenario: Auto scope check after create
- **WHEN** a new node is created
- **THEN** the system runs scope alignment evaluation against locked in-scope boundary items
- **THEN** `scope_check_status` is persisted as `clean` or `warning`
- **THEN** warning nodes display out-of-bound feature titles

---

### Requirement: Scope warning MUST hard-block openspec triggering until resolved
The system SHALL disable openspec trigger actions for nodes whose scope check is `warning`.

#### Scenario: Trigger blocked under warning
- **WHEN** node `scope_check_status` is `warning`
- **THEN** trigger openspec action is disabled
- **THEN** tooltip explains that scope warning must be resolved first

#### Scenario: User dismisses warning with explicit reason
- **WHEN** user selects intentional expansion and submits a dismissal reason
- **THEN** the system stores dismissal reason and timestamp on the node
- **THEN** the warning state transitions to `dismissed`
- **THEN** openspec trigger is enabled for that node

---

### Requirement: Openspec completion MUST include architecture log writeback before done
The system SHALL require architecture decision log writeback before marking an openspec change as done.

#### Scenario: Completion writes architecture log first
- **WHEN** an openspec change reports execution complete
- **THEN** the system requests structured arch decision output
- **THEN** the system persists an `arch_decision_logs` record linked to idea, node, and openspec change
- **THEN** the system updates openspec status to `done` only after arch log persistence succeeds

#### Scenario: Context export updates after arch log writeback
- **WHEN** arch decision log is written successfully
- **THEN** the system appends arch decision entries into `.maestro/context.json`
- **THEN** the system commits updated context file to linked repository
