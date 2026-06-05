## ADDED Requirements

### Requirement: Market signal refresh SHALL support GitHub stars metric for contract ideas
The system SHALL provide a market signal refresh command that fetches current value for ideas using `github_stars` success metric.

#### Scenario: Refresh GitHub stars metric
- **WHEN** an idea has `success_metric = github_stars` and valid repository identifier
- **THEN** the system fetches live stargazer count from GitHub API
- **THEN** the system updates `ideas.market_current_value` and `ideas.market_last_checked_at`

#### Scenario: Unsupported metric returns explicit non-blocking result
- **WHEN** an idea uses a metric other than `github_stars`
- **THEN** the refresh command returns a structured unsupported/manual result
- **THEN** no invalid auto-value is written to market fields

---

### Requirement: Idea status transitions MUST be computed from contract target and deadline
The system SHALL evaluate market state transitions using deadline and target metric progress.

#### Scenario: Transition to in_market on target reached
- **WHEN** `market_current_value >= target_n`
- **THEN** the system sets idea status to `in_market`

#### Scenario: Transition to at_risk before deadline if not reached
- **WHEN** remaining days to deadline is less than 14 and target is not reached
- **THEN** the system sets idea status to `at_risk`

#### Scenario: Transition to force_closed after deadline if not reached
- **WHEN** deadline has passed and target is not reached
- **THEN** the system sets idea status to `force_closed`

---

### Requirement: Market status evaluation SHALL be runnable on startup and scheduled intervals
The system SHALL support evaluating due ideas on app startup and periodic background intervals.

#### Scenario: Startup evaluation
- **WHEN** desktop app initializes with active contract ideas
- **THEN** the system runs status evaluation for due ideas before user proceeds with phase operations

#### Scenario: Hourly evaluation
- **WHEN** one-hour interval elapses while app process is active
- **THEN** the system runs market signal refresh and status evaluation for eligible ideas
- **THEN** the system persists updated market timestamps and statuses
