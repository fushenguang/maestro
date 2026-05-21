# Design: add-github-auth

## D1. OAuth 回调：深度链接（URI scheme）而非本地回调服务器

原生桌面 App 不应使用静态 redirect URI（RFC 8252 §8.3）。两个主流方案对比：

| 方案 | 机制 | 风险 |
|------|------|------|
| 本地回调服务器 | 临时起 `localhost:PORT`，浏览器回调到此 | 端口冲突；防火墙可能拦截；VSCode v1 旧方案 |
| **深度链接（URI scheme）** | OS 注册 `maestro://`，浏览器回调唤起 App | 无额外开销；系统原生支持；VSCode 桌面端现方案 |

**决策：深度链接**。Tauri v2 通过 `tauri-plugin-deep-link` 原生支持 macOS/Windows/Linux
三端统一注册。PKCE 由 Supabase JS SDK 自动处理（`code_verifier` 存于内存），无需额外代码。

VSCode 参照：VSCode 注册 `vscode://` scheme，GitHub OAuth 回调到
`vscode://vscode.github-authentication/did-authenticate`，Maestro 对应使用
`maestro://auth/callback`。

## D2. GitHub scope — 一次请求完整权限

| scope | 用途 |
|-------|------|
| `repo` | 创建分支、push 代码、开 PR、合并 PR（Maestro 核心功能） |
| `read:user` | 读取用户基本信息 |
| `user:email` | 读取用户邮箱 |
| `read:org` | 读取组织成员权限（org repo 操作需要） |

最小 scope（`read:user user:email`）够登录但不够后续操作。要求用户二次扩权的体验很差。
**决策：本 change 一次性请求完整 scope**，后续功能无需再触发授权弹窗。

## D3. Supabase schema：`calcifer` 而非 `public`

自部署 Supabase 可能共享 Postgres 实例（与其他项目或 Supabase 内置表共存）。
`calcifer` schema 隔离 Maestro 所有应用表，避免命名冲突。

```ts
createClient(url, key, { db: { schema: 'calcifer' } })
```

GoTrue（Supabase 认证服务）始终使用自身的 `auth` schema，不受 db.schema 设置影响。
`calcifer` schema 的 GRANT 操作属于基础设施配置，不在本 change 代码中——详见 calcifer-docs。

## D4. Supabase client 位置

`apps/desktop/src/lib/supabase.ts`（当前 slice）。
当 `packages/db` 包建立后（后续 slice），可无感提取为独立包，消费方通过 path alias 透明升级。

## D5. 路由保护实现

TanStack Router `beforeLoad` 是同步守卫，`auth store` 初始化后可直接读取：
- `loading = true` → 显示 spinner，不跳转（避免 flash）
- `session = null` 且 `loading = false` → `throw redirect({ to: '/login' })`
- `session` 存在 → 正常渲染

## D6. 安全边界

- `VITE_SUPABASE_ANON_KEY`：设计用于前端暴露，只能访问 public row（RLS 控制）
- GitHub access_token：由 Supabase GoTrue 持有，前端只得到 Supabase session JWT
- GitHub OAuth App secret：**只在 Supabase 服务端配置，永不进入前端代码或 git**
- `.env.local` gitignore 保护；AC7 通过 grep 验证无硬编码秘钥

## Open Questions

- OQ1：`calcifer` schema 的 RLS 策略 → 下一个 change
- OQ2：多环境 Supabase 实例（dev/prod）切换 → CI/CD change
