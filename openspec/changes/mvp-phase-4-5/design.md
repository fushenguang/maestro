## Context

`mvp-phase-4-5` 负责完成 Maestro MVP 的最后两段主链路：

1. Phase 4 Product Contract：把 deadline、product type、success metric 固化为不可逆承诺。
2. Phase 5 Evolution Axis：在已签署合同下，用 versioned node + openspec changes 进行持续演进，并持续跟踪市场信号。

当前代码库已具备：
- 数据层：SQLite schema 已包含 `contracts`、`evolution_nodes`、`openspec_changes`、`arch_decision_logs`、`feedback_signals` 与 ideas 状态字段。
- Tauri 命令：已有 `sign_contract`、`get_contract`、`get_evolution_nodes`、`create_evolution_node`、`get_openspec_changes`。
- GitHub 接入：已有 `github` 模块与 `github_commit_file` command，可复用于 `.maestro/contract.json` 写回。
- 前端路由：Phase 0-3 路由已经完成，`/ideas/:id/contract` 与 `/ideas/:id/evolution` 尚未落地。

交互规范与参考原型（product-contract.jpg、evolution-axis.jpg）明确要求：
- 合同签署必须高摩擦、两步确认、签后字段只读。
- Evolution 页需要节点时间轴、scope warning gate、openspec 状态、市场信号面板。
- 市场状态自动迁移：`active -> at_risk / in_market / force_closed`。

## Goals / Non-Goals

**Goals:**
- 落地 Phase 4 合同页面：表单、预签 checklist、仓库校验、两步签署、签后只读态与 contract_ref 展示。
- 落地 Phase 5 Evolution 页面：node 列表、新增 node、openspec changes 展示、scope warning gating、arch log 可见性。
- 新增市场信号 command：GitHub stars 拉取（用于 `github_stars` 指标）与状态机计算。
- 建立定时检查入口：应用启动与小时级检查共同驱动 `ideas` 状态迁移。
- 保持本地优先（SQLite 为主），并把合同产物提交到目标仓库 `.maestro/contract.json`。

**Non-Goals:**
- Stripe / 微信支付自动化接入（`paid_users` 仍以手动或外部同步为主）。
- 自动触发/执行 openspec（本阶段仅展示和状态追踪，不做代码执行编排）。
- v0.2 的 decision tree 页面与非技术用户差异化体验。

## Decisions

### D1. 合同不可变性采用“双层约束”：Rust command + 数据库触发器

- 选择：继续以 `sign_contract` command 为唯一签署入口，并依赖现有 ideas/contracts immutability trigger 做兜底。
- 原因：产品语义是“业务不可逆”，应由应用层先拒绝非法更新，再由 DB 防止绕过。
- 备选：仅依赖 DB 触发器。缺点是前端只能收到通用 SQL 错误，交互反馈较差。

### D2. 合同签署采用“先校验后提交”的两步流程

- 选择：前端先完成 5 项 checklist（2 项自动 + 3 项人工/系统校验），再进入两步确认弹窗，最后调用 `sign_contract`。
- 原因：符合 interaction spec 的高摩擦要求，可显著降低误签概率。
- 备选：单次 confirm。缺点是不满足不可逆动作的交互约束。

### D3. contract_ref 继续由后端生成并作为唯一展示 ID

- 选择：保留 `CTR-{idea_prefix}-{YYYYMMDD}` 规则，生成逻辑在 Rust 层执行。
- 原因：确保格式与唯一性不依赖前端，避免跨端实现偏差。
- 备选：前端生成后回传。缺点是容易出现客户端时区与格式不一致。

### D4. Evolution 轴以数据库对象为主，UI 仅聚合展示与 gate 控制

- 选择：`evolution_nodes`、`openspec_changes`、`arch_decision_logs` 为主数据源；前端仅实现状态可视化与按钮禁用规则。
- 原因：数据模型已成熟，避免将流程状态散落在前端本地状态。
- 备选：前端临时组合假数据。缺点是后续无法稳定衔接真实执行状态。

### D5. Scope warning 采用“硬阻断 trigger openspec”策略

- 选择：当 `scope_check_status = 'warning'` 时，禁用 trigger 按钮并展示明确 tooltip。
- 原因：这是 interaction spec 的硬规则，可防止边界漂移被绕过。
- 备选：软提醒但允许继续。缺点是破坏产品核心约束。

### D6. 市场信号抓取按指标类型分流，MVP 仅内建 GitHub Stars 自动拉取

- 选择：新增 `market_signals` command，若 `success_metric=github_stars` 则调用 GitHub API；其余指标返回“需外部更新”状态。
- 原因：与 proposal 的范围一致，避免超前引入支付/下载平台接入复杂度。
- 备选：统一抽象多平台 provider。缺点是实现成本高，超出当前阶段。

### D7. 状态迁移由统一评估函数驱动，并可被定时任务与手动触发复用

- 选择：在 Rust 侧实现 `evaluate_idea_status(idea)`：
  - `in_market`: `market_current_value >= target_n`
  - `at_risk`: deadline 剩余天数 < 14 且未达标
  - `force_closed`: deadline 已过且未达标
  - 否则保持 `active`
- 原因：避免把同一规则重复写在多个 command 或前端。
- 备选：每个入口独立写 if-else。缺点是规则易漂移。

### D8. 路由组织延续现有约定：`/routes/_app/ideas/$id/{phase}.tsx`

- 选择：新增 `contract.tsx` 与 `evolution.tsx`，并在 ideas 容器路由下接入。
- 原因：与 feed/intent/boundary/validation 的路径结构一致，便于 PhaseSidebar 统一跳转。
- 备选：独立页面层级。缺点是破坏已有嵌套路由结构。

## Risks / Trade-offs

- [GitHub 权限不足导致合同提交失败] -> Mitigation：签署前增加 repo verify；签署后若 commit 失败，保留已签状态并显示重试入口，避免事务回滚造成语义歧义。
- [市场指标数据延迟导致误判 at_risk] -> Mitigation：记录 `market_last_checked_at`，在 UI 明示“last checked”；提供手动 refresh。
- [scope warning 误报阻断流程] -> Mitigation：支持“intentional expansion”带理由 dismiss，并写入审计字段。
- [状态机规则改动后历史数据不一致] -> Mitigation：提供一次性 backfill command，对 active ideas 重新评估状态。
- [contract 签署后字段编辑入口遗漏] -> Mitigation：前端统一基于 `contract.signedAt` 渲染只读组件，避免散落判断。

## Migration Plan

1. 前端路由与页面
   - 新增 contract/evolution 两个 phase 页面。
   - 更新 ideas phase 导航与当前 phase 自动跳转。

2. Tauri commands
   - 新增 `market_signals.rs`：
     - `refresh_market_signal(idea_id)`
     - `refresh_due_ideas_status()`（启动/定时入口）
   - 在 `commands/mod.rs` 与 `lib.rs` 注册新 command。

3. GitHub 接入复用
   - 合同签署成功后复用 `github_commit_file` 能力提交 `.maestro/contract.json`。

4. 页面交互约束
   - 实现预签 checklist、两步签署、签后只读。
   - 实现 scope warning 阻断 trigger openspec。

5. 验证与回归
   - 合同不可变性：重复签署/修改字段均失败。
   - 状态机：覆盖 deadline 临界、达标、逾期三类场景。
   - Evolution gate：warning 状态下按钮禁用与提示准确。

## Open Questions

1. `url_reachable` 指标在 MVP 是否由桌面端主动探测，还是仅接受手动输入？
2. 合同签署后若 GitHub milestone 创建失败，是否需要独立重试队列而非同步阻塞？
3. `openspec_changes` 的执行状态来源在 v0.1 是本地 mock 还是外部 webhook 回写？
4. 市场信号小时级检查在桌面休眠/离线后是否需要“补跑窗口”策略？
