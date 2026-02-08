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

Still open:
- Electron TypeScript strictness remains disabled (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`).
- Core files are still too large in responsibility (`ProcessingHelper`, `UnifiedPanel`).
- Integration test coverage is still narrow (mostly unit validation tests).

## Current Findings

### P1

1. Electron TypeScript strictness is still permissive
- `tsconfig.electron.json` keeps strictness flags off.
- Impact: type regressions can still escape into runtime.

2. Single-file complexity remains high in critical paths
- `electron/ProcessingHelper.ts` and `src/components/UnifiedPanel/UnifiedPanel.tsx` are multi-responsibility controllers.
- Impact: higher change risk and slower onboarding/review.

3. Limited automated coverage for runtime-critical flows
- Unit tests pass, but IPC routing, live audio state machine, and screenshot-processing paths are under-tested.
- Impact: regressions likely appear late (manual QA/release).

### P2

4. Legacy/parallel abstractions still exist
- Multiple audio-related service layers with overlapping responsibilities.
- Impact: confusion about active path, harder long-term maintenance.

5. Runtime logging is still noisy in production paths
- Broad `console.*` usage in hot paths.
- Impact: noisy diagnostics and increased risk of leaking internal state.

## Remediation Plan

### P1 Actions (Next Sprint)

1. Introduce strictness in Electron TS config in phases:
- Phase A: `noImplicitAny: true`
- Phase B: `strictNullChecks: true`
- Phase C: `strict: true`

2. Split `ProcessingHelper` into provider strategies and orchestration layer.

3. Split `UnifiedPanel` into:
- session control controller
- live state lane component
- response rendering component
- recovery/actions component

4. Add integration tests:
- IPC channel contract tests (`preload <-> main`)
- live start/stop/reconnect state transitions
- screenshot process and recovery flow

### P2 Actions (Cleanup)

1. Remove or quarantine legacy modules not in active path.
2. Consolidate logging behind a leveled logger policy.
3. Normalize shared runtime types across main/preload/renderer.

## Quick Wins

1. Add a startup IPC contract self-check (assert all preload invokes are handled in main).
2. Add CI gates for `lint`, `test`, and targeted integration smoke tests.
3. Add architectural ADR notes for audio/live pipeline ownership boundaries.
