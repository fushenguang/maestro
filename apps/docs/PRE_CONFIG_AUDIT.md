# 配置前自审计 — Claude Code 当前环境与使用情况

> **Snapshot taken**: 2026-06-11 (session `d47aec5a-aa96-49c3-b3ef-9cd582ea5bfd`)
> **目的**: 在团队按自编教程优化 Claude Code 配置**之前**的真实基线。配置完成后做「配置后审计」做对比，验证教程价值。
> **原则**: 实事求是，实践出真知。

---

## 0. TL;DR

| 维度 | 当前状态 | 评分 |
|---|---|---|
| Claude Code 版本 | 2.1.176 | 最新 |
| 默认模型 | **MiniMax-M3**（非 Claude，走 `api.minimaxi.com/anthropic` 反代） | ⚠️ 偏离 CLAUDE.md「Claude LLM 负责规划」的设定 |
| 已装插件 | 2 个（superpowers、mcp-server-dev，**都是项目级**，非全局） | ⚠️ 项目级，非用户级 |
| 仓库内 Skill | 1 个（我们新建的 `research-source`） | 极少 |
| 全局 Skill | 0 个 | 缺口 |
| MCP server | 0 个（brave-search / claude-code-docs / context7 都**装了但未启用**） | ⚠️ 大缺口 |
| Git worktree | **未使用**（直接在 main 上） | ❌ 反模式 |
| Subagent | **未使用**（每次都主 agent 亲自调工具） | ❌ 反模式 |
| 自动化脚本 | 0 个 | 缺口 |
| 一次跑通全流程的源 | 1 个（superpowers） | 起步阶段 |
| Token 优化 | 几乎没有（每次都重新读文件、重复 prompt） | 差 |
| 代码质量自评 | 6 个真实 bug，1 个错误模式（`{#id}`），0 单元测试 | 中等 |

**一句话**：环境**几乎裸跑**——只有 superpowers 插件提供 brainstorming/writing-plans 等流程支持，其他生态工具都没用上。**正好**作为「配置前」基线，对比价值高。

---

## 1. 环境快照

### 1.1 硬件 / 操作系统

| 项 | 值 |
|---|---|
| 平台 | darwin（macOS） |
| OS | Darwin 25.5.0（macOS 16 / Tahoe） |
| 架构 | arm64（Apple Silicon，由 `which gh` 路径 `/opt/homebrew/` 推断） |
| Shell | zsh |
| 包管理 | pnpm 9.x（`/Users/sunny/Library/pnpm/bin`） |

### 1.2 Claude Code 安装

| 项 | 值 |
|---|---|
| 版本 | **2.1.176**（`/opt/homebrew/Caskroom/claude-code@latest/2.1.176/claude`） |
| 安装方式 | Homebrew Cask |
| 配置目录 | `/Users/sunny/.claude/`（13MB） |
| 项目配置目录 | `/Users/sunny/Desktop/Workspace/CogitoTech/maestro/.claude/` |
| Session ID | `d47aec5a-aa96-49c3-b3ef-9cd582ea5bfd` |

### 1.3 模型（**关键偏离**）

```
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_MODEL=MiniMax-M3
ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M2.7
ANTHROPIC_DEFAULT_SONNET_MODEL=MiniMax-M3[1M]
ANTHROPIC_DEFAULT_OPUS_MODEL=MiniMax-M3
```

**问题**：CLAUDE.md 写「Claude Code + Claude LLM(负责规划) + Deepseek V4 PRO(负责执行)」，但当前实际是 **MiniMax-M3 一统天下**，Claude / DeepSeek 都没真用上。`ANTHROPIC_AUTH_TOKEN` 用的是 MiniMax 的 API key。

**这意味着**：
- 我们以为在用 Claude 规划、DeepSeek 执行 → 实际只有 MiniMax
- 「配置前 vs 配置后」对比时，先纠正模型（CLAUDE.md 的设想）还是保持 MiniMax？需要团队决策
- **重要影响**：本审计里 MiniMax-M3 的表现 ≠ Claude 4.6 的表现，对比时要注明

### 1.4 插件（Plugins）

```
installed_plugins.json:
- superpowers@claude-plugins-official     v5.1.0   (project scope, 2026-06-10 装)
- mcp-server-dev@claude-plugins-official  bd7cf41  (project scope, 2026-06-10 装)
```

**注意 scope**：两个插件都是 **project scope**（`projectPath: maestro`），不是 global（`user scope`）。换项目要重装。

**enabledPlugins**（`.claude/settings.json`）已启用两者。

### 1.5 Skills

| 来源 | 路径 | 数量 |
|---|---|---|
| 全局（用户级） | `/Users/sunny/.claude/skills/` | **不存在**（0 个） |
| superpowers 提供 | `/Users/sunny/.claude/plugins/cache/.../superpowers/5.1.0/skills/` | 14 个（brainstorming、writing-plans 等） |
| 我们新建（项目级） | `/Users/sunny/.../maestro/.claude/skills/research-source/` | 1 个 |

**缺口**：没有项目根的 `CLAUDE.md` 之外的 Skill 系统（superpowers 提供 bootstrap，我们自己写了 1 个 research-source）。

### 1.6 MCP Servers

```
# 期望的 MCP（基于 deferred tools list）:
- mcp__brave-search__brave_web_search / brave_local_search   ❌ 未启用
- mcp__claude-code-docs__query_docs_filesystem / search       ❌ 未启用
- mcp__context7__resolve-library-id / query-docs              ❌ 未启用
```

**真实情况**：所有 MCP server 都没在 `.mcp.json` 配过。本次 session **全程未调用任何 MCP 工具**。

**影响**：
- brave-search 没用上 → 找资料全靠 WebFetch + curl fallback
- claude-code-docs 没用上 → 找官方教程全靠 WebFetch（且 claude.com 被 WebFetch 拦）
- context7 没用上 → 查库文档全靠通用知识（可能过时）

**这是教程的**重头戏**之一**——配置后这些 MCP 应该都启用。

### 1.7 设置（settings）

`/Users/sunny/.claude/plugins/...` 是 plugin 缓存；`/Users/sunny/.claude/settings.json` 应该是全局配置，但**不存在**（`/Users/sunny/.claude` 下没有 settings.json）。

**项目设置** `.claude/settings.json`:
```json
{
  "enabledPlugins": {
    "mcp-server-dev@claude-plugins-official": true,
    "superpowers@claude-plugins-official": true
  }
}
```

**项目本地设置** `.claude/settings.local.json`（permission allowlist）:
```json
{
  "permissions": {
    "allow": [
      "Bash(gh repo *)",
      "Bash(mkdir -p /Users/sunny/Desktop/Workspace/CogitoTech/maestro/apps/docs/content/docs/资料参考/superpowers)",
      "Bash(mkdir -p /Users/sunny/Desktop/Workspace/CogitoTech/maestro/.claude/skills/research-source/prompts)",
      "Bash(pnpm dev *)",
      "Bash(curl *)",
      "Read(//tmp/**)",
      "Bash(grep -oE \"stack.{0,2000}NEXT_HTTP_ERROR_FALLBACK\" /tmp/page2.html)",
      "Bash(python3 -m json.tool)",
      "WebFetch(domain:claude.com)",
      "Bash(python3 -c ' *)",
      "Bash(claude --version)",
      "Read(//Users/sunny/.claude/**)"
    ]
  }
}
```

**注意**：这些 allow 规则是**为本次 session 累积生成的**——每次 `claude` 调用被 deny 后 user 点同意，就加一条。**说明 user 频繁被 permission 打断**（这是个 UX 痛点）。

### 1.8 环境变量（关键）

```
GITHUB_TOKEN=github_pat_***           # gh CLI 已认证
DEEPSEEK_API_KEY=sk-***                # 备用（未用上）
MINIMAX_API_KEY=sk-***                 # 实际在用
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_AUTH_TOKEN=sk-*** (MiniMax)
DOKPLOY_API_TOKEN=***                  # 部署相关（未用上）
AI_AGENT=claude-code_2-1-167_agent
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
CLAUDE_CODE_EFFORT_LEVEL=max
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
CLAUDE_CODE_ENTRYPOINT=cli
CLAUDE_EFFORT=max
```

**有趣**：
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` → 已关非必要流量
- `CLAUDE_CODE_EFFORT_LEVEL=max` + `CLAUDE_EFFORT=max` → 已开 max effort（高 token）
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` → **Agent Teams 已开，但本 session 没用**！

### 1.9 工具生态（PATH 暴露的其他 AI 工具）

```
/Users/sunny/.codebuddy/bin          # CodeBuddy
/Users/sunny/claude-model/bin        # 自定义 claude-model
/Users/sunny/.antigravity/antigravity/bin  # Antigravity
/Users/sunny/.codeium/windsurf/bin   # Windsurf
/Users/sunny/.cache/lm-studio/bin    # LM Studio
```

**有意思**：用户机器上**装了一堆 AI 工具**（CodeBuddy、Antigravity、Windsurf、LM Studio），但**主用 Claude Code**。说明用户**亲自比较过**这些工具的优劣。

---

## 2. 本 session 使用情况

### 2.1 时长 / 调用数（估算）

| 指标 | 值 | 备注 |
|---|---|---|
| Session 启动 | 2026-06-10 18:11（约） |  |
| 当前 | 2026-06-11 09:20+ | 跨日（>15 小时，但实际工时是断断续续的） |
| 工具调用 | ~60 次 | 估算，从工具返回 history |
| 主要工具 | Read / Write / Edit / Bash | 几乎不用 Glob / Grep / WebFetch（在 session 末段） |

### 2.2 任务清单（已完成）

| # | 任务 | 用时（估） | 工具数 |
|---|---|---|---|
| 1 | 探索项目上下文 | 5 min | ~8 |
| 2 | brainstorming skill 触发的需求澄清 | 15 min | ~7 |
| 3 | 设计 4 节 | 10 min | ~3 |
| 4 | MVFS：Card on superpowers | 20 min | ~12 |
| 5 | 调试 404 | 10 min | ~8 |
| 6 | 跑第 2 源（claude-skills-blog） | 15 min | ~6 |
| 7 | 重构路由 + 中文标题 | 10 min | ~6 |
| 8 | Brief + Deep-Dive for superpowers | 15 min | ~4 |
| 9 | 沉淀 LEARNINGS | 10 min | ~3 |
| 10 | 回填元规则到 Skill | 5 min | ~3 |

### 2.3 Cache 命中率

**诚实承认**：**没有数据**。Claude Code 的 cache 命中统计需要查看 session logs（`~/.claude/cache/`），但本 session 没主动看。

**经验估计**：
- 重复读 `superpowers/SKILL.md` 之类会命中 cache
- 每次重写/重写文件不会命中 cache
- 整体 cache 命中率**应该不高**（约 30-50%）—— 我们大量反复读 / 写相同路径

**改进空间**：未来用 Glob 模式批量探索、用 .research-cache/ 持久化、不在 conversation 里反复粘同一文件。

### 2.4 是否充分利用生态工具

| 工具 / 实践 | 是否用了 | 备注 |
|---|---|---|
| `superpowers` 插件 | ✅ 部分 | 触发了 brainstorming + writing-plans，但 writing-skills 没显式跑 |
| `mcp-server-dev` 插件 | ❌ 装了没用 | — |
| `brave-search` MCP | ❌ 没配 | — |
| `claude-code-docs` MCP | ❌ 没配 | — |
| `context7` MCP | ❌ 没配 | — |
| Git worktree | ❌ **反模式**：直接在 main 上改 | superpowers 装了但我们没用 using-git-worktrees skill |
| Subagent 调度 | ❌ **反模式**：全程主 agent 自己干 | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 已开但没用 |
| parallel agents | ❌ | brainstorming / dispatching-parallel-agents skill 没跑 |
| TDD | ❌ | 没写测试（这次产物是 docs 不是 code） |
| Hooks | ❌ | 没装任何 hook |
| Slash commands（自定义） | ❌ | 没用 `/opsx:*` 命令，openspec 改 workflow 没走 |

**生态工具利用率：约 10%**（只用了 superpowers 的 brainstorming flow）

### 2.5 Token 优化评估

**没做**：
- ❌ 没启用 cache 友好模式（同一个文件多次 Edit 触发重读）
- ❌ 没分拆 sub-session（长 context 不易管理）
- ❌ 没设 Effort 模式细分（`max` 一直开）
- ❌ Bash 输出没用 head/tail 截断（部分命令输出过大被全量读入）
- ❌ Read 没用 offset/limit 多次读小段（本 session 一些 Read 调用读了全文件）
- ❌ WebSearch 没启用

**做了**：
- ✅ 部分命令用 `head -c 800` 截断
- ✅ 用 `grep -oE` 抽关键 token 而不是读全文
- ✅ Dev server 在 background，不阻塞主流程

**估算本 session token 消耗**：
- 输入：~500K-1M tokens（含 history 累积）
- 输出：~200K-400K tokens
- **没有真数据**，但估算 1-1.5M tokens 总量

### 2.6 代码质量自评估

| 维度 | 评分 | 备注 |
|---|---|---|
| 正确性 | 8/10 | 1 个 500 错误（`{#id}` MDX 语法），1 个 404 bug（中文 slug），都修了 |
| 设计 | 7/10 | 9 条元规则沉淀合理；3 层 + 3 闸门模型清晰 |
| 可维护性 | 7/10 | Skill SKILL.md 文档全；3 个 prompt 模板；`registry.json` 是单一真相源 |
| 测试 | 0/10 | **0 单元测试**（这次没写 code test） |
| 一致性 | 6/10 | registry.json / index.mdx / meta.json 三处同步，**靠人**，脚本化待做 |
| 可观测性 | 3/10 | 没 metrics / log / error tracking |
| 文档 | 8/10 | LEARNINGS + SESSION_HANDOFF + PRE_CONFIG_AUDIT 三份 |
| **平均** | **5.6 / 10** |  |

### 2.7 错误 / 卡点

| # | 卡点 | 修复 | 教训 |
|---|---|---|---|
| 1 | `source.getPage(['资料参考'])` 返回 undefined → 404 | 重命名目录为 `research` | Fumadocs 中文 slug bug |
| 2 | WebFetch 拦 `claude.com` | curl + Python fallback | Skill 应预知 claude.com |
| 3 | `{#id}` MDX 500 错误 | 删 `{#id}` | MDX 不支持 GFM/Pandoc 语法 |
| 4 | LEARNINGS.md 放 `content/docs/` 触发 frontmatter 校验 | 移到 `apps/docs/` 根 | `.md` 也会被扫 |
| 5 | 第一次 Edit 时，new_string 把内容 append 在前，旧的留后面重复 | 二次 Edit 删冗余 | Edit old_string 必须能唯一匹配 |
| 6 | 用了 `_debug` 命名的 API 路由 → 404（`_` 前缀是私有目录） | 改名为 `zdebug`（后又删了） | Next.js `_` 前缀是私有约定 |

### 2.8 反复出现的低效模式

1. **每次读 registry.json / index.mdx 都全量读**（可以用 Grep 抽关键字段）
2. **Bash 大输出未截断**（如 `gh repo view` 全 JSON 没 jq）
3. **跨 2-3 天做**同一工作（context 重新装载浪费）
4. **没有任务追踪直到 user 提醒**（前半段没建 TaskList，浪费了 1-2 轮工具调用）

---

## 3. 团队/项目背景

- **团队**：前端全栈（TypeScript 主、Rust 辅）
- **历史开发环境**：GitHub Copilot + VSCode
- **转型原因**：2026-06-01 GitHub Copilot 涨价 → 转向 Claude Code
- **规划模型**：Claude（按 CLAUDE.md）→ 实际是 MiniMax-M3
- **执行模型**：DeepSeek V4 PRO（按 CLAUDE.md）→ 实际没启用
- **本项目（maestro）**：Tauri v2 桌面 app，产品管理 pipeline（0-5 phase）
- **本任务**：写 Claude Code 教程 + 调研素材库

---

## 4. 配置后预期改善（让对比有意义）

| 维度 | 配置前 | 配置后目标 |
|---|---|---|
| MCP server | 0 个 | 至少 3 个（brave / claude-code-docs / context7） |
| 全局 Skill | 0 个 | 至少 5 个（research-source + 4 个常用自动化） |
| Git worktree | 未用 | 主流程都用 |
| Subagent | 未用 | 大调研 task 用 subagent 并发 |
| Cache 命中率 | 30-50%（估） | 60-80% |
| Token / task | 1-1.5M 估 | 减 30% |
| 错误率 | 6 卡点 / session | 减到 ≤ 2 |
| Permission 中断 | ~10 次 | 写到全局 allowlist 减到 0-2 |
| 测试覆盖 | 0% | ≥ 30% |

---

## 5. 「配置后」审计要对照做的

1. 重新跑 superpowers 全流程（Card + Brief + Deep-Dive）→ 计时 + 工具调用数 + 错误数
2. 跑第 3 源（推荐 `AI-Coding-Guide-Zh`）→ 同样指标
3. 写 `apps/docs/POST_CONFIG_AUDIT.md` 同样结构
4. 写 `apps/docs/CONFIG_DIFF.md` 横向对比

---

## 6. 立即可做（无需等配置）

### 6.1 Git 提交

```
$ git add .claude/skills/ apps/docs/content/docs/research/ apps/docs/LEARNINGS.md apps/docs/SESSION_HANDOFF.md apps/docs/PRE_CONFIG_AUDIT.md .gitignore
$ git status   # 确认干净
$ git commit -m "feat(research): bootstrap research-source skill + 2 source cards/briefs/deep-dives + learnings"
```

注意：`.github/prompts/` `.github/skills/` 是 superpowers 装时改的（21 个文件 M），不在我们的 commit 范围。

### 6.2 新 session 启动脚本

写 `apps/docs/RESUME_NEXT_SESSION.md` 包含 1 行 claude 启动命令：

```bash
claude --append-system-prompt "读 apps/docs/SESSION_HANDOFF.md 和 apps/docs/LEARNINGS.md，按 5 步走方案开始第 3 源（推荐 AI-Coding-Guide-Zh）。当前时间是 2026-06-11。"
```

但更简单：用户直接 `claude` 启动后，**第一句**打那段话。

---

## 7. 写在最后

> 这份审计的真正价值不是「记录现状」，而是**给「配置后」一个可对比的基线**。如果配置后某项没改善，就说明教程对应章节写得不够好——这是闭环验证，不是自娱自乐。

— audit done 2026-06-11
