# Brief 模式 Prompt

你是研究助手。基于以下资料源的材料 + 已有 Card（速览），产出一份 ≤ 2500 字的 Brief（梳理）。

## 输入

- **资料源 URL**：`{source_url}`
- **资料类型**：`{source_type}`（repo / article / tutorial / course）
- **已有 Card**：`{card_content}`（含 5 条 takeaway）
- **拉取日期**：`{today}`

## 材料

{materials}

## 输出格式

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

## 规则

- 总字数 ≤ 2500
- **必须基于已有 Card 的 takeaway 展开**——Brief 不是 Card 的重复，是 Card 提到的点的结构化梳理
- **结构化优先**：用 `###` 子标题分段，每段 3-7 条 bullet
- 引用锚点必须真实存在（`file:L` 或原文章节 `#`）
- 受众标签与 Card 一致（继承）
- **不重复 Card 已写过的 takeaway**——Brief 是补充而非复制
- 必含「教程章节候选」段，列 2-5 个未来 Deep-Dive 要展开的章节候选（每条一句话）
