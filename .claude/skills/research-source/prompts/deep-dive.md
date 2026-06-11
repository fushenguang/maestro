# Deep-Dive 模式 Prompt

你是研究助手。基于以下资料源的材料 + Card + Brief，产出一份 **≤ 8000 字符（中文字数 ≈ 4000-5000）** 的 Deep-Dive（深读）。

## 输入

- **资料源 URL**：`{source_url}`
- **资料类型**：`{source_type}`（repo / article / tutorial / course）
- **子类型**：`{source_subtype}`（决定本 prompt 的若干段是否必含）
- **已有 Card + Brief**：`{card_brief_content}`（含 takeaway + 结构梳理 + 章节候选）
- **拉取日期**：`{today}`

## 材料

{materials}

## 输出格式

**追加**到 `{card_path}` 文件的 Brief 段之后（不创建新文件），以 `## Deep-Dive（深读）` 开头：

```markdown
## Deep-Dive（深读）

### 主题 1：{深度主题 1，例如「评估框架自检 / 复用资产清单 / 设计哲学溯源」}

{完整分析、代码示例、对比表}

### 主题 2：{深度主题 2}

...

### 主题 N：批判性审视 —— 反面分析（**必含**）

> 列出**至少 5 条**盲点 / 视角单一处 / 深度缺失，每条配「对我们的启示」做转化。
> 不接受单向赞美。

#### 盲点 1：{症状}

**症状**：...
**对照**：（与其他源对比，证据点）
**对我们的启示**：...

#### 盲点 2-5：（同上结构）

### 主题 N+1：「沿用 vs 错位」决策表（**仅对竞品类源必含**）

> 若本源与我们要写的教程直接对标（如 source_subtype = `tutorial` 且覆盖 Claude Code），必含此段。
> 给本源的每章 / 每模块逐条标记：「沿用 / 沿用 + 加深 / 错位重写 / 跳过 / 新增」+ 理由。

| 本源章节 / 模块 | 我们的策略 | 理由 |
|---|---|---|
| ... | ... | ... |

### 可直接复用的资产

- {asset 1}: {说明 + file:L}
- {asset 2}: {说明}

### 反例 / 已知坑

- {pitfall 1}: {说明}
- {pitfall 2}: {说明}
```

同时 frontmatter 更新：
- `tier: deep-dive`
- `tiers_present: [card, brief, deep-dive]`
- `status: deep-dive_complete`
- 若 body 段 > 8000 字符，加 `overflow: true`

## 规则

- **总字符 ≤ 8000**（中文字数 ≈ 4000-5000；以 `wc -m` 度量）；超 8000 必加 frontmatter `overflow: true`
- **必须基于 Brief 提到的章节候选展开**——Deep-Dive 是章节候选的深读
- **不重复 Card / Brief 已写过的内容**——Deep-Dive 提供新视角、深度、实操
- 重点放在「教程可直接复用的资产」+「反例 / 已知坑」+「批判性审视」
- 必含「批判性审视」段，**反例 / 盲点不少于 5 条**，每条配「对我们的启示 / 差异化机会」转化
- 必含「可直接复用的资产」段——这是教程的素材库
- **对竞品类源**（与我们教程直接对标，source_subtype = `tutorial` 且覆盖 Claude Code）：必含「沿用 vs 错位决策表」段
- **对 skill_collection / methodology 源**：「沿用 vs 错位决策表」段可省略，但必含「框架自检」段（套用已有评估框架，标 yes/partial/no/n/a）
- 引用锚点必须真实存在，Step 4 会用 `sed` cross-check 3-5 条
- 受众标签与 Card 一致（继承）

## 框架自检规范（新增 2026-06-11）

- 若引用 ai-coding-guide-zh Deep-Dive 主题 1 的「10 维度教程评估框架」，标 `framework_version: v0.1`
- **维度评分用 yes/partial/no/n/a 四档**，n/a 用于「该维度对本 source_subtype 不适用」（必标不适用理由）
- 给评分分布数（如 5 yes / 3 partial / 2 no / 0 n/a），并解释「与其他源的强弱面对比」是否说明框架能 discriminate
- 若发现框架本身的盲点（如某维度对当前 source_subtype 不公平），写在 Deep-Dive 末尾「框架反思」一段，作为 v0.2 改进输入
