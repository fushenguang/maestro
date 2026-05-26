# Dashboard Spec

## Requirements

### Requirement: `/` redirects to `/dashboard`
The root route `/` SHALL redirect authenticated users to `/dashboard`. Unauthenticated users SHALL be redirected to `/login` by the `_app` layout guard.

#### Scenario: Authenticated root access
- **WHEN** an authenticated user navigates to `/`
- **THEN** they are immediately redirected to `/dashboard` without a visible flash

### Requirement: Dashboard displays aggregate stats bar
The Dashboard SHALL render a Stats Bar with four metric cards: **Total Products** (count of all ideas), **Live** (count of ideas with `status = 'in_market'`), **Deadline < 30d** (count of active ideas whose `deadline` is within 30 days from today), and **Force-Closed** (count of ideas with `status = 'force_closed'`).

#### Scenario: Stats computed client-side
- **WHEN** the dashboard loads and `db.ideas.list()` resolves
- **THEN** all four stats are derived from the returned array without additional DB queries

#### Scenario: Empty state stats
- **WHEN** no ideas exist for the current user
- **THEN** all four stat cards display `0`

### Requirement: Dashboard displays product registry table
The Dashboard SHALL render a Product Registry Table with the following columns: **Product** (name + slug), **Status** (badge), **Deadline** (formatted date + days remaining progress bar), **Market Signal** (value or `—` if not visible), **Version** (`current_version`).

#### Scenario: Status badge colours
- **WHEN** an idea's `status` is `'in_market'`
- **THEN** the badge is rendered in green (`success`)
- **WHEN** an idea's `status` is `'at_risk'`
- **THEN** the badge is rendered in amber (`warning`)
- **WHEN** an idea's `status` is `'force_closed'` or `'closed_no_go'`
- **THEN** the badge is rendered in red (`destructive`)
- **WHEN** an idea's `status` is `'draft'` or `'active'`
- **THEN** the badge is rendered in the default neutral style

#### Scenario: Deadline progress bar colour
- **WHEN** less than 20% of deadline time remains
- **THEN** the progress bar is shown in red (danger)
- **WHEN** 20%–50% of deadline time remains
- **THEN** the progress bar is shown in amber (warning)
- **WHEN** more than 50% of deadline time remains
- **THEN** the progress bar is shown in green (success)

#### Scenario: Row click navigation
- **WHEN** a user clicks a table row
- **THEN** the app navigates to `/ideas/$id` for the corresponding idea

#### Scenario: Market signal hidden
- **WHEN** `market_visible` is `false` for an idea
- **THEN** the Market Signal cell displays `—`

### Requirement: Dashboard has filter tabs
The Dashboard SHALL display filter tabs: **All** / **Active** / **In Market** / **Closed**. The active filter tab SHALL highlight the currently selected filter. Selecting a tab SHALL immediately update the visible table rows without a page reload.

#### Scenario: Filter tab — Active
- **WHEN** the user selects the `Active` tab
- **THEN** only ideas with `status IN ('active', 'at_risk')` are shown in the table

#### Scenario: Filter tab — In Market
- **WHEN** the user selects the `In Market` tab
- **THEN** only ideas with `status = 'in_market'` are shown

#### Scenario: Filter tab — Closed
- **WHEN** the user selects the `Closed` tab
- **THEN** only ideas with `status IN ('force_closed', 'closed_no_go')` are shown

#### Scenario: Filter tab — All
- **WHEN** the user selects the `All` tab
- **THEN** all ideas are shown regardless of status

### Requirement: Dashboard shows empty state when no products exist
The Dashboard SHALL render an empty state component with a call-to-action button when the current user has no ideas.

#### Scenario: Empty state renders
- **WHEN** `db.ideas.list()` returns an empty array
- **THEN** the Stats Bar shows zeros and the table area shows an empty state illustration with the text "No products yet" and a "New Idea" button

#### Scenario: Empty state action
- **WHEN** the user clicks the "New Idea" button in the empty state
- **THEN** they are navigated to the new idea creation flow (or a modal is opened)

### Requirement: Dashboard has a New Idea primary action
The Dashboard header SHALL include a `+ New Idea` button. In the MVP this button is a placeholder and navigates to a creation flow (route to be implemented in a later change).

#### Scenario: Button is always visible
- **WHEN** the dashboard renders (with or without ideas)
- **THEN** the `+ New Idea` button is visible in the dashboard header row

### Requirement: Phase Sidebar renders on `/ideas/$id` routes
The Phase Sidebar SHALL be a 168px wide fixed column on the left side of the ideas detail shell. It SHALL display six phases (0–5) with their names and lock/active/done state.

#### Scenario: Phase lock state display
- **WHEN** a phase's unlock condition is not met (see design.md `getPhaseStatus`)
- **THEN** that phase item shows a lock icon and is not clickable

#### Scenario: Current phase is active
- **WHEN** a phase equals `idea.currentPhase`
- **THEN** that phase item is highlighted as active and is clickable

#### Scenario: Completed phase navigation
- **WHEN** a phase is less than `idea.currentPhase`
- **THEN** that phase item shows a checkmark and is clickable to revisit
