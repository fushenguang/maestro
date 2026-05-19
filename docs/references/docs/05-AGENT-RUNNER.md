# 05-AGENT-RUNNER.md — AgentRunner 与 AppServer Protocol

> **包位置**：`packages/core/src/runner/`
> **职责**：管理单个 Issue 的 Agent 生命周期（workspace → prompt → Claude → 完成）

---

## 1. AgentRunner 类

```typescript
// packages/core/src/runner/AgentRunner.ts

import EventEmitter from 'node:events';
import { WorkspaceManager } from '../workspace/WorkspaceManager';
import { AppServerClient } from './AppServerClient';
import { PromptRenderer } from '../workflow/PromptRenderer';
import { agentSessionQueries, agentEventQueries } from '@symphony/db';
import type { IssueRecord } from '../types/issue';
import type { WorkflowDefinition } from '../types/workflow';

export class AgentRunner extends EventEmitter {
  private issue: IssueRecord;
  private workflow: WorkflowDefinition;
  private workspaceManager: WorkspaceManager;
  private signal: AbortSignal;
  private client: AppServerClient | null = null;

  constructor(options: {
    issue: IssueRecord;
    workflow: WorkflowDefinition;
    workspaceManager: WorkspaceManager;
    signal: AbortSignal;
  }) {
    super();
    this.issue = options.issue;
    this.workflow = options.workflow;
    this.workspaceManager = options.workspaceManager;
    this.signal = options.signal;
  }

  // start() 应立即返回，不阻塞
  async start(): Promise<void> {
    // 异步执行，不 await
    this._run().catch((err) => {
      this.emit('failed', { error: err });
    });
  }

  private async _run(): Promise<void> {
    let workspacePath: string | null = null;

    try {
      // Step 1: 创建隔离工作区
      workspacePath = await this.workspaceManager.create(this.issue.id);
      
      if (this.signal.aborted) return;

      // Step 2: 渲染 prompt
      const prompt = PromptRenderer.render(this.workflow.promptTemplate, {
        issue: this.issue,
        workspacePath,
      });

      // Step 3: 创建 DB session 记录
      const session = await agentSessionQueries.create({
        issueId: this.issue.id,
        modelId: 'claude-sonnet-4-6',
        maxTurns: this.workflow.config.agent?.maxTurns ?? 20,
      });

      this.emit('started', { pid: process.pid, sessionId: session.id });

      // Step 4: 启动 AppServer（与 Claude 的 JSON-RPC 会话）
      this.client = new AppServerClient({
        workspacePath,
        sessionId: session.id,
        signal: this.signal,
        onEvent: (event) => this.handleAgentEvent(event, session.id),
      });

      // Step 5: 运行至完成或终止
      const result = await this.client.runSession(prompt, {
        maxTurns: this.workflow.config.agent?.maxTurns ?? 20,
        model: 'claude-sonnet-4-6',
        tools: this.buildTools(),
      });

      await agentSessionQueries.complete(session.id, result);
      this.emit('succeeded', { sessionId: session.id });

    } catch (err) {
      if (this.signal.aborted) {
        // 正常终止，不算失败
        return;
      }
      this.emit('failed', { error: err });
    } finally {
      // 清理工作区
      if (workspacePath) {
        await this.workspaceManager.cleanup(this.issue.id, workspacePath);
      }
    }
  }

  private handleAgentEvent(event: AgentEvent, sessionId: string): void {
    // 写入 DB（fire-and-forget，不阻塞 Agent 执行）
    agentEventQueries.insert({ sessionId, ...event }).catch((err) => {
      logger.error({ err }, 'Failed to write agent event');
    });
    
    this.emit('agent_event', event);
  }

  private buildTools() {
    // linear_graphql 动态工具（SPEC.md 要求）
    return [
      {
        name: 'linear_graphql',
        description: 'Execute GraphQL queries against Linear using Symphony auth',
        parameters: { query: 'string', variables: 'object?' },
        execute: async ({ query, variables }: { query: string; variables?: object }) => {
          return this.workspaceManager.tracker.executeGraphQL({ query, variables });
        },
      },
    ];
  }

  // 优雅终止
  async kill(): Promise<void> {
    this.client?.kill();
  }
}
```

---

## 2. AppServerClient（JSON-RPC over AI SDK）

```typescript
// packages/core/src/runner/AppServerClient.ts
// 使用 AI SDK v6 的 generateText + streaming 替代直接 stdio 协议

import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { AgentEvent } from '../types/events';

export class AppServerClient {
  private workspacePath: string;
  private sessionId: string;
  private signal: AbortSignal;
  private onEvent: (event: AgentEvent) => void;

  constructor(options: {
    workspacePath: string;
    sessionId: string;
    signal: AbortSignal;
    onEvent: (event: AgentEvent) => void;
  }) {
    this.workspacePath = options.workspacePath;
    this.sessionId = options.sessionId;
    this.signal = options.signal;
    this.onEvent = options.onEvent;
  }

  async runSession(
    initialPrompt: string,
    options: {
      maxTurns: number;
      model: string;
      tools: Tool[];
    }
  ): Promise<SessionResult> {
    let turns = 0;
    const messages: CoreMessage[] = [
      { role: 'user', content: initialPrompt },
    ];

    // Agent loop（AI SDK v6 风格）
    while (turns < options.maxTurns && !this.signal.aborted) {
      this.onEvent({ type: 'turn_started', turn: turns + 1 });

      const result = await generateText({
        model: anthropic('claude-sonnet-4-6'),
        messages,
        tools: this.buildAISDKTools(options.tools),
        maxTokens: 8192,
        abortSignal: this.signal,
      });

      this.onEvent({
        type: 'token_usage_updated',
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
      });

      turns++;

      // 模型决定停止
      if (result.finishReason === 'stop') {
        this.onEvent({ type: 'turn_completed', turn: turns, finishReason: 'stop' });
        return { turns, finishReason: 'stop', usage: result.usage };
      }

      // 有工具调用，执行工具并继续
      if (result.finishReason === 'tool-calls') {
        const toolResults = await this.executeToolCalls(result.toolCalls);
        messages.push(
          { role: 'assistant', content: result.content },
          { role: 'tool', content: toolResults },
        );
        continue;
      }

      // 其他终止原因
      break;
    }

    return { turns, finishReason: 'max_turns', usage: { promptTokens: 0, completionTokens: 0 } };
  }

  private buildAISDKTools(tools: Tool[]) {
    // 将 Symphony tool 格式转换为 AI SDK v6 tool 格式
    return Object.fromEntries(
      tools.map((tool) => [
        tool.name,
        {
          description: tool.description,
          parameters: tool.schema, // zod schema
          execute: tool.execute,
        },
      ])
    );
  }

  kill(): void {
    // AbortController 会终止 generateText
  }
}
```

---

## 3. 注意事项

- **AI SDK v6 替代直接 stdio**：原版 Symphony 通过 stdio 与 Codex CLI 通信（JSON-RPC）。我们使用 AI SDK v6 直接调用 Claude API，省去 CLI 进程，更简洁。如果未来需要对接其他 CLI 工具，再实现 `AppServerClientStdio` 变体。
- **AbortSignal 贯穿**：所有 async 操作都传递 `signal`，确保 Orchestrator 发出 abort 信号后 Agent 能快速终止。
- **工具执行错误处理**：工具执行失败不应终止整个会话，应返回错误结果让模型决策。
