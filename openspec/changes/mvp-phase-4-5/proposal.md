# mvp-phase-4-5

## Why

Phase 4（Product Contract）是"强制推向市场"的实现——签署后不可更改的承诺（deadline + success metric + product type）。这是 Maestro 产品核心机制的收尾。

Phase 5（Evolution）是合同签署后的长期迭代机制，通过 openspec changes 管理每一次演进，维护 context 不漂移。

## What Changes

### Phase 4 — Product Contract (`/ideas/:id/contract`)

- **表单字段**（签署前可编辑）：
  - `product_type`：paid / opensource / internal
  - `deadline`：日期选择器
  - `success_metric`：paid_users / github_stars / weekly_downloads / url_reachable
  - `target_n`：目标数值
  - `github_repo`：目标仓库（owner/repo）
- **合同 ID 生成**：`CTR-{id6}-{YYYYMMDD}` 格式
- **Sign 操作**：确认弹窗（"此操作不可逆"）→ `sign_contract` command → 提交 `.maestro/contract.json`
- **签署后**：所有字段变只读，显示合同 ID + 签署时间

### Phase 5 — Evolution (`/ideas/:id/evolution`)

- **Evolution Nodes 列表**：版本卡片（v0.1.0、v0.1.1...），每个 node 显示状态 + openspec changes 数量
- **Create Node**：填写版本号 + 描述 → 创建 `evolution_node`
- **OpenSpec Changes 列表**：每个 node 下的 changes（来自目标 repo 的 openspec/changes/）
- **Change 状态追踪**：proposal/design/tasks/in-progress/done
- **Arch Decision Log**：每个 change 完成后记录架构决策
- **市场信号面板**：显示 `market_current_value`、距 deadline 天数、成功指标进度

### 状态机最终收尾

- `active` → `in_market`（market_current_value >= target_n）
- `active` → `at_risk`（deadline - now < 14 days）
- `active/at_risk` → `force_closed`（deadline 过了，未达标）
- 定时检查：桌面 app 启动时 + 每小时 check 一次市场信号（GitHub stars 直接调 GitHub API）

## Impact

- **新增**：`src/routes/ideas/$id/contract.tsx`、`src/routes/ideas/$id/evolution.tsx`
- **新增**：`src-tauri/src/commands/market_signals.rs`（GitHub stars 拉取）
- **依赖**：`mvp-data-layer`、`mvp-phase-2-3`

## Out of scope

- Stripe / 微信支付 webhook（paid_users 指标先留 manual update）
- Scope alignment check 自动化
- Evolution node 的 openspec 自动执行集成（UI 展示即可，执行仍在外部）
