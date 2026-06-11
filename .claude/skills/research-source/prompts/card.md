# Card 模式 Prompt（v0.3，2026-06-11 PM）

你是研究助手。基于以下资料源的材料，产出一份 Card（速览）。

## 输入

- **资料源 URL**：`{source_url}`
- **资料类型**：`{source_type}`（repo / article / tutorial / course）
- **子类型**：`{source_subtype}`（tutorial / skill_collection / methodology / article / spec / blog / docs / cookbook / framework）
- **受众标签初判**：`{audience_hints}`（3 轴）
- **拉取日期**：`{today}`
- **本地材料路径**：`{materials_path}`（必须用 `wc -m` 实测产物字符数；锚点用 `:L<n>` 行号）

## 材料

{materials}

## 字符上限（**按 source_subtype 严格执行**，Problem 18）

| source_subtype | Card 字符上限 |
|---|---|
| `blog` | ≤ 1500 |
| `article` | ≤ 1800 |
| `docs` | ≤ 2500 |
| `repo`（pure README）| ≤ 1800 |
| `cookbook` | ≤ 2000 |
| `methodology` | ≤ 1800 |
| `tutorial` | ≤ 1800 |
| `skill_collection` | ≤ 2000 |

- 单位：`wc -m`（含 markdown 标记 + frontmatter 后所有内容）
- 超上限：**必须**加 frontmatter `overflow: true`，不要强行压缩

## 受众标签 enum（**硬约束，禁止自由发挥**，Problem 19）

```yaml
audience_tags:
  cs_background: yes | partial | no         # 仅此 3 值
  devops:        low | mid | high           # 仅此 3 值
  cc_experience: newbie | used | advanced   # 仅此 3 值
```

**禁用**：`intermediate` / `beginner` / `required` / `optional` / `high` 用在 cs_background 上 / `mid` 用在 cc_experience 上等任何 enum 外的值。

## 锚点格式（**硬约束**，Problem 22）

- **mdx body 内**：`(docs:L42)` / `(blog:L5)` / `(README:L120)` / `(cookbook:L80)` 等 `({subtype}:L<n>)` 形态
- **sources.json 内 cross_check_anchors**：完整文件路径 `/tmp/research-batch3/{slug}.txt:L42` 或 `.research-cache/{slug}/README.md:L120`
- **mdx 内不允许**出现 `/tmp/*.txt` 或 byte offset（如 `byte:2913`）

## char_count 字段填法（**硬约束**，Problem 21）

写完产物后，**自己跑** `wc -m < {output_path}.mdx | tr -d ' '`，把结果填到 frontmatter `char_count`。**不允许**心算、估算、或基于「markdown 纯文本」自报。

## 输出契约（**完整 sample JSON，按字段填，不要返回 nested JSON**，Problem 23）

subagent 必须返回**完全符合下述形态**的 JSON（每个字段类型已示例）；`card_body_markdown` 是**单个字符串**而非嵌套对象：

```json
{
  "slug": "anth-mcp",
  "output_path": "apps/docs/content/docs/research/anth-mcp.mdx",
  "frontmatter": {
    "title": "anth-mcp",
    "description": "MCP 4 transport / 3 scope / Tool Search / OAuth",
    "slug": "anth-mcp",
    "url": "https://docs.claude.com/en/docs/claude-code/mcp",
    "source_type": "article",
    "source_subtype": "docs",
    "tier": "card",
    "tiers_present": ["card"],
    "status": "card_complete",
    "last_checked": "2026-06-11",
    "last_commit": null,
    "stars": null,
    "license": null,
    "size_estimate": "23KB raw / ~890 lines",
    "audience_tags": {
      "cs_background": "yes",
      "devops": "mid",
      "cc_experience": "used"
    },
    "primary_author": "Anthropic",
    "char_count": 2137,
    "overflow": false,
    "promote_to_brief": null,
    "promote_to_deep_dive": null,
    "fetched_via": "WebFetch",
    "fetched_via_fallback": false,
    "mirror_url": null
  },
  "card_body_markdown": "# anth-mcp\n\n## 一句话定位\n\n> MCP 是 Claude Code 与外部工具 / 数据源 / 提示词共享的标准接口，覆盖 4 种 transport × 3 种 scope。\n\n## 关键 takeaway\n\n1. MCP 支持 4 transport：stdio / SSE / HTTP / WebSocket，每种对应不同部署场景 (docs:L42)。\n2. 3 scope：local / project / user，决定 server 配置可见性 (docs:L88)。\n3. ...\n\n## 参考锚点\n\n- `(docs:L42)` — 4 transport 列表\n- `(docs:L88)` — scope 说明\n",
  "cross_check_anchors": [
    {"anchor": "/tmp/research-batch3/anth-mcp.txt:L42", "verbatim": "4 transport: stdio / SSE / HTTP / WebSocket"},
    {"anchor": "/tmp/research-batch3/anth-mcp.txt:L88", "verbatim": "scope: local / project / user"}
  ],
  "audience_judgment_basis": "cs_background=yes 因 README:L23 假设读者会 JSON config；devops=mid 因覆盖 OAuth 但不深入 K8s；cc_experience=used 因从「已安装 CC」起讲",
  "fetched_via_log": "WebFetch 一抓即成，HTTP 200 body 23KB",
  "exposed_problems": []
}
```

## Body 模板（`card_body_markdown` 字段的内容形态）

```markdown
# {title}

## 一句话定位

> {一句话，≤ 50 字}

## 关键 takeaway

1. {takeaway 1，每条 1-2 句 + (subtype:L<n>) 锚点}
2. {takeaway 2}
3. {takeaway 3}
4. {takeaway 4}（可选）
5. {takeaway 5}（可选）

## 10 维框架自检（**可选**，仅在「值得作为框架验证样本」的源加）

| 维度 | 评分 | 证据 |
|---|---|---|
| 1. 章节信息头标准化 | yes/partial/no/n/a | ... |
| 2. 学习路径分流 | yes/partial/no/n/a | ... |
| ... |  |  |

注：n/a 用于「该维度对本 source_subtype 不适用」的情况，必标不适用理由。

## 与 Claude Code 教程的关联

- {这个源对教程有什么用，1-2 段}

## 参考锚点

- `(subtype:L<n>)` — {内容简述}
- ...
```

## 规则汇总

- **字符上限按 source_subtype 严格执行**（见上表）；超限必标 `overflow: true`
- **不编造**：所有 takeaway 必须来自材料原文或合理推导；引用锚点必须真实存在，**会被 Step 4 cross-check 用 `sed` 反查**
- **受众标签**：必须用 enum 白名单值；判定依据填 `audience_judgment_basis` 字段
- **`source_subtype` 必填**，影响后续 tier 的抽取策略
- **`char_count` 必须 `wc -m` 实测**填写，不允许心算
- **`card_body_markdown` 必为 string**，不允许 nested JSON
- **锚点格式**：mdx 内 `({subtype}:L<n>)`，sources_json 内完整路径
- 如果资料源不可达，输出 frontmatter `status=fetch_failed` + 一行 `URL 占位` body，并标 `promote_to_brief: null`
- 若 fetched_via_fallback=true（geo-block 兜底），必须 `mirror_url` 字段填实际 fallback URL，并在 `exposed_problems` 数组记录原 URL 抓取失败原因
