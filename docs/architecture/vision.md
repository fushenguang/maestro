---
version: 1
last_reviewed: 2026-05-21
normative: true
---

# Maestro architecture vision

Maestro implements the upstream contract in [`docs/references/SPEC.md`](../references/SPEC.md). That reference remains the source of truth for system behavior and integration boundaries.

## Runtime contract

Agent runtime = **AppServer Protocol**. Every runtime-facing surface in Maestro must stay aligned with that protocol so the desktop shell remains pluggable and future runtimes can be swapped without rewriting product flows.

## Core implementation direction

Preferred OSS core: **codex SDK**. The project should treat the codex SDK as the default implementation substrate for orchestration and agent execution unless a future change formally replaces it.

## Model provider policy

LLM provider abstraction is mandatory. The provider layer must be pluggable, with **MiniMax** as the first supported OpenAI-compatible backend and future providers including OpenAI, Anthropic, vLLM, and other compatible endpoints.
