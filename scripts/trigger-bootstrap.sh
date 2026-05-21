#!/usr/bin/env bash
# trigger-bootstrap.sh
# 执行 bootstrap-tauri-shell change 的完整触发流程：
#   1. 提交并推送 openspec/ 到 GitHub
#   2. 打印服务器 clone 命令（需在 Dokploy Terminal 手动执行）
#   3. POST /runs 触发 coding-runner 实现
#
# 用法：bash scripts/trigger-bootstrap.sh
# 前置：
#   - 已在 /home/cogito/calcifer-projects/maestro clone 好仓库（或用步骤2的命令做）
#   - coding-runner 已部署 Rust toolchain（cargo --version 可用）

set -euo pipefail

CODING_RUNNER_URL="${CODING_RUNNER_URL:-http://192.168.31.50:6650}"
KICKOFF_KIT_URL="${KICKOFF_KIT_URL:-http://192.168.31.50:3004}"
KICKOFF_API_TOKEN="${KICKOFF_API_TOKEN:-}"
PROJECT_UUID="019e4887-7b25-74ff-a837-bf63d147aa9f"
WORKDIR="/home/cogito/calcifer-projects/maestro"
BRANCH="feat/bootstrap-tauri-shell"

# ── Step 1: 提交并推送 openspec ─────────────────────────────────────────────
echo "==> Step 1: commit + push openspec/"
cd "$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"

if git diff --quiet HEAD -- openspec/ 2>/dev/null && git ls-files --others --exclude-standard openspec/ | grep -q .; then
  git add openspec/
  git commit -m "chore(openspec): add bootstrap-tauri-shell change + openspec scaffold

- openspec/config.yaml: project context (Tauri v2, codex SDK, MiniMax-first)
- openspec/AGENTS.md: workflow constraints for AI agents
- openspec/changes/bootstrap-tauri-shell/: proposal/design/tasks/spec
  - 41 tasks, AC1-AC9 machine-executable
  - Requires: Rust toolchain in coding-runner (add-rust-toolchain-to-coding-runner)"
  git push origin main
  echo "    openspec committed and pushed."
elif git ls-files --others --exclude-standard openspec/ | grep -q .; then
  git add openspec/
  git commit -m "chore(openspec): add bootstrap-tauri-shell change + openspec scaffold

- openspec/config.yaml: project context (Tauri v2, codex SDK, MiniMax-first)
- openspec/AGENTS.md: workflow constraints for AI agents
- openspec/changes/bootstrap-tauri-shell/: proposal/design/tasks/spec
  - 41 tasks, AC1-AC9 machine-executable
  - Requires: Rust toolchain in coding-runner (add-rust-toolchain-to-coding-runner)"
  git push origin main
  echo "    openspec committed and pushed."
else
  echo "    openspec already committed, skipping."
fi

# ── Step 2: Clone maestro onto coding-runner host via kickoff-kit API ────────
echo "==> Step 2: clone/pull maestro on server via kickoff-kit POST /workdir/clone"

CLONE_HEADERS=(-H 'Content-Type: application/json')
if [[ -n "$KICKOFF_API_TOKEN" ]]; then
  CLONE_HEADERS+=(-H "Authorization: Bearer $KICKOFF_API_TOKEN")
fi

CLONE_RESP=$(curl -s -X POST "$KICKOFF_KIT_URL/workdir/clone" \
  "${CLONE_HEADERS[@]}" \
  -d '{"repo_url": "https://github.com/fushenguang/maestro.git", "project_id": "maestro"}')

CLONE_ACTION=$(echo "$CLONE_RESP" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("action","ERROR"))' 2>/dev/null)
if [[ "$CLONE_ACTION" == "cloned" ]] || [[ "$CLONE_ACTION" == "pulled" ]]; then
  echo "    workdir ready ($CLONE_ACTION): $(echo "$CLONE_RESP" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("workdir","?"))')"
else
  echo "ERROR: kickoff-kit clone failed. Response: $CLONE_RESP"
  echo "  Check: is kickoff-kit deployed at $KICKOFF_KIT_URL? Is KICKOFF_API_TOKEN set?"
  exit 1
fi

# ── Step 3: POST /runs ────────────────────────────────────────────────────────
echo ""
echo "==> Step 3: 触发 coding-runner POST /runs"

PROMPT="Implement the \`bootstrap-tauri-shell\` OpenSpec change for the maestro project.

IMPORTANT: Read \`openspec/changes/bootstrap-tauri-shell/tasks.md\` first — it contains the full task list and acceptance criteria.

Summary of what to build (implement sections 1–6 from tasks.md in order):

1. ROOT TOOLING
   - package.json: name=\"maestro\", private:true, packageManager pnpm@9, engines.node >=20 <25, turbo scripts (dev/build/typecheck/lint)
   - pnpm-workspace.yaml: packages [\"apps/*\", \"packages/*\"]
   - turbo.json: tasks build/dev/typecheck/lint; typecheck.dependsOn=[\"^typecheck\"]
   - tsconfig.base.json: strict:true, target:ES2022, moduleResolution:bundler
   - .gitignore: extend with node_modules/, dist/, target/, .env*, .turbo/, .DS_Store
   - .editorconfig: 2-space indent, LF, UTF-8
   - AGENTS.md (repo root): link to docs/references/AGENTS.md, openspec/AGENTS.md, docs/architecture/vision.md

2. ARCHITECTURE VISION CHARTER
   - docs/architecture/vision.md with frontmatter: version:1, last_reviewed:2026-05-21, normative:true
   - Must contain: \"AppServer Protocol\", \"codex SDK\", \"MiniMax\", \"pluggable\"
   - Reference docs/references/SPEC.md as upstream contract

3. apps/desktop SCAFFOLD
   - apps/desktop/package.json: name=\"@maestro/desktop\", react@^19, react-dom@^19, @tanstack/react-router@^1, zustand@^4, @tauri-apps/api@^2.11.0; devDeps: @tauri-apps/cli@2.11.0 (PINNED, no ^), vite@^5, @vitejs/plugin-react@^4, typescript@^5.5
   - apps/desktop/tsconfig.json: extends ../../tsconfig.base.json, paths @/*: [./src/*]
   - apps/desktop/vite.config.ts: React plugin, server.port:1420
   - apps/desktop/index.html: basic HTML, <div id=\"root\">
   - apps/desktop/src/main.tsx: React 19 createRoot + RouterProvider
   - apps/desktop/src/router.tsx: TanStack Router createRouter with routeTree
   - apps/desktop/src/routes/__root.tsx: createRootRoute with Outlet
   - apps/desktop/src/routes/index.tsx: createFileRoute('/') with component showing \"Maestro Desktop — Bootstrap\"
   - apps/desktop/src/App.tsx: import Button from @/components/ui/button (for AC9)

4. SHADCN/UI + TAILWIND (in apps/desktop)
   - Install: tailwindcss postcss autoprefixer tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react
   - tailwind.config.ts, postcss.config.cjs, src/index.css (@tailwind base/components/utilities)
   - components.json: style default, aliases @/components
   - Create src/components/ui/button.tsx (shadcn button component)
   - Create src/lib/utils.ts (cn helper)
   - Import and render <Button> in routes/index.tsx and/or App.tsx

5. TAURI v2 BACKEND (apps/desktop/src-tauri)
   - Cargo.toml: tauri=\"2.11.0\" (exact, no ^), tauri-build=\"2.11.0\", serde, serde_json
   - build.rs: tauri_build::build()
   - src/main.rs: #![cfg_attr(not(debug_assertions), windows_subsystem = \"windows\")] fn main() { lib::run() }
   - src/lib.rs: pub fn run() { tauri::Builder::default().run(...) }
   - tauri.conf.json: identifier=\"com.fushenguang.maestro\", productName=\"Maestro\", version=\"0.1.0\", build.beforeDevCommand=\"pnpm dev\", build.devUrl=\"http://localhost:1420\", single window 1024x768 title \"Maestro\"
   - capabilities/default.json: core:default only

After implementing all sections, verify these commands all exit 0:
  pnpm install --frozen-lockfile=false
  pnpm typecheck
  cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml

Then create branch feat/bootstrap-tauri-shell, commit everything, push, and open a GitHub PR targeting main."

RESPONSE=$(curl -s -X POST "$CODING_RUNNER_URL/runs" \
  -H 'Content-Type: application/json' \
  -d "{
    \"projectUuid\": \"$PROJECT_UUID\",
    \"workdir\": \"$WORKDIR\",
    \"prompt\": $(echo "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  }")

echo "Response: $RESPONSE"
RUN_ID=$(echo "$RESPONSE" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("runId","ERROR"))' 2>/dev/null)

if [[ "$RUN_ID" == "ERROR" ]] || [[ -z "$RUN_ID" ]]; then
  echo "ERROR: Failed to start run. Response: $RESPONSE"
  exit 1
fi

echo ""
echo "==> Run started: $RUN_ID"
echo ""
echo "监控进度："
echo "  watch -n 15 \"curl -s $CODING_RUNNER_URL/runs/$RUN_ID | python3 -m json.tool | grep -E '\\\"status\\\"|\\\"exit_code\\\"|\\\"summary\\\"'\""
echo ""
echo "完成后 coding-runner 会在 maestro 仓开 PR，self-incubation-loop 接管 review/AC/merge。"
