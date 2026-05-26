## Context

当前状态：
- 数据层完整（`mvp-data-layer` 已归档）：SQLite schema、Rust commands、TypeScript `db.*` bindings 均就绪
- 认证完整（`add-github-auth` + 邮箱登录已完成）：用户可通过 GitHub OAuth 或邮箱登录
- App Shell 缺失：登录后落地 `/` 是占位页，没有导航、没有真实数据展示
- `profiles` 表存在但 upsert 逻辑尚未接入认证流程（GitHub 用户信息未写入本地 DB）

本 change 目标：打通从"登录成功"到"看到自己产品列表"的完整路径，建立后续所有 Phase UI 的宿主结构。

## Goals / Non-Goals

**Goals:**
- 创建 App Shell（`AppShell` layout 组件）：Topbar + 内容区
- 实现 `/dashboard` 路由：Stats Bar + Product Registry Table + 空状态
- 登录后自动 upsert `profiles`（GitHub login/avatar/display_name）
- Phase Sidebar 骨架（`/ideas/:id/*` 路由下的侧边导航）
- 定义 Phase lock/unlock 逻辑（纯前端计算，不额外查 DB）

**Non-Goals:**
- Insights / Resources 页内容（tab 存在但空占位）
- Profile / Settings 页功能（仅展示头像、登出）
- 实时刷新（无 Supabase Realtime，本地 SQLite 刷新即可）
- 市场信号的实时 fetch（展示 `market_current_value` 快照即可）

## Decisions

### 1. 路由结构：Layout Route 承载 App Shell

**选择**：用 TanStack Router 的 layout route（pathless route）包裹所有认证后的页面。

```
__root
  ├── /login              ← 无 shell
  ├── /verify             ← 无 shell
  ├── /auth/callback      ← 无 shell
  └── _app (layout)       ← AppShell 渲染 <Outlet />
        ├── /dashboard    ← 主页
        └── /ideas/$id    ← Phase Shell（带侧边栏）
              ├── /feed
              ├── /intent
              └── ...
```

layout route 的 `beforeLoad` 统一做认证守卫，替换目前各路由散落的 session 检查。

**备选**：在 `__root.tsx` 里条件渲染 shell——被否，会让 root 组件膨胀且难以在不同页面定制 shell 结构。

### 2. App Shell 组件结构

```
AppShell
  └── div.flex.flex-col.min-h-screen
        ├── Topbar           ← 固定顶部，48px 高
        └── main.flex-1      ← <Outlet /> 内容区
```

`/ideas/$id` 路由额外套一层 layout，在内容区左侧增加 `PhaseSidebar`（168px 固定宽）。Topbar 在两种布局下共用。

### 3. Dashboard 数据获取：invoke Tauri command

**选择**：在 `dashboard.tsx` 挂载时调用 `db.ideas.list()` → 客户端聚合 stats。

理由：
- `db.ts` 已封装好 `list()` 接口（返回当前用户所有 ideas）
- Stats（total / in_market / deadline<30d / force_closed）均可从返回数组一次计算，无需额外 SQL
- 不引入 React Query / SWR，保持依赖最小

### 4. Profile Upsert 时机

**选择**：在 auth store 的 `onAuthStateChange` 回调中，监听到 `SIGNED_IN` + provider 为 `github` 时，调用 `db.profiles.upsert()`。

邮箱登录用户：`github_login` 用 email 前缀填充（`user.email?.split('@')[0]`），`github_avatar` 为 null。

理由：
- upsert 是幂等的，多次登录无副作用
- 集中在 store 里处理，不散落在各个页面

### 5. Phase Lock 逻辑

纯前端计算，封装为 `getPhaseStatus(idea: Idea, phase: number): 'done' | 'active' | 'locked'`：

```ts
const UNLOCK: Record<number, (i: Idea) => boolean> = {
  0: () => true,
  1: (i) => Boolean(i.feedCompletedAt),
  2: (i) => i.intentClarity >= 85 && i.openQuestionsCount === 0,
  3: (i) => Boolean(i.boundaryLockedAt),
  4: (i) => i.validationVerdict === 'go',
  5: (i) => Boolean(i.contractSignedAt),
}
```

`done` = phase < currentPhase；`active` = phase === currentPhase；`locked` = !UNLOCK[phase](idea)。

### 6. 设计系统对齐

参考原型（`maestro_dashboard.html`）为浅色主题，但项目设计系统是深色（slate-900/950）。实现时：
- 沿用项目既有深色 palette（不引入浅色主题切换）
- 保留原型的信息架构（Stats Bar 4 列、表格列顺序）
- Status badge 使用 `docs/references/mvp/maestro-ui-spec.md` 中定义的颜色 token（但适配深色背景）

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| `db.ideas.list()` 在数据多时较慢（全量拉取） | v0.1 用户规模极小（<50 ideas），可接受；后续加分页 |
| profile upsert 在邮箱登录时 `github_login` 字段使用 email 前缀，非真实 GitHub 用户名 | `profiles.github_login` 有 UNIQUE 约束，email 用户不会与 GitHub 用户冲突；后续可在 profile 页补全 |
| TanStack Router 的 layout route 与现有 `createRoute` 模式混用 | 全部迁移到 layout route 模式，统一认证守卫 |
| `/ideas/$id` 路由尚无 Phase 实现，侧边导航暂时全部 locked | 符合预期，侧边栏 Phase 1 始终显示为 active（Phase 0 = feed 需实现后才能 done） |

## Open Questions

- `pref_auto_export_context` 字段（profiles 表）：v0.1 不实现，显示 Settings 中不展示
- Dashboard filter tabs 的 URL 状态：是否持久化到 search params？建议 v0.1 不持久化，仅本地 state
