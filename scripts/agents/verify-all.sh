#!/usr/bin/env bash
# scripts/agents/verify-all.sh
#
# Master verification script — runs ALL automated checks for the mvp-dashboard change.
#
# Covers:
#   6.2  Profile upsert verification (DB check)
#   6.3  Test idea data seeded and visible in DB
#   6.4  Filter/stats logic unit tests (Vitest)
#
# Exits 0 only if every check passes.
# Designed for AI Coding Agent use — no human interaction required.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/scripts/agents"
DESKTOP_DIR="$REPO_ROOT/apps/desktop"

PASS=0
FAIL=0

step() { echo; echo "════ $1 ════════════════════════════════════════════════"; }
ok()   { echo "✅  $1"; PASS=$((PASS + 1)); }
err()  { echo "❌  $1"; FAIL=$((FAIL + 1)); }

# ── TypeScript typecheck ──────────────────────────────────────────────────────
step "TypeScript"
if (cd "$DESKTOP_DIR" && pnpm tsc --noEmit --pretty false 2>&1); then
  ok "tsc --noEmit passed"
else
  err "TypeScript errors found"
fi

# ── Unit tests (6.4 filter/stats logic) ──────────────────────────────────────
step "Unit tests  (6.4 applyFilter / computeStats)"
if (cd "$DESKTOP_DIR" && pnpm test --reporter=verbose 2>&1); then
  ok "all unit tests passed"
else
  err "unit tests failed"
fi

# ── DB seed (6.2 + 6.3) ──────────────────────────────────────────────────────
step "DB seed  (6.3 test data injection)"
if bash "$AGENTS_DIR/seed-db.sh" 2>&1; then
  ok "seed-db completed"
else
  err "seed-db failed — is the app DB initialised? Run 'pnpm tauri dev' once first."
  # Don't abort; run check anyway so we get all failure info
fi

# ── DB assertions (6.2 + 6.3) ────────────────────────────────────────────────
step "DB assertions  (6.2 profile upsert / 6.3 ideas)"
if bash "$AGENTS_DIR/check-db.sh" 2>&1; then
  ok "all DB assertions passed"
else
  err "DB assertions failed"
fi

# ── Final report ──────────────────────────────────────────────────────────────
echo
echo "════ Result ════════════════════════════════════════════════════════════"
echo "   passed: $PASS  failed: $FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "✅  All checks passed — tasks 6.2 / 6.3 / 6.4 verified."
  exit 0
else
  echo "❌  $FAIL check(s) failed. See output above."
  exit 1
fi
