# Bootstrap Tauri shell + monorepo skeleton

## Why

[maestro README](../../../README.md) 当前只有一句话："Autonomous coding agent orchestrator. From Linear issue to merged PR, fully automated."。仓内除 [`docs/references/`](../../../docs/references/)（fork 自 openai/symphony，只读）外没有任何代码或工程基础设施。

[`docs/references/SPEC.md`](../../../docs/references/SPEC.md)、[`02-MONOREPO-SETUP.md`](../../../docs/references/docs/02-MONOREPO-SETUP.md)、[`09-TAURI-DESKTOP.md`](../../../docs/references/docs/09-TAURI-DESKTOP.md) 已定义完整目标架构（apps/desktop + apps/mobile + apps/cli + packages/{core,ui,db}），但是个**完成态**——直接照搬实现量太大、风险太高，且 calcifer 主流程从未在外部项目跑过。

第一刀做最小可验证切片：**只起一个能开窗的 Tauri 桌面壳子 + pnpm 工作区骨架**。目标：

- 验证 maestro 仓的工程基础（pnpm install / pnpm typecheck / cargo check 能跑通）
- 给 calcifer 主流程一个真实外部项目去端到端走一遍（issue → coding-runner → PR → review-agent → merge → AC → 飞书）
- **明确架构北极星**（在 design.md 写死）：codex SDK + 多 LLM provider + MiniMax 首发；本 change 不实现，但写进 vision 约束未来 slice

## What Changes

**单 change 覆盖三件事**（按 calcifer "不开过多 changes" 指令）：

1. **monorepo 骨架**
   - `package.json`（root，pnpm workspaces + turbo）
   - `pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`
   - `.gitignore` 扩展（node_modules、dist、target、`.env*`）
   - 严格遵守 [`02-MONOREPO-SETUP.md`](../../../docs/references/docs/02-MONOREPO-SETUP.md) 的目录命名

2. **Tauri 桌面最小壳子**（仅 `apps/desktop/`，不动 mobile/cli/packages）
   - Tauri v2.11.x + React 19 + Vite 5
   - 单窗口，标题 "Maestro"，body 显示一行 "Maestro Desktop — Bootstrap"
   - shadcn/ui 安装但仅放置 Button 一个组件做 smoke test
   - TanStack Router 留 placeholder（仅 `__root.tsx` + `index.tsx`）
   - **不**接 Linear / Supabase / LLM / Orchestrator —— 后续 slice 处理

3. **vision charter（架构意图记录）**
   - `docs/architecture/vision.md`：写明 codex SDK 优先（OSS）、AppServer Protocol 抽象、多 LLM provider 必选、MiniMax（OpenAI-compatible）首发支持
   - `AGENTS.md`（仓根）：给后续 AI agent / coding-runner 看的入口，指向 references + openspec

## Impact

- **新增 capability**：`desktop-shell`（首个 capability，定义 Tauri 壳子的最小契约）
- **影响目录**：
  - 新建 `apps/desktop/`、`docs/architecture/`、`openspec/{config.yaml,AGENTS.md,changes/,specs/}`、根目录工程文件
- **依赖**：Node ≥ 20、Rust toolchain（cargo + tauri-cli）、pnpm ≥ 9
- **CI**：本 change 暂不开 GitHub Actions（避免 scope 蔓延）；AC 由 calcifer 的 self-incubation-loop 在 PR 合并后跑（calcifer 已具备 AC 解析能力）

## Out of scope（显式不做）

- Linear API 接入
- Supabase 接入
- AgentRunner / Orchestrator 任何实现
- LLM provider 实现（仅在 vision.md 写架构意图）
- mobile / cli apps
- packages/core / packages/ui / packages/db
- GitHub Actions CI
- 应用打包（`tauri build` 只要求 dev 跑得起来 + `cargo check` 过；不做 release artifact）
