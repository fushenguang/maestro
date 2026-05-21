---
version: 1
last_reviewed: 2026-05-21
normative: true
---

# Maestro Architecture Vision

`docs/references/SPEC.md` is the upstream contract for Maestro. This charter narrows local implementation choices without overriding that reference.

## Runtime contract

Agent runtime = **AppServer Protocol**. Desktop, service, and automation surfaces should speak the same contract so orchestration logic stays portable.

## Preferred OSS core

Preferred OSS core: **codex SDK**. Maestro should build its first-party agent runtime integrations around the codex SDK unless the upstream contract requires a different interface.

## Provider abstraction

LLM provider abstraction is mandatory and must stay **pluggable**. The first supported provider is **MiniMax** through its OpenAI-compatible surface, with future providers including OpenAI, Anthropic, vLLM, and other compatible backends.

## Product direction

The desktop shell is the first delivery target, but the architecture must preserve clear seams between orchestration, provider access, and UI so additional clients can reuse the same runtime contract.
