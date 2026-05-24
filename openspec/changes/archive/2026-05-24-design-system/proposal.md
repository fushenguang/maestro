## Why

当前应用没有设计 token 系统：`components.json` 关闭了 CSS 变量、`index.css` 只有 4 行、HTML 原型里大量使用的 `--color-background-*` / `--color-border-*` 变量在 app 中根本未定义，已有的 `button.tsx` / `card.tsx` 颜色全部硬编码为一次性 slate 值。缺乏统一基础导致每个新页面的开发者各自发明颜色和间距，login 页面返工已验证了这个代价。MVP 有 6+ 个页面待开发，必须在继续之前先固定这个基础。

## What Changes

- 将 `components.json` 的 `cssVariables` 从 `false` 改为 `true`，启用 shadcn 标准 CSS 变量模式
- 在 `index.css` 写入完整 CSS 变量定义（dark theme），与 HTML 原型 token 命名对齐
- 在 `tailwind.config.ts` 扩展 `colors` / `borderRadius` / `fontFamily`，引用 CSS 变量
- 更新已有 `button.tsx` / `card.tsx` / `input.tsx` 使用语义化变量类替换硬编码 slate 值
- 增加 UI spec 规定的语义色 token：`deadline-danger`、`warn`、`success`、`info`
- 补充缺失的 shadcn 基础组件：`separator`、`badge`、`avatar`、`alert`
- 新增 `StatusBadge` 组件（UI spec Section 0 定义，跨所有列表页复用）
- 安装并配置 `@tabler/icons-react`（UI spec 规定的图标集）
- **BREAKING**：现有 `card.tsx`、`button.tsx` 的外观会随 token 变化，任何直接依赖颜色的代码需要回归验证

## Capabilities

### New Capabilities

- `design-tokens`：CSS 变量体系、字体配置（Syne + IBM Plex Mono）、调色板（background / foreground / border / muted / accent 五层）、圆角 / 阴影 token，以及 deadline-danger / warn / success / info 四种语义色
- `ui-components`：可复用基础组件集（StatusBadge、separator、badge、avatar、alert），所有组件基于 design-tokens 体系，不内联颜色

### Modified Capabilities

（暂无已有 capability spec）

## Impact

- `apps/desktop/components.json` — cssVariables 开关
- `apps/desktop/src/index.css` — 全量重写，加入 CSS 变量
- `apps/desktop/tailwind.config.ts` — extend colors / radius / fontFamily
- `apps/desktop/src/components/ui/` — 已有 3 个组件更新 + 新增 4 个组件
- `apps/desktop/package.json` — 新增 `@tabler/icons-react`
- 下游影响：`login.tsx`、`index.tsx` 使用 token 类名的部分需要 smoke test
