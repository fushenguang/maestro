## ADDED Requirements

### Requirement: Existing shadcn components use semantic tokens
The system SHALL update `button.tsx`, `card.tsx`, and `input.tsx` to replace any hardcoded `slate-*` Tailwind color classes with semantic token classes (e.g., `bg-background`, `text-foreground`, `border-border`, `bg-card`).

After the update, no hardcoded palette class (`slate-*`, `sky-*`, specific hex) SHALL remain in these three files.

#### Scenario: Card renders with token-based background
- **WHEN** `<Card />` is rendered
- **THEN** background color comes from `--card` CSS variable, not `bg-slate-900`

#### Scenario: Button default variant uses primary token
- **WHEN** `<Button variant="default" />` is rendered
- **THEN** background uses `bg-primary`, text uses `text-primary-foreground`

#### Scenario: Button outline variant uses border token
- **WHEN** `<Button variant="outline" />` is rendered
- **THEN** border uses `border-border`, background `bg-background`, text `text-foreground`

---

### Requirement: StatusBadge component available
The system SHALL provide a `StatusBadge` component at `src/components/ui/status-badge.tsx` that accepts a `status` prop and renders a styled inline badge.

Supported status values: `'active' | 'warning' | 'closed' | 'draft' | 'locked' | 'done'`

The component SHALL use semantic token CSS classes:
- `active` / `done`: success token colors
- `warning`: warning token colors
- `draft`: info token colors
- `closed` / `locked`: muted token colors

The component SHALL NOT accept arbitrary className color overrides for the status color — variants are fixed.

#### Scenario: Active status renders success color
- **WHEN** `<StatusBadge status="active" />` is rendered
- **THEN** badge uses success background, success-foreground text, and displays "active" label

#### Scenario: All status values render without error
- **WHEN** each of the 6 status values is passed
- **THEN** a badge renders with appropriate color and no runtime error

#### Scenario: Unknown status falls back gracefully
- **WHEN** an unknown string is passed as status
- **THEN** component renders with muted style and does not throw

---

### Requirement: Base shadcn components separator, badge, avatar, alert available
The system SHALL install the following shadcn components so they are available for use in page routes:
- `separator` — horizontal/vertical rule for section dividers
- `badge` — small inline label (distinct from StatusBadge)
- `avatar` — user avatar with image + fallback initials
- `alert` — structured alert box with title + description

Each installed component SHALL use the project's CSS variable token classes (not hardcoded colors).

#### Scenario: Separator renders as horizontal divider
- **WHEN** `<Separator />` is rendered in a card
- **THEN** a 1px horizontal line appears using `bg-border` color

#### Scenario: Alert renders with destructive variant
- **WHEN** `<Alert variant="destructive" />` is rendered
- **THEN** it uses `--destructive` token colors

---

### Requirement: @tabler/icons-react installed and usable
The system SHALL add `@tabler/icons-react` as a dependency in `apps/desktop/package.json`.

All new icon usage in React components SHALL import from `@tabler/icons-react` and use the outline variant (e.g., `IconBrandGithub`, `IconInfoCircle`).

Existing `lucide-react` imports SHALL NOT be forcibly removed in this change.

#### Scenario: GitHub icon renders via Tabler
- **WHEN** `import { IconBrandGithub } from '@tabler/icons-react'` is used in a component
- **THEN** the icon renders without TypeScript error

#### Scenario: Tabler icon accepts size and stroke props
- **WHEN** `<IconInfoCircle size={16} stroke={1.5} />` is rendered
- **THEN** the icon renders at correct size with correct stroke width
