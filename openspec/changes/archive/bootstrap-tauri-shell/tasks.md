# Tasks: bootstrap-tauri-shell

## Acceptance（机器可执行；calcifer self-incubation-loop 在 PR 合并后自动跑）

- **AC1** `openspec validate bootstrap-tauri-shell --strict` 退出码 0
- **AC2** `pnpm install --frozen-lockfile=false` 退出码 0（本 change 是仓内首次 install，不要求 frozen lockfile）
- **AC3** `pnpm typecheck` 退出码 0（root + apps/desktop 全绿）
- **AC4** `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` 退出码 0
- **AC5** 文件存在性：`test -f package.json && test -f pnpm-workspace.yaml && test -f turbo.json && test -f apps/desktop/package.json && test -f apps/desktop/src-tauri/Cargo.toml && test -f apps/desktop/src/App.tsx && test -f docs/architecture/vision.md && test -f AGENTS.md`
- **AC6** vision.md 内容契约：`grep -q "codex SDK" docs/architecture/vision.md && grep -q -i "minimax" docs/architecture/vision.md && grep -q -i "AppServer Protocol" docs/architecture/vision.md`
- **AC7** 隔离守护：`! grep -RE "ANTHROPIC_API_KEY|OPENAI_API_KEY|LINEAR_API_KEY|SUPABASE_URL" apps/ packages/ 2>/dev/null`（本 change 不引入任何外部服务凭据）
- **AC8** Tauri identifier 检查：`grep -q '"identifier"' apps/desktop/src-tauri/tauri.conf.json`
- **AC9** shadcn smoke：`grep -q "@/components/ui/button" apps/desktop/src/App.tsx`（Button 已落地）

## 0. 前置（calcifer 侧改动，跨仓依赖）

- [ ] 0.1 calcifer `services/coding-runner` 容器镜像加 rust toolchain（`rustup` + `cargo` + `tauri-cli`），否则 AC4 会失败
      → 这个动作不在本 change 内（属 calcifer 仓的另一个 change `add-rust-toolchain-to-coding-runner`，本 change 只声明依赖）
- [ ] 0.2 maestro 已注册到 calcifer `project-registry`（由 calcifer 仓 `onboard-maestro-as-incubation-target` 完成）

## 1. 仓根工程文件

- [ ] 1.1 写 `package.json`（root）：`name: "maestro"`、`private: true`、`packageManager: "pnpm@9.x.x"`、`engines.node: ">=20 <25"`、scripts: `dev`/`build`/`typecheck`/`lint`（全部委托 turbo）
- [ ] 1.2 写 `pnpm-workspace.yaml`：`packages: [apps/*, packages/*]`
- [ ] 1.3 写 `turbo.json`：tasks 定义 `build`/`dev`/`typecheck`/`lint`，`typecheck` 依赖 `^typecheck`
- [ ] 1.4 写 `tsconfig.base.json`：`strict: true`、`target: ES2022`、`moduleResolution: bundler`
- [ ] 1.5 扩展 `.gitignore`：`node_modules/`、`dist/`、`target/`、`.env*`、`*.log`、`.DS_Store`、`.turbo/`
- [ ] 1.6 写仓根 `AGENTS.md`：链向 `docs/references/AGENTS.md`、`openspec/AGENTS.md`、`docs/architecture/vision.md`，简述"如何起新 change"
- [ ] 1.7 `.editorconfig`：2-space indent、LF、UTF-8

## 2. Architecture vision charter

- [ ] 2.1 写 `docs/architecture/vision.md`：
  - 顶部 frontmatter：`version: 1`、`last_reviewed: 2026-05-21`、`normative: true`
  - 段落："Agent runtime = AppServer Protocol"
  - 段落："Preferred OSS core: codex SDK"
  - 段落："LLM provider abstraction is mandatory; first supported = MiniMax (OpenAI-compatible)"
  - 段落："Future providers: OpenAI / Anthropic / vLLM / etc."
  - 引用 `docs/references/SPEC.md` 作为上层契约
- [ ] 2.2 grep 检查：AC6 三关键词在文件中

## 3. apps/desktop 骨架

- [ ] 3.1 `apps/desktop/package.json`：`name: "@maestro/desktop"`、依赖 `react@^19`、`react-dom@^19`、`@tanstack/react-router@^1`、`zustand@^4`、`@tauri-apps/api@^2.11.0`、devDeps `@tauri-apps/cli@2.11.0`、`vite@^5`、`@vitejs/plugin-react@^4`、`typescript@^5.5`
- [ ] 3.2 `apps/desktop/tsconfig.json`：extends `tsconfig.base.json`、加 `paths` `"@/*": ["./src/*"]`
- [ ] 3.3 `apps/desktop/vite.config.ts`：React plugin、`server.port: 1420`（Tauri 默认）
- [ ] 3.4 `apps/desktop/index.html`：基础 HTML、`<div id="root">`
- [ ] 3.5 `apps/desktop/src/main.tsx`：React 19 + createRoot + RouterProvider
- [ ] 3.6 `apps/desktop/src/router.tsx`：TanStack Router minimal config（仅 `__root` + `index`）
- [ ] 3.7 `apps/desktop/src/routes/__root.tsx`：根布局（`<Outlet />`）
- [ ] 3.8 `apps/desktop/src/routes/index.tsx`：标题 "Maestro Desktop — Bootstrap" + 一个 shadcn Button
- [ ] 3.9 `apps/desktop/src/App.tsx`：导出 router root（让 AC9 的 grep 能命中 `@/components/ui/button` 引用）

## 4. shadcn/ui + Tailwind

- [ ] 4.1 `apps/desktop` 安装 tailwindcss + postcss + autoprefixer + tailwindcss-animate + class-variance-authority + clsx + tailwind-merge + lucide-react
- [ ] 4.2 `apps/desktop/tailwind.config.ts` + `postcss.config.cjs`
- [ ] 4.3 `apps/desktop/src/index.css`：`@tailwind base/components/utilities`
- [ ] 4.4 `apps/desktop/components.json`（shadcn 配置）：style `default`、tailwind config 路径、aliases `@/components`
- [ ] 4.5 `pnpm dlx shadcn@latest add button --cwd apps/desktop`（生成 `src/components/ui/button.tsx` + `src/lib/utils.ts`）
- [ ] 4.6 在 `routes/index.tsx` 引用 `<Button>` 一次（AC9）

## 5. Tauri v2 后端

- [ ] 5.1 `apps/desktop/src-tauri/Cargo.toml`：`tauri = "=2.11.0"`、`tauri-build = "=2.11.0"`、`serde`、`serde_json`
- [ ] 5.2 `apps/desktop/src-tauri/build.rs`：`tauri_build::build()`
- [ ] 5.3 `apps/desktop/src-tauri/src/main.rs`：最小 `fn main()` 调 `lib::run()`
- [ ] 5.4 `apps/desktop/src-tauri/src/lib.rs`：`pub fn run()` 起 Tauri Builder（无 commands、无 plugins）
- [ ] 5.5 `apps/desktop/src-tauri/tauri.conf.json`：v2 schema、`identifier: "com.fushenguang.maestro"`、`productName: "Maestro"`、`version: "0.1.0"`、`build.beforeDevCommand: "pnpm dev"`、`build.devUrl: "http://localhost:1420"`、单 window 1024x768、title "Maestro"
- [ ] 5.6 `apps/desktop/src-tauri/capabilities/default.json`：仅 `core:default` 一项（最小权限）
- [ ] 5.7 `apps/desktop/src-tauri/icons/`：占位图标（用 Tauri 默认占位 PNG，后续 slice 替换）

## 6. 自验

- [ ] 6.1 `pnpm install` 退出码 0
- [ ] 6.2 `pnpm typecheck` 退出码 0
- [ ] 6.3 `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` 退出码 0
- [ ] 6.4 人工：`pnpm --filter @maestro/desktop tauri dev` 能开窗（不进 AC，但 PR 描述写"已本机验证"）
- [ ] 6.5 `openspec validate bootstrap-tauri-shell --strict` 退出码 0

## 7. 收尾

- [ ] 7.1 PR 描述包含本地 `tauri dev` 截图占位（人工补图）
- [ ] 7.2 self-incubation-loop 飞书通知 verdict = pass（如失败则按通知内的 failed_step 修，最多 3 轮 AutoFix）
- [ ] 7.3 archive 到 `openspec/changes/archive/2026-05-XX-bootstrap-tauri-shell/`
