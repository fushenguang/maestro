---
version: 0.1.0
last_updated: 2026-05-23
normative: true
---

# Maestro Product Boundary Spec

> **权威边界文档。** 所有 change 实现前必须阅读此文件。
> 如任何 change 与此文件冲突，以此文件为准。

---

## 产品核心使命

**在产品长期迭代中维护一份对人和 AI Agent 都干净、唯一的 context，同时强制产品推向市场。**

这不是：
- 通用项目管理工具
- AI 创意生成工具
- 面向大众的低摩擦产品

这是：
- 一个 context integrity 系统（类比：Git 之于代码，Maestro 之于产品方向）
- 高摩擦是有意为之的用户过滤器
- 第一批用户就是开发团队自身（dogfooding）

---

## 产品形态

- **平台**：Tauri v2 桌面应用（macOS 优先）
- **数据主权**：Local-first，数据权威副本在用户本地磁盘
- **网络要求**：需要联网（GitHub OAuth + LLM 调用），不支持离线使用

---

## 阶段管道（Phase Pipeline）

| Phase | 名称 | 完成条件 | 关键输出 |
|---|---|---|---|
| 0 | Feed | feed_completed_at 设置 | problem_statement_draft |
| 1 | Intent Dialogue | clarity ≥ 85 且 open_questions = 0 | intent_canvas（锁定） |
| 2 | Boundary Definition | 所有 scope_items 确认，boundary_locked_at 设置 | .maestro/boundary.json |
| 3 | Validation Gate | 双重 LLM pass 完成，verdict 设置 | validation_report（advocate + prosecutor） |
| 4 | Product Contract | contract_signed_at 设置（不可逆） | .maestro/contract.json |
| 5 | Evolution | contract 签署后解锁，持续迭代 | openspec changes in target repo |

---

## v0.1 范围

### IN SCOPE

- 6 个 Phase 完整 pipeline UI
- GitHub OAuth 登录（已实现）
- Tauri desktop shell（已实现）
- SQLite 本地存储 + Supabase 远端同步
- LLM 模型池（用户自己提供 API key，存 Tauri secure store）
  - 首批接入：MiniMax、DeepSeek（OpenAI-compatible API）
- Dashboard（产品列表 + stats）
- 状态机 + deadline 追踪
- 双重验证（advocate + prosecutor 两次独立 LLM pass）
- 合同不可变约束（Rust 应用层强制）
- .maestro/ 文件提交到目标 GitHub repo
- 用户类型区分字段（technical / domain_expert），数据层 seed，UI 暂不区分

### OUT OF SCOPE（v0.1 不做，不得因"顺手"而加入）

- 非技术用户 UX（language bridge、simplified labels 等）→ v0.2
- 中国市场信号（微信支付、国内平台指标）→ 专项讨论后再排期
- 多用户协作 / 团队功能
- 移动端（iOS / Android）
- CLI 接口
- 公开 API / webhook 接入
- 多语言 i18n
- 付费/订阅体系

---

## 架构决策（已锁定）

| 决策 | 结论 | 原因 |
|---|---|---|
| 本地存储 | SQLite via tauri-plugin-sql | 成熟、支持聚合查询、Tauri 生态完整 |
| 合同不可变 | Rust 应用层检查（非 DB trigger） | 比 DB trigger 更可靠，Rust 类型系统保障 |
| Supabase 角色 | 远端 sync 目标，非主读写路径 | Local-first 原则，RLS 在本地无意义 |
| LLM 接入 | 统一 OpenAI-compatible API + 模型池路由 | 可插拔，支持国内外多 provider |
| API Key 管理 | 方案 A：用户自管，存 Tauri keychain | 第一批用户=自己团队，最简实现 |
| 产品管道产物 | 提交到目标 repo .maestro/ 目录 | AI Agent 可消费，有 git 历史审计 |

---

## 文档参考优先级

1. 本文件（`openspec/specs/product.md`）— 产品边界权威
2. `openspec/config.yaml` — agent context 注入（机器读取）
3. `docs/references/mvp/` — UI/交互/数据规格（详细实现参考）
4. `docs/architecture/vision.md` — 架构愿景

> 注意：`docs/references/SPEC.md`、`docs/references/AGENTS.md`、`docs/references/WORKFLOW.md`
> 是早期 Symphony orchestrator 系统的遗留文档，**不代表当前产品方向**，勿作为实现依据。

---

## Open Questions（待决策，不阻塞 v0.1）

| 问题 | 状态 |
|---|---|
| 中国市场 success_metric 类型扩展 | 占位，待专项讨论 |
| Supabase 在中国的访问稳定性 | 占位，待真实用户测试后评估 |
| Evolution Phase 的 openspec changes 如何与桌面 UI 集成 | v0.1 后期详细设计 |
| .maestro/ 格式标准化（供外部 Agent 消费）| v0.2 |
