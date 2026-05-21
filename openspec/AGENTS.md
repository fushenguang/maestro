# OpenSpec Workflow — Maestro

Maestro 使用 OpenSpec 做 spec-driven development。任何非 trivial 改动 **必须**先开 OpenSpec change，再实现代码。

## 目录约定

```
openspec/
├── config.yaml                    # 项目级 context（tech stack、conventions）
├── AGENTS.md                      # 本文件
├── specs/                         # 已通过的能力 spec（合并后归档于此）
│   └── <capability>/spec.md
└── changes/                       # 进行中的变更
    ├── <change-id>/
    │   ├── .openspec.yaml         # schema + created
    │   ├── proposal.md            # Why + What + Impact
    │   ├── design.md              # Decisions + Risks + OQ
    │   ├── tasks.md               # 实施清单 + ## Acceptance（机器可执行）
    │   └── specs/<capability>/spec.md   # delta requirements
    └── archive/<date>-<change-id>/
```

## 三条硬约束

1. **`docs/references/` 只读**。SPEC.md / 各 reference 文档 = 实现合同（来源 openai/symphony, Apache 2.0）。任何 spec / change 不得与 references 冲突；冲突时以 references 为准。

2. **每个 change 必须有 `## Acceptance` 段**（在 tasks.md 顶部），罗列机器可执行验收命令。calcifer 的 self-incubation-loop 在 PR 合并后会自动跑这些命令并把结果（pass/fail）推飞书。

3. **OpenSpec changes 跟项目走**。Maestro 的 changes 永远在本仓 `openspec/changes/`，不进入 calcifer 仓。calcifer 通过 GitHub PR 与本仓交互，不直接读写本仓的 openspec 物料。

## 开新 change 时的最少要求

```bash
mkdir -p openspec/changes/<id>/specs
# 写 4 个文件：proposal.md / design.md / tasks.md / specs/<cap>/spec.md
openspec validate <id> --strict   # 必须通过
```

每个 `### Requirement:` 至少 1 个 `#### Scenario:`。
