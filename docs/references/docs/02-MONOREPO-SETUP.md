# 02-MONOREPO-SETUP.md — Monorepo 结构与开发环境

---

## 1. 目录结构（完整）

```
symphony-ts/
├── AGENTS.md                        ← AI Agent 入口（必读）
├── SPEC.md                          ← openai/symphony 规格（只读参考）
├── WORKFLOW.md                      ← 工作流配置（运行时读取）
│
├── apps/
│   ├── desktop/                     ← Tauri v2 桌面应用（主应用，优先）
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── src/                     ← React 前端
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── routes/              ← 路由（TanStack Router）
│   │   │   ├── components/          ← 应用专属组件
│   │   │   ├── hooks/               ← 应用专属 hooks
│   │   │   └── stores/              ← Zustand 状态管理
│   │   └── src-tauri/               ← Rust 后端
│   │       ├── Cargo.toml
│   │       ├── tauri.conf.json
│   │       ├── capabilities/        ← Tauri v2 权限配置
│   │       └── src/
│   │           ├── main.rs
│   │           ├── lib.rs
│   │           └── commands/        ← Tauri IPC commands
│   │
│   ├── mobile/                      ← Expo React Native（iOS + Android）
│   │   ├── package.json
│   │   ├── app.json
│   │   ├── app/                     ← Expo Router (file-based)
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx        ← Dashboard tab
│   │   │   │   ├── issues.tsx       ← Issues tab
│   │   │   │   └── settings.tsx     ← Settings tab
│   │   │   └── _layout.tsx
│   │   └── components/              ← 移动端专属组件
│   │
│   └── cli/                         ← CLI 应用（规格阶段，代码待实现）
│       ├── package.json
│       └── README.md                ← 指向 docs/14-CLI-SPEC.md
│
├── packages/
│   ├── core/                        ← Symphony 核心逻辑（平台无关）
│   │   ├── package.json
│   │   └── src/
│   │       ├── orchestrator/        ← 调度状态机
│   │       ├── runner/              ← AgentRunner + AppServerClient
│   │       ├── workspace/           ← Workspace 生命周期
│   │       ├── tracker/             ← TrackerPort + LinearAdapter
│   │       ├── workflow/            ← WORKFLOW.md 解析 + 热加载
│   │       └── index.ts
│   │
│   ├── ui/                          ← 共享 UI 组件库
│   │   ├── package.json
│   │   └── src/
│   │       ├── components/          ← shadcn/ui 封装 + 自定义组件
│   │       ├── hooks/               ← 通用 hooks
│   │       └── index.ts
│   │
│   ├── db/                          ← Supabase + Drizzle
│   │   ├── package.json
│   │   └── src/
│   │       ├── schema/              ← Drizzle schema 定义
│   │       ├── migrations/          ← SQL 迁移文件
│   │       ├── client.ts            ← Supabase client 工厂
│   │       └── queries/             ← 类型化查询函数
│   │
│   ├── ai/                          ← AI SDK 封装
│   │   ├── package.json
│   │   └── src/
│   │       ├── providers.ts         ← AI provider 配置
│   │       ├── prompts/             ← Prompt 模板
│   │       └── tools/               ← AI 工具定义
│   │
│   ├── tracker/                     ← Issue Tracker 适配器
│   │   ├── package.json
│   │   └── src/
│   │       ├── port.ts              ← TrackerPort interface
│   │       ├── linear/              ← Linear 实现
│   │       └── memory/              ← 内存实现（测试用）
│   │
│   └── config/                      ← 共享配置
│       ├── eslint/
│       ├── typescript/
│       └── prettier/
│
├── turbo.json                       ← Turborepo 任务配置
├── pnpm-workspace.yaml
├── package.json                     ← 根 package.json
├── .env.example                     ← 环境变量模板
└── tsconfig.base.json               ← 基础 TypeScript 配置
```

---

## 2. 关键配置文件

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "out/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "tauri": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

### `tsconfig.base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### 根 `package.json`

```json
{
  "name": "symphony-ts",
  "private": true,
  "packageManager": "pnpm@9.x",
  "scripts": {
    "dev": "turbo run dev",
    "dev:desktop": "turbo run dev --filter=desktop",
    "dev:mobile": "turbo run dev --filter=mobile",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:generate": "turbo run db:generate --filter=@symphony/db",
    "db:migrate": "turbo run db:migrate --filter=@symphony/db",
    "tauri": "turbo run tauri --filter=desktop"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.5.0"
  }
}
```

---

## 3. 包命名规范

所有内部包使用 `@symphony/` 命名空间：

| 包目录 | package.json name | 导入方式 |
|---|---|---|
| `packages/core` | `@symphony/core` | `import { Orchestrator } from '@symphony/core'` |
| `packages/ui` | `@symphony/ui` | `import { Button } from '@symphony/ui'` |
| `packages/db` | `@symphony/db` | `import { db } from '@symphony/db'` |
| `packages/ai` | `@symphony/ai` | `import { createAgent } from '@symphony/ai'` |
| `packages/tracker` | `@symphony/tracker` | `import { LinearTracker } from '@symphony/tracker'` |
| `packages/config` | `@symphony/config` | (仅配置文件，不导入代码) |

---

## 4. 环境变量

`.env.example`（所有应用共享根目录 `.env`）：

```bash
# Supabase（自部署）
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Linear
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_ID=your-team-id

# Symphony Core
SYMPHONY_WORKSPACE_ROOT=/tmp/symphony-workspaces
SYMPHONY_MAX_CONCURRENT_AGENTS=5
SYMPHONY_POLL_INTERVAL_MS=30000

# Tauri（桌面专用，在 tauri.conf.json 中引用）
TAURI_PRIVATE_KEY=...
TAURI_KEY_PASSWORD=...
```

**规则**：
- 所有包通过 `process.env` 访问环境变量
- 敏感 key 绝不提交到 git（`.env` 在 `.gitignore` 中）
- 每个包可以有自己的 `.env.local` 覆盖

---

## 5. 开发环境前置要求

```bash
# Rust（Tauri 必须）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add aarch64-apple-ios x86_64-apple-ios  # iOS
rustup target add aarch64-linux-android               # Android

# Node.js 22 LTS
nvm install 22 && nvm use 22

# pnpm
npm install -g pnpm@9

# Tauri CLI
cargo install tauri-cli

# iOS（macOS only）
xcode-select --install

# Android
# 安装 Android Studio，配置 ANDROID_HOME 环境变量

# Supabase CLI（自部署）
brew install supabase/tap/supabase
```

---

## 6. 第一次运行

```bash
# 1. 克隆并安装依赖
git clone <repo>
cd symphony-ts
pnpm install

# 2. 启动 Supabase（本地自部署）
supabase start

# 3. 运行数据库迁移
pnpm db:migrate

# 4. 复制并填写环境变量
cp .env.example .env
# 编辑 .env 填入 API keys

# 5. 启动桌面应用开发模式
pnpm dev:desktop

# 6. 启动移动端开发模式（另一个终端）
pnpm dev:mobile
```

---

## 7. 包间依赖关系

```
apps/desktop ──depends──▶ packages/core
                         ▶ packages/ui
                         ▶ packages/db
                         ▶ packages/ai

apps/mobile  ──depends──▶ packages/ui
                         ▶ packages/db
                         ▶ packages/ai

packages/core ─depends──▶ packages/db
                         ▶ packages/ai
                         ▶ packages/tracker

packages/tracker ─dep───▶ (无内部依赖)

packages/ui ──depends───▶ (无内部依赖，只有 shadcn/ui 外部依赖)

packages/db ──depends───▶ (无内部依赖)

packages/ai ──depends───▶ (无内部依赖，只有 AI SDK 外部依赖)
```

**规则**：禁止循环依赖。`packages/*` 之间只允许单向依赖。

---

## 8. Turborepo 任务执行顺序

```
typecheck
  └── 并行: packages/config, packages/db, packages/ai, packages/tracker, packages/ui
  └── 串行（依赖前置包）: packages/core
  └── 串行（依赖 core）: apps/desktop, apps/mobile

build（同上结构）

test
  └── 依赖: build 完成后执行
```
