# RESEARCH BRIEF — 教程项目选题深度调研

> 调研日期：2026-06-12
> 调研模型：minimax m3
> 调研 skill：research-source v0.4（位于 `/Users/sunny/.claude/skills/research-source/SKILL.md`）
> 完成后产出：`apps/docs/content/docs/research/` 下新增 mdx 文件

---

## 调研目标

为 Claude Code 中文教程寻找 **4 类实践项目选题**，每类找 2-3 个具体候选，最终选出 4-6 个用于教程章节。

代码语言限制：**TypeScript / Rust**（AI 友好——强类型、生态成熟、训练数据充足）。

---

## 四类项目及搜索方向

### 1. 小游戏（提升兴趣，先玩起来）

- 搜索关键词：`TypeScript game framework beginner 2025`、`Rust game engine simple`、`AI coding game tutorial`
- 标准：一个 CC session 内能跑通 MVP、改一个功能只要 5-10 分钟、做完能玩
- 候选方向：Phaser.js 小游戏、Rust + macroquad/ggez、Canvas 原生游戏
- 情绪价值：**好玩**——做完立刻能玩，改完立刻看到效果

### 2. 网站/工具站（使用价值，能给人看）

- 搜索关键词：`Next.js starter template 2025`、`tailwind portfolio site`、`useful web tool ideas`
- 标准：能部署到公网、有实际用途、非技术人员也能理解价值
- 候选方向：个人博客、作品集、Markdown 转海报工具、API 文档站
- 情绪价值：**能用**——做出一个你能发给朋友的链接

### 3. 商业交易类应用（商业价值，能赚钱）

- 搜索关键词：`SaaS MVP template TypeScript`、`Stripe integration Next.js`、`micro SaaS ideas 2025`、`profitable side project ideas`
- 标准：含支付/交易环节、有清晰的商业模式（哪怕很小）、能真的上线收钱
- 候选方向：付费工具站、预约/订购系统、数字产品售卖、会员制内容站
- 情绪价值：**赚钱**——最高级的情绪价值。哪怕一个月只赚一杯咖啡钱

### 4. 学习类项目（学完能改，教自家小孩）

- 搜索关键词：`educational app for kids TypeScript`、`flashcard app tutorial`、`interactive learning game web`
- 标准：教育逻辑清晰、可个性化（换题库/换语言）、家长愿意给孩子用
- 候选方向：识字卡片、数学闯关、互动故事生成器、地理 quiz
- 情绪价值：**能用在自己生活里**——不是玩具，是给孩子的工具

---

## 每个候选必须产出的信息

对每个通过初筛的项目选题，按以下结构产出：

```
### 项目名称（一句话）

- 技术栈：{TypeScript/Rust + 框架/库}
- 预估复杂度：简单（1 session）/ 中等（2-3 session）/ 复杂（5+ session）
- 核心功能：3-5 条 bullet
- CC 功能映射：这个项目自然用到 CC 的哪些功能（Hooks/Memory/MCP/Skills/Sub-agents）
- 情绪锚点：做完后读者会有什么感觉（"我能给我的朋友发个链接了"/"我赚到第一块钱了"）
- 可扩展性：完成后能怎么继续改（加功能/换主题/接新 API）
- 风险：这个项目最大的坑是什么
```

---

## 工作流程

1. **探索阶段**（2-3 个并行搜索）：4 类项目各搜 1-2 轮，收集候选池（每类 3-5 个）
2. **筛选阶段**：按"AI 友好度 + 情绪价值 + CC 功能覆盖度"三轮筛选，每类保 2-3 个
3. **产出阶段**：按上述结构写 card（速览），合并到 `apps/docs/content/docs/research/tutorial-projects.mdx`
4. **更新 registry**：在 `registry.json` 中新增条目

---

## 硬约束

- 语言只限 TypeScript / Rust（Python 勉强可接受，但不优先）
- 每个项目必须能在一个 CC session（1-2 小时）内从零跑到可展示状态
- 拒绝纯玩具项目——必须有真实使用场景
- Card 阶段足够（不需要 Brief/Deep-Dive），但每个候选的信息必须完整
