# Design: improve-dev-environment

## AGENTS.md 架构

三层 AGENTS.md 体系，每层解决不同问题：

```
根 AGENTS.md
  └─ 产品级导航：这是什么产品？从哪里开始？
     → openspec/specs/product.md（产品边界权威）
     → docs/references/mvp/（UI/数据/交互规格）
     → openspec/AGENTS.md（如何创建和执行 change）
     → docs/architecture/vision.md（架构愿景）

openspec/AGENTS.md
  └─ 开发流程导航：如何在这个 repo 开发？
     → change 目录结构说明
     → 如何创建 proposal / design / tasks
     → specs/ 目录的作用
     → 注意事项（不要修改 archive/，先读 product.md）

apps/desktop/AGENTS.md
  └─ 桌面应用导航：如何开发这个 Tauri 应用？
     → 目录结构（src/, src-tauri/）
     → Tauri 命令开发规范
     → shadcn/ui 使用约定
     → 本地开发启动方式
```

## `packages/types` 设计

### 包结构

```
packages/types/
  package.json       @maestro/types
  tsconfig.json
  src/
    index.ts         re-export all
    models/
      profile.ts
      idea.ts
      intent-canvas.ts
      scope-item.ts
      validation.ts
      contract.ts
      evolution.ts
    enums/
      status.ts      IdeaStatus, PhaseStatus, ProductType
      metrics.ts     SuccessMetric
    ui/
      product-row.ts ProductRow（dashboard 展示用）
```

### 类型来源

所有类型直接对应 `docs/references/mvp/maestro-data-spec.md` 的数据模型。TypeScript 接口字段名用 camelCase，与 DB snake_case 列名通过 Rust 命令层转换。

### 依赖关系

```
@maestro/types（无依赖）
      ↑
@maestro/desktop（依赖 @maestro/types 的类型定义）
```

`@maestro/desktop` 的 `package.json` 添加：`"@maestro/types": "workspace:*"`

## Turborepo `inputs` 设计

精确的 `inputs` 让 Turborepo 只在真正相关文件变化时重新运行任务：

```json
"build": {
  "inputs": ["src/**", "package.json", "tsconfig.json", "vite.config.*"],
  "dependsOn": ["^build"],
  "outputs": ["dist/**"]
},
"typecheck": {
  "inputs": ["src/**", "tsconfig.json", "package.json"],
  "dependsOn": ["^typecheck"],
  "outputs": []
},
"test": {
  "inputs": ["src/**", "*.test.*", "vitest.config.*"],
  "dependsOn": ["^build"],
  "outputs": []
}
```

## `.env.example` 内容规范

只记录变量名 + 说明注释，不放任何真实值：

```
# Supabase (remote sync target)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=

# GitHub OAuth App (for login)
# Create at: https://github.com/settings/developers
VITE_GITHUB_CLIENT_ID=
```
