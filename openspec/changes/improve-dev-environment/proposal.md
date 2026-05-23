# improve-dev-environment

## Why

当前工程环境存在几个问题，会直接导致 AI Agent 产生错误的实现决策：

1. **根目录 `AGENTS.md` 描述的是旧的 Symphony/Linear orchestrator 产品**，与当前 Maestro 产品方向完全不符。AI Agent 读到的第一份文档就是错的。

2. **`openspec/AGENTS.md` 不存在**，但根 `AGENTS.md` 里引用了它。引用悬空。

3. **`docs/references/AGENTS.md` 指向 18 个旧 Symphony 文档**，这些文档描述的是 Linear 集成、Orchestrator、AgentRunner 等当前不实现的内容。

4. **`packages/` 目录不存在**，Turborepo 的 workspace 声明了 `packages/*` 但没有实际内容。共享类型（如数据模型）缺乏归宿。

5. **`turbo.json` 缺少 `test` 任务和 `inputs` 字段**，缓存行为不够精确。

6. **`apps/desktop` 没有 `.env.example`**，新 contributor 不知道需要哪些环境变量。

## What Changes

### 1. AGENTS.md 体系重建

- **根 `AGENTS.md`**：重写，指向正确的产品文档入口（`openspec/specs/product.md`、`docs/references/mvp/`、`docs/architecture/vision.md`）
- **`openspec/AGENTS.md`**：新建，说明 openspec 目录结构和 change 工作流
- **`apps/desktop/AGENTS.md`**：新建，说明桌面应用的技术栈、目录结构、Tauri 开发注意事项

### 2. `packages/types` 共享类型包

新建 `packages/types/`，包含：
- 从 `docs/references/mvp/maestro-data-spec.md` 提取的核心 TypeScript 类型定义
- `Idea`、`Profile`、`IntentCanvas`、`ScopeItem`、`ValidationReport`、`Contract` 等接口
- Phase 枚举、Status 枚举、SuccessMetric 枚举
- `@maestro/desktop` 依赖 `@maestro/types`

### 3. Turborepo 优化

- `turbo.json` 添加 `test` 任务（dependsOn `^build`，outputs `[]`）
- 为 `build`、`typecheck` 任务添加 `inputs` 字段（精确文件匹配，提升缓存命中率）
- 根 `package.json` 添加 `test` script

### 4. `apps/desktop/.env.example`

记录所有需要的环境变量：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GITHUB_CLIENT_ID`

### 5. `README.md` 更新

重写根 README，当前只有一行 Symphony 描述，改为 Maestro 产品正确描述 + 快速开发启动指引。

## Impact

- **新增**：`packages/types/`、`openspec/AGENTS.md`、`apps/desktop/AGENTS.md`、`apps/desktop/.env.example`
- **修改**：根 `AGENTS.md`、`turbo.json`、根 `package.json`、`README.md`
- **不改动**：所有功能代码、`apps/desktop/src/`、Rust 代码、Supabase schema

## Out of scope（显式不做）

- 实际功能实现（数据层、UI phase 等）
- ESLint / Prettier / Biome 配置（可单独 change）
- CI/CD 配置（可单独 change）
- `docs/references/` 内旧 Symphony 文档的清理或归档
