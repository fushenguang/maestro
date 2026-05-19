---
# Symphony WORKFLOW.md — 工作流配置
# 修改此文件后，Orchestrator 会在下一次 tick 自动热加载，无需重启

tracker:
  type: linear
  api_key: ${LINEAR_API_KEY}
  team_id: ${LINEAR_TEAM_ID}
  # 触发 Agent 的 Issue 状态
  active_states:
    - Todo
    - In Progress
  # 终止状态（进入这些状态后 Agent 停止）
  terminal_states:
    - Done
    - Cancelled
    - Duplicate

agent:
  model: claude-sonnet-4-6
  max_concurrent_agents: 5
  max_turns: 30
  max_retries: 3

polling:
  interval_ms: 30000

workspace:
  root: ${SYMPHONY_WORKSPACE_ROOT}
  repo_url: ${SYMPHONY_REPO_URL}
---

You are an expert software engineer. Your task is to implement the following Linear issue.

## Issue Information

**Identifier**: {{issue.metadata.identifier}}
**Title**: {{issue.title}}
**Status**: {{issue.trackerStatus}}

## Description

{{issue.description}}

## Workspace

Your working directory is: `{{workspacePath}}`

This is a fresh git clone of the repository. All your changes will be contained here.

## Instructions

Follow these steps carefully:

1. **Understand the codebase**: Start by reading relevant files to understand the existing patterns.
   - Read `README.md` and `AGENTS.md` if they exist
   - Explore the relevant source directories

2. **Plan your implementation**: Think through the changes needed before writing code.

3. **Implement the changes**: Write clean, well-typed TypeScript code.
   - Follow the existing code style and patterns
   - Add appropriate types (no `any`)
   - Write JSDoc comments for public APIs

4. **Write or update tests**: If the codebase has tests, add tests for your changes.
   ```bash
   pnpm test
   ```

5. **Verify the build passes**:
   ```bash
   pnpm build
   pnpm typecheck
   pnpm lint
   ```

6. **Commit your changes**:
   ```bash
   git add -A
   git commit -m "feat: <brief description of change>"
   ```

7. **Update the Linear issue**: Use the `linear_graphql` tool to:
   - Add a comment summarizing what you implemented
   - Move the issue to "In Review" or the appropriate handoff state

## Available Tools

- **linear_graphql**: Query and mutate Linear via GraphQL
  ```
  # Example: Add a comment to the issue
  mutation {
    commentCreate(input: {
      issueId: "{{issue.id}}"
      body: "Implementation complete. Changes: ..."
    }) { success }
  }
  ```

- **File system tools**: Read and write files within your workspace
- **Shell commands**: Run build tools, tests, linters within your workspace

## Important Rules

- Only modify files within `{{workspacePath}}`
- Do not access secrets or environment variables beyond what's provided
- If you encounter an ambiguous requirement, make a reasonable assumption and document it in your commit message
- If the task is impossible (e.g., missing dependencies, unclear spec), use `linear_graphql` to add a comment explaining the blocker and leave the issue in its current state
