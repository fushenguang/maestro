---
name: research-source
description: |
  研究一个资料源（GitHub repo / 文章 / 教程 / skill collection）并产出 Card（速览）/ Brief（梳理）/ Deep-Dive（深读）。
  在用户提到「研究 X」、「写 card」、「出 brief」、「deep-dive」、「调研这个 repo」时使用。
---

# research-source Skill

按 `apps/docs/content/docs/research/` 目录约定，对一个资料源产出指定 tier 的研究产物。

## 参数

调用方式：

```
/research-source <source_url> --tier=<card|brief|deep-dive> [--type=repo|article|tutorial|course] [--subtype=tutorial|skill_collection|methodology|article|...] [--audience-hints=<cs,devops,cc>]
```

| 参数 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `source_url` | 是 | — | GitHub repo URL / 文章 URL / 教程首页 URL |
| `--tier` | 否 | `card` | 输出层级（card / brief / deep-dive；同一源不同时跑两次卡，可加 `--tier=card,brief,deep-dive` 一次性出三层） |
| `--type` | 否 | 推断 | 资料类型（repo / article / tutorial / course） |
| `--subtype` | 否 | 推断 | 子类型（tutorial / skill_collection / methodology / article / spec / blog ...）—— 影响 Step 2 阅读量策略 + Deep-Dive 框架适配 |
| `--audience-hints` | 否 | null | 3 轴受众标签初判，逗号分隔 |

## 行为

### Step 1：拉取（**注意 WebFetch 白名单 + gh clone fallback**）

- **repo（推荐顺序）**：
  1. `gh repo clone {url} .research-cache/{slug} -- --depth=1`
  2. 失败回退（**HTTP/2 framing error 是已知偶发**）：`git -c http.version=HTTP/1.1 clone --depth=1 {url} .research-cache/{slug}`
  3. 仍失败：报错前先 retry 2 次，间隔 5 秒
  4. **务必**记录到 sources.json 的 `fetched_via` 字段，标注用了哪条路径
- **article / tutorial / course**：`WebFetch {url}`，**若失败且域名匹配 `claude.com` / `anthropic.com` / `claude.ai`** → 回退到：
  ```bash
  curl -sL {url} -o /tmp/{slug}.html
  python3 -c "import re,html; t=open('/tmp/{slug}.html').read(); m=re.search(r'<article[^>]*>(.*?)</article>',t,re.DOTALL) or re.search(r'<main[^>]*>(.*?)</main>',t,re.DOTALL); b=m.group(1) if m else t; t=re.sub(r'<style[^>]*>.*?</style>|<script[^>]*>.*?</script>|<svg[^>]*>.*?</svg>','',b,flags=re.DOTALL); t=re.sub(r'<[^>]+>',' ',t); print(re.sub(r'\\s+',' ',html.unescape(t)))" > /tmp/{slug}.txt
  ```

### Step 2：抽取 + 「tier × source_subtype 阅读量矩阵」

读取策略**按 tier 和 source_subtype 双轴决定**，避免 Card 阶段就吃掉整个 repo：

| Tier ↓ / Subtype → | `methodology`（skill 方法论包） | `tutorial`（教程 repo） | `skill_collection`（巨型 skill 库） | `article`（单篇文章） |
|---|---|---|---|---|
| **Card** | README + 1-2 个核心 SKILL.md | README + CHANGELOG + 1 篇代表性章节抽样 | README + CLAUDE.md / AGENTS.md（**重要！**） + 域目录树 | 抓全文 |
| **Brief** | README + 全部 SKILL.md（精读） | README + 全部章节 H1/H2 + 3-5 篇代表性章节精读 | README + CLAUDE.md + 模块 README + 抽样 5-10 个 SKILL.md | 抓全文 + 引用源（如能拉到） |
| **Deep-Dive** | 全部材料 | 全部材料（含 FAQ / 排错） | 模块化材料 + 抽 1-2 个深度 skill 看实现 + scripts/ | 抓全文 + 全部引用源 |

**通用上限**：
- 累计材料 > 200KB 时按上表抽样截断
- 单个 LLM 调用的 prompt 总输入（含材料）≤ 80K tokens
- 巨型源（skill_collection > 30MB）**必须**走 `find . -name "SKILL.md" | head -X` 做随机抽样，不要 ls 全部

### Step 3：LLM 调用

- 用 `prompts/{tier}.md` 模板 + 上面材料
- LLM 默认 MiniMax-M3（团队环境配置）
- 温度：card=0.3，brief=0.3，deep-dive=0.4

### Step 4：校验

- 对照对应 tier 的 schema 检查 frontmatter
- 必填字段缺失 → 自纠正重试 1 次 → 失败标 `status=llm_invalid` 排队等人工
- **重要**：takeaway 必须基于材料原文，引用锚点（`file:L`）必须真实存在
- **Cross-check 必跑**：每个 tier 完成后，用 `sed -n` 反查 2-3 个引用锚点确认 verbatim 匹配，不通过 = 产物作废重写

### Step 5：落盘（**单文件三段式**）

- **单源单文件**：`{output_dir}/{slug}.mdx`（output_dir 从 registry.json 读，默认 `apps/docs/content/docs/research/`）
  - 若同一次跑多层，**合并**到一个文件：frontmatter 用 `tiers_present: [card, brief, deep-dive]` 标识，body 用 `## Card` / `## Brief` / `## Deep-Dive` 三段
- **数据 sibling**：`{output_dir}/{slug}.json`（与 .mdx 同级，无文件夹）
- **不创建** `{slug}/` 子目录（与早期设计不同，扁平化以减少侧边栏层级）
- **更新** `registry.json`（源注册表，加新行）
- **更新** `index.mdx`（侧边栏表格，**与 registry.json 同步**）
- **更新** `meta.json`（在 `pages` 数组加 `"slug"`，保持 sidebar 顺序）

### Step 6：自报

输出到调用方：

- 产物文件路径
- 前 200 字摘要
- frontmatter 校验结果 + 字符数（vs 字符上限）
- 受众标签的判定依据
- Cross-check 结果（哪几条引用锚点验过、verbatim 匹配 yes/no）
- 「下一步建议」一段话
- 暴露的新问题（如有）→ 当场写 LEARNINGS.md 排队，**不要遗忘**

## 输出契约

每次调用产出：

1. 1 个 `.mdx` 产物（Card / Brief / Deep-Dive 三段合一）
2. 1 个 `.json` sibling（sources 数据，含 `framework_score` 字段若有用框架）
3. 3 处元数据更新（`registry.json` + `index.mdx` + `meta.json` 的 `pages` 数组）

## 字符上限实测基线（2026-06-11 校准）

- **Card**：目标 ≤ 800 字硬限；实测可接受范围 ≤ 1500 字符（中文字数 ≈ 1000）
- **Brief**：目标 ≤ 2500 字硬限；实测可接受范围 ≤ 3000 字符（中文字数 ≈ 2000）
- **Deep-Dive**：目标 ≤ 5000 字硬限；实测可接受范围 ≤ 8000 字符（中文字数 ≈ 5000）；超 8000 必加 frontmatter `overflow: true`

提示：「字」= 中文字 + 半个英文单词 + 半个标点；「字符」= `wc -m`。

## 闸门 review 机制

| 闸门 | 触发 | 人工动作 | 标志字段 |
|---|---|---|---|
| Gate 1 → 2 | 所有源完成 Card | 挑「值得升级到 Brief」的子集 | `registry.json` 标 `promote_to_brief: true` |
| Gate 2 → 3 | 推广子集完成 Brief | 挑「值得做 Deep-Dive」的子集 | `registry.json` 标 `promote_to_deep_dive: true` |

**不**靠 PR 评论 / Slack / 口头决定——所有闸门决策落在 `registry.json` 字段，机器可读、可追溯。

## 硬约束（违反 = 产物作废）

> 这些是 2026-06-10/11 跑通 4 源时踩过的坑，**禁止再犯**。

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

### 4. WebFetch / gh clone fallback 必加

- 域名 `claude.com` / `anthropic.com` / `claude.ai` **预知**需要走 curl + Python 解析路径
- `gh repo clone` 遇 HTTP/2 framing 错 → 走 `git -c http.version=HTTP/1.1 clone --depth=1`
- Step 1 的 fallback 块是**强制的**，不要省略

### 5. Skill 路径参数化

- 实际输出目录可能不是 `apps/docs/content/docs/research/`（将来可能换项目、换 monorepo）
- `registry.json` 顶层有 `output_dir` 字段（已实施）
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

### 8. source_subtype 字段必填（新增 2026-06-11）

- 每个源 registry.json 加 `source_subtype` 字段，值如：`tutorial` / `skill_collection` / `methodology` / `article` / `spec` / `blog` / `framework` 等
- 影响 Step 2 抽取策略（见上表）+ Deep-Dive 框架适配（见 prompts/deep-dive.md）
- 同一 `source_type=repo` 下不同 subtype 处理方式不同：tutorial 强调「按章节抽样」、skill_collection 必读 `CLAUDE.md` / `AGENTS.md`、methodology 强调「按 SKILL.md 精读」

### 9. 评估框架按 source_subtype 适配（新增 2026-06-11）

- Deep-Dive 主题 1 中提炼的「10 维度教程评估框架」**只对 tutorial-style 源完全适用**
- 对 skill_collection / methodology 源，部分维度（如「学习路径分流」、「术语表 + 生活类比」）不适用，**评 `n/a` 而非 `no`**——否则会 unfair 扣分
- 框架自检表必标 `framework_version` + `n/a` 维度的不适用理由

## 相关文件

- `prompts/card.md` — Card 模式 prompt
- `prompts/brief.md` — Brief 模式 prompt
- `prompts/deep-dive.md` — Deep-Dive 模式 prompt
- 闸门 review：`registry.json` 字段 `promote_to_brief` / `promote_to_deep_dive` 决定下一闸跑谁
- 历史教训：`apps/docs/LEARNINGS.md`
- session 交接：`apps/docs/SESSION_HANDOFF.md`
