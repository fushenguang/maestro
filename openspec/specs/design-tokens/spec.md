# design-tokens Specification

## Purpose
TBD - created by archiving change design-system. Update Purpose after archive.
## Requirements
### Requirement: CSS variable token set defined
The system SHALL define a complete set of CSS custom properties in `index.css` under `@layer base :root` that cover the full dark-theme color palette required by all Maestro UI surfaces.

The token set SHALL include at minimum:
- **Layout layer**: `--background`, `--foreground`
- **Card layer**: `--card`, `--card-foreground`
- **Muted layer**: `--muted`, `--muted-foreground`
- **Border / input**: `--border`, `--input`, `--ring`
- **Interaction**: `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--accent`, `--accent-foreground`
- **Destructive**: `--destructive`, `--destructive-foreground`
- **Shape**: `--radius`

All values SHALL be expressed as bare HSL components (`H S% L%`) without the `hsl()` wrapper, to support Tailwind's `hsl(var(--token))` pattern.

#### Scenario: Token values produce dark theme matching prototype
- **WHEN** the app renders in the browser
- **THEN** `--background` resolves to a near-black navy (`~222 47% 7%`), `--foreground` to near-white, and `--border` to a low-contrast slate

#### Scenario: All tokens consumed via Tailwind class
- **WHEN** a component uses `bg-background` or `text-foreground`
- **THEN** the rendered color matches the CSS variable value, not a hardcoded Tailwind slate value

---

### Requirement: Maestro semantic color tokens defined
The system SHALL define four semantic color token pairs for product-domain UI states, separate from the shadcn base tokens:

| Token | Use case |
|---|---|
| `--success` / `--success-foreground` | Active / shipped product indicator |
| `--warning` / `--warning-foreground` | At-risk / approaching deadline |
| `--info` / `--info-foreground` | Draft / in-progress state |
| `--deadline-danger` / `--deadline-danger-foreground` | Deadline overdue or critical |

Values SHALL be derived from the UI spec color palette:
- success: `#3B6D11` text on `#EAF3DE` background
- warning: `#854F0B` text on `#FAEEDA` background
- info: `#185FA5` text on `#E6F1FB` background
- deadline-danger: `#A32D2D` text on `#FCEBEB` background

#### Scenario: StatusBadge renders with correct semantic color
- **WHEN** `<StatusBadge status="active" />` is rendered
- **THEN** the badge uses `--success` background and `--success-foreground` text

#### Scenario: Deadline danger indicator distinguishable
- **WHEN** a product's deadline is overdue
- **THEN** the indicator uses `--deadline-danger` and is visually distinct from `--destructive`

---

### Requirement: Typography tokens configured in Tailwind
The system SHALL configure `tailwind.config.ts` to extend `theme.fontFamily` so that:
- `font-sans` resolves to `Syne` (with `ui-sans-serif` fallback)
- `font-mono` resolves to `IBM Plex Mono` (with `ui-monospace` fallback)

Both fonts SHALL be loaded via Google Fonts `<link>` in `index.html`.

#### Scenario: Monospace labels use IBM Plex Mono
- **WHEN** a component applies `className="font-mono"`
- **THEN** the rendered text uses IBM Plex Mono (or fallback on no network)

#### Scenario: Heading elements use Syne
- **WHEN** a component applies no font override (inherits body)
- **THEN** the rendered font is Syne

---

### Requirement: Tailwind color palette references CSS variables
The system SHALL extend `tailwind.config.ts` `theme.colors` with named entries that map to CSS variables via `hsl(var(--token))`, covering at minimum:

`background`, `foreground`, `card`, `card-foreground`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `success`, `success-foreground`, `warning`, `warning-foreground`, `info`, `info-foreground`, `deadline-danger`, `deadline-danger-foreground`

#### Scenario: Component uses semantic color class
- **WHEN** a component sets `className="bg-card text-card-foreground"`
- **THEN** Tailwind generates styles that reference the CSS variable, not a hardcoded color

