#!/usr/bin/env bash
# scripts/agents/seed-db.sh
#
# Inserts a test profile + 6 test ideas (one per IdeaStatus) into the local
# Tauri SQLite DB. Fully idempotent — safe to re-run.
#
# Exits 0 on success, 1 on error. All output is machine-parseable.
# Designed for AI Coding Agent use — no human interaction required.

set -euo pipefail

DB="$HOME/Library/Application Support/com.fushenguang.maestro/maestro.db"
PROFILE_ID="agent-test-profile-001"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CREATED=$(date -u -v-60d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -d '-60 days' +"%Y-%m-%dT%H:%M:%SZ")
DEADLINE_SOON=$(date -u -v+20d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -d '+20 days' +"%Y-%m-%dT%H:%M:%SZ")
DEADLINE_FAR=$(date -u -v+90d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -d '+90 days' +"%Y-%m-%dT%H:%M:%SZ")

# ── Verify DB exists ──────────────────────────────────────────────────────────
if [[ ! -f "$DB" ]]; then
  echo "❌  DB not found: $DB"
  echo "    Run 'pnpm tauri dev' at least once to initialise the database."
  exit 1
fi

q() { sqlite3 "$DB" "$@"; }

# ── Upsert test profile (satisfies foreign key for ideas) ────────────────────
q "INSERT OR REPLACE INTO profiles
   (id, github_login, display_name, github_avatar, user_type, created_at, updated_at)
   VALUES
   ('$PROFILE_ID', 'agent-test', 'Agent Test User', NULL, 'technical', '$CREATED', '$NOW');"

echo "✅  profile upserted: $PROFILE_ID"

# ── Remove stale test ideas ───────────────────────────────────────────────────
q "DELETE FROM ideas WHERE id LIKE 'agent-test-%';"

# ── Insert one idea per status ────────────────────────────────────────────────
q "INSERT INTO ideas
   (id, user_id, name, description, tags, status, current_version, created_at, updated_at)
   VALUES
   ('agent-test-1', '$PROFILE_ID', '[TEST] Draft Idea',       'Draft status',       '[]',              'draft',        'v0.1', '$CREATED', '$NOW'),
   ('agent-test-2', '$PROFILE_ID', '[TEST] Active Idea',      'Active near deadline','[\"devtools\"]',  'active',       'v0.3', '$CREATED', '$NOW'),
   ('agent-test-3', '$PROFILE_ID', '[TEST] At Risk Idea',     'At risk with deadline','[\"mobile\"]',  'at_risk',      'v1.0', '$CREATED', '$NOW'),
   ('agent-test-4', '$PROFILE_ID', '[TEST] In Market Idea',   'In market with signal','[]',            'in_market',    'v2.1', '$CREATED', '$NOW'),
   ('agent-test-5', '$PROFILE_ID', '[TEST] Force Closed Idea','Force closed',        '[]',             'force_closed', 'v0.2', '$CREATED', '$NOW'),
   ('agent-test-6', '$PROFILE_ID', '[TEST] Closed No Go Idea','Closed no go',        '[]',             'closed_no_go', 'v0.1', '$CREATED', '$NOW');"

# Set deadlines for active/at_risk (both within 20 days → counted in deadlineSoon)
q "UPDATE ideas SET deadline = '$DEADLINE_SOON' WHERE id IN ('agent-test-2', 'agent-test-3');"

# Set market signal for in_market idea
q "UPDATE ideas SET
     market_visible = 1,
     success_metric = 'paid_users',
     target_n = 10,
     market_current_value = 3
   WHERE id = 'agent-test-4';"

echo "✅  inserted 6 test ideas (draft / active / at_risk / in_market / force_closed / closed_no_go)"
echo "    deadlines set for agent-test-2 (active) and agent-test-3 (at_risk): $DEADLINE_SOON"
echo "    market signal set for agent-test-4 (in_market): paid > 10, currently 3"
