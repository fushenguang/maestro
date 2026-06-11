# SESSION HANDOFF — Claude Code 调研流水线

> 本次 session：2026-06-11（全天，3 批 5+5+6 = 16 源跑通；累计 **20 源 Gate 1**）
> 上次 session：2026-06-10 → 2026-06-11 早晨（已合并到本文件）
> 下一 session 启动建议：先读本文件 + `LEARNINGS.md` Section 12，**第一件事合并 Problem 26-30 到 SKILL.md v0.4** 再跑批 4

---

## 0. TL;DR（本次 session 完成）

- **跑通 16 个新源**：批 1（Anthropic 官方核心 5）+ 批 2（Anthropic 官方剩 5）+ 批 3（MCP 生态 + 同类工具 6）。**累计 20 源 Gate 1**
- **Skill 合并 Problem 17-25 完成（v0.2 → v0.3）**：SKILL.md 加 geo-block fallback / 大仓库 git fallback / Python 抽取保段落 / 字符按 8 种 subtype 分档 / schema 校验脚本 / 硬约束 #10/#11；3 prompts 加 sample JSON + enum 硬码 + 锚点规范
- **subtype 覆盖 6 种**：methodology / blog / tutorial / skill_collection / docs / cookbook
- **5 新 Problem 26-30 暴露 + 待合并**（subagent 沙箱网络断 / cursor SPA / source URL 失效 / Token Plan 限额 / subagent 违规写盘）—— 下 session 第一件事合并到 v0.4

---

## 1. 当前累计状态

### 1.1 文档站点（apps/docs）

| 路由 | tier | 状态 |
|---|---|---|
| `/docs/research` | landing | 200 |
| 4 pre-batch 源（superpowers / claude-skills-blog / ai-coding-guide-zh / alirezarezvani-claude-skills）| card+deep-dive 混合 | 200 |
| 5 anth 批 1 源（claude-code-overview / agent-skills / sub-agents / hooks / effective-agents）| card | 200 |
| 5 anth 批 2 源（mcp / slash-commands / memory / agent-sdk / cookbook）| card | 200 |
| 6 批 3 源（mcp-servers / openai-codex / gemini-cli / qodo-merge / cursor-changelog / aider）| card | 200（落盘后）|

dev server 仍应在跑；不在就 `cd apps/docs && pnpm dev`。

### 1.2 累计 20 源全景

| 源 | type / subtype | tier | 主要价值 |
|---|---|---|---|
| 1. superpowers | repo / methodology | deep-dive | 工程方法论 14 skill 体系 |
| 2. claude-skills-blog | article / blog | card | Anthropic 一手设计哲学 |
| 3. ai-coding-guide-zh | repo / tutorial | deep-dive | **锚点源**：10 维框架 + 沿用 vs 错位决策表 |
| 4. alirezarezvani-claude-skills | repo / skill_collection | card | **框架 discriminate 验证样本** |
| 5. anth-claude-code-overview | article / docs | card | Claude Code 全景地图 |
| 6. anth-agent-skills | article / docs | card | Skills 官方定义；frontmatter 事实标准 |
| 7. anth-sub-agents | article / docs | card | sub-agents 机制官方权威 |
| 8. anth-hooks | article / docs | card | hooks 机制官方权威 + 安全基线 |
| 9. anth-effective-agents | article / blog | card | 多智能体设计哲学奠基 + ACI 原则 |
| 10. anth-mcp | article / docs | card | MCP 4 transport / 3 scope / Tool Search |
| 11. anth-slash-commands | article / docs | card | Custom commands 已并入 Skills |
| 12. anth-memory | article / docs | card | CLAUDE.md 4 级加载 + auto memory |
| 13. anth-agent-sdk | article / docs | card | Agent SDK 三路径取舍 + 2026-06-15 credit |
| 14. anth-cookbook | repo / cookbook | card | 87 ipynb code-recipe |
| 15. mcp-servers | repo / skill_collection | card | MCP 官方 7 reference servers + 13 archived |
| 16. openai-codex | repo / methodology | card | OpenAI Rust workspace；sandbox × approval 双轴 |
| 17. gemini-cli | repo / methodology | card | Google TS + Ink + 7 包；Gemini 3 + 1M + a2a-server |
| 18. qodo-merge (PR-Agent) | repo / methodology | card | vertical PR agent；与 generalist 对照 |
| 19. cursor-changelog | article / blog | card | Cursor 2026-06 动态；IDE-native vs CC terminal |
| 20. aider | repo / methodology | card | OSS pair programmer；最直接 CC 同类 |

### 1.3 Skill 状态

- `.claude/skills/research-source/SKILL.md` — **v0.3**（Problem 17-25 已合并；含 8 种 subtype 字符基线 + schema 校验脚本 + 硬约束 #10/#11）
- `prompts/{card,brief,deep-dive}.md` — **v0.3**（硬码 enum + 完整 sample JSON + 锚点规范 + cookbook 框架适配）
- 缓存目录：`.research-cache/raw-fetches/{batch1,batch2,batch3}/` + `_json/` 子目录（批 3 JSON 临存）

### 1.4 配置改动（保持）

- `~/.claude/settings.json` 52 条 `permissions.allow`（main Claude 生效；**subagent 沙箱不继承**——批 3 新发现的 Problem 26）

---

## 2. 下一 session 决策点

### 2.1 推荐路径 A：先合并 Problem 26-30 到 v0.4，再跑批 4

**步骤**（按顺序）：

1. **合并 SKILL.md + 3 prompts**（30-40 min，比批 3 前合并轻——只 5 个 Problem）：
   - SKILL.md Step 1：加「主 Claude pre-seed → subagent 读 cache」两层流程（Problem 26）
   - SKILL.md Step 1：加 SPA 检测 + 替代源策略 + 已知 SPA 域名维护列表（Problem 27）
   - SKILL.md frontmatter schema：加 `original_url` + `redirect_reason` 字段；Step 4 加校验（Problem 28）
   - SKILL.md Step 3：subagent 并发数按 Token Plan 余量调；429 重派机制（Problem 29）
   - subagent prompt 模板：加「**禁止使用 Write / Edit / NotebookEdit 工具**」工具级禁令（Problem 30）；主 Claude 收尾必跑 ls 检测违规写盘
   - SKILL.md 硬约束 #12：「subagent 沙箱无网，主 Claude 必先 pre-seed」

2. **批 4：学术 12 篇 H1-H12**（独立子流程，需先建 PDF 抽取脚本，~60-90 min）：
   - 先用 1-2 篇 PDF 验证 PDFMiner / pdfplumber 抽取效果
   - 然后并发跑 12 篇

3. **批 5：其他类别**（剩余 ~10-25 源；methodology / tutorial / skill collection / essay 散源）

### 2.2 累计目标进度

- 已完成：**20 源**（4 既有 + 16 本 session 新跑）
- 上 session 锁定目标：32-45 源
- **剩余**：12-25 源
- 预计还需 2-4 批 × ~30-60 min = 1-3 session 完成

---

## 3. 启动前 Checklist（下 session）

- [ ] 读本文件
- [ ] 读 `LEARNINGS.md` Section 12（批 3 + Problem 26-30 沉淀）
- [ ] 看 `registry.json` 当前状态（20 源 + v0.1.5 + skill_version 0.3 + 6 subtype）
- [ ] 看 `.claude/skills/research-source/SKILL.md` 当前 v0.3（**注意**：本 session 已合并 P17-25；P26-30 待合并到 v0.4）
- [ ] 看 `.research-cache/raw-fetches/batch{1,2,3}/` 持久缓存（已就位；批 3 多了 `_json/` 子目录可清理）
- [ ] 确认 dev server 是否还在跑；不在就 `cd apps/docs && pnpm dev`
- [ ] **先合并 SKILL.md + 3 prompts（Problem 26-30 → v0.4）再跑批 4**

---

## 4. 关键决策记录（本 session 追加）

| 决策 | 选择 | 理由 |
|---|---|---|
| 批 3 size | 5 → 6（cursor docs + aider 都跑） | 同类工具横向覆盖更全；接受总耗时 +20% |
| Cursor 替代源 | docs.cursor.com SPA → cursor.com/changelog 静态 | 静态可 curl；blog 体裁但覆盖最新功能（Bugbot/Composer 2.5/...） |
| subagent 拉源失败的应急 | 主 Claude pre-seed cache + subagent 走 cache-first 重派 | 验证主 Claude 网络可用、subagent 沙箱网络断；以后所有批默认主 Claude 先拉 |
| qodo URL 404 处理 | subagent 自主迁移到新 URL + 主 Claude 加 original_url/redirect_reason 字段 | 「源已搬家」是常见，schema 必须支持 |
| 收尾规范化 | 用 Python 脚本批量修 audience enum + unescape HTML + 实测 char_count + 落 mdx/json | 验证 subagent prompt 改进部分有效但形态级失败——必须主 Claude 外层 assertion |
| 合并节奏 | 每批 3-5 Problem 就合并 v0.x | 替换原「每批 5-10 个累积」节奏；P17-25 累 9 个合并太大风险——本次合并花 40 min 比预期 60 min 短 |

---

## 5. 已知坑（累计，按 Problem # 编号）

1-16 见 LEARNINGS Section 1-9
17-25 已合并到 SKILL.md v0.3 + prompts v0.3 ✓
26-30（**待合并到 v0.4**）：

26. **subagent 沙箱网络断**（git/curl/WebFetch 全拒）→ 主 Claude pre-seed cache + subagent 走 cache-first
27. **cursor.com/docs SPA**（5 URL 返回同 md5 shell）→ cursor.com/changelog 静态替代
28. **source URL 失效**（qodo-ai/qodo-merge → The-PR-Agent/pr-agent）→ schema 加 original_url + redirect_reason
29. **Token Plan 周期限额**（gemini/cursor v1 失败）→ 并发数按余量调；429 重派机制
30. **subagent 违反「不要写盘」prompt 约定**（gemini-cli v2 自行 write mdx/json）→ 工具级禁令 + 主 Claude 收尾 ls 检测

**最优先合并**：26（pre-seed 流程）/ 30（工具级禁令）—— 这 2 个影响每批稳定性。

---

## 6. 性能数据（本 session 实测）

| 批 | subagent 并发数 | 最慢 subagent | 主 Claude 收尾 | 总耗时 |
|---|---|---|---|---|
| 批 1 | 5 | hooks 17.5 min | ~10 min | ~30 min |
| 批 2 | 5 | cookbook 25 min（HTTP/2 三次 retry）| ~15 min | ~40 min |
| 批 3 | 6（含 3 重派）| codex 12 min；总 16 次 subagent 调用 | Python 规范化 + 落盘 + 同步元数据 ~20 min | ~70 min（含中断）|

**经验值**：
- subagent 单批 5-6 并发 ≈ 30-70 min（取决于源 size + 重派次数）
- 主 Claude context +8-15% / 批
- Token Plan 周期上限会触发——5+ 并发 + 长 context 时风险高

---

## 7. SESSION_HANDOFF 更新结束

下 session 开始时，按 Checklist Section 3 执行；先合并 Problem 26-30 到 SKILL.md v0.4 + prompts/*.md 再跑批 4（学术 12 篇 PDF）。
