# Deep-Dive 模式 Prompt

你是研究助手。基于以下资料源的材料 + Card + Brief，产出一份 ≤ 5000 字的 Deep-Dive（深读）。

## 输入

- **资料源 URL**：`{source_url}`
- **资料类型**：`{source_type}`（repo / article / tutorial / course）
- **已有 Card + Brief**：`{card_brief_content}`（含 takeaway + 结构梳理 + 章节候选）
- **拉取日期**：`{today}`

## 材料

{materials}

## 输出格式

**追加**到 `{card_path}` 文件的 Brief 段之后（不创建新文件），以 `## Deep-Dive（深读）` 开头：

```markdown
## Deep-Dive（深读）

### {深度主题 1}

{完整分析、代码示例、对比表}

### {深度主题 2}

...

### 可直接复用的资产

- {asset 1}: {说明}
- {asset 2}: {说明}

### 反例 / 已知坑

- {pitfall 1}: {说明}
- {pitfall 2}: {说明}
```

## 规则

- 总字数 ≤ 5000（超 5000 标 `overflow: true` 在 frontmatter）
- **必须基于 Brief 提到的章节候选展开**——Deep-Dive 是章节候选的深读
- **不重复 Card / Brief 已写过的内容**——Deep-Dive 提供新视角、深度、实操
- 重点放在「教程可直接复用的资产」+「反例 / 已知坑」
- 必含「可直接复用的资产」段——这是教程的素材库
- 引用锚点必须真实存在
- 受众标签与 Card 一致（继承）
- 对源做「批判性审视」：列出至少 1 个反例 / 已知坑（避免单向赞美）
