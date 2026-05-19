# 10-MOBILE-APP.md — iOS + Android（Expo React Native）

> **应用位置**：`apps/mobile/`
> **技术**：Expo SDK 54 + Expo Router v4 + NativeWind v5（Tailwind CSS v4）

---

## 1. 应用结构

```
apps/mobile/
├── app.json
├── package.json
├── app/                           ← Expo Router（文件路由）
│   ├── _layout.tsx                ← Root layout（Tabs 导航）
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx              ← Dashboard tab
│   │   ├── issues.tsx             ← Issues tab
│   │   └── settings.tsx           ← Settings tab
│   └── issues/
│       └── [id].tsx               ← Issue 详情页
├── components/                    ← 移动端专属组件
└── metro.config.js                ← Metro bundler（monorepo 配置）
```

---

## 2. Metro monorepo 配置

```javascript
// apps/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// monorepo 支持（Expo SDK 54 自动检测）
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
```

---

## 3. 核心 Hook（复用桌面端逻辑）

移动端使用相同的 `@symphony/db` Supabase Realtime hook，UI 层使用 NativeWind：

```typescript
// apps/mobile/app/(tabs)/index.tsx
import { useRealtimeIssues } from '@symphony/db/hooks'; // 共享 hook
import { View, Text, FlatList } from 'react-native';

export default function DashboardTab() {
  const issues = useRealtimeIssues();
  const runningIssues = issues.filter((i) => i.runStatus === 'running');

  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-xl font-bold text-foreground mb-4">
        Running Agents ({runningIssues.length})
      </Text>
      <FlatList
        data={runningIssues}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="bg-card rounded-lg p-4 mb-3 border border-border">
            <Text className="font-medium text-card-foreground">{item.title}</Text>
            <Text className="text-sm text-muted-foreground mt-1">{item.trackerStatus}</Text>
          </View>
        )}
      />
    </View>
  );
}
```

---

## 4. 移动端限制说明

移动端**不运行** Orchestrator 核心，仅作为**只读监控界面**：
- 查看 Issue 运行状态（Supabase Realtime）
- 查看 Agent 会话日志
- 接收推送通知（Agent 完成/失败）

Orchestrator 始终运行在桌面应用（或服务器）上。

---

# 11-AI-SDK-INTEGRATION.md — Vercel AI SDK v6 集成

> **包位置**：`packages/ai/`
> **版本**：AI SDK v6（2025 年 12 月发布，当前最新稳定版）

---

## 1. AI SDK v6 关键变更（相对于 v5）

| 特性 | v5 | v6 |
|---|---|---|
| Agent loop | 手动实现 while 循环 | 内置 `Agent` 类 |
| MCP 支持 | 实验性 | 完整支持 |
| 工具审批 | 不支持 | `toolExecutionApproval` |
| DevTools | 无 | 内置调试面板 |
| 消息类型 | UIMessage / ModelMessage 分离 | 沿用 v5 |

---

## 2. Provider 配置

```typescript
// packages/ai/src/providers.ts

import { anthropic } from '@ai-sdk/anthropic';
import { createAnthropic } from '@ai-sdk/anthropic';

// 主模型：Claude Sonnet 4.6（编码任务）
export const codingModel = anthropic('claude-sonnet-4-6');

// 可选：更轻量的模型用于分类/路由
export const lightModel = anthropic('claude-haiku-4-5-20251001');

// 工厂函数（允许注入测试 mock）
export function createCodingModel(apiKey?: string) {
  if (apiKey) {
    return createAnthropic({ apiKey })('claude-sonnet-4-6');
  }
  return codingModel;
}
```

---

## 3. Agent Loop 实现（AI SDK v6 风格）

```typescript
// packages/ai/src/agent.ts

import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export async function runCodingAgent(options: {
  prompt: string;
  workspacePath: string;
  tools: Record<string, any>;
  maxTurns: number;
  signal?: AbortSignal;
  onStep?: (step: StepResult) => void;
}) {
  // AI SDK v6 的 generateText 支持 maxSteps（自动 agent loop）
  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    prompt: options.prompt,
    tools: {
      linear_graphql: tool({
        description: 'Execute GraphQL queries against Linear',
        parameters: z.object({
          query: z.string(),
          variables: z.record(z.unknown()).optional(),
        }),
        execute: async ({ query, variables }) => {
          return options.tools.linear_graphql({ query, variables });
        },
      }),
      // 文件系统工具（受 workspacePath 约束）
      read_file: tool({
        description: 'Read a file from the workspace',
        parameters: z.object({ path: z.string() }),
        execute: async ({ path: filePath }) => {
          const { readFile } = await import('node:fs/promises');
          const fullPath = require('path').join(options.workspacePath, filePath);
          return readFile(fullPath, 'utf-8');
        },
      }),
      run_command: tool({
        description: 'Run a shell command in the workspace directory',
        parameters: z.object({
          command: z.string(),
          args: z.array(z.string()).default([]),
        }),
        execute: async ({ command, args }) => {
          const { execa } = await import('execa');
          const result = await execa(command, args, {
            cwd: options.workspacePath,
            timeout: 60_000,
          });
          return { stdout: result.stdout, stderr: result.stderr };
        },
      }),
    },
    maxSteps: options.maxTurns, // AI SDK v6: maxSteps 控制 agent loop
    abortSignal: options.signal,
    onStepFinish: (step) => {
      options.onStep?.(step);
    },
  });

  return result;
}
```

---

## 4. Prompt 管理

```typescript
// packages/ai/src/prompts/coding-agent.ts

export const SYSTEM_PROMPT = `
You are an expert software engineer with deep knowledge of the codebase you're working in.

## Your Capabilities
- Read and write files in your workspace directory
- Run shell commands (tests, linters, build tools)
- Update Linear issue status via the linear_graphql tool
- Create git commits and pull requests

## Rules
1. Always read the existing code before modifying it
2. Run tests after making changes: if tests fail, fix them
3. Commit changes with clear, descriptive messages
4. Update the Linear issue with progress using linear_graphql
5. When your task is complete, move the issue to the appropriate handoff state

## Boundaries
- Only modify files within your workspace directory
- Do not read files outside the workspace
- Do not make network requests other than via provided tools
`.trim();
```

---

# 12-UI-COMPONENTS.md — 共享 UI 组件库

> **包位置**：`packages/ui/`
> **依赖**：shadcn/ui + Tailwind CSS v4 + Radix UI

---

## 1. shadcn/ui 集成方式

在 monorepo 中，shadcn/ui 组件安装在 `packages/ui`，所有 app 共享：

```bash
# 在 packages/ui 中添加组件
pnpm --filter @symphony/ui dlx shadcn@latest add button
pnpm --filter @symphony/ui dlx shadcn@latest add card
pnpm --filter @symphony/ui dlx shadcn@latest add badge
pnpm --filter @symphony/ui dlx shadcn@latest add dialog
pnpm --filter @symphony/ui dlx shadcn@latest add scroll-area
pnpm --filter @symphony/ui dlx shadcn@latest add separator
pnpm --filter @symphony/ui dlx shadcn@latest add tabs
pnpm --filter @symphony/ui dlx shadcn@latest add tooltip
```

---

## 2. Symphony 专属组件

```typescript
// packages/ui/src/components/IssueCard.tsx

import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader } from './ui/card';
import type { Issue } from '@symphony/db';

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  succeeded: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  retrying: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  idle: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export function IssueCard({ issue }: { issue: Issue }) {
  return (
    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            {(issue.metadata as any)?.identifier ?? issue.id}
          </span>
          <Badge variant="outline" className={STATUS_COLORS[issue.runStatus]}>
            {issue.runStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium leading-snug">{issue.title}</p>
        {issue.runStatus === 'running' && (
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-1/2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

```typescript
// packages/ui/src/components/MetricsBar.tsx

import { Activity, CheckCircle, AlertCircle, Cpu } from 'lucide-react';

export function MetricsBar(props: {
  isRunning: boolean;
  runningAgents: number;
  totalDispatched: number;
}) {
  return (
    <div className="flex items-center gap-6 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${props.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-sm text-muted-foreground">
          {props.isRunning ? 'Orchestrator running' : 'Stopped'}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <Cpu className="w-4 h-4 text-blue-500" />
        <span className="font-medium">{props.runningAgents}</span>
        <span className="text-muted-foreground">active agents</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">{props.totalDispatched}</span>
        <span className="text-muted-foreground">total dispatched</span>
      </div>
    </div>
  );
}
```

---

# 13-DASHBOARD.md — 实时 Dashboard

Dashboard 数据流说明（无单独实现，集成在 09 和 12 中）：

```
Orchestrator (Node.js) → Supabase DB
                              ↓
                     Supabase Realtime (WebSocket)
                              ↓
                    React UI (useRealtimeIssues hook)
                              ↓
                    IssueCard / MetricsBar 更新
```

**关键设计**：UI 是完全被动的（passive consumer），不轮询 Orchestrator，只订阅 DB 变更。这使得 UI 可以独立于 Orchestrator 重启。

---

# 14-CLI-SPEC.md — CLI 应用规格（代码实现待后续）

> **状态**：规格文档阶段，不实现代码
> **位置**：`apps/cli/`

---

## CLI 功能规格

```
symphony-cli [command] [options]

Commands:
  start              启动 Orchestrator（后台守护进程）
  stop               停止 Orchestrator
  status             显示当前运行状态
  issues             列出所有 Issue 及其状态
  issue <id>         显示单个 Issue 详情
  logs [--follow]    查看 Agent 日志
  workflow [edit]    查看/编辑 WORKFLOW.md
  config             显示当前配置

Options:
  --json             以 JSON 格式输出（面向 AI Agent 消费）
  --no-color         禁用颜色输出
  --log-level        日志级别 (debug|info|warn|error)
  --config           指定 WORKFLOW.md 路径

# AI Agent 友好模式（--json flag）
symphony-cli status --json
# 输出：
{
  "isRunning": true,
  "runningAgents": 3,
  "totalDispatched": 42,
  "issues": [...]
}
```

## 技术选型（待实现时参考）

- **框架**：`commander.js` v12（稳定、TypeScript 支持好）
- **交互**：`inquirer.js` v10（prompts）+ `ora` v8（spinner）
- **输出格式化**：`chalk` v5（颜色）+ `cli-table3`（表格）
- **与 Orchestrator 通信**：通过 Supabase DB 读状态（CLI 是只读）；控制命令通过 HTTP 发到 Orchestrator 的本地服务端口

## 面向 AI Agent 的设计原则

1. **所有命令支持 `--json`** 输出，结构稳定，适合 AI 解析
2. **退出码语义明确**：0=成功, 1=错误, 2=未找到, 3=未运行
3. **所有错误输出到 stderr**，正常输出到 stdout（便于管道）
4. **无交互依赖**：在 `--json` 模式下永远不要求用户输入
