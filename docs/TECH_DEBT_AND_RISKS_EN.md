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

Still open:
- Core UI controller size is still high (`src/components/UnifiedPanel/UnifiedPanel.tsx`).
- Some runtime edge cases are still primarily validated by manual QA (provider timeout/cancellation race windows).

## Current Findings

### P1

1. Single-file complexity remains high in critical paths
- `src/components/UnifiedPanel/UnifiedPanel.tsx` remains a multi-responsibility controller.
- `electron/ProcessingHelper.ts` was improved via provider strategy and formatter extraction, but orchestration flow is still broad.
- Impact: higher change risk and slower onboarding/review.

2. Limited automated coverage for runtime-critical flows
- IPC routing contract and live start/stop/reconnect transitions are covered.
- Screenshot processing and recovery flows (queue empty, extraction failure, success path, debug path, provider-not-configured) are covered.
- Remaining risk: provider timeout/cancellation race windows still lean on manual QA.

### P2

4. Legacy/parallel abstractions still exist
- Multiple audio-related service layers with overlapping responsibilities.
- Impact: confusion about active path, harder long-term maintenance.

5. Runtime logging is still noisy in production paths
- Broad `console.*` usage in hot paths.
- Impact: noisy diagnostics and increased risk of leaking internal state.

## Remediation Plan

### P1 Actions (Next Sprint)

1. Electron strictness migration:
- Phase A: `noImplicitAny: true` (completed)
- Phase B: `strictNullChecks: true` (completed)
- Phase C: `strict: true` (completed)

2. Continue decomposition of `ProcessingHelper` by splitting orchestration into queue/debug controllers.

3. Split `UnifiedPanel` into:
- session control controller
- live state lane component
- response rendering component
- recovery/actions component

4. Add integration tests:
- IPC channel contract tests (`preload <-> main`) (completed)
- live start/stop/reconnect state transitions (completed)
- screenshot process and recovery flow (completed)

### P2 Actions (Cleanup)

1. Remove or quarantine legacy modules not in active path.
2. Consolidate logging behind a leveled logger policy.
3. Normalize shared runtime types across main/preload/renderer.

## Quick Wins

1. Add a startup IPC contract self-check (assert all preload invokes are handled in main).
2. Add CI gates for `lint`, `test`, and targeted integration smoke tests.
3. Add architectural ADR notes for audio/live pipeline ownership boundaries.
4. Add a bundle budget gate in CI to prevent regressions in renderer chunk sizes.
