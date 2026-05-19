# SPEC.md — Symphony 规格文件（参考文档）

> **来源**：openai/symphony 仓库（Apache 2.0 License）
> **用途**：本项目的实现合同。实现时 MUST 条款必须满足，SHOULD 条款应尽量满足。
> **状态**：只读。不得修改此文件内容。如发现规格与实现冲突，以本文件为准。

---

## 核心概念定义（摘录关键部分）

### IssueRecord

Symphony 中 Issue 的标准化表示，与具体 tracker 解耦：

```
IssueRecord:
  id: string           — tracker 侧唯一标识（如 Linear Issue ID）
  title: string        — Issue 标题
  description: string? — Issue 描述（Markdown 格式）
  trackerStatus: string — tracker 侧当前状态
  assigneeId: string?  — 被分配人 ID
  metadata: object     — tracker 特有的额外字段
```

### WorkflowDefinition

WORKFLOW.md 解析后的标准化配置：

```
WorkflowDefinition:
  config:
    tracker:
      type: "linear"            — MUST: 当前只支持 linear
      api_key: string           — MUST: tracker API key
      team_id: string           — MUST（Linear specific）
      active_states: string[]   — 触发 agent 的 Issue 状态列表
    agent:
      model: string             — AI 模型标识
      max_concurrent_agents: int — 最大并发 Agent 数
      max_turns: int            — 单个 Agent 最大对话轮数
      max_retries: int          — 最大重试次数
    polling:
      interval_ms: int          — 轮询间隔（毫秒）
    workspace:
      root: string              — Workspace 根目录路径
  promptTemplate: string        — WORKFLOW.md body 部分（Mustache 模板）
```

### Orchestrator 行为规范

**MUST**：
- 以固定频率轮询 tracker 获取活跃 Issue
- 为每个活跃 Issue 创建独立 workspace（全新 git clone，不使用 worktree）
- 并发运行 Agent 数不超过 `max_concurrent_agents`
- Issue 进入终止状态后停止对应 Agent
- Agent 失败后按指数退避重试，直到 `max_retries`
- WORKFLOW.md 变更后在下一 tick 应用新配置，无需重启
- 如果 WORKFLOW.md 重载失败，保留上一个有效配置继续运行

**SHOULD**：
- 提供实时状态可视化
- 记录所有 Agent 事件（tool calls、token 使用等）
- 进程重启后能从持久化存储恢复状态

**MAY**：
- 支持多个 tracker（GitHub Issues、Jira 等）
- 提供 CLI 接口
- 提供移动端界面

### linear_graphql 动态工具规范

**MUST**：
- 工具名称精确为 `linear_graphql`
- 接受 `query: string` 和可选的 `variables: object` 参数
- 拒绝包含多个操作的 GraphQL 文档
- 使用配置中的 `tracker.api_key` 进行认证，不要求 Agent 自行管理认证

**禁止**：
- 直接将 Linear API key 暴露给 Agent
- 允许执行订阅类型（subscription）的 GraphQL 操作（只允许 query 和 mutation）

### Workspace 安全规范

**MUST**：
- 验证 workspace 路径不逃逸配置的根目录（path traversal 防护）
- 每个 Issue 使用独立的 workspace 目录
- Agent 完成或终止后清理 workspace

**SHOULD**：
- workspace 目录名基于 Issue ID，保证唯一性
- 记录 workspace 的创建和清理事件

### 终止状态定义

以下 tracker 状态被视为终止状态，Agent 应停止运行：
- Done
- Closed  
- Cancelled
- Duplicate
- （可通过 WORKFLOW.md 配置扩展）

---

> 完整规格请参阅：https://github.com/openai/symphony/blob/main/SPEC.md
