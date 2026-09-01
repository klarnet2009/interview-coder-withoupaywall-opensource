---
phase: quick-260901-ubp
verified: 2026-09-01T19:45:34Z
status: human_needed
score: 10/12 must-haves verified
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "The Gemini model picker offers only model ids that exist on the live API"
    test: "With a real API key, call ListModels and confirm gemini-3.1-pro-preview is exposed; then pick 'Gemini 3.1 Pro (Preview)' in Settings, save, and run one real request (screenshot + Ctrl+Enter)"
    expected: "A normal answer, not an API error. ListModels contains gemini-3.1-pro-preview."
    why_human: "No static gate can prove an id exists at Google. The plan and the code both say so explicitly; the suite deliberately does not fake this check."
  - truth: "Ctrl+Q surfaces the ConfirmDialog and quitting requires an explicit confirmation"
    test: "Press Ctrl+Q with the window visible; then Ctrl+B to hide and press Ctrl+Q again"
    expected: "The confirm.quit.* dialog paints, focus on Cancel; Escape leaves the app running; hidden window is revealed WITH the dialog on it"
    why_human: "The main-process half of the round trip is behaviourally tested (16 quitGuard tests with a fake clock). The renderer half — quit-requested arriving, quitConfirmOpen flipping, the dialog actually painting — has no test. Only the ConfirmDialog primitive in isolation is tested."
human_verification:
  - test: "ListModels + one real request on Gemini 3.1 Pro (Preview)"
    expected: "gemini-3.1-pro-preview present in ListModels; request returns an answer. Record the date."
    why_human: "Live API existence cannot be gated statically."
  - test: "Set solutionModel to gemini-1.5-pro in config.json (app closed), reopen, run a request. Repeat with the suffix-less pro id the picker offered before this task."
    expected: "Both succeed on the preview Pro id rather than failing."
    why_human: "Requires a real config.json round trip and a live API call."
  - test: "Open the audio dropdown in the live panel, in Settings, and in the setup wizard"
    expected: "Exactly two options (System Audio, Microphone), no Applications section, no search box, no refresh control on any of the three surfaces. Judge whether a two-row dropdown now looks unbalanced."
    why_human: "Visual/layout judgement."
  - test: "Close app, set audioConfig.source to \"application\" in config.json, reopen, start a session; then repeat without ticking the audio box in the Windows share picker"
    expected: "Button reads System with no error; share picker appears at capture start; audio arrives and transcription runs. Without the audio box ticked: 'No audio track detected. Enable audio sharing and try again.'"
    why_human: "This is the item that decides whether the D-03 acquisition trade held up. Requires an OS-level dialog and a live capture."
  - test: "Ctrl+Q with the window visible: Escape, then Ctrl+Q + confirm"
    expected: "Dialog appears with focus on Cancel and Esc/Enter hints; Escape leaves the app running; confirm quits."
    why_human: "Renderer paint and focus behaviour on a real window."
  - test: "Ctrl+B to hide, then Ctrl+Q"
    expected: "Window returns into view WITH the confirmation on it — not a quit, not silence. Escape, then decide whether leaving the window visible after a cancelled quit is the right resting state."
    why_human: "The case this task exists for; also an open design question the plan asks the developer to settle."
  - test: "Ctrl+Alt+[ to minimum opacity, then Ctrl+Q"
    expected: "A faint but legible confirmation. If illegible, press Ctrl+Q again and confirm the escape hatch fires."
    why_human: "Legibility at 0.1 opacity is a human judgement; D-05 records this as a deliberate trade, not an oversight."
  - test: "Ctrl+Q twice in quick succession from a normal visible state, then reopen and press once"
    expected: "Immediate quit on the second press with no further prompt; one press still prompts normally afterwards."
    why_human: "End-to-end shortcut timing on a real window; the unit test covers the guard, not the global shortcut path."
  - test: "Start a live interview session with a transcript running, press Ctrl+Q, cancel"
    expected: "Session still connected and still transcribing."
    why_human: "The end-to-end outcome the whole task exists for; needs a live Gemini session."
  - test: "Judge whether '(Preview)' reads as useful information or as noise in the model dropdown"
    expected: "Developer verdict recorded in the summary."
    why_human: "Copy/UX judgement."
---

# Quick Task 260901-ubp: Functional Gaps Verification Report

**Task Goal:** Close three functional defects — a non-existent Gemini Pro model id (offered in the picker and used as a legacy-migration target), a per-application audio option that actually delivered whole-system audio, and an unguarded Ctrl+Q.
**Verified:** 2026-09-01T19:45:34Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Picker offers only ids that exist on the live API; Pro entry resolves to the confirmed id, labelled as preview | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code side fully verified: `geminiModels.ts:51` → `{ id: GEMINI_PRO_MODEL_ID, name: "Gemini 3.1 Pro (Preview)" }`, wired into `SettingsPage.tsx:24` via `GEMINI_SELECTABLE_MODELS`, asserted by `geminiModels.test.ts` ("offers the pro tier under the preview id that was confirmed to exist"). The "exists on the live API" clause is not statically provable — routed to human item 1/3, exactly as the plan and the code comment both state. |
| 2 | No legacy remap target is a non-existent id; the vouched-for invariant is enforced by a test | ✓ VERIFIED | `LEGACY_GEMINI_MODEL_MAP` invariant test iterates every entry against `GEMINI_MODEL_IDS ∪ Object.values(GEMINI_MODELS)`; passes. Independently confirmed at runtime that the derived retired key is exactly `gemini-3.1-pro` (`node -e` on `"gemini-3.1-pro-preview".replace("-preview","")`), so the runtime map really does rescue that population — not a type-level-only claim. |
| 3 | Desktop and backend maps agree, enforced by a test that imports both | ✓ VERIFIED | `geminiModels.test.ts` imports `LEGACY_GEMINI_MODEL_MAP` and `resolveGeminiModelId` from **both** `electron/constants/geminiModels.ts` and `backend/src/processing/providers/gemini.models.ts`; asserts identical key sets and identical resolution per key. Backend map is now `export`ed (was private). 23/23 pass. |
| 4 | Neither dead id can reappear under `electron/`, `src/`, `backend/src/` — source scan fails the suite | ✓ VERIFIED | Ran both scans independently: whole-token scan `gemini-3\.1-pro[A-Za-z0-9._-]*` yields only `gemini-3.1-pro-preview` (0 non-preview matches); `gemini-live-2\.5-flash-native-audio` yields 0. The in-suite gate uses a negative lookahead `/gemini-3\.1-pro(?!-preview)/` (correct — the dead id is a strict prefix) and self-checks it scans >50 files. |
| 5 | Per-application audio gone from all shipped surfaces; both legacy modules stay quarantined | ✓ VERIFIED | Repo-wide grep for `"application"` / `applicationName` / `applicationId` / `chromeMediaSource` / `getAudioSources` / `get-audio-sources` / `availableApps` / `selectedAppSource` / `appSearchQuery` / `fetchAudioApps` across `electron/` + `src/` (excluding `*.legacy.ts`) returns **exactly one hit** — the rationale comment in `electron/constants/audioSource.ts:20`. Union narrowed to a real 2-member type (`AUDIO_SOURCE_IDS = ["system","microphone"] as const`; `type AudioSource = (typeof AUDIO_SOURCE_IDS)[number]`), so tsc would reject a straggler; all four former private unions now import it. `**/*.legacy.ts` exclude present in both tsconfigs; neither legacy module is imported by anything. |
| 6 | Stale `source: "application"` resolves to System Audio in both processes | ✓ VERIFIED | Main: `ConfigHelper.ts:288` (sanitizeConfig) and `:745` (getAudioConfig) both coerce through `normalizeAudioSource`. Renderer: `toRuntimeAudioSource` in `UnifiedPanel/constants.ts` delegates to the same function, asserted equivalent for 7 inputs. `normalizeAudioSource("application") === "system"` asserted directly. |
| 7 | Ctrl+Q raises the existing `confirm.quit.*` dialog; quitting requires explicit confirmation | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Full round trip present and traced (see Key Link table). Main half is behaviourally tested. Renderer half — `quit-requested` arriving, `setQuitConfirmOpen(true)`, the dialog painting — has no test; only the `ConfirmDialog` primitive in isolation (6 tests). Routed to human items 5/6. |
| 8 | A hidden window is revealed before the prompt is shown | ✓ VERIFIED | `quitGuard.ts` reveals when `!isWindowVisible()` before `sendQuitRequest()`; the test asserts **invocation order** (`revealWindow.mock.invocationCallOrder[0] < sendQuitRequest.mock.invocationCallOrder[0]`), not just that both were called. `revealWindow` is wired to `deps.toggleMainWindow` and only ever called when hidden, so the toggle is unambiguous. |
| 9 | No ack within the timeout → quit anyway; ack received → wait with no deadline | ✓ VERIFIED | Behavioural tests with a hand-rolled fake clock: `advance(QUIT_ACK_TIMEOUT_MS)` with no ack → `quit` called once; `acknowledgePrompt()` then `advance(10 × QUIT_ACK_TIMEOUT_MS)` → `quit` NOT called and `isPending()` still true. A third test asserts the timer is genuinely *disarmed* (`clock.pending()` 1 → 0), not merely ignored. This is the exact failure mode called out for scrutiny and it is closed. |
| 10 | A second Ctrl+Q while pending quits immediately | ✓ VERIFIED | Tested for both the unacked and acked cases, plus a no-double-quit test (second press then `advance(10×)` → still exactly one `quit`). `confirmQuit` also clears state before quitting and leaves no armed watchdog. Zero direct `app.quit()` on the shortcut path — the plan's own gate returns `0` (was 1); `shortcuts.ts:146-151` calls `this.quitGuard.requestQuit()` and nothing else. |
| 11 | en/ru identical key sets ≥320, no empties; orphaned keys retained and recorded | ✓ VERIFIED | Independently measured: `PASS 320 keys`, `en empties: 0`, `ru empties: 0`. All ten `RETIRED_UNUSED_KEYS` independently confirmed at **0** source references, present in both locales, with a per-locale retention assertion. Locale files untouched by the task diff. |
| 12 | Design-system gates unchanged: off-scale ≤75, population ≥1100 | ✓ VERIFIED | `tests/unit/designSystem.test.ts` does **not** appear in the task's diff stat — the ratchets were not touched. `OFF_SCALE_BUDGET = 75`, `POPULATION_FLOOR = 1100`, `MIN_BUTTON_USAGES = 11`, `MIN_IMPORTING_FILES = 5` all unchanged; 12/12 pass including the button-primitive inertness gate and the cascade invariants. |

**Score:** 10/12 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `electron/constants/audioSource.ts` | Single source of the 2-member union, zero imports, load-bearing rationale | ✓ VERIFIED | 71 lines, no imports at all. Exports `AUDIO_SOURCE_IDS`, `AudioSource`, `DEFAULT_AUDIO_SOURCE`, `normalizeAudioSource`. Rationale names electron#18231, the silent-audio-track failure, and the Process Loopback path. Imported by `ConfigHelper.ts`, `src/types/index.ts`, `UnifiedPanel/types.ts`, `UnifiedPanel/constants.ts`, `AudioSettings.tsx`, `SettingsPage.tsx`. |
| `electron/quitGuard.ts` | DI state machine, no electron import | ✓ VERIFIED | 154 lines, zero imports. Seven injected deps including the timer pair. `initQuitGuard`/`getQuitGuard` singleton consumed by `shortcuts.ts:15` and `ipcHandlers.ts:9`. |
| `tests/unit/quitGuard.test.ts` | Covers no-window, hidden, no-ack, acked-then-silent, cancel-then-retry, double-press, confirm | ✓ VERIFIED | 16 tests, all named paths present and passing. Fake clock, not `vi.useFakeTimers` — the guard owns no real clock and neither does the test. |
| `tests/unit/audioSourceRemoval.test.ts` | Declaration-region scoped assertions + quarantine | ✓ VERIFIED | 18 tests. Scopes each union check to a single declaration statement; strips comments before the `chromeMediaSource` scan; asserts both tsconfig excludes and zero importers for **both** legacy modules. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `electron/shortcuts.ts:146` | `quitGuard.requestQuit()` | Ctrl+Q registration body | ✓ WIRED | Body is `runtimeLogger.debug(...)` + `this.quitGuard.requestQuit()`. Gate `grep -c app.quit()` in that region = **0**. |
| `quitGuard.requestQuit` | `mainWindow.webContents.send("quit-requested")` | injected `sendQuitRequest` | ✓ WIRED | `shortcuts.ts:23-28`, destroyed-window guarded. |
| `electron/preload.ts:311` | `src/App.tsx:211` | `onQuitRequested` subscribe/unsubscribe | ✓ WIRED | Effect with `[]` deps returns the unsubscribe. |
| `src/App.tsx:213` | `ipcHandlers.ts:566` | `acknowledgeQuitPrompt()` → `quit-prompt-shown` → `getQuitGuard()?.acknowledgePrompt()` | ✓ WIRED | Ack sent from *inside* the listener, not from a mount effect — tied to "renderer is processing events", which is what the watchdog discriminates on. |
| `src/App.tsx:377` | `ipcHandlers.ts:553` | `quitApp()` → `quit-app` → `getQuitGuard()?.confirmQuit()` | ✓ WIRED | Falls back to `app.quit()` when no guard exists, so the Settings button path is preserved. |
| `src/App.tsx:387` | `ipcHandlers.ts:570` | `cancelQuit()` → `quit-cancelled` → `getQuitGuard()?.cancelQuit()` | ✓ WIRED | Guarded by `quitConfirmedRef` so the confirm→close sequence cannot fire cancel after confirm (`handleQuitOpenChange` returns early and resets the ref). |
| both new invoke channels | ALLOWED array + `registerHandle` | `ipcContract.integration.test.ts` | ✓ WIRED | `"quit-prompt-shown"` and `"quit-cancelled"` at `ipcHandlers.ts:87-88` and registered at 566/570; the contract test derives channels from preload `ipcRenderer.invoke` literals and passes. |
| `electron/constants/geminiModels.ts` | `SettingsPage.tsx:24`, `src/types/index.ts` | `GEMINI_SELECTABLE_MODELS`, `DEFAULT_CONFIG` | ✓ WIRED | Picker spreads the shared list; `DEFAULT_CONFIG` cross-boundary import asserted by test. Module still has zero imports. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SettingsPage.tsx` model dropdown | `GEMINI_SELECTABLE_MODELS` | shared constants module, 4 real entries + "Custom Model..." | Yes | ✓ FLOWING |
| `AudioSourceSelector` / `AudioSettings` / `StepAudio` | `AUDIO_SOURCES` | 2 real entries each, derived from the shared union | Yes | ✓ FLOWING |
| `useAudioCapture.ts` | `stream` | `getDisplayMedia` (system) / `getUserMedia` (microphone); zero-audio-track case throws | Yes | ✓ FLOWING |
| `App.tsx` `ConfirmDialog` | `quitConfirmOpen` | set by `onQuitRequested` IPC listener, cleared by `handleQuitOpenChange` | Yes | ✓ FLOWING |
| `StepTest.tsx` readiness | `audioSourceReady` | hardcoded `true` | N/A — deliberate | ⚠️ Intentional constant, see below |

`StepTest.audioSourceReady = true` is the one hardcoded value in the diff. It is **not** a stub: both clauses of the former guard (`source !== 'application' || !!applicationName`) became vacuous once the union narrowed, and the field is retained only to satisfy the `ReadinessCheck` shape rendered at line 226. Wizard readiness for the two surviving sources is unaffected: `StepAudio` always writes `audioConfig.source` (defaulting to `'system'`) in its update effect and sets `canProceed(true)`, so `audioConfigured` in `StepTest` is true for both sources exactly as before. The semantic change — the wizard can no longer be blocked on a missing application name — is disclosed in the code comment, in the plan and in the summary.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Dead pro id absent as a whole token | `grep -rhoE 'gemini-3\.1-pro[A-Za-z0-9._-]*' … \| grep -vx 'gemini-3.1-pro-preview' \| wc -l` | `0` | ✓ PASS |
| Non-existent Live id absent | `grep -rn 'gemini-live-2\.5-flash-native-audio' electron src backend/src \| wc -l` | `0` | ✓ PASS |
| Derived retired key is correct at runtime | `node -e "'gemini-3.1-pro-preview'.replace('-preview','')"` | `"gemini-3.1-pro"` | ✓ PASS |
| Runtime map rescues the retired id | `vitest run tests/unit/geminiModels.test.ts` (test "rescues the suffix-less pro id…") | 23/23 pass | ✓ PASS |
| No per-app audio affordance anywhere shipped | repo-wide grep, 10 needles, `*.legacy.ts` excluded | 1 hit, the rationale comment only | ✓ PASS |
| Zero direct `app.quit()` on the shortcut path | plan's region-scoped gate | `0` (was 1 pre-task) | ✓ PASS |
| Ack watchdog cannot quit a deliberating user | `vitest run tests/unit/quitGuard.test.ts` | 16/16 pass, incl. acked + `advance(10×)` → no quit | ✓ PASS |
| Locale parity + key floor | inline `node -e` flatten/compare | `PASS 320 keys` | ✓ PASS |
| No empty locale values | inline `node -e` | en 0, ru 0 | ✓ PASS |
| a11y label ratchet is forced, not convenient | replicated `referencedA11yKeys()` in node; diffed against `a38e455~1` | pre 33 → post 31; removed set = exactly `refreshAudioSources`, `refreshWindows`; added: none. Current count is **exactly 31**, so the floor is tight | ✓ PASS |
| Test-block accounting in `a11yNames.test.tsx` | `git diff … \| grep '^[-+]\s*it('` | −2 refresh assertions, −1/+1 renamed ratchet, +2 new = 18 before, 18 after | ✓ PASS |
| tsc app / electron / node / backend | `npx tsc --noEmit -p …` ×4 | all exit 0 | ✓ PASS |
| eslint | `npx eslint .` | exit 0, no output | ✓ PASS |
| Full suite | `npx vitest run` | **301 passed / 19 files** (baseline 255/17) | ✓ PASS |
| designSystem ratchets | `npx vitest run tests/unit/designSystem.test.ts` | 12/12 pass | ✓ PASS |
| ipc contract | `npx vitest run tests/integration/ipcContract.integration.test.ts` | pass | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repo and none are declared by the plan. Step 7c: SKIPPED (no probes).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TODO`/`FIXME`/`XXX`/`TBD`/`HACK`/`PLACEHOLDER` scan across all 25 task-modified files | — | **Zero hits.** No debt markers introduced. |
| `tests/unit/geminiModels.test.ts` | 48 | Test derives the retired id with the same `.replace("-preview","")` expression the source uses | ℹ️ Info | The test cannot independently confirm the literal is `gemini-3.1-pro` — if `.replace` produced a different string, source and test would agree on the wrong value and still pass. Verified externally in this report (see spot-check row 3). Mitigated in the degenerate case: if the Pro id ever loses its `-preview` suffix the derived key collides with the picker id, and the existing test "never remaps an id the picker currently offers" fails. |
| `src/components/Wizard/WizardSteps/StepTest.tsx` | 78 | `const audioSourceReady = true` | ℹ️ Info | Intentional and documented; see Data-Flow Trace. Not a stub. |

### Scrutiny Items

**1 — The derived-literal trick. Sound, or too clever?** Sound. It resolves a real collision the plan created (a literal map key would fail the absolute source scan the same task mandates). The runtime key is correct — independently confirmed to be `gemini-3.1-pro`, not merely asserted at type level — and the retired id really is mapped at runtime, exercised by a passing test that calls `resolveGeminiModelId` on it. The obvious fragility (a future Pro id without a `-preview` suffix makes `.replace` a no-op and produces a self-map) is already caught by the pre-existing "never remaps an id the picker currently offers" assertion. The only residual weakness is the test-side tautology noted above, which is informational rather than a gap.

**2 — Audio removal completeness.** All five sites plus both legacy modules verified. The union genuinely narrowed to two members at the type level, so tsc is a real backstop, and all four previously-private unions now import the shared type. No reachable path can request per-application capture: the preload bridge member, the allowed-channel entry and the `desktopCapturer` handler for windows are all gone; the surviving `get-capture-sources` handler serves screenshot source selection and is correctly untouched. `StepTest.canProceed` losing its application clause does not break wizard readiness for the remaining two sources — `StepAudio` unconditionally writes a source and sets `canProceed(true)`.

**3 — The Ctrl+Q guard.** Round trip complete in code and tested on the main side. The specific failure mode flagged for scrutiny — a watchdog that could quit while the user deliberates — is closed by construction and by test: the watchdog is armed for the ACK, `acknowledgePrompt` disarms it while leaving `pending` set, and a 10× timeout advance after an ack produces no quit. Hidden-window reveal is order-asserted. Second press quits in both the acked and unacked cases without double-quitting. Zero direct `app.quit()` on the shortcut path. The remaining `app.quit()` sites in `main.ts` (single-instance lock, `window-all-closed`, init failure) are unrelated to the shortcut.

**4 — The unauthorised ratchet change (33 → 31).** Genuinely forced, not convenient. Measured against `a38e455~1`: the referenced `a11y.label.*` set was 33 before and is 31 now, and the difference is exactly `a11y.label.refreshAudioSources` and `a11y.label.refreshWindows` — the two controls the audio removal deleted, with **nothing else removed and nothing added**. The current count is exactly 31, so the new floor is as tight as the old one. The compensating assertion is real and present (`'lost exactly the two labels whose controls the audio removal deleted'`, asserting both keys are absent from the referenced set). The deviation was disclosed in the summary rather than buried. Accepted.

**5 — Regression check on the three preceding tasks.** No regressions. `tests/unit/designSystem.test.ts` is absent from the task diff entirely; `OFF_SCALE_BUDGET = 75`, `POPULATION_FLOOR = 1100`, `MIN_BUTTON_USAGES = 11`, `MIN_IMPORTING_FILES = 5` unchanged and 12/12 green, covering the opacity ratchet, the adoption ratchet, the button-primitive inertness gate and the cascade invariants. i18n parity independently measured at 320 keys with zero empty values in both locales. History-deletion confirmations survive (`Solutions.tsx:988` delete-session, `:1000` clear-history, both `destructive`) and the Settings Quit button is still behind its own `ConfirmDialog` with the IPC having no other reachable call site in that file.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUICK-260901-ubp | 260901-ubp-PLAN.md | Close the three functional gaps | ✓ SATISFIED (code side) | 10/12 truths verified; the 2 outstanding are runtime/live-API claims routed to human verification by design. |

### Human Verification Required

Ten items, all carried from the plan and none yet performed. They are listed in full in the frontmatter. The two that gate the remaining truths are:

1. **ListModels + one real Pro request** — the only check that proves `gemini-3.1-pro-preview` exists. Record the date, since it is the freshness marker for the whole preview-id assumption.
2. **Ctrl+Q with the window visible, and again with it hidden** — the only check that proves the renderer half of the round trip paints. The main half is already behaviourally proven.

The remaining eight (stale-config acquisition cost, opacity legibility, second-press timing, two-row dropdown balance, cancelled-quit resting state, live-session protection, `(Preview)` copy judgement, legacy model rescue) are the plan's own list and are unchanged.

### Gaps Summary

No gaps. Every automated gate the plan specified passes, and each was re-run independently rather than taken from the summary. Both dead-id scans, the 10-needle audio scan, the shortcut-path `app.quit()` gate, locale parity, the a11y ratchet derivation, four typechecks, eslint and the full 301-test suite were executed in this verification, not read from the report. The two remaining truths are unverifiable without a live API key and a running window — which the plan anticipated and deliberately did not fake.

Three claims in the SUMMARY were checked adversarially and all held: the derived key really is `gemini-3.1-pro` at runtime (not just at type level); the 33→31 ratchet drop really is forced by exactly the two named keys and nothing else; and `designSystem.test.ts` really was untouched, so none of the three preceding tasks' gates were quietly loosened to make this one green.

---

_Verified: 2026-09-01T19:45:34Z_
_Verifier: Claude (gsd-verifier)_
