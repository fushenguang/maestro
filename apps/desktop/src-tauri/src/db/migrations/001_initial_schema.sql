-- =============================================================================
-- Maestro — Initial Schema
-- Adapted from maestro-data-spec.md (PostgreSQL) for SQLite.
--
-- SQLite adaptations:
--   uuid        → TEXT (generated in application layer via uuid crate)
--   timestamptz → TEXT (ISO 8601, datetime('now'))
--   boolean     → INTEGER (0/1)
--   text[]      → TEXT (JSON-serialised array e.g. '["a","b"]')
--   jsonb       → TEXT (JSON)
--   generated columns → computed in application layer
--   DB triggers for immutability → enforced in Rust command layer
--
-- Table creation order follows foreign-key dependency graph.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id                       TEXT    PRIMARY KEY,
  github_login             TEXT    NOT NULL UNIQUE,
  github_avatar            TEXT,
  display_name             TEXT,
  user_type                TEXT    NOT NULL DEFAULT 'technical'
                                   CHECK(user_type IN ('technical','domain_expert')),
  domain                   TEXT,

  -- computed metrics (updated by application layer on idea status change)
  total_ideas              INTEGER NOT NULL DEFAULT 0,
  ideas_in_market          INTEGER NOT NULL DEFAULT 0,
  ideas_closed             INTEGER NOT NULL DEFAULT 0,
  -- launch_rate is computed in application layer: round(ideas_in_market/total_ideas*100, 2)

  -- integration flags
  github_connected         INTEGER NOT NULL DEFAULT 1,
  supabase_connected       INTEGER NOT NULL DEFAULT 0,
  stripe_connected         INTEGER NOT NULL DEFAULT 0,
  feishu_connected         INTEGER NOT NULL DEFAULT 0,
  feishu_webhook_url       TEXT,

  -- preferences
  pref_opus_audit_notify   INTEGER NOT NULL DEFAULT 1,
  pref_deadline_indicator  INTEGER NOT NULL DEFAULT 1,
  pref_auto_export_context INTEGER NOT NULL DEFAULT 0,
  pref_feishu_notify       INTEGER NOT NULL DEFAULT 0,

  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- 2. ideas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ideas (
  id                       TEXT    PRIMARY KEY,
  user_id                  TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- identity
  name                     TEXT    NOT NULL,
  slug                     TEXT    UNIQUE,
  description              TEXT,
  tags                     TEXT    NOT NULL DEFAULT '[]',

  -- v0.1 seeds
  creator_mode             TEXT    NOT NULL DEFAULT 'technical'
                                   CHECK(creator_mode IN ('technical','domain_expert')),
  product_stage            TEXT    NOT NULL DEFAULT 'build'
                                   CHECK(product_stage IN ('build','launch','scale')),
  stage_entered_at         TEXT,

  -- phase state machine
  current_phase            INTEGER NOT NULL DEFAULT 0
                                   CHECK(current_phase BETWEEN 0 AND 6),
  status                   TEXT    NOT NULL DEFAULT 'draft'
                                   CHECK(status IN (
                                     'draft','active','at_risk','in_market',
                                     'force_closed','closed_no_go'
                                   )),

  -- phase 0: feed
  feed_source_type         TEXT    CHECK(feed_source_type IN ('text','url','github','file')),
  feed_source_url          TEXT,
  feed_raw_content         TEXT,
  feed_completed_at        TEXT,

  -- phase 1: intent dialogue
  intent_clarity           INTEGER NOT NULL DEFAULT 0
                                   CHECK(intent_clarity BETWEEN 0 AND 100),
  intent_rounds            INTEGER NOT NULL DEFAULT 0,
  open_questions_count     INTEGER NOT NULL DEFAULT 0,
  intent_completed_at      TEXT,

  -- phase 2: boundary definition
  problem_statement        TEXT,
  boundary_locked_at       TEXT,
  boundary_export_sha      TEXT,

  -- phase 3: validation gate
  validation_verdict       TEXT    CHECK(validation_verdict IN ('go','no_go','pending')),
  validation_completed_at  TEXT,

  -- phase 4: product contract (all IMMUTABLE after contract_signed_at is set)
  contract_signed_at       TEXT,
  contract_id              TEXT    UNIQUE,
  product_type             TEXT    CHECK(product_type IN ('paid','opensource','internal')),
  deadline                 TEXT,
  success_metric           TEXT    CHECK(success_metric IN (
                                     'paid_users','github_stars',
                                     'weekly_downloads','url_reachable'
                                   )),
  target_n                 INTEGER,
  deadline_extensions_used INTEGER NOT NULL DEFAULT 0
                                   CHECK(deadline_extensions_used <= 1),
  extension_post_url       TEXT,

  -- phase 5: evolution
  current_version          TEXT    NOT NULL DEFAULT 'draft',
  github_repo              TEXT,
  github_repo_node_id      TEXT,

  -- market signal
  market_current_value     INTEGER NOT NULL DEFAULT 0,
  market_last_checked_at   TEXT,
  market_visible           INTEGER NOT NULL DEFAULT 0,

  -- post-mortem
  postmortem_report        TEXT,
  postmortem_at            TEXT,
  cooling_ends_at          TEXT,

  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ideas_user_id_idx ON ideas(user_id);
CREATE INDEX IF NOT EXISTS ideas_status_idx  ON ideas(status);
CREATE INDEX IF NOT EXISTS ideas_slug_idx    ON ideas(slug);
CREATE INDEX IF NOT EXISTS ideas_deadline_idx
  ON ideas(deadline) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 3. dialogue_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dialogue_messages (
  id          TEXT    PRIMARY KEY,
  idea_id     TEXT    NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  role        TEXT    NOT NULL CHECK(role IN ('opus','user')),
  content     TEXT    NOT NULL,
  round       INTEGER NOT NULL,
  tokens_used INTEGER,
  model_used  TEXT    DEFAULT 'claude-opus-4',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS dialogue_idea_round_idx
  ON dialogue_messages(idea_id, round);

-- ---------------------------------------------------------------------------
-- 4. intent_canvas  (1:1 per idea)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intent_canvas (
  id                       TEXT    PRIMARY KEY,
  idea_id                  TEXT    NOT NULL UNIQUE REFERENCES ideas(id) ON DELETE CASCADE,
  problem                  TEXT,
  root_cause               TEXT,
  mechanism                TEXT,
  target_user              TEXT,
  success_metric_desc      TEXT,
  boundary_hint            TEXT,
  problem_confidence       INTEGER DEFAULT 0,
  root_cause_confidence    INTEGER DEFAULT 0,
  mechanism_confidence     INTEGER DEFAULT 0,
  target_user_confidence   INTEGER DEFAULT 0,
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- 5. assumption_items  (phases 1-2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assumption_items (
  id              TEXT    PRIMARY KEY,
  idea_id         TEXT    NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  type            TEXT    NOT NULL CHECK(type IN ('confirmed','negated','open')),
  content         TEXT    NOT NULL,
  phase           INTEGER NOT NULL CHECK(phase IN (1, 2)),
  negation_reason TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- 6. scope_items  (phase 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scope_items (
  id          TEXT    PRIMARY KEY,
  idea_id     TEXT    NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL
                      CHECK(type IN ('in_scope','out_of_scope','open_question')),
  title       TEXT    NOT NULL,
  description TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('confirmed','needs_confirm','pending')),
  tags        TEXT    NOT NULL DEFAULT '[]',
  source      TEXT    NOT NULL DEFAULT 'opus'
                      CHECK(source IN ('opus','user')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS scope_items_idea_idx ON scope_items(idea_id, type);

-- ---------------------------------------------------------------------------
-- 7. validation_reports  (1:1 per idea)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS validation_reports (
  id                      TEXT    PRIMARY KEY,
  idea_id                 TEXT    NOT NULL UNIQUE REFERENCES ideas(id) ON DELETE CASCADE,
  verdict                 TEXT    CHECK(verdict IN ('go','no_go','pending')),
  verdict_summary         TEXT,
  market_size_signal      TEXT,
  competing_products      INTEGER,
  paying_customers_found  INTEGER DEFAULT 0,
  advocate_go_reasons     TEXT    DEFAULT '[]',
  advocate_evidence       TEXT    DEFAULT '[]',
  advocate_completed_at   TEXT,
  prosecutor_risks        TEXT    DEFAULT '[]',
  prosecutor_evidence     TEXT    DEFAULT '[]',
  prosecutor_completed_at TEXT,
  synthesis_notes         TEXT,
  evidence_gaps           TEXT    DEFAULT '[]',
  model_used              TEXT    DEFAULT 'claude-opus-4',
  generated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- 8. evidence_items  (phase 3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence_items (
  id          TEXT    PRIMARY KEY,
  idea_id     TEXT    NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  pass_type   TEXT    NOT NULL DEFAULT 'advocate'
                      CHECK(pass_type IN ('advocate','prosecutor')),
  badge       TEXT    NOT NULL
                      CHECK(badge IN (
                        'proves_problem','adjacent_signal','adoption_risk',
                        'evidence_gap','fatal_risk'
                      )),
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL,
  source_url  TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- 9. contracts  (1:1 per idea, immutable after signed_at)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
  id                      TEXT    PRIMARY KEY,
  idea_id                 TEXT    NOT NULL UNIQUE REFERENCES ideas(id) ON DELETE CASCADE,
  contract_ref            TEXT    NOT NULL UNIQUE,
  product_type            TEXT    NOT NULL,
  deadline                TEXT    NOT NULL,
  success_metric          TEXT    NOT NULL,
  target_n                INTEGER NOT NULL,
  github_repo             TEXT    NOT NULL,
  signed_by_user_id       TEXT    REFERENCES profiles(id),
  signed_at               TEXT,
  extension_requested_at  TEXT,
  extension_post_url      TEXT,
  extension_new_deadline  TEXT,
  extension_approved_at   TEXT,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- 10. feedback_signals  (phase 5, ongoing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_signals (
  id                         TEXT    PRIMARY KEY,
  idea_id                    TEXT    NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  source                     TEXT    NOT NULL
                                     CHECK(source IN ('user','internal','market','support')),
  content                    TEXT    NOT NULL,
  raw_quote                  TEXT,
  challenges_assumption_id   TEXT    REFERENCES assumption_items(id),
  supports_assumption_id     TEXT    REFERENCES assumption_items(id),
  suggested_action           TEXT    CHECK(suggested_action IN (
                                       'add_feature','remove_feature','pivot','validate','ignore'
                                     )),
  impact_score               INTEGER CHECK(impact_score BETWEEN 1 AND 10),
  classified_at              TEXT,
  status                     TEXT    NOT NULL DEFAULT 'new'
                                     CHECK(status IN ('new','classified','actioned','dismissed')),
  created_at                 TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS feedback_idea_status_idx
  ON feedback_signals(idea_id, status);

-- ---------------------------------------------------------------------------
-- 11. evolution_nodes  (phase 5 timeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evolution_nodes (
  id                            TEXT    PRIMARY KEY,
  idea_id                       TEXT    NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  version                       TEXT    NOT NULL,
  name                          TEXT    NOT NULL,
  description                   TEXT,
  status                        TEXT    NOT NULL DEFAULT 'planned'
                                        CHECK(status IN ('done','current','planned','archived')),
  node_date                     TEXT,
  shipped_at                    TEXT,
  openspec_count                INTEGER NOT NULL DEFAULT 0,
  feedback_signal_count         INTEGER NOT NULL DEFAULT 0,
  triggered_by_feedback         TEXT    REFERENCES feedback_signals(id),
  scope_check_status            TEXT    DEFAULT 'pending'
                                        CHECK(scope_check_status IN (
                                          'pending','clean','warning','dismissed'
                                        )),
  scope_check_run_at            TEXT,
  scope_out_of_bounds           TEXT    DEFAULT '[]',
  scope_warning_dismissed_at    TEXT,
  scope_warning_dismiss_reason  TEXT,
  sort_order                    INTEGER NOT NULL DEFAULT 0,
  created_at                    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Only one node per idea may have status = 'current'.
CREATE UNIQUE INDEX IF NOT EXISTS one_current_node_per_idea
  ON evolution_nodes(idea_id) WHERE status = 'current';

-- ---------------------------------------------------------------------------
-- 12. openspec_changes  (phase 5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS openspec_changes (
  id            TEXT    PRIMARY KEY,
  idea_id       TEXT    NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  node_id       TEXT    NOT NULL REFERENCES evolution_nodes(id),
  title         TEXT    NOT NULL,
  description   TEXT,
  spec_json     TEXT    NOT NULL DEFAULT '{}',
  status        TEXT    NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','queued','running','done','failed')),
  triggered_at  TEXT,
  completed_at  TEXT,
  result_url    TEXT,
  error_message TEXT,
  executed_by   TEXT    DEFAULT 'claude-sonnet-4-6',
  reviewed_by   TEXT    DEFAULT 'codex',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- 13. arch_decision_logs  (v0.1.1 — written back after each openspec execution)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS arch_decision_logs (
  id                       TEXT    PRIMARY KEY,
  openspec_id              TEXT    NOT NULL UNIQUE REFERENCES openspec_changes(id) ON DELETE CASCADE,
  idea_id                  TEXT    NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  node_id                  TEXT    NOT NULL REFERENCES evolution_nodes(id),
  decisions                TEXT    NOT NULL DEFAULT '[]',
  deps_added               TEXT    NOT NULL DEFAULT '[]',
  deps_removed             TEXT    NOT NULL DEFAULT '[]',
  files_changed            TEXT    NOT NULL DEFAULT '[]',
  agent_notes              TEXT,
  exported_to_context_at   TEXT,
  context_commit_sha       TEXT,
  model_used               TEXT    NOT NULL DEFAULT 'claude-sonnet-4-6',
  written_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS arch_logs_idea_idx
  ON arch_decision_logs(idea_id, written_at DESC);

-- ---------------------------------------------------------------------------
-- 14. idea_events  (immutable audit log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idea_events (
  id          TEXT    PRIMARY KEY,
  idea_id     TEXT    NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id     TEXT    REFERENCES profiles(id),
  event_type  TEXT    NOT NULL,
  from_value  TEXT,
  to_value    TEXT,
  metadata    TEXT    DEFAULT '{}',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idea_events_idea_idx
  ON idea_events(idea_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 15. sync_queue  (local-first sync worker)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_queue (
  id          TEXT    PRIMARY KEY,
  table_name  TEXT    NOT NULL,
  row_id      TEXT    NOT NULL,
  operation   TEXT    NOT NULL CHECK(operation IN ('upsert','delete')),
  payload     TEXT    NOT NULL DEFAULT '{}',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT
);
