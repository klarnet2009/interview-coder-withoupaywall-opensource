# Tech Debt and Risks (EN)

This is a code-level audit focused on reliability, maintainability, and modern engineering standards.

Last updated: `2026-02-08`

## Severity Legend

- `P0`: high-impact defects/risk, should be fixed first
- `P1`: meaningful quality/reliability issues, next wave
- `P2`: structural improvements and cleanup

## Status Since Initial Audit

Resolved:
- IPC contract parity for session history and external-link channels.
- API key plaintext-at-rest risk (migrated to secure storage flow).
- Live phrase finalization hangs reduced with explicit end-turn fallback logic.
- Strict ESLint baseline restored (`npm run lint` passes with `0` errors).
- Build chunk size warnings removed via renderer chunk-splitting and lighter syntax-highlighting usage.
- Electron TypeScript strictness migration completed (`noImplicitAny: true`, `strictNullChecks: true`, `strict: true`).
- `ProcessingHelper` provider logic extracted to strategy-based provider layer + orchestrator.
- Added integration tests for preload/main IPC channel contract and live lifecycle transitions.
- Added integration tests for screenshot processing and recovery flows in `ProcessingHelper`.
- `ProcessingHelper` response shaping/parsing extracted into dedicated formatter modules.
- `UnifiedPanel` was decomposed into focused UI modules (`AudioSourceSelector`, `ActionNoticeBanner`, `ResponseSection`, `LiveStateLane`) with shared types/constants.
- Added integration tests for `ProcessingHelper` cancellation race windows (queue and debug flows).
- `ProcessingHelper` orchestration was split into dedicated queue/debug controllers under `electron/processing/controllers/*`.
- Added deterministic timeout guard for provider calls (`electron/processing/providerTimeout.ts`) and timeout integration tests.
- CI gates were tightened (lint/typecheck/build/test must pass).
- Added bundle budget gate (`npm run check:bundle`) and CI enforcement.
- Added ADR for live-audio ownership boundaries (`docs/adr/ADR-001-live-audio-pipeline-boundaries.md`).
- Introduced centralized logger wrapper (`electron/logger.ts`) and migrated processing orchestration paths off direct `console.*`.

Still open:
- `src/components/UnifiedPanel/UnifiedPanel.tsx` still owns runtime side-effects and can be further hook-extracted.
- Legacy/parallel audio abstractions are still present and should be quarantined/removed.

## Current Findings

### P1

1. Runtime-critical coverage baseline is now strong
- IPC routing contract and live start/stop/reconnect transitions are covered.
- Screenshot processing and recovery flows (queue empty, extraction failure, success path, debug path, provider-not-configured) are covered.
- Cancellation race windows in processing are now covered by integration tests.
- Provider timeout behavior is now covered by deterministic integration tests (queue/debug).

### P2

2. Legacy/parallel abstractions still exist
- Multiple audio-related service layers with overlapping responsibilities.
- Impact: confusion about active path, harder long-term maintenance.

3. Runtime logging is still noisy in production paths
- Logging policy is now centralized in processing paths, but broad `console.*` usage remains in other runtime modules.
- Impact: noisy diagnostics and increased risk of leaking internal state.

4. UnifiedPanel still has runtime side-effect ownership
- `src/components/UnifiedPanel/UnifiedPanel.tsx` was reduced substantially but still coordinates multiple runtime concerns.
- Impact: medium change risk in UI runtime control logic.

## Remediation Plan

### P1 Actions (Next Sprint)

1. Electron strictness migration:
- Phase A: `noImplicitAny: true` (completed)
- Phase B: `strictNullChecks: true` (completed)
- Phase C: `strict: true` (completed)

2. Continue decomposition of `ProcessingHelper` by splitting orchestration into queue/debug controllers.
Status: `completed`.

3. Split `UnifiedPanel` into:
- session control controller
- live state lane component
- response rendering component
- recovery/actions component
Status: `partially completed` (lane/response/recovery/audio selector extracted; remaining runtime-effects/controller logic still in `UnifiedPanel.tsx`).

4. Add integration tests:
- IPC channel contract tests (`preload <-> main`) (completed)
- live start/stop/reconnect state transitions (completed)
- screenshot process and recovery flow (completed)
- processing cancel race flow (completed)
- provider timeout branches (completed)

### P2 Actions (Cleanup)

1. Remove or quarantine legacy modules not in active path.
2. Consolidate logging behind a leveled logger policy.
3. Normalize shared runtime types across main/preload/renderer.

## Quick Wins

1. Add a startup IPC contract self-check (assert all preload invokes are handled in main).
Status: `partially covered` by `ipcContract.integration.test.ts` + CI gate.
2. Add CI gates for `lint`, `test`, and targeted integration smoke tests.
Status: `completed`.
3. Add architectural ADR notes for audio/live pipeline ownership boundaries.
Status: `completed`.
4. Add a bundle budget gate in CI to prevent regressions in renderer chunk sizes.
Status: `completed`.
