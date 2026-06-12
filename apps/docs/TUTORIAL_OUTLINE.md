# Claude Code 中文教程大纲（初版 v0.1 — 广度优先）

> 本大纲追求覆盖面，后续逐步审核增删改。
> 素材标注：🟢 = Deep-Dive 源已饱和 / 🟡 = Brief 源可用，需扩写 / 🔴 = 素材空缺，需补充调研

---

## 第一篇：入口 — 5 分钟定位

### 00. 教程地图：怎么读这教程

- **目标**：读者 5 分钟决定从哪章开始
- **解决的问题**：教程很长，怕读完没收获
- **子章**：
  1. 这教程写给谁（3 类读者画像）
  2. 4 条阅读路径：A 快速上手（30 分钟）/ B 完整学习 / C 问题排查 / D 专项深挖
  3. 每章一句话 + 预计阅读时间
  4. 学完能干什么
- **素材**：🟢 `ai-coding-guide-zh` (Deep-Dive)
- **字数预估**：2500–3500

---

## 第二篇：上手 — 从零到第一个项目

### 01. Claude Code 是什么 & 环境配置

- **目标**：装好 CC + 跑通第一个 prompt
- **解决的问题**：装 CC 怎么这么难？VPN、brew、支付、封号——中国市场专有问题
- **子章**：
  1. CC 是什么（一句话 + vs Cursor/Copilot 定位区分）
  2. 什么场景用 CC，什么场景别用
  3. 环境准备：VPN、Node.js、Git（Windows/Mac/Linux 三平台）
  4. 安装（brew 优先 / npm 备选 / 权限坑）
  5. LLM 路由代理（cc-switch / 多模型切换）
  6. 订阅支付 & 封号风险（中国市场详写）
  7. 第一个 prompt：`hello world` → 读代码 → 改 bug
- **素材**：🟡 `anth-claude-code-overview` (Brief) + 自主补充中国市场内容
- **字数预估**：4000–5000

### 02. 对话基础：slash commands & 权限系统

- **目标**：掌握常用 slash commands + 理解权限弹窗
- **解决的问题**：不知道 CC 能干什么、权限弹窗一脸懵
- **子章**：
  1. 常用 slash commands 速览（/help /clear /compact /memory /cost /review）
  2. 权限系统：allow/deny/always allow 三种选择什么时候用
  3. 对话技巧：怎么给 CC 下指令最有效（精确 > 含糊、给上下文 > 裸问）
  4. 理解 CC 的"工具调用"（Bash/Read/Write/Edit/WebFetch——它在干什么）
- **素材**：🟡 `anth-slash-commands` (Brief) + `anth-effective-agents` (Brief)
- **字数预估**：3500–4500

---

## 第三篇：核心机制 — 让 CC 听话、记住、复用

### 03. Hooks：让 CC 守规矩的 8 条铁律

- **目标**：写一个 PreToolUse hook 拦截危险命令
- **解决的问题**：CC 乱删文件、改坏代码、泄露 secret
- **子章**：
  1. Hooks 是什么（事件驱动拦截器 vs cron/Makefile）
  2. 5 类 handler × 3 层事件
  3. 8 条安全基线（全权限 / 命令注入 / 路径穿越 / 相对路径 / secret / OSC / timeout / 泄露）
  4. 实战：pre-bash-validator.sh（白名单 + 防御）
  5. 企业级：allowManagedHooksOnly + 审计
  6. vs Cursor /review / Codex hooks / GitHub Actions 横向
- **素材**：🟢 `anth-hooks` (Deep-Dive) ✅ **已写初稿**
- **字数**：4278

### 04. 记忆系统：跨会话记得你

- **目标**：配好 4 级 CLAUDE.md + auto memory
- **解决的问题**：每次开新 session CC 都不认识你
- **子章**：
  1. 双层机制：CLAUDE.md vs auto memory（谁写 / 范围 / 加载）
  2. 4 级加载链：Managed > User > Project > Local
  3. 子目录懒加载 + path-scoped rules（monorepo 实战）
  4. auto memory 维护策略（MEMORY.md 索引 + 200 行截断）
  5. /compact 陷阱（子目录不 re-inject）
  6. 团队记忆策略（个人 vs 共享）
  7. vs Cursor .cursorrules / Aider CONVENTIONS.md / Codex AGENTS.md
- **素材**：🟢 `anth-memory` (Deep-Dive) ✅ **已写初稿**
- **字数**：4587

### 05. Skill 哲学：怎么把经验写给 CC 用

- **目标**：理解 Skill 是什么 + 能判断一个 Skill 写得好不好
- **解决的问题**：反复教 CC 同一件事——怎么让它"长记性"
- **子章**：
  1. Skill 是什么（文件夹 ≠ 单 .md；vs 命令式插件）
  2. 9 大分类判定（你的需求属于哪一类）
  3. 8 写作建议 0/1/2 评分（满分 16 / 及格 ≥ 8）
  4. Description for model 实战（触发关键词怎么埋）
  5. Gotchas section 沉淀 SOP
  6. 反向审计：用评分表审计自己的 Skill
  7. vs superpowers writing-skills / alirezarezvani 库
- **素材**：🟢 `claude-skills-blog` (Deep-Dive)
- **字数预估**：4500–5000

### 06. Skill 实战：从零写一个可复用 Skill

- **目标**：写出一个评分 ≥ 12 的 Skill 文件
- **解决的问题**：看了 05 章理论，还是不会写
- **子章**：
  1. 从需求开始：什么该写进 Skill（3 次重复 = 候选）
  2. SKILL.md 完整模板（frontmatter + body + gotchas）
  3. 实战案例 1：写一个"React 组件生成器" Skill
  4. 实战案例 2：写一个"数据库 Migration" Skill
  5. 测试 Skill（改→跑→复盘→迭代）
  6. 发布：plugin marketplace / 团队共享
- **素材**：🟡 `anth-agent-skills` (Brief) + `alirezarezvani-claude-skills` (Brief)
- **字数预估**：4500–5000

### 07. MCP：让 CC 接上外部世界

- **目标**：配好一个 MCP server + 理解 transport 选型
- **解决的问题**：CC 只能读本地文件——怎么让它查数据库、调 API、搜网页
- **子章**：
  1. MCP 是什么（协议，不是产品）
  2. 3 种 transport：stdio / SSE / streamable HTTP——什么时候用哪个
  3. 客户端配置：`mcpServers` JSON 4 字段
  4. 安全模型：tool annotations（readOnlyHint / destructiveHint）
  5. 实战：配 filesystem server + memory server
  6. 双栈开发：TS + Python server 工程模板
  7. 常见 MCP server 生态速览
- **素材**：🟡 `anth-mcp` (Brief) + `mcp-servers` (Brief)
- **字数预估**：4500–5000

### 08. Sub-agents：把活派出去

- **目标**：理解什么时候用 sub-agent + 会配 memory 字段
- **解决的问题**：一个 CC 干不完复杂任务——怎么拆解委派
- **子章**：
  1. Sub-agent 是什么（独立 context 的临时工人）
  2. 什么任务该委派（独立 / 并行 / 不需要主 context）
  3. Sub-agent 的 memory 字段（user/project/local——与主 agent 不互通）
  4. Worktree 隔离（什么时候用、代价是什么）
  5. 实战：并行跑 3 个 sub-agent 审计代码
  6. vs Task tool / vs Agent SDK
- **素材**：🟡 `anth-sub-agents` (Brief)
- **字数预估**：4000–5000

---

## 第四篇：工程实践 — 用 CC 做正经项目

### 09. 工程方法论：让 CC 按流程干活

- **目标**：理解 brainstorming → TDD → review 7 步工作流
- **解决的问题**：CC 写代码没测试、没 review、没规划——写完就崩
- **子章**：
  1. superpowers 是什么（方法论框架，不是"插件包"）
  2. 7 步核心工作流：brainstorm → worktree → plans → subagent → TDD → review → finish
  3. TDD 是底线：RED-GREEN-REFACTOR + 反模式库
  4. writing-skills 元方法：写→测→改→A/B→贡献
  5. 实战：装 superpowers 跑一个真实项目
  6. 什么时候**不用**这套流程（过度工程的代价）
- **素材**：🟢 `superpowers` (Deep-Dive)
- **字数预估**：4500–5000

### 10. Git 工作流：worktrees、commit、PR

- **目标**：掌握 CC 下的 Git 最佳实践
- **解决的问题**：CC 改完代码不知道怎么合入——worktree 是什么、commit 规范
- **子章**：
  1. Worktree 隔离：为什么 CC 推荐 worktree 而不是 branch
  2. Conventional Commits（CC 默认格式）
  3. PR 工作流：CC 写 → review → 合入
  4. 实战：从 issue 到 merge 的完整流程
  5. 常见坑：worktree 残留、分支冲突
- **素材**：🟡 `superpowers` (worktree 部分) + 自主补充
- **字数预估**：3500–4500

### 11. Prompt 工程：跟 CC 说话的艺术

- **目标**：掌握给 CC 写 prompt 的核心技巧
- **解决的问题**：同样的问题，别人问 CC 出好结果，你问就瞎编
- **子章**：
  1. 精确 > 含糊（给约束、给格式、给反例）
  2. 上下文 > 裸问（先喂文件、再问问题）
  3. 分步 > 一口气（复杂任务拆成对话链）
  4. 角色扮演：什么时候给 CC 设定 persona
  5. 常见反模式：过度 prompt、互相矛盾的指令
- **素材**：🟡 `anth-effective-agents` (Brief) + `ai-coding-guide-zh` (部分)
- **字数预估**：3500–4500

### 12. 项目配置全指南：settings.json & 多模型

- **目标**：能从头配好一个生产级 `.claude/settings.json`
- **解决的问题**：不知道 settings.json 有多少可配项、多模型怎么选
- **子章**：
  1. settings.json 全字段速览（user / project / local 三层）
  2. 模型选择：Opus vs Sonnet vs Haiku 什么时候用哪个
  3. Token 预算：怎么设、怎么省
  4. 权限配置：permissions 字段完整指南
  5. 环境变量：CC 能读哪些、怎么传 secret
- **素材**：🟡 `anth-claude-code-overview` (Brief) + 自主补充
- **字数预估**：4000–5000

---

## 第五篇：进阶 — 团队 & 生态

### 13. 企业部署 & 治理

- **目标**：理解 managed policy + 审计 + 合规三件套
- **解决的问题**：公司要推 CC——IT 怎么管控、怎么审计、怎么合规
- **子章**：
  1. Managed policy：IT 怎么锁全公司 CC 行为
  2. Hooks 企业级审计（PreToolUse 全量日志）
  3. allowManagedHooksOnly：0 信任模型的代价
  4. 合规清单：SOC2 / ISO27001 问什么、怎么答
  5. 灾难回滚：hook 写错了怎么紧急撤
  6. 跨平台兼容：macOS / Linux / WSL 差异
- **素材**：🟡 `anth-hooks` (Deep-Dive 企业部分) + `anth-memory` (managed policy)
- **字数预估**：4000–5000

### 14. 同类工具横向对比

- **目标**：能根据场景选 CC / Cursor / Codex / Aider / Gemini CLI
- **解决的问题**：这么多 AI 编程工具——我该用哪个
- **子章**：
  1. 6 维决策框架：载体 / 编辑模式 / 评审 / 协作 / 治理 / 生态
  2. CC vs Cursor（terminal-native vs IDE-native）
  3. CC vs Codex（OpenAI 的对标产品）
  4. CC vs Aider（开源社区路线）
  5. CC vs Gemini CLI（Google 生态）
  6. 场景推荐矩阵（个人 / 团队 / 企业 × 前端 / 后端 / 全栈 / 数据）
- **素材**：🟡 `cursor-changelog` (Brief) + `openai-codex` (Brief) + `aider` (Brief) + `gemini-cli` (Brief)
- **字数预估**：4500–5000

### 15. MCP 生态深度：server 开发 & 发布

- **目标**：能写一个 MCP server 并发布
- **解决的问题**：市面上没有我需要的 MCP server——自己写
- **子章**：
  1. MCP server 最小可跑模板（TS + Python 双版）
  2. Tool annotations 实战（readOnlyHint / destructiveHint）
  3. 测试 MCP server（vitest / pytest + MCP Inspector）
  4. 发布到 npm / PyPI + Registry
  5. 实战：写一个"公司内部 API" MCP server
- **素材**：🟡 `mcp-servers` (Brief) + 自主补充
- **字数预估**：4000–5000

### 16. Agent SDK & API 集成

- **目标**：理解什么时候用 SDK 而不是 CLI
- **解决的问题**：CC CLI 很好——但我想把 CC 嵌进自己的系统
- **子章**：
  1. Agent SDK 是什么（vs CLI 的定位差异）
  2. 3 种集成模式：CLI 调用 / SDK 嵌入 / API 直调
  3. 实战：用 SDK 写一个自动 PR review bot
  4. 权限模型差异（SDK vs CLI）
- **素材**：🟡 `anth-agent-sdk` (Brief)
- **字数预估**：3500–4500

---

## 第六篇：实战案例 & 附录

### 17. Cookbook：真实场景实战

- **目标**：跟着做 3-5 个完整案例
- **解决的问题**：看完了理论——给我一个真实项目练手
- **子章**：
  1. 案例 1：从 0 建一个全栈 Web 应用
  2. 案例 2：重构遗留代码库（加测试 + 改架构）
  3. 案例 3：自动化 CI/CD pipeline 配置
  4. 案例 4：数据库 Migration 全流程
  5. 案例 5：API 文档自动生成
- **素材**：🟡 `anth-cookbook` (Brief) + 自主补充案例
- **字数预估**：4500–5000

### 18. 常见问题排查 & 踩坑集

- **目标**：遇到问题 30 秒找到答案
- **解决的问题**：CC 报错了、不听话了、突然慢了——怎么排查
- **子章**：
  1. 安装 & 启动类（brew 失败 / npm 权限 / node 版本）
  2. 行为异常类（CC 不听指令 / 反复改错 / 漏掉规则）
  3. 性能类（越来越慢 / compact 后变笨 / token 消耗异常）
  4. 中国特有问题（VPN 断开 / 支付失败 / 代理配置）
  5. 求助清单：报什么信息、查什么日志、怎么提问
- **素材**：🟡 各源反例汇总 + 自主补充
- **字数预估**：3500–4500

---

## 附录

### 附录 A. Slash Commands 速查表

- 全部 slash commands 按类别排列 + 一句话 + 示例
- **素材**：🟡 `anth-slash-commands` (Brief)
- **字数预估**：1500–2000

### 附录 B. 资源索引

- 官方文档 / 社区资源 / 推荐 Skill 库 / MCP server 列表
- **素材**：🟢 全 20 源汇总
- **字数预估**：1500–2000

---

## 全景统计

| 篇 | 章数 | 素材覆盖 | 总字数预估 |
|---|---|---|---|
| 入口 | 1（00）| 🟢 1 Deep-Dive | ~3,000 |
| 上手 | 2（01–02）| 🟡 3 Brief + 自主补 | ~9,000 |
| 核心机制 | 6（03–08）| 🟢 3 Deep-Dive + 🟡 5 Brief | ~26,000 |
| 工程实践 | 4（09–12）| 🟢 1 Deep-Dive + 🟡 3 Brief + 自主补 | ~17,000 |
| 进阶 | 4（13–16）| 🟡 7 Brief + 自主补 | ~17,000 |
| 实战 & 附录 | 4（17–18 + A–B）| 🟡 2 Brief + 自主补 | ~12,000 |
| **合计** | **18 章 + 2 附录** | **5 Deep-Dive + 15 Brief** | **~84,000 字符** |

---

## 素材缺口（需补充调研）

| 缺口 | 涉及章节 | 优先级 |
|---|---|---|
| 中国市场支付/封号/代理 | 01 | 高 |
| 对话技巧 & 反模式 | 02, 11 | 中 |
| Skill 实战案例（React/Migration）| 06 | 中 |
| MCP server 开发完整模板 | 15 | 中 |
| Agent SDK 代码示例 | 16 | 中 |
| Cookbook 真实案例 | 17 | 中 |
| 常见问题 & 踩坑 | 18 | 低（可在写其他章时逐步收集） |

---

> **下一步**：审核大纲 → 确认增删改 → 确认文笔风格 → 逐章写内容
