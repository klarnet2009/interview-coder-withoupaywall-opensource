# ADR-001: Live Audio Pipeline Ownership Boundaries

Date: 2026-02-08
Status: Accepted

## Context

The codebase contains multiple audio-related modules across main and renderer.
Without explicit ownership boundaries, changes can introduce duplicate paths,
state drift, and fragile runtime behavior.

## Decision

Define and enforce explicit ownership boundaries:

1. `electron/audio/LiveInterviewService.ts`
- Owns live interview lifecycle orchestration (`start/stop/status`, reconnection, state transitions).

2. `electron/audio/GeminiLiveService.ts`
- Owns transport/session interaction with Gemini Live API.
- Must not own product-level UI state policy.

3. `electron/audio/HintGenerationService.ts`
- Owns hint generation policy and prompting for active transcript context.

4. `src/components/UnifiedPanel/*`
- Owns renderer interaction surfaces and local capture controls.
- Must not directly implement provider/session orchestration decisions.

5. `electron/ProcessingHelper.ts` + `electron/processing/controllers/*`
- Own screenshot-based extraction/solution/debug orchestration path only.
- Must stay independent of live interview lifecycle classes.

## Consequences

Positive:
- Lower coupling between screenshot and live pipelines.
- Easier testing and safer refactoring in controller/provider boundaries.
- Clear ownership for incident triage.

Tradeoffs:
- Requires discipline to avoid cross-layer shortcuts.
- Adds small overhead when introducing new cross-pipeline features.

## Follow-up Rules

1. New live interview behavior changes must be implemented in `electron/audio/*`, not renderer utility layers.
2. New screenshot processing behavior changes must be implemented in `electron/processing/*` or `ProcessingHelper`.
3. Cross-boundary changes require explicit note in PR description and tests for both affected paths.
