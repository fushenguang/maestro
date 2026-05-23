# Maestro — Interaction Spec
> Version: 0.1.1  
> Companion: maestro-ui-spec.md · maestro-data-spec.md  
> Changelog: v0.1.1 — dual-mode validation UX, scope alignment check flow, arch log writeback prompt, user_type seed onboarding

---

## 0. Interaction Principles

1. **No dead ends** — every state has a clear next action or an explicit explanation of what's blocking it.
2. **Irreversible actions need friction** — contract sign, boundary lock, force-close: all require explicit confirmation. One-step is not enough.
3. **Opus output is never auto-applied** — LLM outputs are always presented for review before any state changes. User is always in control.
4. **Loading states are meaningful** — don't show a spinner with no context. Show what Opus is currently doing (e.g. "analyzing market data...").
5. **Errors are actionable** — every error message ends with what the user can do next.
6. **[v0.1.1] Validation is adversarial** — the two-pass validation (advocate + prosecutor) runs sequentially and is presented as two distinct panels. The verdict is always shown with both sides visible. Users cannot see only the go-reasons.
7. **[v0.1.1] Scope warnings block openspec triggers** — a node with an unresolved scope alignment warning cannot trigger openspec execution. The user must explicitly dismiss the warning with a reason first.
8. **[v0.1.1] Arch log writeback is part of the openspec contract** — when an openspec completes, the UI prompts Sonnet 4.6 to write the decision log before marking the change as done.

---

## 1. Auth Flow

### 1.1 First Visit (unauthenticated)
```
Any route → redirect to /login

/login page:
  [Continue with GitHub] click
    → supabase.auth.signInWithOAuth({ provider: 'github' })
    → GitHub OAuth screen (browser)
    → callback: /auth/callback?code=...
    → Supabase exchanges code for session
    → if new user:
        create profiles row (user_type = 'technical' as default)
        → show onboarding modal: [v0.1.1 seed collection]
            "how would you describe yourself?"
            [I'm a developer / technical founder]  → user_type = 'technical'
            [I have domain expertise, not a developer] → user_type = 'domain_expert'
                + optional: "what's your domain?" (free text → profiles.domain)
            note: this only affects v0.2 UX. in v0.1, both types get the same interface.
                  the selection is stored to power the non-technical UX in v0.2.
        → redirect to /dashboard
    → if existing user: restore session → redirect to /dashboard
```

### 1.2 Session Expiry
```
API call returns 401
  → clear local session
  → toast: "session expired · please sign in again"
  → redirect to /login
  → after re-auth: redirect back to original URL (store in localStorage before redirect)
```

### 1.3 Sign Out
```
Profile sidebar "sign out" click
  → no confirmation needed (non-destructive)
  → supabase.auth.signOut()
  → redirect to /login
  → clear all cached data (React Query / SWR cache)
```

---

## 2. Dashboard

### 2.1 Initial Load
```
/dashboard mounts
  → fetch: ideas list (status, deadline, market signal, version)
  → fetch: profile stats (total, in_market, force_closed)
  → skeleton loading for stats bar + table rows
  → render in < 300ms perceived (optimistic UI with cached data if available)
```

### 2.2 New Idea Button
```
[new idea] click
  → if ideas with status='draft' exist:
      tooltip: "you have 1 unfinished idea · continue or start new?"
      [continue] → navigate to /ideas/{draft_id}/feed
      [start new] → navigate to /ideas/new
  → else: navigate to /ideas/new
```

### 2.3 Product Row Click
```
Any row click → navigate to /ideas/{id}
  → shell loads with left-side phase nav
  → auto-redirect to current active phase:
      current_phase = 0 → /ideas/{id}/feed
      current_phase = 1 → /ideas/{id}/intent
      current_phase = 2 → /ideas/{id}/boundary
      current_phase = 3 → /ideas/{id}/validation
      current_phase = 4 → /ideas/{id}/contract
      current_phase >= 5 → /ideas/{id}/evolution
```

### 2.4 Filter Tabs
```
[all] [active] [at risk] [closed] — client-side filter, no re-fetch
"at risk" = status in ('at_risk') OR (status='active' AND deadlineDaysLeft <= 14)
```

### 2.5 Stats Bar
Real-time via Supabase Realtime subscription on the `ideas` table.
```ts
supabase.channel('dashboard-stats')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'ideas',
    filter: `user_id=eq.${userId}`
  }, () => refetchStats())
  .subscribe()
```

---

## 3. Phase Navigation (Left Sidebar)

### 3.1 Phase Item Click
```
Click on phase item:
  if phaseIsUnlocked(phase, idea):
    navigate to /ideas/{id}/{phasePath}
  else:
    show tooltip: "{what's needed to unlock this phase}"
    no navigation
```

### 3.2 Unlock Tooltips
| Phase | Locked tooltip |
|---|---|
| intent | complete feed first |
| boundary | intent clarity must reach 85% · resolve open questions |
| validation | lock boundary definition first |
| contract | validation gate must return "go" |
| evolution | sign the product contract first |

### 3.3 Visual State
```
done   → green filled dot with checkmark
active → black filled dot with phase number (pulsing ring if action needed)
locked → empty border dot with phase number, 60% opacity row
```

---

## 4. PHASE 0 — Feed

### 4.1 Text Input
```
User types in textarea
  → no auto-submit
  → [analyze idea ↗] button activates when length > 20 chars
```

### 4.2 URL Paste
```
User pastes URL into URL input
  → debounce 400ms
  → detect type:
      github.com/{owner}/{repo} → set chip to "github repo", show repo preview
      any other URL → set chip to "url / article"
  → [fetch] click:
      POST /api/ideas/fetch-url { url }
      → loading: "fetching content..."
      → success: populate textarea with extracted text
      → error: "couldn't fetch this URL · try pasting the text directly"
```

### 4.3 GitHub Repo URL — Enhanced Fetch
```
GitHub URL detected:
  → fetch: README, star count, open issues, last commit date
  → show preview card below input:
      repo name · stars · last active
      README excerpt (first 200 chars)
  → [use this repo] pre-fills:
      textarea: README summary + pain points extracted by Opus
      github repo link input: owner/repo
```

### 4.4 File Drop
```
File dropped on drop zone:
  supported: .md, .txt, .pdf, .docx
  unsupported: toast "only .md, .txt, .pdf, .docx supported"

  supported file:
    → show filename + size in drop zone
    → upload to Supabase Storage: ideas/uploads/{userId}/{ideaId}/{filename}
    → extract text (server-side): POST /api/ideas/extract-file
    → populate textarea with extracted text
    → [clear file] × button appears
```

### 4.5 Source Chips (mutually exclusive)
```
Click chip → select it (single select), deselect others
Selected chip = feed_source_type for the idea
If URL input has value when "url/article" or "github" chip selected → pre-validate
```

### 4.6 Submit (Analyze Idea)
```
[analyze idea ↗] click:
  → validate: textarea not empty
  → create idea record:
      POST /api/ideas { name: derived from first sentence, feed_source_type, feed_raw_content }
  → navigate to /ideas/{new_id}/feed (same page, now with idea_id)
  → trigger Opus analysis:
      background job: extract problem_statement_draft from feed content
      on complete: update ideas.problem_statement_draft
                   set feed_completed_at
                   unlock phase 1
  → show loading state: "opus is reading your idea..."
  → on complete: show problem statement draft + [proceed to intent dialogue] CTA
```

---

## 5. PHASE 1 — Intent Dialogue

### 5.1 Page Load
```
/ideas/{id}/intent loads:
  → fetch dialogue_messages for this idea (all rounds)
  → fetch intent_canvas
  → fetch assumption_items
  → if round = 0 (first visit):
      auto-trigger: POST /api/ideas/{id}/intent-rounds { action: 'start' }
      → Opus reads feed content + problem_statement
      → generates first A2UI form (SSE stream)
      → stream renders in A2UI zone
  → if round > 0:
      show existing thread + current A2UI form (if round is open)
```

### 5.2 A2UI Form Interaction
```
A2UI zone receives stream from /api/ideas/{id}/intent-form?round={n}
  → renders questions dynamically as SSE chunks arrive
  → user fills in answers (radio, textarea, multi-select)
  → [submit · let opus evaluate ↗] click:
      POST /api/ideas/{id}/intent-rounds {
        round: n,
        answers: [{ questionId, value }]
      }
      → save user message to dialogue_messages
      → Opus processes answers:
          1. update intent_canvas fields
          2. recalculate intentClarity (0-100)
          3. update openQuestionsCount
          4. generate Opus response message
          5. if intentClarity < 85 OR openQuestionsCount > 0:
               generate next A2UI form for round n+1
             else:
               set intent_completed_at
               show: "intent is clear · you can proceed to boundary definition"
```

### 5.3 Round Skip
```
[skip this round] click:
  → confirm dialog: "skipping will reduce intent clarity score · proceed?"
  → [skip anyway]: increment round counter, do not submit answers
  → Opus still generates next round based on remaining canvas gaps
```

### 5.4 Intent Canvas (Right Panel)
```
Live updates via Supabase Realtime on intent_canvas table
Each field shows:
  'confirmed' (confidence ≥ 80) → primary text color
  'partial'   (confidence 40-79) → amber text color
  'empty'     (no value or < 40)  → muted italic "not yet defined"
```

### 5.5 Proceed to Boundary
```
[intent clear · next ↗] — only active when intentClarity >= 85 AND openQuestionsCount = 0
  → click: navigate to /ideas/{id}/boundary
  → boundary phase auto-initializes: Opus reads intent_canvas → generates scope_items
```

### 5.6 History View
```
[history] button → expand panel below topbar showing all past rounds
  → each round shown as collapsed accordion: "round N · {date}"
  → expand → show dialogue_messages for that round
```

---

## 6. PHASE 2 — Boundary Definition

### 6.1 Page Load
```
/ideas/{id}/boundary loads:
  → fetch scope_items
  → if scope_items.length = 0 (first visit):
      auto-trigger: POST /api/ideas/{id}/boundary/analyze
      → loading: "opus is defining the problem domain..."
      → Opus reads intent_canvas + assumption_items
      → generates 5-8 scope_items (mix of in/out/open)
      → inserts to scope_items table
      → renders when complete
```

### 6.2 Scope Item Status Change
```
Each "needs_confirm" card shows two actions:
  [confirm] → set status = 'confirmed' · green border · badge changes
  [edit]    → inline edit: title + description become editable textarea
               [save] → patch scope_items, recalculate completeness
  
"pending" (open_question) cards show:
  [mark in scope]  → change type to 'in_scope', status to 'confirmed'
  [mark out scope] → change type to 'out_of_scope', status to 'confirmed'
  [keep open]      → no change, stays as open_question
```

### 6.3 Re-analyze
```
[re-analyze] click:
  → confirm: "this will regenerate the scope canvas · confirmed items will be preserved"
  → [re-analyze]: DELETE scope_items where source = 'opus'
  → re-trigger Opus analysis (same as first visit)
  → user-added items (source = 'user') are preserved
```

### 6.4 Add Custom Item
```
[+ add item] button (in sec-label area):
  → inline form appears below grid:
      type: [in scope ▾] | out of scope | open question
      title: input
      description: textarea
      [add] → insert scope_items with source = 'user'
```

### 6.5 Lock Boundary
```
[lock boundary ↗] — disabled until:
  scope_items.every(i => i.status !== 'needs_confirm') AND
  scope_items.filter(i.type === 'open_question').every(i => i.status !== 'pending')

Click on disabled button → tooltip: "2 items need confirmation before locking"

Click on enabled button:
  → confirmation modal:
      "locking boundary is permanent. future changes must be made through the evolution axis."
      [cancel] | [lock permanently]
  → [lock permanently]:
      1. POST /api/ideas/{id}/boundary/lock
      2. set ideas.boundary_locked_at = now()
      3. commit .maestro/boundary.json to GitHub repo
      4. unlock phase 3 (validation gate)
      5. navigate to /ideas/{id}/validation with toast: "boundary locked · validation gate unlocked"
```

### 6.6 Export Agent Context
```
[export as agent context] click:
  → POST /api/ideas/{id}/export-context
  → generates context.json
  → commits to GitHub: .maestro/context.json
  → toast: "context exported · committed to {repo}//.maestro/context.json"
  → show link to GitHub commit
```

---

## 7. PHASE 3 — Validation Gate

### 7.1 Page Load
```
/ideas/{id}/validation loads:
  → fetch validation_reports for this idea
  → if no report (first visit):
      auto-trigger: POST /api/ideas/{id}/validation/run
      → runs TWO sequential Opus passes (see 7.1a and 7.1b)
  → if report exists but incomplete (one pass done):
      show completed pass + in-progress indicator for pending pass
  → if report complete: render full dual-panel view
```

### 7.1a Pass A — Advocate
```
POST /api/ideas/{id}/validation/run triggers Pass A first:
  system prompt: "find the strongest case FOR this idea. your role is advocate."

  loading steps:
    "searching for market evidence..."   (2-4s)
    "finding proof of the problem..."    (2-3s)
    "building the case for go..."        (1-2s)

  on complete:
    → insert evidence_items with pass_type = 'advocate'
    → update validation_reports.advocate_completed_at
    → render advocate panel immediately (don't wait for prosecutor)
    → auto-trigger Pass B
```

### 7.1b Pass B — Prosecutor
```
Runs automatically after Pass A completes:
  system prompt: "find the strongest case AGAINST this idea.
                  your role is prosecutor. your job is to kill it.
                  look for: fatal market assumptions, unsolvable competition,
                  user behavior that won't change, unit economics that don't work."

  loading steps (shown in prosecutor panel while advocate panel is already visible):
    "challenging your assumptions..."    (2-4s)
    "looking for fatal risks..."         (3-4s)
    "stress-testing the model..."        (2-3s)
    "forming the case against..."        (1-2s)

  on complete:
    → insert evidence_items with pass_type = 'prosecutor'
    → update validation_reports.prosecutor_completed_at
    → compute verdict via computeVerdict()
    → render prosecutor panel + synthesized verdict banner
```

### 7.2 Dual-Panel Layout
```
Two side-by-side panels:

LEFT — Advocate                    RIGHT — Prosecutor
─────────────────────              ──────────────────────
badge: "case for"                  badge: "case against"
[green evidence cards]             [red/amber evidence cards]
go_reasons list                    risks list (incl. FATAL: prefix)

Below both panels:
  synthesis banner: Opus reconciliation of both sides
  verdict: GO / NO-GO / AMBIGUOUS
```

### 7.3 Verdict: Go
```
verdict = 'go':
  → green synthesis banner: "opus verdict: go · {synthesisNotes}"
  → [accept · proceed ↗] button active
  → [close idea] present but muted

[accept · proceed ↗]:
  → set ideas.validation_verdict = 'go'
  → set ideas.validation_completed_at = now()
  → navigate to /ideas/{id}/contract
```

### 7.4 Verdict: No-Go
```
verdict = 'no_go':
  → red synthesis banner: "opus verdict: no-go · {synthesisNotes}"
  → highlight the FATAL: risk item in prosecutor panel
  → [close idea] is primary CTA
  → [proceed anyway] shown as text link with warning icon

[close idea] and [proceed anyway]: same as v0.1.0 spec (unchanged)
```

### 7.5 Verdict: Ambiguous
```
verdict ambiguous (go strength ≈ risk strength, no FATAL risks):
  → amber synthesis banner: "ambiguous · prosecutor found real risks but no fatal ones"
  → both panels highlighted
  → [accept risks · proceed] and [close idea] shown as equal-weight buttons
  → [accept risks · proceed]:
      → confirmation: "the prosecutor found {n} risks. proceeding means you own these risks."
      → [confirm] → treat as 'go'
```

### 7.6 Re-run Validation
```
[re-analyze] button (visible after any completed pass):
  → confirm: "this will re-run both advocate and prosecutor passes · ~20 seconds"
  → DELETE existing validation_reports row + evidence_items
  → re-trigger both passes (same as first visit)
```

---

## 8. PHASE 4 — Product Contract

### 8.1 Page Load
```
/ideas/{id}/contract loads:
  → fetch contracts record (if exists)
  → if contract.signed_at is NOT null:
      render ALL fields as read-only (no inputs)
      show signed timestamp + contract_ref
      show [view on github] link to .maestro/contract.json
      show [proceed to evolution axis] CTA
  → if not signed:
      render editable form
      pre-fill from ideas record where available
```

### 8.2 Pre-sign Checklist (automated)
```
Checklist items auto-resolve:
  ✓ "boundary definition locked" ← ideas.boundary_locked_at is not null
  ✓ "validation gate: go"        ← ideas.validation_verdict = 'go'
  ✓ "github repo verified"       ← github_repo_verified = true (see 8.3)
  □ "deadline is final"          ← user must manually check
  □ "success metric is final"    ← user must manually check

[sign contract ↗] disabled until all 5 checked
```

### 8.3 GitHub Repo Verification
```
User types in "org/repo" input
[verify] click:
  → GET /api/github/verify-repo { repo: "org/repo" }
  → checks: repo exists, user has push access, not archived
  → success: green checkmark · "yourteam/maestro · verified"
  → failure: red × · "repo not found or no access"

[create new repo] link (alternative):
  → POST /api/github/create-repo { name: ideaSlug }
  → creates repo under user's default org
  → auto-fills repo input + marks verified
```

### 8.4 Sign Contract
```
[sign contract ↗] click (all checklist items checked):
  → confirmation modal (high-friction):
      title: "this is permanent"
      body: "deadline: {date} · metric: {metric} > {n}
             these cannot be changed after signing.
             if you miss the deadline without reaching your goal, this product will be archived."
      two-step: 
        step 1: [i understand · sign contract]
        step 2: (after 1.5s delay) [confirm signing]
  
  → on confirm:
      POST /api/ideas/{id}/contract/sign {
        productType, deadline, successMetric, targetN, githubRepo
      }
      → 1. insert contracts row with signed_at = now()
      → 2. update ideas: contract_signed_at, current_phase = 5
      → 3. generate contract_ref: CTR-{idea_id[0:6]}-{YYYYMMDD}
      → 4. commit .maestro/contract.json to GitHub
      → 5. create GitHub milestone: deadline date, title: "maestro deadline"
      → 6. Opus generates initial roadmap (3-5 evolution nodes)
      → 7. Opus generates first MVP openspec_changes
      → 8. schedule deadline checker for this idea_id
      → navigate to /ideas/{id}/evolution
      → toast: "contract signed · {contractRef} · evolution axis unlocked"
```

### 8.5 Extension Request
```
Only available from evolution axis when status = 'at_risk' AND extensions_used = 0

[request extension] link (in deadline card, at_risk state):
  → slide-in panel:
      "you have 1 extension available · you must publish a public post explaining:
       what you've built, why you need more time, and your revised commitment."
      
      [post url input] — paste your published post URL
      [new deadline input]
      
      validation: URL must be reachable · new deadline must be > current deadline
      
  → [submit extension request]:
      → verify URL is publicly reachable
      → update contracts: extension_requested_at, extension_post_url, extension_new_deadline
      → update ideas: deadline = extension_new_deadline, deadline_extensions_used = 1
      → log idea_events: event_type = 'deadline_extended'
      → toast: "extension granted · new deadline: {date} · no more extensions available"
```

---

## 9. PHASE 5 — Evolution Axis

### 9.1 Page Load
```
/ideas/{id}/evolution loads:
  → fetch evolution_nodes (ordered by sort_order)
  → fetch feedback_signals (recent, unclassified)
  → fetch openspec_changes (status: running or recent done)
  → check for opus audit alert:
      if newFeatureCount > mvpFeatureCount: show audit banner
      if unaddressed_feedback > 5: show audit banner
      if daysSinceLastShip > 14: show audit banner
```

### 9.2 Add Milestone
```
[+ add milestone] click:
  → inline form appears after last 'planned' node:
      version: input (auto-suggest next semver)
      name: input
      description: textarea
      node_date: date picker (optional)
  → [add] → insert evolution_nodes with status = 'planned'
  → [v0.1.1] immediately auto-trigger scope alignment check:
      POST /api/ideas/{id}/nodes/{nodeId}/scope-check
      → Opus reads: node.description + scope_items (in_scope list)
      → returns: { status: 'clean'|'warning', outOfBounds: string[] }
      → update evolution_nodes.scope_check_status
      → if 'warning': show amber warning badge on node card (see 9.2a)
      → if 'clean': show subtle green indicator, no action needed
```

### 9.2a Scope Alignment Warning
```
Node card shows amber warning when scope_check_status = 'warning':

  [!] scope warning: these features may exceed your locked boundary:
      · "{feature title 1}"
      · "{feature title 2}"
      is this intentional scope expansion, or unintentional drift?

  Two actions:
  [this is intentional expansion ↗]
    → slide-in: "explain why this expansion is justified"
      textarea: reason (required, min 20 chars)
      [confirm expansion]
        → set scope_check_status = 'dismissed'
        → set scope_warning_dismissed_at = now()
        → set scope_warning_dismiss_reason = reason
        → log idea_events: event_type = 'scope_warning_dismissed', metadata: { reason, features }
        → node card returns to normal state

  [remove out-of-scope features]
    → edit node inline, remove flagged features
    → [re-check scope] → re-run scope alignment check

  IMPORTANT: [trigger openspec ↗] is DISABLED while scope_check_status = 'warning'
  Tooltip on disabled button: "resolve scope warning before triggering build"
```

### 9.3 Node Actions
```
Done node: click → expand to show openspec_changes list + arch_decision_logs
Current node: 
  → [trigger openspec ↗]:
      BLOCKED if scope_check_status = 'warning' (see 9.2a)
      if scope_check_status = 'clean' or 'dismissed':
        POST /api/ideas/{id}/openspec { nodeId }
        → creates openspec_changes records
        → queues execution to coding layer (Sonnet 4.6)
        → progress indicator on node card

  → on openspec execution COMPLETE: [v0.1.1 arch log writeback]
      DO NOT mark openspec as 'done' yet.
      POST /api/ideas/{id}/openspec/{changeId}/request-arch-log
        → sends prompt to Sonnet 4.6:
            "The openspec '{title}' has been executed.
             Before this change is marked complete, write a structured architecture
             decision log covering:
             1. Key decisions made (area, decision, reason, alternatives rejected)
             2. Dependencies added or removed
             3. Files with significant structural changes
             4. Agent notes: anything the next agent must know before touching this area
             Return as JSON matching the ArchDecisionLog schema."
        → on Sonnet response: insert arch_decision_logs record
        → update openspec_changes.status = 'done'
        → append to .maestro/context.json archDecisions array
        → commit context.json to GitHub
        → show on node card: "arch log written · context updated"

  → [mark shipped]: 
      set status = 'done', shipped_at = now()
      promote next 'planned' node to 'current'
      auto-run scope check on newly promoted node

Planned node: click → edit inline (version, name, description)
  → on description change: re-run scope alignment check
```

### 9.4 Opus Audit Banner
```
Banner appears with:
  - specific observation (e.g. "v0.1.0 added 3 features, MVP defined 2")
  - [review with opus ↗] button
  
[review with opus ↗]:
  → POST /api/ideas/{id}/audit
  → Opus reads: intent_canvas, scope_items, all evolution_nodes,
                feedback_signals, arch_decision_logs  ← [v0.1.1: now includes arch logs]
  → returns: { isDrifting: bool, driftReason: string, recommendation: string }
  → renders result in expandable panel below banner
  → user can: [acknowledge drift · add correction node] | [dismiss · everything is intentional]
```

### 9.5 Feedback Signals
```
[+ add feedback] (in right sidebar):
  → inline form: source (dropdown) + content (textarea) + raw_quote (optional)
  → on submit: insert feedback_signals
  → async: POST /api/ideas/{id}/feedback/{signalId}/classify
      → Opus classifies: suggestedAction, impactScore, links to assumptions
      → updates feedback_signals record
      → if impactScore > 7: trigger notification

Feedback signal click:
  → expand to show classification details
  → [create evolution node from this signal]: 
      pre-fills new node form with suggested feature from signal
      sets triggeredByFeedback = signal.id
```

### 9.6 Detail Tabs
```
Tab: "evolution axis" → current page content
Tab: "decision tree"  → (v0.2 placeholder) "decision tree view coming in v0.2"
Tab: "feedback"       → full feedback_signals list with filters
Tab: "context"        → read-only view of .maestro/context.json
                         + [sync to github ↗] button
```

---

## 10. User Center

### 10.1 Profile Navigation
```
Top nav "profile" or avatar click → /profile
Left sidebar menu click:
  overview       → /profile
  settings       → /profile/settings
  integrations   → /profile/integrations
  llm config     → /profile/llm
  security       → /profile/security
  delete account → /profile/delete (danger zone)
  sign out       → signout action (no page)
```

### 10.2 Settings — Toggle Interactions
```
Toggle click:
  → optimistic update (immediate visual flip)
  → PATCH /api/profile/preferences { key: value }
  → on error: revert toggle + toast "failed to save · try again"
```

### 10.3 Integrations — Connect Flow

**Stripe:**
```
[connect ↗] click:
  → slide-in panel: "paste your Stripe API key · we'll store it encrypted in vault"
  → [API key input] + [verify & save]
  → POST /api/profile/integrations/stripe { apiKey }
  → server: store in Supabase Vault, test connection, set stripe_connected = true
  → on success: show connected state + last 4 of key
  → [disconnect]: confirm → delete from vault, set stripe_connected = false
```

**Feishu:**
```
[connect ↗] click:
  → slide-in panel: "paste your Feishu bot webhook URL"
  → [webhook URL input] + [test & save]
  → POST /api/profile/integrations/feishu { webhookUrl }
  → server: send test message to webhook
  → on success: show connected state
```

### 10.4 Delete Account
```
/profile/delete:
  → full page with strong warning
  → lists what will be deleted: all ideas, contracts, dialogue history
  → type full github_login to confirm
  → [delete everything] → DELETE /api/profile
      → anonymize: set user_id = null on all records (soft delete)
      → delete auth.users entry
      → supabase.auth.signOut()
      → redirect to /login with toast "account deleted"
```

---

## 11. Global Interactions

### 11.1 Force Close (triggered by cron)
```
User opens app after force-close event:
  → if any idea was force-closed since last visit:
      modal on /dashboard:
        title: "1 product reached its deadline"
        body: "{product name} was archived · {marketValue} of {targetN} {metric}"
        [view post-mortem] | [start over] (only after cooling period)
      [view post-mortem] → navigate to /ideas/{id}/postmortem (read-only view)
      [start over] (available after cooling_ends_at):
        → creates new idea pre-filled with old product name + "v2" suffix
        → old idea stays archived
```

### 11.2 Real-time Market Signal Updates
```
Supabase Realtime subscription on ideas WHERE user_id = me:
  market_visible changes to true:
    → confetti animation on dashboard row
    → toast: "{product} reached its goal · {metric} = {value}"
    → status changes to 'in_market'
    
  market_current_value changes (any):
    → update progress display in deadline card
    → if crosses > 80% of targetN: toast "you're close · {value}/{targetN} {metric}"
```

### 11.3 Notifications (Feishu, if connected)
```
Events that trigger Feishu notification:
  - openspec_changes completed → "build complete: {nodeVersion} · {result_url}"
  - deadline within 7 days → "⚠ deadline in {n} days · {marketValue}/{targetN}"
  - opus audit alert → "maestro detected drift in {productName}"
  - market_visible = true → "{productName} is in market"
  - force_closed → "{productName} was archived"
```

### 11.4 Unsaved Changes Warning
```
Any page with editable content (boundary items, settings):
  → track dirty state
  → on navigate away with unsaved changes:
      browser beforeunload → "you have unsaved changes · leave anyway?"
      in-app navigation (Next.js router) → custom modal:
        "you have unsaved changes in {section}"
        [discard changes] | [stay and save]
```

### 11.5 Keyboard Shortcuts
```
Global:
  Cmd/Ctrl + K → command palette (search ideas, jump to phase)
  Cmd/Ctrl + N → new idea (from /dashboard)
  Esc          → close any open panel/modal

Idea pipeline:
  Cmd/Ctrl + Enter → submit current form (dialogue round, scope confirm)
  Cmd/Ctrl + → / ← → navigate between phases (if unlocked)
```

---

## 12. Error States

### 12.1 Opus API Error
```
Any Opus call fails:
  → show error banner in the affected zone:
      "opus couldn't complete this request · {reason if available}"
      [retry] button → re-trigger same request
  → do NOT block the entire page
  → log to idea_events: event_type = 'opus_error', metadata: { error, phase }
```

### 12.2 GitHub API Error
```
Repo verification fails:
  → inline error below input: "couldn't verify · check the repo name and your access"
  → [try again] link

Commit fails (boundary export, contract export):
  → toast: "couldn't commit to github · {reason}"
  → retry button persists until success
  → idea progression is NOT blocked (UI marks export as "pending" with warning icon)
```

### 12.3 Network Offline
```
Network lost:
  → subtle banner at top: "you're offline · changes will sync when you reconnect"
  → disable all submit/trigger buttons
  → re-enable when navigator.onLine fires
```

### 12.4 Supabase Rate Limit
```
429 response:
  → toast: "too many requests · wait a moment"
  → implement exponential backoff: 1s, 2s, 4s, max 3 retries
  → after 3 retries: "still failing · please refresh"
```

---

## 13. Loading States

### 13.1 Opus Thinking States
Each Opus-triggered operation shows progress text, not a generic spinner:

```ts
const OPUS_LOADING_STATES: Record<string, string[]> = {
  'intent-form':      ['reading your idea...', 'identifying gaps...', 'generating questions...'],
  'boundary':         ['analyzing problem domain...', 'defining boundaries...', 'checking consistency...'],
  // [v0.1.1] split into two passes
  'validation-advocate':   ['searching for market evidence...', 'finding proof of the problem...', 'building the case for go...'],
  'validation-prosecutor': ['challenging your assumptions...', 'looking for fatal risks...', 'stress-testing the model...', 'forming the case against...'],
  'validation-synthesis':  ['reconciling both cases...', 'forming final verdict...'],
  'roadmap':          ['reading contract...', 'planning milestones...', 'generating openspecs...'],
  'audit':            ['reviewing evolution history...', 'reading arch decision logs...', 'comparing with original intent...', 'forming assessment...'],
  'postmortem':       ['reviewing decision history...', 'identifying turning points...', 'writing report...'],
  // [v0.1.1] new
  'scope-check':      ['checking scope alignment...', 'comparing with boundary definition...'],
  'arch-log':         ['reading completed changes...', 'extracting decisions...', 'writing architecture log...'],
}

// Cycle through messages every 2-3 seconds during loading
```

### 13.2 Skeleton States
```
Dashboard table: skeleton rows (same column widths as real data)
Phase pages: skeleton matching the real layout (left nav + right content shape)
Stats bar: skeleton blocks matching metric card proportions
```

### 13.3 Optimistic Updates
```
Apply optimistic updates for:
  - Scope item status change (confirm/edit)
  - Toggle preferences
  - Adding evolution node
  - Adding feedback signal

On error: revert to previous state + toast error
On success: replace optimistic data with server response
```

---

## 14. Empty States

```
Dashboard, no ideas:
  → centered: "no products yet"
  → [create your first idea ↗]
  → subtext: "build in public. ship on deadline. or close and learn."

Dashboard, all ideas closed:
  → centered: "all products archived"
  → [start something new ↗]
  → link to "view archived" filter

Evolution axis, no nodes:
  → auto-generated by Opus on contract sign (should never be empty)
  → if somehow empty: "no milestones yet · [+ add milestone]"

Feedback signals, empty:
  → "no feedback signals yet"
  → "add signals from user conversations, support tickets, or your own observations"
  → [+ add feedback]
```

---

## 15. Mobile Considerations

Maestro is a desktop-first application. Mobile is not v0.1 scope.

Minimum supported viewport: **1024px wide**.

At viewport < 1024px:
→ show: "maestro is designed for desktop · please open on a larger screen"
→ still allow login + dashboard (read-only, simplified layout)
→ do not attempt to render the phase pipeline on mobile
