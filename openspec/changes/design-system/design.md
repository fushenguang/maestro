## Context

当前状态：
- `components.json` 的 `cssVariables: false`，shadcn 基于 Tailwind utility 类而非 CSS 变量；一旦要全局换色，需要逐文件改
- `index.css` 仅 4 行，无任何 token 定义
- HTML 原型中的 `--color-background-*` / `--color-border-*` 变量在运行时根本不存在，原型效果无法复现
- 已安装的 3 个组件（button / card / input）颜色全部硬编码为 slate 系列值，非语义化
- 字体 html 元素仍在使用 Inter，不是 UI spec 指定的 Syne

目标用户：Cogito Tech 内部团队（技术创始人），桌面 app，开发者审美，深色主题。

## Goals / Non-Goals

**Goals:**
- 建立与 HTML 原型视觉效果一致的 CSS 变量体系（dark theme）
- 将 shadcn 切换为标准 CSS Variables 模式，支持全局统一换色
- 补全 UI spec 要求的语义色 token（success / warning / info / deadline-danger）
- 更新已有 3 个 shadcn 组件使用 token 类名
- 补充缺失的基础 shadcn 组件（separator、badge、avatar、alert）
- 新增 `StatusBadge` 可复用组件
- 安装并配置 `@tabler/icons-react`

**Non-Goals:**
- 浅色主题（MVP 仅深色）
- 动画库 / Framer Motion 集成
- Storybook 或组件文档站
- 超出 UI spec 定义的自定义 token
- 将现有页面全量重构（仅更新组件层，页面回归在各自 change 中完成）

## Decisions

### D1：启用 shadcn CSS Variables 模式

**选择**：将 `components.json` 的 `cssVariables` 从 `false` 改为 `true`，CSS 变量定义在 `index.css` 的 `@layer base` 中，Tailwind 通过 `hsl(var(--xxx))` 引用。

**理由**：这是 shadcn 官方推荐的主题化方式。CSS variables 模式下，通过修改 `:root` 即可全局切换颜色；utility 模式（false）下每个组件都是孤岛，无法统一。MVP 有 6+ 页面，统一切换成本巨大。

**放弃方案**：保持 `false` + 统一 Tailwind 配置 extend——这需要每个组件手动继承 config 里的 token 名称，没有 CSS variables 灵活且不符合 shadcn 社区生态。

### D2：单深色主题，仅定义 dark token

**选择**：`index.css` 中只定义 dark theme 的 `:root`，不添加 `.light` 或 `@media prefers-color-scheme`。

**理由**：MVP 用户是技术创始人，桌面 app，深色是首选。加 light 主题会让 token 数量翻倍，维护成本高，且 HTML 原型本身也是对深色主题做的。后续可以通过单独 change 增加 light mode。

### D3：token 命名跟随 shadcn 标准 + Maestro 语义扩展

**选择**：
- **基础层**（shadcn 标准）：`--background`、`--foreground`、`--card`、`--card-foreground`、`--muted`、`--muted-foreground`、`--border`、`--input`、`--ring`、`--primary`、`--primary-foreground`、`--secondary`、`--secondary-foreground`、`--accent`、`--accent-foreground`、`--destructive`、`--destructive-foreground`、`--radius`
- **语义扩展层**（Maestro 专属）：`--success`、`--success-foreground`、`--warning`、`--warning-foreground`、`--info`、`--info-foreground`、`--deadline-danger`、`--deadline-danger-foreground`

**理由**：shadcn 标准名可直接被 CLI 安装的新组件消费，无需适配；Maestro 语义层服务于 StatusBadge、deadline 进度条等产品专属 UI。

### D4：Tabler Icons 为主，不移除已有 lucide 引用

**选择**：安装 `@tabler/icons-react`，新增的所有图标使用 Tabler。已存在的 lucide import 不做强制迁移（不在此 change 范围内）。

**理由**：UI spec 明确规定图标集为 Tabler Icons（outline 风格）。lucide 是 shadcn 默认，存量代码依赖成本高，可在后续 change 里统一替换。两个库可以共存。

### D5：字体通过 Google Fonts 在线加载，Tauri 中退化到系统字体

**选择**：保留 `index.html` 中的 Google Fonts link，同时在 `index.css` 中将 fallback 设为 `ui-sans-serif`（Syne）和 `ui-monospace`（IBM Plex Mono），保证无网络时仍可显示。

**理由**：Tauri WebView 访问 Google Fonts 需要网络，但应用本身也需要网络（GitHub OAuth），所以离线场景不是 MVP 目标。同时加 fallback 保证 CI/开发时的截图测试不会因字体缺失而 fail。

### D6：组件更新策略

**已有 3 个组件**：手动编辑 className，将硬编码的 `slate-*` 色替换为语义 token（如 `bg-card`、`border-border`、`text-foreground`）。

**新组件**：优先用 `pnpm dlx shadcn@latest add <name>` 安装（separator、badge、avatar、alert）；安装后如有 hardcoded color，一并更新为 token。

**StatusBadge**：UI spec 有明确的实现代码（`STATUS_STYLES` map），直接按 spec 创建为 `src/components/ui/status-badge.tsx`，不走 shadcn CLI。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| 切换 cssVariables 后，shadcn CLI 新安装的组件会覆盖 components.json，可能重置配置 | 每次使用 CLI 后检查 components.json 是否被改回 false |
| `hsl(var(--xxx))` 格式要求 token 值必须是纯 HSL 数字（无 `hsl()` 包裹），不能用 hex | 所有 token 值写为 `222 47% 11%` 格式，不写 `hsl(222 47% 11%)` |
| Google Fonts 在某些网络环境下加载慢，影响开发体验 | fallback 字体确保功能正常；字体加载失败不影响布局 |
| BREAKING：已有 card / button 外观变化 | 仅 login 页面受影响，视觉回归在本 change 的 smoke test task 中覆盖 |

## Migration Plan

1. 更新 `components.json`（cssVariables: true）
2. 重写 `index.css`（完整 CSS 变量 + `@layer base` 字体）
3. 更新 `tailwind.config.ts`（extend colors 引用 CSS 变量 + fontFamily）
4. 更新 `button.tsx` / `card.tsx` / `input.tsx`
5. 安装新 shadcn 组件（separator、badge、avatar、alert）
6. 创建 `status-badge.tsx`
7. 安装 `@tauri/icons-react`
8. `pnpm typecheck` 验证无类型错误
9. `pnpm dev:app` smoke test login 页面视觉效果

## Open Questions

- `--radius` 统一值：UI spec 写 8px（shadcn 默认），HTML 原型部分地方用 `6px`（M mark）和 `4px`（tag）。决议：`--radius: 0.5rem`（8px）作为全局 radius，特殊场景在组件内用 `rounded-md`（6px）直接写。
