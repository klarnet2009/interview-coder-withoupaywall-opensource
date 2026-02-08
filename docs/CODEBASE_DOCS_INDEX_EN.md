# Codebase Documentation Index (EN)

This documentation set explains how the current codebase is structured and how to work with it safely.

## Audience

- Engineers onboarding to the repository
- Contributors implementing features or fixing bugs
- Maintainers reviewing architecture and technical debt

## Suggested Reading Order

1. `docs/ARCHITECTURE_OVERVIEW_EN.md`
2. `docs/MODULE_MAP_EN.md`
3. `docs/IPC_CONTRACT_EN.md`
4. `docs/LIVE_AUDIO_FLOW_EN.md`
5. `docs/CONFIG_AND_PERSISTENCE_EN.md`
6. `docs/DEV_WORKFLOW_EN.md`
7. `docs/TECH_DEBT_AND_RISKS_EN.md`
8. `docs/adr/ADR-001-live-audio-pipeline-boundaries.md`

## Existing Product/UX Docs

- `docs/UI_UX_SPRINT_PLAN_EN.md`
- `docs/UI_UX_AUDIT_AND_REDESIGN_MASTER_RU.md`
- `docs/UI_UX_EXECUTIVE_SUMMARY_RU.md`
- `docs/UI_UX_STEP_BY_STEP_EXECUTION_PLAN_RU.md`
- `docs/UI_UX_IMPLEMENTATION_BACKLOG_RU.md`
- `docs/UI_UX_TODO_PROGRESS_RU.md`

## What This Set Covers

- Electron process architecture (main, preload, renderer)
- UI module boundaries and current ownership
- IPC channels and payload contracts
- Live audio pipeline and state transitions
- Config and persistence model
- Daily dev workflow and build/test commands
- Current risks, technical debt, and remediation priorities
- Architecture decision boundaries for live audio ownership

## Scope and Accuracy Notes

- This documentation reflects the code currently present in the repository.
- It documents implementation reality, including known mismatches and gaps.
- It does not assume intended behavior when code and behavior differ.
