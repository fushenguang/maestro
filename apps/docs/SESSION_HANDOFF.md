# SESSION HANDOFF — Claude Code 调研流水线

> 上一 session：2026-06-10 → 2026-06-11
> 当前 session 决定结束原因：context 偏重（约 50+ 工具调用、3 个完整文件建立、4 节设计 + LEARNINGS 沉淀）
> 下一 session 启动建议：先读本文件 + `LEARNINGS.md`，再决定从哪里继续

---

## 0. TL;DR（一句话总结）

- **已搭起骨架**：1 个 Claude Code Skill（`research-source`）+ 1 个 docs 站目录结构 + 1 个源注册表
- **已验证全流程**：1 源（superpowers）跑通 Card + Brief + Deep-Dive 三层
- **已暴露 + 沉淀 9 条元规则**：写在 `LEARNINGS.md`，已回填到 Skill SKILL.md 的「硬约束」段
- **下一 session 任务**：跑 2-3 源做验证 + 迭代 Skill，直到能标准化、自动化

---

## 1. 当前状态

### 1.1 文档站点（apps/docs）

| 路由 | 内容 | 状态 |
|---|---|---|
| `/docs/research` | 研究参考 landing | 200，h1=Research |
| `/docs/research/superpowers` | superpowers 全 3 层（200 行 .mdx） | 200 |
| `/docs/research/claude-skills-blog` | claude-skills-blog 仅 Card | 200 |

dev server 在 `bckc0vu2k` 进程跑着，端口 3000。

### 1.2 已建立的产物

```
.claude/skills/research-source/
├── SKILL.md                          # 已带 9 条硬约束
└── prompts/
    ├── card.md                       # Card prompt
    ├── brief.md                      # Brief prompt (本 session 新增)
    └── deep-dive.md                  # Deep-Dive prompt (本 session 新增)

apps/docs/
├── LEARNINGS.md                      # 1 源全流程踩坑记录
├── SESSION_HANDOFF.md                # 本文件
└── content/docs/research/
    ├── index.mdx                     # landing
    ├── meta.json                     # sidebar 配置
    ├── registry.json                 # 源注册表
    ├── superpowers.mdx               # Card + Brief + Deep-Dive
    ├── superpowers.json              # sources 数据
    ├── claude-skills-blog.mdx        # 仅 Card
    └── claude-skills-blog.json       # sources 数据
```

### 1.3 Skill 状态

- Skill 名：`research-source`
- 3 个 prompt 模板齐全
- 9 条硬约束已回填
- 闸门 review 机制已说明
- 路径参数化（`registry.json` 应加 `output_dir` 字段，**下一 session 第一步可加**）

### 1.4 未做的事（本 session 没空做）

- ❌ 跑第 3 个源（验证 tutorial 路径 / 大型 repo 路径）
- ❌ 更新 `registry.json` 加 `output_dir` 字段
- ❌ 写 `scripts/research-batch.sh`（批量编排）
- ❌ 写脚本从 `registry.json` 自动生成 `index.mdx` 表格
- ❌ 教程大纲的实际生成（明确出下次 change 范围）

---

## 2. 下一 session 推荐的 5 步走

按「小步快跑 + 沉淀学习 + 标准化自动化」路径：

### Step 1：读本文件 + LEARNINGS.md（必须）

不要跳过。先把现状吃透再动手。

### Step 2：跑 2-3 源做验证

**推荐 3 选 1**（按 source_type 覆盖度）：

| 选项 | 源 | 测什么 | 备注 |
|---|---|---|---|
| **A** | `AI-Coding-Guide-Zh`（repo, 中文课程） | tutorial 型 repo；中文材料处理 | 团队中文场景 |
| B | `baoyu-skills`（repo, 100+ skills） | 超大 repo（验 200KB 截断） | 压力测试 |
| C | `claude-code-best-practice`（repo, 实践集） | 普通 repo 对比 superpowers | 同类型对比 |

**我推荐 A**——理由：覆盖第三种 source_type（tutorial）+ 中文材料 + 内容形态与 superpowers 差异最大，**最容易暴露 Skill 的盲点**。

### Step 3：跑完 1-2 源后回头修 Skill

跑完 1 源就更新一次 LEARNINGS.md（追加「第 N 源暴露的新问题」），跑完 2 源后**回头改 Skill SKILL.md / prompts/{tier}.md** 把新规则沉淀。

### Step 4：决定何时做「标准化」

当 3 源跑完 + 流程稳定后：
- 写 `scripts/research-batch.sh` 自动化
- 写脚本从 `registry.json` 生成 `index.mdx` 表格
- 写 schema 校验脚本（`scripts/validate-frontmatter.ts`）
- 把 Skill 提示词固化到 CI（lint）

### Step 5：决定何时进入教程大纲生成

完成 Step 4 之后，**开新 OpenSpec change** 写「教程大纲生成」——不在本 change 范围。

---

## 3. 关键决策记录（避免重做）

| 决策 | 选择 | 理由 |
|---|---|---|
| 目录命名 | ASCII slug | 解决 Fumadocs 中文 slug bug |
| 侧边栏标题 | meta.json 控制，中文 | 满足「URL 英文、标题中文」 |
| 文件结构 | 1 源 = 1 .mdx（3 段）+ 1 .json | 2 层路由，扁平 |
| 三层组织 | 同一 .mdx 文件 3 段 | 路由限制 + 字数可控 |
| 跑源节奏 | 1 源全流程 → 沉淀 → 2-3 源验证 | 小步快跑、暴露问题 |
| Skill 路径 | 参数化（registry.json 读） | 跨项目可移植 |
| 闸门 review | registry.json 标 promote_to_* | 机器可读、可追溯 |

---

## 4. 已知坑（必看）

1. **Fumadocs 中文 slug bug** → 路径用 ASCII（已在 LEARNINGS #1）
2. **WebFetch 拦 claude.com** → curl + Python fallback（已在 SKILL.md Step 1）
3. **MDX 不支持 `{#id}`** → 用 plain heading（已在 SKILL.md 硬约束 #3）
4. **`{#id}` 会让页面 500** → 写完 MDX 必须看 dev log
5. **`.md` 文件不能放 `content/docs/`** → 非页面文档放 `apps/docs/` 根
6. **registry.json 与 index.mdx 双重维护** → 短期靠人，Step 4 脚本化
7. **LLM 输出的 takeaway 真实性** → Step 5 必 cross-check

---

## 5. 启动前 Checklist（新 session）

- [ ] 读本文件
- [ ] 读 `LEARNINGS.md`
- [ ] 读 `.claude/skills/research-source/SKILL.md`（重点「硬约束」段）
- [ ] 看 `apps/docs/content/docs/research/registry.json` 当前状态
- [ ] 确认 dev server 是否还在跑（`bckc0vu2k`）；不在就 `cd apps/docs && pnpm dev`
- [ ] 决定跑哪个源（推荐 A：`AI-Coding-Guide-Zh`）
- [ ] **更新 `registry.json` 加 `output_dir` 字段**（meta-rule #5 的具体实施）
