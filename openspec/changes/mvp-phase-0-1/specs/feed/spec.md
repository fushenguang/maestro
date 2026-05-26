## ADDED Requirements

### Requirement: User can input an idea via text
The system SHALL provide a text textarea where the user can type a raw idea description (minimum 20 characters to activate submit).

#### Scenario: Activate submit button on text input
- **WHEN** user types more than 20 characters in the textarea
- **THEN** the [analyze idea] submit button SHALL become active

#### Scenario: Submit blocked on short input
- **WHEN** user types 20 characters or fewer
- **THEN** the [analyze idea] button SHALL remain disabled

### Requirement: User can select a feed source type
The system SHALL provide mutually-exclusive source chips: `text`, `url / article`, `github repo`, `doc / file`. Only one chip can be active at a time.

#### Scenario: Single chip selection
- **WHEN** user clicks a source chip
- **THEN** that chip SHALL become selected and all other chips SHALL become deselected

### Requirement: User can paste a URL as feed source
The system SHALL accept a URL in a dedicated input field. When a GitHub repo URL is detected (`github.com/:owner/:repo`), the system SHALL fetch the repo's README and star count via the GitHub API.

#### Scenario: GitHub URL detection and fetch
- **WHEN** user pastes a URL matching `github.com/:owner/:repo` into the URL input
- **THEN** the system SHALL call the GitHub API and display the repo name, star count, and README excerpt

#### Scenario: GitHub API failure graceful degradation
- **WHEN** the GitHub API call fails or rate-limits
- **THEN** the system SHALL display the URL without additional metadata and SHALL NOT block the submit flow

### Requirement: User can drop a local file as feed source
The system SHALL accept drag-and-drop of `.md`, `.txt`, `.pdf` files and read their text content locally (no remote upload in MVP).

#### Scenario: File drop accepted
- **WHEN** user drops a supported file onto the drop zone
- **THEN** the system SHALL read the file content and populate the textarea

#### Scenario: Unsupported file type rejected
- **WHEN** user drops a file with an unsupported extension
- **THEN** the system SHALL display an error message and ignore the file

### Requirement: User can create an idea and trigger LLM analysis
The system SHALL, on submit, create an idea record in SQLite via the `create_idea` Tauri command, then trigger an LLM analysis that generates a `problem_statement`.

#### Scenario: Successful idea creation and redirect
- **WHEN** user clicks [analyze idea] with valid input
- **THEN** the system SHALL create the idea in SQLite, navigate to `/ideas/$id/feed`, and begin LLM analysis in the background

#### Scenario: LLM analysis completes
- **WHEN** LLM analysis completes
- **THEN** the system SHALL update `idea.problemStatement` in SQLite and display the result to the user

#### Scenario: LLM analysis fails
- **WHEN** LLM call returns an error
- **THEN** the system SHALL display an actionable error message with a [retry] option

### Requirement: User can link a GitHub repository at feed time
The system SHALL provide a GitHub repo input (`org/repo`) on the new idea form. This value is stored on the idea record.

#### Scenario: Repo field stored on create
- **WHEN** user fills in the repo field and submits
- **THEN** the idea record SHALL be created with `githubRepo` set to the provided value
