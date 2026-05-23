# Maestro — v0.2 OpenSpec Changes
> Scope: Gap 3 (Non-technical founder UX) + Gap 5 (Product Stage lifecycle)  
> Prerequisite: v0.1.0 shipped and in market  
> Estimated evolution nodes: 3 milestones  
> Companion: maestro-data-spec.md (v0.1.1 seed fields already in place)

---

## Background & Strategic Intent

In v0.1, maestro serves technical founders and product managers — people who understand concepts like "openspec", "boundary definition", and "product contract" natively.

v0.2 opens maestro to **domain experts without engineering background**: a nurse with a healthcare workflow idea, a restaurant owner who spotted a supply-chain gap, a teacher who sees an EdTech opportunity. This is the group the Anthropic founder guide identifies as "most liberated by AI" — they have the real problem insight, but have historically been locked out of building.

The core challenge: **the same product logic must work for both user types, but the vocabulary, interaction density, and guidance level must be radically different.**

The v0.1.1 data model already seeds this with `profiles.user_type`, `profiles.domain`, and `ideas.creator_mode`. v0.2 builds the UX layer on top of those seeds.

---

## v0.2 Milestone 1 — Domain Expert Mode: Feed & Intent

**Node version:** v0.2.0  
**Triggered by:** `profiles.user_type = 'domain_expert'` (set during onboarding)

### SPEC-001 — Language Translation Layer

**What:** A server-side prompt wrapper that translates maestro's technical vocabulary into domain-specific language before rendering any Opus output to a `domain_expert` user.

**How it works:**
```ts
// lib/language-bridge.ts
// Wraps every Opus system prompt when creator_mode = 'domain_expert'

const DOMAIN_EXPERT_TRANSLATOR = `
You are communicating with a domain expert who is NOT a software developer.
They have deep expertise in {domain} but are unfamiliar with software product terminology.

Rules:
- Never use: "openspec", "boundary definition", "scope items", "evolution node", "intent canvas"
- Instead use: "build plan", "what we're building", "features list", "version", "what we've learned"
- Frame all questions around their domain problem, not product management concepts
- When asking about "success metrics", ask "how will you know if this is working for your customers?"
- When asking about "deadline", ask "when do you want real people using this?"
- Validate their domain knowledge — they are the expert. You are the product sherpa.
`

export function wrapSystemPrompt(
  basePrompt: string,
  profile: Profile,
  idea: Idea
): string {
  if (idea.creatorMode !== 'domain_expert') return basePrompt
  return DOMAIN_EXPERT_TRANSLATOR
    .replace('{domain}', profile.domain ?? 'their industry')
    + '\n\n---\n\n'
    + basePrompt
}
```

**Affected API routes:** All Opus calls in `/api/ideas/[id]/*` — wrap system prompts via `wrapSystemPrompt()`.

**UI changes:** None. The translation happens server-side. The same components render; only the Opus-generated text changes.

---

### SPEC-002 — Simplified Feed Page for Domain Experts

**What:** When `creator_mode = 'domain_expert'`, the Feed page replaces technical chip labels with plain-language alternatives.

**UI changes:**
```
current chips:          → domain_expert chips:
"raw idea"              → "my idea"
"url / article"         → "something I read"
"github repo"           → "a product I want to build on"
"prd / doc"             → "a document I wrote"
"user feedback"         → "what people told me"
```

**Textarea placeholder change:**
```
technical: "说说你的想法... 或者粘贴一个 URL..."
domain_expert: "describe the problem you're trying to solve, in your own words.
                no jargon needed — tell it like you'd explain it to a friend."
```

**Button label change:**
```
technical:     "analyze idea ↗"
domain_expert: "let's explore this ↗"
```

**Implementation:** Pass `creatorMode` to Feed component. Use conditional rendering on label strings. No logic changes.

---

### SPEC-003 — Guided Intent Dialogue for Domain Experts

**What:** In `domain_expert` mode, the A2UI form generation prompt is specialized to ask industry-specific questions, not generic product questions.

**How it works:**
```ts
// API: /api/ideas/[id]/intent-form
// When creator_mode = 'domain_expert', use this system prompt override:

const DOMAIN_EXPERT_INTENT_PROMPT = `
You are helping a domain expert validate their business idea.
They understand their industry deeply. Your job is to help them articulate:
1. Who exactly has the problem (get specific — not "nurses" but "ICU nurses during shift handover")
2. How often this problem occurs and how painful it is right now
3. What they currently do to solve it (workarounds reveal true pain)
4. What "good enough" looks like (sets the bar for their MVP)

Ask ONE question at a time. Use their domain language, not startup language.
Generate an A2UI form with a single, focused question per round.
Maximum 2 fields per form. Prefer open text over radio buttons for nuanced domain answers.
`
```

**Intent Canvas label changes (domain_expert mode):**
```
technical label    → domain_expert label
"problem"          → "the problem"
"root cause"       → "why it happens"
"mechanism"        → "how we'll fix it"
"target user"      → "who needs this most"
"success metric"   → "how we'll know it's working"
```

**Implementation:** Add `creatorMode` to the intent-form API route. Branch prompt selection based on mode.

---

## v0.2 Milestone 2 — Domain Expert Mode: Boundary & Validation

**Node version:** v0.2.1

### SPEC-004 — Plain-Language Boundary Definition

**What:** In `domain_expert` mode, the Boundary Definition page is restructured as a simple "yes/no/maybe" checklist instead of a scope canvas grid.

**Reframe:**
```
technical header:   "scope canvas"
domain_expert:      "what we're building (and what we're not)"
```

**Simplified item card (domain_expert):**
```
Instead of the full BC card with type/status badges, show:

  [✓] We ARE building: {title}
      {description in plain language}

  [✗] We are NOT building: {title}
      why: {description}

  [?] Not sure yet: {title}
      → [include it] | [leave it out] | [decide later]
```

**Lock button relabel:**
```
technical:     "lock boundary ↗"
domain_expert: "yes, this is what we're building ↗"
```

**Confirmation modal relabel:**
```
technical: "locking boundary is permanent. future changes must be made through the evolution axis."
domain_expert: "once you confirm this, changing what you're building requires starting a new version.
                this keeps us honest about what we said we'd do."
```

**Implementation:** `BoundaryDefinition` component receives `creatorMode` prop. Branch on render path for card layout and label strings.

---

### SPEC-005 — Dual Validation with Domain-Aware Evidence

**What:** The prosecutor pass in `domain_expert` mode gets a domain-specific system prompt that tests industry-specific failure modes.

```ts
const DOMAIN_EXPERT_PROSECUTOR_PROMPT = (domain: string) => `
You are a skeptical investor and industry expert in ${domain}.
Your job is to find every reason why this idea will fail in the real world.

Focus on:
- Industry-specific regulatory risks (HIPAA, FDA, GDPR, licensing, etc.)
- Incumbent resistance (who benefits from the status quo staying the same?)
- User behavior inertia (why won't {target_user} change their current workflow?)
- Channel dependency risks (does this rely on a single platform/distributor?)
- Unit economics specific to ${domain} (are margins viable in this industry?)

Be specific to ${domain}. Generic startup risks are less useful here.
Prefix any risk that would make this idea fundamentally unviable with "FATAL:"
`
```

**Implementation:** In `/api/ideas/[id]/validation/run`, branch prosecutor prompt on `idea.creatorMode` and `profile.domain`.

---

### SPEC-006 — Plain-Language Contract for Domain Experts

**What:** The Product Contract page in `domain_expert` mode uses plain language throughout.

**Label remapping:**
```
technical              → domain_expert
"product type"         → "are you charging for this?"
"success metric"       → "how will you know it's working?"
"target N"             → "how many people need to {use/pay for/download} it?"
"contract ref"         → "your commitment ID"
"sign contract ↗"      → "I'm committed to this · let's build it ↗"
```

**Confirmation modal:**
```
technical:
  "deadline: {date} · metric: {metric} > {n}. these cannot be changed after signing."

domain_expert:
  "you're committing to: {n} {people} {using/paying for} this by {date}.
   if you don't reach this by the deadline, maestro will archive this project.
   this is the rule that keeps us honest. are you ready?"
```

**Implementation:** Same `ProductContract` component. Pass `creatorMode` and render label map.

---

## v0.2 Milestone 3 — Product Stage UX + Data Flywheel Seed

**Node version:** v0.2.2

### SPEC-007 — Product Stage Transitions

**What:** When `market_visible` becomes true, trigger a `product_stage` transition from `build` → `launch` and surface a new UI context on the Evolution Axis.

**Stage transition logic (server-side cron / webhook callback):**
```ts
// lib/stage-transitions.ts

async function checkStageTransition(idea: Idea) {
  const newStage = computeProductStage(idea)
  if (newStage === idea.productStage) return

  await supabase.from('ideas').update({
    product_stage: newStage,
    stage_entered_at: new Date().toISOString(),
  }).eq('id', idea.id)

  await supabase.from('idea_events').insert({
    idea_id: idea.id,
    event_type: 'product_stage_changed',
    from_value: idea.productStage,
    to_value: newStage,
    metadata: { market_value: idea.marketCurrentValue, target_n: idea.targetN },
  })

  // Trigger stage-specific Opus audit
  await triggerStageAudit(idea.id, newStage)
}

async function triggerStageAudit(ideaId: string, stage: ProductStage) {
  const prompts: Record<ProductStage, string> = {
    build: '',  // no audit on build entry
    launch: `The product just reached its market visibility goal.
             Review the evolution axis and feedback signals.
             Generate a "launch health check": what's working, what needs attention,
             and what the next 3 evolution nodes should focus on (growth, not new features).`,
    scale:  `The product has been live for 90+ days.
             Review all feedback signals, arch decision logs, and the current scope.
             Identify: (1) what has become the real core value, (2) what should be cut,
             (3) where the defensible moat is forming.`,
  }
  if (!prompts[stage]) return
  // POST to Opus, store result as special evolution node type = 'stage_audit'
}
```

**UI changes — Evolution Axis:**
```
When product_stage = 'launch':
  → show stage badge on page header: "🚀 in market · launch stage"
  → Opus audit banner changes message:
      from: "drift detection"
      to:   "growth health check · {n} days in market"
  → [+ add milestone] tooltip hint changes:
      from: "add a new version"
      to:   "add a growth initiative · focus on retention and acquisition"

When product_stage = 'scale':
  → show stage badge: "📈 scaling"
  → new sidebar section: "moat signals"
      lists: unique data collected, workflow integrations, behavioral patterns
      (seeded from arch_decision_logs.agent_notes + feedback_signals)
```

---

### SPEC-008 — Decision Quality Data Flywheel (Seed)

**What:** Begin collecting the structured data that will power cross-idea prediction in v0.3+. This spec is about instrumentation, not a visible UI feature.

**What to collect (all already in the data model, just needs explicit computation):**

```ts
// lib/flywheel-metrics.ts
// Run after each idea reaches a terminal state (in_market, force_closed, closed_no_go)

interface IdeaQualityMetrics {
  ideaId: string
  userId: string
  domain: string | null
  userType: UserType

  // Phase quality scores
  intentRoundsToClarity: number        // how many rounds to reach 85%?
  boundaryItemCount: number            // number of scope items
  boundaryOutOfScopeRatio: number      // out_of_scope / total (high = good discipline)
  validationPassedFirstTry: boolean    // or did they rerun?
  prosecutorFatalRisksCount: number    // how many FATAL risks were found?
  prosecutorRisksAcknowledged: boolean // did user proceed despite risks?

  // Execution quality
  scopeWarningsCount: number           // how many scope warnings were raised?
  scopeWarningsDismissed: number       // how many were dismissed (vs fixed)?
  archLogsCount: number                // number of arch decision logs written
  openspecFailureRate: number          // failed / total openspecs

  // Outcome
  terminalStatus: IdeaStatus
  daysFromContractToMarket: number | null
  marketValueAtClose: number

  computedAt: string
}

// Store in: idea_quality_metrics table (new, simple insert-only)
// This is the raw material for v0.3 cross-idea prediction model
```

**New table:**
```sql
create table idea_quality_metrics (
  id          uuid primary key default gen_random_uuid(),
  idea_id     uuid not null references ideas(id),
  user_id     uuid not null references profiles(id),

  -- phase quality
  intent_rounds_to_clarity    int,
  boundary_item_count         int,
  boundary_out_of_scope_ratio numeric(5,4),
  validation_passed_first_try boolean,
  prosecutor_fatal_risks      int,
  prosecutor_risks_acknowledged boolean,

  -- execution quality
  scope_warnings_count        int,
  scope_warnings_dismissed    int,
  arch_logs_count             int,
  openspec_failure_rate       numeric(5,4),

  -- outcome
  terminal_status             text,
  days_contract_to_market     int,
  market_value_at_close       int,
  domain                      text,
  user_type                   text,

  computed_at timestamptz not null default now()
);
```

**When to compute:** Insert a row when `ideas.status` transitions to any terminal state (`in_market`, `force_closed`, `closed_no_go`). Triggered by the deadline checker and market signal update functions.

---

## v0.2 Rollout Notes

### Migration from v0.1.1

No breaking changes. All new fields were seeded in v0.1.1 with safe defaults:
- `profiles.user_type` defaults to `'technical'` → existing users unaffected
- `ideas.creator_mode` defaults to `'technical'` → existing ideas unaffected
- `ideas.product_stage` defaults to `'build'` → existing ideas unaffected
- `idea_quality_metrics` is a new table — no migration needed

### Feature Flags

Gate all `domain_expert` UX behind:
```ts
const isDomainExpertMode = (profile: Profile, idea: Idea): boolean =>
  profile.userType === 'domain_expert' || idea.creatorMode === 'domain_expert'
```

This allows a technical user to test the domain expert flow by creating an idea with `creator_mode = 'domain_expert'` without changing their profile.

### What v0.2 does NOT include

- A separate onboarding flow for domain experts (they use the same login, same GitHub)
- Any change to the phase gate logic (same unlock conditions for both modes)
- Mobile support (still desktop-first)
- A "switch mode" button (mode is set at idea creation, not changeable mid-idea)
- The v0.3 prediction model (that requires 50+ terminal ideas in the flywheel first)
