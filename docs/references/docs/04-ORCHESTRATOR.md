# 04-ORCHESTRATOR.md — 核心调度状态机

> **包位置**：`packages/core/src/orchestrator/`
> **这是整个系统最关键的模块**，所有并发控制、状态管理、重试逻辑都在这里。
> 实现前必须读完本文档全部内容。

---

## 1. 职责边界（严格定义）

Orchestrator **负责**：
- 以固定频率（默认 30s）驱动 poll 循环（`tick()`）
- 维护内存中的运行状态（与 DB 双写）
- 决定哪些 Issue 需要 dispatch、retry、stop
- 启动 AgentRunner（fire-and-monitor，不阻塞）
- 处理 AgentRunner 的状态事件回调
- 从 Supabase 实时变更中响应 Issue 状态变化

Orchestrator **不负责**：
- 执行 git 操作（WorkspaceManager 的职责）
- 与 Claude 对话（AgentRunner → AppServerClient 的职责）
- 读写 Linear（TrackerAdapter 的职责）
- 渲染 UI（通过 Supabase Realtime 推送，UI 被动消费）

---

## 2. 内存状态结构

```typescript
// packages/core/src/orchestrator/state.ts

import type { IssueRecord } from '../types/issue';

export type AgentRunState = {
  issueId: string;
  status: 'queued' | 'running' | 'retrying';
  pid?: number;              // 子进程 PID（用于 kill）
  sessionId?: string;        // DB 中 agent_sessions 的 UUID
  startedAt: Date;
  retryCount: number;
  retryAfter?: Date;         // 指数退避的重试时间点
  abortController: AbortController; // 用于优雅终止
};

export type OrchestratorState = {
  // 当前运行中的 Agent 状态（key: issueId）
  running: Map<string, AgentRunState>;
  
  // 从 tracker 获取的最新 Issue 列表（key: issueId）
  knownIssues: Map<string, IssueRecord>;
  
  // 当前 WORKFLOW.md 配置（热加载）
  workflow: WorkflowDefinition | null;
  
  // tick 锁（防止并发 tick）
  isTickRunning: boolean;
  
  // 统计指标
  metrics: {
    totalDispatched: number;
    totalSucceeded: number;
    totalFailed: number;
    lastTickAt: Date | null;
  };
};

// 纯函数 reducer（状态变更的唯一入口）
export type OrchestratorAction =
  | { type: 'TICK_START' }
  | { type: 'TICK_END' }
  | { type: 'ISSUES_LOADED'; issues: IssueRecord[] }
  | { type: 'AGENT_DISPATCHED'; issueId: string; state: AgentRunState }
  | { type: 'AGENT_STATUS_CHANGED'; issueId: string; status: AgentRunState['status']; pid?: number }
  | { type: 'AGENT_SUCCEEDED'; issueId: string }
  | { type: 'AGENT_FAILED'; issueId: string; error: Error; retryAfter?: Date }
  | { type: 'AGENT_STOPPED'; issueId: string }
  | { type: 'WORKFLOW_RELOADED'; workflow: WorkflowDefinition }
  | { type: 'RETRY_SCHEDULED'; issueId: string; retryAfter: Date };

export function orchestratorReducer(
  state: OrchestratorState,
  action: OrchestratorAction
): OrchestratorState {
  switch (action.type) {
    case 'TICK_START':
      return { ...state, isTickRunning: true };
    
    case 'TICK_END':
      return {
        ...state,
        isTickRunning: false,
        metrics: { ...state.metrics, lastTickAt: new Date() },
      };
    
    case 'ISSUES_LOADED': {
      const newKnownIssues = new Map(state.knownIssues);
      for (const issue of action.issues) {
        newKnownIssues.set(issue.id, issue);
      }
      return { ...state, knownIssues: newKnownIssues };
    }
    
    case 'AGENT_DISPATCHED': {
      const newRunning = new Map(state.running);
      newRunning.set(action.issueId, action.state);
      return {
        ...state,
        running: newRunning,
        metrics: {
          ...state.metrics,
          totalDispatched: state.metrics.totalDispatched + 1,
        },
      };
    }
    
    case 'AGENT_SUCCEEDED': {
      const newRunning = new Map(state.running);
      newRunning.delete(action.issueId);
      return {
        ...state,
        running: newRunning,
        metrics: {
          ...state.metrics,
          totalSucceeded: state.metrics.totalSucceeded + 1,
        },
      };
    }
    
    case 'AGENT_FAILED': {
      const newRunning = new Map(state.running);
      const current = newRunning.get(action.issueId);
      if (current) {
        newRunning.set(action.issueId, {
          ...current,
          status: 'retrying',
          retryCount: current.retryCount + 1,
          retryAfter: action.retryAfter,
        });
      }
      return { ...state, running: newRunning };
    }
    
    case 'AGENT_STOPPED': {
      const newRunning = new Map(state.running);
      newRunning.delete(action.issueId);
      return {
        ...state,
        running: newRunning,
        metrics: {
          ...state.metrics,
          totalFailed: state.metrics.totalFailed + 1,
        },
      };
    }
    
    case 'WORKFLOW_RELOADED':
      return { ...state, workflow: action.workflow };
    
    default:
      return state;
  }
}
```

---

## 3. Orchestrator 主类

```typescript
// packages/core/src/orchestrator/Orchestrator.ts

import EventEmitter from 'node:events';
import { orchestratorReducer, type OrchestratorState, type OrchestratorAction } from './state';
import { AgentRunner } from '../runner/AgentRunner';
import { WorkspaceManager } from '../workspace/WorkspaceManager';
import { WorkflowLoader } from '../workflow/WorkflowLoader';
import { issueQueries } from '@symphony/db';
import type { TrackerPort } from '../tracker/port';
import type { WorkflowDefinition } from '../types/workflow';
import type { IssueRecord } from '../types/issue';
import { logger } from '../utils/logger';

export class Orchestrator extends EventEmitter {
  private state: OrchestratorState;
  private tickTimer: NodeJS.Timer | null = null;
  private tracker: TrackerPort;
  private workflowLoader: WorkflowLoader;
  private workspaceManager: WorkspaceManager;

  constructor(options: {
    tracker: TrackerPort;
    workflowLoader: WorkflowLoader;
    workspaceManager: WorkspaceManager;
  }) {
    super();
    this.tracker = options.tracker;
    this.workflowLoader = options.workflowLoader;
    this.workspaceManager = options.workspaceManager;
    
    this.state = {
      running: new Map(),
      knownIssues: new Map(),
      workflow: null,
      isTickRunning: false,
      metrics: {
        totalDispatched: 0,
        totalSucceeded: 0,
        totalFailed: 0,
        lastTickAt: null,
      },
    };
  }

  // ═══════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════

  async start(): Promise<void> {
    logger.info('Orchestrator starting...');
    
    // 1. 加载 WORKFLOW.md
    const workflow = await this.workflowLoader.load();
    this.dispatch({ type: 'WORKFLOW_RELOADED', workflow });
    
    // 2. 注册热加载回调
    this.workflowLoader.onReload((newWorkflow) => {
      logger.info('WORKFLOW.md reloaded');
      this.dispatch({ type: 'WORKFLOW_RELOADED', workflow: newWorkflow });
    });
    
    // 3. 从 DB 恢复状态（reconcile）
    await this.recoverFromDatabase();
    
    // 4. 启动 tick 循环
    const interval = workflow.config.polling?.intervalMs ?? 30_000;
    this.tickTimer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error({ err }, 'Tick failed');
      });
    }, interval);
    
    // 立即执行第一次 tick
    await this.tick();
    
    logger.info('Orchestrator started');
    this.emit('started');
  }

  async stop(): Promise<void> {
    logger.info('Orchestrator stopping...');
    
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    
    // 优雅关闭所有运行中的 Agent
    const stopPromises = Array.from(this.state.running.keys()).map((issueId) =>
      this.stopAgent(issueId, 'orchestrator_shutdown')
    );
    await Promise.allSettled(stopPromises);
    
    logger.info('Orchestrator stopped');
    this.emit('stopped');
  }

  // ═══════════════════════════════════════
  // 核心 Tick 循环
  // ═══════════════════════════════════════

  async tick(): Promise<void> {
    // 防止并发 tick（不使用锁，用布尔标志即可，因为 tick 是单线程）
    if (this.state.isTickRunning) {
      logger.debug('Tick skipped: previous tick still running');
      return;
    }
    
    this.dispatch({ type: 'TICK_START' });
    
    try {
      // Step 1: 从 tracker 获取当前 Issue 列表
      const issues = await this.fetchActiveIssues();
      this.dispatch({ type: 'ISSUES_LOADED', issues });
      
      // Step 2: 停止已进入终止状态的 Agent
      await this.reconcileTerminalIssues(issues);
      
      // Step 3: 处理重试队列
      await this.processRetryQueue();
      
      // Step 4: 调度新的候选 Issue
      await this.dispatchCandidates(issues);
      
    } catch (err) {
      logger.error({ err }, 'Tick error');
    } finally {
      this.dispatch({ type: 'TICK_END' });
    }
  }

  // ═══════════════════════════════════════
  // 各步骤实现
  // ═══════════════════════════════════════

  private async fetchActiveIssues(): Promise<IssueRecord[]> {
    const workflow = this.state.workflow!;
    const activeStates = workflow.config.tracker?.activeStates
      ?? ['Todo', 'In Progress'];
    
    return this.tracker.fetchIssues({ states: activeStates });
  }

  private async reconcileTerminalIssues(currentIssues: IssueRecord[]): Promise<void> {
    const currentIds = new Set(currentIssues.map((i) => i.id));
    
    for (const [issueId, runState] of this.state.running) {
      const current = currentIssues.find((i) => i.id === issueId);
      
      // Issue 已从 tracker 消失，或进入终止状态
      const isTerminal = !current || this.isTerminalState(current.trackerStatus);
      
      if (isTerminal) {
        logger.info({ issueId }, 'Issue reached terminal state, stopping agent');
        await this.stopAgent(issueId, 'terminal_state');
      }
    }
  }

  private async processRetryQueue(): Promise<void> {
    const now = new Date();
    
    for (const [issueId, runState] of this.state.running) {
      if (runState.status !== 'retrying') continue;
      if (!runState.retryAfter || runState.retryAfter > now) continue;
      
      // 超过最大重试次数
      const maxRetries = this.state.workflow?.config.agent?.maxRetries ?? 3;
      if (runState.retryCount >= maxRetries) {
        logger.warn({ issueId, retryCount: runState.retryCount }, 'Max retries exceeded');
        this.dispatch({ type: 'AGENT_STOPPED', issueId });
        await issueQueries.updateRunStatus(issueId, 'failed');
        continue;
      }
      
      // 重新调度
      logger.info({ issueId, attempt: runState.retryCount + 1 }, 'Retrying agent');
      const issue = this.state.knownIssues.get(issueId);
      if (issue) {
        await this.launchAgent(issue, runState.retryCount);
      }
    }
  }

  private async dispatchCandidates(issues: IssueRecord[]): Promise<void> {
    const maxConcurrent = this.state.workflow?.config.agent?.maxConcurrentAgents ?? 5;
    const currentlyRunning = Array.from(this.state.running.values())
      .filter((s) => s.status === 'running' || s.status === 'queued').length;
    
    const capacity = maxConcurrent - currentlyRunning;
    if (capacity <= 0) {
      logger.debug({ maxConcurrent, currentlyRunning }, 'No capacity for new agents');
      return;
    }
    
    // 候选：tracker 中活跃但未在运行的 Issue
    const candidates = issues
      .filter((issue) => !this.state.running.has(issue.id))
      .slice(0, capacity); // 不超过容量
    
    for (const issue of candidates) {
      await this.launchAgent(issue, 0);
    }
  }

  // ═══════════════════════════════════════
  // Agent 生命周期管理
  // ═══════════════════════════════════════

  private async launchAgent(issue: IssueRecord, retryCount: number): Promise<void> {
    const abortController = new AbortController();
    
    const runState: AgentRunState = {
      issueId: issue.id,
      status: 'queued',
      startedAt: new Date(),
      retryCount,
      abortController,
    };
    
    this.dispatch({ type: 'AGENT_DISPATCHED', issueId: issue.id, state: runState });
    await issueQueries.updateRunStatus(issue.id, 'running', { lastStartedAt: new Date() });
    
    // fire-and-monitor：绝不 await AgentRunner
    const runner = new AgentRunner({
      issue,
      workflow: this.state.workflow!,
      workspaceManager: this.workspaceManager,
      signal: abortController.signal,
    });
    
    // 监听 AgentRunner 事件
    runner.on('started', ({ pid, sessionId }) => {
      this.dispatch({
        type: 'AGENT_STATUS_CHANGED',
        issueId: issue.id,
        status: 'running',
        pid,
      });
      // 更新 DB 中的 pid
      issueQueries.updateRunStatus(issue.id, 'running');
    });
    
    runner.on('succeeded', async () => {
      this.dispatch({ type: 'AGENT_SUCCEEDED', issueId: issue.id });
      await issueQueries.updateRunStatus(issue.id, 'succeeded', {
        lastFinishedAt: new Date(),
      });
    });
    
    runner.on('failed', async ({ error }) => {
      const maxRetries = this.state.workflow?.config.agent?.maxRetries ?? 3;
      const nextRetryCount = retryCount + 1;
      
      if (nextRetryCount > maxRetries) {
        this.dispatch({ type: 'AGENT_STOPPED', issueId: issue.id });
        await issueQueries.updateRunStatus(issue.id, 'failed', {
          lastFinishedAt: new Date(),
        });
      } else {
        // 指数退避
        const delayMs = Math.min(1000 * Math.pow(2, nextRetryCount), 30_000);
        const retryAfter = new Date(Date.now() + delayMs);
        
        this.dispatch({ type: 'AGENT_FAILED', issueId: issue.id, error, retryAfter });
        await issueQueries.updateRunStatus(issue.id, 'retrying', {
          retryCount: nextRetryCount,
        });
      }
    });
    
    // 启动（不阻塞）
    runner.start().catch((err) => {
      logger.error({ err, issueId: issue.id }, 'AgentRunner.start() threw synchronously');
    });
  }

  private async stopAgent(issueId: string, reason: string): Promise<void> {
    const runState = this.state.running.get(issueId);
    if (!runState) return;
    
    logger.info({ issueId, reason }, 'Stopping agent');
    runState.abortController.abort(reason);
    
    this.dispatch({ type: 'AGENT_STOPPED', issueId });
    await issueQueries.updateRunStatus(issueId, 'cancelled', {
      lastFinishedAt: new Date(),
    });
  }

  // ═══════════════════════════════════════
  // 工具方法
  // ═══════════════════════════════════════

  private isTerminalState(trackerStatus: string): boolean {
    const terminalStates = ['Done', 'Closed', 'Cancelled', 'Duplicate'];
    return terminalStates.includes(trackerStatus);
  }

  // 状态变更的唯一入口（同步，保证原子性）
  private dispatch(action: OrchestratorAction): void {
    this.state = orchestratorReducer(this.state, action);
    this.emit('state_changed', this.state);
  }

  // DB 恢复（进程重启后重建内存状态）
  private async recoverFromDatabase(): Promise<void> {
    const runningIssues = await issueQueries.getRunningIssues();
    
    for (const issue of runningIssues) {
      // 重启后，所有之前 running 的 Issue 需要重新启动 Agent
      // 先将 DB 状态重置为 idle，让下次 tick 重新调度
      await issueQueries.updateRunStatus(issue.id, 'idle');
    }
    
    logger.info({ count: runningIssues.length }, 'Recovered from database');
  }

  // 用于 UI 查询当前状态快照
  getStateSnapshot(): Readonly<OrchestratorState> {
    return Object.freeze({ ...this.state });
  }
}
```

---

## 4. 关键不变量（所有修改必须保证）

1. **`dispatch()` 是状态变更的唯一入口**。任何代码路径不得直接修改 `this.state`。
2. **`tick()` 不得并发执行**。`isTickRunning` 标志保证这一点。
3. **`launchAgent()` 绝不 `await` AgentRunner 的完成**。runner.start() 立即返回。
4. **DB 写入紧跟状态变更**。`dispatch()` 之后立即写 DB，不允许先写 DB 再改状态（否则崩溃时状态不一致）。
5. **`retryCount` 只能递增**，重试次数超过 `maxRetries` 必须转为 `failed` 状态。

---

## 5. 进程重启恢复策略

```
重启前状态（DB）         重启后行为
──────────────────────────────────────────
running  → 重置为 idle → 下次 tick 重新调度
retrying → 重置为 idle → 下次 tick 重新调度（重试计数保留）
queued   → 重置为 idle → 下次 tick 重新调度
succeeded → 保持       → 不重新调度
failed   → 保持        → 不重新调度
cancelled → 保持       → 不重新调度
```
