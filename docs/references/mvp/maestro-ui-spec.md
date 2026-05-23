# Maestro UI Spec
> Target: Claude Sonnet 4.6 (coding agent)
> Stack: Next.js · TypeScript · shadcn/ui · Tailwind CSS · @a2ui/react + @a2ui/web_core · Supabase · GitHub OAuth

---

## 0. Design Language

### Typography
| Role | Font | Weight |
|---|---|---|
| Logo / headings / body | `Syne` (Google Fonts) | 400 / 500 / 600 |
| Labels / code / metrics / mono | `IBM Plex Mono` (Google Fonts) | 400 / 500 |

### Color Tokens
Use shadcn/ui CSS variables throughout. Custom semantic overrides:

```css
/* Deadline urgency */
--deadline-danger-bg: #FCEBEB;
--deadline-danger-border: #F09595;
--deadline-danger-text: #A32D2D;

/* Warning / at-risk */
--warn-bg: #FAEEDA;
--warn-border: #FAC775;
--warn-text: #854F0B;

/* Success / in-market */
--success-bg: #EAF3DE;
--success-border: #C0DD97;
--success-text: #3B6D11;

/* Info / draft */
--info-bg: #E6F1FB;
--info-border: #B5D4F4;
--info-text: #185FA5;
```

### Spacing & Borders
- All borders: `0.5px solid` (use `border-[0.5px]` utility or inline style)
- Card radius: `border-radius: var(--radius)` (shadcn default = 8px)
- Section dividers: `1px gap` with shared background trick (grid gap on colored parent)
- Icon set: **Tabler Icons** (outline only) via `lucide-react` where available, else `@tabler/icons-react`

### Status Badge Component
```tsx
// StatusBadge.tsx
type Status = 'active' | 'warning' | 'closed' | 'draft' | 'locked' | 'done'

const STATUS_STYLES: Record<Status, string> = {
  active:  'bg-[#EAF3DE] text-[#3B6D11] border-[#C0DD97]',
  warning: 'bg-[#FAEEDA] text-[#854F0B] border-[#FAC775]',
  closed:  'bg-[#F1EFE8] text-[#5F5E5A] border-[#D3D1C7]',
  draft:   'bg-[#E6F1FB] text-[#185FA5] border-[#B5D4F4]',
  locked:  'bg-muted text-muted-foreground border-border',
  done:    'bg-[#EAF3DE] text-[#3B6D11] border-[#C0DD97]',
}
```

---

## 1. Auth — Login Page

**Route:** `/login`  
**Guard:** All routes except `/login` redirect here if no Supabase session.

### Layout
Centered card (320px wide) on full-viewport background (`bg-muted/40`).

### Structure
```
[M logo mark] + "MAESTRO" wordmark
subtitle: "app factory · product layer"
---
[Continue with GitHub] ← primary CTA, full width
---
"invite only" note
GitHub permission disclosure note
```

### Auth Flow
```ts
// lib/auth.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const signInWithGitHub = async () => {
  const supabase = createClientComponentClient()
  await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'read:user read:org',  // no write until repo linked
      redirectTo: `${location.origin}/auth/callback`,
    },
  })
}
```

### Post-login Redirect
- `/auth/callback` → session established → redirect to `/dashboard`
- Store GitHub username + avatar in `profiles` table on first login

---

## 2. Global Layout Shell

**Component:** `AppShell` — wraps all authenticated routes.

```
┌─────────────────────────────────────────────────────┐
│ Topbar: [M] MAESTRO  |  nav tabs  |  @handle + avatar│
├─────────────────────────────────────────────────────┤
│  Page content (full width, no sidebar at shell level)│
└─────────────────────────────────────────────────────┘
```

### Topbar Nav Items
```ts
const NAV_ITEMS = [
  { label: 'products', href: '/dashboard' },
  { label: 'resources', href: '/resources' },
  { label: 'insights', href: '/insights' },
  { label: 'settings', href: '/profile' },  // routes to profile/settings
]
```

User avatar in top-right → click → navigates to `/profile`.

---

## 3. Dashboard — `/dashboard`

### Stats Bar (4 columns, 1px gap grid)
| Metric | Source |
|---|---|
| total products | `COUNT(ideas)` |
| live in market | `COUNT(ideas WHERE market_visible = true)` |
| deadline < 30d | `COUNT(ideas WHERE deadline - now() < 30 AND status = 'active')` |
| force closed | `COUNT(ideas WHERE status = 'force_closed')` |

### Product Registry Table
Columns: `product | status | deadline | market signal | version`

```ts
interface ProductRow {
  id: string
  name: string
  description: string
  status: 'active' | 'at_risk' | 'draft' | 'closed'
  deadline: Date | null
  deadlineDaysLeft: number | null
  marketTarget: string       // e.g. "paid > 1" | "stars > 200"
  marketCurrent: number | string
  version: string            // e.g. "v0.1.0" | "draft"
  githubRepo: string | null
}
```

**Deadline progress bar:** fill % = `(totalDays - daysLeft) / totalDays`
- fill color: `>80%` → danger red, `50–80%` → warn amber, `<50%` → success green

**Row click** → navigate to `/ideas/[id]` (Product Detail page)

---

## 4. Idea Pipeline Shell — `/ideas/[id]`

All PHASE pages share this shell:

```
┌──────────────────────────────────────────────────────────┐
│ Left sidebar (168px fixed)  │  Right content area (flex) │
│                             │                            │
│  [M] MAESTRO                │  Phase-specific content    │
│                             │                            │
│  Phase nav:                 │                            │
│  1. feed          ✓done     │                            │
│  2. intent        ● active  │                            │
│  3. boundary      🔒locked  │                            │
│  4. validation    🔒locked  │                            │
│  5. contract      🔒locked  │                            │
│  ─────────────────          │                            │
│  after launch:              │                            │
│  6. evolution     🔒locked  │                            │
│                             │                            │
│  [idea chip]                │                            │
│  [phase progress bar]       │                            │
└──────────────────────────────────────────────────────────┘
```

### Phase Lock Logic
```ts
type PhaseStatus = 'done' | 'active' | 'locked'

const PHASE_UNLOCK_CONDITIONS: Record<number, (idea: Idea) => boolean> = {
  1: () => true,                              // always unlocked
  2: (i) => i.feedCompletedAt !== null,
  3: (i) => i.intentClarity >= 85 && i.openQuestionsCount === 0,
  4: (i) => i.boundaryLockedAt !== null,
  5: (i) => i.validationVerdict === 'go',
  6: (i) => i.contractSignedAt !== null,
}
```

### Sidebar Progress Bar
- `intent clarity` (phase 2): `intentClarity` field from DB, updated after each Opus round
- `boundary completeness` (phase 3): `confirmedItems / totalItems * 100`

---

## 5. PHASE 0 — Feed

**Component:** `IdeaFeed`

### Input Methods
```tsx
// Three input channels, unified handler
type FeedInput =
  | { type: 'text'; content: string }
  | { type: 'url'; url: string }           // auto-fetch: article or GitHub README
  | { type: 'file'; file: File }           // PDF / MD / DOCX

// GitHub URL detection
const isGitHubRepo = (url: string) =>
  /^https:\/\/github\.com\/[\w-]+\/[\w-]+\/?$/.test(url)
```

When a GitHub repo URL is detected, call GitHub API to fetch:
- README content
- star count + recent activity
- open issues count

**After submission:** Opus reads the raw material and generates a first-pass `problemStatement` draft → saves to `ideas.problem_statement_draft` → unlocks PHASE 1.

---

## 6. PHASE 1 — Intent Dialogue

**Component:** `IntentDialogue`

### Layout: 2-column
- Left (flex-1): feed summary + conversation thread + **A2UI dynamic form zone**
- Right (240px): Intent Canvas (live) + Confirmed Assumptions + Open Questions

### Conversation Thread
```ts
interface DialogueMessage {
  id: string
  role: 'opus' | 'user'
  content: string
  round: number
  createdAt: Date
}
```

Store full history in `dialogue_messages` table. Send complete history on each Opus call.

### A2UI Integration — Dynamic Form Zone

This is the ONLY section using A2UI. All other UI is standard shadcn components.

```tsx
// IntentDialogueA2UIZone.tsx
import { A2UISurface, useA2UI, MessageProcessor } from '@a2ui/react'
import { useEffect, useRef } from 'react'

export function IntentDialogueA2UIZone({ ideaId, round, onSubmit }) {
  const processorRef = useRef(new MessageProcessor())

  useEffect(() => {
    // Stream A2UI messages from server-sent events
    const es = new EventSource(`/api/ideas/${ideaId}/intent-form?round=${round}`)
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      processorRef.current.processMessage(msg)
    }
    return () => es.close()
  }, [ideaId, round])

  return (
    <div className="a2ui-zone border rounded-lg overflow-hidden">
      <div className="a2ui-header flex items-center gap-2 px-3 py-2 bg-muted border-b">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          a2ui dynamic form · round {round}
        </span>
        <span className="opus-badge">opus generated</span>
      </div>
      <div className="p-3">
        <A2UISurface
          surfaceId="intent-form"
          processor={processorRef.current}
          onAction={(action) => {
            if (action.type === 'submit') onSubmit(action.payload)
          }}
        />
      </div>
    </div>
  )
}
```

### Server-side: Generate A2UI Form
```ts
// app/api/ideas/[id]/intent-form/route.ts
// Opus generates A2UI JSON based on conversation history and current canvas gaps

const OPUS_A2UI_SYSTEM_PROMPT = `
You are an intent clarification agent for a product management tool called Maestro.
Given the conversation history and the current intent canvas (with its gaps),
generate an A2UI v0.8 surfaceUpdate message containing 2-3 clarifying questions.

Question types available: radio group, textarea, multi-select.
Focus on the most critical gap in the intent canvas.
Each question must have an id, text, optional hint, and the appropriate input type.

Output ONLY valid A2UI JSONL. No prose.
`
```

### Intent Canvas (Right Sidebar)
Live-updating card. Fields:
```ts
interface IntentCanvas {
  problem: string | null
  rootCause: string | null
  mechanism: string | null
  targetUser: string | null
  successMetric: string | null
  boundary: string | null  // filled in phase 3
}

type FieldStatus = 'confirmed' | 'partial' | 'empty'
```

Field colors: confirmed → primary text, partial → warn amber, empty → muted italic.

### Exit Condition
```ts
// Unlock phase 3 when:
const canProceed = idea.intentClarity >= 85 && idea.openQuestionsCount === 0

// intentClarity is computed by Opus after each round submission:
// POST /api/ideas/[id]/intent-rounds
// Opus returns { updatedCanvas, clarity: 0-100, openQuestions: string[] }
```

---

## 7. PHASE 2 — Boundary Definition

**Component:** `BoundaryDefinition`

### Scope Canvas Grid (2-column)
```ts
interface ScopeItem {
  id: string
  type: 'in_scope' | 'out_of_scope' | 'open_question'
  title: string
  description: string
  status: 'confirmed' | 'needs_confirm' | 'pending'
  tags: string[]   // e.g. ['core', 'p1', 'not_owned', 'undecided']
}
```

Cards with `needs_confirm` status get `border-color: var(--color-border-primary)` accent.
Cards with `open_question` status get `border-style: dashed` + `opacity: 0.6`.

### Opus Note
Always displayed below the grid. Generated once when phase is entered, regenerated on "re-analyze".

### Lock Mechanism
```ts
// Lock button is disabled until:
const canLock =
  scopeItems.every(i => i.status !== 'needs_confirm') &&
  scopeItems.filter(i => i.type === 'open_question').every(i => i.status !== 'pending')

// On lock:
// 1. Set ideas.boundary_locked_at = now()
// 2. Export boundary JSON to GitHub repo: .maestro/boundary.json
// 3. Unlock Phase 3 (validation gate)
```

### Export as Agent Context
```ts
// .maestro/boundary.json structure
interface BoundaryContext {
  ideaId: string
  lockedAt: string
  problemStatement: string
  inScope: ScopeItem[]
  outOfScope: ScopeItem[]
  intentCanvas: IntentCanvas
  confirmedAssumptions: string[]
  negatedAssumptions: string[]
}
```

---

## 8. PHASE 3 — Validation Gate

**Component:** `ValidationGate`

### Metrics Cards (3-column)
Auto-populated by Opus market research. Fields:
```ts
interface ValidationMetrics {
  marketSizeSignal: string     // e.g. "$2.1B"
  competingProducts: number
  payingCustomersFound: number
}
```

### Evidence Items
```ts
interface EvidenceItem {
  id: string
  icon: 'chart-bar' | 'users' | 'alert-triangle' | 'x'
  title: string
  description: string
  badge: 'proves_problem' | 'adjacent_signal' | 'adoption_risk' | 'evidence_gap'
}
```

### Verdict
```ts
type Verdict = 'go' | 'no_go' | 'pending'

// 'no_go' → show "close idea" as primary CTA, disable "proceed"
// 'go'    → show "accept · proceed" as primary CTA
```

On `no_go` + close: generate post-mortem report → archive idea.

---

## 9. PHASE 4 — Product Contract

**Component:** `ProductContract`

### Immutability Rules
```ts
// These fields are locked on sign and NEVER editable again:
const LOCKED_FIELDS = ['productType', 'deadline', 'successMetric', 'targetN'] as const

// After signing, render as read-only display, not inputs
```

### Pre-sign Checklist
All 5 items must be checked before "sign" button activates:
1. Boundary definition locked
2. Validation gate verdict: go
3. GitHub repo connected and verified
4. User confirms deadline is final
5. User confirms success metric is final

### On Sign
```ts
async function signContract(ideaId: string, contractData: ContractData) {
  // 1. Write to DB: ideas.contract_signed_at, ideas.deadline, ideas.success_metric, ideas.target_n
  // 2. Create GitHub milestone with deadline date
  // 3. Auto-generate initial roadmap skeleton (Opus)
  // 4. Auto-generate first MVP openspec changes (Opus → triggers coding layer)
  // 5. Unlock Phase 5 (evolution axis)
  // 6. Schedule deadline checker cron job
}
```

### Contract ID Format
`CTR-{ideaId}-{deadline YYYYMMDD}` — stored in DB and displayed in UI.

---

## 10. PHASE 5 — Evolution Axis (Product Detail)

**Component:** `EvolutionAxis`  
**Route:** Same as idea detail, tab: "evolution axis"

### Node Types
```ts
type EvolutionNodeStatus = 'done' | 'current' | 'planned' | 'archived'

interface EvolutionNode {
  id: string
  version: string           // e.g. "v0.1.0"
  name: string
  description: string
  status: EvolutionNodeStatus
  date: Date | null
  openspecCount: number
  feedbackSignalCount: number
  triggeredBy?: string      // user feedback id that caused this version
}
```

### Timeline Connector
CSS-only vertical line via `::before` pseudo on the container.
- Node dot: `done` → green fill, `current` → red fill + outer ring, `planned` → border only

### Opus Audit Banner
Shown when `auditAlert` is non-null on the current idea. Triggered by:
- `newFeatureCount > mvpFeatureCount`
- `feedbackSignals.unaddressed > 5`
- `daysSinceLastShip > 14`

### Tabs on Product Detail
```ts
const DETAIL_TABS = ['evolution axis', 'decision tree', 'feedback', 'context'] as const
// Phase 1 implementation: only 'evolution axis' and 'feedback' are active
// 'decision tree' and 'context' show "coming in v0.2" placeholder
```

---

## 11. User Center — `/profile`

### Left Sidebar Menu Items
```ts
const PROFILE_MENU = [
  { label: 'overview',     icon: 'user',    href: '/profile' },
  { label: 'settings',     icon: 'settings', href: '/profile/settings' },
  { label: 'integrations', icon: 'plug',    href: '/profile/integrations' },
  { label: 'llm config',   icon: 'cpu',     href: '/profile/llm' },
  { label: 'security',     icon: 'shield',  href: '/profile/security' },
  // danger zone:
  { label: 'delete account', icon: 'trash', href: '/profile/delete', danger: true },
  { label: 'sign out',     icon: 'logout',  action: 'signout' },
]
```

### Launch Rate Score
```ts
// Displayed in avatar block
const launchRate = (ideas.filter(i => i.status === 'in_market').length / ideas.length) * 100
// Format: "67% · 2/3 shipped"
```

This metric is the seed for the "product decision credit score" concept.
Data is stored but not yet publicly exposed in v0.1.

### Integrations
Required for full functionality:
| Integration | Required for | Auth method |
|---|---|---|
| GitHub | all features | OAuth (already from login) |
| Supabase | all features | env config (self-hosted) |
| Stripe | `paid users > N` market metric | API key |
| Feishu / Lark | build completion notifications | Webhook URL |

### LLM Config Page (`/profile/llm`)
```ts
interface LLMConfig {
  plannerModel: 'claude-opus-4'     // locked, not editable in v0.1
  coderModel: 'claude-sonnet-4-6'   // locked
  reviewerModel: 'codex'            // locked
  anthropicApiKey: string           // encrypted, stored in Supabase vault
}
```

---

## 12. Data Model (Supabase)

```sql
-- Core tables (simplified)

create table ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  name text,
  description text,
  status text default 'draft',  -- draft|active|at_risk|force_closed|in_market
  current_phase int default 0,

  -- Phase 1-2 outputs
  feed_completed_at timestamptz,
  problem_statement text,
  intent_clarity int default 0,     -- 0-100
  open_questions_count int default 0,
  boundary_locked_at timestamptz,

  -- Phase 3
  validation_verdict text,          -- go|no_go|pending

  -- Phase 4 (immutable after sign)
  contract_signed_at timestamptz,
  product_type text,                -- paid|opensource|internal
  deadline date,
  success_metric text,              -- paid_users|github_stars|weekly_downloads|url_reachable
  target_n int,
  contract_id text,

  -- Market signal (auto-updated)
  market_current_value int default 0,
  market_visible boolean default false,

  -- GitHub
  github_repo text,

  -- Evolution
  current_version text default 'draft',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table dialogue_messages (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references ideas,
  role text,        -- 'opus' | 'user'
  content text,
  round int,
  created_at timestamptz default now()
);

create table intent_canvas (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references ideas unique,
  problem text,
  root_cause text,
  mechanism text,
  target_user text,
  success_metric_desc text,
  boundary text,
  confirmed_assumptions jsonb default '[]',
  negated_assumptions jsonb default '[]',
  updated_at timestamptz default now()
);

create table scope_items (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references ideas,
  type text,        -- in_scope|out_of_scope|open_question
  title text,
  description text,
  status text,      -- confirmed|needs_confirm|pending
  tags jsonb default '[]',
  created_at timestamptz default now()
);

create table evolution_nodes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references ideas,
  version text,
  name text,
  description text,
  status text,      -- done|current|planned|archived
  node_date date,
  openspec_count int default 0,
  feedback_signal_count int default 0,
  triggered_by uuid,  -- feedback item id
  created_at timestamptz default now()
);
```

---

## 13. Deadline Enforcement Cron

```ts
// lib/deadline-checker.ts — run daily via Supabase Edge Functions or Vercel Cron

async function checkDeadlines() {
  const overdueIdeas = await db.ideas.findMany({
    where: {
      status: 'active',
      deadline: { lte: new Date() },
      market_visible: false,
    }
  })

  for (const idea of overdueIdeas) {
    // 1. Set status = 'force_closed'
    // 2. Set github repo to read-only (via GitHub API)
    // 3. Generate post-mortem report (Opus)
    // 4. Notify user (Feishu / email)
    // 5. Start 7-day cooling period before re-creation allowed
  }
}
```

---

## 14. File Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── auth/callback/route.ts
├── (app)/
│   ├── layout.tsx              ← AppShell with topbar
│   ├── dashboard/page.tsx
│   ├── ideas/
│   │   ├── new/page.tsx        ← Feed + IdeaFeed component
│   │   └── [id]/
│   │       ├── layout.tsx      ← IdeaPipelineShell (left nav + right content)
│   │       ├── page.tsx        ← redirects to current phase
│   │       ├── feed/page.tsx
│   │       ├── intent/page.tsx
│   │       ├── boundary/page.tsx
│   │       ├── validation/page.tsx
│   │       ├── contract/page.tsx
│   │       └── evolution/page.tsx
│   └── profile/
│       ├── page.tsx            ← overview
│       ├── settings/page.tsx
│       ├── integrations/page.tsx
│       ├── llm/page.tsx
│       └── security/page.tsx
├── api/
│   ├── ideas/
│   │   └── [id]/
│   │       ├── intent-form/route.ts    ← SSE: Opus → A2UI JSON stream
│   │       ├── intent-rounds/route.ts  ← POST: submit round, get canvas update
│   │       ├── boundary/route.ts
│   │       ├── validation/route.ts
│   │       └── contract/route.ts
│   └── cron/
│       └── deadline-check/route.ts
components/
├── shared/
│   ├── AppShell.tsx
│   ├── StatusBadge.tsx
│   ├── PhaseNav.tsx
│   └── MonoLabel.tsx
├── dashboard/
│   ├── StatsBar.tsx
│   ├── ProductTable.tsx
│   └── DeadlineBar.tsx
├── ideas/
│   ├── IdeaFeed.tsx
│   ├── IntentDialogue.tsx
│   ├── IntentDialogueA2UIZone.tsx  ← A2UI lives here only
│   ├── IntentCanvas.tsx
│   ├── BoundaryDefinition.tsx
│   ├── ValidationGate.tsx
│   ├── ProductContract.tsx
│   └── EvolutionAxis.tsx
└── profile/
    ├── ProfileShell.tsx
    ├── AvatarBlock.tsx
    └── IntegrationRow.tsx
```

---

## 15. Key Implementation Notes for Sonnet 4.6

1. **A2UI is isolated** — only `IntentDialogueA2UIZone.tsx` touches `@a2ui/react`. Do not use A2UI in any other component. All other forms use shadcn `Input`, `Select`, `Textarea`.

2. **Immutability enforcement** — after `contract_signed_at` is set, the contract fields must render as `<p>` not `<input>`. Add a DB-level check + UI guard.

3. **Deadline progress bar color** — computed client-side from `daysLeft / totalDays`, no server round-trip needed.

4. **Phase unlock is always server-validated** — never trust client-side phase navigation. Each phase page checks unlock condition on load and redirects if locked.

5. **Opus calls are expensive** — cache `intentCanvas` and `validationReport` in DB. Only re-call Opus on explicit user action (submit round / re-analyze / etc).

6. **GitHub repo linkage** — use Octokit with the user's GitHub OAuth token from Supabase. Token is stored in `auth.identities` table automatically.

7. **`0.5px` borders** — Tailwind doesn't have `border-[0.5px]` by default. Add to `tailwind.config.ts`:
   ```ts
   borderWidth: { DEFAULT: '1px', '0': '0px', '0.5': '0.5px', '2': '2px' }
   ```

8. **Font loading** — add to `app/layout.tsx`:
   ```tsx
   import { Syne, IBM_Plex_Mono } from 'next/font/google'
   const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['400','500','600'] })
   const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono-custom', weight: ['400','500'] })
   ```
