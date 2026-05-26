# App Shell Spec

## Requirements

### Requirement: App Shell layout wraps all authenticated routes
The system SHALL render a persistent `AppShell` component (Topbar + content area) for all routes accessible only when authenticated. Routes `/login`, `/verify`, and `/auth/callback` SHALL NOT render the App Shell.

#### Scenario: Authenticated user sees shell
- **WHEN** a user with an active session navigates to any authenticated route
- **THEN** the Topbar is visible at the top of the viewport
- **AND** the page content renders below the Topbar

#### Scenario: Unauthenticated user does not see shell
- **WHEN** a user without a session accesses any authenticated route
- **THEN** they are redirected to `/login` without rendering the App Shell

### Requirement: Topbar displays app identity and primary navigation
The Topbar SHALL be 48px tall, full viewport width, with `[M] MAESTRO` wordmark on the left, four navigation tabs in the center (`products` / `resources` / `insights` / `settings`), and a user avatar on the right.

#### Scenario: Active tab highlight
- **WHEN** the current route is `/dashboard` or any `/ideas/*` route
- **THEN** the `products` tab is shown as active (visually distinguished)

#### Scenario: Avatar navigation
- **WHEN** the user clicks the avatar in the Topbar
- **THEN** a dropdown or navigation to `/profile` is triggered

#### Scenario: Placeholder tabs
- **WHEN** the user clicks `resources` or `insights`
- **THEN** the app navigates to a placeholder route that renders "coming soon" content
- **AND** does NOT throw a navigation error

### Requirement: Layout route enforces authentication centrally
A single TanStack Router layout route (pathless `_app`) SHALL contain all authenticated routes. Its `beforeLoad` SHALL redirect unauthenticated users to `/login`. Individual child routes SHALL NOT duplicate this guard.

#### Scenario: Centralised redirect
- **WHEN** the `_app` layout's `beforeLoad` detects no session
- **THEN** it throws `redirect({ to: '/login' })` before any child route renders

### Requirement: Profile is upserted on sign-in
The auth store SHALL call `db.profiles.upsert()` after receiving a `SIGNED_IN` auth state change event. The upsert SHALL use the user's identity metadata from Supabase.

#### Scenario: GitHub login upsert
- **WHEN** a user signs in via GitHub OAuth
- **THEN** `profiles.github_login`, `profiles.github_avatar`, and `profiles.display_name` are written to the local SQLite `profiles` table

#### Scenario: Email login upsert
- **WHEN** a user signs in via email/password
- **THEN** `profiles.github_login` is set to the email username prefix (part before `@`)
- **AND** `profiles.github_avatar` is set to `null`

#### Scenario: Repeated sign-in is idempotent
- **WHEN** a user signs in a second time with the same account
- **THEN** the upsert updates existing fields without creating a duplicate row
