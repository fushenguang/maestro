# Tasks: add-github-auth

## Acceptance（机器可执行；calcifer self-incubation-loop 在 PR 合并后自动跑）

- **AC1** `pnpm typecheck` 退出码 0
- **AC2** 文件存在性：
  ```
  test -f apps/desktop/src/routes/login.tsx &&
  test -f apps/desktop/src/lib/supabase.ts &&
  test -f apps/desktop/src/stores/auth.ts &&
  test -f apps/desktop/src/lib/auth-callback.ts
  ```
- **AC3** GitHub scope 包含 repo：`grep -q \"repo\" apps/desktop/src/lib/supabase.ts`
- **AC4** calcifer schema：`grep -q \"calcifer\" apps/desktop/src/lib/supabase.ts`
- **AC5** 深度链接 scheme：`grep -q \"maestro\" apps/desktop/src-tauri/tauri.conf.json`
- **AC6** 路由保护：`grep -rq \"beforeLoad\" apps/desktop/src/routes/index.tsx`
- **AC7** 无硬编码秘钥：`! grep -RE \"supabase_key|ghp_|github_pat_\" apps/ 2>/dev/null`
- **AC8** Supabase 依赖：`grep -q \"@supabase/supabase-js\" apps/desktop/package.json`
- **AC9** deep-link 插件：`grep -q \"tauri-plugin-deep-link\" apps/desktop/src-tauri/Cargo.toml`
- **AC10** login route 注册：`grep -q \"/login\" apps/desktop/src/router.tsx`

## 0. 前置（基础设施，不属于本 change 代码范围）

- [ ] 0.1 自部署 Supabase 实例已运行，GitHub OAuth provider 已在 Supabase Dashboard 启用
- [ ] 0.2 Supabase GitHub OAuth 回调 URL 已设为 `maestro://auth/callback`
- [ ] 0.3 `calcifer` schema 已建，已对 `anon` 和 `authenticated` 角色 GRANT 权限
- [ ] 0.4 `.env.local` 中已写入 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`

## 1. 依赖 & Tauri 配置

- [ ] 1.1 前端依赖：`pnpm --filter @maestro/desktop add @supabase/supabase-js @tauri-apps/plugin-deep-link @tauri-apps/plugin-shell`
- [ ] 1.2 Cargo 依赖（`apps/desktop/src-tauri/Cargo.toml`）：
  - `tauri-plugin-deep-link = "2"`
  - `tauri-plugin-shell = "2"`
- [ ] 1.3 `tauri.conf.json` → `plugins` 新增：
  ```json
  "deep-link": { "desktop": { "schemes": ["maestro"] } },
  "shell": { "open": "https://*" }
  ```
- [ ] 1.4 `capabilities/default.json`：添加 `"deep-link:default"` 和 `"shell:allow-open"`
- [ ] 1.5 `src-tauri/src/lib.rs`：在 `.setup()` 前注册插件
  ```rust
  .plugin(tauri_plugin_deep_link::init())
  .plugin(tauri_plugin_shell::init())
  ```

## 2. Supabase 客户端

- [ ] 2.1 写 `apps/desktop/src/lib/supabase.ts`：
  - `export const GITHUB_SCOPES = 'repo read:user user:email read:org'`
  - `export const supabase = createClient(url, key, { db: { schema: 'calcifer' }, auth: { persistSession: true, autoRefreshToken: true } })`

## 3. Auth store（Zustand）

- [ ] 3.1 写 `apps/desktop/src/stores/auth.ts`：
  - State：`session: Session | null`、`user: User | null`、`loading: boolean`
  - `signInWithGitHub()`：`supabase.auth.signInWithOAuth({ provider: 'github', options: { scopes: GITHUB_SCOPES, redirectTo: 'maestro://auth/callback', skipBrowserRedirect: true } })` → `open(url)` via Tauri shell
  - `signOut()`：`supabase.auth.signOut()`
  - 初始化：`supabase.auth.onAuthStateChange` 监听器，更新 `session` 和 `user`

## 4. Deep link 回调处理

- [ ] 4.1 写 `apps/desktop/src/lib/auth-callback.ts`：
  - 使用 `tauri-plugin-deep-link` 的 `onOpenUrl` 监听 `maestro://auth/callback?code=...`
  - 解析 `code` 参数 → `supabase.auth.exchangeCodeForSession(code)`
- [ ] 4.2 在 `apps/desktop/src/main.tsx` 应用启动时调用 `initAuthCallback()`

## 5. Login 页

- [ ] 5.1 运行 `npx shadcn@latest add login-03`（安装 block 所需的 Card、Input、Label 等组件）
- [ ] 5.2 写 `apps/desktop/src/routes/login.tsx`：
  - 用 login-03 block 的 card 布局
  - GitHub 登录按钮调用 `useAuthStore().signInWithGitHub()`，显示 loading 状态
  - 邮箱/密码输入保留 UI，设 `disabled`，注释 `// TODO: email/password login`
  - 页面加载时检查已有 session → `redirect({ to: '/' })`

## 6. 路由保护

- [ ] 6.1 修改 `apps/desktop/src/routes/index.tsx`：
  - 加 `beforeLoad: () => { const { session, loading } = useAuthStore.getState(); if (!loading && !session) throw redirect({ to: '/login' }); }`
- [ ] 6.2 修改 `apps/desktop/src/router.tsx`：注册 login route（`import { Route as LoginRoute } from './routes/login'`）
- [ ] 6.3 修改 `apps/desktop/src/routes/__root.tsx`：加 auth loading spinner，避免未认证 flash
