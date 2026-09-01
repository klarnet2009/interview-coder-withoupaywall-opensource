---
phase: quick-260901-ubp
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QUICK-260901-ubp]
files_modified:
  - electron/constants/geminiModels.ts
  - electron/constants/audioSource.ts
  - electron/quitGuard.ts
  - electron/ConfigHelper.ts
  - electron/shortcuts.ts
  - electron/ipcHandlers.ts
  - electron/preload.ts
  - backend/src/processing/providers/gemini.models.ts
  - src/App.tsx
  - src/types/index.ts
  - src/types/electron.d.ts
  - src/components/UnifiedPanel/types.ts
  - src/components/UnifiedPanel/constants.ts
  - src/components/UnifiedPanel/UnifiedPanel.tsx
  - src/components/UnifiedPanel/AudioSourceSelector.tsx
  - src/components/UnifiedPanel/useAudioCapture.ts
  - src/components/Settings/AudioSettings.tsx
  - src/components/Settings/SettingsPage.tsx
  - src/components/Wizard/WizardSteps/StepAudio.tsx
  - src/components/Wizard/WizardSteps/StepTest.tsx
  - tests/unit/geminiModels.test.ts
  - tests/unit/audioSourceRemoval.test.ts
  - tests/unit/quitGuard.test.ts
  - tests/unit/a11yNames.test.tsx
  - tests/unit/i18nParity.test.ts

must_haves:
  truths:
    - "The Gemini model picker offers only model ids that exist on the live API. The Pro entry resolves to the id that was confirmed by a real generateContent call, and it is labelled so the user can see it is a preview id."
    - "No user with a legacy model id persisted in config.json is migrated onto an id that does not exist. Every legacy remap target is an id the app itself offers or defaults to, and that property is enforced by a test rather than by care."
    - "The desktop constants module and the backend mirror agree on every legacy remap, enforced by a test that imports both — the header comment in each file has warned about this desync for two tasks and has never been backed by a gate."
    - "The suffix-less Pro id and the non-existent native-audio Live id cannot reappear anywhere under electron/, src/ or backend/src/ — a source scan fails the suite if either does."
    - "The shipped capture path no longer offers per-application audio anywhere: not in the live panel dropdown, not in Settings, not in the setup wizard. It offers System Audio and Microphone, both of which do exactly what their label says on Windows. The quarantined src/services/AudioCaptureService.legacy.ts still contains such a path; it is excluded from both tsconfig projects by the **/*.legacy.ts exclude and imported by nothing, and it stays quarantined rather than being silently resurrected."
    - "A user whose config.json still holds source: \"application\" is resolved to System Audio rather than left pointing at a removed option. The captured content is what they were already receiving; the acquisition path is not — System Audio goes through getDisplayMedia, so they now meet the Windows share picker once per session where the removed path started silently. That cost is accepted, not hidden."
    - "Ctrl+Q no longer quits without asking. It surfaces the existing ConfirmDialog with the existing confirm.quit.* strings, and quitting requires an explicit confirmation."
    - "If the window is hidden when Ctrl+Q is pressed, the window is revealed first, so the confirmation is never shown to a screen the user cannot see."
    - "If the renderer never acknowledges the prompt within the ack timeout, the app quits anyway — a wedged renderer can never make an always-on-top, taskbar-hidden overlay unquittable. A renderer that DOES acknowledge is then waited on indefinitely, so a user who is merely thinking is never timed out."
    - "Pressing Ctrl+Q a second time while a confirmation is pending quits immediately."
    - "en.json and ru.json still have identical key sets at or above 320 keys with no empty values; the keys orphaned by the audio removal are retained and recorded as deliberate debt rather than silently deleted or silently left."
    - "The design-system gates still pass unchanged: off-scale white-opacity applications stay at or below 75 and the total population stays at or above the 1100 floor."
  artifacts:
    - electron/constants/audioSource.ts
    - electron/quitGuard.ts
    - tests/unit/quitGuard.test.ts
    - tests/unit/audioSourceRemoval.test.ts
  key_links:
    - "electron/constants/geminiModels.ts is imported by BOTH src/components/Settings/SettingsPage.tsx (the picker, via GEMINI_SELECTABLE_MODELS) and src/types/index.ts (DEFAULT_CONFIG). It must stay pure data + pure functions with zero imports — the file header explains why (tsconfig.electron.json has no explicit rootDir; an import from src/ would move the inferred common root and break the package.json main entry)."
    - "electron/constants/audioSource.ts is a NEW module following the exact same rule and for the same reason. It is the single source of the audio-source union, consumed by electron/ConfigHelper.ts, src/types/index.ts, src/components/UnifiedPanel/types.ts and src/components/Settings/AudioSettings.tsx (which currently declares its own private copy of the union at line 5)."
    - "electron/quitGuard.ts holds the quit state machine as a pure factory with injected deps (no electron import), so the watchdog, the reveal-first branch and the second-press branch are unit-testable. ShortcutsHelper constructs the singleton from IShortcutsHelperDeps (getMainWindow / isVisible / toggleMainWindow, electron/main.ts:151-152); ipcHandlers reads the same singleton."
    - "Ctrl+Q round trip: electron/shortcuts.ts:126 -> quitGuard.requestQuit() -> mainWindow.webContents.send(\"quit-requested\") -> preload onQuitRequested -> src/App.tsx sets quitConfirmOpen AND immediately invokes acknowledgeQuitPrompt() -> quitGuard clears the ack watchdog -> user answers -> quitApp() or cancelQuit()."
    - "tests/integration/ipcContract.integration.test.ts derives channels from ipcRenderer.invoke() literals in electron/preload.ts and asserts each has a registerHandle. Both new invoke channels must be added to the ALLOWED channel array near the top of electron/ipcHandlers.ts AND registered, or that test fails."
    - "tests/unit/a11yNames.test.tsx renders AudioSourceSelector directly with an explicit prop object (line 144) and asserts the 'Refresh application list' control exists in en and ru. Removing the application section removes that control; both assertions and the prop object must be updated in the same change."
---

<objective>
Close three functional gaps found in the audit, all of which share one shape: the code makes a promise the runtime does not keep, and does so silently.

Purpose. A model id that does not exist fails at the first API call, and the legacy-remap machinery that was added to rescue stale configs is currently what walks users INTO the dead id. A window picker labelled "capture audio from Zoom" that actually returns whole-system loopback is not a quality bug during a job interview — it streams the candidate's music, notifications and any other call to Google's Live API without telling them. And Ctrl+Q is now the only remaining unguarded way to lose a live interview session, deliberately deferred by quick-260831-wf4 because it needs a main-to-renderer round trip.

Output: the correct Pro model id everywhere including the backend mirror plus a gate the dead id cannot pass; per-application audio removed from the three surfaces that offer it and the two more that carry its state, with the removal reasoned in code so it is not re-added; and a Ctrl+Q confirmation whose interesting part — the hidden window and the unresponsive renderer — is handled explicitly and tested.
</objective>

<execution_context>
@C:/Users/klarn/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/klarn/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.planning/quick/260831-wf4-fix-ux-blockers-separate-quit-from-save-/260831-wf4-PLAN.md
@src/components/ui/confirm-dialog.tsx
@electron/constants/geminiModels.ts
@tests/unit/i18nParity.test.ts
</context>

<measured_facts>
These were measured against the live API and the current tree before planning. Re-confirm the code positions before editing; do not re-probe the API.

- The real Pro id is `gemini-3.1-pro-preview`, confirmed by a generateContent call that returned "ok". The suffix-less form does not exist in ListModels.
- `gemini-live-2.5-flash-native-audio` does not exist. Never introduce it. `GEMINI_MODELS.LIVE` is currently `gemini-2.5-flash-native-audio-preview-12-2025`, which does exist — leave it alone.
- The dead id appears at `electron/constants/geminiModels.ts:51,66,68,69` and `backend/src/processing/providers/gemini.models.ts:21,23,24`. Lines 66/68/69 and 21/23/24 are legacy remap TARGETS, so the migration path is what breaks stale configs.
- The per-app audio promise is rendered in THREE places, not one: `src/components/UnifiedPanel/AudioSourceSelector.tsx` (list at 190-222), `src/components/Settings/AudioSettings.tsx` (block at 227-320), `src/components/Wizard/WizardSteps/StepAudio.tsx` (block at 239-345). All three fetch via `window.electronAPI.getAudioSources()` -> `electron/ipcHandlers.ts:223` -> `desktopCapturer.getSources({types:['window']})`.
- TWO further files carry the state behind those renderers and are easy to miss because neither draws a window list. `src/components/Settings/SettingsPage.tsx` owns the union (161), the cast (225), the conditional `applicationName` persist (416) and the props into `AudioSettings` (676-677). `src/components/Wizard/WizardSteps/StepTest.tsx:73-74` gates wizard readiness on `source !== 'application' || !!applicationName`. Five sites total.
- Chromium does not implement per-window audio on Windows (electron/electron#18231, open since 2019, closed without a fix). `getUserMedia` with `chromeMediaSource: "desktop"` returns whole-system loopback and an audio track IS returned, so nothing errors. A real fix needs the Windows Process Loopback API (`ActivateAudioInterfaceAsync` with `AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK`, Windows 10 build 20348+) through a native addon or helper process.
- `electron/shortcuts.ts:126-129` registers Ctrl+Q and calls `app.quit()` directly. `IShortcutsHelperDeps` exposes `getMainWindow`, `isVisible` and `toggleMainWindow` (`electron/main.ts:151-152`).
- `preload.quitApp()` -> `ipcHandlers.ts:569` -> `app.quit()` already exists and is already behind a ConfirmDialog in SettingsPage. The `confirm.quit.title|description|confirmLabel` i18n keys already exist in both locales. This task adds NO new user-facing strings.
</measured_facts>

<decisions>

**D-01 — The picker keeps a Pro entry, using the preview id, labelled as preview.**

The alternative considered was dropping Pro from the picker entirely on the grounds that a `-preview` id is impermanent by construction and the app has already been burned once by exactly that (`gemini-3-pro-preview` retired, and its replacement was wrong). Rejected: Pro is the only non-Flash tier offered, and for a hard algorithmic question the reasoning depth is a real capability, not a nicety. Removing it would be scope reduction disguised as hygiene.

So the entry stays, with id `gemini-3.1-pro-preview` and name `Gemini 3.1 Pro (Preview)`. The `(Preview)` is not decoration: the picker value is persisted to config.json and used for months, so the user is entitled to know the id has a retirement date. Model names in `GEMINI_SELECTABLE_MODELS` are product proper nouns and are not routed through i18n today; this one follows that existing convention, which is why this task adds no locale keys.

**D-02 — Legacy remaps keep pointing at the Pro tier, and gain a gate.**

The pro-era ids (`gemini-3-pro-preview`, `gemini-2.0-pro-exp-02-05`, `gemini-1.5-pro`) plus the newly-dead suffix-less id all remap to `gemini-3.1-pro-preview`. Remapping them to the Flash default was considered — it is the id most certain to keep existing — and rejected because a silent tier downgrade is its own dishonesty.

What makes this safe is the invariant, not the target: **every value in `LEGACY_GEMINI_MODEL_MAP` must be a member of `GEMINI_MODEL_IDS` or of `GEMINI_MODELS`**. That is the property that was violated in spirit here — a remap target that nothing else in the app vouches for. Together with the two source-scan gates and the desktop/backend parity gate, whoever next rotates the picker id cannot leave the map pointing at a value the app no longer offers.

Be honest about the limit: no static gate can prove an id exists at Google. That is why re-running ListModels is a human_verification item and not a fake automated check.

**D-03 — Per-application audio is REMOVED, not relabelled and not warned about.**

Option (c), warn at the point of choice, was rejected. The failure is that the app streams the user's entire desktop audio — private calls, notifications, a second interview — to Google's Live API. A warning line under a list of thirty windows, read by someone who is mid-interview, converts a silent privacy leak into a disclosed one and practically changes nothing.

Option (b), keep the picker and relabel it as system audio, was rejected because on Windows the `chromeMediaSourceId` has no effect on the audio track at all. The window choice would affect nothing real, and the brief explicitly forbids keeping it unless it does. A dead control that looks live is worse than no control.

Option (a), removal, is chosen — and the deciding fact is the **false label**, not a free lunch. The window id has no effect on the audio track, so the option delivers system audio while naming a single application. That is the defect: the user believes they are capturing Zoom and are in fact shipping their whole desktop — other calls, notifications, music — to Google's Live API, mid-interview.

Be precise about what removal costs, because the tidy version of this argument is wrong. The two paths deliver the same *content* through different *acquisition*. `useAudioCapture.ts:63-82` acquires the application stream via `getUserMedia` with `chromeMediaSource: "desktop"` — silent, no dialog. `useAudioCapture.ts:83-91` acquires system audio via `getDisplayMedia({video:true,audio:true})`, which raises the Windows share picker **every session** and throws "No audio track detected. Enable audio sharing and try again." if the user does not tick the audio checkbox. Post-acquisition handling is identical (`useNativeRate` at line 105 already covers both), so the bytes claim holds; the "costs nothing" claim does not.

So the real trade is: every migrated user goes from a silent capture start to a mandatory OS dialog plus a new failure mode, on an always-on-top overlay used while talking to an interviewer. That is a genuine regression in ergonomics, and it is accepted deliberately — a prompting path that captures what it says beats a silent path that captures more than it says. Privacy misrepresentation is not tradeable against a click. Do not write this up as free.

The Chromium limitation and the Process Loopback path get a comment at the removal site so the next person does not re-add it from good intentions.

**D-04 — The Ctrl+Q watchdog waits for an ACK, not for an answer.**

Two obvious designs are both wrong. A watchdog that quits if the *answer* does not arrive in N seconds re-introduces exactly the session loss this task exists to prevent — a busy renderer paints the dialog at t=2.9s and the app quits at t=3s while the user is still reading. A watchdog that never fires makes an always-on-top, taskbar-hidden, screen-capture-evading overlay unquittable by its own primary shortcut, sending the user to Task Manager.

The renderer therefore acknowledges the moment its listener fires, and the watchdog is armed for the **acknowledgement**. Ack received -> disarm and wait indefinitely; the user may think for as long as they like. No ack within `QUIT_ACK_TIMEOUT_MS` -> the renderer is genuinely not processing events -> quit. This distinguishes "renderer is dead" from "user is thinking", which is the only distinction that matters.

Stated honestly: the ack proves the listener ran, not that the dialog painted. A renderer that runs listeners but cannot paint would swallow Ctrl+Q. The second-press escape hatch (press Ctrl+Q again while pending -> quit immediately) is the cover for that residual case, and it also matches what a user does when nothing appears to have happened.

**D-05 — Hidden window is handled; low opacity is deliberately not.**

Ctrl+B hides the window, and `deps.isVisible()` reports it. On a quit request with the window hidden, the guard reveals it first (via `toggleMainWindow`), so the confirmation is never rendered off-screen.

Opacity is the sibling case — Ctrl+Alt+[ can drive the window to 0.1 — and it is deliberately left alone. `adjustOpacity` persists to config.json, so raising it for the prompt would either need a restore path (a new failure mode: cancel, crash, opacity stuck) or would silently rewrite a user setting. At 0.1 the dialog is faint but present, and the second-press escape hatch plus the ack watchdog both still work. This is a recorded trade, not an oversight; it goes in human_verification so a person judges whether faint is legible enough.

</decisions>

<tasks>

<!-- planner-discipline-allow: gemini-3.1-pro -->
<!-- planner-discipline-allow: gemini-live-2.5-flash-native-audio -->

<task type="auto" tdd="true">
  <name>Task 1: Correct the Pro model id everywhere, mirror it to the backend, and gate the dead ids out</name>
  <files>electron/constants/geminiModels.ts, backend/src/processing/providers/gemini.models.ts, tests/unit/geminiModels.test.ts</files>
  <precondition>Before editing any backend file, capture the backend typecheck baseline to a scratch file so the comparison is mechanical rather than a human diff of two console dumps: `npx tsc --noEmit -p backend/tsconfig.json > /tmp/ubp-backend-baseline.txt 2>&1 || true`. The backend project is not part of the current three-typecheck gate and may already have errors; only NEW errors relative to this captured file count as a failure.</precondition>
  <behavior>
    - `resolveGeminiModelId("gemini-3-pro-preview")` returns `"gemini-3.1-pro-preview"`.
    - `resolveGeminiModelId("gemini-2.0-pro-exp-02-05")` returns `"gemini-3.1-pro-preview"`.
    - `resolveGeminiModelId("gemini-1.5-pro")` returns `"gemini-3.1-pro-preview"`.
    - `resolveGeminiModelId("gemini-3.1-pro")` returns `"gemini-3.1-pro-preview"` — the users who already picked Pro from the settings dropdown have the dead id persisted right now and are the ones this rescues.
    - `resolveGeminiModelId("  gemini-3.1-pro-preview  ")` returns `"gemini-3.1-pro-preview"` (existing trim test, retargeted).
    - Every value of `LEGACY_GEMINI_MODEL_MAP` is a member of `GEMINI_MODEL_IDS` or of `Object.values(GEMINI_MODELS)`.
    - For every key in the desktop `LEGACY_GEMINI_MODEL_MAP`, the backend `resolveGeminiModelId` returns the same string as the desktop one, and the two maps have identical key sets.
    - Scanning every `.ts`/`.tsx` under `electron/`, `src/` and `backend/src/`, the regex `/gemini-3\.1-pro(?!-preview)/` matches nothing and `/gemini-live-2\.5-flash-native-audio/` matches nothing.
    - The existing pass-through, charset-guard, empty/null and `GEMINI_SELECTABLE_MODELS` tests keep passing unchanged.
  </behavior>
  <action>
Retarget the Pro entry. In `electron/constants/geminiModels.ts`, the `GEMINI_SELECTABLE_MODELS` entry at line 51 becomes id `gemini-3.1-pro-preview`, name `Gemini 3.1 Pro (Preview)` per D-01. The three legacy remap targets at lines 66, 68 and 69 become the same preview id, and a fourth entry is added remapping the now-retired suffix-less form forward to it per D-02.

Do NOT write the retired suffix-less form into any comment, docstring or prose anywhere under `electron/`, `src/` or `backend/src/`. It appears in exactly one place — as a key in the legacy map — and the source-scan gate below counts comments. If you want to explain the entry, write "the id the picker offered before this task" rather than quoting it.

The regex is a lookahead for a reason: the retired id is a strict prefix of the correct one, so a plain substring search reports every correct usage as a violation. Build the needle in the test rather than trusting a naive `includes`.

Mirror the same four map entries into `backend/src/processing/providers/gemini.models.ts` (lines 21, 23, 24 plus the new one) and add `export` to its `LEGACY_GEMINI_MODEL_MAP` so the parity test can compare the two maps directly instead of inferring agreement from behaviour alone. Both file headers already state the two must be updated together; this task is what finally backs that with a test.

Extend `tests/unit/geminiModels.test.ts` per `<behavior>`. Retarget the three existing remap assertions at lines 19, 27-28 and the trim assertion at line 50. Add the remap-target membership invariant, the desktop/backend parity assertions, and the dead-id source scan. Scan only `electron/`, `src/` and `backend/src/` — the test file itself lives under `tests/`, outside all three roots, so the literals it carries cannot self-match. Recurse directories, skip `node_modules`, `dist`, `dist-electron` and `backend/dist`.

The backend module is a plain ESM `export` in TypeScript and `tests/` is in no tsconfig `include`, so importing it from vitest typechecks nothing and resolves normally. If the import fails, fix the import — do not weaken the gate to a text comparison.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/geminiModels.test.ts</automated>
    <automated>test -z "$(grep -rhoE 'gemini-3\.1-pro[A-Za-z0-9._-]*' --include=*.ts --include=*.tsx electron src backend/src | sort -u | grep -vx 'gemini-3.1-pro-preview')"</automated>
    <automated>test -z "$(grep -rhoE 'gemini-live-2\.5-flash-native-audio' --include=*.ts --include=*.tsx electron src backend/src)"</automated>
    <automated>npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.electron.json</automated>
    <automated>npx tsc --noEmit -p backend/tsconfig.json > /tmp/ubp-backend-after.txt 2>&1 || true; diff /tmp/ubp-backend-baseline.txt /tmp/ubp-backend-after.txt</automated>
  </verify>
  <done>The settings picker offers `gemini-3.1-pro-preview` labelled `Gemini 3.1 Pro (Preview)`. All four pro-era legacy ids, including the one the picker itself offered before this task, remap forward to it. The desktop and backend maps are identical and a test proves it. The two non-existent ids match nowhere under `electron/`, `src/` or `backend/src/`, comments included. The backend typecheck output diffs clean against the baseline captured in the precondition.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Remove per-application audio capture from all five sites that carry it</name>
  <files>electron/constants/audioSource.ts, electron/ConfigHelper.ts, electron/preload.ts, electron/ipcHandlers.ts, src/types/index.ts, src/types/electron.d.ts, src/components/UnifiedPanel/types.ts, src/components/UnifiedPanel/constants.ts, src/components/UnifiedPanel/UnifiedPanel.tsx, src/components/UnifiedPanel/AudioSourceSelector.tsx, src/components/UnifiedPanel/useAudioCapture.ts, src/components/Settings/AudioSettings.tsx, src/components/Settings/SettingsPage.tsx, src/components/Wizard/WizardSteps/StepAudio.tsx, src/components/Wizard/WizardSteps/StepTest.tsx, tests/unit/audioSourceRemoval.test.ts, tests/unit/a11yNames.test.tsx, tests/unit/i18nParity.test.ts</files>
  <behavior>
    - `normalizeAudioSource("microphone")` returns `"microphone"`; `normalizeAudioSource("system")` returns `"system"`.
    - `normalizeAudioSource("application")` returns `"system"` — this is the migration path for every config.json already in the wild.
    - `normalizeAudioSource(undefined)`, `(null)`, `(42)` and `("nonsense")` all return `"system"`.
    - `AUDIO_SOURCE_IDS` has exactly two members and contains no application member.
    - `toRuntimeAudioSource` delegates to `normalizeAudioSource` and agrees with it on all of the above.
    - Reading the `export type AudioSourceType = ...` declaration in `src/components/UnifiedPanel/types.ts`, the `export type AudioSource = ...` declaration in `src/types/index.ts`, and the `source:` line of the `AudioConfig` interface in `electron/ConfigHelper.ts`: none of the three declares an application member. Match the declaration region specifically, not the whole file, so the removal-rationale comments cannot invalidate the check.
    - `electron/preload.ts` contains no `ipcRenderer.invoke("get-audio-sources")`.
    - `src/components/UnifiedPanel/useAudioCapture.ts`, with comments stripped, contains no `chromeMediaSource`.
  </behavior>
  <action>
Create `electron/constants/audioSource.ts` as the single source of the audio-source union, following the exact discipline documented in the header of `geminiModels.ts`: pure data and pure functions, zero imports, no `electron`, no node builtins — it is imported by both processes and moving the inferred common root would break the `main` entry in package.json. Export `AUDIO_SOURCE_IDS` (system, microphone), the `AudioSource` type derived from it, and `normalizeAudioSource(value: unknown): AudioSource` defaulting to system.

Put the rationale comment in this file, once, and make it load-bearing: Chromium does not implement per-window audio capture on Windows (electron/electron#18231, open since 2019 and closed without a fix); `getUserMedia` with `chromeMediaSource: "desktop"` returns whole-system loopback and still hands back an audio track, so the failure is silent; a real per-process capture needs the Windows Process Loopback API (`ActivateAudioInterfaceAsync` with `AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK`, Windows 10 build 20348+) via a native addon or helper process. State plainly that adding an application member back to this union without that native path re-introduces a privacy defect, because the app is used during interviews and the extra audio is the user's other calls, notifications and music.

Route every union through it. `electron/ConfigHelper.ts` `AudioConfig.source`, `src/types/index.ts` `AudioSource`, `src/components/UnifiedPanel/types.ts` `AudioSourceType`, and the private duplicate union at `src/components/Settings/AudioSettings.tsx:5` all import the shared type instead of re-declaring it. Drop `applicationName` from both `AudioConfig` declarations. In `ConfigHelper.getAudioConfig()` and in the `sanitizeConfig` path near line 283, coerce the loaded `source` through `normalizeAudioSource` so a stale persisted value is repaired in the main process too, not only in the renderer.

Then let the compiler drive the removal. Run `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.electron.json` and work the error list; narrowing the union surfaces every straggler and is a more reliable guide than a file checklist. Expect at minimum:

- `AudioSourceSelector.tsx`: delete the Applications header, the refresh button, the search input and the app list (roughly 147-223), and the `selectedAppSource` branch of the trigger label. Drop the now-unused props `fetchAudioApps`, `selectedAppSource`, `availableApps`, `isLoadingApps`, `appSearchQuery`, `setAppSearchQuery`, and narrow `handleSourceSelect` to `(source: AudioSourceType) => void | Promise<void>`. Remove the icon imports that go unused or eslint will fail.
- `UnifiedPanel.tsx`: delete `selectedAppSource`, `availableApps`, `isLoadingApps`, `appSearchQuery` state and `fetchAudioApps`; simplify `handleSourceSelect` and the persisted `audioConfig` write; simplify the restart call near line 741; drop the applicationId/applicationName restore in the config load effect.
- `useAudioCapture.ts`: delete the desktop-capture branch and the `appSourceId` parameter; `useNativeRate` becomes `source === "system"`.
- `AudioSettings.tsx` and `StepAudio.tsx`: drop the application entry from their `AUDIO_SOURCES` arrays and delete the conditional window-list blocks, their state, and their fetch functions. In `StepAudio` the `canProceed` guard at line 61 collapses to unconditionally true.
- `SettingsPage.tsx` — the owner of `AudioSettings`' state, and easy to miss because it renders no window list itself. Its `useState` union at line 161 and the cast at line 225 collapse to the two-member shared type; the conditional `applicationName` write at line 416 and the `applicationName` state at line 162 go away; and the `applicationName` / `onApplicationChange` props passed at lines 676-677 disappear with the props they feed. Narrowing `AudioSettings`' prop union without this file is a type error, not a silent pass.
- `StepTest.tsx:73-74`: `audioSourceReady` currently gates readiness on `source !== 'application' || !!applicationName`. Both clauses become vacuous, so the whole sub-expression is deleted and `audioConfigured` alone carries the check. This is a real semantic change to wizard readiness — the wizard can no longer be blocked on a missing application name — and it is intended.
- `electron/preload.ts`, `electron/ipcHandlers.ts` (the handler at 223 and its entry in the allowed-channel array at line 77), `src/types/electron.d.ts:149`: remove `getAudioSources` / `get-audio-sources` entirely. Removing the IPC is the point — leaving it in place leaves the affordance one line away from being re-wired. Leave `get-capture-sources` alone; it serves screenshot source selection and is unrelated.

Handle the orphaned locale keys deliberately. After the deletions, grep the remaining sources for each of `settings.audio.application`, `settings.audio.applicationDesc`, `settings.audio.selectApp`, `settings.audio.refreshList`, `settings.audio.searchApps`, `settings.audio.noMatches`, `settings.audio.noApps`, `settings.audio.selected`, `a11y.label.refreshAudioSources`, `a11y.label.refreshWindows` and record which now have **zero** remaining references in the source. That orphan set — the keys with no references left, not the survivors — is what goes into `RETIRED_UNUSED_KEYS`. Do NOT delete them from the locale files: two are asserted by name in the `XAN_LABEL_KEYS` list and deleting any of them drops the count under `MIN_KEYS = 320`, breaking two standing gates for zero user benefit. Instead add a `RETIRED_UNUSED_KEYS` array to `tests/unit/i18nParity.test.ts` holding exactly that measured orphan set, with a comment stating they were orphaned by this task's per-application audio removal and are retained so the count floor and the accessible-name assertions stay meaningful. Assert as one test per locale that all of them are still present. This converts silent dead weight into recorded debt with its own gate.

Update `tests/unit/a11yNames.test.tsx`: rewrite `renderAudioSourceSelector` (line 144) to the new prop set and delete the two 'Refresh application list' assertions, whose control no longer exists. These are the ONLY two tests this task is permitted to remove. The three remaining `AudioSourceSelector` assertions — the listbox popup state, the expanded state, and the deliberately-unlabelled text-bearing trigger — must keep passing.

Leave `src/services/AudioCaptureService.legacy.ts` in place but do not let the plan overclaim against it. It still declares its own three-member union (line 6) and a working `getApplicationAudioStream` (lines 182-196), and it is dead: excluded from both tsconfig projects by the `**/*.legacy.ts` exclude, and imported by nothing — `electron/audio/index.ts:5-6` already records the quarantine. Do NOT wire it into the shared union and do NOT delete it in this task; deleting a quarantined module is a separate decision with its own blast radius. Instead assert the quarantine holds: no shipped module imports it. Record it in the summary as the natural first candidate for a future dead-code pass.

Create `tests/unit/audioSourceRemoval.test.ts` per `<behavior>`. Scope every source assertion to the declaration region it is about, never to the whole file: this file's own rationale comments mention the removed concept by name, and a whole-file substring scan would fail on its own explanation. Strip comments before the `chromeMediaSource` scan for the same reason.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/audioSourceRemoval.test.ts tests/unit/a11yNames.test.tsx tests/unit/i18nParity.test.ts</automated>
    <automated>npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.electron.json && npx tsc --noEmit -p tsconfig.node.json</automated>
    <automated>npx vitest run tests/unit/designSystem.test.ts</automated>
    <automated>test -z "$(grep -rhoE 'get-audio-sources|getAudioSources' --include=*.ts --include=*.tsx electron src)"</automated>
    <automated>npx eslint .</automated>
  </verify>
  <done>The audio source choice is System Audio or Microphone in the live panel, in Settings and in the setup wizard, with no window list on any of the three, and no residual application state in `SettingsPage.tsx` or `StepTest.tsx`. `get-audio-sources` exists in neither preload nor ipcHandlers. A config.json holding the removed value resolves to system in both processes. `designSystem.test.ts` still passes — if the white-opacity population dropped below the 1100 floor, STOP and report the measured number rather than lowering the floor. The locale files are unchanged and the retired keys are recorded in `i18nParity.test.ts` with their own assertion. Exactly two tests were removed and both are the named refresh-control assertions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Put Ctrl+Q behind a confirmation, with the hidden window and the wedged renderer handled</name>
  <files>electron/quitGuard.ts, electron/shortcuts.ts, electron/ipcHandlers.ts, electron/preload.ts, src/types/electron.d.ts, src/App.tsx, tests/unit/quitGuard.test.ts</files>
  <behavior>
    Against a guard built with fully faked deps and a fake clock:
    - No window available: `requestQuit()` quits immediately and never calls `sendQuitRequest`.
    - Window hidden: `requestQuit()` calls `revealWindow` before `sendQuitRequest`, and does not quit.
    - Window visible: `requestQuit()` does not call `revealWindow`, calls `sendQuitRequest`, and does not quit.
    - No acknowledgement: advancing the clock by `QUIT_ACK_TIMEOUT_MS` quits exactly once.
    - Acknowledged: advancing the clock by ten times `QUIT_ACK_TIMEOUT_MS` does not quit — the user is thinking, not absent.
    - Acknowledged then `cancelQuit()`: does not quit, `isPending()` is false, and a later `requestQuit()` sends a fresh prompt and arms a fresh watchdog.
    - `requestQuit()` while a request is pending quits immediately and exactly once, whether or not the first was acknowledged.
    - `confirmQuit()` quits exactly once, clears the pending flag and clears the watchdog, so no later clock advance produces a second quit.
  </behavior>
  <action>
Create `electron/quitGuard.ts` holding the whole decision as a pure factory with injected dependencies — `hasWindow`, `isWindowVisible`, `revealWindow`, `sendQuitRequest`, `quit`, `setTimer`, `clearTimer` — and no `electron` import. The point of the injection is that the three interesting branches (reveal-first, ack watchdog, second-press) become unit-testable without an Electron runtime; that is what turns this from a vacuous gate into a real one. Export `QUIT_ACK_TIMEOUT_MS = 3000`, `createQuitGuard(deps)`, and a module-level `initQuitGuard(deps)` / `getQuitGuard()` pair so the shortcut handler and the IPC handlers share one instance.

Implement per D-04 and D-05: `requestQuit` quits at once if a request is already pending or if there is no window; otherwise reveals the window when `isWindowVisible()` is false, sends the request, marks pending and arms the ack watchdog. `acknowledgePrompt` clears the watchdog but leaves pending set, so the wait for the user's answer is unbounded. `cancelQuit` clears both. `confirmQuit` clears both and quits. Make `quit` idempotent from the guard's side by clearing state before calling it.

Rewire `electron/shortcuts.ts`. Build the guard in the constructor from `this.deps`: `hasWindow` checks `getMainWindow()` is non-null and not destroyed, `isWindowVisible` is `deps.isVisible`, `revealWindow` is `deps.toggleMainWindow` (only ever invoked when the window is hidden, so the toggle is unambiguous), `sendQuitRequest` sends `"quit-requested"` on `mainWindow.webContents`, `quit` is Electron's app-level quit, and the timer pair is `setTimeout`/`clearTimeout`. Inside the Ctrl+Q registration itself (line 126-129), the body must call `requestQuit()` and nothing else — the direct app-level quit currently on line 127 goes away entirely, which is what the region-scoped gate below checks.

Add the two channels. `electron/preload.ts` gains `onQuitRequested(callback)` following the existing subscribe-and-return-unsubscribe shape used by the other `on*` members, plus `acknowledgeQuitPrompt()` invoking `"quit-prompt-shown"` and `cancelQuit()` invoking `"quit-cancelled"`. `electron/ipcHandlers.ts` gains both channels in the allowed-channel array near the top AND a `registerHandle` for each, delegating to `getQuitGuard()?.acknowledgePrompt()` and `?.cancelQuit()` — the optional call matters because the handlers can be registered before the shortcut helper exists. Route the existing `"quit-app"` handler through `getQuitGuard()?.confirmQuit()`, falling back to the app-level quit it already calls today when no guard has been initialised, so the Settings Quit button and the shortcut converge on one path and neither leaves a watchdog armed. Mirror all three onto `src/types/electron.d.ts` beside the existing `quitApp` declaration.

Wire the renderer in `src/App.tsx`. Subscribe in an effect that returns the unsubscribe function; in the callback set the open state and immediately invoke `acknowledgeQuitPrompt()` — sending it from the listener rather than from a dialog mount effect keeps the ack tied to "the renderer is processing events", which is exactly what the watchdog is discriminating on.

Render `ConfirmDialog` as a sibling of the toast list, inside the context provider but outside `<Routes>`, so it is mounted on every screen including the settings dialog, the wizard, the welcome screen and the `/debug-live` route. Reuse `confirm.quit.title`, `confirm.quit.description` and `confirm.quit.confirmLabel` unchanged — they already describe this exact loss and this task adds no strings.

Guard the close path with a ref. `ConfirmDialog` calls `onConfirm()` and then `onOpenChange(false)`, so a naive close handler would fire the cancel IPC immediately after the confirm IPC. Set a `quitConfirmedRef` inside `onConfirm`; in `onOpenChange`, clear the open state, then return early and reset the ref when it is set, and only otherwise invoke `cancelQuit()`.

Write `tests/unit/quitGuard.test.ts` per `<behavior>` with hand-rolled fake deps and a manually advanced fake timer queue — do not reach for real timers or for `vi.useFakeTimers` against `setTimeout`, since the timer functions are injected precisely so the test can own them. Put the file in `tests/unit/`, not in `electron/`: `tsconfig.electron.json` includes `electron/**/*` and would typecheck and emit a test placed there.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/quitGuard.test.ts</automated>
    <automated>npx vitest run tests/integration/ipcContract.integration.test.ts</automated>
    <automated>npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.electron.json</automated>
    <automated>test "$(grep -vE '^\s*(//|\*|/\*)' electron/shortcuts.ts | grep -A3 'CommandOrControl+Q' | grep -c 'app.quit()')" -eq 0</automated>
    <automated>npx eslint .</automated>
  </verify>
  <done>Ctrl+Q raises the existing quit confirmation instead of quitting. A hidden window is revealed first. A renderer that never acknowledges within the ack timeout is overridden and the app quits; a renderer that acknowledges is waited on with no deadline. A second Ctrl+Q while pending quits at once. Cancelling leaves the app running and a later Ctrl+Q prompts again. The Settings Quit button and the shortcut both terminate through `confirmQuit`, leaving no armed watchdog. `ipcContract.integration.test.ts` is green, proving both new invoke channels have handlers.</done>
</task>

</tasks>

<verification>
Every `grep`-shaped gate in the tasks above was run against the tree as it stands before this task, to prove none of them is vacuous. Measured at planning time: the dead-Pro-id gate **fails** (the bug is present), the non-existent Live-id gate **passes** (that id is correctly absent today and must stay absent), and the Ctrl+Q gate reports `1` direct `app.quit()` (expected `0` after Task 3). A gate that passes before the work is done is not a gate — if you rewrite any of these, re-check it against `git stash` first.

Run from the repo root. Nothing here starts, builds or cleans the app, so it is safe against a running dev session.

```
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.electron.json
npx tsc --noEmit -p tsconfig.node.json
npx tsc --noEmit -p backend/tsconfig.json
npx vitest run
npx eslint .
```

The first three must exit 0, as they do today. The fourth is new to this task because Task 1 edits backend source; judge it against the baseline captured in Task 1's precondition, not against zero.

Test count. The baseline is 255 passing across 17 files. Task 2 removes exactly two — the en and ru 'Refresh application list' assertions in `a11yNames.test.tsx`, whose control no longer exists. Everything else is additive. Exactly two NEW test files are created (`audioSourceRemoval.test.ts`, `quitGuard.test.ts`); `geminiModels.test.ts`, `a11yNames.test.tsx` and `i18nParity.test.ts` already exist and are extended in place. So the file count goes 17 -> 19, not higher. Expect **at least 270 passing across at least 19 files**. Any other test that disappears or turns red is a regression: name it and fix it before calling this done. Do not reach the count by padding.

Locale symmetry, independent of the runner:

```
node -e "const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?f(v,p+k+'.'):[p+k]);const a=f(require('./src/i18n/locales/en.json')).sort(),b=f(require('./src/i18n/locales/ru.json')).sort();console.log(a.length===b.length&&a.join()===b.join()?'PASS '+a.length+' keys':'FAIL')"
```

Expect `PASS 320 keys` — this task adds and removes no locale keys at all.

Design-system ratchets. `npx vitest run tests/unit/designSystem.test.ts` covers the opacity budget, the population floor, the adoption ratchet, the hex-literal gate, the button-primitive inertness gate and the cascade invariants. Task 2 deletes a meaningful amount of markup, so the population floor is the one at genuine risk. If it fails on the floor, report the measured number and stop; lowering `POPULATION_FLOOR` is a decision for the developer, not a way to make this task green.
</verification>

<human_verification>
None of these can be expressed as a gate without the gate being a lie. Use the dev session that is already running; do not restart it with `npm run dev` unless it is down.

1. **The Pro model actually answers (Task 1).** Open Settings, pick `Gemini 3.1 Pro (Preview)` from the model dropdown, save, and run one real request — a screenshot plus Ctrl+Enter is enough. Expect a normal answer, not an API error. This is the only check that proves the id exists, and it is the reason no automated gate claims to. While you are there, judge whether `(Preview)` reads as useful information or as noise in that dropdown.

2. **Legacy rescue (Task 1).** Close the app. Hand-edit `config.json` and set `solutionModel` to `gemini-1.5-pro`. Reopen and run a request. Expect it to succeed on the preview Pro id rather than fail. Repeat with the id the picker offered before this task — that is the population most likely to be broken right now.

3. **Model list freshness, for the record.** With your key in the environment, list the models the API actually exposes and confirm `gemini-3.1-pro-preview` is still among them. Note the date in the summary. This is the check that will eventually catch the preview id being retired, and nothing in the test suite can do it.

4. **Audio still works, and says what it does (Task 2).** Open the audio dropdown in the live panel. Expect exactly two options, System Audio and Microphone, with no Applications section, no search box and no refresh control. Pick System Audio and start a session with something playing; confirm the level meter moves and transcription arrives. Then check the same two surfaces in Settings and in the setup wizard — reset the wizard if needed — and confirm neither offers a window list either. Judge whether the dropdown now looks unbalanced or empty with only two rows; if it does, that is worth reporting, but it is not a reason to put the removed option back.

5. **The stale-config path, and the acquisition cost it now pays (Task 2, D-03).** This is the item that decides whether the D-03 trade was worth it, so run it deliberately. Close the app, hand-edit `config.json` so `audioConfig.source` is `"application"`, reopen. Expect the audio button to read "System" with no error and no empty state. Now **start a session** and watch what happens at capture start: because System Audio acquires through `getDisplayMedia`, the Windows share picker must appear — where the removed path started silently. Tick the audio checkbox, confirm audio actually arrives and transcription runs. Then repeat and deliberately do NOT tick the audio box: expect the "No audio track detected. Enable audio sharing and try again." error, and judge whether that message is actionable enough for someone mid-interview who has never seen this dialog before. Report how intrusive the per-session picker feels on an always-on-top overlay. If it is bad enough to hurt, say so — that is a real cost of this change and it should be recorded, not absorbed.

6. **Ctrl+Q with the window visible (Task 3).** Press Ctrl+Q. Expect the quit confirmation, focus resting on Cancel, `Esc` and `Enter` hints legible. Press Escape — still running. Press Ctrl+Q again and confirm — it quits. Reopen.

7. **Ctrl+Q with the window hidden — the case this task exists for (Task 3).** Press Ctrl+B to hide the window. Now press Ctrl+Q. Expect the window to come back into view **with** the confirmation on it, not a quit and not silence. Escape it and confirm the window is now visible; decide whether leaving it visible after a cancelled quit is the right resting state or whether it should re-hide, and say which in the summary.

8. **Ctrl+Q at minimum opacity — the deliberately-unhandled sibling (D-05).** Hold Ctrl+Alt+[ until the window is at its dimmest, then press Ctrl+Q. Expect a faint but present confirmation. Judge honestly whether it is legible at that opacity. If it is not, press Ctrl+Q a second time and confirm the escape hatch fires and the app quits. This is a recorded trade; your verdict here decides whether it stays one.

9. **Ctrl+Q twice in a row (Task 3).** From a normal visible state, press Ctrl+Q twice in quick succession. Expect an immediate quit on the second press with no further prompt. Then reopen and confirm one press still prompts normally — the second-press path must not have left the guard stuck.

10. **The session is actually protected.** Start a live interview session, get a transcript going, then press Ctrl+Q and cancel. Expect the session still connected and still transcribing. That end-to-end outcome, not the dialog, is the point of the whole task.
</human_verification>

<success_criteria>
- The settings picker offers `gemini-3.1-pro-preview` as `Gemini 3.1 Pro (Preview)`; all four pro-era legacy ids remap to it; the two non-existent ids match nowhere under `electron/`, `src/` or `backend/src/`, comments included.
- Desktop and backend legacy maps are identical, enforced by a test that imports both — the desync the file headers have warned about since it was introduced is now gated.
- Every legacy remap target is a member of `GEMINI_MODEL_IDS` or `GEMINI_MODELS`, enforced by a test.
- Per-application audio is gone from the live panel, Settings and the wizard, and from the state that fed them in `SettingsPage.tsx` and `StepTest.tsx`; `get-audio-sources` exists in neither preload nor ipcHandlers; `chromeMediaSource` appears nowhere in the **shipped** capture path, with `AudioCaptureService.legacy.ts` still quarantined and imported by nothing; the union is declared once in `electron/constants/audioSource.ts` with the Chromium limitation and the Process Loopback path recorded there.
- A stale `source: "application"` in config.json resolves to system in both the main and renderer processes.
- Ctrl+Q raises the existing `confirm.quit.*` dialog, reveals a hidden window before showing it, quits anyway if the renderer never acknowledges within the ack timeout, waits without deadline once it does, and quits immediately on a second press.
- The quit state machine lives in a dependency-injected pure module with unit tests covering the no-window, hidden-window, no-ack, acked-then-silent, cancel-then-retry, double-press and confirm paths.
- Four typechecks (three at zero, backend at no-new-errors-versus-baseline), `npx eslint .` clean, `npx vitest run` at 270+ passing across 19+ files, with the only removed tests being the two named refresh-control assertions.
- Locale files byte-identical in key set at 320 keys; keys orphaned by the audio removal retained and recorded in `RETIRED_UNUSED_KEYS` with their own assertion.
- `designSystem.test.ts` green on all of its gates, including the 1100 population floor.
- All ten human verification items confirmed by the developer.
</success_criteria>

<output>
Create `.planning/quick/260901-ubp-functional-gaps-fix-the-non-existent-gem/260901-ubp-SUMMARY.md` when done.

Record in the summary:

- The per-application audio decision as a decision, justified on the **false label**: on Windows the window id has no effect on the audio track, so the option delivered whole-desktop audio while naming one application — a privacy misrepresentation, not a quality bug, in a tool used during interviews. Do not write it up as "removed because Chromium doesn't support it"; that omits what actually justified removal over a warning.
- And in the same breath, the cost, because an earlier draft of this plan got it wrong and called removal free. It is not. The removed path acquired silently via `getUserMedia`; System Audio acquires via `getDisplayMedia`, which raises the Windows share picker every session and fails with "Enable audio sharing and try again." if the audio box is unticked. Same bytes, different acquisition. Record the developer's verdict from human item 5 on how intrusive that is in practice. If anyone later revisits this decision, they must start from the real trade — a prompting path that captures what it says, chosen over a silent path that captures more than it says — and not from a free lunch.
- The wizard readiness change: `StepTest.tsx` no longer blocks on a missing application name, because both clauses of that guard became vacuous. Small, intended, and easy to mistake for a regression later.
- `src/services/AudioCaptureService.legacy.ts` as the leftover: still carrying a three-member union and a working per-application capture, still quarantined by the `**/*.legacy.ts` tsconfig exclude and imported by nothing. Named here as the first candidate for a dead-code pass so it is not rediscovered as a contradiction of this task.
- The exact locale keys orphaned by that removal, and why they were retained rather than deleted (`MIN_KEYS = 320` and the `XAN_LABEL_KEYS` assertions). Flag them as the natural first item for a future locale-pruning pass.
- The Ctrl+Q watchdog design: that it waits for an acknowledgement rather than for an answer, and why both simpler designs are wrong. State the residual gap honestly — the ack proves the listener ran, not that the dialog painted — and that the second-press escape hatch is what covers it.
- The developer's verdict on human item 8 (Ctrl+Q at minimum opacity). If the confirmation was not legible there, record it as an open defect with the reasoning from D-05 about why raising opacity was not attempted, so whoever picks it up starts from the trade rather than re-deriving it.
- The developer's verdict on human item 7 — whether a cancelled quit should leave the window visible or restore it to hidden.
- The date of the ListModels check from human item 3, so the next person knows how stale the preview-id assumption is.
- The final test count and file count against the 255/17 baseline, naming the two removed tests explicitly.
</output>
