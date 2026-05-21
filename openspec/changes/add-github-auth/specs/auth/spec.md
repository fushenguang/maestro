---
capability: auth
version: 1
change: add-github-auth
---

# Spec: auth

## Requirement: GitHub OAuth 登录

#### Scenario: 点击 GitHub 登录

- **Given** 用户在 `/login` 页，未登录
- **When** 点击 GitHub 登录按钮
- **Then** 系统浏览器打开 GitHub OAuth 授权页
- **And** 请求 scopes 包含 `repo read:user user:email read:org`
- **And** redirect_uri 为 `maestro://auth/callback`

#### Scenario: OAuth 授权完成后回调

- **Given** 用户在 GitHub 侧已授权 Maestro
- **When** OS 传递 `maestro://auth/callback?code=...` 深度链接
- **Then** App 通过 PKCE 与 Supabase 完成 code 交换，取得 session
- **And** 用户被重定向到 `/`

#### Scenario: 用户取消 OAuth 授权

- **Given** 用户在 GitHub 侧点击 Deny
- **When** 浏览器返回 error 回调
- **Then** App 显示错误提示，停留在 `/login`

## Requirement: 路由保护

#### Scenario: 未认证访问受保护页面

- **Given** 无有效 Supabase session
- **When** 用户导航到 `/`（或任意受保护路由）
- **Then** 重定向到 `/login`
- **And** 原目标 URL 不丢失（router 支持 `redirect` 传参）

#### Scenario: 已认证访问首页

- **Given** 有效 Supabase session
- **When** 用户导航到 `/`
- **Then** 页面正常渲染，不触发跳转

#### Scenario: 认证加载中

- **Given** App 刚启动，session 正在从本地存储恢复（`loading = true`）
- **When** 用户处于任意页面
- **Then** 显示加载态（spinner），不做路由跳转
- **And** 加载完成后根据 session 结果再路由

## Requirement: Session 持久化

#### Scenario: 重启应用后 session 自动恢复

- **Given** 用户上次已成功登录
- **When** 应用重启
- **Then** Supabase JS SDK 从本地存储恢复 session
- **And** 用户无需重新登录

#### Scenario: Session 过期后自动刷新

- **Given** 有效 session，但 access_token 临近过期
- **When** 应用处于活跃状态
- **Then** Supabase SDK 自动 refresh token
- **And** `onAuthStateChange` 更新 store 中的 session
