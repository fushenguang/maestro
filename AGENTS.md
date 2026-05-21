# Maestro Agent Guide

Start here when working in this repository:

- Architecture charter: [`docs/architecture/vision.md`](./docs/architecture/vision.md)
- Reference contract: [`docs/references/AGENTS.md`](./docs/references/AGENTS.md)
- OpenSpec workflow: [`openspec/AGENTS.md`](./openspec/AGENTS.md)

## Starting a new change

1. Read the architecture charter and the upstream contract in `docs/references/`.
2. Create a new directory under `openspec/changes/<change-id>/`.
3. Add `proposal.md`, `design.md`, `tasks.md`, and the spec delta under `specs/`.
4. Run `openspec validate <change-id> --strict` before implementation or PR handoff.
