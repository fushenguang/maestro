# Brief 模式 Prompt（v0.3，2026-06-11 PM）

你是研究助手。基于以下资料源的材料 + 已有 Card（速览），产出一份 Brief（梳理）。

## 输入

- **资料源 URL**：`{source_url}`
- **资料类型**：`{source_type}`（repo / article / tutorial / course）
- **子类型**：`{source_subtype}`
- **已有 Card**：`{card_content}`（含 5 条 takeaway + 可选框架自检）
- **拉取日期**：`{today}`

## 材料

{materials}

## 字符上限（**按 source_subtype 严格执行**，Problem 18）

| source_subtype | Brief 字符上限 |
|---|---|
| `blog` | ≤ 3000 |
| `article` | ≤ 3000 |
| `docs` | ≤ 3500 |
| `repo`（pure README）| ≤ 3000 |
| `cookbook` | ≤ 3500 |
| `methodology` | ≤ 3000 |
| `tutorial` | ≤ 3500 |
| `skill_collection` | ≤ 3500 |

- 单位：`wc -m`（含 Brief 段完整 markdown）
- 超上限：必须加 frontmatter `overflow: true`

## 受众标签 enum / 锚点格式 / char_count 字段（**沿用 card.md 同名规则**）

见 `card.md` 同名段。Brief 不放宽：enum 白名单同样硬约束、锚点 `({subtype}:L<n>)`、`char_count` 必 `wc -m` 实测。

## 输出契约（sample JSON，body 是字符串）

```json
{
  "slug": "anth-mcp",
  "output_path": "apps/docs/content/docs/research/anth-mcp.mdx",
  "frontmatter_updates": {
    "tier": "brief",
    "tiers_present": ["card", "brief"],
    "status": "brief_complete",
    "char_count": 5450,
    "overflow": false
  },
  "brief_body_markdown": "## Brief（梳理）\n\n### transport 选型决策\n\n- stdio: ...\n- SSE: ...\n- ...\n\n### 教程章节候选（Deep-Dive 阶段会展开）\n\n- transport 选型决策表 (docs:L42)\n- ...\n",
  "cross_check_anchors": [
    {"anchor": ".research-cache/anth-mcp.txt:L42", "verbatim": "..."}
  ],
  "exposed_problems": []
}
```

## Body 模板（`brief_body_markdown` 字段内容形态）

**追加**到 `{card_path}` 文件的 Card 段之后（不创建新文件），以 `## Brief（梳理）` 开头：

```markdown
## Brief（梳理）

### {结构梳理标题 1}

- {点 1}
- {点 2}
- {点 3}

### {结构梳理标题 2}

- ...

### {跨源关联 / 适用场景 / 触发条件等}

...

### 教程章节候选（Deep-Dive 阶段会展开）

- {candidate 1}: {一句话说明}
- {candidate 2}: {一句话说明}
```

同时 frontmatter 更新：
- `tier: brief`
- `tiers_present: [card, brief]`
- `status: brief_complete`

## 规则汇总

- **总字符按 source_subtype 上表**；超限必标 `overflow: true`
- **必须基于已有 Card 的 takeaway 展开**——Brief 不是 Card 的重复，是 Card 提到的点的结构化梳理
- **结构化优先**：用 `###` 子标题分段，每段 3-7 条 bullet
- 引用锚点必须真实存在（`({subtype}:L<n>)` 或原文章节 `#`）
- 受众标签与 Card 一致（继承），不允许重写
- **不重复 Card 已写过的 takeaway**——Brief 是补充而非复制
- **必含「教程章节候选」段**，列 2-5 个未来 Deep-Dive 要展开的章节候选（每条一句话）
- 对竞品类源（与本教程直接对标）**必含「跨源关联」段**对比 superpowers / 其他锚点源的角色分工
- **`brief_body_markdown` 必为 string**，不允许 nested JSON
- **`char_count` 字段**填整个 mdx 文件（含已合并的 Card 段）的 `wc -m` 实测值
