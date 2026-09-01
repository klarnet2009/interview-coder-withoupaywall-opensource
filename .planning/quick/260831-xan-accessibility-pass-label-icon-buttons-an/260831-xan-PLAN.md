---
phase: quick-260831-xan
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QUICK-260831-xan]
files_modified:
  - src/index.css
  - src/i18n/locales/en.json
  - src/i18n/locales/ru.json
  - src/components/a11y/LiveAnnouncer.tsx
  - src/components/a11y/announcements.ts
  - src/components/a11y/index.ts
  - src/components/UnifiedPanel/UnifiedPanel.tsx
  - src/components/UnifiedPanel/useUnifiedPanelUiEffects.ts
  - src/components/UnifiedPanel/AudioSourceSelector.tsx
  - src/components/UnifiedPanel/ResponseSection.tsx
  - src/components/StatusBar/StatusBar.tsx
  - src/components/ControlBar/ControlBar.tsx
  - src/components/DevModeToggle.tsx
  - src/components/DragHandle/DragHandle.tsx
  - src/components/Input/UnifiedInput.tsx
  - src/components/Response/AIResponse.tsx
  - src/components/LiveTranscription/LiveTranscription.tsx
  - src/components/Queue/ScreenshotItem.tsx
  - src/components/Sessions/SessionHistory.tsx
  - src/components/Wizard/WizardContainer.tsx
  - src/components/Wizard/WizardSteps/StepApiKey.tsx
  - src/components/Wizard/WizardSteps/StepAudio.tsx
  - src/components/Profile/ProfileManager.tsx
  - src/components/Debug/DebugView.tsx
  - src/components/Settings/AudioSettings.tsx
  - src/components/Settings/SettingsPage.tsx
  - src/components/WelcomeScreen.tsx
  - src/_pages/DebugLive.tsx
  - tests/unit/i18nParity.test.ts
  - tests/unit/a11yNames.test.tsx
  - tests/unit/liveAnnouncer.test.tsx

must_haves:
  truths:
    - "All 35 icon-only controls in the app — a button whose entire rendered content is an icon or an SVG, with no text node in any branch, including two that are self-closing and so have no content at all — report a human-readable accessible name sourced from the locale files, so a Russian-language user hears Russian. The set of 35 was derived by a scanner over all 164 buttons in src with zero unpaired tags, not by reading; three of them are custom switches that additionally report role=switch and aria-checked, and two (AIResponse.tsx:223 and StatusBar.tsx:232) had no accessible name of any kind beforehand."
    - "The three custom menus in the working overlay (settings menu, capture-source picker, audio-source picker) declare aria-haspopup and a live aria-expanded state, and every one of them closes on Escape. Before this change they could only be dismissed by clicking elsewhere, which is unusable without a mouse — the exact situation this overlay exists to serve."
    - "Session state transitions (connecting, listening, no signal, transcribing, generating, error) are spoken by a screen reader, politely and once per settled transition, from a visually hidden region — the app's primary output stops being silent."
    - "The interviewer transcript is announced only after speech settles, and only the newly appended tail is spoken. The whole accumulated transcript is never re-read on a partial update, and the visible transcript node is never itself a live region."
    - "Every focusable element in the app shows a focus indicator when reached by keyboard, including the ~20 inputs that set focus:outline-none. A rule already existed but sat in @layer base, which loses to every Tailwind utility; moving it out of the layer is what makes it take effect."
    - "The focus indicator is legible on every surface in the overlay — the near-black panel, the amber notice banner, the blue and red action buttons — because it is a two-tone ring (light core over a dark halo) rather than a single color chosen to suit one background."
    - "No button that already shows visible text gains an aria-label, so the visible label and the accessible name still match and voice-control users can still say what they see."
  artifacts:
    - "src/components/a11y/LiveAnnouncer.tsx — the only file in src that may contain a live-region attribute"
    - "src/components/a11y/announcements.ts — useSettledValue debounce hook and the pure announcementDelta helper"
    - "src/index.css — the :focus-visible rule relocated out of @layer base, strengthened --color-ring, new --color-focus-halo"
    - "src/i18n/locales/en.json and ru.json — an a11y namespace holding every spoken string"
    - "tests/unit/a11yNames.test.tsx — accessible-name assertions in English and Russian"
    - "tests/unit/liveAnnouncer.test.tsx — debounce, delta and live-region-attribute assertions"
  key_links:
    - "UnifiedPanel status.state -> useSettledValue(400ms) -> LiveAnnouncer: the state announcer must be fed the settled state, not the raw one, or a connecting/listening flap becomes a stutter."
    - "UnifiedPanel status.transcript -> useSettledValue(1500ms) -> announcementDelta -> LiveAnnouncer: both the debounce AND the delta are required. Either one alone still produces a re-read of the full transcript."
    - "useUnifiedPanelUiEffects keydown listener -> setShowAudioDropdown/setShowCaptureDropdown/setIsTooltipVisible: Escape must reach all three setters, not just the two dropdowns that already share the mousedown handler."
    - "src/index.css @layer base (lines 82-133) -> Tailwind @layer utilities: the existing *:focus-visible rule at line 129 is real code that has never taken effect, because @layer base is ordered before @layer utilities and so loses to every focus:outline-none. Relocating the rule out of the layer is the entire fix; leaving it in place makes the whole focus-ring truth vacuous."
    - "a11y.* keys -> tests/unit/i18nParity.test.ts MIN_KEYS: the floor must reach exactly 320 or deleting the new keys from both files passes the gate."
---

<objective>
Make the always-on-top interview overlay operable and audible without a mouse or eyes: give the icon-only controls real, localized names; announce session state and settled transcript through a purpose-built polite live region; restore a visible focus indicator everywhere; and make the three custom menus keyboard-dismissable.

Purpose: this is a stealth overlay used while the user is mid-conversation with a live interviewer. Keyboard operability is not a nicety here — hunting with a mouse is exactly the thing the app is designed to avoid. And the app's core output, the transcript and the listening state, currently reaches a screen-reader user not at all: `aria-live` appears zero times in the whole of `src`.

Output: 35 named controls plus one named dialog, three switches given real switch semantics, three keyboard-dismissable menus, one announcer primitive with an honest anti-spam design, one relocated focus rule, 42 new locale keys in both languages, and three test files' worth of gates that assert computed accessible names rather than the mere presence of attributes.
</objective>

<execution_context>
@C:/Users/klarn/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/klarn/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/codebase/CONVENTIONS.md
@CLAUDE.md

Prior quick task 260831-wf4 landed minutes ago and established patterns this plan builds on directly — do not undo them:
@src/components/ui/confirm-dialog.tsx
@tests/unit/confirmDialog.test.tsx
@tests/unit/i18nParity.test.ts
</context>

<decisions>

<!-- planner-discipline-allow: aria-live -->
<!-- The attribute name is the subject of D-02 and of the Task 3 confinement gate; it cannot be
     discussed without naming it. It must not be written into any source comment. -->

These four judgement calls are settled here so the executor does not relitigate them mid-task.

### D-01 — Which buttons get an `aria-label`, and which must not

**Criterion:** a `<button>` qualifies if and only if its entire rendered content is an icon component or an `<svg>` — no text node anywhere inside it, in any branch of a conditional. Self-closing buttons (`<button ... />`) satisfy this most strongly of all: they have no content whatsoever. Two such controls exist and both are live click targets named only by a hardcoded English `title`.

**The set was derived mechanically, not by reading.** An earlier eyeball pass produced 21 and was wrong in both directions. The number below comes from a scanner that brace-matches each opening tag (necessary: several `className` template literals contain a `>`, so naive matching truncates), pairs it to its `</button>` **or recognises it as self-closing**, strips tag markup, and classifies the remainder as a text node, a text-bearing expression, or icon-only. Text detection counts **any** non-whitespace glyph, not just letters — a keycap rendering `↵` is text. Ambiguous cases — a conditional whose branches are both elements — were then resolved one by one.

The scanner reports **164 buttons, 0 unpaired**: 31 definite icon-only, 38 ambiguous, 95 text. Four of the 38 ambiguous resolve to icon-only (`LiveTranscription.tsx:163`, `AIResponse.tsx:215`, `AIResponse.tsx:223`, `StepApiKey.tsx:175` — conditionals whose every branch is an icon). **31 + 4 = 35.** No subtraction is needed: every one of the 31 has an `onClick`, and all eight `SolutionCommands` keycaps classify as text-bearing with no handler, so none of them ever entered the set.

**Result: 164 `<button>` tokens in `src`; 35 qualify (about 21%).** Every other button already renders a word, and adding a label there would be actively harmful: an accessible name overrides the visible text, breaking the "label in name" match that lets a voice-control user say what they read. So `Stop`, `Send`, `Reset View`, `Capture Now`, `System Audio`, `Mic` and the rest are deliberately left alone.

Three exclusions, named so none looks like an oversight:

- **`StatusBar.tsx:134` and its hotkeys button** — the hotkeys button's text span is `hidden sm:inline`, so at narrow widths it renders icon-only. Still excluded: when the span is `display:none` it drops out of the accessible-name computation and the existing `title` supplies the name; when the span is visible, an `aria-label` would override it and break label-in-name. Its `title` being hardcoded English is a real but separate defect, recorded below. (The *close* button of its hotkeys modal, `StatusBar.tsx:232`, is a different control and does qualify — it has no name at all today.)
- **`SolutionCommands.tsx` keycaps** — the file has **ten** `<button>` elements, not four. Eight (lines 87, 90, 120, 123, 159, 162, 189, 192) are decorative keycaps rendering `{COMMAND_KEY}`, `B`, `H` or nothing, with **no `onClick`**; the real click target is the parent `<div>`. Labelling them would add eight phantom tab stops that do nothing. Fixing it properly means inverting the semantics — the div becomes the button, the keycaps become `<kbd>` — a rebuild this pass is not chartered to do. The remaining two (line 435 `openSettingsPortal`, line 444 `handleSignOut`) were checked: both render visible text, so both are correctly out of the set for the ordinary reason.
- **`UnifiedPanel/ResponseSection.tsx:42`** — renders `<Sparkles />` *and* a visible `<span>AI Suggestions</span>`. It fails the criterion and gets **no `aria-label`**. It is a disclosure, so it gets `aria-expanded` only. Giving it a swapping label would override the visible text — precisely the harm this criterion exists to prevent.

**A label may swap with state only when the control has no visible text.** `LiveTranscription.tsx:163` (mic) and `StepApiKey.tsx:175` (show/hide key) are icon-only, so swapping their labels is correct and carries no label-in-name risk. `ResponseSection.tsx:42` is not, so it does not.

### D-02 — Live-region politeness, and why the transcript is not one

Both regions are `polite`. Neither is `assertive` and neither uses `role="alert"`, including for `error` and `no_signal`.

Justification specific to this app: the screen reader is the user's only audio channel and they are simultaneously listening to a human interviewer. An assertive region interrupts the reader's current utterance — which, in this app, is quite likely the AI hint the user is in the middle of consuming. Every state this app can enter is recoverable and is *also* rendered visibly with an action banner. Trading a one-second queue delay for the ability to talk over the user is a bad trade here specifically.

**The transcript is not made a live region.** `status.transcript` is a full string replaced on every `onLiveInterviewStatus` event, which fires per partial-transcription update. Marking the visible transcript node `aria-live="polite"` would re-announce the entire accumulated transcript on every token — measurably worse than announcing nothing. Two mechanisms are required together:

1. **Settle** — `useSettledValue(status.transcript, 1500)` emits only after the value has stopped changing for 1500ms, i.e. on a natural speech pause, which is also the first moment a partial transcript means anything.
2. **Delta** — `announcementDelta(previouslyAnnounced, settled)` returns only the newly appended tail when `settled` starts with what was already spoken, and the whole string otherwise (a correction or a session reset).

Either mechanism alone still re-reads the transcript. Both are mandatory.

State gets its own region at a 400ms settle — long enough to absorb a `connecting` -> `listening` flap, short enough to still feel immediate.

### D-03 — No `eslint-plugin-jsx-a11y`

Decided against, for three reasons rather than convenience:

1. **It cannot see this codebase's actual defect.** No enabled-by-default `jsx-a11y` rule flags `<button><Settings /></button>`. The only candidate, `control-has-associated-label`, is off by default and resolves labels by walking JSX children — it cannot look through a `lucide-react` component to know it renders an `<svg>` with no text. It would report zero findings against the 21 unlabelled buttons this task exists to fix.
2. **What it *would* report is out of charter.** Its recommended set targets click handlers on non-interactive elements. `SolutionCommands.tsx` has exactly that, and fixing it is a semantics rebuild (see D-01). Enabling the plugin manufactures precisely the unbounded codebase-wide task the brief forbids.
3. It adds a dependency, and therefore a package-legitimacy gate, for zero gate value.

Instead: targeted greps plus `@testing-library/react` accessible-name assertions. Those are strictly stronger than any static rule, because they assert the *computed* accessible name — and because they run in Russian as well as English, they cannot be satisfied by a hardcoded English `title`, which a static attribute-presence rule would happily accept.

### D-04 — Relocate the focus ring out of `@layer base`, and make it two-tone

**Measured while planning, and it changes the shape of the fix: a focus rule already exists.** `src/index.css` line 129 has `*:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px }`. It has never taken effect, because it sits inside the `@layer base` block spanning lines 82–133. Tailwind v4 orders `base` before `utilities`, and layer order beats specificity outright — so every `focus:outline-none` on the ~20 inputs, and every `focus-visible:ring-*` on the buttons, wins against it. The audit's finding of six `focus-visible` occurrences was counting a rule that the cascade discards.

So this is not "add a rule". It is **move the existing rule out of the layer**. Unlayered rules outrank every layered rule regardless of specificity, which is what lets one relocation fix ~20 inputs instead of 20 edits. If the executor adds a new rule and leaves the old one inside `@layer base`, nothing changes — hence the gate below checks brace depth, not mere presence.

Second: `--color-ring` is `rgba(255, 255, 255, 0.4)`. Even once the cascade is fixed, 40% white over a `bg-black/80` panel is a weak indicator, and it is the same token `button.tsx` and `input.tsx` use for `focus-visible:ring-ring` — so raising it improves those too.

Third: a single-color ring cannot be right on every surface here — near-black panels, an amber notice banner, a blue Solve button, a red Stop button. A light core over a dark halo is legible against all of them without anyone having to pick a winner.

**The halo replaces the shadcn rings rather than composing with them — this is intentional, and worth stating plainly.** Tailwind's `focus-visible:ring-*` utilities are implemented as `box-shadow` and live in `@layer utilities`. Because the new rule is unlayered, its `box-shadow` wins outright and the `ring-1 ring-ring` on `button.tsx` and `input.tsx` will not render while focused. That is the desired outcome — one consistent, strong indicator instead of a 40%-opacity 1px ring on some controls and nothing on others — but it means two side effects the executor should expect rather than treat as bugs: the shadcn rings disappear, and any *decorative* `shadow-*` on a focused element is suppressed for the duration of focus. Human-check item 1 covers the second. Do not attempt to compose with `--tw-ring-shadow` to preserve both; chaining Tailwind's internal shadow variables is fragile across versions and the composite ring would be worse-looking than either alone.

</decisions>

<tasks>

<task type="tracer">
  <name>Task 1: End-to-end accessibility slice — one button, all five layers</name>
  <files>src/index.css, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/components/UnifiedPanel/UnifiedPanel.tsx, src/components/UnifiedPanel/useUnifiedPanelUiEffects.ts, tests/unit/i18nParity.test.ts, tests/unit/a11yNames.test.tsx</files>
  <read_first>src/index.css (lines 1-10 and 82-135 — the @theme tokens and the @layer base block that ends at line 133), src/components/UnifiedPanel/UnifiedPanel.tsx (lines 425-510, the header and settings menu), src/components/UnifiedPanel/useUnifiedPanelUiEffects.ts, tests/unit/confirmDialog.test.tsx (the jsdom docblock pattern), tests/unit/i18nParity.test.ts</read_first>
  <behavior>
    - The settings gear button in the UnifiedPanel header reports the accessible name "Open settings" under the `en` locale.
    - The same button reports "Открыть настройки" under the `ru` locale. This is the assertion a hardcoded English `title` cannot pass.
    - Its `aria-expanded` reads `false` when the menu is closed and `true` when open; it declares `aria-haspopup="menu"`.
    - Pressing Escape while the menu is open closes it.
    - `src/index.css` has exactly one `focus-visible` rule and it sits at brace depth zero — outside `@layer base` and outside every other at-rule block.
  </behavior>
  <action>
Wire one control — the UnifiedPanel settings gear — through every layer this task will later expand across, so an architectural problem surfaces now rather than after twenty edits.

**Layer 1, focus indicator (`src/index.css`).** This is a relocation, not an addition — read D-04 first.

Delete the `/* Focus ring accessibility styles */` comment and the `*:focus-visible` rule that currently occupy lines 128–132, inside the `@layer base` block. Do not leave a copy behind; two rules, one layered and one not, is the failure mode the gate is written to catch.

In the `@theme` block, raise `--color-ring` from `rgba(255, 255, 255, 0.4)` to `rgba(255, 255, 255, 0.95)` — it is shared with the `focus-visible:ring-ring` utilities in `button.tsx` and `input.tsx`, so this strengthens those at the same time — and add `--color-focus-halo: rgba(0, 0, 0, 0.9)`.

Then, at the very end of the file and at top level (not nested in any `@layer`, `@theme` or `@media`), add the replacement rule for `*:focus-visible`: a 2px solid outline in `var(--color-ring)` with `outline-offset: 2px`, plus `box-shadow: 0 0 0 4px var(--color-focus-halo)` for the dark halo. Per D-04 the top-level position is the entire mechanism — it is the only reason this beats the `focus:outline-none` utilities on ~20 inputs.

**Layer 2, locale (`en.json` / `ru.json`).** Add a new top-level `a11y` namespace to both files, alongside the existing `confirm` namespace. In this task add only `a11y.label.openSettings` — `"Open settings"` in `en`, `"Открыть настройки"` in `ru`. Task 2 fills the rest of the table.

**Layer 3, component (`UnifiedPanel.tsx`).** On the settings gear button near line 456: add `aria-label={t('a11y.label.openSettings')}`, `aria-haspopup="menu"`, and `aria-expanded={isTooltipVisible}`. Confirm `useTranslation` is already imported in this file; import it following the existing convention if not. On the popup `<div>` that follows, add `role="menu"`, and give its two child buttons `role="menuitem"`.

**Layer 4, keyboard (`useUnifiedPanelUiEffects.ts`).** The existing effect registers a `mousedown` listener only when a dropdown is open, so the menus are mouse-dismiss-only today. Add a sibling effect that registers a `keydown` listener on `document` and, on Escape, calls `setIsTooltipVisible(false)`, `setShowAudioDropdown(false)` and `setShowCaptureDropdown(false)`. Register it only while at least one of the three is open, and mirror the existing cleanup shape. This requires threading `setIsTooltipVisible` into the hook's params interface — add it, and pass it from the `UnifiedPanel.tsx` call site around line 107.

**Layer 5, gate (`tests/unit/a11yNames.test.tsx`).** New file. Reuse the exact conventions from `tests/unit/confirmDialog.test.tsx`: the `// @vitest-environment jsdom` first-line docblock, the `/// <reference types="vitest/globals" />` triple-slash, `import '../../src/i18n'`, and an `afterEach(cleanup)`. Rendering the whole `UnifiedPanel` is not worth it — it needs an `electronAPI` mock surface. Instead cover the settings gear through the same code path the browser uses by rendering the smallest component that owns it; if that proves to require mocking, render `AudioSourceSelector` instead and assert its refresh control, and leave the gear covered by the `a11y` key-resolution test below. Add a helper that switches locale via `i18n.changeLanguage('ru')` and back, and assert the accessible name in both languages using `screen.getByRole('button', { name })`.

Also in this file, add a source-scanning test that is not about one component: read every `.tsx` under `src`, extract every `a11y.` key referenced through a `t(...)` call, and assert each one resolves to a non-empty string in both `en.json` and `ru.json`. This catches typo'd keys and, more importantly, is what makes Task 2's twenty mechanical edits gated rather than trusted.

**Parity floor (`tests/unit/i18nParity.test.ts`).** Raise `MIN_KEYS` from 278 to 279 — this task adds exactly one key. Leave `WF4_KEYS` untouched. Task 2 raises it to the final 320.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json &amp;&amp; npx tsc --noEmit -p tsconfig.electron.json &amp;&amp; npx tsc --noEmit -p tsconfig.node.json</automated>
    <automated>npx vitest run</automated>
    <automated>npx eslint .</automated>
    <automated>node -e "const fs=require('fs');const css=fs.readFileSync('src/index.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');const d=[...css.matchAll(/focus-visible/g)].map(m=>{const p=css.slice(0,m.index);return p.split('{').length-p.split('}').length});if(!d.length)throw new Error('no focus-visible rule in index.css');if(d.some(x=>x>0))throw new Error('a focus-visible rule is still nested in an at-rule block and will lose to Tailwind utilities (depths: '+d.join(',')+')');console.log('ok',d.length)"</automated>
    <human-check>Not required for this task — the visual judgement is gated on Task 3, after every surface has been touched.</human-check>
  </verify>
  <done>The settings gear announces a localized name in both languages, reports its expanded state, closes on Escape, and shows a two-tone focus ring. Three typechecks, `vitest run` (now 14 files) and `eslint` are all clean.</done>
</task>

<task type="auto">
  <name>Task 2: Expand — name the remaining 34 icon-only controls and finish the two other menus</name>
  <files>src/i18n/locales/en.json, src/i18n/locales/ru.json, src/components/UnifiedPanel/UnifiedPanel.tsx, src/components/UnifiedPanel/AudioSourceSelector.tsx, src/components/UnifiedPanel/ResponseSection.tsx, src/components/StatusBar/StatusBar.tsx, src/components/ControlBar/ControlBar.tsx, src/components/DevModeToggle.tsx, src/components/DragHandle/DragHandle.tsx, src/components/Input/UnifiedInput.tsx, src/components/Response/AIResponse.tsx, src/components/LiveTranscription/LiveTranscription.tsx, src/components/Queue/ScreenshotItem.tsx, src/components/Sessions/SessionHistory.tsx, src/components/Wizard/WizardContainer.tsx, src/components/Wizard/WizardSteps/StepApiKey.tsx, src/components/Wizard/WizardSteps/StepAudio.tsx, src/components/Profile/ProfileManager.tsx, src/components/Debug/DebugView.tsx, src/components/Settings/AudioSettings.tsx, src/components/Settings/SettingsPage.tsx, src/components/WelcomeScreen.tsx, src/_pages/DebugLive.tsx, tests/unit/i18nParity.test.ts, tests/unit/a11yNames.test.tsx</files>
  <read_first>Only the specific button site in each file — the line numbers in the table below were measured against the current tree; confirm each before editing rather than reading whole files.</read_first>
  <action>
Apply the D-01 criterion to the remaining twenty sites. Each edit is one attribute; the cost here is breadth, not depth, so resist reading whole files.

**Locale table.** Add these under the `a11y` namespace in both files. Russian is the shipped second language and these strings are read aloud, so they must be idiomatic, not transliterated.

| key | en | ru |
|---|---|---|
| `a11y.label.openDebug` | Open debug and test tools | Открыть отладку и тесты |
| `a11y.label.openDevTools` | Open developer tools | Открыть инструменты разработчика |
| `a11y.label.chooseCaptureSource` | Choose what to capture | Выбрать источник захвата |
| `a11y.label.refreshCaptureSources` | Refresh capture source list | Обновить список источников захвата |
| `a11y.label.refreshAudioSources` | Refresh application list | Обновить список приложений |
| `a11y.label.refreshWindows` | Refresh window list | Обновить список окон |
| `a11y.label.minimizeWindow` | Minimize window | Свернуть окно |
| `a11y.label.closeWindow` | Close window | Закрыть окно |
| `a11y.label.closeSettings` | Close settings | Закрыть настройки |
| `a11y.label.hideWindow` | Hide window | Скрыть окно |
| `a11y.label.closeHotkeys` | Close keyboard shortcuts | Закрыть список горячих клавиш |
| `a11y.label.startListening` | Start listening | Начать прослушивание |
| `a11y.label.stopListening` | Stop listening | Остановить прослушивание |
| `a11y.label.removeScreenshot` | Remove screenshot | Убрать снимок экрана |
| `a11y.label.copyResponse` | Copy response | Скопировать ответ |
| `a11y.label.toggleResponseLength` | Expand or collapse the response | Развернуть или свернуть ответ |
| `a11y.label.deleteScreenshot` | Delete screenshot | Удалить снимок экрана |
| `a11y.label.screenshotPreview` | Screenshot preview | Просмотр снимка экрана |
| `a11y.label.closePreview` | Close preview | Закрыть просмотр |
| `a11y.label.backToSessions` | Back to session list | Назад к списку сессий |
| `a11y.label.closeSessionHistory` | Close session history | Закрыть историю сессий |
| `a11y.label.deleteSession` | Delete session | Удалить сессию |
| `a11y.label.closeWizard` | Close setup wizard | Закрыть мастер настройки |
| `a11y.label.closeProfileManager` | Close profile manager | Закрыть менеджер профилей |
| `a11y.label.setActiveProfile` | Set as active profile | Сделать профиль активным |
| `a11y.label.editProfile` | Edit profile | Изменить профиль |
| `a11y.label.deleteProfile` | Delete profile | Удалить профиль |
| `a11y.label.closeDebugView` | Close debug view | Закрыть окно отладки |
| `a11y.label.pasteApiKey` | Paste API key from clipboard | Вставить ключ API из буфера обмена |
| `a11y.label.showApiKey` | Show API key | Показать ключ API |
| `a11y.label.hideApiKey` | Hide API key | Скрыть ключ API |
| `a11y.label.opaqueMode` | Opaque mode | Непрозрачный режим |

Plus `a11y.label.openSettings` from Task 1 — **33 label keys in total**.

**Button sites — 34 of the 35 qualifying controls; the 35th (the settings gear) landed in Task 1.** Add `aria-label={t('<key>')}` to each. Where a hardcoded `title` already exists, leave it — it becomes a harmless tooltip once the label outranks it in the accessible-name computation.

| file | approx. line | key | note |
|---|---|---|---|
| `UnifiedPanel/UnifiedPanel.tsx` | 549 | `chooseCaptureSource` | |
| `UnifiedPanel/UnifiedPanel.tsx` | 598 | `refreshCaptureSources` | |
| `UnifiedPanel/AudioSourceSelector.tsx` | 146 | `refreshAudioSources` | |
| `StatusBar/StatusBar.tsx` | 212 | `openSettings` | |
| `StatusBar/StatusBar.tsx` | 232 | `closeHotkeys` | no name at all today |
| `ControlBar/ControlBar.tsx` | 143 | `openDebug` | |
| `ControlBar/ControlBar.tsx` | 152 | `openSettings` | |
| `DevModeToggle.tsx` | 45 | `openDevTools` | |
| `DragHandle/DragHandle.tsx` | 89 | `minimizeWindow` | |
| `DragHandle/DragHandle.tsx` | 100 | `closeWindow` | |
| `Input/UnifiedInput.tsx` | 203 | `removeScreenshot` | |
| `Response/AIResponse.tsx` | 215 | `copyResponse` | |
| `Response/AIResponse.tsx` | 223 | `toggleResponseLength` | **no name at all today** — also add `aria-expanded={expanded}`. One stable label plus `aria-expanded` for state; do not swap the label. |
| `Queue/ScreenshotItem.tsx` | 92 | `deleteScreenshot` | button opens at 89; replace the hardcoded English `aria-label` on line 92 |
| `Queue/ScreenshotItem.tsx` | 104 | `screenshotPreview` | this is the lightbox `<div role="dialog">`, not a button — replace its hardcoded English `aria-label` |
| `Queue/ScreenshotItem.tsx` | 120 | `closePreview` | button opens at 117; replace the hardcoded English `aria-label` on line 120 |
| `Sessions/SessionHistory.tsx` | 96 | `backToSessions` | |
| `Sessions/SessionHistory.tsx` | 135 | `closeSessionHistory` | |
| `Sessions/SessionHistory.tsx` | 216 | `deleteSession` | |
| `Wizard/WizardContainer.tsx` | 131 | `closeWizard` | |
| `Wizard/WizardSteps/StepApiKey.tsx` | 166 | `pasteApiKey` | |
| `Wizard/WizardSteps/StepAudio.tsx` | 244 | `refreshWindows` | |
| `Profile/ProfileManager.tsx` | 175 | `closeProfileManager` | |
| `Profile/ProfileManager.tsx` | 406 | `setActiveProfile` | |
| `Profile/ProfileManager.tsx` | 414 | `editProfile` | |
| `Profile/ProfileManager.tsx` | 422 | `deleteProfile` | |
| `Debug/DebugView.tsx` | 198 | `closeDebugView` | |
| `Settings/AudioSettings.tsx` | 231 | `refreshWindows` | |
| `Settings/SettingsPage.tsx` | 1096 | `closeSettings` | **self-closing** `<button ... />`, zero content, named only by `title="Close"` |
| `WelcomeScreen.tsx` | 47 | `hideWindow` | **self-closing** `<button ... />`, zero content, named only by `title="Hide"`; calls `toggleMainWindow` |

`ScreenshotItem.tsx:104` is why the gate below rejects *every* hardcoded `aria-label` literal in `src` rather than only the button ones: leaving that one English string in place would fail the gate, and it is spoken text, so localizing it is right on the merits regardless.

Files not already importing `useTranslation` need it added in the position the import-order convention dictates (third-party group). `DragHandle.tsx`, `ScreenshotItem.tsx`, `DevModeToggle.tsx`, `AIResponse.tsx` and `WelcomeScreen.tsx` are the likely candidates.

**The two self-closing controls** (`SettingsPage.tsx:1096`, `WelcomeScreen.tsx:47`) are `<button ... />` with no children at all — a 3px dot styled purely by `className`, with a real `onClick` and no name but a hardcoded English `title`. Add the `aria-label` to the existing attribute list; do not give them children.

**Three custom switches.** `Settings/SettingsPage.tsx:935` (always-on-top), `Settings/SettingsPage.tsx:955` (stealth mode) and `_pages/DebugLive.tsx:307` (opaque mode) are `<button>` elements wrapping a sliding knob `<span>`, with their visible label sitting in a *sibling* element — so they are icon-only by the criterion and today report neither a name nor a state. Each gets `role="switch"` and `aria-checked` bound to the same boolean that drives the knob transform. For the two in `SettingsPage.tsx` the name comes from the **existing** keys `settings.window.alwaysOnTop` and `settings.window.stealthMode` — reuse them, do not add duplicates. `DebugLive.tsx:307` has a hardcoded English "Opaque Mode" sibling, so it uses the new `a11y.label.opaqueMode`.

**Two icon-only toggles.** The mic button in `LiveTranscription.tsx:163` gets `aria-pressed={isActive}` and a label swapping between `stopListening` and `startListening` on the same condition that swaps the icon. The show/hide key button in `StepApiKey.tsx:175` gets `aria-pressed={showKey}` and a label swapping between `hideApiKey` and `showApiKey`. Both are icon-only, so per D-01 the swap is safe here.

**One disclosure that gets no label.** `UnifiedPanel/ResponseSection.tsx:42` gets `aria-expanded={!isResponseCollapsed}` and **nothing else**. It renders a visible `<span>AI Suggestions</span>`, so per D-01 an `aria-label` would override that text and break label-in-name. Do not add one.

**Two remaining menus.** The capture split-button trigger (`UnifiedPanel.tsx` ~549) and the audio source trigger (`AudioSourceSelector.tsx` ~48) each need `aria-haspopup="listbox"` and a live `aria-expanded` bound to `showCaptureDropdown` / `showAudioDropdown`. The audio trigger already renders visible text, so per D-01 it gets no `aria-label` — only the two state attributes. Escape already closes both, wired in Task 1.

**Gates.** Extend `tests/unit/a11yNames.test.tsx`: render `AudioSourceSelector`, `ResponseSection` and `DragHandle` — all three take plain props and need no Electron mocks — and assert accessible names in `en` and again after `i18n.changeLanguage('ru')`, plus `aria-expanded` on the audio trigger and on the suggestions disclosure. For `ResponseSection`, additionally assert that its header button's accessible name still *contains* its visible text, which is what would break if someone later adds the label D-01 forbids.

Also assert that the number of distinct `a11y.label.*` keys referenced across `src` is at least **33**, so a future deletion is caught.

In `tests/unit/i18nParity.test.ts`, set `MIN_KEYS` to **320** — 278 baseline, plus 33 label keys, plus the 9 announcement keys Task 3 adds. Add an `XAN_LABEL_KEYS` array listing the 33 label keys, asserted present in both locales in the same `it.each` shape as `WF4_KEYS`. Note the floor already accounts for Task 3, so this file is edited once here and only the key list grows in Task 3.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json &amp;&amp; npx tsc --noEmit -p tsconfig.electron.json &amp;&amp; npx tsc --noEmit -p tsconfig.node.json</automated>
    <automated>npx vitest run</automated>
    <automated>npx eslint .</automated>
    <automated>node -e "const{execSync}=require('child_process');const out=execSync('grep -rn \"aria-label=\" src --include=*.tsx').toString().split('\n').filter(l=>l&&!/:\s*(\/\/|\*)/.test(l));if(out.length<36)throw new Error('expected at least 36 labelled sites (35 icon-only buttons + the lightbox dialog), found '+out.length);const hard=out.filter(l=>/aria-label=\"/.test(l));if(hard.length)throw new Error('hardcoded label strings still present:\n'+hard.join('\n'));console.log('ok',out.length)"</automated>
    <automated>node -e "const{execSync}=require('child_process');const n=execSync('grep -rn \"role=.switch.\" src --include=*.tsx').toString().trim().split('\n').filter(Boolean).length;if(n<3)throw new Error('expected 3 switch controls, found '+n);const c=execSync('grep -rn \"aria-checked\" src --include=*.tsx').toString().trim().split('\n').filter(Boolean).length;if(c<3)throw new Error('switch without aria-checked, found '+c);console.log('ok')"</automated>
  </verify>
  <done>All 35 qualifying controls carry a locale-sourced accessible name, and so does the lightbox dialog; no `aria-label` anywhere in `src` is a bare string literal; the three switches report `role="switch"` and `aria-checked`; the three menus report `aria-haspopup` and live `aria-expanded`; the two icon-only toggles report `aria-pressed`; `ResponseSection` reports `aria-expanded` and no label; parity holds at MIN_KEYS 320 with no empty values; three typechecks, vitest and eslint clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: The announcer — make session state and settled transcript audible without spamming</name>
  <files>src/components/a11y/LiveAnnouncer.tsx, src/components/a11y/announcements.ts, src/components/a11y/index.ts, src/components/UnifiedPanel/UnifiedPanel.tsx, src/i18n/locales/en.json, src/i18n/locales/ru.json, tests/unit/liveAnnouncer.test.tsx, tests/unit/i18nParity.test.ts</files>
  <read_first>src/components/UnifiedPanel/types.ts (LiveInterviewStatus, ListeningState), src/components/UnifiedPanel/constants.ts (stateLabels), src/components/UnifiedPanel/UnifiedPanel.tsx lines 415-460 and 806-822 (where status.state and status.transcript render)</read_first>
  <behavior>
    Write these as failing tests in `tests/unit/liveAnnouncer.test.tsx` first, then implement.
    - `announcementDelta('Tell me about', 'Tell me about yourself')` returns `' yourself'` — only the appended tail.
    - `announcementDelta('Tell me about', 'Describe a project')` returns `'Describe a project'` — a non-prefix change is a correction or reset, so the whole string is spoken.
    - `announcementDelta('anything', '')` returns `''` — a cleared transcript announces nothing.
    - `useSettledValue` emits nothing while its input changes faster than the delay; with vitest fake timers, five rapid updates followed by one quiet period produce exactly one emission, carrying the final value.
    - `LiveAnnouncer` renders a node with `role="status"`, polite live semantics, `aria-atomic="true"` and the `sr-only` class.
    - Rendering `LiveAnnouncer` with an empty message produces an empty but still-present node — the region must exist before the first announcement or screen readers will not pick it up.
  </behavior>
  <action>
Build the announcer primitive, then wire it into the one screen that has something to announce.

**`src/components/a11y/announcements.ts`.** Export `announcementDelta(previous: string, next: string): string` — a pure function, no React — returning `next.slice(previous.length)` when `next.startsWith(previous)` and `previous` is non-empty, and `next` otherwise; empty `next` returns empty.

Before writing it, read `electron/audio/LiveInterviewService.ts:482-489` (`getUnprocessedTranscriptDelta` — **not** `hasMeaningfulDeltaForHint` at 494, which is a different concern: it filters punctuation-only noise). `getUnprocessedTranscriptDelta` is the same prefix-delta algorithm already running in the main process on the same transcript stream, and its contract matches the spec above on every branch, including the empty-`previous` case, where it returns the whole current transcript. Mirror its semantics exactly. Two divergent notions of "what is new in this transcript" operating on one stream is a bug waiting to happen; if you find a reason they must differ, say why in a comment on the new function rather than letting the divergence be silent.

Also export `useSettledValue<T>(value: T, delayMs: number): T` — a hook holding a settled copy in state and, on every change of `value`, clearing any pending timer and scheduling a new one that promotes `value` into the settled state after `delayMs`; clear the timer on unmount.

**`src/components/a11y/LiveAnnouncer.tsx`.** A component taking `{ message: string }` and rendering a single `<div>` carrying `role="status"`, polite live semantics, `aria-atomic="true"`, `className="sr-only"` (a Tailwind v4 built-in), and `message` as its only child. Per D-02 the politeness is deliberate and must not be raised to assertive. Per the confinement gate below, this is the only file in `src` permitted to carry a live-region attribute — keep the attribute out of every other file, including comments.

**`src/components/a11y/index.ts`.** Barrel re-exporting all three, matching the `src/components/Wizard/index.ts` convention.

**Locale keys** (both files, under `a11y`):

| key | en | ru |
|---|---|---|
| `a11y.state.idle` | Ready | Готов |
| `a11y.state.connecting` | Connecting | Подключение |
| `a11y.state.listening` | Listening | Идёт прослушивание |
| `a11y.state.no_signal` | No audio signal | Нет аудиосигнала |
| `a11y.state.transcribing` | Transcribing | Расшифровка речи |
| `a11y.state.generating` | Generating answer | Генерация ответа |
| `a11y.state.error` | Session error | Ошибка сессии |
| `a11y.announce.state` | Status: {{state}} | Статус: {{state}} |
| `a11y.announce.interviewer` | Interviewer said: {{text}} | Интервьюер сказал: {{text}} |

Note this deliberately parallels rather than replaces `stateLabels` in `UnifiedPanel/constants.ts`: those are the visible badge strings and are still hardcoded English — a real but separate defect, recorded as a follow-up. Do not refactor `constants.ts` in this task.

**Wiring in `UnifiedPanel.tsx`.** Render two `LiveAnnouncer` instances near the root of the returned tree, before the header:

- State region: `const settledState = useSettledValue(status.state, 400)`, message `t('a11y.announce.state', { state: t(`a11y.state.${settledState}`) })`. The 400ms settle is what stops a `connecting` -> `listening` flap from stuttering.
- Transcript region: `const settledTranscript = useSettledValue(status.transcript, 1500)`, then a ref holding what was last announced, and a message computed as `announcementDelta(lastAnnounced, settledTranscript)` wrapped in `t('a11y.announce.interviewer', { text })`, updating the ref as it emits. Per D-02 both the settle and the delta are load-bearing — implementing only one still re-reads the full transcript. When the delta is empty, pass an empty message rather than unmounting the region.

Leave the visible transcript node at line ~815 exactly as it is. Its silence is the point: the announcement is routed through the hidden region instead, which is what makes per-token re-reading impossible by construction.

**Parity floor.** `MIN_KEYS` is already at its final value of 320 (set in Task 2, which budgeted for these nine keys). Do not change it — if the count now mismatches, a key was missed or duplicated, which is exactly what the gate is for. Add the nine keys above to the asserted key list.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/liveAnnouncer.test.tsx</automated>
    <automated>npx tsc --noEmit -p tsconfig.json &amp;&amp; npx tsc --noEmit -p tsconfig.electron.json &amp;&amp; npx tsc --noEmit -p tsconfig.node.json</automated>
    <automated>npx vitest run</automated>
    <automated>npx eslint .</automated>
    <automated>node -e "const{execSync}=require('child_process');let out='';try{out=execSync('grep -rn \"aria-live\" src --include=*.tsx --include=*.ts').toString()}catch(e){};const bad=out.split('\n').filter(l=>l&&!l.includes('a11y/LiveAnnouncer.tsx')&&!/:\s*(\/\/|\*)/.test(l));if(bad.length)throw new Error('live region outside the announcer:\n'+bad.join('\n'));if(!out.includes('LiveAnnouncer.tsx'))throw new Error('announcer has no live region');console.log('ok')"</automated>
    <human-check>
      Screen-reader and contrast behaviour cannot be asserted from vitest; these four checks are the only honest gate for them. Run the app as you normally would and confirm:

      1. **Focus ring, every surface.** Tab through the working overlay. Confirm the ring is clearly visible on the black panel, on the amber notice banner, on the blue Solve button and on the red Stop button. Watch specifically for the ring being *clipped* — several dropdown containers use `rounded-lg overflow-hidden`, which can cut off `outline-offset`. If it is clipped anywhere, that container needs padding rather than the ring needing a different color.
      2. **Focus ring on inputs.** Tab into the Settings API-key field and the app-search box inside the audio dropdown. Both previously set `focus:outline-none`; both must now show the ring. If they do not, the `:focus-visible` rule has ended up inside a `@layer` (D-04).
      3. **Escape closes all three menus.** Open the settings menu, the capture picker and the audio picker in turn and press Escape on each.
      4. **Screen reader, live session.** With Narrator or NVDA running, start a live interview session. Confirm state transitions are spoken once each; confirm the transcript is spoken on speech pauses and that earlier sentences are *not* repeated when new speech arrives. Repetition means the delta is not wired (D-02).
    </human-check>
  </verify>
  <done>`announcementDelta` and `useSettledValue` pass their unit tests; `LiveAnnouncer` is the only file in `src` carrying a live-region attribute; both regions are mounted in the UnifiedPanel and fed settled values; the visible transcript node is unchanged; parity holds at the final floor; three typechecks, full `vitest run` and `eslint` clean; all four human checks confirmed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Live API -> renderer state | `status.transcript` is remote-derived text that this task newly routes into a DOM node and into a screen reader's speech queue |
| Locale files -> accessible names | Locale values become spoken output and are interpolated into i18n templates |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-xan-01 | Information disclosure | `LiveAnnouncer` in `UnifiedPanel` | low | mitigate | The announcer is `sr-only` — clipped, not `display:none` — so it stays out of screen captures the same way the rest of the overlay does. It adds no new persistence and no new IPC surface; the transcript it speaks is already rendered visibly one node away. |
| T-xan-02 | Tampering | i18n interpolation of `status.transcript` | low | accept | Transcript text is passed to `t()` as an interpolation value, not as a key or a template. i18next escaping is disabled project-wide (`escapeValue: false`), but React still escapes the rendered string and no `dangerouslySetInnerHTML` is introduced, so a transcript containing markup renders as literal text. |
| T-xan-03 | Denial of service | `useSettledValue` timers | low | mitigate | Each hook instance holds at most one pending timeout and clears it on both change and unmount, so a high-frequency status stream cannot accumulate timers. |
| T-xan-SC | Tampering | npm/pip/cargo installs | high | mitigate | Not applicable — this plan installs no packages. D-03 declines `eslint-plugin-jsx-a11y` outright, so no legitimacy gate is triggered. |
</threat_model>

<verification>
Baseline that must survive intact:

- `npx tsc --noEmit` clean on all three of `tsconfig.json`, `tsconfig.electron.json`, `tsconfig.node.json`
- `npx vitest run` — 13 existing test files and 126 tests still pass, plus the two new files added here
- `npx eslint .` clean
- `tests/unit/i18nParity.test.ts` passes with `MIN_KEYS` at 320 (278 baseline + 33 label keys + 9 announcement keys), both locales at identical key sets, no empty values
- No `npm run dev`, `start`, `build` or `clean` is invoked by any gate

New gates introduced:

- Exactly one `focus-visible` rule in `src/index.css`, at brace depth zero — the gate checks depth rather than presence, because a rule was already present and had never taken effect
- At least 36 `aria-label` sites in `src/**/*.tsx` (35 icon-only controls + the lightbox dialog), none of them a bare string literal
- Every `a11y.*` key referenced in source resolves non-empty in both locales
- Accessible names asserted in English *and* Russian, so a hardcoded English `title` cannot satisfy the gate
- Live-region attributes confined to `src/components/a11y/LiveAnnouncer.tsx`
</verification>

<success_criteria>
- 35 icon-only controls named from the locale files, plus the lightbox dialog; three custom switches given `role="switch"` and `aria-checked`; zero buttons with visible text given a redundant `aria-label`
- Three custom menus report `aria-haspopup` and live `aria-expanded`, and all three close on Escape
- Session state and settled transcript are announced politely, once per settled change, with only the new transcript tail spoken
- A two-tone focus ring is visible on every keyboard-focusable element, including the ~20 inputs that previously suppressed it
- Locale parity holds at the raised floor with idiomatic Russian for every spoken string
- Baseline typechecks, tests and lint remain clean; the ConfirmDialog work from 260831-wf4 is untouched
</success_criteria>

<out_of_scope>
Recorded explicitly so none of it is lost. None of these are dropped for difficulty — each is either a semantics rebuild (which the brief excludes) or a separate concern.

1. **`src/components/Solutions/SolutionCommands.tsx`** — clickable `<div>`s with decorative `<button>` keycaps inside them. Correct fix is inverting the semantics: the div becomes the button, the keycaps become `<kbd>`. Excluded per D-01 as a rebuild, not a labelling change. Used by `_pages/Solutions.tsx` and `_pages/Debug.tsx`, so it is live code, not dead.
2. **Hardcoded English `title` attributes** on roughly a dozen buttons that also have visible text. They are correct as tooltips and are not the accessible name once Task 2 lands, but they do not localize.
3. **`stateLabels` / `stateBadgeClasses` in `UnifiedPanel/constants.ts`** — the *visible* state strings are hardcoded English. Task 3 adds a parallel localized set for speech rather than refactoring the visible ones, which would ripple through `LiveStateLane` and the debug badges.
4. **`NOTICE_MAP` in `UnifiedPanel/constants.ts`** — notice titles, messages and button labels are hardcoded English.
5. **Focus trapping and initial focus in the three custom menus.** Escape-to-close is delivered here; a full roving-tabindex menu implementation is a larger piece of work.
6. **`eslint-plugin-jsx-a11y`** — declined with reasons in D-03, not deferred by omission.
</out_of_scope>

<output>
Create `.planning/quick/260831-xan-accessibility-pass-label-icon-buttons-an/260831-xan-SUMMARY.md` when done
</output>
</content>
</invoke>
