## 1. 依赖安装

- [ ] 1.1 在 `apps/desktop` 安装 `@tabler/icons-react`：`pnpm add @tabler/icons-react`

## 2. shadcn 配置切换

- [ ] 2.1 将 `apps/desktop/components.json` 的 `"cssVariables"` 从 `false` 改为 `true`

## 3. CSS 变量体系（index.css）

- [ ] 3.1 重写 `apps/desktop/src/index.css`：`@layer base :root` 中定义完整 shadcn 标准 token（background / foreground / card / muted / border / input / ring / primary / secondary / accent / destructive / radius）
- [ ] 3.2 在同一 `:root` 块中追加 Maestro 语义 token：`--success`、`--success-foreground`、`--warning`、`--warning-foreground`、`--info`、`--info-foreground`、`--deadline-danger`、`--deadline-danger-foreground`，值对齐 UI spec 色板
- [ ] 3.3 将 `html` 的 `font-family` 改为 Syne + fallback（替换当前的 Inter）

## 4. Tailwind 配置

- [ ] 4.1 扩展 `tailwind.config.ts` 的 `theme.extend.colors`：为所有 CSS 变量 token 添加 `hsl(var(--xxx))` 映射条目（background, foreground, card, card-foreground, muted, muted-foreground, border, input, ring, primary, primary-foreground, secondary, secondary-foreground, accent, accent-foreground, destructive, destructive-foreground, success, success-foreground, warning, warning-foreground, info, info-foreground, deadline-danger, deadline-danger-foreground）
- [ ] 4.2 扩展 `tailwind.config.ts` 的 `theme.extend.borderRadius`：添加 `lg: 'var(--radius)'`、`md: 'calc(var(--radius) - 2px)'`、`sm: 'calc(var(--radius) - 4px)'`

## 5. 更新已有 shadcn 组件

- [ ] 5.1 更新 `apps/desktop/src/components/ui/button.tsx`：将硬编码的 `bg-sky-500`、`slate-*`、`border-slate-700` 等替换为语义 token 类（`bg-primary`、`text-primary-foreground`、`bg-background`、`text-foreground`、`border-border` 等）
- [ ] 5.2 更新 `apps/desktop/src/components/ui/card.tsx`：将 `bg-slate-900/80`、`border-slate-800`、`text-slate-50` 等替换为 `bg-card`、`text-card-foreground`、`border-border`
- [ ] 5.3 更新 `apps/desktop/src/components/ui/input.tsx`：将硬编码 slate 色替换为 `bg-input`（或 `bg-background`）、`border-border`、`text-foreground`

## 6. 安装新 shadcn 基础组件

- [ ] 6.1 安装 separator：`pnpm dlx shadcn@latest add separator`，确认生成的文件使用 token 类
- [ ] 6.2 安装 badge：`pnpm dlx shadcn@latest add badge`，确认生成的文件使用 token 类
- [ ] 6.3 安装 avatar：`pnpm dlx shadcn@latest add avatar`，确认生成的文件使用 token 类
- [ ] 6.4 安装 alert：`pnpm dlx shadcn@latest add alert`，确认生成的文件使用 token 类

## 7. StatusBadge 组件

- [ ] 7.1 创建 `apps/desktop/src/components/ui/status-badge.tsx`：接受 `status: 'active' | 'warning' | 'closed' | 'draft' | 'locked' | 'done'` prop，用 `STATUS_STYLES` map 映射到 Tailwind 语义 token 类；对未知 status 退化为 muted 样式

## 8. 验证

- [ ] 8.1 运行 `pnpm typecheck`，确认 0 错误
- [ ] 8.2 运行 `pnpm dev:app`，目视检查 login 页面：M logo、字体、按钮样式与设计稿一致，无白板
