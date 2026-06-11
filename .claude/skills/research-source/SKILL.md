---
name: research-source
description: |
  研究一个资料源（GitHub repo / 文章 / 教程 / skill collection）并产出 Card（速览）/ Brief（梳理）/ Deep-Dive（深读）。
  在用户提到「研究 X」、「写 card」、「出 brief」、「deep-dive」、「调研这个 repo」时使用。
---

# research-source Skill（v0.3，2026-06-11 PM 合并 Problem 17-25）

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

### Step 1：拉取（**注意 WebFetch 白名单 + gh clone fallback + geo-block 检测**）

- **repo（推荐顺序）**：
  1. `gh repo clone {url} .research-cache/{slug} -- --depth=1`
  2. 小仓库（< 50MB）失败回退（**HTTP/2 framing error 是已知偶发**）：
     ```bash
     git -c http.version=HTTP/1.1 clone --depth=1 {url} .research-cache/{slug}
     ```
  3. **大仓库（> 100MB，如 anthropic-cookbook ~360MB）专用 fallback**（Problem 24）：
     ```bash
     git -c http.version=HTTP/1.1 \
         -c http.postBuffer=524288000 \
         -c core.compression=0 \
         clone --depth=1 --single-branch {url} .research-cache/{slug}
     ```
  4. 仍失败：报错前先 retry 2 次，间隔 5 秒
  5. **务必**记录到 sources.json 的 `fetched_via` 字段，标注用了哪条路径

- **article / tutorial / course**：`WebFetch {url}`
  - **若失败且域名匹配 `claude.com` / `anthropic.com` / `claude.ai`** → 回退到 curl + Python（见下）
  - **若 HTTP 200 但 body 是 "App unavailable in region" splash 页**（geo-block，Problem 17）：
    1. **必跑** `grep -i "unavailable in region\|app unavailable" /tmp/{slug}.html`；命中即视为 geo-block
    2. **fallback 到 anthropics/* GitHub 镜像**：
       - `docs.claude.com/en/docs/agents-and-tools/agent-skills` → `raw.githubusercontent.com/anthropics/skills/main/README.md`
       - `docs.claude.com/en/docs/claude-code/{topic}` → `raw.githubusercontent.com/anthropics/claude-code/main/docs/{topic}.md`（若存在）
       - 找不到对应镜像 → 报错并标 `status=fetch_failed`，让人工选源
    3. 标 `fetched_via_fallback: true` + `mirror_url: <镜像源>` 到 sources.json
  - **curl + Python 抽取脚本**（升级版，**保留 H1-H3 + p/li/pre 边界**，Problem 20）：
    ```bash
    curl -sL {url} -o /tmp/{slug}.html
    python3 -c "
import re, html
t = open('/tmp/{slug}.html').read()
# 1. 取 article 或 main
m = re.search(r'<article[^>]*>(.*?)</article>', t, re.DOTALL) or re.search(r'<main[^>]*>(.*?)</main>', t, re.DOTALL)
b = m.group(1) if m else t
# 2. 去掉无关 tag
b = re.sub(r'<style[^>]*>.*?</style>|<script[^>]*>.*?</script>|<svg[^>]*>.*?</svg>|<nav[^>]*>.*?</nav>|<footer[^>]*>.*?</footer>', '', b, flags=re.DOTALL)
# 3. 在标题 / 段落 / 列表 / 代码块边界插入换行（保留结构）
b = re.sub(r'</(h[1-6]|p|li|pre|blockquote|tr)>', r'\\n', b)
b = re.sub(r'<(h[1-6]|p|li|pre|blockquote|tr|br)[^>]*>', r'\\n', b)
# 4. 去标签 + 行内空白折叠（**不折叠换行**）
b = re.sub(r'<[^>]+>', '', b)
b = html.unescape(b)
b = re.sub(r'[ \\t]+', ' ', b)        # 折叠水平空白
b = re.sub(r'\\n\\s*\\n+', '\\n\\n', b)   # 折叠多余空行
print(b.strip())
" > /tmp/{slug}.txt
    ```
  - 输出预期：每段独立一行，便于 `:L<n>` 锚点精准定位（不是整页落 L1）

### Step 2：抽取 + 「tier × source_subtype 阅读量矩阵」

读取策略**按 tier 和 source_subtype 双轴决定**，避免 Card 阶段就吃掉整个 repo：

| Tier ↓ / Subtype → | `methodology`（skill 方法论包） | `tutorial`（教程 repo） | `skill_collection`（巨型 skill 库） | `cookbook`（code-recipe 库）| `article` / `blog` / `docs`（单篇）|
|---|---|---|---|---|---|
| **Card** | README + 1-2 个核心 SKILL.md | README + CHANGELOG + 1 篇代表性章节抽样 | README + CLAUDE.md / AGENTS.md（**重要！**） + 域目录树 | README + CLAUDE.md + 顶级目录树 + 1 个代表性 recipe 入口（ipynb 摘头）| 抓全文 |
| **Brief** | README + 全部 SKILL.md（精读） | README + 全部章节 H1/H2 + 3-5 篇代表性章节精读 | README + CLAUDE.md + 模块 README + 抽样 5-10 个 SKILL.md | README + CLAUDE.md + 全部目录树 + 3-5 个代表性 recipe + `registry.yaml` / `index.md`（如有） 精读 | 抓全文 + 引用源（如能拉到） |
| **Deep-Dive** | 全部材料 | 全部材料（含 FAQ / 排错） | 模块化材料 + 抽 1-2 个深度 skill 看实现 + scripts/ | 全部材料（87 ipynb 走目录抽样 → 1-2 个 ipynb 全文 + 8-10 个 ipynb 头部）| 抓全文 + 全部引用源 |

**通用上限**：
- 累计材料 > 200KB 时按上表抽样截断
- 单个 LLM 调用的 prompt 总输入（含材料）≤ 80K tokens
- 巨型源（skill_collection > 30MB / cookbook > 100MB）**必须**走 `find . -name "SKILL.md" -o -name "*.ipynb" | head -X` 做随机抽样，不要 ls 全部
- `cookbook` 类 ipynb 抽样：用 `jq -r '.cells[0:3][].source[]' file.ipynb` 取每个 ipynb 头 3 cell（叙事 + 第一段代码），快速浏览 87 个 recipe 的主题分布而不读全文

### Step 3：LLM 调用

- 用 `prompts/{tier}.md` 模板 + 上面材料
- LLM 默认 MiniMax-M3（团队环境配置）
- 温度：card=0.3，brief=0.3，deep-dive=0.4

### Step 4：校验（**机器校验先行，人工 review 后置**）

#### 4.1 schema 校验脚本（Problem 19/21/22/23 修复）

每个 subagent 返回 JSON 后，主 Claude 收尾**必跑**以下校验，任何一项失败 = 该源标 `status=llm_invalid` 重试 1 次：

```bash
# audience_tags enum 白名单校验（Problem 19）
python3 -c "
import json, sys
d = json.load(open('$JSON_PATH'))
a = d.get('audience_tags', {})
assert a.get('cs_background') in ['yes','partial','no'], f'cs_background 非法: {a.get(\"cs_background\")}'
assert a.get('devops') in ['low','mid','high'], f'devops 非法: {a.get(\"devops\")}'
assert a.get('cc_experience') in ['newbie','used','advanced'], f'cc_experience 非法: {a.get(\"cc_experience\")}'
"

# char_count 必须 wc -m 实测，与 frontmatter 自报对比（Problem 21）
ACTUAL=$(wc -m < "$MDX_PATH" | tr -d ' ')
REPORTED=$(grep -E '^char_count:' "$MDX_PATH" | awk '{print $2}')
[ "$ACTUAL" -eq "$REPORTED" ] || echo "WARN char_count 不一致：实测 $ACTUAL vs 报告 $REPORTED；以实测为准并改 frontmatter"

# 锚点格式 {subtype}:L<n>（Problem 22）
grep -oE '\([a-z_]+:L[0-9]+\)' "$MDX_PATH" | sort -u   # 必须全部命中 `{subtype}:L<n>` 形态
grep -nE '\([^)]*\.txt:[0-9]+\)' "$MDX_PATH" && echo "FAIL mdx 内不应出现 /tmp/*.txt 完整路径锚点（应在 sources.json）"

# card_body_markdown 必为 string（Problem 23）
python3 -c "
import json
d = json.load(open('$JSON_PATH'))
b = d.get('card_body_markdown') or d.get('body_markdown')
assert isinstance(b, str), f'body 必须是 string，不是 nested JSON：{type(b).__name__}'
assert len(b) > 100, f'body 太短：{len(b)} 字符'
"
```

#### 4.2 内容校验

- 对照对应 tier 的 schema 检查 frontmatter
- 必填字段缺失 → 自纠正重试 1 次 → 失败标 `status=llm_invalid` 排队等人工
- **重要**：takeaway 必须基于材料原文，引用锚点（`file:L`）必须真实存在
- **Cross-check 必跑**：每个 tier 完成后，用 `sed -n` 反查 2-3 个引用锚点确认 verbatim 匹配，不通过 = 产物作废重写
- **geo-block 兜底校验**（Problem 17）：若 fetched_via_fallback=true，`grep -i "unavailable in region" /tmp/{slug}.txt` 必须 0 命中——确认 fallback 内容不是 splash 污染

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
- **机器校验结果**（4.1 schema 脚本全部必通过；列每项 pass/fail）
- frontmatter 校验结果 + 字符数（用 `wc -m` 实测，对照 source_subtype 上限表）
- 受众标签的判定依据（必须用 enum 白名单值）
- Cross-check 结果（哪几条引用锚点验过、verbatim 匹配 yes/no）
- 「下一步建议」一段话
- 暴露的新问题（如有）→ 当场写 LEARNINGS.md 排队，**不要遗忘**

## 输出契约

每次调用产出：

1. 1 个 `.mdx` 产物（Card / Brief / Deep-Dive 三段合一）
2. 1 个 `.json` sibling（sources 数据，含 `framework_score` 字段若有用框架）
3. 3 处元数据更新（`registry.json` + `index.mdx` + `meta.json` 的 `pages` 数组）

## 字符上限实测基线（2026-06-11 校准，**按 source_subtype 分档**）

| Tier | `blog` | `article` | `docs` | `repo`（README）| `cookbook` | `methodology`（多 SKILL.md）| `tutorial`（多章节）| `skill_collection`（多 SKILL.md）|
|---|---|---|---|---|---|---|---|---|
| **Card** | ≤ 1500 | ≤ 1800 | ≤ 2500 | ≤ 1800 | ≤ 2000 | ≤ 1800 | ≤ 1800 | ≤ 2000 |
| **Brief** | ≤ 3000 | ≤ 3000 | ≤ 3500 | ≤ 3000 | ≤ 3500 | ≤ 3000 | ≤ 3500 | ≤ 3500 |
| **Deep-Dive** | ≤ 8000 | ≤ 8000 | ≤ 8000 | ≤ 8000 | ≤ 8000 | ≤ 8000 | ≤ 8000 | ≤ 8000 |

**说明**：
- 上限超出必标 frontmatter `overflow: true`，不强制压缩——信息密度损失大于美观收益（Problem 18 实测）
- `docs` 类官方源信息密度天然高（机制说明 + 子项列表 + 锚点），实测 Card 2000-3000 是常态
- `cookbook` 类需描述 87+ recipe 的主题分布，比 README 略密
- **基线单位**：`wc -m`（含 markdown 标记和 frontmatter 后所有内容），不是「中文字数」（Problem 21）
- 中英混排实际字符 ≈ 0.6-0.7 × 中文字数；1500 字符 ≈ 1000 中文字

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

### 8. source_subtype 字段必填（新增 2026-06-11；扩 cookbook 2026-06-11 PM）

- 每个源 registry.json 加 `source_subtype` 字段，值如：`tutorial` / `skill_collection` / `methodology` / `article` / `spec` / `blog` / `framework` / `docs` / `cookbook` 等
- 影响 Step 2 抽取策略（见上表）+ Deep-Dive 框架适配（见 prompts/deep-dive.md）
- 同一 `source_type=repo` 下不同 subtype 处理方式不同：tutorial 强调「按章节抽样」、skill_collection 必读 `CLAUDE.md` / `AGENTS.md`、methodology 强调「按 SKILL.md 精读」、**cookbook 强调「目录树 + 代表性 recipe 抽头部 cell」**

### 9. 评估框架按 source_subtype 适配（新增 2026-06-11；v0.2 加 cookbook 适配 2026-06-11 PM）

- Deep-Dive 主题 1 中提炼的「10 维度教程评估框架」**只对 tutorial-style 源完全适用**
- 对 skill_collection / methodology 源，部分维度（如「学习路径分流」、「术语表 + 生活类比」）不适用，**评 `n/a` 而非 `no`**——否则会 unfair 扣分
- **cookbook 类源的 n/a 维度白名单**（v0.2 新增，Problem 25）：
  - 「学习路径分流」n/a — cookbook 无叙事路径，按主题独立 recipe
  - 「术语表前置」n/a — code-recipe 库不教概念，假设读者已会
  - 「生活类比」n/a — 直接给可执行代码，不需要 metaphor
  - 「章节信息头标准化」n/a — recipe 间格式可以差异化（每个作者自由）
  - 「任务驱动排序」n/a — 按主题分组不按学习曲线
- 框架自检表必标 `framework_version` + `n/a` 维度的不适用理由

### 10. subagent prompt 必须硬码 enum + 完整 sample JSON（新增 2026-06-11 PM）

> 来源 Problem 19/23：subagent 不像主 Claude 会自动遵循 SKILL.md 约定。**任何「自由发挥会失控」的字段必须 prompt 内 enum 硬码**；任何「结构化字段诱惑」必须给完整 sample JSON 而不是字段描述。

- subagent prompt 必须列出 audience_tags 三轴**完整 enum 白名单**（`yes/partial/no` / `low/mid/high` / `newbie/used/advanced`），不接受自由发挥
- subagent prompt 必须给一个**完整可解析的 sample JSON 输出**（含真实示例值），不是「字段 → 类型 → 描述」
- subagent prompt 必须显式说明：`card_body_markdown` 是**单个 markdown 字符串**，禁止返回 `{tldr, key_takeaways: [...], ...}` 等 nested JSON
- subagent prompt 必须硬码锚点格式：mdx 内用 `({subtype}:L<n>)`（如 `(docs:L42)` / `(blog:L5)` / `(README:L120)`），完整文件路径锚点（如 `/tmp/research-batch3/{slug}.txt:L<n>`）只放在 sources.json 的 `cross_check_anchors` 字段
- subagent prompt 必须硬码 `char_count` 字段填法：**最终 markdown 全文（含 frontmatter 后所有内容）`wc -m` 结果**，自己跑 wc 不要心算

### 11. 主 Claude 收尾必跑机器校验（新增 2026-06-11 PM）

> 来源 Problem 19/21/22/23 复盘：subagent 改 prompt **部分有效**（硬码 enum / 锚点格式 ✓），**部分无效**（schema string vs nested JSON / char_count 实测 ✗）。形态级约束必须在 LLM 外层做 assertion。

- 主 Claude 在 Step 4.1 必跑 schema 校验脚本（详见 Step 4.1）
- 任何校验失败的源 = 标 `status=llm_invalid`、重试 1 次（强化 prompt 警告）→ 仍失败 = 排队等人工修
- 校验通过后才能 Step 5 落盘 + Step 6 自报
- **不允许「subagent 自报通过、主 Claude 跳过校验」**——subagent 自报不可信（Problem 21 实测）

## 相关文件

- `prompts/card.md` — Card 模式 prompt
- `prompts/brief.md` — Brief 模式 prompt
- `prompts/deep-dive.md` — Deep-Dive 模式 prompt
- 闸门 review：`registry.json` 字段 `promote_to_brief` / `promote_to_deep_dive` 决定下一闸跑谁
- 历史教训：`apps/docs/LEARNINGS.md`
- session 交接：`apps/docs/SESSION_HANDOFF.md`
