# Tech Debt and Risks (EN)

This is a code-level audit focused on reliability, maintainability, and modern engineering standards.

## Severity Legend

- `P0`: high-impact defects/risk, should be fixed first
- `P1`: meaningful quality/reliability issues, next wave
- `P2`: structural improvements and cleanup

## Findings

### P0

1. IPC contract gaps between preload and main handlers
- Preload exposes `get-session-history*` and delete/clear history channels with no matching `ipcMain.handle`.
- Preload `openExternal` invokes `openExternal`, but main handles `open-external-url` and `openLink`.
- Impact: runtime errors on invoke and broken features hidden behind type-safe facade.

2. API key storage is plaintext at rest
- `ConfigHelper` persists `apiKey` directly in JSON.
- `SecureStorage` encryption path exists but is effectively disabled.
- Impact: local credential exposure risk.

3. Live/audio reliability still depends on timing heuristics only
- Phrase finalization can rely on silence/timing windows that fail in noisy conditions.
- Impact: user-visible stuck states in interview flow.

### P1

4. Type safety baseline is weak in Electron layer
- `tsconfig.electron.json` has `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`.
- Mixed `any` and untyped payloads across IPC and service boundaries.
- Impact: regressions surface at runtime instead of compile time.

5. Single-file complexity is high in core paths
- `electron/ProcessingHelper.ts` and `src/components/UnifiedPanel/UnifiedPanel.tsx` are large and multi-responsibility.
- Impact: slower iteration, harder testing, higher bug density.

6. `ConfigHelper.setOpacity` bypasses atomic save path
- Direct file write path diverges from backup/atomic flow used by `saveConfig`.
- Impact: increased risk of partial/competing config writes.

7. Limited automated test coverage
- Existing tests mostly cover validators.
- Core flows (IPC routes, screenshot processing, live audio state machine) lack integration coverage.
- Impact: fragile releases and hard-to-catch regressions.

### P2

8. Duplicate/legacy abstractions increase confusion
- Two audio capture service implementations (`electron/audio/AudioCaptureService.ts` and `src/services/AudioCaptureService.ts`) with different runtime assumptions.
- Some modules look legacy and are not clearly wired into primary flow.
- Impact: onboarding friction and accidental usage of stale paths.

9. Type declaration drift and duplication
- Duplicate `setWindowOpacity` declarations in `src/types/electron.d.ts`.
- Event naming typo (`procesing-unauthorized`) in preload constants.
- Impact: reduced trust in declared contracts.

10. Verbose runtime logging in production paths
- Extensive `console.log` and broad error logging remain in hot paths.
- Impact: noisy logs and potential information leakage.

## Remediation Plan

### P0 Actions (Immediate)

1. Fix IPC parity:
- Implement missing session history handlers or remove preload methods until implemented.
- Standardize URL open channel names and update all call sites.

2. Secure key storage:
- Re-enable encrypted storage path with migration and fallback strategy.
- Keep only non-sensitive config in plaintext.

3. Stabilize live phrase finalization:
- Add explicit end-of-turn signaling path and stale-state failsafe.
- Add telemetry for trigger reason and state duration.

### P1 Actions (Next Sprint)

1. Raise strictness in Electron TS config incrementally.
2. Split `ProcessingHelper` into provider-specific strategy modules.
3. Split `UnifiedPanel` into smaller controller + presentational components.
4. Add integration tests for IPC map and key user flows.

### P2 Actions (Cleanup)

1. Remove or quarantine legacy modules not in active use.
2. Normalize type declarations and event constants.
3. Reduce unstructured logging and move to leveled logger policy.

## Quick Wins (High Impact, Low Effort)

1. Add startup assertion that preload invoke channels exist in main.
2. Validate `globalShortcut.register(...)` return values and log failures clearly.
3. Add a shared IPC channel enum exported to preload/types/main.
4. Remove duplicate type declarations in `src/types/electron.d.ts`.
