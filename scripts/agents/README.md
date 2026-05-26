# scripts/agents/

**AI Coding Agent 专用脚本目录。**

这里的脚本设计为**全自动执行**，无需人工干预，适合在 CI 流水线或 AI Agent 工具调用中使用。

## 脚本清单

| 脚本 | 用途 | 依赖 |
|------|------|------|
| `verify-all.sh` | 一键运行全部自动化验证 | sqlite3, node, pnpm |
| `seed-db.sh` | 向本地 SQLite 注入测试数据 | sqlite3 |
| `check-db.sh` | 读取本地 SQLite 验证数据状态 | sqlite3 |

## 用法

```bash
# 从 workspace 根目录运行
./scripts/agents/verify-all.sh         # 全部验证
./scripts/agents/seed-db.sh            # 只注入数据
./scripts/agents/check-db.sh           # 只检查 DB

# 注入 + 检查 + 清理（幂等）
./scripts/agents/seed-db.sh && ./scripts/agents/check-db.sh
```

## 输出规范

- `✅` 表示通过
- `❌` 表示失败，非 0 退出码
- 可被 AI Agent 解析的纯文本输出

## 数据库路径

本地 SQLite: `~/Library/Application Support/com.fushenguang.maestro/maestro.db`

运行 `pnpm tauri dev` 至少一次后 DB 文件才会存在。
