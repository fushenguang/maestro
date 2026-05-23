# OpenSpec — Agent Entrypoint

This directory manages all product changes using the OpenSpec workflow. Read this before creating or implementing any change.

## Directory Structure

```
openspec/
  config.yaml          # Workspace context (product summary, active changes list)
  specs/               # Cross-cutting capability specs (source of truth)
    product.md         # Product boundary authority — read this first
  changes/             # Active changes (in-progress work)
    <change-id>/
      proposal.md      # Why + what (scope)
      design.md        # How (technical approach)
      tasks.md         # Acceptance criteria + checklist
  changes/archive/     # Completed changes (read-only)
```

## Change Workflow

```
explore → proposal → design → tasks → implement → archive
```

| Step | Command | Output |
|---|---|---|
| Explore an idea | `/opsx:explore` | Thinking notes |
| Create a new change | `/opsx:new <change-id>` | `proposal.md` |
| Progress to next artifact | `/opsx:continue <change-id>` | `design.md` → `tasks.md` |
| Implement tasks | `/opsx:apply <change-id>` | Code changes |
| Archive when done | `/opsx:archive <change-id>` | Moves to `archive/` |

## `specs/` Directory

`specs/` holds cross-cutting capability specs that survive across changes. They represent the evolving product spec baseline.

- **`product.md`** — the product boundary authority. Lists what is and is not in scope for Maestro v0.1. All changes must stay within this boundary.

## Notes

- **Before implementing any change**: read `openspec/specs/product.md` first.
- **`changes/archive/`** is read-only. Never modify archived changes.
- **`config.yaml`** contains the agent context summary. Check it is up to date before starting a session — if it references outdated changes or products, update it.
- If a change reveals a design conflict with `product.md`, pause and update `product.md` first.
