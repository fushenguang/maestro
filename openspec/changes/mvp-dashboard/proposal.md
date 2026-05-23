# mvp-dashboard

## Why

Dashboard 是 Maestro 的主界面——用户登录后看到的第一个页面，也是管理所有产品的全局视图。需要在数据层和所有 Phase UI 就绪后实现，才能展示真实数据。

## What Changes

### Dashboard (`/dashboard`)

- **Stats Bar**（4 列）：total products、live in market、deadline < 30d、force closed
  - 数据来自 `get_ideas` 的本地聚合，不走远端
- **Product Registry Table**：列：product | status | deadline | market signal | version
  - Status badge（active/at_risk/draft/closed/in_market）
  - Deadline progress bar（颜色随剩余时间变化：危险/警告/安全）
  - Market signal：当前值 / 目标值
- **Filter tabs**：all | active | at risk | closed（客户端过滤）
- **New idea 按钮**：检查是否有未完成草稿 → 提示继续或新建
- **Row click**：导航到 `/ideas/:id`（自动跳转到当前活跃 Phase）

### App Shell 完善

- **Topbar**：`[M] MAESTRO` logo + nav tabs（products / resources / insights / settings）+ 右侧 avatar
- **Phase sidebar**（在 `/ideas/:id/*` 路由下）：6 个 phase 的导航，带 lock/unlock/done 状态
- **Phase lock 逻辑**：基于 `Idea` 字段计算各 Phase 的解锁条件

### Supabase Auth 集成收尾

- 登录后将 GitHub 用户信息写入本地 `profiles` 表（`upsert_profile` command）
- Auth state 存 Zustand store，持久化到 Tauri 本地 secure storage

## Impact

- **新增**：`src/routes/dashboard.tsx`、`src/components/layout/app-shell.tsx`、`src/components/layout/phase-sidebar.tsx`
- **修改**：`src/routes/__root.tsx`（加入 app shell 布局）
- **依赖**：`mvp-data-layer`（所有 Phase 数据）

## Out of scope

- Supabase Realtime 订阅（本地 SQLite 实时刷新即可）
- Insights / Resources 页面（tab 存在但内容占位）
- Profile / Settings 页面（v0.1 简单展示即可）
