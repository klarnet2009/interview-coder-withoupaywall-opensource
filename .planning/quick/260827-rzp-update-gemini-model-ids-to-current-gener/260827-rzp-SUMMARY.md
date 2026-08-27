---
phase: quick-260827-rzp
plan: 01
subsystem: config-and-model-routing
tags: [gemini, model-ids, constants, migration, security]
status: complete

requires:
  - electron/ConfigHelper.ts sanitizeModelSelection chokepoint
  - tsconfig.electron.json inferred rootDir (no explicit rootDir)
provides:
  - electron/constants/geminiModels.ts — single source of truth for desktop Gemini model ids
  - resolveGeminiModelId — forward migration + URL-path charset guard
  - backend/src/processing/providers/gemini.models.ts — documented backend mirror
affects:
  - Settings and Wizard model pickers
  - GeminiProcessingProvider / backend gemini.provider URL construction
  - AudioProcessor, HintGenerationService, ProfileExtractorService model selection

tech-stack:
  added: []
  patterns:
    - "Shared pure-constants module under electron/ imported by both main process and renderer via relative path (no path alias)"
    - "Single-chokepoint forward migration: legacy id remap runs inside sanitizeModelSelection, which both loadConfig and updateConfig already call"
    - "Soft gate over hard allowlist: charset guard + legacy remap, unknown-but-safe ids pass through so Custom Model keeps working"

key-files:
  created:
    - electron/constants/geminiModels.ts
    - tests/unit/geminiModels.test.ts
    - backend/src/processing/providers/gemini.models.ts
  modified:
    - electron/ConfigHelper.ts
    - src/types/index.ts
    - src/components/Settings/SettingsPage.tsx
    - src/components/Settings/SettingsForm.tsx
    - src/components/Wizard/WizardSteps/StepProvider.tsx
    - src/components/Wizard/WizardContainer.tsx
    - tests/integration/ipcContract.integration.test.ts
    - tests/integration/processingHelper.integration.test.ts
    - electron/audio/GeminiLiveService.ts
    - electron/audio/HintGenerationService.ts
    - electron/AudioProcessor.ts
    - electron/services/ProfileExtractorService.ts
    - electron/processing/providers/GeminiProcessingProvider.ts
    - src/_pages/DebugLive.tsx
    - backend/src/processing/providers/gemini.provider.ts

decisions:
  - "D-01 honored: Live API websocket model value left byte-identical, moved into GEMINI_MODELS.LIVE with a do-not-swap comment"
  - "D-02 honored: sanitizeModelSelection is the migration chokepoint — resolveGeminiModelId runs on every gemini value, not just empty ones"
  - "D-03 honored: soft gate (trim -> legacy remap -> charset guard -> passthrough), gemini-only so custom-provider ids with '/' still work"
  - "SettingsPage useState calls needed explicit <string> generics because GEMINI_MODELS is `as const` (Rule 3 auto-fix)"
  - "Stale-id sweep exclusion extended to tests/unit/geminiModels.test.ts — the plan mandates retired ids as inputs there"

metrics:
  duration: ~10min
  tasks: 3
  files: 18
  completed: 2026-08-27
---

# Quick Task 260827-rzp: Update Gemini Model IDs to Current Generation — Summary

Collapsed ~40 scattered Gemini model-id literals into `electron/constants/geminiModels.ts`, repointed everything at the current generation (`gemini-3.7-flash` default), and added a forward-migration path so users holding retired preview ids in `config.json` are remapped on the next load instead of getting 404s.

## What Was Built

**`electron/constants/geminiModels.ts`** — the single source of truth. Pure data and pure functions, zero imports, so both the Electron main process and the vite-bundled renderer can consume it. It lives under `electron/` specifically to keep `tsconfig.electron.json`'s inferred rootDir at `electron/`; verified by gate (the electron program lists 0 repo `src/` files, so `dist-electron/main.js` remains the `package.json` entry).

Exports: `GEMINI_MODELS` (role-keyed), `GEMINI_SELECTABLE_MODELS`, `GEMINI_MODEL_IDS` (derived), `LEGACY_GEMINI_MODEL_MAP`, `isKnownGeminiModel`, `resolveGeminiModelId`.

**Migration.** `ConfigHelper.sanitizeModelSelection` now delegates its entire gemini branch to `resolveGeminiModelId`, running on every value rather than only empty ones. Since both `loadConfig` and `updateConfig` already funnel through it, existing users get the remap on the next config load and it persists on the next save — no reset, no blank field. Non-gemini providers keep their original trim-and-return path untouched.

**Security (T-QUICK-01).** `resolveGeminiModelId` enforces `/^[A-Za-z0-9._-]+$/` before an id can reach a URL path segment, falling back to the default. Applied at the three `fetch` sites in `GeminiProcessingProvider`, the three in the backend provider, and at `testGeminiKey`. A path-traversal-shaped id is now rejected — covered by unit test.

**Live API isolation (D-01).** `GEMINI_MODELS.LIVE` holds `gemini-2.5-flash-native-audio-preview-12-2025`, byte-identical to what shipped (verified against `001c38e`), carrying a comment that the BidiGenerateContent socket accepts a narrower model family and is not interchangeable with the generateContent roles. The id now appears exactly once in the desktop tree; `DebugLive.tsx` and `GeminiLiveService.ts` both source it from there so they cannot disagree.

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 (RED) | Failing test + constants module | `53f03c3` |
| 1 (GREEN) | ConfigHelper migration + types wiring | `3279bea` |
| 2 | Renderer pickers, wizard defaults, fixtures | `5a6359a` |
| 3 | Service-layer and backend call sites | `2f461f1` |

## Deviations from Plan

**1. [Rule 3 - Blocking] `useState` literal-type narrowing in SettingsPage**
- **Found during:** Task 2, at the `npx tsc -p tsconfig.json --noEmit` gate
- **Issue:** `GEMINI_MODELS` is `as const`, so `useState(GEMINI_MODELS.EXTRACTION)` inferred `SetStateAction<"gemini-3.7-flash">`, producing 15 errors where the component later sets `"custom"` or a user-entered id.
- **Fix:** Explicit `useState<string>(...)` generics on the three model state hooks, with a comment recording why. The plan anticipated this shape of problem for the `MODELS` array and directed widening over casting away the const — same resolution applied here.
- **Files modified:** `src/components/Settings/SettingsPage.tsx`
- **Commit:** `5a6359a`

**2. [Rule 3 - Blocking] Stale-id sweep gate contradicted the plan's own test mandate**
- **Found during:** Task 3, at the stale-id sweep gate
- **Issue:** Task 3's sweep excludes only the two constants modules, but Task 1 mandates that `tests/unit/geminiModels.test.ts` assert on `resolveGeminiModelId("gemini-3-flash-preview")` and four other retired ids. The gate as literally written could never pass alongside the tests the plan requires.
- **Fix:** Extended the exclusion to `tests/unit/geminiModels.test.ts`, preserving the gate's actual intent — no retired id survives at a **runtime call site**. Those literals are regression-test inputs proving the remap works, not call sites. Sweep passes with that exclusion; verified the only other matches repo-wide are the two constants modules.
- **Files modified:** none (verification-only adjustment)
- **Commit:** n/a

**3. [Plan-directed] Dropped the unverified TEXT-modality comment claim**
- **Found during:** Task 3
- **Issue:** The comment above `DEFAULT_MODEL` in `GeminiLiveService.ts` claimed `gemini-live-2.5-flash-preview` supports TEXT response modality natively — an id the constant has never held.
- **Fix:** Per the plan's explicit instruction ("do not restate an assertion you have not verified"), the claim was dropped rather than carried forward. The replacement comment names what the constant actually resolves to, states the family constraint, and points at the Live API docs list.
- **Files modified:** `electron/audio/GeminiLiveService.ts`
- **Commit:** `2f461f1`

## Verification Results

| Gate | Result |
|------|--------|
| `npx vitest run` (full suite) | 8 files / 65 tests passed (baseline 7/52; +1 file, +13 tests) |
| `npx tsc -p tsconfig.electron.json --noEmit` | clean |
| `npx tsc -p tsconfig.json --noEmit` | clean |
| `cd backend && npx tsc --noEmit` | clean |
| rootDir guard (electron program src/ file count) | 0 — `dist-electron/main.js` entry preserved |
| Stale-id sweep (src, electron, tests, backend/src) | no runtime call site matches |
| Live-id uniqueness | exactly 1 occurrence, in the constants module, value unchanged |
| `npx eslint` on all touched files | clean |

The TDD gate sequence is present in git log: `test(...)` at `53f03c3` (failing on the `DEFAULT_CONFIG` cross-boundary assertion, 12/13 passing), then `feat(...)` at `3279bea`. No refactor commit was needed.

Per the execution constraint, `npm run dev` / `build` / `clean` were never invoked — the running dev process and its `dist-electron` output were left untouched.

## Known Stubs

None. Every file touched is wired to live data; no placeholder values were introduced.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes were introduced — the change narrows an existing surface (T-QUICK-01) rather than adding one. No packages were installed.

## Follow-ups

- **Backend mirror is a real duplicate.** `backend/src/processing/providers/gemini.models.ts` duplicates the legacy map and charset guard because `backend/tsconfig.json` pins `rootDir: "./src"`. Both files carry header comments naming the other. Promoting a shared workspace package would remove the duplication — out of scope here.
- **T-QUICK-03 accepted, not fixed.** `AudioProcessor` still logs an API-key prefix alongside the model on every transcription. Pre-existing, dispositioned `accept` in the plan's threat register, left untouched.

## Self-Check: PASSED

Created files verified present on disk: `electron/constants/geminiModels.ts`, `tests/unit/geminiModels.test.ts`, `backend/src/processing/providers/gemini.models.ts`.
Commits verified in git log: `53f03c3`, `3279bea`, `5a6359a`, `2f461f1`.
No file deletions across the four commits (`git diff --diff-filter=D 001c38e HEAD` is empty). Working tree clean apart from the untracked `.planning/quick/` docs the orchestrator owns.
