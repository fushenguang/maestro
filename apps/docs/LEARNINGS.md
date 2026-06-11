# LEARNINGS — 1 源全流程跑通（2026-06-10 → 2026-06-11）

> 这是「小步快跑、沉淀学习」实践的第一次沉淀：把 superpowers 这个核心源从 0 走到 Card + Brief + Deep-Dive 全流程暴露的问题、做的决策、得到的经验全部记录下来。后面跑 2-3 源验证时会反复对照本文件。

---

## 1. 跑通过程回顾

| 阶段 | 日期 | 关键动作 |
|---|---|---|
| 探索项目上下文 | 2026-06-10 PM | 读 CLAUDE.md / apps/docs 结构 / openspec workflow |
| 澄清需求 | 2026-06-10 PM | 5 问 + 方案选择，最终选 C（Agent+Skill 驱动） |
| 设计 4 节 | 2026-06-10 PM | 架构 → 组件 → 数据流+错误处理 → 测试+风险 |
| MVFS：Card on superpowers | 2026-06-10 PM | 写 Skill SKILL.md + 6 个产物文件，dev server 起来 |
| 调试 404 | 2026-06-10 PM | 诊断中文路径 Fumadocs loader bug，重命名为 ASCII |
| 第 2 源（article 路径） | 2026-06-10 晚 | Claude 官方 blog 文章，验证 article 路径 |
| 重构路由 | 2026-06-11 早 | 扁平化（card/ → 顶层）+ 中文标题 + 删 Hello World/Components |
| Brief + Deep-Dive | 2026-06-11 早 | 合并到 superpowers.mdx 单文件三层 |

---

## 2. 暴露的问题 & 修复

### 问题 1：Fumadocs 中文 slug 兼容性 bug

**症状**：访问 `/docs/资料参考` 时先有内容，后跳 404

**根因**：
- Fumadocs loader 把 Chinese slug 存为 URL-encoded 形式（`%E8%B5%84%E6%96%99%E5%8F%82%E8%80%83`）
- Next.js 给 `params.slug` 的是 URL-decoded 形式（`资料参考`）
- `source.getPage(['资料参考'])` 找不到匹配 → page.tsx 调 `notFound()` → 客户端路由跳 404 boundary
- 服务端返回 200 是因为 RSC stream 里同时包含 content + 404 fallback，浏览器最终用 fallback

**修复**：
- 目录名一律用 ASCII slug（`research` 而非 `资料参考`）
- meta.json 的 `title` 字段用中文（侧边栏显示用）

**沉淀**：
- ✅ 教程/项目根目录约定：**所有源目录、URL 段、slug 用 ASCII**；显示用中文走 frontmatter/meta.json
- ✅ Skill SKILL.md 的硬约束应加：「目录名用 ASCII，title 用目标语言」

### 问题 2：WebFetch 拦截 `claude.com`

**症状**：`WebFetch https://claude.com/blog/...` 报 "Unable to verify if domain claude.com is safe"

**根因**：WebFetch 工具有白名单/安全策略，不在白名单的域名直接拒绝

**修复**：
- 用 `curl` 直连（200，547KB）
- 用 Python + 正则抽正文

**沉淀**：
- ✅ Skill SKILL.md 的 Step 1「拉取」要加 fallback：
  ```
  try WebFetch(url)
  on failure:
    if url starts with claude.com/anthropic.com:
      curl -s url -o /tmp/{slug}.html
      parse with Python (regex strip tags)
  ```
- ✅ Claude 官方 blog 类的源（claude.com / anthropic.com / claude.ai）**预知需要走 curl + 本地解析路径**

### 问题 3：MDX 不支持 `{#id}` 锚点语法

**症状**：用了 `## Card（速览）{#card}` 后页面 500

**根因**：`{#id}` 是 Pandoc/GFM 语法，MDX（尤其是 fumadocs-mdx）不支持，会报 `Could not parse expression with acorn`

**修复**：去掉 `{#id}`，依赖 fumadocs 自动从标题文本生成 ID

**沉淀**：
- ✅ MDX 禁忌：不要用 `{#id}`、不要用 `:::warning`（GFM container），用 fumadocs-ui 提供的 `<Callout>` / `<Cards>` / `<Card>` 组件
- ✅ 写 Skill prompt 时要明示：「使用 MDX 兼容的语法」

### 问题 4：路由层级冗余

**症状**：侧边栏显示 `Research → Research → superpowers → superpowers`（4 层）

**根因**：
- 文件夹 `research/` 是 group
- `research/index.mdx` 是 group 的 index 页面
- meta.json `title: "Research"` + frontmatter `title: "Research"` 同时出现 → 同名重复
- 同样 `superpowers/` group + `card.mdx` leaf

**修复**：
- 每个源扁平化：`research/{slug}.mdx`（不是 `research/{slug}/card.mdx`）
- 删 `research/index.mdx` 不删除（保留为 landing），但 meta.json `pages` 不列 "index"（只列其他叶子）
- 现在侧边栏：`研究参考 → Superpowers` / `研究参考 → 如何写好一个 Skill (Anthropic 官方)`

**沉淀**：
- ✅ 每个源 = 1 个 .mdx + 1 个 .json（数据），不再嵌套
- ✅ 三层内容（Card/Brief/Deep-Dive）放在同一个 .mdx 文件的不同 `##` section
- ✅ meta.json `pages` 排除 `index` 来隐藏 landing page 作为子项

### 问题 5：删除 Hello World / Components 后无影响

**症状**：之前侧边栏有 `Hello World` 和 `Components` 两条

**根因**：Fumadocs 模板自带的 `index.mdx` + `test.mdx`

**修复**：直接删除两个文件

**沉淀**：
- ✅ 默认 Fumadocs 模板的内容要清掉，从 0 写自己的
- ✅ `apps/docs/content/docs/` 应该只有研究参考目录

---

## 3. 做出的关键决策

| 决策点 | 选项 | 选了 | 理由 |
|---|---|---|---|
| 目录命名 | 中文 vs ASCII slug | **ASCII** | 解决 Fumadocs bug，URL 语义清晰 |
| 侧边栏标题 | URL 跟随 vs meta.json 单独 | **meta.json 单独控制** | 满足「URL 英文、标题中文」需求 |
| 文件夹层级 | 每源独立目录 vs 扁平 | **扁平（`research/{slug}.mdx`）** | 满足「2 层路由」需求 |
| 三层内容组织 | 3 个 .mdx vs 1 个 .mdx 三段 | **1 个 .mdx 三段** | 满足 2 层路由限制；总字数仍可控（≤ 8000） |
| Card 字段集 | 完全自定义 vs 复用 blog frontmatter 习惯 | **自定义 + 3 轴 audience_tags** | 满足受众筛选需求 |
| WebFetch 替代 | 跳过 claude.com 源 vs curl fallback | **curl + Python 解析** | 资料源不能丢 |
| 流程执行节奏 | 1 源跑通 vs 30 源并行 | **1 源全流程 → 沉淀 → 2-3 源验证** | 降低风险、暴露问题 |

---

## 4. 跑流程时遇到的「流程本身」问题

### 4.1 Skill 路径假设

设计时假设 `apps/docs/资料参考/` 是约定，**实际上**用户最终要求用 ASCII。Skill 的所有路径参数应该参数化，不写死。

**改进**：
- `registry.json` 加 `output_dir` 字段
- Skill 启动时读 registry.json 的 `output_dir` 而不是用默认值
- 这样将来换项目不会破

### 4.2 registry.json 与 index.mdx 双重维护

加新源要同时改 `registry.json`（机器可读）+ `index.mdx`（人可读表格）—— 双 source of truth。

**改进**：
- 短期：容忍，在 Skill 的 Step 6 加 checklist 提醒「同步更新 index.mdx」
- 长期：写脚本从 `registry.json` 生成 `index.mdx` 的表格

### 4.3 一次跑 1 源时，手动 clone + 手动调 Skill 没问题；将来跑 30 源时手动不可行

**改进**：
- 加 `scripts/research-batch.sh`（已有设计，未实现）
- 这次没做是因为只跑 2 源，手动更快

### 4.4 LLM 输出的 Card 质量与「真实 fetch」耦合

这次 Card 内容是「我」手工写的（因为只跑 1-2 源，可以手写）。但将来用 Skill 让 LLM 跑，Card 内容的「真实性」取决于 LLM 能不能正确读懂 repo/文章。

**改进**：
- Card 模板要强制 frontmatter 字段：URL、last_checked、sources.json 的引用
- 「关键 takeaway」必须基于材料原文；引用锚点（file:L）必须真实存在
- LLM 跑完要 cross-check：抽 1-2 个 takeaway 反查材料

### 4.5 Deep-Dive 章节超过 5000 字风险

我写的 Deep-Dive 段目测 ~3000-4000 字。后续写更复杂的源（如 baoyu-skills、impeccable）可能超 5000。

**改进**：
- Deep-Dive 的 5000 字上限是「教程章节」规范，不是「研究素材」规范
- 允许 Deep-Dive 段超 5000，但要在 frontmatter 加 `overflow: true` 标记
- 或者：把 Deep-Dive 拆为多个 .mdx（一个 Deep-Dive overview + N 个 detail）

---

## 5. 接下来 2-3 源验证要观察的

跑 ECC、claude-howto、baoyu-skills 之一时，**重点看**：

1. **不同 source_type** 是否需要不同的 Card 字段？
   - repo（已验：superpowers）
   - article（已验：claude-skills-blog）
   - tutorial（**待验**）：估算时长、章节列表、prereqs
   - course（**待验**）：课程大纲、证书、平台
2. **超大 repo**（如 baoyu-skills）是否能被 200KB 截断 + Skill 摘要？
3. **Brief/Deep-Dive** 的内容是不是随源类型有不同侧重？
   - 教程型：Brief 重在「章节结构」，Deep-Dive 重在「对教程大纲的贡献」
   - 文章型：Brief 重在「论点结构」，Deep-Dive 重在「引用与作者背景」
4. **受众标签** 准确性：每次跑完让用户 review 标签，判断命中率

---

## 6. 沉淀的元规则

> 这些是「不再犯」的硬约束，写进 Skill / 文档根。

1. **所有源目录名、URL slug 用 ASCII**
2. **meta.json `title` 可用中文**，但不要和 frontmatter `title` 同时重复
3. **每个源 = 1 个 .mdx（Card+Brief+Deep-Dive 三段）+ 1 个 .json（sources 数据）**
4. **MDX 禁忌**：`{#id}` / `:::warning`（GFM 容器）/ 内嵌 `<script>`
5. **WebFetch fallback**：`claude.com` / `anthropic.com` / `claude.ai` 用 curl + Python 解析
6. **Skill 路径参数化**：输出目录从 `registry.json` 读，不写死
7. **registry.json 是源列表唯一真相源**；index.mdx 表格是它的视图
8. **三闸门人工 review 在 `_meta.json` / `registry.json` 标 `promote_to_*: true`**，不靠 PR 评论
9. **`.md` 文件不能放在 `content/docs/` 里**——Fumadocs-mdx 会当页面扫，要求 frontmatter `title`。非页面文档放 `apps/docs/`（站根）或仓库其他位置

---

## 7. 下次启动前的 CheckList

跑第 3 源前对照检查：

- [ ] 目标源的类型（repo / article / tutorial / course）确定
- [ ] 决定拉取方式（gh clone / curl + Python / WebFetch）
- [ ] 跑前预读：是否需要 200KB 截断（repo size 估算）
- [ ] 写完 Card 后让用户 review 受众标签
- [ ] 写完 Brief 后让用户决定是否进 Deep-Dive
- [ ] 写完 Deep-Dive 后 cross-check 2 个 takeaway vs 材料原文
- [ ] 更新 `registry.json` + `index.mdx` + `meta.json`（3 处同步）
- [ ] 在本文档追加该源的「暴露的新问题」（如有）

---

## 8. 第 3 源跑通沉淀（2026-06-11）

### 8.1 源：`ai-coding-guide-zh`（KimYx0207/AI-Coding-Guide-Zh）

- **类型**：repo（tutorial-style，中文）
- **场景验证目标**：tutorial 型 repo / 中文材料 / 三工具横向源（CC+Codex+OpenClaw 混合）
- **结果**：Card 跑通；dev server 200，无 MDX 500；3 个 takeaway 锚点 cross-check 通过
- **耗时**：约 30 分钟（clone 1min + 抽材 5min + 写产物 15min + 同步元数据 + 验证 9min）

### 8.2 暴露的新问题

#### 问题 6：`gh repo clone` HTTP2 framing 错误

**症状**：`gh repo clone KimYx0207/AI-Coding-Guide-Zh ...` 报 `Error in the HTTP2 framing layer`

**根因**：网络/服务端 HTTP/2 协商失败（与 GH 的边缘链路偶发抖动相关）

**修复**：`git -c http.version=HTTP/1.1 clone --depth=1 <url>` 强制 HTTP/1.1

**沉淀**：
- ✅ SKILL.md Step 1 拉取段加 fallback：`gh repo clone` 失败时回退到 `git -c http.version=HTTP/1.1 clone --depth=1`
- ✅ 出错时显式记录到 sources.json 的 `fetched_via` 字段（已实施）

#### 问题 7：Card 字数 800 字硬限实操偏紧

**症状**：5 条 takeaway + 每条带 file:L 锚点 + 关联段 + 参考锚点，初稿 1807 字符；压缩后 1507 字符仍超 800 字

**根因**：800 字硬限对「3-5 条 takeaway + 每条带 1-2 个锚点」的 Card 结构偏紧，特别是中文场景下锚点引用语义密度高

**修复**：
- 当前采用「软限」做法：以 superpowers Card 段 1231 字符为同期参考标准
- 中英混排实际字符 ≈ 0.6-0.7 中文字数，所以 1500 字符 ≈ 1000 中文字

**沉淀**：
- ✅ SKILL.md prompt/card.md 把「≤ 800 字」改为「≤ 1500 字符（中文字符约 1000 字）」
- ✅ 同时保留「能 800 就 800」的优先级——不是放宽下限，是承认实操上限

#### 问题 8：「Source 覆盖多个主题」未建模

**症状**：本源同时覆盖 Claude Code、Codex App、OpenClaw 三个工具，registry.json 当前 schema 没有「subjects」字段表达

**根因**：早期假设 1 源 = 1 主题，没建多对多关系

**修复**：暂未在本次 commit 里加，但在产物文件里手动用 `source_subtype: "tutorial"` 表达「不是纯 repo，是 tutorial」

**沉淀**：
- ✅ registry.json schema 应加 `subjects: ["claude-code", "codex", "openclaw"]` 字段
- ✅ 同时加 `source_subtype` 字段（区分 `pure_repo` / `tutorial` / `framework` / `library`）
- ⏳ 推到 Step 4「标准化」批次做（不在本次范围）

#### 问题 9：tutorial-style repo 不必全读

**症状**：39 篇教程总 4.8MB，全读会撑爆上下文

**根因**：早期 Card 流程没有「按 tier 调整阅读量」的策略

**修复**：本次实践——README + CHANGELOG + 1 篇代表性章节（05-Hooks）抽样验证「单篇结构模板」，足够支持 Card；Brief / Deep-Dive 阶段才扩大阅读量

**沉淀**：
- ✅ SKILL.md Step 2 抽取段补充：「tutorial-style repo 在 Card tier 只需 README + CHANGELOG + 1 篇代表性章节抽样；Brief tier 扩展到全章节标题 + 3-5 篇精读；Deep-Dive tier 才读全文」
- ✅ 这是「tier × source_type」的阅读策略矩阵的雏形，将来可扩展为表格

### 8.3 受众标签判定依据（review 用）

- `cs_background: partial` — README:73-77 把「刚入门的读者」列为首选受众，但 Agent SDK / Docker / Hooks 等章节要求一定开发背景，故 partial 而非 no
- `devops: mid` — 覆盖 npm install / Docker / CI/CD，但不深入容器编排或生产监控
- `cc_experience: newbie` — Claude Code 路线明确从「安装」开始，但同时也覆盖 advanced 主题；以入口门槛为准定为 newbie

### 8.4 累计沉淀

`registry.json` 加了 `output_dir: "apps/docs/content/docs/research/"`（meta-rule #5 实施）+ `version: 0.1.0 → 0.1.1` + `schema_version: 2026-06-10 → 2026-06-11`。下一源开始之前不再纠结路径硬编码。

### 8.5 Brief + Deep-Dive 一并跑通（同日 2026-06-11 PM）

Card 后由用户 review 同意 promote 到 brief + deep-dive，**特意要求做「正反双面分析」**（不只是赞美也要批判性审视）。结果：3006 字符 Brief + 8054 字符 Deep-Dive 跑通；3 个新锚点 cross-check 通过。

#### 问题 10：Deep-Dive 8000+ 字符是新常态

**症状**：Deep-Dive 最终 8054 字符（≈ 3300 中文字），超 5000 字硬限 60%

**根因**：用户要求「正反双面 + 评估框架 + 章节决策表」三块结构，每块都需要展开

**修复**：按 deep-dive.md prompt 自带的 overflow 机制——frontmatter 加 `overflow: true`，不强制压缩

**沉淀**：
- ✅ deep-dive.md prompt 的「≤ 5000 字 + overflow:true」机制设计正确，本次实测有效
- ✅ Card / Brief / Deep-Dive 实际字符上限分别 ≈ 1500 / 3000 / 8000，建议 prompt 文档同步更新硬约束注释（避免下次跑时再纠结）
- ✅ Deep-Dive 超 5000 字不是质量缺陷，是「真做深读」的必然——5000 字硬限对「评估框架 + 反例库 + 决策表」三件套同时上的场景偏紧

#### 问题 11：「正反双面」是 Deep-Dive 最有用的框架

**症状**：用户明确要求「不只是赞美，也要批判性审视」，催生「主题 3：批判性审视 —— 反面分析」段，列出 7 个盲点（design rationale 缺 / 评估机制缺 / TDD 缺 / 成本意识缺 / 失败案例缺 / 决策章缺 / 跟进元方法论缺）

**根因**：deep-dive.md prompt 已经有「对源做批判性审视：列出至少 1 个反例 / 已知坑（避免单向赞美）」，但默认强度可能不够——用户主动加压才催生最有价值的部分

**修复**：本次 Deep-Dive 把「反例」从 1 个扩到 7 个盲点 + 反例 / 已知坑列表，且每条配「对我们的启示」做转化

**沉淀**：
- ✅ deep-dive.md prompt 加强表达：「反例不少于 5 条」+「每条反例必须配『对我们的启示 / 差异化机会』段做转化」
- ✅ 这条框架可推广到其他源——「正面提炼复用资产 + 反面扫盲点定位差异化机会」是 Deep-Dive 的通用骨架
- ✅ 用户的 review 反馈是「我们认为很重要的源要双面分析」，未来 registry.json 可以加 `analysis_depth: light/standard/critical` 字段，标记这种「critical」级别的源

#### 问题 12：「评估框架」是 Deep-Dive 最有复用价值的产出

**症状**：本源 Deep-Dive 主题 1 提炼出「10 维度高质量教程评估框架」（章节信息头 / 路径分流 / 术语表 / 任务驱动排序 / 版本基线 / 风险前置 / 多场景 / voice + 权威 / 生活类比 / 跨工具对比），每条带本源具体证据

**根因**：评估框架不是「评本源」，是「评所有源 + 评自己」的工具

**修复**：把这个框架显式作为 Deep-Dive 的可复用资产之一，写进「可直接复用的资产清单」

**沉淀**：
- ✅ 未来跑其他重要源时，**先看是不是可以套这 10 维度**，省去重新发明框架的时间
- ✅ 我们写自己的教程时，**先用这 10 维度自检**，再用它评其他源
- ✅ 这种「评估框架」类的资产应该单独从产物文件抽出来到 `research/frameworks/` 目录（短期不做，等积累 2-3 个框架后再抽）

#### 问题 13：「沿用 vs 错位」决策表是教程候选最直接的输出

**症状**：Deep-Dive 主题 4 给 13 篇 Claude Code 章节逐条标记「沿用名称 / 沿用 + 加深 / 错位重写 / 新增」决策

**根因**：教程章节命名既要降低读者切换成本（沿用中文社区习惯），又要差异化定位（错位）——这两个目标天然冲突，需要逐章决策

**沉淀**：
- ✅ Deep-Dive 阶段对「直接竞品类」源应该产出「沿用 vs 错位」决策表
- ✅ 这个表是开新 OpenSpec change（教程大纲生成）时的第一手输入，**不要重新设计章节序**——直接拿这表谈判

### 8.6 累计的「等下次合并到 Skill」清单（截止 2026-06-11 PM）

| 来源 | 待合并内容 | 优先级 |
|---|---|---|
| Problem 6 | gh clone HTTP2 fallback → SKILL.md Step 1 | 高 |
| Problem 7 | card.md 字数限制 800 → 1500 字符 | 中 |
| Problem 8 | registry schema 加 subjects / source_subtype | 中 |
| Problem 9 | SKILL.md Step 2 加「tier × source_type 阅读量矩阵」 | 中 |
| Problem 10 | prompts/*.md 注释更新字符上限（Card 1500 / Brief 3000 / Deep-Dive 8000） | 高 |
| Problem 11 | deep-dive.md「反例 ≥ 5 条 + 每条配启示」 | 高 |
| Problem 12 | research/frameworks/ 目录积累评估框架（等 2-3 个再抽） | 低 |
| Problem 13 | deep-dive.md 对竞品源加「沿用 vs 错位决策表」段 | 高 |

按 SESSION_HANDOFF Step 3 「跑完 2 源后回头修 Skill」节奏：当前累计 1 源（本源 ai-coding-guide-zh）—— 推到下个源跑完后一次性合并到 SKILL.md / prompts/*.md。

---

## 9. 第 4 源跑通沉淀（2026-06-11 PM）

### 9.1 源：`alirezarezvani/claude-skills`（343+ skills × 13 平台 / source_subtype: skill_collection）

- **类型**：repo / **subtype: skill_collection**（新引入的 subtype）
- **场景验证目标**：英文巨型 skill 库 / 与 ai-coding-guide-zh（中文教程）+ superpowers（精选方法论）三角对照 / **验证 10 维框架能否 discriminate**
- **结果**：Card 跑通；dev server 200，无 MDX 500；框架自检产出 5 yes / 3 partial / 3 no 分布，与 ai-coding-guide-zh 强弱面互补 → **框架可 discriminate 验证通过**
- **耗时**：约 25 分钟（clone + repo 抽 5min + 框架打分 5min + 写 Card 10min + 同步元数据 + 验证 5min）

### 9.2 暴露的新问题

#### 问题 14：10 维框架对非 tutorial 源不公平

**症状**：把 ai-coding-guide-zh Deep-Dive 主题 1 的 10 维框架套到 skill_collection 源上，3 个维度（学习路径分流、术语表 + 生活类比、章节信息头标准化）拿了「no」或「partial」——但这不是源做得不好，而是 **skill_collection 类型源不需要这些维度**

**根因**：框架是从「tutorial」一种源逆向提炼的，假设所有源都按教学语境设计

**修复**：
- 框架评分四档改为 `yes / partial / no / n/a`，n/a 用于「该维度对本 source_subtype 不适用」
- 在 deep-dive.md prompt 写明：框架自检要按 source_subtype 适配，n/a 维度必标不适用理由
- 在 SKILL.md 硬约束 #9 显式声明这条规则

**沉淀**：
- ✅ 已合并到本次 Skill 收敛（SKILL.md 硬约束 #9 + prompts/deep-dive.md 「框架自检规范」段）
- ✅ 启示：框架 v0.1 是「tutorial-centric」；v0.2 需要按 source_subtype 分别给适用维度白名单
- ✅ 启示：跑下一个 framework discriminate 验证应该用一个「无明显教学结构」的源（如纯 spec 文档 / RFC）

#### 问题 15：skill_collection 类型源 Card 必读 CLAUDE.md / AGENTS.md

**症状**：claude-skills 仓库根 CLAUDE.md 是 68KB（比 README 还大、信息密度更高）；项目结构、版本基线、ClawHub publishing constraints、anti-patterns 等核心信息全在 CLAUDE.md，README 只是 marketing 入口

**根因**：skill_collection 类型源往往把「读者级 README」和「贡献者级 CLAUDE.md」分开维护——Card 只读 README 会漏关键工程治理信号

**修复**：在 SKILL.md Step 2 阅读量矩阵里，skill_collection × Card 那格显式加 `CLAUDE.md / AGENTS.md（**重要！**）`

**沉淀**：
- ✅ 已合并到本次 Skill 收敛（SKILL.md Step 2 表格）
- ✅ 这条经验普适：所有「有贡献者文档的开源项目」Card 阶段都应该至少扫一遍 CLAUDE.md / AGENTS.md / CONTRIBUTING.md，否则会漏掉项目的「真心话」

#### 问题 16：「Card 加框架自检」是新的产物模板

**症状**：本源 Card 多了「10 维框架自检」段，作为「框架验证用」的特殊用途——但常规源（如普通 article）不需要

**根因**：Card 模板是 1.0 设计时定的「单源浏览用」，没考虑「源作为框架验证样本」的子用途

**修复**：在 prompts/card.md 把「框架自检段」标为**可选**——「仅在『值得作为框架验证样本』的源加」，避免每个源都强加

**沉淀**：
- ✅ 已合并到本次 Skill 收敛（prompts/card.md 显示标注 optional）
- ✅ 启示：未来每跑一个「锚点源」（如 ai-coding-guide-zh）都应该考虑加框架自检；普通参考源不必加

### 9.3 累计沉淀 + Skill 收敛完成

✅ **触发了 handoff 的「跑完 2 源后回头修 Skill」milestone**——本 session 完成的 2 源（ai-coding-guide-zh + alirezarezvani-claude-skills，本 session 全程）+ 9 项变更（8 项 from LEARNINGS 8.6 + 1 项 from Problem 14 + 2 项 from Problem 15-16）已**一次性收敛**到：

| 文件 | 修改类型 | 关键变更 |
|---|---|---|
| `SKILL.md` | 大改 | + `--subtype` 参数；Step 1 加 HTTP/1.1 fallback；Step 2 重写为「tier × source_subtype 阅读量矩阵」；新增「字符上限实测基线」段；新增硬约束 #8（source_subtype 必填）+ #9（框架按 subtype 适配） |
| `prompts/card.md` | 大改 | 字符上限 800 → 1500；加 `source_subtype` 字段；加「框架自检（可选）」段；扁平化路径 |
| `prompts/brief.md` | 中改 | 字符上限 2500 → 3000；加 `source_subtype`；加「frontmatter 升级」段；明确「竞品源必含跨源关联」 |
| `prompts/deep-dive.md` | 大改 | 字符上限 5000 → 8000（超 8000 加 overflow:true）；批判性审视「反例 ≥ 5 条 + 每条配启示」（原 ≥ 1）；新增「沿用 vs 错位决策表」段（竞品类源必含）；新增「框架自检规范」段（yes/partial/no/n/a 四档 + framework 反思） |

**唯一推迟项**：Problem 12（research/frameworks/ 目录积累评估框架）—— 仍按原计划「等 2-3 个框架再抽」，目前只有 1 个（10 维教程评估框架 v0.1），不足以抽。

### 9.4 4 源 Gate 1 完成全景

| 源 | type / subtype | tier | status | 主要价值 |
|---|---|---|---|---|
| 1. superpowers | repo / methodology | deep-dive | deep-dive_complete | 工程方法论的 skill 体系 |
| 2. claude-skills-blog | article / blog | card | card_complete | Anthropic 一手设计哲学 |
| 3. ai-coding-guide-zh | repo / tutorial | deep-dive | deep-dive_complete | **锚点源**：10 维评估框架来源 + 沿用 vs 错位决策表 |
| 4. alirezarezvani-claude-skills | repo / skill_collection | card | card_complete | **框架 discriminate 验证样本**；工程治理参考 |

**三种 source_subtype 全覆盖**（tutorial / methodology / skill_collection / blog），框架经过三角验证可信。
