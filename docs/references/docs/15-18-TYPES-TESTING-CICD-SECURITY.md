# 15-TYPE-SYSTEM.md — 类型系统与共享 Schema

> **原则**：类型从 Zod schema 自动推导，禁止手写 interface 与 schema 重复。

---

## 1. 核心类型定义（`packages/core/src/types/`）

```typescript
// packages/core/src/types/issue.ts
import { z } from 'zod';

export const IssueRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  trackerStatus: z.string().min(1),
  assigneeId: z.string().nullable(),
  metadata: z.record(z.unknown()),
});

export type IssueRecord = z.infer<typeof IssueRecordSchema>;
```

```typescript
// packages/core/src/types/workflow.ts
// （由 WorkflowLoader 中的 WorkflowConfigSchema 推导，不重复定义）
export type { WorkflowDefinition } from '../workflow/WorkflowLoader';
```

```typescript
// packages/core/src/types/events.ts
import { z } from 'zod';

export const AgentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session_started'), sessionId: z.string() }),
  z.object({ type: z.literal('turn_started'), turn: z.number() }),
  z.object({ type: z.literal('turn_completed'), turn: z.number(), finishReason: z.string() }),
  z.object({ type: z.literal('token_usage_updated'), inputTokens: z.number(), outputTokens: z.number() }),
  z.object({ type: z.literal('tool_called'), toolName: z.string(), input: z.unknown() }),
  z.object({ type: z.literal('tool_result'), toolName: z.string(), output: z.unknown() }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('session_completed') }),
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;
```

---

## 2. 类型导出规范

每个包的 `index.ts` 明确导出其公开 API：

```typescript
// packages/core/src/index.ts
export { Orchestrator } from './orchestrator/Orchestrator';
export { AgentRunner } from './runner/AgentRunner';
export { WorkspaceManager } from './workspace/WorkspaceManager';
export { WorkflowLoader } from './workflow/WorkflowLoader';
export type { IssueRecord } from './types/issue';
export type { AgentEvent } from './types/events';
export type { WorkflowDefinition } from './types/workflow';
```

---

## 3. Zod 验证原则

- **所有外部输入**（API 响应、用户输入、文件内容）必须经过 Zod 验证
- **所有内部类型**从 Zod schema 用 `z.infer<>` 推导，不手写 TypeScript interface
- **验证错误**必须包含可读的错误信息，使用 `.safeParse()` 并处理错误

```typescript
// 正确做法
const result = IssueRecordSchema.safeParse(rawData);
if (!result.success) {
  logger.error({ error: result.error.format() }, 'Invalid issue data from tracker');
  throw new ValidationError('Invalid issue data', result.error);
}
const issue = result.data; // 类型安全
```

---

# 16-TESTING.md — 测试策略

---

## 1. 测试分层

| 层次 | 工具 | 覆盖内容 | 位置 |
|---|---|---|---|
| 单元测试 | Vitest | Orchestrator reducer、WorkflowLoader 解析、PromptRenderer | `packages/*/src/__tests__/` |
| 集成测试 | Vitest + MemoryTracker | Orchestrator + MemoryTracker 全流程 | `packages/core/src/__tests__/integration/` |
| E2E 测试 | Playwright（桌面）| 关键 UI 流程 | `apps/desktop/e2e/` |

---

## 2. 关键单元测试

```typescript
// packages/core/src/__tests__/orchestrator.reducer.test.ts

import { describe, it, expect } from 'vitest';
import { orchestratorReducer, initialState } from '../orchestrator/state';

describe('orchestratorReducer', () => {
  it('should not allow concurrent tick', () => {
    const s1 = orchestratorReducer(initialState, { type: 'TICK_START' });
    expect(s1.isTickRunning).toBe(true);
    
    // 第二次 TICK_START 不改变状态（因为 tick() 有 guard）
    const s2 = orchestratorReducer(s1, { type: 'TICK_START' });
    expect(s2.isTickRunning).toBe(true);
  });

  it('should increment dispatch counter on AGENT_DISPATCHED', () => {
    const action = {
      type: 'AGENT_DISPATCHED' as const,
      issueId: 'test-1',
      state: { issueId: 'test-1', status: 'queued' as const, startedAt: new Date(), retryCount: 0, abortController: new AbortController() },
    };
    const newState = orchestratorReducer(initialState, action);
    expect(newState.metrics.totalDispatched).toBe(1);
    expect(newState.running.has('test-1')).toBe(true);
  });

  it('should remove from running on AGENT_SUCCEEDED', () => {
    // 先添加一个运行中的 agent
    let state = orchestratorReducer(initialState, {
      type: 'AGENT_DISPATCHED',
      issueId: 'test-1',
      state: { issueId: 'test-1', status: 'running' as const, startedAt: new Date(), retryCount: 0, abortController: new AbortController() },
    });
    
    state = orchestratorReducer(state, { type: 'AGENT_SUCCEEDED', issueId: 'test-1' });
    expect(state.running.has('test-1')).toBe(false);
    expect(state.metrics.totalSucceeded).toBe(1);
  });
});
```

```typescript
// packages/core/src/__tests__/workflow-loader.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { writeFile, unlink } from 'node:fs/promises';
import { WorkflowLoader } from '../workflow/WorkflowLoader';
import * as path from 'node:path';
import * as os from 'node:os';

describe('WorkflowLoader', () => {
  let tmpFile: string;

  beforeEach(async () => {
    tmpFile = path.join(os.tmpdir(), `workflow-test-${Date.now()}.md`);
  });

  it('should parse WORKFLOW.md correctly', async () => {
    await writeFile(tmpFile, `---
tracker:
  type: linear
  api_key: test-key
  team_id: test-team
---
Hello {{issue.title}}
`);
    process.env.LINEAR_API_KEY = 'test-key';
    process.env.LINEAR_TEAM_ID = 'test-team';
    
    const loader = new WorkflowLoader(tmpFile);
    const workflow = await loader.load();
    
    expect(workflow.config.tracker.type).toBe('linear');
    expect(workflow.promptTemplate).toBe('Hello {{issue.title}}');
    
    await unlink(tmpFile);
  });

  it('should throw on invalid config', async () => {
    await writeFile(tmpFile, `---
tracker:
  type: unknown-tracker
---
`);
    
    const loader = new WorkflowLoader(tmpFile);
    await expect(loader.load()).rejects.toThrow();
    
    await unlink(tmpFile);
  });
});
```

---

## 3. 集成测试（Orchestrator + MemoryTracker）

```typescript
// packages/core/src/__tests__/integration/orchestrator.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../orchestrator/Orchestrator';
import { MemoryTracker } from '@symphony/tracker';

describe('Orchestrator integration', () => {
  it('should dispatch agent for active issue', async () => {
    const tracker = new MemoryTracker();
    tracker.seed([{
      id: 'issue-1',
      title: 'Test Issue',
      description: null,
      trackerStatus: 'Todo',
      assigneeId: null,
      metadata: {},
    }]);

    const orchestrator = new Orchestrator({
      tracker,
      workflowLoader: mockWorkflowLoader(),
      workspaceManager: mockWorkspaceManager(),
    });

    const dispatched: string[] = [];
    orchestrator.on('state_changed', (state) => {
      for (const [id] of state.running) {
        if (!dispatched.includes(id)) dispatched.push(id);
      }
    });

    await orchestrator.tick();

    expect(dispatched).toContain('issue-1');
  });
});
```

---

## 4. 测试工具配置

```typescript
// packages/core/vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov'],
      exclude: ['**/__tests__/**'],
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
});
```

---

# 17-CICD.md — CI/CD 与发布

---

## 1. GitHub Actions 配置

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test --coverage

  build-desktop:
    needs: check
    strategy:
      matrix:
        platform: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - uses: dtolnay/rust-toolchain@stable
      
      - run: pnpm install
      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          TAURI_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
        with:
          projectPath: apps/desktop
          tagName: v__VERSION__
          releaseName: Symphony v__VERSION__
          releaseBody: See CHANGELOG.md
          releaseDraft: true
```

---

## 2. 版本管理

使用 `changesets` 管理版本：

```bash
# 添加变更记录
pnpm changeset

# 发版
pnpm changeset version
pnpm changeset publish
```

---

# 18-SECURITY.md — 安全边界与信任模型

---

## 1. 信任边界（SPEC.md 要求文档化）

```
高信任区域（内部）：
  - Orchestrator 进程（使用 service_role key）
  - AgentRunner 子进程（在隔离 workspace 中）

低信任区域（外部输入）：
  - Linear Issue 内容（用户输入，作为 prompt 传给 Claude）
  - WORKFLOW.md 内容（团队维护，但需 Zod 验证）
  - Claude 的工具调用（需要路径验证）
```

## 2. 安全实现要求

### 路径遍历防护（MUST）
```typescript
// 所有 workspace 路径操作必须调用 safeJoin()
// 参见 07-WORKSPACE-MANAGER.md 中的实现
```

### 工具调用沙箱（SHOULD）
```typescript
// run_command 工具限制：
// - 只在 workspacePath 内执行
// - 禁止的命令：rm -rf /、curl（可配置白名单）
// - 超时限制：60 秒
// - 禁止 sudo
const BLOCKED_COMMANDS = ['sudo', 'su', 'chmod 777'];
```

### API Key 保护（MUST）
- 所有 API key 从环境变量读取，绝不硬编码
- Anthropic API key 只在 `packages/ai` 内使用，不暴露给前端 WebView
- Linear API key 通过 `linear_graphql` 工具代理，Agent 不直接持有 key

### 内容安全（SHOULD）
- Issue 内容作为用户数据传入 prompt 时，不做额外转义（Claude 本身有安全机制）
- 但应记录所有 prompt 内容到 `agent_events` 表，便于审计

## 3. Tauri 安全配置

```json
// tauri.conf.json 中的 CSP 配置（防止 XSS）
{
  "app": {
    "security": {
      "csp": "default-src 'self'; connect-src 'self' http://localhost:54321 ws://localhost:54321; script-src 'self'"
    }
  }
}
```

**注意**：Tauri v2 的 capability 系统比 v1 的 allowlist 更细粒度，每个 IPC command 都需要在 `capabilities/default.json` 中明确授权。
