# SESSION HANDOFF — Claude Code 调研流水线

> 本次 session：2026-06-11（全天）
> 上次 session：2026-06-10 → 2026-06-11 早晨（已合并到本文件）
> 下一 session 启动建议：先读本文件 + `LEARNINGS.md`，再决定从哪里继续

---

## 0. TL;DR（本次 session 完成）

- **跑通 2 个新源**（第 3 + 第 4 源）：`ai-coding-guide-zh`（Card + Brief + Deep-Dive，作为「锚点源」+「评估框架来源」）+ `alirezarezvani/claude-skills`（Card，作为「框架 discriminate 验证样本」）
- **触发并完成「跑完 2 源后回头修 Skill」里程碑**：一次性收敛 9 项 + 3 项新发现到 SKILL.md + 3 个 prompts/*.md
- **新增 LEARNINGS Section 8.5 / 8.6 / 9**（4 个新 Problem：HTTP2 fallback / 字符上限校准 / 反例≥5 条 / 框架按 subtype 适配 / skill_collection 必读 CLAUDE.md / Card 框架自检段可选）
- **三种 source_subtype 全覆盖**（tutorial / methodology / skill_collection / blog），10 维评估框架经三角验证可信
- **下一 session 决策点**：继续跑源 vs 开 OpenSpec change 做教程大纲生成（推荐后者，证据已充分）

---

## 1. 当前累计状态

### 1.1 文档站点（apps/docs）

| 路由 | 内容 | 状态 |
|---|---|---|
| `/docs/research` | 研究参考 landing | 200 |
| `/docs/research/superpowers` | superpowers 全 3 层 | 200 |
| `/docs/research/claude-skills-blog` | claude-skills-blog 仅 Card | 200 |
| `/docs/research/ai-coding-guide-zh` | **本 session 新**：Card + Brief + Deep-Dive | 200 |
| `/docs/research/alirezarezvani-claude-skills` | **本 session 新**：Card（含框架自检） | 200 |

dev server 应仍在跑（PID 32094 节点）；不在就 `cd apps/docs && pnpm dev`。

### 1.2 累计 4 源覆盖矩阵

| 源 | type / subtype | tier_current | 主要价值 |
|---|---|---|---|
| 1. superpowers | repo / methodology | deep-dive | 工程方法论 14 个 skill 体系 |
| 2. claude-skills-blog | article / blog | card | Anthropic 一手设计哲学（design rationale） |
| 3. **ai-coding-guide-zh** | repo / tutorial | deep-dive | **锚点源**：10 维评估框架来源 + 章节命名「沿用 vs 错位」决策表 |
| 4. **alirezarezvani-claude-skills** | repo / skill_collection | card | **框架 discriminate 验证样本**；工程治理参考 |

### 1.3 Skill 状态（**本 session 收敛后**）

- `.claude/skills/research-source/SKILL.md` — **大改**：
  - 加 `--subtype` 参数
  - Step 1 加 HTTP/1.1 fallback
  - Step 2 重写为「tier × source_subtype 阅读量矩阵」（4×4 表）
  - 新增「字符上限实测基线」段
  - 新增硬约束 #8（source_subtype 必填）+ #9（框架按 subtype 适配）
- `.claude/skills/research-source/prompts/card.md` — 字符上限 800 → 1500；加 source_subtype；加「框架自检（可选）」段
- `.claude/skills/research-source/prompts/brief.md` — 字符上限 2500 → 3000；加 source_subtype；竞品源必含跨源关联
- `.claude/skills/research-source/prompts/deep-dive.md` — 字符上限 5000 → 8000；反例 ≥ 5 条 + 启示转化；新增「沿用 vs 错位决策表」（竞品源必含）+「框架自检规范」段

### 1.4 LEARNINGS / 闸门状态

- LEARNINGS.md 已扩展到 Section 9，含 16 个 Problem + 4 源沉淀
- `registry.json`：`schema_version: 2026-06-11`，4 源全部 `card_complete` 以上
- Gate 1 已完成（所有 4 源都有 Card）；Gate 2 完成 1 源（ai-coding-guide-zh）+ 1 源待推广（claude-skills-blog 评估中）

---

## 2. 下一 session 决策点

### 2.1 推荐路径 A：开 OpenSpec change 启动教程大纲生成

**理由**：
- 4 源 + 10 维框架 + 「沿用 vs 错位决策表」证据已充分
- 不必再跑多源（边际收益递减；框架已经三角验证）
- Deep-Dive 主题 4 已经给出 13 章决策表 + 5 个新增章节方向——直接可作为 change proposal 的 spec.md 输入

**步骤**：
1. `openspec/changes/draft-tutorial-outline-v0/` 新建 change
2. proposal.md：引用 `ai-coding-guide-zh.mdx` Deep-Dive 主题 4 + 「我们的差异化机会」7 条盲点
3. design.md：基于 10 维框架 + 沿用决策表 + 反面盲点扫描，给出章节大纲 v0.1
4. tasks.md：教程章节产出任务列表（章节信息头 / 路径分流 / 术语表 / 风险速查等模板复用）

### 2.2 备选路径 B：再跑 1-2 源做框架 v0.2 验证

**理由**：
- Problem 14 暴露的「框架对非 tutorial 源不公平」需要更多样本验证
- 推荐源：`anthropics/anthropic-cookbook`（官方 cookbook，code-recipe subtype，全新拓扑）或一个 spec/RFC 类源（验证「无教学结构」的 n/a 标记机制）

**注**：路径 B 是「锦上添花」，不是阻塞项；路径 A 可以并行做。

### 2.3 备选路径 C：把 10 维框架抽到 `research/frameworks/`（Problem 12）

**条件**：等积累 2-3 个不同评估框架（如「教程评估框架」+「skill collection 评估框架」+「设计 rationale 评估框架」）再抽；目前只 1 个，**不够**。

---

## 3. 启动前 Checklist（新 session）

- [ ] 读本文件
- [ ] 读 `LEARNINGS.md` Section 9（最新沉淀）
- [ ] 读 `.claude/skills/research-source/SKILL.md`（**重点新硬约束 #8 / #9**）
- [ ] 看 `registry.json` 当前状态（4 源 + output_dir + source_subtype 字段）
- [ ] 看 `apps/docs/content/docs/research/ai-coding-guide-zh.mdx` Deep-Dive 主题 4（章节决策表）
- [ ] 确认 dev server 是否还在跑；不在就 `cd apps/docs && pnpm dev`
- [ ] **决定路径 A vs B vs C**（推荐 A：开 OpenSpec change）

---

## 4. 关键决策记录（避免重做）

| 决策 | 选择 | 理由 |
|---|---|---|
| 目录命名 | ASCII slug | 解决 Fumadocs 中文 slug bug |
| 侧边栏标题 | meta.json 控制，中文 | 满足「URL 英文、标题中文」 |
| 文件结构 | 1 源 = 1 .mdx（3 段）+ 1 .json | 2 层路由，扁平 |
| 三层组织 | 同一 .mdx 文件 3 段 | 路由限制 + 字数可控 |
| 跑源节奏 | 1 源全流程 → 沉淀 → 2-3 源验证 → 收敛 Skill | 小步快跑、暴露问题 |
| Skill 路径 | 参数化（registry.json 读） | 跨项目可移植 |
| 闸门 review | registry.json 标 promote_to_* | 机器可读、可追溯 |
| **source_subtype 字段必填**（新） | tutorial / skill_collection / methodology / article / ... | 影响 Step 2 阅读量策略 + Deep-Dive 框架适配 |
| **框架按 subtype 适配**（新） | yes/partial/no/n/a 四档；n/a 必标不适用理由 | 避免对非 tutorial 源 unfair scoring |
| **字符上限校准**（新） | Card 1500 / Brief 3000 / Deep-Dive 8000 | 实测基线，硬限作为目标 |
| **「跑完 2 源后回头修 Skill」是 milestone**（新） | 一次性收敛而非碎片更新 | 避免每跑一源就改一次的开销 |

---

## 5. 已知坑（必看）

1. **Fumadocs 中文 slug bug** → 路径用 ASCII
2. **WebFetch 拦 claude.com** → curl + Python fallback
3. **gh clone HTTP2 framing 偶发** → `git -c http.version=HTTP/1.1` 强制（已合并到 SKILL.md）
4. **MDX 不支持 `{#id}`** → 用 plain heading
5. **`.md` 文件不能放 `content/docs/`** → 非页面文档放 `apps/docs/` 根
6. **registry.json 与 index.mdx 双重维护** → 短期靠人，将来脚本化
7. **LLM 输出的 takeaway 真实性** → Step 4 必用 `sed` cross-check 2-3 条
8. **巨型 repo（>30MB）必走抽样**：不要 `find . -name "SKILL.md"` 全扫；用 `head -10` 抽样（已合并到 SKILL.md Step 2）
9. **skill_collection 类型源 Card 必读 CLAUDE.md / AGENTS.md**：README 往往是 marketing 入口，工程治理信号在 CLAUDE.md（已合并到 SKILL.md Step 2 矩阵）
10. **10 维评估框架对非 tutorial 源不公平**：评 n/a 而非 no（已合并到 SKILL.md 硬约束 #9 + prompts/deep-dive.md）
