# 03-DATA-LAYER.md — Supabase + Drizzle 数据层

> **包位置**：`packages/db`
> **依赖**：`supabase-js`、`drizzle-orm`、`postgres`（Node.js pg driver）

---

## 1. 架构概述

```
应用层（Orchestrator / UI）
    │
    ▼
packages/db（@symphony/db）
    ├── schema/      ← Drizzle ORM schema（类型安全的表定义）
    ├── migrations/  ← SQL 迁移文件（supabase db diff 生成）
    ├── client.ts    ← Supabase client 工厂函数
    ├── queries/     ← 类型化查询函数（不泄漏 SQL 到业务层）
    └── realtime.ts  ← Supabase Realtime 订阅封装
    │
    ▼
自部署 Supabase（PostgreSQL 15 + Realtime + Auth + Storage）
```

---

## 2. Drizzle Schema 定义

文件路径：`packages/db/src/schema/`

### `issues.ts`

```typescript
import { pgTable, text, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// Issue 在 Symphony 中的运行状态（区别于 Linear 中的业务状态）
export const issueRunStatusEnum = pgEnum('issue_run_status', [
  'idle',        // 已知但未调度
  'queued',      // 等待分配 Agent
  'running',     // Agent 正在运行
  'retrying',    // 失败后等待重试
  'succeeded',   // Agent 完成（到达 handoff 状态）
  'failed',      // 超过最大重试次数
  'cancelled',   // Issue 在 tracker 中进入终止状态
]);

export const issues = pgTable('issues', {
  // 主键使用 tracker 侧的 ID（如 Linear Issue ID）
  id: text('id').primaryKey(),
  
  // 来自 tracker 的原始数据
  trackerId: text('tracker_id').notNull(),           // e.g., 'linear'
  trackerIssueId: text('tracker_issue_id').notNull(), // e.g., 'ENG-123'
  title: text('title').notNull(),
  description: text('description'),
  trackerStatus: text('tracker_status').notNull(),   // tracker 侧状态
  assigneeId: text('assignee_id'),
  
  // Symphony 运行状态
  runStatus: issueRunStatusEnum('run_status').notNull().default('idle'),
  
  // 运行指标
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  lastStartedAt: timestamp('last_started_at', { withTimezone: true }),
  lastFinishedAt: timestamp('last_finished_at', { withTimezone: true }),
  
  // 关联的工作区路径
  workspacePath: text('workspace_path'),
  
  // 运行元数据（token 使用量等）
  metadata: jsonb('metadata').$type<{
    totalInputTokens?: number;
    totalOutputTokens?: number;
    agentTurns?: number;
  }>(),
  
  // 时间戳
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;
```

### `agent_sessions.ts`

```typescript
import { pgTable, text, timestamp, integer, jsonb, uuid, pgEnum } from 'drizzle-orm/pg-core';
import { issues } from './issues';

export const sessionStatusEnum = pgEnum('session_status', [
  'starting',
  'running',
  'completed',
  'failed',
  'killed',
]);

export const agentSessions = pgTable('agent_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 关联 issue
  issueId: text('issue_id').notNull().references(() => issues.id),
  
  // 会话状态
  status: sessionStatusEnum('status').notNull().default('starting'),
  
  // 进程信息
  pid: integer('pid'),  // 子进程 PID
  
  // Claude 模型信息
  modelId: text('model_id').notNull().default('claude-sonnet-4-6'),
  
  // token 使用（来自 AI SDK）
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  
  // 会话轮次
  turns: integer('turns').notNull().default(0),
  maxTurns: integer('max_turns').notNull().default(20),
  
  // 错误信息
  errorMessage: text('error_message'),
  
  // 时间戳
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export type AgentSession = typeof agentSessions.$inferSelect;
```

### `agent_events.ts`

```typescript
import { pgTable, text, timestamp, jsonb, uuid, pgEnum } from 'drizzle-orm/pg-core';
import { agentSessions } from './agent_sessions';

export const eventTypeEnum = pgEnum('event_type', [
  'session_started',
  'turn_started',
  'turn_completed',
  'tool_called',
  'tool_result',
  'token_usage_updated',
  'status_changed',
  'error',
  'session_completed',
]);

export const agentEvents = pgTable('agent_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => agentSessions.id),
  
  eventType: eventTypeEnum('event_type').notNull(),
  
  // 事件数据（结构取决于 eventType）
  data: jsonb('data').notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### `workflow_configs.ts`

```typescript
import { pgTable, text, timestamp, jsonb, uuid, boolean } from 'drizzle-orm/pg-core';

// 存储解析后的 WORKFLOW.md 配置（用于历史追踪和 UI 展示）
export const workflowConfigs = pgTable('workflow_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 配置内容（WORKFLOW.md 的解析结果）
  config: jsonb('config').notNull(),
  
  // 原始 markdown 内容（用于展示）
  rawContent: text('raw_content').notNull(),
  
  // 是否为当前活跃配置
  isActive: boolean('is_active').notNull().default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 3. Supabase Client 工厂

文件路径：`packages/db/src/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 类型安全的 Supabase client（用于 Realtime、Auth、Storage）
export function createSupabaseClient(options?: {
  serviceRole?: boolean;
}) {
  const url = process.env.SUPABASE_URL!;
  const key = options?.serviceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY!
    : process.env.SUPABASE_ANON_KEY!;

  return createClient(url, key, {
    realtime: { params: { eventsPerSecond: 10 } },
    auth: { persistSession: false },  // 内部服务，无需持久化 session
  });
}

// Drizzle ORM client（用于类型化查询）
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL
      ?? `postgresql://postgres:postgres@localhost:54322/postgres`;
    
    const client = postgres(connectionString);
    _db = drizzle(client, { schema });
  }
  return _db;
}

export type Database = ReturnType<typeof getDb>;
```

---

## 4. 类型化查询函数

文件路径：`packages/db/src/queries/`

### `issues.queries.ts`

```typescript
import { eq, and, inArray, lt } from 'drizzle-orm';
import { getDb } from '../client';
import { issues, type Issue, type NewIssue } from '../schema/issues';

export const issueQueries = {
  // 获取所有活跃运行中的 issue（Orchestrator reconcile 用）
  async getRunningIssues(): Promise<Issue[]> {
    const db = getDb();
    return db.select().from(issues)
      .where(inArray(issues.runStatus, ['running', 'retrying', 'queued']));
  },

  // Upsert issue（来自 tracker 的数据）
  async upsertFromTracker(data: NewIssue): Promise<Issue> {
    const db = getDb();
    const [result] = await db.insert(issues)
      .values(data)
      .onConflictDoUpdate({
        target: issues.id,
        set: {
          title: data.title,
          description: data.description,
          trackerStatus: data.trackerStatus,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result!;
  },

  // 更新运行状态（Orchestrator 状态机用）
  async updateRunStatus(
    id: string,
    status: Issue['runStatus'],
    extra?: Partial<Pick<Issue, 'workspacePath' | 'lastStartedAt' | 'lastFinishedAt' | 'retryCount'>>
  ): Promise<void> {
    const db = getDb();
    await db.update(issues)
      .set({ runStatus: status, updatedAt: new Date(), ...extra })
      .where(eq(issues.id, id));
  },

  // 查找需要重试的 issue
  async getRetryableIssues(now: Date): Promise<Issue[]> {
    const db = getDb();
    // 这里需要结合 retry_after 逻辑（可存在 metadata 中）
    return db.select().from(issues)
      .where(and(
        eq(issues.runStatus, 'retrying'),
        lt(issues.retryCount, issues.maxRetries),
      ));
  },
};
```

---

## 5. Supabase Realtime 封装

文件路径：`packages/db/src/realtime.ts`

```typescript
import { createSupabaseClient } from './client';
import type { Issue } from './schema/issues';
import type { AgentSession } from './schema/agent_sessions';

type RealtimeCallback<T> = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T>;
}) => void;

export function subscribeToIssueChanges(callback: RealtimeCallback<Issue>) {
  const supabase = createSupabaseClient();
  
  return supabase
    .channel('issues-changes')
    .on<Issue>(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'issues' },
      callback
    )
    .subscribe();
}

export function subscribeToSessionChanges(
  sessionId: string,
  callback: RealtimeCallback<AgentSession>
) {
  const supabase = createSupabaseClient();

  return supabase
    .channel(`session-${sessionId}`)
    .on<AgentSession>(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'agent_sessions',
        filter: `id=eq.${sessionId}`,
      },
      callback
    )
    .subscribe();
}

// 用于 UI 层的 React hook（在 packages/ui 或 apps/desktop 中使用）
// 这里只导出订阅函数，hook 层在 UI 包中封装
```

---

## 6. 数据库迁移工作流

```bash
# 生成迁移文件（根据 schema 变更）
pnpm db:generate

# 应用迁移（本地 Supabase）
pnpm db:migrate

# 查看当前数据库状态
supabase db diff

# 重置本地数据库（开发时）
supabase db reset
```

**约束**：
- 所有 schema 变更必须通过迁移文件，禁止直接修改生产数据库
- 迁移文件提交到 git
- 每次 schema 变更后重新生成 TypeScript 类型

---

## 7. Row Level Security (RLS) 策略

```sql
-- issues 表：允许 service role 完全访问（Orchestrator 使用 service role key）
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON issues
  FOR ALL
  TO service_role
  USING (true);

-- agent_sessions 表：同上
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON agent_sessions
  FOR ALL
  TO service_role
  USING (true);

-- Realtime：允许匿名 key 订阅（UI 使用 anon key 实时更新）
-- 注意：匿名 key 只有读权限
CREATE POLICY "anon_read_issues" ON issues
  FOR SELECT
  TO anon
  USING (true);
```

---

## 8. 性能注意事项

- `agent_events` 表写入频繁，需要定期归档（30 天以上的事件可压缩存储）
- `issues` 表建议对 `run_status` 列建索引
- Realtime 订阅数量：每个 UI 客户端约 2-3 个订阅（issues + session），注意 Supabase Realtime 连接数上限
- 本地自部署 Supabase 默认配置对 10-50 并发 Agent 足够，无需特殊调优
