---
name: research-source
description: |
  研究一个资料源（GitHub repo / 文章 / 教程）并产出 Card（速览）/ Brief（梳理）/ Deep-Dive（深读）。
  在用户提到「研究 X」、「写 card」、「出 brief」、「deep-dive」、「调研这个 repo」时使用。
---

# research-source Skill

按 `apps/docs/content/docs/research/` 目录约定，对一个资料源产出指定 tier 的研究产物。

## 参数

调用方式：

```
/research-source <source_url> --tier=<card|brief|deep-dive> [--type=repo|article|tutorial] [--audience-hints=<cs,devops,cc>]
```

| 参数 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `source_url` | 是 | — | GitHub repo URL / 文章 URL / 教程首页 URL |
| `--tier` | 否 | `card` | 输出层级（card / brief / deep-dive；同一源不同时跑两次卡，可加 `--tier=card,brief,deep-dive` 一次性出三层） |
| `--type` | 否 | 推断 | 资料类型（repo / article / tutorial / course） |
| `--audience-hints` | 否 | null | 3 轴受众标签初判，逗号分隔 |

## 行为

### Step 1：拉取（**注意 WebFetch 白名单**）

- **repo**：`gh repo clone {url} .research-cache/{slug}`，失败回退 `git clone`
- **article / tutorial / course**：`WebFetch {url}`，**若失败且域名匹配 `claude.com` / `anthropic.com` / `claude.ai`** → 回退到：
  ```bash
  curl -sL {url} -o /tmp/{slug}.html
  python3 -c "import re,html; t=open('/tmp/{slug}.html').read(); m=re.search(r'<article[^>]*>(.*?)</article>',t,re.DOTALL) or re.search(r'<main[^>]*>(.*?)</main>',t,re.DOTALL); b=m.group(1) if m else t; t=re.sub(r'<style[^>]*>.*?</style>|<script[^>]*>.*?</script>|<svg[^>]*>.*?</svg>','',b,flags=re.DOTALL); t=re.sub(r'<[^>]+>',' ',t); print(re.sub(r'\\s+',' ',html.unescape(t)))" > /tmp/{slug}.txt
  ```

### Step 2：抽取

- **repo**：读 `README.md` + 顶层 `*.md` + 探测 `SKILL.md` / `AGENTS.md` / `package.json` / `docs/`
- **article / tutorial / course**：抓正文，识别章节、代码块、引用

### Step 3：大小控制

- 累计材料 > 200KB 时截断（仅 README + 顶层 5 个 .md + 目录树）
- 单个 LLM 调用的 prompt 总输入（含材料）≤ 80K tokens

### Step 4：LLM 调用

- 用 `prompts/{tier}.md` 模板 + 上面材料
- LLM 默认 MiniMax-M3（团队环境配置）
- 温度：card=0.3，brief=0.3，deep-dive=0.4

### Step 5：校验

- 对照对应 tier 的 schema 检查 frontmatter
- 必填字段缺失 → 自纠正重试 1 次 → 失败标 `status=llm_invalid` 排队等人工
- **重要**：takeaway 必须基于材料原文，引用锚点（`file:L`）必须真实存在；LLM 跑完要 cross-check 1-2 条

### Step 6：落盘（**单文件三段式**）

- **单源单文件**：`apps/docs/content/docs/research/{slug}.mdx`
  - 若同一次跑多层，**合并**到一个文件：frontmatter 用 `tiers_present: [card, brief, deep-dive]` 标识，body 用 `## Card` / `## Brief` / `## Deep-Dive` 三段
- **数据 sibling**：`apps/docs/content/docs/research/{slug}.json`（与 .mdx 同级，无文件夹）
- **不创建** `{slug}/` 子目录（与早期设计不同，扁平化以减少侧边栏层级）
- **更新** `apps/docs/content/docs/research/registry.json`（源注册表，加新行）
- **更新** `apps/docs/content/docs/research/index.mdx`（侧边栏表格，**与 registry.json 同步**）
- **更新** `apps/docs/content/docs/research/meta.json`（在 `pages` 数组加 `"slug"`，保持 sidebar 顺序）

### Step 7：自报

输出到调用方：

- 产物文件路径
- 前 200 字摘要
- frontmatter 校验结果
- 受众标签的判定依据
- 「下一步建议」一段话

## 输出契约

每次调用产出：

1. 1 个 `.mdx` 产物（Card / Brief / Deep-Dive 三段合一）
2. 1 个 `.json` sibling（sources 数据）
3. 3 处元数据更新（`registry.json` + `index.mdx` + `meta.json` 的 `pages` 数组）

## 闸门 review 机制

| 闸门 | 触发 | 人工动作 | 标志字段 |
|---|---|---|---|
| Gate 1 → 2 | 所有源完成 Card | 挑「值得升级到 Brief」的子集 | `registry.json` 标 `promote_to_brief: true` |
| Gate 2 → 3 | 推广子集完成 Brief | 挑「值得做 Deep-Dive」的子集 | `registry.json` 标 `promote_to_deep_dive: true` |

**不**靠 PR 评论 / Slack / 口头决定——所有闸门决策落在 `registry.json` 字段，机器可读、可追溯。

## 硬约束（违反 = 产物作废）

> 这些是 2026-06-10/11 superpowers 跑通时踩过的坑，**禁止再犯**。

### 1. 路径 / slug 约束

- **所有源目录名、URL slug 用 ASCII**（Fumadocs loader 中文 slug 兼容性 bug：会把中文存为 URL-encoded 形式，与 Next.js URL-decoded `params.slug` 对不齐）
- **meta.json 的 `title` 可用中文**（侧边栏显示），但**不要与 frontmatter `title` 重复**（避免 sidebar 出现 `研究参考 → 研究参考` 冗余）
- **`.md` 非页面文件不放 `content/docs/`**（Fumadocs-mdx 会当页面扫要求 frontmatter）；非页面文档放 `apps/docs/` 根或仓库其他位置

### 2. 文件结构约束

- **每源 = 1 个 .mdx + 1 个 .json**，扁平放在 `research/{slug}.mdx` 和 `research/{slug}.json`
- **三层内容（Card/Brief/Deep-Dive）放在同一个 .mdx 文件**的 `## Card` / `## Brief` / `## Deep-Dive` 段
- **不**为每源建子目录（避免 sidebar 多层冗余）

### 3. MDX 语法禁忌

- **不要用 `{#id}`**（Pandoc/GFM 语法，MDX 不支持，会 500）
- **不要用 `:::warning` 等 GFM 容器**——用 fumadocs-ui 的 `<Callout>` / `<Cards>` / `<Card>` 组件
- **不要内嵌 `<script>`**

### 4. WebFetch fallback 必加

- 域名 `claude.com` / `anthropic.com` / `claude.ai` **预知**需要走 curl + Python 解析路径
- Step 1 的 fallback 块是**强制的**，不要省略

### 5. Skill 路径参数化（**重要改进**）

- 实际输出目录可能不是 `apps/docs/content/docs/research/`（将来可能换项目、换 monorepo）
- `apps/docs/content/docs/research/registry.json` 加 `output_dir` 字段
- Skill 启动时读 registry.json 的 `output_dir`，**不**写死默认值
- 当前默认值：`apps/docs/content/docs/research/`

### 6. 单一真相源

- **`registry.json` 是源列表唯一真相源**
- `index.mdx` 的表格是它的视图
- `meta.json` 的 `pages` 数组是它的 sidebar 投影
- 三处必须同步更新（暂时靠人；将来脚本化）

### 7. 受众标签必填

- 每个源 3 轴标签都必填：`cs_background: yes/partial/no`，`devops: low/mid/high`，`cc_experience: newbie/used/advanced`
- 标签判定依据要在 Card 的 takeaway 里能追溯到（不要瞎标）

## 相关文件

- `prompts/card.md` — Card 模式 prompt
- `prompts/brief.md` — Brief 模式 prompt
- `prompts/deep-dive.md` — Deep-Dive 模式 prompt
- 闸门 review：`registry.json` 字段 `promote_to_brief` / `promote_to_deep_dive` 决定下一闸跑谁
- 历史教训：`apps/docs/LEARNINGS.md`
- session 交接：`apps/docs/SESSION_HANDOFF.md`
