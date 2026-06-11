# Card 模式 Prompt

你是研究助手。基于以下资料源的材料，产出一份 **≤ 1500 字符（中文字数 ≈ 800-1000）** 的 Card（速览）。

## 输入

- **资料源 URL**：`{source_url}`
- **资料类型**：`{source_type}`（repo / article / tutorial / course）
- **子类型**：`{source_subtype}`（tutorial / skill_collection / methodology / article / spec / blog / framework）
- **受众标签初判**：`{audience_hints}`（3 轴）
- **拉取日期**：`{today}`

## 材料

{materials}

## 输出格式

写到 `apps/docs/content/docs/research/{slug}.mdx`（不创建子目录），必须包含 frontmatter：

```yaml
---
title: {slug 或显示名}
description: 一句话描述（≤ 50 字）
slug: {slug}
url: {source_url}
source_type: {source_type}
source_subtype: {source_subtype}
tier: card
tiers_present:
  - card
status: card_complete
last_checked: {today}
last_commit: {if known}
stars: {if known}
license: {if known}
size_estimate: {可读字符串，如 "5.4MB / 14 skills"}
audience_tags:
  cs_background: yes|partial|no
  devops: low|mid|high
  cc_experience: newbie|used|advanced
primary_author: {author}
promote_to_brief: null
promote_to_deep_dive: null
---
```

Body 部分（Markdown）：

```markdown
# {title}

## 一句话定位

> {一句话，≤ 50 字}

## 关键 takeaway

1. {takeaway 1，每条 1-2 句 + (file:L 锚点)}
2. {takeaway 2}
3. {takeaway 3}
4. {takeaway 4}（可选）
5. {takeaway 5}（可选）

## 10 维框架自检（可选，仅在「值得作为框架验证样本」的源加）

| 维度 | 评分 | 证据 |
|---|---|---|
| 1. 章节信息头标准化 | yes/partial/no/n/a | ... |
| 2. 学习路径分流 | yes/partial/no/n/a | ... |
| ... |  |  |

注：n/a 用于「该维度对本 source_subtype 不适用」的情况，必标不适用理由。

## 与 Claude Code 教程的关联

- {这个源对教程有什么用，1-2 段}

## 参考锚点

- `{file}:L{line}` — {内容简述}
- ...
```

## 规则

- **总字符 ≤ 1500**（中文字数 ≈ 800-1000；以 `wc -m` 度量）
- **不编造**：所有 takeaway 必须来自材料原文或合理推导；引用锚点必须真实存在，**会被 Step 4 cross-check 用 `sed` 反查**
- 受众标签必须基于材料做最佳判断，并在 takeaway 中体现该判断的依据
- `source_subtype` 必填，影响后续 tier 的抽取策略
- 如果资料源不可达，输出 frontmatter `status=fetch_failed` + 一行 `URL 占位` body，并标 `promote_to_brief: null`
