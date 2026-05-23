# Design: bootstrap-tauri-shell

## D1. 单 change 范围 = "能开窗"，不是"能跑业务"

切片原则：**最小可验证 + calcifer 主流程能端到端跑**。范围严格限制为：

- `pnpm install` 不报错
- `pnpm typecheck` 全绿
- `cargo check`（在 `apps/desktop/src-tauri/`）通过
- `pnpm tauri dev` 能开窗（人工验证；非 AC 必须，AC 用前 3 项）

**不做**业务实现；本 change 的价值是"calcifer 跑通一遍 maestro 端到端"，maestro 的功能性切片留给后续 change（`add-linear-issue-list` / `add-agent-runner-skeleton` 等）。

## D2. 严格遵循 references，但不全量实现

[`docs/references/`](../../docs/references/) 描述完整目标态（apps/desktop + apps/mobile + apps/cli + packages/{core,ui,db}）。本 change 只创建 **`apps/desktop/`** 一个目录，其余先不建（避免空目录污染、避免 typecheck 跑无效空包）。

**目录命名严格对齐** [`02-MONOREPO-SETUP.md`](../../docs/references/docs/02-MONOREPO-SETUP.md)：未来 slice 加 `apps/mobile/` 时不需重命名。

## D3. Tauri v2 而非 v1

references 明确 v2.11.x。v2 是当前稳定版，权限模型（capabilities/）是 v2 独有，v1 已 EOL。无折中空间。

## D4. shadcn/ui 安装但只放 Button —— 为什么

calcifer 项目级约束（`.github/copilot-instructions.md`）"shadcn/ui mandatory in React surfaces"。本 change 装好 shadcn/ui CLI + tailwind config，放一个 `<Button>` 在首页作为 smoke test：证明 shadcn 装对、tailwind 工作、组件可渲染。一次性把 React 工程基础打齐，后续 slice 直接 `pnpm dlx shadcn add <comp>`。

## D5. 架构北极星：codex SDK + 多 LLM provider + MiniMax 首发

写进 `docs/architecture/vision.md`，作为 maestro 的 vision charter（不可变 normative 文档）。要点：

| 项 | 决策 | 原因 |
|---|---|---|
| Agent runtime 抽象 | **AppServer Protocol**（per [SPEC.md](../../docs/references/SPEC.md)） | references 已定，与具体 LLM 解耦 |
| 优先 OSS 核心运行时 | **codex SDK**（OpenAI 开源，Apache 2.0） | 自托管、无 vendor lock、可定制 |
| LLM provider 抽象 | **必选多 provider，配置驱动** | 单一 vendor 不可接受（成本 / 合规 / 可用性） |
| 首发 provider | **MiniMax（OpenAI-compatible interface）** | 国内可用、价格、兼容 OpenAI SDK 即插即用 |
| 后续 provider | OpenAI / Anthropic / 自建 vLLM 等 | 实现 provider plugin 接口即可 |

**本 change 不实现**任何上述内容；vision.md 是契约性文档，约束未来 `add-agent-runner-skeleton` 等 change 必须遵守。

## D6. AC 限定在工程基础，不跑 `pnpm tauri build`

`pnpm tauri build` 在 macOS 首次需 5-15 分钟（编译 webkit2gtk 链路），作为 PR 门禁太重；且 calcifer self-incubation-loop 跑 AC 在容器内，没有 GUI 上下文，`tauri build` 大概率因 system deps 缺失失败。

AC 用 `cargo check`（不链接、不打包，约 30s 首次）+ `pnpm typecheck`（约 5s）。`pnpm tauri dev` 留给开发者本机人工验收，不进 AC。

未来加 GitHub Actions CI 时再决定要不要 `tauri build`（彼时另开 change）。

## D7. .env 与 secrets

本 change **不**引入任何 env / secrets（无 Linear / Supabase / LLM）。`.env.example` 留空文件，避免后续 slice 加字段时遗漏 example。`.gitignore` 已含 `.env*`。

## D8. 为什么不在本 change 起 GitHub Actions

CI 启动需 (a) 决定 runner 类型（GitHub-hosted vs self-hosted）、(b) 处理 Tauri 的系统依赖（Linux 上需 `libwebkit2gtk`）、(c) 决定矩阵（Linux/macOS/Windows）。这些决策本身值得一个独立 change，且与"calcifer 主流程跑通"的核心目标无关。calcifer 的 review-agent + AC 已经在 PR 上做检查，CI 缺位短期可接受。

## Risks

| ID | 风险 | 缓解 |
|---|---|---|
| R1 | Tauri v2 在 macOS arm64 + Node 24 组合上报怪错 | tasks.md 1.2 明确 Node 版本（≥20，给定上限）；首跑前 `tauri --version` 确认 |
| R2 | shadcn CLI 写入 components.json 路径与 references 的 `apps/desktop/src/components/` 不一致 | tasks.md 4.4 明确 `--cwd apps/desktop` |
| R3 | calcifer self-incubation-loop 跑 AC 时 cargo 没装 → AC 失败 | tasks.md 0.1 改 coding-runner 容器，安装 rust toolchain；本 change 不解决（依赖 calcifer 仓内并行 issue） |
| R4 | vision.md 的 codex SDK + MiniMax 决策与未来发现冲突 | vision 标 `version: 1`，发现冲突时另开 change 升 version；本次不锁死实现 |

## Open Questions

- **OQ1**：`apps/desktop/src-tauri/tauri.conf.json` 的 `identifier` 用 `com.fushenguang.maestro` 还是 `ai.maestro`？暂用前者（个人开发态，简单）。
- **OQ2**：是否锁定 Tauri v2 的 minor 版本（`2.11.0` 而非 `^2.11.0`）？为可重现性，**锁死**（写进 tasks.md）。
- **OQ3**：root `package.json` 的 `name` 用 `maestro` 还是 `@maestro/root`？用 `maestro`（无 scope，单仓项目）。
