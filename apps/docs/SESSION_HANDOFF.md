# SESSION HANDOFF — Claude Code 调研流水线

> 本次 session：2026-06-11（全天 + 晚）— 累计 **20 源 Gate 1** + 6 commits
> 关键进展：research-source skill v0.3 → **v0.4**（P26-30 合并）+ 新建 **pdf-extract skill v0.1 → v0.3**（P34-P38 修复）
> 下一 session 启动建议：先读本文件 + `LEARNINGS.md` Section 12-15，**第一件事跑批 5**（同类工具补完 / tutorial 增 1-2）

---

## 0. TL;DR（本次 session 完成）

### 0.1 跑通 16 个新源
- 批 1（Anthropic 官方核心 5）：claude-code-overview / agent-skills / sub-agents / hooks / effective-agents
- 批 2（Anthropic 官方剩 5）：mcp / slash-commands / memory / agent-sdk / cookbook
- 批 3（MCP 生态 + 同类工具 6）：mcp-servers / openai-codex / gemini-cli / qodo-merge / cursor-changelog / aider
- **累计 20 源 Gate 1**（4 既有 + 16 本 session 新跑）

### 0.2 Skill 合并 Problem 26-30 完成（v0.3 → **v0.4**）
- SKILL.md +142 行：Step 1.1 两层拉取（主 Claude pre-seed → subagent 走 cache-first）/ 1.2 SPA 检测 / 1.3 URL 三义（url vs mirror_url vs original_url+redirect_reason）/ Step 3.1 429 重派 / 4.1.1 写盘违规检测 / 硬约束 #12 网络+工具双层禁令
- 3 prompts 各 +50 行：顶部「工具级禁令 + 禁网前置」段 / 输入段 `cache_dir` 字段 / 规则汇总「工具与网络」+「source URL 失效」段

### 0.3 新建 pdf-extract skill（**Standalone skill** 决策，4 commits）
- **v0.1**（abf2cce）：4 模式（auto/simple/layout/ocr）+ auto fallback + 大文件分块 + 扫描版自动检测。simple 模式生产可用，layout/auto 标 beta
- **v0.2**（5b1e77d）：修 P34-P37。layout_parser 改「行 x 坐标众数法」+ 多 gap；image_bboxes 过滤图区域；quality_check 加 column_coverage + chart_text_ratio 2 维；auto 阈值 0.6 → 0.75；x_tolerance CLI 参数
- **v0.3**（c4c1471）：修 P38。layout 模式自动过滤 `upright=False` 旋转 word（arXiv 边栏竖排标签）；CJK 文档化（默认 x_tolerance=1 对 CJK 友好）

### 0.4 批 4 暂缓（用户决策）
- 学术 12 篇 PDF H1-H12 暂未跑：**用户没 H1-H12 清单** + 担心资料库太大
- pdf-extract skill 已建好等清单；批 4 留待用户提供源后再启动

### 0.5 6 commits 推送
```
c4c1471 feat(skill): pdf-extract v0.3 — 修 P38 (旋转 90° 文本过滤) + CJK 文档化
5b1e77d feat(skill): pdf-extract v0.2 — 修 P34-P37 (双栏 / 图表过滤 / quality 5 维 / x_tolerance CLI)
abf2cce feat(skill): pdf-extract v0.1 — Standalone PDF 抽取 skill
6ff8648 docs(research): LEARNINGS Section 12 (批 3 跑通) + Section 13 (pdf-extract v0.1)
b6aab29 feat(research): skill v0.4 (合并 Problem 26-30)
```
累计：6 commits / +1873 行 / 0 冲突

---

## 1. 当前累计状态

### 1.1 文档站点（apps/docs）

| 路由 | tier | 状态 |
|---|---|---|
| `/docs/research` | landing | 200 |
| 4 pre-batch 源（superpowers / claude-skills-blog / ai-coding-guide-zh / alirezarezvani-claude-skills）| card+deep-dive 混合 | 200 |
| 5 anth 批 1 源 | card | 200 |
| 5 anth 批 2 源 | card | 200 |
| 6 批 3 源 | card | 200 |

dev server 仍应在跑；不在就 `cd apps/docs && pnpm dev`。

### 1.2 累计 20 源全景

| # | 源 | type / subtype | tier | 主要价值 |
|---|---|---|---|---|
| 1 | superpowers | repo / methodology | deep-dive | 工程方法论 14 skill 体系 |
| 2 | claude-skills-blog | article / blog | card | Anthropic 一手设计哲学 |
| 3 | ai-coding-guide-zh | repo / tutorial | deep-dive | **锚点源**：10 维框架 + 沿用 vs 错位决策表 |
| 4 | alirezarezvani-claude-skills | repo / skill_collection | card | **框架 discriminate 验证样本** |
| 5-9 | anth-claude-code-overview / agent-skills / sub-agents / hooks / effective-agents | article / docs+blog | card | 9 个 anth 核心源（5 批 1）|
| 10-14 | anth-mcp / slash-commands / memory / agent-sdk / cookbook | article / docs+repo/cookbook | card | 5 批 2 源 |
| 15-20 | mcp-servers / openai-codex / gemini-cli / qodo-merge / cursor-changelog / aider | repo+article / 4 种 | card | 6 批 3 同类工具源 |

**subtype 分布（6 种全覆盖）**：
- docs: 8 / methodology: 5 / blog: 3 / skill_collection: 2 / tutorial: 1 / cookbook: 1

### 1.3 Skill 状态

- `.claude/skills/research-source/SKILL.md` — **v0.4**（P17-25 + P26-30 都已合并；含两层拉取 + SPA 检测 + URL 三义 + 429 重派 + 硬约束 #8-#12）
- `prompts/{card,brief,deep-dive}.md` — **v0.4**（硬码 enum + sample JSON + 锚点规范 + 工具级禁令 + cache_dir 字段）
- `.claude/skills/pdf-extract/SKILL.md` — **v0.3**（Standalone skill 决策；4 模式 + auto fallback + P34-P38 修好；CJK 文档化）
- `.claude/skills/pdf-extract/scripts/{extract,layout_parser,quality_check}.py` — v0.3 实现
- 缓存目录：`.research-cache/raw-fetches/{batch1,batch2,batch3}/`

### 1.4 配置改动（保持）

- `~/.claude/settings.json` 52 条 `permissions.allow`（main Claude 生效；subagent 沙箱不继承——P26 已沉淀）

---

## 2. 下一 session 决策点

### 2.1 累计目标进度

- 已完成：**20 源**（4 既有 + 16 本 session 新跑）
- 上 session 锁定目标：32-45 源
- **剩余**：12-25 源
- 预计还需 2-3 批 × ~30-60 min = 1-2 session 完成

### 2.2 推荐路径（**下 session 第一件事：跑批 5**）

**步骤**（按顺序）：

1. **批 5：同类工具（methodology）补完 + tutorial 增 1-2**（60-90 min）：
   - 候选：Cline（VSCode Claude Code 扩展）/ Continue / Swe-agent / OpenHands / Roo Code
   - 与现有 5 个 methodology 源（superpowers / codex / gemini-cli / qodo-merge / aider）形成更全的同类工具矩阵
   - 替代原学术 PDF 批 4（暂缓）

2. **批 5 备选**：tutorial 类增 1-2（如 aider-docs / oh-my-claudecode / claude-code-ultimate 等）+ skill_collection 类（如 awesome-claude-code / awesome-claude-skills）

3. **批 6+：根据批 5 暴露问题决定**

### 2.3 批 4 启动条件

- 学术 PDF H1-H12 清单（用户给 URL / 路径 / DOI / 主题）
- 当前 pdf-extract v0.3 已就绪：simple 模式 production / layout + auto 模式 production（双栏 + 图表过滤 + 旋转 word 过滤都修好）
- pdf-extract 与 research-source 集成路径：PDF → pdf-extract → cache → subagent 走 cache-first（沿用 v0.4 硬约束 #12）

### 2.4 跑批 5 配套优化（可选）

- 如批 5 涉及 GitHub repo，subagent 用 v0.4 cache-first 流程（主 Claude pre-seed → subagent 读 cache）
- 工具级禁令 + ls 检测违规写盘（v0.4 硬约束 #12）
- 429 重派机制（v0.4 Step 3.1）
- 如跑 GitHub 大仓库，用 `git -c http.version=HTTP/1.1 -c http.postBuffer=524288000` fallback

---

## 3. 启动前 Checklist（下 session）

- [ ] 读本文件（已反映本 session 末态）
- [ ] 读 `LEARNINGS.md` Section 12-15（批 3 + pdf-extract v0.1/v0.2/v0.3 全部沉淀）
- [ ] 看 `registry.json` 当前状态（20 源 + 6 subtype + skill_version 0.4）
- [ ] 看 `.claude/skills/research-source/SKILL.md` 当前 **v0.4**（P26-30 已合并）
- [ ] 看 `.claude/skills/pdf-extract/SKILL.md` 当前 **v0.3**（P34-P38 已修）
- [ ] 看 `.research-cache/raw-fetches/batch{1,2,3}/` 持久缓存
- [ ] 确认 dev server 是否还在跑；不在就 `cd apps/docs && pnpm dev`
- [ ] **第一件事：跑批 5**（同类工具补完 / tutorial 增 1-2）

---

## 4. 关键决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 批 3 size | 5 → 6（cursor docs + aider 都跑）| 同类工具横向覆盖更全；接受总耗时 +20% |
| Cursor 替代源 | docs.cursor.com SPA → cursor.com/changelog 静态 | 静态可 curl；blog 体裁但覆盖最新功能（Bugbot/Composer 2.5/...）|
| subagent 拉源失败的应急 | 主 Claude pre-seed cache + subagent 走 cache-first 重派 | 验证主 Claude 网络可用、subagent 沙箱网络断；以后所有批默认主 Claude 先拉 |
| qodo URL 404 处理 | subagent 自主迁移到新 URL + 主 Claude 加 original_url/redirect_reason 字段 | 「源已搬家」是常见，schema 必须支持 |
| 收尾规范化 | 用 Python 脚本批量修 audience enum + unescape HTML + 实测 char_count + 落 mdx/json | 验证 subagent prompt 改进部分有效但形态级失败——必须主 Claude 外层 assertion |
| 合并节奏 | 每批 3-5 Problem 就合并 v0.x | 替换原「每批 5-10 个累积」节奏；P17-25 累 9 个合并太大风险——本次合并花 40 min 比预期 60 min 短 |
| pdf-extract skill 边界 | **Standalone skill**（独立 `.claude/skills/pdf-extract/`，research-source 可调用）| 用户决定：通用 / 可复用 / 与 research-source 解耦 |
| pdf-extract 选型 | **B. 新 skill**（pdfplumber + pypdfium2 + pytesseract，已装）| Anthropic 官方 PDF skill 是通用不做研究抽取；ML 工具（nougat/marker）2GB+ 模型过重 |
| pdf-extract 合并节奏 | **每版本修 P 暴露即合并**（v0.1/v0.2/v0.3 各 commit）| 替代"累积多版本一起合并"；快速反馈 |
| 批 4 启动 | **暂缓**（用户没 H1-H12 清单）| 跳到批 5（同类工具 / tutorial 散源） |

---

## 5. 已知坑（累计，按 Problem # 编号）

1-16 见 LEARNINGS Section 1-9
17-25 已合并到 SKILL.md v0.3 + prompts v0.3 ✓
**26-30 已合并到 SKILL.md v0.4 + prompts v0.4** ✓（v0.4 完成）
**31-38（pdf-extract v0.1/v0.2/v0.3 沉淀）已合并** ✓（v0.3 完成）

### 5.1 pdf-extract v0.1 暴露（已修）
- P31 库选择：仅用 pdfplumber (MIT) + pypdfium2 (Apache) + pytesseract (Apache)，禁用 pymupdf (AGPL) / nougat / marker
- P32 大 PDF 分块：> 80KB 自动按页拆 + 子文件命名 + 索引页
- P33 扫描 PDF 显式 opt-in：OCR 必须 `--mode ocr` 显式

### 5.2 pdf-extract v0.2 暴露（已修）
- P34 layout 模式双栏检测不准确 → 「行 x 坐标众数法」+ 多 gap 支持
- P35 layout 模式图表坐标轴误识别 → 接收 image_bboxes 过滤
- P36 quality_check 自评不可靠 → 加 column_coverage + chart_text_ratio 2 维；auto 阈值 0.6 → 0.75
- P37 x_tolerance 反直觉 → CLI 参数 + 文档化「pdfplumber 反直觉行为」段

### 5.3 pdf-extract v0.3 暴露（已修）
- P38 旋转 90° 文本未识别 → `filter_rotated_words()`（upright=False + 启发式宽<5 高>30 双检测）

### 5.4 待办（v0.4+ 候选）
- paddleocr / easyocr 集成（CJK 未嵌入字体兜底）
- nougat-ocr 公式识别（学术论文公式 → LaTeX）
- marker-pdf 加速（GPU 加速时 0.5s/页）
- References 段自动切 simple 模式（学术论文 References 单栏）
- CJK PDF 样本实测

---

## 6. 性能数据

| 批 | subagent 并发数 | 最慢 subagent | 主 Claude 收尾 | 总耗时 |
|---|---|---|---|---|
| 批 1 | 5 | hooks 17.5 min | ~10 min | ~30 min |
| 批 2 | 5 | cookbook 25 min（HTTP/2 三次 retry）| ~15 min | ~40 min |
| 批 3 | 6（含 3 重派）| codex 12 min；总 16 次 subagent 调用 | Python 规范化 + 落盘 + 同步元数据 ~20 min | ~70 min（含中断）|
| pdf-extract v0.1 | — | constitutional-ai-paper.pdf 34 页 simple ~5s | 端到端验证 ~5 min | ~10 min |
| pdf-extract v0.2 | — | 修 layout / quality / x_tolerance | 端到端验证 ~3 min | ~15 min |
| pdf-extract v0.3 | — | 修旋转 word + CJK 文档 | 端到端验证 ~3 min | ~10 min |

**经验值**：
- subagent 单批 5-6 并发 ≈ 30-70 min（取决于源 size + 重派次数）
- 主 Claude context +8-15% / 批
- Token Plan 周期上限会触发——5+ 并发 + 长 context 时风险高
- pdf-extract 单 PDF（30-60 页）抽取 ~5-15s
- pdf-extract 端到端验证 + skill 改进 ~10-15 min/版本

---

## 7. SESSION_HANDOFF 更新结束

下 session 开始时，按 Checklist Section 3 执行；**第一件事跑批 5**（同类工具补完 / tutorial 增 1-2）。批 4 启动条件：用户提供 H1-H12 清单。
