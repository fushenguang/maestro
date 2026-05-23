# Add GitHub auth + protected routes

## Why

Bootstrap change 跑通了 Tauri 桌面壳子。在任何用户功能上线之前，必须先有一道认证门：

1. Maestro 的核心操作（建分支、push 代码、开 PR、合并 PR）需要以用户 GitHub 身份
   调用 GitHub API，没有有效 token 无法进行。
2. 目标用户是开发者，GitHub 账号是其天然身份，无需引入额外账号体系。

## What Changes

### 1. Login 页（`/login`）

- 使用 shadcn `login-03` block（`npx shadcn@latest add login-03`）
- **只有 GitHub 登录按钮激活**；邮箱/密码保留 UI 但禁用，标注 `// TODO: email/password`
- 已登录时自动跳转 `/`

### 2. GitHub OAuth — 深度链接（URI scheme，VSCode 风格）

- Tauri 注册 URI scheme：`maestro://`
- `tauri-plugin-deep-link` 接收 `maestro://auth/callback` 回调
- `tauri-plugin-shell` 打开系统浏览器
- Supabase `signInWithOAuth` + `skipBrowserRedirect: true` + PKCE（由 SDK 自动处理）
- **Scope**：`repo read:user user:email read:org`（为后续 GitHub 操作预先获取完整权限）

### 3. Supabase 客户端（`src/lib/supabase.ts`）

- 自部署 Supabase，使用 `calcifer` schema
- 环境变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`

### 4. Auth 状态（Zustand store，`src/stores/auth.ts`）

- State：`session`、`user`、`loading`
- Actions：`signInWithGitHub()`、`signOut()`
- 监听 `supabase.auth.onAuthStateChange`

### 5. 路由保护

- TanStack Router `beforeLoad` 保护 `/` 及所有后续受保护路由
- 无 session → `throw redirect({ to: '/login' })`

## Impact

- **新增 capability**：`auth`
- **影响目录**：`apps/desktop/`（新增文件 + 配置变更）
- **依赖前置**：自部署 Supabase 实例 + GitHub OAuth App 配置
  （配置步骤见 calcifer-docs → 参考项目 → Maestro → Supabase GitHub Auth）

## Out of scope

- 邮箱/密码注册与登录（TODO 占位）
- 其他 OAuth provider（Google、Twitter 等）
- Supabase RLS 策略（下一个 change）
- GitHub token 刷新 / scope 变更流程（下一个 change）
- 移动端认证
