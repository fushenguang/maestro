#!/usr/bin/env bash
# scripts/db-verify.sh — Verify dashboard DB tasks (6.2 and 6.3)
#
# Usage:
#   ./scripts/db-verify.sh check      # 6.2: check if profiles table has records
#   ./scripts/db-verify.sh seed       # 6.3: insert test ideas, then re-run the app to verify
#   ./scripts/db-verify.sh clean      # remove seeded test data
#
# Prerequisites: sqlite3 CLI (pre-installed on macOS)

set -euo pipefail

# ── DB path (Tauri app_data_dir on macOS) ─────────────────────────────────────
DB="$HOME/Library/Application Support/com.fushenguang.maestro/maestro.db"

if [[ ! -f "$DB" ]]; then
  echo "❌  DB not found at: $DB"
  echo "    Make sure you've run the app at least once (pnpm tauri dev)."
  exit 1
fi

CMD="${1:-check}"

# ── Helpers ───────────────────────────────────────────────────────────────────
q() { sqlite3 "$DB" "$@"; }
section() { echo; echo "── $1 ──────────────────────────────────────────"; }

# ── 6.2: Check profile upsert ─────────────────────────────────────────────────
check_profiles() {
  section "6.2 Profile upsert verification"
  COUNT=$(q "SELECT COUNT(*) FROM profiles;")
  if [[ "$COUNT" -eq 0 ]]; then
    echo "❌  profiles table is empty — upsert did not run or login hasn't happened yet."
    exit 1
  fi

  echo "✅  Found $COUNT profile(s):"
  q -column -header "SELECT id, github_login, display_name, created_at FROM profiles LIMIT 5;"
}

# ── 6.3: Seed test ideas ──────────────────────────────────────────────────────
seed_ideas() {
  section "6.3 Seeding test ideas"

  # Require at least one profile to exist (foreign key)
  PROFILE_ID=$(q "SELECT id FROM profiles LIMIT 1;")
  if [[ -z "$PROFILE_ID" ]]; then
    echo "❌  No profile found. Log in first, then re-run: ./scripts/db-verify.sh seed"
    exit 1
  fi

  echo "Using profile: $PROFILE_ID"

  # Delete old seed data if any
  q "DELETE FROM ideas WHERE name LIKE '[TEST]%';"

  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  CREATED=$(date -u -v-60d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '-60 days' +"%Y-%m-%dT%H:%M:%SZ")
  DEADLINE_SOON=$(date -u -v+20d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '+20 days' +"%Y-%m-%dT%H:%M:%SZ")
  DEADLINE_FAR=$(date -u -v+90d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '+90 days' +"%Y-%m-%dT%H:%M:%SZ")

  q "INSERT OR IGNORE INTO ideas
     (id, user_id, name, description, tags, status, current_version, created_at, updated_at)
     VALUES
       ('test-1', '$PROFILE_ID', '[TEST] Alpha SaaS', 'A test draft idea', '[]', 'draft', 'v0.1', '$CREATED', '$NOW'),
       ('test-2', '$PROFILE_ID', '[TEST] Beta Tool', 'Active with near deadline', '[\"devtools\"]', 'active', 'v0.3', '$CREATED', '$NOW'),
       ('test-3', '$PROFILE_ID', '[TEST] Gamma App', 'At risk, deadline soon', '[\"mobile\",\"b2c\"]', 'at_risk', 'v1.0', '$CREATED', '$NOW'),
       ('test-4', '$PROFILE_ID', '[TEST] Delta SDK', 'In market', '[]', 'in_market', 'v2.1', '$CREATED', '$NOW'),
       ('test-5', '$PROFILE_ID', '[TEST] Epsilon CLI', 'Force closed', '[]', 'force_closed', 'v0.2', '$CREATED', '$NOW'),
       ('test-6', '$PROFILE_ID', '[TEST] Zeta API', 'Closed no go', '[]', 'closed_no_go', 'v0.1', '$CREATED', '$NOW');"

  # Set deadlines for active/at_risk ideas
  q "UPDATE ideas SET deadline = '$DEADLINE_SOON' WHERE id IN ('test-2', 'test-3');"
  # Set market signal for in_market idea
  q "UPDATE ideas SET market_visible = 1, success_metric = 'paid_users', target_n = 10, market_current_value = 3 WHERE id = 'test-4';"

  echo "✅  Inserted 6 test ideas (one of each status):"
  q -column -header "SELECT name, status, deadline FROM ideas WHERE name LIKE '[TEST]%';"
  echo
  echo "➡️   Now open the app (pnpm tauri dev) and verify:"
  echo "     • Dashboard table shows 6 rows"
  echo "     • Stats: total=6+, live=1, deadline<30d=2, force_closed=1"
  echo "     • Filter 'active' → 1 row (Beta Tool)"
  echo "     • Filter 'at risk' → 1 row (Gamma App)"
  echo "     • Filter 'closed' → 2 rows (Epsilon CLI + Zeta API)"
  echo "     • [TEST] Delta SDK shows market signal: target: paid > 10 / currently: 3"
}

# ── Clean test data ───────────────────────────────────────────────────────────
clean_ideas() {
  section "Cleaning test data"
  DELETED=$(q "SELECT COUNT(*) FROM ideas WHERE name LIKE '[TEST]%';")
  q "DELETE FROM ideas WHERE name LIKE '[TEST]%';"
  echo "✅  Removed $DELETED test idea(s)."
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "$CMD" in
  check)  check_profiles ;;
  seed)   check_profiles; seed_ideas ;;
  clean)  clean_ideas ;;
  *)
    echo "Usage: $0 [check|seed|clean]"
    exit 1
    ;;
esac
