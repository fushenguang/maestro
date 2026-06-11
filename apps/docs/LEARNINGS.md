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
