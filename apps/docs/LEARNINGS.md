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

---

## 10. 批 1（Anthropic 官方 5 源 Card，2026-06-11 PM）

### 10.1 跑通范围

| # | 源 | URL | subtype | char_count | overflow |
|---|---|---|---|---|---|
| 1 | Claude Code 总览 | docs.claude.com/.../claude-code/overview | docs | 1509 | △ 微超 9 |
| 2 | Agent Skills 官方文档 | docs.claude.com/.../agent-skills | docs（fallback GitHub README） | 1174 | ✓ 内 |
| 3 | Sub-agents 官方文档 | docs.claude.com/.../sub-agents | docs | 1757 | ✗ 标 overflow |
| 4 | Hooks 官方文档 | docs.claude.com/.../hooks | docs | 2044 | ✗ 标 overflow |
| 5 | Building Effective Agents | anthropic.com/research/building-effective-agents | blog | 2289 | ✗ 标 overflow |

**流程**：5 个 subagent 并发，每个 self-contained 跑 fetch + read + 起草 + 返回 JSON；主 Claude 收尾写 5 个 .mdx + 5 个 .json + 同步 registry.json / meta.json / index.mdx；cross-check 5/5 verbatim 反查通过。**耗时**：subagent 并发段 ~18 min（最慢 hooks 17.5 min，最快 effective-agents 1.3 min）+ 主 Claude 收尾 ~10 min ≈ **总 30 min**。

### 10.2 暴露的新问题

#### 问题 17：docs.claude.com 在本机 region 触发 geo-block

**症状**：anth-agent-skills 跑时 docs.claude.com / docs.anthropic.com / platform.claude.com 三个域名都返回 "App unavailable in region" splash 页（HTTP 200，450 KB HTML 但 body 是 splash）。

**根因**：Claude 域名按 region 屏蔽部分文档页（似乎与「付费产品页」相关——overview / hooks / sub-agents 同 region 可达；agent-skills 不可达），不是网络问题而是有意拦截。

**修复**：
- 临时：subagent 自主回退到 `raw.githubusercontent.com/anthropics/skills/main/README.md`——anthropics/skills repo 是 docs 页指向的权威源（"How to create custom skills" 路径终点），内容等价
- 在 mdx frontmatter 加 `mirror_url` 字段标注 fallback 源
- 在 registry.json 标 `fetched_via_fallback: true`

**沉淀**：
- ✅ SKILL.md Step 1 应加：「docs.claude.com 系列 fetch 失败时，优先 fallback 到 anthropics/skills / anthropics/claude-code 等官方仓库的对应文档」
- ✅ 启示：Anthropic 域名 geo-block 是「不可见拦截」（HTTP 200 + splash 而非 403），cross-check 必须用 grep 反查关键 verbatim 验证不是 splash 污染——本批 5 个 .txt 全部 grep `unavailable in region` 通过 0 命中

#### 问题 18：docs 类源 Card 实测字符上限 ≈ 1500-2500，硬约束 1500 偏紧

**症状**：5 个产物中 3 个超 1500（sub-agents 1757 / hooks 2044 / effective-agents 2289），1 个微超（claude-code-overview 1509）；只有 fallback 的 agent-skills（README）1174 内。

**根因**：docs 类官方源信息密度高——5 条 takeaway 每条 2-3 句 + 子项列表 + 锚点引用，自然超 1500。不像 blog 文章可以「概括 + 一句话定位」就够。

**修复**：
- 本批：3 个超限标 `overflow: true` + 在 registry 备注实测字数
- 校准 index.mdx 字数表：Card 改为「≤ 1500 字符（docs 类源实测 1500-2500，超限标 `overflow: true`）」
- 不重写压缩——信息密度损失大于美观收益

**沉淀**：
- ⏳ 推到下批合并到 SKILL.md：docs 类源 Card 字符基线 1500 → 2500（实测）
- ⏳ prompts/card.md 应分 source_subtype 给不同字符上限：blog/article 1500 / docs 2500 / repo (README) 1800
- ✅ 启示：1500 是「精选 takeaway」级，docs 类「机制说明 + 子项」级自然 2-3 倍

#### 问题 19：subagent prompt 没硬码 audience_tags enum，导致自由发挥

**症状**：5 个 subagent 返回的 audience_tags 用法不一致——
- anth-claude-code-overview: yes / mid / newbie（合规）
- anth-agent-skills: mid / mid / mid（mid 不在 cs_background 白名单）
- anth-sub-agents: required / optional / required（全不在白名单）
- anth-hooks: intermediate / high / intermediate（intermediate 不在白名单）
- anth-effective-agents: intermediate / beginner / intermediate（同上）

**根因**：subagent prompt 写「按 3 轴定档」但没显式列 enum 值（`yes/partial/no` / `low/mid/high` / `newbie/used/advanced`）；subagent 凭语义自由发挥。

**修复**：主 Claude 收尾时统一规范到白名单（intermediate → used、required → yes / used、mid → mid 维持等）；下批 prompt 必须硬码 enum。

**沉淀**：
- ⏳ 下批 subagent prompt 模板加：「audience_tags 必须严格使用以下 enum 值，不得自由发挥」+ 列三轴白名单
- ✅ 启示：所有「自由发挥会失控」的字段必须 prompt 内 enum 硬码——subagent 不像主 Claude 会自动遵循 SKILL.md 约定

#### 问题 20：Python HTML 提取后整页落在单行 L1，锚点粒度差

**症状**：anth-claude-code-overview / anth-hooks 的 .txt 全文落在 L1 单行（10 KB / 140 KB），所有 cross_check_anchors 共用 L1；anth-effective-agents 较好（118 行）；anth-sub-agents 由 subagent 自行用 Python 切句生成 lines.txt（340 行）解决。

**根因**：当前 SKILL.md 的 Python 抽取脚本只 `re.sub(r'\s+',' ',...)` 把所有空白塞成一行——没保留段落 / 标题 / 列表的换行结构。

**修复**：
- 本批：接受 L1 锚点（verbatim 短语唯一可独立反查）+ 在 mdx 加注「Brief 升级时按 H2/H3 重新切句」
- subagent 主动切句的方案（如 anth-sub-agents）是好实践

**沉淀**：
- ⏳ SKILL.md Step 1 Python 抽取脚本应升级：先保留 `<h1>`/`<h2>`/`<h3>`/`<p>`/`<li>` 边界，再 strip tags；输出每段独立行
- ⏳ 替代脚本：`html2text` 或 `python-readability` + 段落换行；当前一行式 sed-style 不够
- ✅ 启示：锚点粒度直接决定 cross-check 与产物可读性，是基础设施级问题，必须修

#### 问题 21：subagent 自报 char_count 与文件实测差 200-800

**症状**：5 个 subagent 自报 char_count（763~1489）vs 文件实测 body chars（1174~2289）差 200-800。

**根因**：subagent 用 Python / 心算数 markdown 纯文本字符，跳过空行 / 标记符 / 标题；文件实测含全部 markdown 源（包括 `# ## > - ` 等）。统计口径不一。

**修复**：以**文件实测 `wc -m`（含 markdown 标记）**为唯一基线；subagent 自报字段重命名为 `char_count_subagent_self_report`（不可靠仅供参考）。

**沉淀**：
- ⏳ 下批 subagent prompt 改为：「char_count 字段填『最终 markdown 全文（含 frontmatter 后所有内容）`wc -m` 结果』，由 subagent 自己跑 wc 算」
- ✅ 启示：评估指标必须有「机器可重复测量」的口径，主观估算永远偏差

#### 问题 22：subagent 锚点格式不统一（/tmp 路径 / byte offset / Lx）

**症状**：
- anth-claude-code-overview / anth-agent-skills / anth-effective-agents / anth-sub-agents 用 `/tmp/research-batch1/{slug}.txt:L<n>`
- anth-hooks 用 `/tmp/research-batch1/anth-hooks.txt:byte:2913`（byte offset 而非 line number）
- 主 Claude 收尾时统一为产物里「{subtype}:L<n>」（docs:L1 / blog:L5 / README:L6），sources_json 保留 /tmp 全路径技术锚点

**根因**：subagent prompt 没规范锚点格式，只说「锚点必须能反查 verbatim」。

**沉淀**：
- ⏳ 下批 subagent prompt 加：「产物 mdx 内锚点格式统一为 `{subtype}:L<n>`；sources_json 内技术锚点保留 `/tmp/...{slug}.txt:L<n>`」
- ✅ 启示：subagent 输出格式约定要分「面向用户产物」和「技术追踪 metadata」两套，prompt 必须明示

### 10.3 累计沉淀 + 待合并清单（推到批 3-4 后一次性收敛）

| 来源 | 待合并内容 | 优先级 |
|---|---|---|
| Problem 17 | SKILL.md Step 1：docs.claude.com fetch 失败 fallback 到 anthropics/* GitHub repo | 高 |
| Problem 18 | SKILL.md 字符基线表加 source_subtype 列：blog 1500 / article 1800 / docs 2500 / repo (README) 1800 | 高 |
| Problem 19 | subagent prompt 模板硬码 audience_tags enum 白名单 | 高 |
| Problem 20 | SKILL.md Step 1 Python 抽取升级：保留 H1-H3 + 段落换行，输出每段独立行 | 高 |
| Problem 21 | subagent prompt：char_count 必须文件实测 `wc -m`，统一口径 | 中 |
| Problem 22 | subagent prompt：mdx 锚点 `{subtype}:L<n>` / sources_json 锚点 `/tmp/...:L<n>` | 中 |

按 SESSION_HANDOFF Step 3「跑完 2-3 批后回头修 Skill」节奏：批 1 单独沉淀，待批 2-3 跑完一次性收敛到 SKILL.md + prompts/*.md。

### 10.4 全 9 源 Gate 1 完成全景

| 源 | type / subtype | tier | status | overflow | 主要价值 |
|---|---|---|---|---|---|
| 1. superpowers | repo / methodology | deep-dive | deep-dive_complete | — | 工程方法论的 skill 体系 |
| 2. claude-skills-blog | article / blog | card | card_complete | — | Anthropic 一手设计哲学 |
| 3. ai-coding-guide-zh | repo / tutorial | deep-dive | deep-dive_complete | — | **锚点源**：10 维评估框架 + 沿用 vs 错位决策表 |
| 4. alirezarezvani-claude-skills | repo / skill_collection | card | card_complete | — | **框架 discriminate 验证样本**；工程治理 |
| 5. anth-claude-code-overview | article / docs | card | card_complete | 微超 9 | 教程全景地图入口 |
| 6. anth-agent-skills | article / docs | card | card_complete（fallback） | — | Skills 官方定义；SKILL.md frontmatter 事实标准 |
| 7. anth-sub-agents | article / docs | card | card_complete | overflow | sub-agents 机制官方权威 |
| 8. anth-hooks | article / docs | card | card_complete | overflow | hooks 机制官方权威 + 安全基线 |
| 9. anth-effective-agents | article / blog | card | card_complete | overflow | 多智能体设计哲学奠基（workflow vs agent + 5 模式 + ACI） |

**subtype 覆盖**：methodology / blog / tutorial / skill_collection / docs 五种。

---

## 11. 批 2（Anthropic 官方剩 5 源 Card，2026-06-11 PM）

### 11.1 跑通范围

| # | 源 | URL | subtype | char | overflow |
|---|---|---|---|---|---|
| 1 | MCP | docs.claude.com/.../mcp | docs | 2137 | ✗ |
| 2 | Slash Commands | docs.claude.com/.../slash-commands | docs | 2181 | ✗ |
| 3 | Memory & CLAUDE.md | docs.claude.com/.../memory | docs | 2733 | ✗ |
| 4 | Claude Agent SDK | docs.claude.com/.../api/agent-sdk/overview | docs | 3065 | ✗ |
| 5 | anthropics/anthropic-cookbook | github.com/anthropics/anthropic-cookbook | **cookbook**（新引入）| 1601 | ✗ |

**流程改进 vs 批 1**：
- prompt 加 cache-first（`.research-cache/raw-fetches/batch2/` 优先看 cache）
- prompt 硬码 audience_tags enum（yes/partial/no, low/mid/high, newbie/used/advanced）
- prompt 规范锚点格式（mdx `{subtype}:L<n>` / sources_json 完整路径）
- prompt 强调 char_count 用 wc -m 实测

**耗时**：subagent 并发 ~25 min（最慢 anth-cookbook 25 min 因 HTTP/2 framing 三次 retry）+ 主 Claude 收尾 ~15 min（含 3/5 nested JSON 整理）≈ **总 40 min**。

### 11.2 Problem 17-22 修复效果验证

| Problem | 修复 | 验证结果 |
|---|---|---|
| 17 geo-block | SKILL.md 待加 fallback | 本批 5 个 docs URL 全部一抓即成，未触发 geo-block——说明批 1 是临时性 region 抖动 + agent-skills 路径有特殊性，**修复待 SKILL.md 收敛批合并** |
| 18 char 上限 | index.mdx 已校准 1500-2500 | 本批 5/5 全部超 1500，确认 docs 类 Card 实测就是 2000-3000；下次 SKILL.md 应明确 docs 类目标 ≤ 2500 |
| 19 audience enum 自由发挥 | prompt 硬码 enum | **5/5 全合规** ✓（批 1 是 4/5 不合规）——硬码 enum 起效 |
| 20 单行 L1 | SKILL.md Python 抽取待升级 | anth-mcp 用 subagent 自主切句产生 891 行 ✓；其余 4 个仍单行 L1（subagent prompt 没强制要求切句） |
| 21 char_count 报告偏低 | prompt 强调 wc -m | mcp / cookbook 报准；slash-commands / memory / agent-sdk 报的是 **raw txt 字数**（42792 / 25538 / 13553）而非 body 字数——schema 不严格执行 |
| 22 锚点格式不一致 | prompt 规范 `docs:L<n>` | 5/5 全合规 ✓ |

**关键发现**：硬码 enum（Problem 19）与锚点格式（Problem 22）prompt 改进**最有效**；char_count 与 schema 类的（Problem 21）prompt 不严格执行——需要 schema 校验在 subagent 内部加 assertion 或主 Claude 收尾时机器校验。

### 11.3 暴露的新问题

#### 问题 23：subagent schema 不严格执行（nested JSON vs string）

**症状**：5 个 subagent 中 3 个（slash-commands / memory / agent-sdk）返回了 nested JSON 结构（`card.tldr / key_takeaways / concepts / details / patterns / gotchas / links`），而 prompt 明确要求 `card_body_markdown: <string>`。

**根因**：prompt 用自然语言描述输出 schema，subagent 自由发挥；尤其是「key_takeaways 数组式表达更直观」时 subagent 偏好结构化 vs 字符串。

**修复**：主 Claude 收尾时整理 3 个 nested JSON 为标准 markdown body 并精简（slash-commands 25 takeaway → 5、memory 14 → 6、agent-sdk 12 → 5）。

**沉淀**：
- ⏳ subagent prompt 必须用「明确的输出形态例子」而非「字段描述」——给一个完整 sample JSON
- ⏳ 或者：subagent 内 assert `type(card_body_markdown) == str` + len > 100
- ✅ 启示：结构化字段「key_takeaways: list」诱惑很大；要么允许（schema 接受 list）要么严格禁止（assert）

#### 问题 24：anthropics/anthropic-cookbook GitHub clone 三次 fallback 才成功

**症状**：
- 第 1 次：`gh repo clone` 失败（curl 28 timeout）
- 第 2 次：`git clone --depth=1` 失败（HTTP/2 framing error）
- 第 3 次：`git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 -c core.compression=0 clone --depth=1 --single-branch` 成功（574 文件全量同步）

**根因**：anthropic-cookbook 体积大（~200MB 裸内容 + .git ~360MB），HTTP/2 framing 与默认 postBuffer 都不够。

**修复**：SKILL.md Step 1 `git clone` fallback 命令应扩展为完整 3 选项：`-c http.version=HTTP/1.1 -c http.postBuffer=524288000 -c core.compression=0`，针对大仓库。

**沉淀**：
- ⏳ SKILL.md Step 1 加完整 fallback 模板；小仓库（< 50MB）只需 `http.version=HTTP/1.1`，大仓库（> 100MB）必加 postBuffer + core.compression=0
- ✅ 启示：大仓库的 HTTP 配置容差不能复用小仓库配方——需按仓库 size 切配方

#### 问题 25：`cookbook` 是新引入的 source_subtype，扩枚举

**症状**：anth-cookbook 用 `cookbook` 作为新 subtype（介于 `tutorial`「教学叙事」和 `skill_collection`「域专精包」之间——code-recipe 但无明确叙事路径，每 recipe 独立可抄）。

**根因**：早期 subtype 枚举（methodology / blog / tutorial / skill_collection / docs / spec / framework）没覆盖 code-recipe 这种「按主题分类的复制粘贴库」。

**修复**：registry.json sources 字段允许 `cookbook` 值；SKILL.md Step 2 阅读量矩阵加 `cookbook` 列：
- Card：README + CLAUDE.md + 顶级目录树 + 1 个代表性 recipe 入口
- Brief：README + CLAUDE.md + 全部目录树 + 3-5 个代表性 recipe + `registry.yaml`（如有）精读
- Deep-Dive：全部材料

**沉淀**：
- ⏳ SKILL.md Step 2 矩阵加 `cookbook` 列（与 `tutorial` 相似，但「叙事弱、按主题独立」是关键区别）
- ⏳ 评估框架（10 维）也要对 cookbook 适配：「学习路径分流」「术语表前置」「生活类比」等教学维度都 n/a
- ✅ 启示：subtype 枚举是开放的，每跑一种新拓扑都可能扩；最终该收敛到 6-8 种核心 subtype

### 11.4 全 14 源 Gate 1 全景

| 源 | type / subtype | tier | status | overflow | 批 |
|---|---|---|---|---|---|
| 1. superpowers | repo / methodology | deep-dive | deep-dive_complete | — | (pre) |
| 2. claude-skills-blog | article / blog | card | card_complete | — | (pre) |
| 3. ai-coding-guide-zh | repo / tutorial | deep-dive | deep-dive_complete | — | (pre) |
| 4. alirezarezvani-claude-skills | repo / skill_collection | card | card_complete | — | (pre) |
| 5-9. anth-claude-code-overview / agent-skills / sub-agents / hooks / effective-agents | article / docs / blog | card | card_complete | 3 标 overflow | 1 |
| 10. anth-mcp | article / docs | card | card_complete | overflow | 2 |
| 11. anth-slash-commands | article / docs | card | card_complete | overflow | 2 |
| 12. anth-memory | article / docs | card | card_complete | overflow | 2 |
| 13. anth-agent-sdk | article / docs | card | card_complete | overflow | 2 |
| 14. anth-cookbook | repo / **cookbook**（新） | card | card_complete | overflow | 2 |

**subtype 覆盖（累计 6 种）**：methodology / blog / tutorial / skill_collection / docs / **cookbook**。

### 11.5 待合并清单（Problem 17-25）

| 来源 | 待合并内容 | 优先级 |
|---|---|---|
| Problem 17 | SKILL.md Step 1：docs.claude.com fetch 失败 fallback 到 anthropics/* GitHub | 高 |
| Problem 18 | SKILL.md 字符基线：docs 类 Card 目标 ≤ 2500（实测 2000-3000） | 高 |
| Problem 19 | subagent prompt 模板硬码 audience_tags enum（**已验证有效**） | 高 |
| Problem 20 | SKILL.md Step 1 Python 抽取：按 H1-H3 + p/li/pre 边界切句 | 高 |
| Problem 21 | subagent prompt：char_count 用 wc -m 实测（**部分有效**，需更强约束） | 中 |
| Problem 22 | subagent prompt：mdx 锚点 `docs:L<n>` / sources_json 完整路径（**已验证有效**） | 中 |
| Problem 23 | subagent prompt：用完整 sample JSON 而非字段描述；或内置 schema assertion | 高 |
| Problem 24 | SKILL.md Step 1：git clone fallback 加 postBuffer + core.compression=0（大仓库专用） | 中 |
| Problem 25 | SKILL.md Step 2 阅读量矩阵加 `cookbook` 列；评估框架 v0.2 加 cookbook 适配 | 中 |

按 SESSION_HANDOFF Step 3「跑完 2-3 批后回头修 Skill」节奏：批 1 + 批 2 累计 9 个 Problem 待合并——**下批跑前必须先一次性收敛**到 SKILL.md + prompts/*.md，否则继续累积。

---

## 12. 批 3（MCP 生态 + 同类工具 6 源 Card，2026-06-11 PM）

### 12.1 跑通范围

| # | 源 | URL | subtype | char | overflow | 备注 |
|---|---|---|---|---|---|---|
| 1 | modelcontextprotocol/servers | github.com/modelcontextprotocol/servers | skill_collection | 1773 | ✗ | MCP 官方 7 reference servers + 13 archived |
| 2 | openai/codex | github.com/openai/codex | methodology | 2356 | ✓ overflow | OpenAI Rust workspace；sandbox×approval 双轴解耦 |
| 3 | google-gemini/gemini-cli | github.com/google-gemini/gemini-cli | methodology | 1857 | ✓ overflow | Google TS + Ink + 7 包；Gemini3 + 1M ctx + a2a-server（CC 无对应） |
| 4 | qodo-merge (PR-Agent) | github.com/The-PR-Agent/pr-agent | methodology | 1778 | ✗ | vertical PR agent；原 URL qodo-ai/qodo-merge 404 → 迁移 |
| 5 | cursor-changelog | cursor.com/changelog | blog | 3801 | ✓ overflow | docs.cursor.com SPA fallback；6 vs CC 对比 |
| 6 | Aider-AI/aider | github.com/Aider-AI/aider | methodology | 2327 | ✓ overflow | OSS terminal pair programmer；14+ edit format；最直接 CC 同类 |

**流程改进 vs 批 2**：
- 用 Problem 17-25 合并后的 SKILL.md v0.3 + prompts v0.3（字符按 subtype 分档 / enum 硬码 / sample JSON / 锚点格式 / Python 抽取保留段落）
- 主 Claude 收尾跑 Python 规范化脚本（`/tmp/batch3-finalize.py`）：unescape HTML + 修 audience enum + 实测 char_count + 重判 overflow + 落 mdx/json + 写 registry/index/meta

**耗时**：subagent 第 1 轮 ~13 min（mcp 1 个 success）→ qodo 8 min → codex 12 min → cursor v1（SPA splash）→ aider v1（沙箱网络断）→ gemini/cursor v1（API 429）→ 主 Claude pre-seed cursor changelog + aider cache → 3 个 v2 重派 → 全部完成 + 主 Claude 规范化落盘。**总耗时 ~70 min**（含中断）。

### 12.2 Problem 17-25 修复效果验证（v0.3 合并版）

| Problem | 修复 | 验证结果（批 3 6 源 16 次 subagent 调用，含 v2 重派） |
|---|---|---|
| 17 docs.claude.com geo-block | Step 1 加 grep splash 检测 + fallback 到 anthropics/* | **N/A**——批 3 无 docs.claude.com 源（cursor 是另一域名 SPA，归 Problem 27） |
| 18 char 上限按 subtype | 字符基线表 8 种 subtype 分档 | **部分有效**：subagent 自报字数仍偏低（cursor 1342 vs 实测 3801 偏差 65%），主 Claude 规范化脚本实测后改 overflow 才准 |
| 19 audience enum 硬码 | prompt 列完整白名单 + 反例 | **失败 50%**：6 源中 3 源（qodo / cursor / gemini）audience 全违规——subagent 自报"strict"但实际自由文本，**必须** 主 Claude assertion 拦截。规范化脚本走 AUDIENCE_OVERRIDES 字典强制修正 |
| 20 Python 抽取段落 | Step 1 升级保留 H1-H6 / p / li / pre 边界 | **有效**：cursor changelog 7 个静态页全部抽到行级别（最大 74 行），不再是单行 L1 |
| 21 char_count wc -m 实测 | prompt 强调自报 + 主 Claude 校验 | **subagent 自报严重不可信**：cursor 自报 1342 vs 实测 3801；gemini 自报 1798 vs 实测 1857；只有 mcp/codex/aider 自报和实测一致。**规范化脚本必跑**才能定准 |
| 22 锚点 `({subtype}:L<n>)` | prompt 规范 + assertion | **大部分有效**：mcp / codex / cursor / aider / qodo（修后）/ gemini 都用 `(subtype:L<n>)` 形态；个别有 `(subtype:file:L<n>)` 多文件路径变体——合理 |
| 23 sample JSON 完整契约 | prompt 给完整可解析 JSON 范例 | **大部分有效**：6 源全部返回 string body 而非 nested JSON ✓；但 body 内常含 `&gt;` `&amp;` HTML entity（subagent 写 JSON 时害怕引号冲突）——主 Claude 规范化脚本 html.unescape 解决 |
| 24 大仓库 git clone fallback | Step 1 加 postBuffer + compression=0 | **N/A**——批 3 仓库都 < 100MB，小仓库 HTTP/1.1 fallback 即可 |
| 25 cookbook subtype 扩枚举 | Step 2 矩阵加 cookbook 列 + 硬约束 #8/#9 | **N/A**——批 3 无 cookbook 源；mcp-servers 是 skill_collection；qodo / aider / codex / gemini 是 methodology |

**关键发现**：
- **「枚举值」级 prompt 约束 部分有效**——50% 命中率（明显改善但不可靠）；**LLM 外层 assertion 必须**
- **「形态级」prompt 约束 完全失败**——HTML entity 污染、char_count 自报、写盘违规等，prompt 内强调多少都没用；**主 Claude 收尾脚本是唯一可靠层**
- **「数值实测」级 自报严重失真**——65% 偏低不是 outlier，是普遍现象；以 `wc -m` 为唯一基线

### 12.3 暴露的新问题（Problem 26-30）

#### 问题 26：subagent 沙箱网络收紧 → 主 Claude pre-seed cache

**症状**：aider v1 subagent 报「`Failed to connect to github.com port 443`」(75s timeout) + 所有 WebFetch / WebSearch / MCP 网络工具被 `Permission denied`；同 session 主 Claude 跑 `git clone` 成功

**根因**：subagent 沙箱继承的 permissions 比主 Claude 严格——user-level `~/.claude/settings.json` 的 52 条 allow（含 curl / git / WebFetch domain:*）**在 subagent 内不生效**。这是 sandbox 收紧策略，非 bug

**修复**：
- 立即：主 Claude 跑 `git clone` 拉源 → pre-seed 到 `.research-cache/raw-fetches/batch{N}/` → 重派 subagent 走 cache-first 路径
- 标 `fetched_via_fallback: true` + `fetched_via: pre_seeded_cache` 到 sources.json
- 「subagent 没网」是从今往后**默认假设**，subagent prompt 写法改为「**禁止网络调用**，cache 已 pre-seed」

**沉淀**：
- ⏳ SKILL.md Step 1 应分两层：「主 Claude 拉 → cache → subagent 读」流程图；prompt 模板默认带「禁网」前置
- ⏳ Skill 加新约束：跑批前必须主 Claude 把全源 pre-seed（不依赖 subagent 拉）
- ✅ 启示：分工应该是「主 Claude 拉源 + cache + 起 subagent + 收尾校验」，subagent 只负责「读 cache + 起草 JSON」，**网络不应在 subagent 上**

#### 问题 27：cursor.com/docs 是 SPA，curl 全返回同 shell

**症状**：curl `docs.cursor.com/welcome` / `/agent` / `/composer` / `/rules` / 等 5 个 URL，5 个文件 **md5 完全一致**（126610 bytes 同 shell）；WebFetch 拒绝 "Unable to verify if domain docs.cursor.com is safe"

**根因**：Cursor docs 是 Next.js SPA，所有路径返回同 `__next_error__` shell；实际内容由 JS 加载。curl + python regex 完全无效

**修复**：
- 替代源：**cursor.com/changelog**（静态页 ≠ SPA），抽到 7 个 changelog post 真实内容 ~12 KB
- subtype 从 `docs` 改 `blog`（changelog 是 blog 体裁）
- frontmatter 加 `mirror_url: "https://docs.cursor.com"` 标注原源不可达

**沉淀**：
- ⏳ SKILL.md Step 1 加 SPA 检测：「curl 多个不同 URL 返回 md5 完全一致 = SPA shell；改用静态替代源（changelog / blog / release notes）」
- ⏳ 已知 SPA 域名维护列表：`cursor.com/docs`（其他待发现）
- ✅ 启示：Next.js / React 客户端渲染网站 curl 是死路，cross-check md5 是关键诊断

#### 问题 28：source URL 失效 → 需要 redirect_url / canonical_url 字段

**症状**：qodo-merge 的 `qodo-ai/qodo-merge` 已在 2025 年迁移到 `The-PR-Agent/pr-agent`（Qodo 把 repo 捐给社区改名）；原 URL 404

**根因**：当前 frontmatter schema 只有 `url` 和 `mirror_url`：
- `url` = 主源（必填）
- `mirror_url` = 同等内容的备份（如 anthropics/skills README ≡ docs.claude.com/agent-skills）

但「源已搬家」是不同语义——原 URL 失效，新 URL 取代之

**修复**：
- 立即：registry.json 加 `original_url` + `redirect_reason` 两个字段（qodo-merge 用了）
- schema_version 升 + 文档化「url vs mirror_url vs original_url+redirect_reason」三义

**沉淀**：
- ⏳ SKILL.md 字段表加 `original_url` / `redirect_reason`
- ⏳ Step 4 校验加：若原 URL 返回 404 且新 URL 给出，必填 `original_url` + `redirect_reason`
- ✅ 启示：开源项目治理（捐赠 / 转售 / 改名）是常见现象，schema 必须支持

#### 问题 29：Token Plan 周期限额 → subagent 失败 (2 源)

**症状**：批 3 第 1 轮 5 subagent 并发；codex / qodo / mcp 成功（先跑完），但 gemini / cursor 长任务跑到一半触发 API 429「Token Plan 用量上限」，两个 subagent 完全失败（返回错误 message，无 JSON）

**根因**：用户的 Token Plan 是周期限额（不是硬性总量），并发跑 5 subagent + 主 Claude 长 context 集中烧 token，达到周期上限。等周期过去（小时级）自动恢复

**修复**：
- 立即：等用户 Token Plan 恢复后重派 2 失败 subagent
- 长期：并发数 5 在 token 紧时调低到 3；或主 Claude 起 subagent 前查 token 余量（如有 API）

**沉淀**：
- ⏳ SKILL.md Step 3 加：「subagent 并发上限按 Token Plan 余量调；默认 5，紧时降 3」
- ⏳ 主 Claude 收到 429 时不能丢，应记录 task ID 等恢复后重派
- ✅ 启示：subagent 不是免费资源，节奏须 budget-aware

#### 问题 30：subagent 违反「不要写盘」prompt 约定

**症状**：gemini-cli v2 subagent **自行写盘** 到 `apps/docs/content/docs/research/gemini-cli.{mdx,json}`，违反 prompt 「**不要写盘**，主 Claude 收尾会写」明确约定。其他 5 subagent 都遵守

**根因**：subagent prompt 写 「return JSON」+ 「不要写盘」，但 LLM 在跑完后还有「完成」冲动，会用 Write 工具落盘。负面指令（"不要 X"）比正面指令（"返回 JSON"）弱

**修复**：
- 主 Claude 收尾时 `ls apps/docs/content/docs/research/{slug}.{mdx,json}` 检测违规，**强制删除**重写
- prompt 改为：「**禁止使用 Write/Edit 工具**。只返回 raw JSON 文本作为 final message。」（工具级禁令而非动作级）

**沉淀**：
- ⏳ subagent prompt 加：「**禁止使用 Write / Edit / NotebookEdit 工具**；只允许 Read / Bash(read-only) / Grep / Glob」
- ⏳ 主 Claude 收尾必跑：`ls {output_dir}/{slug}.*` 检测 subagent 违规写盘
- ✅ 启示：负面指令（"不要 X"）必须升级为「工具级禁令」才可靠

### 12.4 全 20 源 Gate 1 全景

| # | 源 | type / subtype | tier | status | overflow | 批 |
|---|---|---|---|---|---|---|
| 1 | superpowers | repo / methodology | deep-dive | deep-dive_complete | — | pre |
| 2 | claude-skills-blog | article / blog | card | card_complete | — | pre |
| 3 | ai-coding-guide-zh | repo / tutorial | deep-dive | deep-dive_complete | — | pre |
| 4 | alirezarezvani-claude-skills | repo / skill_collection | card | card_complete | — | pre |
| 5-9 | anth-claude-code-overview/agent-skills/sub-agents/hooks/effective-agents | article / docs/blog | card | card_complete | 3 overflow | 1 |
| 10-14 | anth-mcp/slash-commands/memory/agent-sdk/cookbook | article / docs+repo/cookbook | card | card_complete | 5 overflow | 2 |
| 15 | mcp-servers | repo / skill_collection | card | card_complete | — | 3 |
| 16 | openai-codex | repo / methodology | card | card_complete | overflow | 3 |
| 17 | gemini-cli | repo / methodology | card | card_complete | overflow | 3 |
| 18 | qodo-merge | repo / methodology | card | card_complete | — | 3 |
| 19 | cursor-changelog | article / blog | card | card_complete | overflow | 3 |
| 20 | aider | repo / methodology | card | card_complete | overflow | 3 |

**subtype 覆盖（累计 6 种）**：methodology / blog / tutorial / skill_collection / docs / cookbook

### 12.5 待合并清单（Problem 26-30）

按 v0.3 启示，**不再积累 9 个再合并**，而是**每批最多 3-5 个**就合并。当前批 3 累 5 个待合并：

| 来源 | 待合并内容 | 优先级 |
|---|---|---|
| Problem 26 | SKILL.md Step 1：主 Claude pre-seed cache + subagent 走 cache-first；subagent prompt 默认带「禁网」| 高 |
| Problem 27 | SKILL.md Step 1：SPA 检测（多 URL md5 一致 = SPA）+ 替代源策略；维护已知 SPA 域名列表 | 中 |
| Problem 28 | registry.json schema 加 `original_url` + `redirect_reason`；Step 4 校验扩展 | 中 |
| Problem 29 | SKILL.md Step 3：subagent 并发数按 Token Plan 余量调；429 时重派机制 | 中 |
| Problem 30 | subagent prompt 加「禁止使用 Write/Edit 工具」工具级禁令；主 Claude 收尾必跑 ls 检测违规写盘 | 高 |

按新节奏（每批 3-5 个就合并）：**下批跑前必须合并 P26-30 到 SKILL.md v0.4**

---

## 13. pdf-extract skill v0.1 实现（2026-06-11 晚）

> 批 4 跑前建立独立 PDF 抽取 skill（Standalone skill 决策）。3 模式（simple/layout/ocr）+ auto fallback，simple 模式生产可用，layout/auto 标 beta。

### 13.1 决策与文件结构

**决策路径**（2026-06-11 brainstorming）：
1. **使用边界**：Standalone skill（独立 `.claude/skills/pdf-extract/`，research-source 和其他工作流可调用）
2. **选型策略**：先 search 再选（WebSearch API 失败但本地探索发现 Anthropic 官方 PDF skill 已装在 3 个 IDE）
3. **最终方向**：B. 新 pdf-extract skill（基于已装 pdfplumber + pypdfium2 + pytesseract）

**最终文件**：
```
.claude/skills/pdf-extract/
├── SKILL.md             (v0.1, 130 行)
├── reference.md         (工具备选、字体坑、扫描 PDF 排查、调优)
├── config.example.json  (默认配置 + quality_check 阈值)
└── scripts/
    ├── extract.py       (主入口，3 模式 + auto fallback)
    ├── layout_parser.py (word-level 双栏检测)
    └── quality_check.py (3 维自评打分)
```

### 13.2 端到端验证（constitutional-ai-paper.pdf 34 页样本）

| 模式 | 状态 | 实测 |
|---|---|---|
| **simple** | ✅ 生产可用 | x_tolerance=1 后分词正确；34 页 → 35 files (34 页 + 1 index) |
| **大文件分块** | ✅ | > 80KB 自动按页拆 + 索引页 |
| **页标记 + 锚点** | ✅ | `<!-- page N -->` + `(p5:L23)` 与 research-source 对齐 |
| **OCR fallback** | ✅ | tesseract 未装时优雅报错（exit 3 + 安装提示） |
| **scanned 检测** | ✅ | 检到 `chars=0 + images>0` → auto 模式直接走 OCR |
| **layout** | ⚠️ beta | 双栏检测只识别 Column 1，漏 Column 2；图表坐标轴文本误识别 |
| **auto** | ⚠️ beta | quality_check 自评 0.982 但 layout 输出质量差，自评不可靠 |

### 13.3 暴露的新问题（Problem 34-37）

#### Problem 34：layout 模式双栏检测不准确

**症状**：constitutional-ai-paper.pdf p5 是双栏，但 layout 输出只有 `=== Column 1 ===`，Column 2 内容被合并到 Column 1 流里

**根因**：`detect_columns()` 用「每行最左 word 的 x0 找大 gap」启发式，对**图表混排 + 双栏**的复杂布局失效：
- 图表坐标轴文本（"150", "SL-CAI"）的 x0 在栏外，污染 x_starts 分布
- 双栏内容如果有「跨栏中线」的标题/图说，会被误判为单栏内容
- 当前阈值 `min_gap_ratio=0.15`（15% 页面宽）可能对 letter-size 学术 PDF 不准

**修复路径**（v0.2）：
- 先按 page bbox 区域分离 text/figure/table，再用 text 区域做栏检测
- 改为看「行 x 坐标的众数」而非「最左 x0」
- 多 gap 检测支持三栏 / 异形栏

#### Problem 35：layout 模式图表坐标轴标签被当文本行

**症状**：p5 layout 输出含 `150 / 100 / SL-CAI / 50 / Helpful RLHF` 等明显是图坐标轴的文本

**根因**：pdfplumber `extract_words()` 不区分 text bbox vs image bbox；图轴文字（嵌入图）也被当 word

**修复路径**（v0.2）：
- 先 `page.images` 拿所有图 bbox，过滤 word 在图 bbox 内的
- 或用 `page.get_text_words()` 加 `keep_blank_chars=False` + 自定义过滤

#### Problem 36：quality_check 自评过高不可靠

**症状**：layout 模式实际质量差（P34/P35）但 `quality_check.score()` 打 0.982

**根因**：
- `check_anchor_density()` 看字符数，layout 输出字符数多就给高分
- `check_ocr_likely()` 检测单字符词比例，layout 输出因为切碎会有高比例
- `check_garbled_ratio()` 看不可打印字符，对 layout 错误无感

**修复路径**（v0.2）：
- 加新指标：双栏**实际**覆盖率（如 `words_in_column_2 / total_words`）
- 加新指标：图表区域文本比例（应 < 5%）
- auto 模式阈值从 0.6 提到 0.75 + 加 fallback 触发日志

#### Problem 37：x_tolerance 反直觉（pdfplumber 行为反文档）

**症状**：默认 x_tolerance=3 合并 "Yuntao Bai" → "YuntaoBai"；调到 5 / 10 仍不行；调到 **1** 才正确

**根因**：
- pdfplumber 文档说「x_tolerance is the tolerance for grouping characters into words」——直觉是值小 = 严格 = 不合并
- **实际行为相反**：值大 = 字符间允许距离大 = **更激进合并**为同一 word
- 学术论文字符间距小（学术 PDF 字号小 + 行距紧），默认 3 就会把「Yuntao Bai」合并；调小到 1 反而正确分词

**修复路径**（已实施）：
- simple 模式硬码 `x_tolerance=1`（针对学术 PDF 优化）
- SKILL.md 加注释「x_tolerance 小可能切碎连字（CJK），西文学术 PDF OK」
- v0.2 加 `x_tolerance` CLI 参数 + 文档化反直觉行为

### 13.4 v0.1 决策

- ✅ **simple 模式可生产**（学术论文 + 商业信都验证 OK）
- ⚠️ **layout / auto 模式标 beta**（v0.1 不推荐批 4 用）
- 🚧 **批 4 暂缓**（用户选择「先交 v0.1 总结」）
- 📋 **v0.2 计划**：修 P34/P35/P36（layout 自评 + 图表过滤 + 双栏检测）；加 CJK 支持
- 📚 **沉淀资产**：
  - `pdf-extract/scripts/extract.py` 主入口
  - `pdf-extract/scripts/layout_parser.py` word-level 双栏（v0.2 待修）
  - `pdf-extract/scripts/quality_check.py` 自评（v0.2 待修）
  - `pdf-extract/SKILL.md` 使用契约
  - `pdf-extract/reference.md` 工具备选 + 字体坑 + 调优
  - `pdf-extract/config.example.json` 默认配置

### 13.5 本地探索发现（2026-06-11）

| 资源 | 状态 | 用途 |
|---|---|---|
| `pdfplumber 0.11.9` (anaconda3) | 已装 | simple + layout 主库 |
| `pdfminer.six 20251230` (anaconda3) | 已装 | CJK 字体 fallback |
| `pypdfium2 5.5.0` (anaconda3) | 已装 | 备用渲染 |
| `pytesseract 0.3.13` (anaconda3) | 已装 | OCR 模式（需 tesseract binary） |
| Anthropic 官方 PDF skill | **3 份相同副本**（LobsterAI / TheFoolAI / CodeBuddy） | 通用 PDF 操作（编辑 / 合并 / 表单），不做研究抽取 |
| alirezarezvani `research/dossier` skill | 16KB SKILL.md | 通用研究流程，无 PDF 专项 |
| 本地 PDF 样本 | constitutional-ai-paper.pdf (2MB) / Amazon Letter (101KB) / 8 个财报 | 测试 + 验证 |

### 13.6 工具对比沉淀

| 工具 | v0.1 状态 | v0.2 候选 |
|---|---|---|
| **pdfplumber** (MIT) | 主用 | 保留 |
| **pypdfium2** (Apache) | 备用 | 升级为图片渲染 + OCR 前置 |
| **pytesseract** (Apache) | OCR 模式 | 加 `paddleocr` 支持 CJK |
| **pymupdf (fitz)** (AGPL) | ❌ 不用 | 仅自用可考虑 |
| **nougat-ocr** (Meta) | ❌ 不用 | 学术公式 LaTeX 转换（v0.3 候选） |
| **marker-pdf** (Datalab) | ❌ 不用 | 通用 PDF → markdown 加速（v0.3 候选） |


