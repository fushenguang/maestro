## ADDED Requirements

### Requirement: Dialogue history is displayed
The system SHALL display all past `dialogue_messages` for the idea, grouped by round, in chronological order.

#### Scenario: History loads on page mount
- **WHEN** user navigates to `/ideas/$id/intent`
- **THEN** the system SHALL fetch all `dialogue_messages` for the idea and display them in round order

### Requirement: LLM generates structured questions per round
The system SHALL call the LLM to generate a list of up to 3 clarifying questions per round, returned as a JSON array. The front-end SHALL render these as a form (A2UIForm component with "opus generated" badge).

#### Scenario: First round questions generated on page load
- **WHEN** the intent page loads and no dialogue messages exist
- **THEN** the system SHALL automatically trigger the LLM to generate the first round of questions

#### Scenario: Question form renders from LLM JSON
- **WHEN** LLM returns a valid question-list JSON
- **THEN** the A2UIForm component SHALL render each question as a labeled input field

#### Scenario: LLM returns invalid JSON
- **WHEN** LLM returns a response that cannot be parsed as a question list
- **THEN** the system SHALL display the raw text as an Opus message and offer a [retry] button

### Requirement: User can submit answers and advance the round
The system SHALL allow the user to fill in answers and submit them. On submission, answers are persisted as `dialogue_messages` and a new LLM round is triggered.

#### Scenario: User submits a complete round
- **WHEN** user fills all question fields and clicks [submit]
- **THEN** the system SHALL write each answer as a `dialogue_message` (role: 'user'), call the LLM for the next round, and increment the round counter

#### Scenario: Partial answers submission
- **WHEN** user submits with some fields empty
- **THEN** the system SHALL allow submission (empty answers are valid signals)

### Requirement: Intent Canvas updates after each round
The system SHALL, after each LLM response, parse the `canvas_update` JSON from the LLM and upsert the `intent_canvas` record. The right-side panel SHALL reflect the updated values with field status (confirmed / partial / empty).

#### Scenario: Canvas field becomes confirmed
- **WHEN** LLM returns a `canvas_update` with a field at confidence >= 80
- **THEN** that field SHALL display in primary text color with "confirmed" state

#### Scenario: Canvas field is partial
- **WHEN** LLM returns a field with confidence 40–79
- **THEN** that field SHALL display in amber/orange with "partial" state

#### Scenario: Canvas field is empty
- **WHEN** a canvas field has no value or confidence < 40
- **THEN** that field SHALL display as muted italic "not yet defined"

### Requirement: Intent clarity score is tracked and displayed
The system SHALL display the `intent_clarity` score (0–100) on the Phase sidebar and on the intent page. When `intent_clarity >= 85` AND `open_questions_count === 0`, Phase 2 SHALL be unlocked.

#### Scenario: Phase 2 unlock condition met
- **WHEN** `intent_clarity` reaches 85 or above AND `open_questions_count` equals 0
- **THEN** the [intent clear · next ↗] button SHALL become active and Phase 2 SHALL appear unlocked in the sidebar

#### Scenario: Phase 2 locked while clarity insufficient
- **WHEN** `intent_clarity` is below 85 or `open_questions_count` is greater than 0
- **THEN** the [intent clear · next ↗] button SHALL remain disabled

### Requirement: User can skip a round
The system SHALL allow the user to skip the current round via a [skip this round] button. Skipping requires a confirmation dialog.

#### Scenario: Skip with confirmation
- **WHEN** user clicks [skip this round] and confirms the dialog
- **THEN** the current round SHALL be marked skipped, the LLM SHALL generate the next round based on remaining canvas gaps

#### Scenario: Skip cancelled
- **WHEN** user clicks [skip this round] but cancels the dialog
- **THEN** no state change occurs

### Requirement: User can view dialogue history
The system SHALL provide a [history] button that expands a panel showing all past rounds as collapsed accordions.

#### Scenario: History panel expands
- **WHEN** user clicks [history]
- **THEN** a panel SHALL expand below the topbar showing each round as "round N · {date}" accordion

#### Scenario: Round accordion expands
- **WHEN** user clicks a round accordion
- **THEN** all dialogue messages for that round SHALL be displayed
