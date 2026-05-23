# Maestro — Data Model Spec
> Version: 0.1.1  
> Stack: Supabase (PostgreSQL 15) · Row Level Security · Edge Functions  
> Companion: maestro-ui-spec.md · maestro-interaction-spec.md  
> Changelog: v0.1.1 — added arch_decision_log, dual-mode validation, scope alignment, user_type seed fields

---

## 0. Design Principles

1. **Immutability by design** — fields marked `IMMUTABLE` are write-once. Application layer enforces this; DB layer adds a trigger as second guard.
2. **Audit trail first** — no hard deletes. Status transitions are logged in `_events` tables.
3. **Agent-readable exports** — every phase produces a structured JSON artifact committed to the linked GitHub repo under `.maestro/`.
4. **Single source of truth** — market signal metrics are always fetched live (Stripe webhook, GitHub API). Never cached in the main `ideas` row except as a snapshot.
5. **Architecture decisions are first-class citizens** — every openspec execution writes back a structured decision log. This prevents agentic technical debt from accumulating silently across sessions.
6. **Validation is adversarial by design** — the validation gate runs two independent Opus passes (advocate + prosecutor). A verdict based only on supporting evidence is not a verdict.
7. **User type is a seed field** — `profiles.user_type` and `ideas.creator_mode` are v0.1 seeds for the non-technical founder UX in v0.2. They must be stored from day one.

---

## 1. Entity Map

```
auth.users (Supabase managed)
    │
    ├── profiles                (1:1)
    │
    └── ideas                   (1:N)
            │
            ├── dialogue_messages       (1:N)  phase 1
            ├── intent_canvas           (1:1)  phase 1 output
            ├── scope_items             (1:N)  phase 2
            ├── validation_reports      (1:1)  phase 3 output  ← now dual-mode (advocate + prosecutor)
            ├── evidence_items          (1:N)  phase 3
            ├── contracts               (1:1)  phase 4 — IMMUTABLE after sign
            ├── evolution_nodes         (1:N)  phase 5
            │       └── scope_alignment_checks  (1:N)  per node, auto-run on create
            ├── openspec_changes        (1:N)  phase 5
            │       └── arch_decision_logs      (1:1)  written back after execution
            ├── feedback_signals        (1:N)  phase 5 (ongoing)
            ├── assumption_items        (1:N)  phases 1-2
            └── idea_events             (1:N)  audit log
```

---

## 2. Table Definitions

### 2.1 `profiles`

```sql
create table profiles (
  id              uuid primary key references auth.users on delete cascade,
  github_login    text not null unique,
  github_avatar   text,
  display_name    text,

  -- [v0.1 seed] user type — drives UX mode selection in v0.2
  -- 'technical': current default, full product/engineering vocabulary
  -- 'domain_expert': non-technical founder with industry background (v0.2 UX)
  user_type       text not null default 'technical'
                  check (user_type in ('technical','domain_expert')),
  domain          text,  -- e.g. 'healthcare', 'finance', 'education', 'retail'
                         -- populated during onboarding in v0.2, seed it now

  -- computed metrics (updated by trigger on idea status change)
  total_ideas     int  not null default 0,
  ideas_in_market int  not null default 0,
  ideas_closed    int  not null default 0,
  launch_rate     numeric(5,2) generated always as (
    case when total_ideas = 0 then 0
    else round(ideas_in_market::numeric / total_ideas * 100, 2) end
  ) stored,

  -- integrations (encrypted values stored in vault, these are connection flags)
  github_connected     boolean not null default true,
  supabase_connected   boolean not null default false,
  stripe_connected     boolean not null default false,
  feishu_connected     boolean not null default false,
  feishu_webhook_url   text,

  -- preferences
  pref_opus_audit_notify    boolean not null default true,
  pref_deadline_indicator   boolean not null default true,
  pref_auto_export_context  boolean not null default false,
  pref_feishu_notify        boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

---

### 2.2 `ideas`

Core entity. Tracks the full lifecycle from raw idea to shipped product.

```sql
create table ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,

  -- identity
  name        text not null,
  slug        text unique,  -- auto-generated from name, used in URLs
  description text,
  tags        text[] default '{}',

  -- [v0.1 seed] creator mode — mirrors profile.user_type at idea creation time
  -- allows a technical user to create an idea in 'domain_expert' mode for a non-technical collaborator
  creator_mode  text not null default 'technical'
                check (creator_mode in ('technical','domain_expert')),

  -- [v0.1 seed] product stage — tracks lifecycle beyond contract signing
  -- 'build': pre-market, under development
  -- 'launch': market_visible just became true, growth focus
  -- 'scale': sustained traction, ops and moat building
  product_stage text not null default 'build'
                check (product_stage in ('build','launch','scale')),
  stage_entered_at timestamptz,  -- when product_stage last changed

  -- phase state machine
  current_phase   int  not null default 0
                  check (current_phase between 0 and 6),
  status          text not null default 'draft'
                  check (status in (
                    'draft',        -- phase 0-1: not yet committed
                    'active',       -- phase 5: contract signed, in development
                    'at_risk',      -- deadline < 14 days, market not visible
                    'in_market',    -- success metric reached
                    'force_closed', -- deadline passed, metric not reached
                    'closed_no_go'  -- validation gate returned no_go
                  )),

  -- phase 0: feed
  feed_source_type  text check (feed_source_type in ('text','url','github','file')),
  feed_source_url   text,
  feed_raw_content  text,   -- extracted text from file/url
  feed_completed_at timestamptz,

  -- phase 1: intent dialogue
  intent_clarity        int  not null default 0 check (intent_clarity between 0 and 100),
  intent_rounds         int  not null default 0,
  open_questions_count  int  not null default 0,
  intent_completed_at   timestamptz,

  -- phase 2: boundary definition
  problem_statement   text,
  boundary_locked_at  timestamptz,
  boundary_export_sha text,  -- git commit SHA of .maestro/boundary.json

  -- phase 3: validation gate
  validation_verdict      text check (validation_verdict in ('go','no_go','pending')),
  validation_completed_at timestamptz,

  -- phase 4: product contract — ALL FIELDS IMMUTABLE AFTER contract_signed_at IS SET
  contract_signed_at  timestamptz,
  contract_id         text unique,  -- format: CTR-{id6}-{YYYYMMDD}
  product_type        text check (product_type in ('paid','opensource','internal')),
  deadline            date,         -- IMMUTABLE
  success_metric      text check (success_metric in (
                        'paid_users','github_stars','weekly_downloads','url_reachable'
                      )),           -- IMMUTABLE
  target_n            int,          -- IMMUTABLE
  deadline_extensions_used  int not null default 0
                            check (deadline_extensions_used <= 1),
  extension_post_url  text,  -- public post URL submitted when requesting extension

  -- phase 5: evolution
  current_version     text not null default 'draft',
  github_repo         text,   -- format: "org/repo"
  github_repo_node_id text,   -- GitHub internal ID for API calls

  -- market signal (live, updated by webhook/cron)
  market_current_value   int  not null default 0,
  market_last_checked_at timestamptz,
  market_visible         boolean not null default false,

  -- post-mortem (populated on force_close or closed_no_go)
  postmortem_report  text,
  postmortem_at      timestamptz,

  -- cooling period after force close (7 days before re-creation allowed)
  cooling_ends_at    timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes
create index ideas_user_id_idx      on ideas(user_id);
create index ideas_status_idx       on ideas(status);
create index ideas_deadline_idx     on ideas(deadline) where status = 'active';
create index ideas_slug_idx         on ideas(slug);
```

#### Immutability Trigger

```sql
create or replace function guard_contract_immutability()
returns trigger language plpgsql as $$
begin
  if old.contract_signed_at is not null then
    if new.deadline          != old.deadline          or
       new.success_metric    != old.success_metric    or
       new.target_n          != old.target_n          or
       new.product_type      != old.product_type
    then
      raise exception 'Contract fields are immutable after signing. idea_id: %', old.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger ideas_contract_immutability
before update on ideas
for each row execute function guard_contract_immutability();
```

#### Status Transition Rules

```
draft          → active         (on contract sign)
active         → at_risk        (auto: deadline - now() < 14 days AND NOT market_visible)
active         → in_market      (auto: market_current_value >= target_n)
at_risk        → in_market      (auto: same)
at_risk        → force_closed   (auto: deadline passed AND NOT market_visible)
active         → force_closed   (auto: deadline passed AND NOT market_visible)
draft          → closed_no_go   (manual: user accepts no_go verdict)
```

---

### 2.3 `dialogue_messages`

```sql
create table dialogue_messages (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade,

  role      text not null check (role in ('opus','user')),
  content   text not null,
  round     int  not null,

  -- metadata for context assembly
  tokens_used    int,
  model_used     text default 'claude-opus-4',

  created_at timestamptz not null default now()
);

create index dialogue_idea_round_idx on dialogue_messages(idea_id, round);
```

---

### 2.4 `intent_canvas`

One row per idea. Upserted after each dialogue round.

```sql
create table intent_canvas (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade unique,

  -- canvas fields (null = not yet extracted)
  problem           text,
  root_cause        text,
  mechanism         text,
  target_user       text,
  success_metric_desc text,
  boundary_hint     text,  -- rough boundary, formalized in phase 2

  -- field-level confidence (set by Opus, 0-100)
  problem_confidence      int default 0,
  root_cause_confidence   int default 0,
  mechanism_confidence    int default 0,
  target_user_confidence  int default 0,

  updated_at timestamptz not null default now()
);
```

**Field status computation (application layer):**
```ts
type FieldStatus = 'confirmed' | 'partial' | 'empty'

function fieldStatus(value: string | null, confidence: number): FieldStatus {
  if (!value) return 'empty'
  if (confidence >= 80) return 'confirmed'
  return 'partial'
}
```

---

### 2.5 `assumption_items`

Shared across phases 1 and 2.

```sql
create table assumption_items (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade,

  type    text not null check (type in ('confirmed','negated','open')),
  content text not null,
  phase   int  not null check (phase in (1, 2)),

  -- if negated, what replaced it
  negation_reason text,

  created_at timestamptz not null default now()
);
```

---

### 2.6 `scope_items`

Phase 2 output.

```sql
create table scope_items (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade,

  type    text not null check (type in ('in_scope','out_of_scope','open_question')),
  title   text not null,
  description text,
  status  text not null default 'pending'
          check (status in ('confirmed','needs_confirm','pending')),
  tags    text[] default '{}',  -- e.g. ['core','p1','not_owned','undecided']

  -- opus generated or user added
  source  text not null default 'opus' check (source in ('opus','user')),

  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index scope_items_idea_idx on scope_items(idea_id, type);
```

---

### 2.7 `validation_reports`

Phase 3 output. One row per idea (upserted on re-analyze).  
**v0.1.1:** Split into two independent Opus passes — advocate and prosecutor — to eliminate confirmation bias.

```sql
create table validation_reports (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade unique,

  -- final synthesized verdict (computed from both passes)
  verdict          text check (verdict in ('go','no_go','pending')),
  verdict_summary  text,  -- Opus synthesis narrative, 2-3 sentences

  -- metric cards (shared)
  market_size_signal     text,    -- e.g. "$2.1B"
  competing_products     int,
  paying_customers_found int default 0,

  -- PASS A: advocate (finds supporting evidence)
  -- system prompt: "find the strongest case FOR this idea"
  advocate_go_reasons    text[],
  advocate_evidence      jsonb,   -- array of evidence_items type='advocate'
  advocate_completed_at  timestamptz,

  -- PASS B: prosecutor (finds falsifying evidence)
  -- system prompt: "find the strongest case AGAINST this idea. your job is to kill it."
  prosecutor_risks       text[],
  prosecutor_evidence    jsonb,   -- array of evidence_items type='prosecutor'
  prosecutor_completed_at timestamptz,

  -- synthesis (run after both passes complete)
  synthesis_notes  text,   -- Opus reconciliation of advocate vs prosecutor
  evidence_gaps    text[],

  model_used   text default 'claude-opus-4',
  generated_at timestamptz not null default now()
);
```

**Verdict computation logic (application layer):**
```ts
function computeVerdict(report: ValidationReport): 'go' | 'no_go' | 'pending' {
  if (!report.advocateCompletedAt || !report.prosecutorCompletedAt) return 'pending'

  const goStrength      = report.advocateGoReasons?.length ?? 0
  const riskStrength    = report.prosecutorRisks?.length ?? 0
  const hasKillerRisk   = report.prosecutorRisks?.some(r => r.startsWith('FATAL:'))

  // Any fatal risk → no_go regardless of advocate score
  if (hasKillerRisk) return 'no_go'

  // Synthesis-based: go only if go_reasons clearly outweigh risks
  if (goStrength >= 3 && riskStrength <= 2) return 'go'
  if (riskStrength >= 3 && goStrength <= 1) return 'no_go'

  // Ambiguous: return 'go' with risk acknowledgment (user decides)
  return 'go'
}
```

---

### 2.8 `evidence_items`

Phase 3. Multiple per idea, generated by both Opus passes.

```sql
create table evidence_items (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade,

  -- which validation pass generated this item
  pass_type   text not null default 'advocate'
              check (pass_type in ('advocate','prosecutor')),

  badge       text not null check (badge in (
                'proves_problem','adjacent_signal','adoption_risk','evidence_gap',
                'fatal_risk'   -- prosecutor-only: a risk strong enough to kill the idea
              )),
  title       text not null,
  description text not null,
  source_url  text,

  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
```

---

### 2.9 `contracts`

Phase 4. One row per idea. **All fields write-once after `signed_at` is set.**

```sql
create table contracts (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade unique,

  -- displayed contract ID
  contract_ref    text not null unique,  -- CTR-{idea_id_prefix}-{YYYYMMDD}

  product_type    text not null,   -- IMMUTABLE
  deadline        date not null,   -- IMMUTABLE
  success_metric  text not null,   -- IMMUTABLE
  target_n        int  not null,   -- IMMUTABLE
  github_repo     text not null,

  signed_by_user_id uuid references profiles(id),
  signed_at         timestamptz,

  -- extension (one-time only)
  extension_requested_at  timestamptz,
  extension_post_url      text,        -- required for extension
  extension_new_deadline  date,        -- IMMUTABLE once set
  extension_approved_at   timestamptz,

  created_at timestamptz not null default now()
);

-- Immutability trigger (mirrors ideas table guard)
create or replace function guard_contract_fields()
returns trigger language plpgsql as $$
begin
  if old.signed_at is not null then
    if row(new.product_type, new.deadline, new.success_metric, new.target_n)
       is distinct from
       row(old.product_type, old.deadline, old.success_metric, old.target_n)
    then
      raise exception 'Contract is signed and immutable. contract_ref: %', old.contract_ref;
    end if;
  end if;
  return new;
end;
$$;

create trigger contracts_immutability
before update on contracts
for each row execute function guard_contract_fields();
```

---

### 2.10 `evolution_nodes`

Phase 5. Timeline nodes on the evolution axis.

```sql
create table evolution_nodes (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade,

  version      text not null,   -- e.g. "v0.1.0", "MVP"
  name         text not null,
  description  text,
  status       text not null default 'planned'
               check (status in ('done','current','planned','archived')),

  -- versioning
  node_date         date,
  shipped_at        timestamptz,

  -- linkage
  openspec_count          int not null default 0,
  feedback_signal_count   int not null default 0,
  triggered_by_feedback   uuid references feedback_signals(id),

  -- [v0.1.1] scope alignment check result (auto-run on node create/update)
  scope_check_status    text default 'pending'
                        check (scope_check_status in ('pending','clean','warning','dismissed')),
  scope_check_run_at    timestamptz,
  scope_out_of_bounds   text[],   -- feature titles that exceed locked scope
  scope_warning_dismissed_at timestamptz,
  scope_warning_dismiss_reason text,  -- user must explain why drift is intentional

  -- only one node can be 'current' per idea
  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_current_node_per_idea
  on evolution_nodes(idea_id)
  where status = 'current';
```

---

### 2.10a `arch_decision_logs`

**v0.1.1 — Gap 1 fix.** Written back by Sonnet 4.6 after each openspec execution. Prevents agentic technical debt from accumulating across sessions.

```sql
create table arch_decision_logs (
  id              uuid primary key default gen_random_uuid(),
  openspec_id     uuid not null references openspec_changes(id) on delete cascade unique,
  idea_id         uuid not null references ideas(id) on delete cascade,
  node_id         uuid not null references evolution_nodes(id),

  -- structured decisions made during this execution
  -- Sonnet 4.6 writes this in a structured format after completing the openspec
  decisions       jsonb not null default '[]',
  -- format: [{ area: string, decision: string, reason: string, alternatives_rejected: string[] }]
  -- example: { area: "auth", decision: "used JWT with short expiry",
  --            reason: "supabase native, zero config",
  --            alternatives_rejected: ["session cookies — incompatible with desktop shell"] }

  -- dependency changes introduced by this execution
  deps_added      text[] default '{}',   -- e.g. ['zod@3.22', 'date-fns@3.0']
  deps_removed    text[] default '{}',

  -- files with significant structural changes (not line-level, just paths)
  files_changed   text[] default '{}',

  -- free-form: things that future agents should know before touching this area
  agent_notes     text,

  -- automatically appended to .maestro/context.json after write
  exported_to_context_at timestamptz,
  context_commit_sha      text,

  model_used  text not null default 'claude-sonnet-4-6',
  written_at  timestamptz not null default now()
);

create index arch_logs_idea_idx on arch_decision_logs(idea_id, written_at desc);
```
```

---

### 2.11 `openspec_changes`

Trigger records sent to the coding layer. Linked to an evolution node.

```sql
create table openspec_changes (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade,
  node_id  uuid not null references evolution_nodes(id),

  title       text not null,
  description text,
  spec_json   jsonb not null,  -- the actual openspec payload

  -- execution lifecycle
  status      text not null default 'pending'
              check (status in ('pending','queued','running','done','failed')),
  triggered_at  timestamptz,
  completed_at  timestamptz,
  result_url    text,   -- link to PR or build result
  error_message text,

  -- which model executed
  executed_by text default 'claude-sonnet-4-6',
  reviewed_by text default 'codex',

  created_at timestamptz not null default now()
);
```

---

### 2.12 `feedback_signals`

Phase 5 (ongoing). User/market feedback that can trigger new evolution nodes.

```sql
create table feedback_signals (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade,

  source      text not null check (source in ('user','internal','market','support')),
  content     text not null,
  raw_quote   text,  -- exact user words if available

  -- Opus classification (filled async after ingestion)
  challenges_assumption_id  uuid references assumption_items(id),
  supports_assumption_id    uuid references assumption_items(id),
  suggested_action          text check (suggested_action in (
                              'add_feature','remove_feature','pivot','validate','ignore'
                            )),
  impact_score              int check (impact_score between 1 and 10),
  classified_at             timestamptz,

  -- lifecycle
  status text not null default 'new'
         check (status in ('new','classified','actioned','dismissed')),

  created_at timestamptz not null default now()
);

create index feedback_idea_status_idx on feedback_signals(idea_id, status);
```

---

### 2.13 `idea_events`

Immutable audit log. Every status transition and key action is recorded here.

```sql
create table idea_events (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references ideas(id) on delete cascade,
  user_id  uuid references profiles(id),

  event_type  text not null,
  -- values: phase_advanced | status_changed | contract_signed | deadline_extended
  --         boundary_locked | validation_completed | node_shipped | force_closed
  --         feedback_classified | openspec_triggered | openspec_completed
  --         arch_log_written      ← v0.1.1: Sonnet wrote back a decision log
  --         scope_warning_raised  ← v0.1.1: alignment check found out-of-scope features
  --         scope_warning_dismissed ← v0.1.1: user confirmed drift is intentional
  --         validation_pass_completed ← v0.1.1: one of advocate/prosecutor passes done
  --         product_stage_changed ← v0.1.1: build→launch or launch→scale

  from_value  text,  -- previous state
  to_value    text,  -- new state
  metadata    jsonb, -- event-specific data

  created_at timestamptz not null default now()
);

create index idea_events_idea_idx on idea_events(idea_id, created_at desc);
```

---

## 3. Row Level Security

```sql
-- All tables follow the same RLS pattern: users can only see their own data.
-- Service role (used by Edge Functions and cron) bypasses RLS.

alter table ideas            enable row level security;
alter table dialogue_messages enable row level security;
alter table intent_canvas    enable row level security;
alter table scope_items      enable row level security;
alter table validation_reports enable row level security;
alter table evidence_items   enable row level security;
alter table contracts        enable row level security;
alter table evolution_nodes  enable row level security;
alter table openspec_changes enable row level security;
alter table feedback_signals enable row level security;
alter table assumption_items enable row level security;
alter table idea_events      enable row level security;

-- Pattern (repeat for each table, replacing table name):
create policy "users_own_ideas"
  on ideas for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- For child tables that reference ideas:
create policy "users_own_dialogue"
  on dialogue_messages for all
  using (
    idea_id in (select id from ideas where user_id = auth.uid())
  );
-- (same pattern for all child tables)
```

---

## 4. GitHub Repo Artifacts

Every phase-exit writes a structured JSON file to `.maestro/` in the linked repo.

```
.maestro/
├── boundary.json        ← written on phase 2 lock
├── contract.json        ← written on phase 4 sign
├── context.json         ← living document, updated each phase
└── evolution/
    ├── v0.0.1.json
    ├── v0.1.0.json
    └── current.json     ← symlink / copy of current node
```

### `boundary.json` schema
```ts
interface BoundaryExport {
  exportedAt: string         // ISO timestamp
  ideaId: string
  problemStatement: string
  inScope: { title: string; description: string; tags: string[] }[]
  outOfScope: { title: string; description: string; tags: string[] }[]
  intentCanvas: {
    problem: string; rootCause: string; mechanism: string
    targetUser: string; successMetricDesc: string
  }
  confirmedAssumptions: string[]
  negatedAssumptions: string[]
}
```

### `context.json` schema (AI Agent readable)
```ts
interface MaestroContext {
  version: string          // maestro spec version
  ideaId: string
  productName: string
  currentPhase: number
  currentVersion: string

  // filled progressively
  problemStatement?: string
  boundary?: BoundaryExport
  contract?: {
    productType: string; deadline: string
    successMetric: string; targetN: number
  }
  currentEvolutionNode?: {
    version: string; name: string; description: string
  }

  // for coding agent consumption
  inScopeFeatures: string[]
  outOfScopeFeatures: string[]
  openQuestions: string[]

  // [v0.1.1] architecture decisions — appended after each openspec execution
  // Sonnet 4.6 MUST read this before starting any new openspec
  archDecisions: {
    openspecId: string
    nodeVersion: string
    writtenAt: string
    decisions: {
      area: string
      decision: string
      reason: string
      alternativesRejected: string[]
    }[]
    depsAdded: string[]
    depsRemoved: string[]
    agentNotes: string | null
  }[]
}
```

---

## 5. Market Signal Integration

### Stripe (paid products)
```ts
// Supabase Edge Function: /functions/v1/stripe-webhook
// Event: customer.subscription.created / invoice.payment_succeeded

async function handleStripeEvent(event: Stripe.Event) {
  const ideaId = event.metadata?.maestro_idea_id  // set when creating Stripe product
  if (!ideaId) return

  const paidCount = await countPaidCustomers(ideaId)
  await supabase
    .from('ideas')
    .update({
      market_current_value: paidCount,
      market_last_checked_at: new Date().toISOString(),
      market_visible: paidCount >= idea.target_n,
    })
    .eq('id', ideaId)
}
```

### GitHub Stars (open source)
```ts
// Supabase Edge Function: /functions/v1/github-webhook
// Event: watch (star) or scheduled daily sync

async function syncGitHubStars(ideaId: string, repo: string) {
  const { stargazers_count } = await octokit.repos.get({ owner, repo })
  await supabase.from('ideas').update({
    market_current_value: stargazers_count,
    market_last_checked_at: new Date().toISOString(),
    market_visible: stargazers_count >= idea.target_n,
  }).eq('id', ideaId)
}
```

### URL Reachable
```ts
// Cron: daily check
async function checkUrlReachable(ideaId: string, url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    const reachable = res.ok
    await supabase.from('ideas').update({
      market_current_value: reachable ? 1 : 0,
      market_visible: reachable,
    }).eq('id', ideaId)
  } catch {
    // not reachable
  }
}
```

---

## 6. Deadline Enforcement

```ts
// Cron: runs daily at 00:00 UTC
// Supabase Edge Function: /functions/v1/deadline-check

interface DeadlineCheckResult {
  forced_closed: string[]   // idea IDs
  marked_at_risk: string[]
  still_active: string[]
}

async function runDeadlineCheck(): Promise<DeadlineCheckResult> {
  const today = new Date()

  // 1. Force close: deadline passed, not in market
  const overdue = await supabase.from('ideas')
    .select('*')
    .in('status', ['active', 'at_risk'])
    .lt('deadline', today.toISOString())
    .eq('market_visible', false)

  for (const idea of overdue.data ?? []) {
    await forceClose(idea)
  }

  // 2. Mark at_risk: deadline within 14 days
  const atRisk = await supabase.from('ideas')
    .select('id')
    .eq('status', 'active')
    .eq('market_visible', false)
    .lte('deadline', addDays(today, 14).toISOString())
    .gte('deadline', today.toISOString())

  await supabase.from('ideas')
    .update({ status: 'at_risk' })
    .in('id', atRisk.data?.map(i => i.id) ?? [])

  return { /* ... */ }
}

async function forceClose(idea: Idea) {
  // 1. Update status
  await supabase.from('ideas').update({
    status: 'force_closed',
    cooling_ends_at: addDays(new Date(), 7).toISOString(),
    postmortem_at: new Date().toISOString(),
  }).eq('id', idea.id)

  // 2. Set GitHub repo to archived (via GitHub API)
  await octokit.repos.update({
    owner: idea.github_repo.split('/')[0],
    repo:  idea.github_repo.split('/')[1],
    archived: true,
  })

  // 3. Generate post-mortem (Opus)
  const postmortem = await generatePostmortem(idea)
  await supabase.from('ideas')
    .update({ postmortem_report: postmortem })
    .eq('id', idea.id)

  // 4. Log event
  await supabase.from('idea_events').insert({
    idea_id: idea.id,
    event_type: 'force_closed',
    from_value: idea.status,
    to_value: 'force_closed',
    metadata: { deadline: idea.deadline, market_value: idea.market_current_value },
  })

  // 5. Notify (Feishu / email)
  await notifyUser(idea.user_id, 'force_closed', idea)
}
```

---

## 7. TypeScript Types (Application Layer)

```ts
// types/maestro.ts — single source of truth for frontend + API routes

export type IdeaStatus =
  | 'draft' | 'active' | 'at_risk'
  | 'in_market' | 'force_closed' | 'closed_no_go'

export type PhaseNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type SuccessMetric =
  | 'paid_users' | 'github_stars' | 'weekly_downloads' | 'url_reachable'

export type ProductType = 'paid' | 'opensource' | 'internal'

// [v0.1.1] user type seed
export type UserType = 'technical' | 'domain_expert'

// [v0.1.1] product stage seed
export type ProductStage = 'build' | 'launch' | 'scale'

// [v0.1.1] validation pass type
export type ValidationPassType = 'advocate' | 'prosecutor'

export interface Idea {
  id: string
  userId: string
  name: string
  slug: string
  description: string | null
  currentPhase: PhaseNumber
  status: IdeaStatus

  // [v0.1.1] seed fields
  creatorMode: UserType
  productStage: ProductStage
  stageEnteredAt: string | null

  // phase gates
  feedCompletedAt: string | null
  intentClarity: number           // 0-100
  openQuestionsCount: number
  boundaryLockedAt: string | null
  validationVerdict: 'go' | 'no_go' | 'pending' | null
  contractSignedAt: string | null

  // contract (immutable)
  contractId: string | null
  productType: ProductType | null
  deadline: string | null         // ISO date "YYYY-MM-DD"
  successMetric: SuccessMetric | null
  targetN: number | null
  deadlineExtensionsUsed: number

  // market
  githubRepo: string | null
  marketCurrentValue: number
  marketVisible: boolean

  // evolution
  currentVersion: string

  createdAt: string
  updatedAt: string
}

export interface Profile {
  id: string
  githubLogin: string
  githubAvatar: string | null
  displayName: string | null
  // [v0.1.1] seed fields
  userType: UserType
  domain: string | null
  // metrics
  totalIdeas: number
  ideasInMarket: number
  ideasClosed: number
  launchRate: number
}

export interface ValidationReport {
  ideaId: string
  verdict: 'go' | 'no_go' | 'pending'
  verdictSummary: string | null
  marketSizeSignal: string | null
  competingProducts: number | null
  payingCustomersFound: number
  // [v0.1.1] dual pass
  advocateGoReasons: string[]
  advocateCompletedAt: string | null
  prosecutorRisks: string[]
  prosecutorCompletedAt: string | null
  synthesisNotes: string | null
  evidenceGaps: string[]
}

export interface EvolutionNode {
  id: string
  ideaId: string
  version: string
  name: string
  description: string | null
  status: 'done' | 'current' | 'planned' | 'archived'
  nodeDate: string | null
  shippedAt: string | null
  openspecCount: number
  feedbackSignalCount: number
  triggeredByFeedback: string | null
  sortOrder: number
  // [v0.1.1] scope alignment
  scopeCheckStatus: 'pending' | 'clean' | 'warning' | 'dismissed'
  scopeCheckRunAt: string | null
  scopeOutOfBounds: string[]
  scopeWarningDismissedAt: string | null
}

// [v0.1.1] new type
export interface ArchDecisionLog {
  id: string
  openspecId: string
  ideaId: string
  nodeId: string
  decisions: {
    area: string
    decision: string
    reason: string
    alternativesRejected: string[]
  }[]
  depsAdded: string[]
  depsRemoved: string[]
  filesChanged: string[]
  agentNotes: string | null
  exportedToContextAt: string | null
  writtenAt: string
}

export interface ScopeItem {
  id: string
  ideaId: string
  type: 'in_scope' | 'out_of_scope' | 'open_question'
  title: string
  description: string | null
  status: 'confirmed' | 'needs_confirm' | 'pending'
  tags: string[]
  source: 'opus' | 'user'
  sortOrder: number
}

export interface IntentCanvas {
  ideaId: string
  problem: string | null
  rootCause: string | null
  mechanism: string | null
  targetUser: string | null
  successMetricDesc: string | null
  boundaryHint: string | null
  problemConfidence: number
  rootCauseConfidence: number
  mechanismConfidence: number
  targetUserConfidence: number
}

export interface FeedbackSignal {
  id: string
  ideaId: string
  source: 'user' | 'internal' | 'market' | 'support'
  content: string
  rawQuote: string | null
  challengesAssumptionId: string | null
  supportsAssumptionId: string | null
  suggestedAction: 'add_feature' | 'remove_feature' | 'pivot' | 'validate' | 'ignore' | null
  impactScore: number | null
  status: 'new' | 'classified' | 'actioned' | 'dismissed'
  createdAt: string
}
```

```ts
// types/maestro.ts — single source of truth for frontend + API routes

export type IdeaStatus =
  | 'draft' | 'active' | 'at_risk'
  | 'in_market' | 'force_closed' | 'closed_no_go'

export type PhaseNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type SuccessMetric =
  | 'paid_users' | 'github_stars' | 'weekly_downloads' | 'url_reachable'

export type ProductType = 'paid' | 'opensource' | 'internal'

export interface Idea {
  id: string
  userId: string
  name: string
  slug: string
  description: string | null
  currentPhase: PhaseNumber
  status: IdeaStatus

  // phase gates
  feedCompletedAt: string | null
  intentClarity: number           // 0-100
  openQuestionsCount: number
  boundaryLockedAt: string | null
  validationVerdict: 'go' | 'no_go' | 'pending' | null
  contractSignedAt: string | null

  // contract (immutable)
  contractId: string | null
  productType: ProductType | null
  deadline: string | null         // ISO date "YYYY-MM-DD"
  successMetric: SuccessMetric | null
  targetN: number | null
  deadlineExtensionsUsed: number

  // market
  githubRepo: string | null
  marketCurrentValue: number
  marketVisible: boolean

  // evolution
  currentVersion: string

  createdAt: string
  updatedAt: string
}

export interface IntentCanvas {
  ideaId: string
  problem: string | null
  rootCause: string | null
  mechanism: string | null
  targetUser: string | null
  successMetricDesc: string | null
  boundaryHint: string | null
  problemConfidence: number
  rootCauseConfidence: number
  mechanismConfidence: number
  targetUserConfidence: number
}

export interface ScopeItem {
  id: string
  ideaId: string
  type: 'in_scope' | 'out_of_scope' | 'open_question'
  title: string
  description: string | null
  status: 'confirmed' | 'needs_confirm' | 'pending'
  tags: string[]
  source: 'opus' | 'user'
  sortOrder: number
}

export interface EvolutionNode {
  id: string
  ideaId: string
  version: string
  name: string
  description: string | null
  status: 'done' | 'current' | 'planned' | 'archived'
  nodeDate: string | null
  shippedAt: string | null
  openspecCount: number
  feedbackSignalCount: number
  triggeredByFeedback: string | null
  sortOrder: number
}

export interface FeedbackSignal {
  id: string
  ideaId: string
  source: 'user' | 'internal' | 'market' | 'support'
  content: string
  rawQuote: string | null
  challengesAssumptionId: string | null
  supportsAssumptionId: string | null
  suggestedAction: 'add_feature' | 'remove_feature' | 'pivot' | 'validate' | 'ignore' | null
  impactScore: number | null
  status: 'new' | 'classified' | 'actioned' | 'dismissed'
  createdAt: string
}
```

---

## 8. Computed / Derived Values

These are never stored; always computed at query time or in application layer.

```ts
// lib/computed.ts

export function deadlineDaysLeft(deadline: string): number {
  return Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
}

export function deadlineProgress(idea: Idea): number {
  if (!idea.deadline || !idea.contractSignedAt) return 0
  const total = new Date(idea.deadline).getTime() - new Date(idea.contractSignedAt).getTime()
  const elapsed = Date.now() - new Date(idea.contractSignedAt).getTime()
  return Math.min(100, Math.round((elapsed / total) * 100))
}

export function deadlineColor(daysLeft: number): 'danger' | 'warn' | 'ok' {
  if (daysLeft <= 14) return 'danger'
  if (daysLeft <= 30) return 'warn'
  return 'ok'
}

export function phaseIsUnlocked(phase: PhaseNumber, idea: Idea): boolean {
  switch (phase) {
    case 0: return true
    case 1: return idea.feedCompletedAt !== null
    case 2: return idea.intentClarity >= 85 && idea.openQuestionsCount === 0
    case 3: return idea.boundaryLockedAt !== null
    case 4: return idea.validationVerdict === 'go'
    case 5: return idea.contractSignedAt !== null
    case 6: return idea.contractSignedAt !== null
    default: return false
  }
}

export function canRequestExtension(idea: Idea): boolean {
  return (
    idea.deadlineExtensionsUsed === 0 &&
    idea.status === 'at_risk' &&
    idea.contractSignedAt !== null
  )
}

// [v0.1.1] scope alignment helpers
export function nodeHasUnresolvedScopeWarning(node: EvolutionNode): boolean {
  return node.scopeCheckStatus === 'warning'
}

export function canTriggerOpenspec(node: EvolutionNode): boolean {
  // Block openspec trigger if scope warning not resolved
  return node.scopeCheckStatus !== 'warning'
}

// [v0.1.1] validation report helpers
export function validationIsComplete(report: ValidationReport): boolean {
  return report.advocateCompletedAt !== null && report.prosecutorCompletedAt !== null
}

export function validationProgress(report: ValidationReport): 0 | 1 | 2 {
  if (!report.advocateCompletedAt && !report.prosecutorCompletedAt) return 0
  if (report.advocateCompletedAt && !report.prosecutorCompletedAt) return 1
  if (!report.advocateCompletedAt && report.prosecutorCompletedAt) return 1
  return 2
}

// [v0.1.1] product stage auto-transition
export function computeProductStage(idea: Idea): ProductStage {
  if (idea.marketVisible) {
    // Once market visible, check if traction is sustained (rough heuristic for v0.1)
    const daysSinceVisible = idea.stageEnteredAt
      ? Math.floor((Date.now() - new Date(idea.stageEnteredAt).getTime()) / 86400000)
      : 0
    if (idea.productStage === 'launch' && daysSinceVisible > 90) return 'scale'
    return 'launch'
  }
  return 'build'
}
```
