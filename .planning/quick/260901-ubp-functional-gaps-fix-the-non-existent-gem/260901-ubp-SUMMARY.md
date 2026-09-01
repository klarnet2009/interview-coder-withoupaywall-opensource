---
phase: quick-260901-ubp
plan: 01
subsystem: [gemini-models, audio-capture, window-lifecycle]
tags: [privacy, correctness, migration, ipc, i18n, a11y]
status: complete

requires:
  - electron/constants/geminiModels.ts (existing shared-constants discipline)
  - src/components/ui/confirm-dialog.tsx (from quick-260831-wf4)
  - confirm.quit.* locale keys (from quick-260831-wf4)
provides:
  - electron/constants/audioSource.ts (single source of the audio-source union)
  - electron/quitGuard.ts (DI quit state machine, no electron import)
  - desktop/backend legacy-model-map parity gate
  - RETIRED_UNUSED_KEYS locale debt ledger
affects:
  - Settings model picker (Pro entry id and label changed)
  - Audio source choice on all three surfaces (three options -> two)
  - Wizard readiness semantics (StepTest no longer blocks on application name)
  - Ctrl+Q (now confirmed, was immediate)

tech-stack:
  added: []
  patterns:
    - "Derived-literal trick: the dead model id is produced by suffix removal so a source-scan gate can forbid the literal outright, comments included"
    - "Dependency-injected timers, so a watchdog's branches are unit-testable without an Electron runtime"
    - "Declaration-region scoped source assertions, so a removal's own rationale comment cannot fail the gate that protects it"

key-files:
  created:
    - electron/constants/audioSource.ts
    - electron/quitGuard.ts
    - tests/unit/audioSourceRemoval.test.ts
    - tests/unit/quitGuard.test.ts
  modified:
    - electron/constants/geminiModels.ts
    - backend/src/processing/providers/gemini.models.ts
    - electron/ConfigHelper.ts
    - electron/ipcHandlers.ts
    - electron/preload.ts
    - electron/shortcuts.ts
    - src/App.tsx
    - src/types/index.ts
    - src/types/electron.d.ts
    - src/components/UnifiedPanel/{types,constants,UnifiedPanel,AudioSourceSelector,useAudioCapture}.ts(x)
    - src/components/Settings/{AudioSettings,SettingsPage}.tsx
    - src/components/Wizard/WizardSteps/{StepAudio,StepTest}.tsx
    - tests/unit/{geminiModels,i18nParity}.test.ts
    - tests/unit/a11yNames.test.tsx

decisions:
  - "D-01: Pro stays in the picker under gemini-3.1-pro-preview, labelled (Preview) — the suffix is a retirement date the user is entitled to see"
  - "D-02: legacy remaps keep pointing at the Pro tier; safety comes from the membership invariant, not the target"
  - "D-03: per-application audio REMOVED on the strength of the false label, not the Chromium limitation"
  - "D-04: the quit watchdog waits for an acknowledgement, not for an answer"
  - "D-05: hidden window handled; low opacity deliberately not"
  - "NEW: the dead Pro id is derived by suffix removal rather than written literally, so the source-scan gate can be absolute"

metrics:
  duration: ~20min
  tasks: 3
  files: 22
  tests: 255 -> 301 across 17 -> 19 files
  completed: 2026-09-01
---

# Quick Task 260901-ubp: Functional Gaps Summary

Closed three gaps that shared one shape — code making a promise the runtime silently does not keep: a Gemini Pro model id that does not exist on the API (and a migration path that walked stale configs *into* it), a per-application audio option that captured the whole desktop while naming one app, and an unguarded Ctrl+Q that could end a live interview session with one keystroke.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `a38e455` | Correct the Pro model id, mirror it to the backend, gate the dead ids out |
| 2 | `b630c5c` | Remove per-application audio capture from all five sites |
| 3 | `c72cc15` | Put Ctrl+Q behind a confirmation, hidden window and wedged renderer handled |

## Task 1 — The non-existent Pro model

The picker offered `gemini-3.1-pro` and three legacy remaps targeted it. That id is not in ListModels; the real one is `gemini-3.1-pro-preview`. The migration machinery added to rescue stale configs was itself the thing routing users onto a dead id.

The picker entry is now `gemini-3.1-pro-preview` / **"Gemini 3.1 Pro (Preview)"**. All four pro-era ids — including the one the picker itself offered before this task, which is the population most likely broken right now — remap forward to it.

**The derived-literal decision (not in the plan, added during execution).** The plan asked for two things that collide: add the retired suffix-less id as a legacy map key, *and* make a source scan of `electron/`, `src/` and `backend/src/` fail on any occurrence of that literal, comments included. A literal map key would fail the gate it is supposed to sit behind. Resolved by deriving the key:

```ts
const RETIRED_GEMINI_PRO_MODEL_ID = GEMINI_PRO_MODEL_ID.replace("-preview", "");
```

The runtime map has the entry; the source text never contains the dead string. Both files carry a comment explaining that writing it out breaks the gate. This is why the plan's instruction "write 'the id the picker offered before this task' rather than quoting it" is honoured everywhere, including in this summary's own prose.

**Three new invariants, all previously unenforced:**
- Every value in `LEGACY_GEMINI_MODEL_MAP` must be a member of `GEMINI_MODEL_IDS` or `GEMINI_MODELS`. This is the property that was violated in spirit — a remap target nothing else in the app vouched for.
- The desktop and backend maps must have identical key sets and resolve identically. Both file headers had warned since the duplicate was introduced that they must be updated together; nothing had ever backed that warning. `backend/.../gemini.models.ts` now exports its map so the test compares directly rather than inferring agreement from behaviour.
- Neither non-existent id may appear anywhere under the three source roots, comments included.

**Honest limit:** no static gate can prove an id exists at Google. That is human verification item 3, not a fake automated check.

## Task 2 — Per-application audio removed

### The decision, justified on the false label

On Windows the window id has **no effect on the audio track**. `getUserMedia` with `chromeMediaSource: "desktop"` returns whole-system loopback and still hands back a valid audio track, so nothing errored and nothing warned. The option therefore delivered the entire desktop while naming a single application.

That is what justified removal over a warning. This is not "removed because Chromium doesn't support it" — that framing omits the part that decided it. It is a **privacy misrepresentation in a tool used during job interviews**: the extra audio is the user's other calls, their notifications, their music and anyone else in the room, streamed to Google's Live API by someone who believed they had selected Zoom. A warning line under a list of thirty windows, read mid-interview, converts a silent leak into a disclosed one and changes nothing real. Relabelling it "system audio" was rejected too — a dead control that looks live is worse than no control.

### And the cost, which is real

An earlier draft of the plan called this removal free. It is not, and anyone revisiting this decision must start from the true trade.

The two paths deliver the same **content** through different **acquisition**:

| | Removed path | System Audio |
|---|---|---|
| API | `getUserMedia` + `chromeMediaSource` | `getDisplayMedia` |
| Session start | silent, no dialog | **Windows share picker, every session** |
| Failure mode | none | throws `"No audio track detected. Enable audio sharing and try again."` if the audio box is unticked |

Post-acquisition handling was already identical (`useNativeRate` covered both), so the bytes claim holds. The "costs nothing" claim does not. Every migrated user goes from a silent capture start to a mandatory OS dialog plus a new failure mode, on an always-on-top overlay used while talking to an interviewer.

That is a genuine ergonomic regression, accepted deliberately: **a prompting path that captures what it says beats a silent path that captures more than it says.** Privacy misrepresentation is not tradeable against a click.

> **Awaiting developer verdict — human item 5.** How intrusive the per-session share picker actually feels, and whether the "Enable audio sharing" error is actionable for someone mid-interview who has never seen that dialog. Not yet recorded; this is the item that decides whether the D-03 trade held up in practice.

### What changed

`electron/constants/audioSource.ts` is the new single source of the union (pure data, zero imports, same discipline as `geminiModels.ts` and for the same `rootDir` reason). It carries the rationale once and load-bearingly: the Chromium issue, the fact that the failure is silent, and the Windows Process Loopback path (`ActivateAudioInterfaceAsync` with `AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK`, build 20348+) that a real per-process capture would need.

Removed from all five sites, not the three that draw a window list:
- **`AudioSourceSelector.tsx`** — Applications header, refresh button, search input, app list, and the selected-app trigger label
- **`AudioSettings.tsx`**, **`StepAudio.tsx`** — the application entry and their conditional window-list blocks
- **`SettingsPage.tsx`** — owns `AudioSettings`' state; union, cast, conditional `applicationName` persist and two props. Narrowing the prop union without this file is a type error, not a silent pass.
- **`StepTest.tsx`** — see below

`get-audio-sources` is gone from preload, from the allowed-channel array and from the handler. Leaving the IPC would leave the affordance one line from being re-wired. `get-capture-sources` is untouched — it serves screenshot source selection and is unrelated.

A stale `source: "application"` in config.json now resolves to system in **both** processes: `normalizeAudioSource` runs in `ConfigHelper.sanitizeConfig` and `getAudioConfig` in the main process, and via `toRuntimeAudioSource` in the renderer.

### Wizard readiness change (small, intended, easy to misread later)

`StepTest.tsx` gated readiness on `source !== 'application' || !!applicationName`. Both clauses became vacuous — there is no application source to exclude and no application name to require — so the sub-expression is gone and `audioConfigured` alone carries the check. **The wizard can no longer be blocked on a missing application name.** Intended, not a dropped check.

### Leftover: the quarantined legacy services

There are **two** quarantined modules, not one (the plan named only the first):

- `src/services/AudioCaptureService.legacy.ts` — three-member union (line 6), working `getApplicationAudioStream` (182-196)
- `electron/audio/AudioCaptureService.legacy.ts` — three-member union (line 9), `getAppAudioSources` (86)

Both still contain exactly the capture path this task removed. Both are excluded from both tsconfig projects by `**/*.legacy.ts` and imported by nothing; `electron/audio/index.ts:5-6` already records the quarantine. **Neither was deleted** — deleting a quarantined module is a separate decision with its own blast radius. Instead `audioSourceRemoval.test.ts` asserts the quarantine holds (exclude present in both tsconfigs, no shipped module imports either).

**These are the natural first candidates for a dead-code pass**, named here so they are not later rediscovered as a contradiction of this task.

### Orphaned locale keys — retained as recorded debt

All ten candidate keys were measured to have **zero** remaining source references:

`settings.audio.application`, `settings.audio.applicationDesc`, `settings.audio.selectApp`, `settings.audio.refreshList`, `settings.audio.searchApps`, `settings.audio.noMatches`, `settings.audio.noApps`, `settings.audio.selected`, `a11y.label.refreshAudioSources`, `a11y.label.refreshWindows`

They are **retained**, not deleted. Two are asserted by name in `XAN_LABEL_KEYS`, and deleting all ten drops both locales from 320 to 310 — under `MIN_KEYS = 320` — breaking two standing gates for zero user benefit. They now live in a `RETIRED_UNUSED_KEYS` array in `i18nParity.test.ts` with its own per-locale assertion, converting silent dead weight into recorded debt with a gate.

**Natural first item for a future locale-pruning pass**, which must also retire the `XAN_LABEL_KEYS` entries and lower `MIN_KEYS` in the same change.

## Task 3 — Ctrl+Q behind a confirmation

`electron/shortcuts.ts:127` called `app.quit()` directly. It now calls `quitGuard.requestQuit()` and nothing else.

`electron/quitGuard.ts` holds the whole decision as a pure factory with injected deps — including `setTimer`/`clearTimer` — and no `electron` import. That injection is the point: it is what makes reveal-first, the ack watchdog and the second-press branch testable without an Electron runtime, and what turns this from a vacuous gate into a real one.

### The watchdog waits for an acknowledgement, not for an answer

Both simpler designs are wrong:

- **Armed for the answer** → re-introduces exactly the session loss this task exists to prevent. A busy renderer paints the dialog at t=2.9s and the app quits at t=3s while the user is still reading.
- **Never fires** → makes an always-on-top, taskbar-hidden, screen-capture-evading overlay unquittable by its own primary shortcut, sending the user to Task Manager.

So the renderer acknowledges from **inside its listener** (not from a dialog mount effect), and the watchdog is armed for that. Ack received → disarm, wait indefinitely; the user may think as long as they like. No ack within `QUIT_ACK_TIMEOUT_MS` (3000) → the renderer genuinely is not processing events → quit. This is the only distinction that matters: *renderer is dead* vs *user is thinking*.

**Residual gap, stated rather than hidden:** the ack proves the listener ran, not that the dialog painted. A renderer that runs listeners but cannot paint would swallow Ctrl+Q. The **second-press escape hatch** is the cover for that case, and it also matches what a user does when nothing appears to have happened.

### Other details

- A hidden window (Ctrl+B) is revealed via `toggleMainWindow` **before** the prompt is sent, so the confirmation is never rendered to a screen the user cannot see.
- `quit-app` now routes through `getQuitGuard()?.confirmQuit()` with a fallback to the app-level quit it already called, so the Settings Quit button and the shortcut converge on one path and neither leaves a watchdog armed.
- A `quitConfirmedRef` guards the close path: `ConfirmDialog` calls `onConfirm()` then `onOpenChange(false)`, so a naive handler would fire the cancel IPC immediately after the confirm IPC.
- The dialog is a sibling of the toast list, inside the context provider but outside `<Routes>`, so it is mounted on every screen including the settings dialog, the wizard, the welcome screen and `/debug-live`.
- **No new locale strings.** Reuses `confirm.quit.title|description|confirmLabel` unchanged.

**Opacity is deliberately not handled** (D-05). `adjustOpacity` persists to config.json, so raising it for the prompt would need either a restore path (new failure mode: cancel, crash, opacity stuck) or a silent rewrite of a user setting. At 0.1 the dialog is faint but present, and both the second-press hatch and the ack watchdog still work.

## Deviations from Plan

### 1. [Rule 3 — Blocking] The dead Pro id had to be derived, not written literally

- **Found during:** Task 1
- **Issue:** The plan required the retired suffix-less id as a legacy map key *and* a source scan that fails on any occurrence of that literal under `electron/`, `src/`, `backend/src/`. A literal key fails the gate.
- **Fix:** Derived via `.replace("-preview", "")` in both the desktop and backend modules, with a comment in each explaining why writing it out breaks the gate.
- **Commit:** `a38e455`

### 2. [Rule 3 — Blocking] A third test changed, not the two the plan predicted

- **Found during:** Task 2
- **Issue:** The plan authorised removing exactly two tests (the en/ru "Refresh application list" assertions) and said "the only two tests this task is permitted to remove". It did not anticipate that `a11yNames.test.tsx` also carries a **count ratchet** — `expect(labelKeys.length).toBeGreaterThanOrEqual(33)` over `a11y.label.*` keys referenced in source. Removing two labelled controls necessarily moved that count to 31, failing the ratchet.
- **Fix:** The ratchet was **not** silently decremented. It was retargeted to 31 with a comment naming why, and a **second, stronger test was added alongside it** asserting that the two departed keys are exactly `a11y.label.refreshAudioSources` and `a11y.label.refreshWindows`. A future label deletion therefore cannot hide behind this drop.
- **Net effect:** three `it(` blocks removed (two refresh-control assertions deleted outright; one ratchet renamed because its number changed), and two added in the `AudioSourceSelector` block plus one new named assertion. `a11yNames.test.tsx` is 18 tests before and after.
- **Commit:** `b630c5c`

### 3. [Rule 2 — Missing critical coverage] A second quarantined legacy module exists

- **Found during:** Task 2
- **Issue:** The plan named only `src/services/AudioCaptureService.legacy.ts`. `electron/audio/AudioCaptureService.legacy.ts` also exists and also contains a per-application capture path.
- **Fix:** The quarantine assertion covers **both**. Neither deleted, per the plan's instruction.
- **Commit:** `b630c5c`

## Verification

| Gate | Result |
|------|--------|
| `tsc -p tsconfig.json` | 0 errors |
| `tsc -p tsconfig.electron.json` | 0 errors |
| `tsc -p tsconfig.node.json` | 0 errors |
| `tsc -p backend/tsconfig.json` | diffs clean against baseline (baseline was 0 errors) |
| `npx eslint .` | clean |
| `npx vitest run` | **301 passed / 19 files** (baseline 255 / 17) |
| Dead Pro id scan | PASS (failed before the work — non-vacuous) |
| Non-existent Live id scan | PASS (passed before, must stay passing) |
| `get-audio-sources` scan | PASS |
| Ctrl+Q direct `app.quit()` count | **0** (was 1 — non-vacuous) |
| Locale parity | **PASS, 320 keys** — no keys added or removed |
| `designSystem.test.ts` | all 12 pass; white-opacity population **1126**, above the 1100 floor |

New test files: `audioSourceRemoval.test.ts` (18), `quitGuard.test.ts` (16). Extended in place: `geminiModels.test.ts` (9 → 23), `i18nParity.test.ts` (119 → 121), `a11yNames.test.tsx` (18 → 18).

## Known Stubs

None. No placeholder values, no unwired components, no TODO markers introduced.

## Awaiting Human Verification

All ten items from the plan remain outstanding — none can be expressed as a gate without the gate being a lie. The summary fields below are unfilled **by design** and must be completed by the developer:

1. **Pro model actually answers** — pick `Gemini 3.1 Pro (Preview)`, run one real request. Also judge whether `(Preview)` reads as information or noise.
2. **Legacy rescue** — set `solutionModel` to `gemini-1.5-pro` in config.json, reopen, confirm success. Repeat with the id the picker offered before this task.
3. **ListModels freshness — _date not yet recorded._** Confirm `gemini-3.1-pro-preview` is still exposed and record the date here, so the next person knows how stale the preview-id assumption is. Nothing in the suite can do this.
4. **Audio still works and says what it does** — exactly two options on all three surfaces, no window list anywhere. Judge whether a two-row dropdown now looks unbalanced.
5. **The stale-config path and its acquisition cost — _verdict not yet recorded._** The item that decides whether D-03 held up. See the cost table above.
6. **Ctrl+Q, window visible** — prompt appears, focus on Cancel, Esc cancels, second Ctrl+Q + confirm quits.
7. **Ctrl+Q, window hidden — _verdict not yet recorded._** The case this task exists for. Window must return **with** the confirmation on it. **Open question for the developer: should a cancelled quit leave the window visible, or restore it to hidden?** Currently it stays visible.
8. **Ctrl+Q at minimum opacity — _verdict not yet recorded._** If the confirmation is not legible at 0.1, record it as an **open defect** starting from the D-05 trade above (raising opacity needs a restore path or silently rewrites a user setting) rather than re-deriving it. The second-press hatch is the fallback.
9. **Ctrl+Q twice** — immediate quit on the second press; one press still prompts normally afterwards.
10. **The session is actually protected** — live session + transcript, Ctrl+Q, cancel, session still connected and transcribing. That end-to-end outcome, not the dialog, is the point of the whole task.

## Self-Check: PASSED

Created files verified present: `electron/constants/audioSource.ts`, `electron/quitGuard.ts`, `tests/unit/audioSourceRemoval.test.ts`, `tests/unit/quitGuard.test.ts`.
Commits verified in `git log`: `a38e455`, `b630c5c`, `c72cc15`.
