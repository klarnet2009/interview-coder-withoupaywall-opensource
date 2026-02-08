# Release Changelog - Sprint 1 to Sprint 5 + Tech Hardening

Date: 2026-02-08
Project: interview-coder-withoupaywall-opensource

## Release Scope

This release consolidates the full UI/UX redesign program:

- Sprint 1: P0 stabilization
- Sprint 2: P1 core experience
- Sprint 3: P1 architecture completion
- Sprint 4: P2 enhancements + hardening
- Sprint 5: i18n and polish
- Post-sprint technical hardening (TECH-004 to TECH-022)

## Sprint Highlights

### Sprint 1 (P0 Stabilization)

- Hotkeys and in-product hotkey labels aligned to real behavior.
- Processing status surfaced in UI for better real-time transparency.
- Security copy updated to match actual technical behavior.
- Logout behavior normalized across entry points.
- Fake wizard validation removed in favor of real checks/explicit states.

### Sprint 2 (P1 Core Experience)

- Main action panel simplified and made more predictable.
- Live state lane introduced for listen/transcribe/generate flow.
- Error recovery moved from toast-only to inline action-based recovery.
- Baseline accessibility improvements (text size, hit area consistency).

### Sprint 3 (P1 Architecture Completion)

- Main flow simplified around session-first usage.
- Wizard selections wired consistently to runtime behavior.
- Legacy UX surfaces and stale states cleaned up.

### Sprint 4 (P2 Enhancements + Hardening)

- Response workspace improved for readability and fast scanning.
- Debug workspace improved for structure and actionability.
- Session history layer added and connected to restore flows.
- Motion polish focused on functional transitions.

### Sprint 5 (i18n and Polish)

- i18n infrastructure added (`react-i18next`, locale resources).
- Major screens and settings localized (EN/RU).
- Settings transitions refined with section animation polish.
- Duplicate Electron API typing removed; canonical typing path kept.

## Tech Hardening (Post-Sprint)

- TECH-004: IPC parity restored for session history channels.
- TECH-005: External URL IPC channel mismatch removed.
- TECH-006: API key moved from plaintext config to secure storage flow.
- TECH-007: Live phrase finalization made more resilient (fallback end-turn logic).
- TECH-008: ESLint scope narrowed to active source paths.
- TECH-009: Residual lint debt removed; strict lint baseline restored.
- TECH-010: Build/performance baseline improved:
  - renderer manual chunking enabled for heavy dependency groups
  - Electron main build externalized runtime dependencies
  - shared `CodeSyntax` component introduced (`PrismLight` + registered language subset)
- TECH-011: Electron TypeScript strictness Phase A completed (`noImplicitAny: true`).
- TECH-012: `ProcessingHelper` refactored to provider strategies + orchestration layer (`electron/processing/providers/*`, `ProcessingProviderOrchestrator`).
- TECH-013: Runtime hardening for live/IPC:
  - added missing `clear-store` handler in main IPC
  - added integration tests for preload/main IPC contract and live lifecycle transitions
- TECH-014: Electron strict typing migration completed:
  - `strictNullChecks: true`
  - `strict: true`
  - Electron/renderer QA checks pass on strict baseline
- TECH-015: Screenshot-processing reliability coverage added:
  - new integration suite for `ProcessingHelper` queue/debug/recovery branches
  - validates transition and error-handling paths without external API calls
- TECH-016: `ProcessingHelper` response shaping extracted to dedicated formatters:
  - `solutionResponseFormatter` and `debugResponseFormatter`
  - added formatter unit tests for stable parsing behavior
- TECH-017: `UnifiedPanel` decomposed into focused UI modules:
  - extracted `AudioSourceSelector`, `ActionNoticeBanner`, `ResponseSection`, `LiveStateLane`
  - moved shared types/constants/format helper into dedicated files
- TECH-018: Added `ProcessingHelper` cancellation race integration coverage:
  - queue cancellation path guarded against stale success events
  - debug cancellation path guarded against stale success events
- TECH-019: `ProcessingHelper` orchestration decomposed into dedicated controllers:
  - `QueueProcessingController` and `DebugProcessingController`
  - shared timeout/payload utilities for provider-bound operations
- TECH-020: Timeout and workflow hardening:
  - deterministic timeout integration tests for queue/debug processing branches
  - strict CI gates (lint/typecheck/build/test)
  - bundle budget enforcement (`npm run check:bundle`)
  - ADR for live/audio ownership boundaries
- TECH-021: Logging policy phase A:
  - introduced centralized main-process logger (`electron/logger.ts`)
  - migrated `ProcessingHelper` and processing controllers from direct `console.*` calls
- TECH-022: Legacy audio abstraction quarantine:
  - moved inactive capture abstractions to `*.legacy.ts`
  - excluded `**/*.legacy.ts` from active TypeScript builds
  - removed legacy capture exports from active audio module index

## Additional Reliability Updates

- TypeScript baseline cleanup:
  - Pre-existing renderer typing errors fixed in `Solutions`, `SolutionCommands`, `DebugView`, and related API typings.
  - `npx tsc --noEmit` now passes.
- Session history restore logic extracted to a testable helper:
  - `src/lib/sessionRestore.ts`
  - Covered by unit tests in `tests/unit/sessionRestore.test.ts`.
- New integration coverage:
  - `tests/integration/ipcContract.integration.test.ts`
  - `tests/integration/liveInterviewLifecycle.integration.test.ts`
  - `tests/integration/processingHelper.integration.test.ts`
- New unit coverage:
  - `tests/unit/responseFormatters.test.ts`

## Validation Summary

- `npx tsc --noEmit`: pass
- `npm run lint`: pass (0 errors)
- `npm test`: pass (47/47)
- `npm run build`: pass (no large chunk warnings)
- `npm run check:bundle`: pass

## Notes

- Bundle warning risk is reduced after TECH-010; continue monitoring chunk sizes in future dependency updates.
