#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function fail(message) {
  console.error(`\n[FAIL] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function read(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) fail(`Missing file: ${relPath}`);
  return fs.readFileSync(abs, 'utf8');
}

function expectContains(filePath, needle, description) {
  const content = read(filePath);
  if (!content.includes(needle)) {
    fail(`${description}\n  File: ${filePath}\n  Expected to include: ${needle}`);
  }
  ok(description);
}

function expectFile(filePath, description) {
  const abs = path.join(repoRoot, filePath);
  if (!fs.existsSync(abs)) {
    fail(`${description}\n  Missing: ${filePath}`);
  }
  ok(description);
}

console.log('== Functional E2E static checks ==');

// 1) Route files exist
expectFile('apps/desktop/src/routes/_app/ideas/$id/contract.tsx', 'Contract route file exists');
expectFile('apps/desktop/src/routes/_app/ideas/$id/evolution.tsx', 'Evolution route file exists');

// 2) Router registration
expectContains(
  'apps/desktop/src/router.tsx',
  'import { Route as ContractRoute } from "./routes/_app/ideas/$id/contract";',
  'Contract route imported in router'
);
expectContains(
  'apps/desktop/src/router.tsx',
  'import { Route as EvolutionRoute } from "./routes/_app/ideas/$id/evolution";',
  'Evolution route imported in router'
);
expectContains(
  'apps/desktop/src/router.tsx',
  'IdeasRoute.addChildren([FeedRoute, IntentRoute, BoundaryRoute, ValidationRoute, ContractRoute, EvolutionRoute])',
  'Contract/Evolution routes are registered under ideas layout'
);

// 3) Phase sidebar navigation
expectContains(
  'apps/desktop/src/components/PhaseSidebar.tsx',
  "4: '/ideas/$id/contract'",
  'PhaseSidebar has Contract route'
);
expectContains(
  'apps/desktop/src/components/PhaseSidebar.tsx',
  "5: '/ideas/$id/evolution'",
  'PhaseSidebar has Evolution route'
);

// 4) Validation -> Contract flow
expectContains(
  'apps/desktop/src/routes/_app/ideas/$id/validation.tsx',
  "await navigate({ to: '/ideas/$id/contract', params: { id } });",
  'Validation GO navigates to Contract phase'
);

// 5) Tauri command modules and registrations
expectFile('apps/desktop/src-tauri/src/commands/market_signals.rs', 'market_signals command module exists');
expectContains(
  'apps/desktop/src-tauri/src/commands/mod.rs',
  'pub mod market_signals;',
  'market_signals module exported from commands/mod.rs'
);
expectContains(
  'apps/desktop/src-tauri/src/lib.rs',
  'commands::market_signals::verify_github_repo,',
  'verify_github_repo invoke handler registered'
);
expectContains(
  'apps/desktop/src-tauri/src/lib.rs',
  'commands::market_signals::refresh_market_signal,',
  'refresh_market_signal invoke handler registered'
);
expectContains(
  'apps/desktop/src-tauri/src/lib.rs',
  'commands::market_signals::refresh_due_ideas_status,',
  'refresh_due_ideas_status invoke handler registered'
);

// 6) db wrappers
expectContains(
  'apps/desktop/src/lib/db.ts',
  'market: {',
  'db.ts exposes market wrapper group'
);
expectContains(
  'apps/desktop/src/lib/db.ts',
  "invoke<RepoVerifyResult>('verify_github_repo', { repo })",
  'db.market.verifyRepo wrapper exists'
);

// 7) Validation guardrail remains strict (user requirement: do not relax mechanism)
expectContains(
  'apps/desktop/src/routes/_app/ideas/$id/validation.tsx',
  "if (hasFatal) return 'no_go';",
  'Validation still has fatal-risk hard reject rule'
);
expectContains(
  'apps/desktop/src/lib/llm-prompts.ts',
  'Your job is "no-go" unless the evidence is overwhelmingly weak.',
  'Prosecutor prompt remains conservative'
);

console.log('\nAll static functional checks passed.');
