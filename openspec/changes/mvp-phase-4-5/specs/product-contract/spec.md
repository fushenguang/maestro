## ADDED Requirements

### Requirement: Contract route MUST enforce pre-sign gating
The system SHALL provide a `/ideas/:id/contract` route that loads the contract state and enforces pre-sign checklist gating before signing is allowed.

#### Scenario: Unsigned contract renders editable form and checklist
- **WHEN** user opens `/ideas/:id/contract` and no signed contract exists for the idea
- **THEN** the system renders editable inputs for `product_type`, `deadline`, `success_metric`, `target_n`, and `github_repo`
- **THEN** the system renders a checklist with required items for boundary lock, validation go verdict, GitHub repo verification, and user final confirmations
- **THEN** the sign button remains disabled until all required checklist items are satisfied

#### Scenario: Signed contract renders read-only mode
- **WHEN** user opens `/ideas/:id/contract` and `contracts.signed_at` is not null
- **THEN** all contract fields are rendered read-only
- **THEN** the page shows `contract_ref` and signed timestamp
- **THEN** the page shows a CTA to proceed to `/ideas/:id/evolution`

---

### Requirement: Contract signing MUST use irreversible high-friction confirmation
The system SHALL require a two-step confirmation flow before executing contract signing, and the backend SHALL reject duplicate signing attempts.

#### Scenario: Two-step confirmation before sign
- **WHEN** all checklist conditions are satisfied and user clicks sign
- **THEN** the system shows a high-friction confirmation modal that states the action is permanent
- **THEN** the user MUST complete step 1 acknowledgement before step 2 confirm is enabled
- **WHEN** user confirms step 2
- **THEN** the system calls the sign command with selected contract fields

#### Scenario: Duplicate sign attempt is rejected
- **WHEN** a sign request is sent for an idea whose contract is already signed
- **THEN** the backend rejects the request as immutable
- **THEN** no contract fields are changed

---

### Requirement: Contract signing MUST persist immutable contract data and transition phase state
The system SHALL persist contract data, generate a contract reference, and transition the idea into phase 5 readiness.

#### Scenario: Successful sign persists contract and updates idea state
- **WHEN** sign command succeeds
- **THEN** the system stores contract fields in `contracts` including `contract_ref`, signer, and `signed_at`
- **THEN** the system updates `ideas.contract_signed_at`, contract-related immutable fields, and status to active
- **THEN** the idea is eligible to navigate to `/ideas/:id/evolution`

#### Scenario: Contract reference format
- **WHEN** a contract is signed
- **THEN** `contract_ref` SHALL be generated in format `CTR-{idea-prefix}-{YYYYMMDD}`

---

### Requirement: Signed contract artifact MUST be exported to GitHub when repository is available
The system SHALL write `.maestro/contract.json` to the configured repository after successful signing when GitHub repository information is valid.

#### Scenario: Contract artifact export succeeds
- **WHEN** contract signing succeeds and repository access is available
- **THEN** the system commits `.maestro/contract.json` to the target repo
- **THEN** the UI shows successful export feedback

#### Scenario: Artifact export failure is actionable
- **WHEN** contract signing succeeds but GitHub export fails
- **THEN** contract data remains signed in local database
- **THEN** the UI MUST surface an actionable retry path for artifact export
