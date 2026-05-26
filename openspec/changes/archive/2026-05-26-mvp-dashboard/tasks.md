## 1. Routing Refactor

- [x] 1.1 在 `apps/desktop/src/routes/` 下创建 `_app.tsx` layout route（pathless，含 `beforeLoad` 认证守卫）
- [x] 1.2 更新 `router.tsx`：将 `_app` 注册为 layout route，`DashboardRoute` / `IdeasRoute` 作为其子路由
- [x] 1.3 删除各子路由中重复的认证守卫（`beforeLoad` 中 session 检查仅保留在 `_app`）
- [x] 1.4 将 `IndexRoute`（`/`）改为重定向到 `/dashboard`

## 2. App Shell 组件

- [x] 2.1 创建 `apps/desktop/src/components/AppShell.tsx`：包含 Topbar + `<Outlet />` 内容区布局
- [x] 2.2 创建 `apps/desktop/src/components/Topbar.tsx`：`[M] MAESTRO` 品牌字、4 个 nav tabs、用户头像
- [x] 2.3 为 `products` tab 添加激活状态逻辑（匹配 `/dashboard` 和 `/ideas/*`）
- [x] 2.4 头像点击展示下拉菜单，包含「退出登录」选项
- [x] 2.5 为 `resources` / `insights` 创建 placeholder 路由（`_app/resources.tsx`、`_app/insights.tsx`）并在 `router.tsx` 注册

## 3. Profile Upsert

- [x] 3.1 在 `apps/desktop/src/lib/db.ts` 确认 `db.profiles.upsert()` 方法已有正确的 TypeScript 签名（`UpsertProfileInput`）
- [x] 3.2 在 `apps/desktop/src/store/auth.ts` 的 `onAuthStateChange` 回调中，监听 `SIGNED_IN` 事件后调用 `db.profiles.upsert()`
- [x] 3.3 处理邮箱登录场景：`githubLogin` 使用 `user.email?.split('@')[0]`，`githubAvatar` 为 null
- [x] 3.4 upsert 失败时仅 console.warn，不阻断登录流程

## 4. Dashboard 页面

- [x] 4.1 创建 `apps/desktop/src/routes/_app/dashboard.tsx`：在 `useEffect` 中调用 `db.ideas.list()` 并存入本地 state
- [x] 4.2 创建 `apps/desktop/src/components/dashboard/StatsBar.tsx`：4 个指标卡（Total / Live / Deadline<30d / Force-Closed）
- [x] 4.3 实现客户端统计计算函数 `computeStats(ideas: Idea[]): DashboardStats`
- [x] 4.4 创建 `apps/desktop/src/components/dashboard/FilterTabs.tsx`：All / Active / In Market / Closed 过滤 tabs
- [x] 4.5 创建 `apps/desktop/src/components/dashboard/ProductTable.tsx`：表格含 Product / Status / Deadline / Market Signal / Version 列
- [x] 4.6 实现 `StatusBadge` 组件（或复用设计系统中已有的 badge），覆盖全部 6 种 status 颜色
- [x] 4.7 实现 Deadline 进度条：计算剩余比例，>50% 绿色、20-50% 琥珀色、<20% 红色
- [x] 4.8 实现空状态组件：「No products yet」文字 + 「+ New Idea」CTA 按钮（按钮暂为 disabled/placeholder）
- [x] 4.9 表格行点击 → `navigate({ to: '/ideas/$id', params: { id: idea.id } })`
- [x] 4.10 Dashboard header 行：标题「Products」+ 右侧「+ New Idea」按钮（placeholder）

## 5. Phase Sidebar 骨架

- [x] 5.1 创建 `apps/desktop/src/components/PhaseSidebar.tsx`：168px 宽，6 个 phase 项
- [x] 5.2 实现 `getPhaseStatus(idea: Idea, phase: number): 'done' | 'active' | 'locked'` 工具函数（见 design.md）
- [x] 5.3 创建 `apps/desktop/src/routes/_app/ideas/$id.tsx` layout route（包含 `PhaseSidebar` + `<Outlet />`）
- [x] 5.4 在 `router.tsx` 注册 ideas 动态路由

## 6. 验证与联调

- [x] 6.1 本地运行 `pnpm tauri dev` 验证：登录 → 跳转 `/dashboard` → 看到正确 Shell 和空状态
- [x] 6.2 验证 profile upsert：登录后检查 SQLite `profiles` 表有对应记录（自动化脚本 `scripts/agents/check-db.sh` 验证通过）
- [x] 6.3 创建一条测试 idea（`scripts/agents/seed-db.sh` 注入 6 条覆盖全状态的 ideas，`check-db.sh` 断言通过）
- [x] 6.4 验证 filter tabs 过滤逻辑正确（12 个 Vitest 单元测试全部通过，`pnpm test`）
- [ ] 6.5 验证退出登录：头像菜单 → 退出 → 跳转 `/login`，session 清除
