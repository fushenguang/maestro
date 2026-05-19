# 06-TRACKER-INTEGRATION.md — Issue Tracker 适配器

> **包位置**：`packages/tracker/src/`

---

## 1. TrackerPort 接口（扩展点）

```typescript
// packages/tracker/src/port.ts

export type IssueRecord = {
  id: string;               // tracker 侧唯一 ID（如 "ENG-123"）
  title: string;
  description: string | null;
  trackerStatus: string;    // tracker 侧的状态字符串
  assigneeId: string | null;
  metadata: Record<string, unknown>; // tracker 特有字段
};

export type FetchOptions = {
  states: string[];          // 要拉取的状态列表（如 ['Todo', 'In Progress']）
  limit?: number;
};

export interface TrackerPort {
  // 获取活跃 Issue 列表（Orchestrator poll 使用）
  fetchIssues(options: FetchOptions): Promise<IssueRecord[]>;
  
  // 获取单个 Issue 的当前状态（reconcile 使用）
  fetchIssue(id: string): Promise<IssueRecord | null>;
  
  // 执行 GraphQL 查询（linear_graphql 动态工具使用）
  executeGraphQL(params: { query: string; variables?: object }): Promise<unknown>;
  
  // Tracker 名称（用于日志和 UI 展示）
  readonly name: string;
}
```

---

## 2. Linear 适配器实现

```typescript
// packages/tracker/src/linear/LinearTracker.ts

import { LinearClient } from '@linear/sdk';
import type { TrackerPort, IssueRecord, FetchOptions } from '../port';

export class LinearTracker implements TrackerPort {
  readonly name = 'linear';
  private client: LinearClient;
  private teamId: string;

  constructor(options: { apiKey: string; teamId: string }) {
    this.client = new LinearClient({ apiKey: options.apiKey });
    this.teamId = options.teamId;
  }

  async fetchIssues(options: FetchOptions): Promise<IssueRecord[]> {
    const issues = await this.client.issues({
      filter: {
        team: { id: { eq: this.teamId } },
        state: { name: { in: options.states } },
      },
      first: options.limit ?? 50,
    });

    return issues.nodes.map(this.normalizeIssue);
  }

  async fetchIssue(id: string): Promise<IssueRecord | null> {
    try {
      const issue = await this.client.issue(id);
      return this.normalizeIssue(issue);
    } catch {
      return null;
    }
  }

  async executeGraphQL(params: { query: string; variables?: object }): Promise<unknown> {
    // 验证：只允许单个操作（SPEC.md 要求）
    const operationCount = (params.query.match(/^(query|mutation|subscription)\s/gm) ?? []).length;
    if (operationCount > 1) {
      throw new Error('linear_graphql: multi-operation documents are not allowed');
    }

    return this.client.client.rawRequest(params.query, params.variables);
  }

  private normalizeIssue(issue: any): IssueRecord {
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description ?? null,
      trackerStatus: issue.state?.name ?? 'Unknown',
      assigneeId: issue.assignee?.id ?? null,
      metadata: {
        identifier: issue.identifier,  // e.g., "ENG-123"
        priority: issue.priority,
        url: issue.url,
      },
    };
  }
}
```

---

## 3. Memory 适配器（测试用）

```typescript
// packages/tracker/src/memory/MemoryTracker.ts

import type { TrackerPort, IssueRecord, FetchOptions } from '../port';

export class MemoryTracker implements TrackerPort {
  readonly name = 'memory';
  private issues: Map<string, IssueRecord> = new Map();

  // 测试时注入 Issue
  seed(issues: IssueRecord[]): void {
    for (const issue of issues) {
      this.issues.set(issue.id, issue);
    }
  }

  async fetchIssues(options: FetchOptions): Promise<IssueRecord[]> {
    return Array.from(this.issues.values()).filter((i) =>
      options.states.includes(i.trackerStatus)
    );
  }

  async fetchIssue(id: string): Promise<IssueRecord | null> {
    return this.issues.get(id) ?? null;
  }

  async executeGraphQL(params: { query: string }): Promise<unknown> {
    return { data: null };
  }
}
```

---

# 07-WORKSPACE-MANAGER.md — Workspace 生命周期管理

> **包位置**：`packages/core/src/workspace/`

---

## 工作区管理（安全优先）

```typescript
// packages/core/src/workspace/WorkspaceManager.ts

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import type { TrackerPort } from '../tracker/port';

export class WorkspaceManager {
  private rootDir: string;
  tracker: TrackerPort; // AgentRunner 中的 linear_graphql 工具需要访问

  constructor(options: { rootDir: string; tracker: TrackerPort }) {
    this.rootDir = path.resolve(options.rootDir);
    this.tracker = options.tracker;
  }

  // 为 Issue 创建隔离工作区（git clone）
  async create(issueId: string): Promise<string> {
    const workspacePath = this.safeJoin(issueId);
    
    // 清理已有目录（重试场景）
    await fs.rm(workspacePath, { recursive: true, force: true });
    await fs.mkdir(workspacePath, { recursive: true });
    
    // git clone（完整独立副本，不用 worktree）
    const repoUrl = process.env.SYMPHONY_REPO_URL!;
    await execa('git', ['clone', '--depth=1', repoUrl, workspacePath]);
    
    return workspacePath;
  }

  // 清理工作区
  async cleanup(issueId: string, workspacePath?: string): Promise<void> {
    const target = workspacePath ?? this.safeJoin(issueId);
    await fs.rm(target, { recursive: true, force: true });
  }

  // 路径安全验证（防止 path traversal）
  private safeJoin(issueId: string): string {
    // 清理 issueId 中的非法字符
    const safeId = issueId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fullPath = path.resolve(this.rootDir, safeId);
    
    // 验证不逃逸根目录
    if (!fullPath.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Path traversal detected: ${issueId}`);
    }
    
    return fullPath;
  }
}
```

---

# 08-WORKFLOW-CONFIG.md — WORKFLOW.md 配置系统

> **包位置**：`packages/core/src/workflow/`

---

## WORKFLOW.md 文件格式

```markdown
---
# YAML front matter（配置部分）
tracker:
  type: linear
  api_key: ${LINEAR_API_KEY}
  team_id: ${LINEAR_TEAM_ID}
  active_states:
    - Todo
    - In Progress

agent:
  model: claude-sonnet-4-6
  max_concurrent_agents: 5
  max_turns: 20
  max_retries: 3

polling:
  interval_ms: 30000

workspace:
  root: ${SYMPHONY_WORKSPACE_ROOT}

# hooks（可选）
hooks:
  post_create: "./scripts/setup-workspace.sh"
---

# Markdown body（Agent prompt 模板）
You are a senior software engineer working on the {{issue.metadata.identifier}} issue.

## Task
**Title**: {{issue.title}}

**Description**:
{{issue.description}}

## Instructions
1. Understand the issue thoroughly before writing code.
2. Write tests first if the codebase has a test suite.
3. Run CI (e.g., `pnpm test`) and fix any failures.
4. Update the Linear issue status when done using the `linear_graphql` tool.
5. Create a pull request with a clear description.

## Workspace
Your working directory: {{workspacePath}}

Work carefully. Your changes will be automatically reviewed.
```

---

## WorkflowLoader 实现

```typescript
// packages/core/src/workflow/WorkflowLoader.ts

import { watch } from 'chokidar';
import { readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import { z } from 'zod';
import { logger } from '../utils/logger';

// Zod schema（对齐 SPEC.md 中的 WorkflowDefinition）
const WorkflowConfigSchema = z.object({
  tracker: z.object({
    type: z.enum(['linear']).default('linear'),
    api_key: z.string(),
    team_id: z.string(),
    active_states: z.array(z.string()).default(['Todo', 'In Progress']),
  }),
  agent: z.object({
    model: z.string().default('claude-sonnet-4-6'),
    max_concurrent_agents: z.number().int().min(1).max(50).default(5),
    max_turns: z.number().int().min(1).max(100).default(20),
    max_retries: z.number().int().min(0).max(10).default(3),
  }).default({}),
  polling: z.object({
    interval_ms: z.number().int().min(5000).default(30000),
  }).default({}),
  workspace: z.object({
    root: z.string().default('/tmp/symphony-workspaces'),
  }).default({}),
  hooks: z.object({
    post_create: z.string().optional(),
    pre_cleanup: z.string().optional(),
  }).optional(),
});

export type WorkflowDefinition = {
  config: z.infer<typeof WorkflowConfigSchema>;
  promptTemplate: string;
  rawContent: string;
};

export class WorkflowLoader {
  private filePath: string;
  private currentWorkflow: WorkflowDefinition | null = null;
  private reloadCallbacks: Array<(workflow: WorkflowDefinition) => void> = [];

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<WorkflowDefinition> {
    const workflow = await this.parseFile();
    this.currentWorkflow = workflow;
    return workflow;
  }

  onReload(callback: (workflow: WorkflowDefinition) => void): void {
    this.reloadCallbacks.push(callback);
    this.startWatcher();
  }

  private startWatcher(): void {
    const watcher = watch(this.filePath, { ignoreInitial: true });
    
    watcher.on('change', async () => {
      try {
        const newWorkflow = await this.parseFile();
        this.currentWorkflow = newWorkflow;
        logger.info('WORKFLOW.md reloaded successfully');
        
        for (const cb of this.reloadCallbacks) {
          cb(newWorkflow);
        }
      } catch (err) {
        // 保留上一个有效配置（SPEC.md 要求）
        logger.error({ err }, 'WORKFLOW.md reload failed, keeping previous config');
      }
    });
  }

  private async parseFile(): Promise<WorkflowDefinition> {
    const raw = await readFile(this.filePath, 'utf-8');
    const { data: frontmatter, content: promptTemplate } = matter(raw);
    
    // 环境变量替换（支持 ${VAR_NAME} 语法）
    const resolvedFrontmatter = this.resolveEnvVars(frontmatter);
    
    // Zod 验证
    const config = WorkflowConfigSchema.parse(resolvedFrontmatter);
    
    return { config, promptTemplate: promptTemplate.trim(), rawContent: raw };
  }

  private resolveEnvVars(obj: Record<string, any>): Record<string, any> {
    const json = JSON.stringify(obj);
    const resolved = json.replace(/\$\{([^}]+)\}/g, (_, key) => {
      const value = process.env[key];
      if (!value) throw new Error(`Missing environment variable: ${key}`);
      return value;
    });
    return JSON.parse(resolved);
  }
}
```

---

## PromptRenderer

```typescript
// packages/core/src/workflow/PromptRenderer.ts

import type { IssueRecord } from '../types/issue';

export class PromptRenderer {
  static render(
    template: string,
    context: { issue: IssueRecord; workspacePath: string }
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const value = key.trim().split('.').reduce((obj: any, part: string) => {
        return obj?.[part];
      }, context);
      
      return value?.toString() ?? `{{${key}}}`;
    });
  }
}
```
