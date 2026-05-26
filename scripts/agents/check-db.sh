#!/usr/bin/env bash
# scripts/agents/check-db.sh
#
# Verifies the local Tauri SQLite DB state after seeding.
# Checks: profile upsert (task 6.2) + idea counts per status (task 6.3).
# Exits 0 if all assertions pass, 1 on any failure.
#
# Designed for AI Coding Agent use — no human interaction required.

set -euo pipefail

DB="$HOME/Library/Application Support/com.fushenguang.maestro/maestro.db"
PROFILE_ID="agent-test-profile-001"
PASS=0
FAIL=0

q() { sqlite3 "$DB" "$@"; }

fail() { echo "❌  $1"; FAIL=$((FAIL + 1)); }
pass() { echo "✅  $1"; PASS=$((PASS + 1)); }

# ── DB must exist ─────────────────────────────────────────────────────────────
if [[ ! -f "$DB" ]]; then
  echo "❌  DB not found: $DB — run seed-db.sh first"
  exit 1
fi

echo "── 6.2  Profile upsert ──────────────────────────────────────────────────"

PROFILE_COUNT=$(q "SELECT COUNT(*) FROM profiles WHERE id = '$PROFILE_ID';")
if [[ "$PROFILE_COUNT" -ge 1 ]]; then
  pass "profile '$PROFILE_ID' exists (count=$PROFILE_COUNT)"
else
  fail "profile not found — run seed-db.sh"
fi

echo
echo "── 6.3  Test ideas table ────────────────────────────────────────────────"

check_status() {
  local status="$1" expected="$2"
  local count
  count=$(q "SELECT COUNT(*) FROM ideas WHERE user_id = '$PROFILE_ID' AND status = '$status';")
  if [[ "$count" -eq "$expected" ]]; then
    pass "status='$status' count=$count"
  else
    fail "status='$status' expected=$expected got=$count"
  fi
}

check_status draft         1
check_status active        1
check_status at_risk       1
check_status in_market     1
check_status force_closed  1
check_status closed_no_go  1

# Verify deadlines
DEADLINE_COUNT=$(q "SELECT COUNT(*) FROM ideas WHERE user_id = '$PROFILE_ID' AND status IN ('active','at_risk') AND deadline IS NOT NULL;")
if [[ "$DEADLINE_COUNT" -eq 2 ]]; then
  pass "deadlines set on 2 active/at_risk ideas"
else
  fail "expected 2 deadlines on active/at_risk, got $DEADLINE_COUNT"
fi

# Verify market signal
MARKET_OK=$(q "SELECT COUNT(*) FROM ideas WHERE id = 'agent-test-4' AND market_visible = 1 AND success_metric = 'paid_users' AND target_n = 10 AND market_current_value = 3;")
if [[ "$MARKET_OK" -eq 1 ]]; then
  pass "market signal correct on in_market idea (paid > 10, currently 3)"
else
  fail "market signal incorrect on agent-test-4"
fi

echo
echo "── Summary ──────────────────────────────────────────────────────────────"
echo "   passed: $PASS  failed: $FAIL"

[[ "$FAIL" -eq 0 ]] || exit 1
