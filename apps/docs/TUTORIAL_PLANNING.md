# Claude Code 教程初版规划（v0.1，2026-06-11）

> 目标：新 session 用 deepseek v4 pro + cogito-writing-witty-essay skill，按本文初版大纲 + 规范，**逐章**产出 5000 字以内的「解决问题型」教程。
> 上一 session 沉淀：20 源研究 + 18 Brief + 5 Deep-Dive（`apps/docs/LEARNINGS.md` Section 16-18）。
> Deep research 资产位置：`apps/docs/content/docs/research/{slug}.mdx`（每源 Card/Brief/Deep-Dive 三段）。

---

## 1. 教程规范（硬约束，违反 = 章节重写）

### 1.1 结构

- **只保留两级目录**：
  - 一级目录（H1/H2 `##`）= 大的具体方向（例：`## Claude Code 简介、环境配置和安装`）
  - 二级目录（H3 `###`）= 该方向具体实施步骤或小目标（例：`### 1. Claude Code 简介`、`### 2. Claude Code 应用场景`）
- **每章字数最多 5000 字**（包含 frontmatter / code 块 / 引用）
- **每章解决 1 个问题，实现 1 个小目标**
- **章节顶部先放「目标内容」**——读者扫一眼知道这章产出什么

### 1.2 模板

```md
## {一级目录：大的具体方向}

> 本章目标：{一句话描述小目标}
> 解决的问题：{一句话描述痛点}

### 1. {二级目录：小步骤或子目标 1}

> {一段话铺垫 / 引子 / 痛点场景}

{正文}

### 2. {二级目录：小步骤或子目标 2}

> ...

### 3. {二级目录：小步骤或子目标 3}

> ...

### N. 本章小结 + 下一章预告

- 本章关键收获（3-5 条 bullet）
- 下一章要解决什么
```

### 1.3 内容形式（三期）

| 期 | 形式 | 实现 | 优先级 |
|---|---|---|---|
| **一期** | 文字 | 直接写 .mdx | **本期实现** |
| 二期 | 短视频 | [remotion](https://github.com/remotion-dev/remotion) 或 [hyperframes](https://github.com/heygen-com/hyperframes) | 后续 |
| 三期 | 语音 / 播客 | （未选型）| 后续 |

### 1.4 风格（强制）

- **使用 `cogito-writing-witty-essay` skill**（位于 `/Users/sunny/.agents/skills/cogito-writing-witty-essay/`）
- 核心 5 大语言特征：
  1. **主角 POV 叙述** — 先建日常场景再引技术概念
  2. **会议室张力结构** — 反直觉结论前置
  3. **两角色对话** — 用冲突讲难点
  4. **具体数字替代抽象** — 「一个月薪水 + 三个月等待」而非「需要很长时间」
  5. **节奏快慢交替** — 长句铺垫 + 短句推动 + 极短句钉死
- 禁用模式：flat 顺序铺陈、零缺陷吹捧、长对话不推进信息、「然而/因此/综上」、技术类比讲技术、「希望本文对你有帮助」
- 风格速查：`styles/witty-humor/profile.md` + `references/style-guide.md` + `references/anti-ai.md`

---

## 2. Deep Research 融合策略（Q3 答案）

### 2.1 5 Deep-Dive 源 → 教程主章 1:1 映射

| Deep-Dive 源 | 教程一级目录 | 文件 |
|---|---|---|
| **anth-hooks** (13672 chars) | `## Hooks：让 Claude Code 守规矩的 8 条铁律` | `tutorials/02-hooks-and-automation.mdx` |
| **anth-memory** (13296 chars) | `## 记忆系统：让 Claude Code 跨会话记得你` | `tutorials/03-memory-and-persistence.mdx` |
| **claude-skills-blog** (18560 chars) | `## Skill 哲学：怎么把经验写给 Claude 用` | `tutorials/04-skill-design-philosophy.mdx` |
| **superpowers** (deep-dive 已存) | `## 工程方法论：让 Claude Code 强制按 TDD 工作` | `tutorials/05-methodology-tdd.mdx` |
| **ai-coding-guide-zh** (anchor 源) | `## Claude Code 教程地图：怎么读这教程` | `tutorials/00-tutorial-map.mdx` |

> **不是把 5 Deep-Dive 段照抄**——是把它当**素材库**用：每章从对应 Deep-Dive 抽 2-3 个最 actionable 的点，用 witty-humor 风格重新表达。

### 2.2 18 Brief 源 → 教程「横向比较章」弹药

每章可在适当位置**穿插横向对比**（沿用各 Brief 的「跨源关联」段）：

| 对比维度 | 用哪些 Brief 源 |
|---|---|
| CC vs 同类工具 (Codex / Aider / Gemini CLI / Cursor) | openai-codex / aider / gemini-cli / cursor-changelog |
| MCP 生态 vs 自建 | mcp-servers / anth-mcp |
| Skill 库 vs 自写 Skill | alirezarezvani / claude-skills-blog / superpowers |
| Sub-agent vs hook 拦截 | anth-sub-agents / anth-hooks |
| Slash commands vs Skill | anth-slash-commands / anth-agent-skills |
| Memory vs auto memory | anth-memory |

### 2.3 融合操作 SOP（写每章时必走）

```
Step 1: 读对应 Deep-Dive .mdx → 抽 2-3 个最 actionable 点
Step 2: 读相关 1-2 个 Brief .mdx → 抽 1 个横向对比素材
Step 3: 写「目标内容」(章节顶部一段) → 让读者先知道产出
Step 4: 写「主角 POV 引子」→ 用 daily-life 场景 / 痛点开场
Step 5: 写正文 → 按 witty-humor 5 大特征 + 4 大节奏
Step 6: 「本章小结 + 下一章预告」→ 收口 + 引导继续读
Step 7: wc -m 校验 ≤ 5000 + 锚点引用 Deep-Dive 源 (file:LL) + 校验
```

### 2.4 引用规范

- **引用 Deep-Dive / Brief 源**用 mdx 锚点：`(docs:LL)` / `(blog:LL)` / `(methodology:LL)` / `(skill_collection:LL)`
- 完整路径（如 `apps/docs/content/docs/research/anth-hooks.mdx:L42`）**不**在 mdx 出现（读者不关心）
- `sources.json` 或 `registry.json` 保留完整路径做 cross-check

---

## 3. 何时补充 Deep Research（Q4 答案）

### 3.1 触发补充的 5 类信号

| 信号 | 检测方式 | 行动 |
|---|---|---|
| **1. 章节「痛点场景」写不出 3 个** | 写正文前 5 分钟如果还卡在「读者到底卡在哪」| 回 Deep-Dive 找反例 + 找原文档的具体 evidence |
| **2. 横向对比写不出 2 维** | 需要 CC vs 同类工具时，没有 Brief 源能直接引 | 跑 subagent 拉新源（Cache-first，P26）|
| **3. 数字 / 配比缺失** | 写「提速 22%」找不到数据出处 | 跑 fetch 到原 .mdx / .txt 找 verbatim 锚点 |
| **4. 反例 < 3 条** | Deep-Dive 主题 3「批判性审视」反例不足 | 补 subagent 拉同源同主题的**批评性**文章 |
| **5. 教程章节候选被引用但没写** | Deep-Dive 末尾的「教程章节候选」出现「未做」标记 | 补 subagent 拉源 |

### 3.2 自动化感知（pre-commit hook 建议）

```bash
# 检测每章末尾是否有「未解决 / TODO / 待补」字样
grep -nE 'TODO|未解决|待补' tutorials/*.mdx
# 命中 → 标 incomplete + 提醒补充
```

### 3.3 当前 5 Deep-Dive 源的「未饱和度」

- **anth-hooks**：8 条安全基线已具体；`pre-bash-validator.sh` 模板可执行 → **饱和**
- **anth-memory**：4 级加载链 + 6 盲点 + 4 工具 7 维对照 → **饱和**
- **claude-skills-blog**：9 分类 + 8 建议 0/1/2 评分 + 反向审计 → **饱和**
- **superpowers**：14 skill 体系 + 7 步工作流 → **饱和**
- **ai-coding-guide-zh**：10 维评估框架 + 39 篇教程结构 → **饱和**

**当前判断**：5 主章的 Deep-Dive 素材**够用**——不需要补充新源。补充需求是**章节间衔接 + 实战案例**——这些由 writing skill 处理，不是 research 问题。

### 3.4 未来补充触发点

跑新批（如 5 同类工具 Cline / Continue / Swe-agent / OpenHands）后，会出现**新横向对比素材**——可补教程「同类工具横向」章。

---

## 4. 初版大纲（v0.1）

> 序号 = 教程推荐阅读顺序；每章目标 + Deep-Dive 源映射。

### 00. 教程地图：怎么读这教程（ai-coding-guide-zh）

> 目标：让读者 5 分钟决定从哪章开始
> 解决的问题：教程很长，怕读完没收获
> 4 路径分流：路径 A 快速上手（30 分钟）/ 路径 B 完整学习 / 路径 C 问题排查 / 路径 D 专项学习

### 01. Claude Code 简介、环境配置和安装

> 目标：装好 Claude Code + 跑通第一个 prompt
> 解决的问题：装 CC 怎么这么难？VPN、brew、订阅支付、封号
> 子章：
> 1. Claude Code 是什么（vs Cursor / Codex / Aider 横向）
> 2. 应用场景（什么任务用 CC，什么不用）
> 3. 环境配置：VPN、基础开发环境、brew 安装（跨 Windows/Mac/Linux）
> 4. 安装 Claude Code（brew 优先 / npm 备选 / 权限注意）
> 5. LLM 路由代理（cc-switch）
> 6. 订阅支付和封号风险（中国市场详写）

### 02. Hooks：让 Claude Code 守规矩的 8 条铁律（anth-hooks Deep-Dive）

> 目标：能写一个 PreToolUse hook 拦截危险命令
> 解决的问题：CC 经常乱删文件、改坏代码——怎么守规矩
> 子章：
> 1. Hooks 是什么（事件驱动的拦截器 vs cron / Makefile）
> 2. 5 类 handler × 3 层事件（何时用什么事件）
> 3. 8 条安全基线（全权限 / 命令注入 / 路径穿越 / 相对路径 / secret / OSC / timeout / 泄露）
> 4. 实战：写一个 pre-bash-validator.sh（白名单 + 防御）
> 5. 企业级：allowManagedHooksOnly + 审计
> 6. vs Cursor /review / openai-codex hooks / GitHub Actions 横向

### 03. 记忆系统：让 Claude Code 跨会话记得你（anth-memory Deep-Dive）

> 目标：4 级 CLAUDE.md 配置 + auto memory 实战
> 解决的问题：每次开新 session CC 都不记得我——怎么破
> 子章：
> 1. 双层机制：CLAUDE.md vs auto memory（谁写 / 范围 / 加载）
> 2. 4 级加载链：managed > user > project > local
> 3. 子目录懒加载 + path-scoped rules（monorepo 实战）
> 4. auto memory 维护策略（MEMORY.md 索引 + topic 文件）
> 5. /memory vs /compact 行为差异（compact 后子目录丢失）
> 6. 团队记忆策略（个人 auto memory vs 团队 CLAUDE.md）
> 7. vs Cursor .cursorrules / Aider CONVENTIONS.md / Codex AGENTS.md

### 04. Skill 哲学：怎么把经验写给 Claude 用（claude-skills-blog Deep-Dive）

> 目标：能写一个可复用 Skill（用 8 建议 0/1/2 评分 ≥ 12）
> 解决的问题：发现反复教 CC 同一件事——怎么让它记住
> 子章：
> 1. Skill 是什么：文件夹，不是单 .md（vs 命令式插件）
> 2. 9 大分类判定（先问「它属于哪一类」）
> 3. 8 写作建议 0/1/2 评分（满分 16 / 优秀 ≥ 12 / 及格 ≥ 8）
> 4. Description for model 实战（含触发关键词埋点）
> 5. Gotchas section 沉淀 SOP（5 次使用复盘）
> 6. /careful / /freeze hook 实战
> 7. 反向审计：用本表审计自己写过的 skill

### 05. 工程方法论：让 Claude Code 强制按 TDD 工作（superpowers Deep-Dive）

> 目标：理解 superpowers 14 skill 体系 + 7 步工作流
> 解决的问题：CC 写代码没测试、没 review、没规划
> 子章：
> 1. superpowers 是什么：方法论框架（vs alirezarezvani 库）
> 2. 7 步核心工作流（brainstorm → worktree → plans → subagent → TDD → review → finish）
> 3. TDD 是底线（RED-GREEN-REFACTOR + 反模式库）
> 4. writing-skills 元方法（5 步：写→测→改→A/B→贡献）
> 5. 7 harness 跨平台触发差异
> 6. vs Anthropic 原生 /skill 的能力差异
> 7. 实战：装上 superpowers 跑一个真实项目

### 06+. 进阶章节候选（后续补充）

> 这些是 Deep-Dive Brief 提到的「教程章节候选」但本 v0.1 不写：
> - MCP 完整实战（anth-mcp + mcp-servers）
> - Sub-agent 委派（anth-sub-agents）
> - Slash Commands vs Skill（anth-slash-commands + anth-agent-skills）
> - 同类工具横向（openai-codex + aider + gemini-cli + cursor-changelog）
> - Agent SDK 集成（anth-agent-sdk）
> - Cookbook 实战（anth-cookbook）
> - Cookbook 教程（ai-coding-guide-zh 39 篇中文范例）
> - Qodo-merge vertical agent（qodo-merge）

---

## 5. 下一 session 启动 Checklist

1. [ ] 读 `apps/docs/TUTORIAL_PLANNING.md`（本文件）
2. [ ] 读 `apps/docs/LEARNINGS.md` Section 16-19
3. [ ] 读 `apps/docs/SESSION_HANDOFF.md` 末态
4. [ ] 决定：先写哪章（推荐 **02. Hooks**——8 条安全基线是最 actionable + 有 pre-bash-validator.sh 模板可直接套）
5. [ ] 写每章前必走 SOP（2.3 节的 7 步）
6. [ ] 写完每章必跑 `wc -m` 校验 ≤ 5000
7. [ ] 章节末尾追加「参考源」段，引 1-3 个 Deep-Dive / Brief

---

## 6. 工具与文件位置

| 文件 | 角色 |
|---|---|
| `apps/docs/TUTORIAL_PLANNING.md` | 本文件（教程规划）|
| `apps/docs/LEARNINGS.md` | 调研沉淀（P1-48 + Section 1-19）|
| `apps/docs/SESSION_HANDOFF.md` | Session 交接 |
| `apps/docs/content/docs/research/{slug}.mdx` | 20 源研究产物（Card/Brief/Deep-Dive 三段）|
| `apps/docs/content/docs/research/registry.json` | 源注册表（version 0.1.8 / skill_version 0.4）|
| `/Users/sunny/.agents/skills/cogito-writing-witty-essay/` | 写作风格 skill |
| `/Users/sunny/.claude/skills/research-source/SKILL.md` | 研究调研 skill（v0.4）|
| `/Users/sunny/.claude/skills/pdf-extract/SKILL.md` | PDF 抽取 skill（v0.3）|

---

## 7. 待办（下一 session 决策）

- [ ] 决定**首批**写哪几章（推荐：00 教程地图 + 01 安装 + 02 Hooks = 最小可用）
- [ ] 决定**首批发布**还是**先内部 review**（推荐内部 review，避免公开发布后又改）
- [ ] 决定**目录结构**：`apps/docs/content/docs/tutorials/` 新建？或 `apps/docs/content/docs/courses/`？
- [ ] 决定**sidebar 配置**：`meta.json` 怎么挂？
- [ ] 决定**写作完成时如何 commit**：每个 chapter 一个 commit？还是合一个？
