---
phase: quick-260831-xan
plan: 01
subsystem: ui
tags: [accessibility, a11y, aria, i18n, react, tailwind, screen-reader, vitest, testing-library]

requires:
  - phase: quick-260831-wf4
    provides: ConfirmDialog primitive, jsdom test conventions, i18n parity gate
provides:
  - 35 icon-only controls with locale-sourced accessible names, plus the lightbox dialog
  - Three custom switches reporting role=switch and aria-checked
  - Three custom menus reporting aria-haspopup and live aria-expanded, all closing on Escape
  - A polite live-region announcer for session state and settled transcript
  - A focus indicator that actually takes effect, on every focusable element
affects: [ui, settings, unified-panel, wizard, i18n, future-a11y-work]

tech-stack:
  added: []
  patterns:
    - "Live regions confined to a single component, enforced by a source-scanning gate"
    - "Accessible names asserted in both locales, so a hardcoded English title cannot satisfy the gate"
    - "Unlayered CSS for cascade-critical rules that must outrank Tailwind utilities"

key-files:
  created:
    - src/components/a11y/LiveAnnouncer.tsx
    - src/components/a11y/announcements.ts
    - src/components/a11y/index.ts
    - tests/unit/a11yNames.test.tsx
    - tests/unit/liveAnnouncer.test.tsx
  modified:
    - src/index.css
    - src/i18n/locales/en.json
    - src/i18n/locales/ru.json
    - src/components/UnifiedPanel/UnifiedPanel.tsx
    - src/components/UnifiedPanel/useUnifiedPanelUiEffects.ts
    - src/components/UnifiedPanel/AudioSourceSelector.tsx
    - src/components/UnifiedPanel/ResponseSection.tsx
    - src/components/Settings/SettingsPage.tsx
    - src/components/Profile/ProfileManager.tsx
    - src/components/Sessions/SessionHistory.tsx
    - src/components/Queue/ScreenshotItem.tsx
    - tests/unit/i18nParity.test.ts

key-decisions:
  - "Only buttons whose entire rendered content is an icon get an aria-label; a button with visible text is left alone so voice control can still say what it reads"
  - "Both live regions are polite, never assertive, because the screen reader is the user's only audio channel while a human interviewer is talking"
  - "The transcript needs the settle window AND the prefix delta; either alone still re-reads the accumulated transcript"
  - "The focus rule was relocated out of @layer base rather than added, because a rule already existed and had never taken effect"

patterns-established:
  - "a11y namespace in the locale files holds every string that is spoken rather than shown"
  - "Source-scanning gates assert facts about the whole of src, not just the file under test"

requirements-completed: [QUICK-260831-xan]

coverage:
  - id: D1
    description: "35 icon-only controls plus the lightbox dialog report a locale-sourced accessible name, in English and in Russian"
    requirement: QUICK-260831-xan
    verification:
      - kind: unit
        ref: "tests/unit/a11yNames.test.tsx#names the settings gear from the ru locale"
        status: pass
      - kind: unit
        ref: "tests/unit/a11yNames.test.tsx#names the refresh control from the ru locale"
        status: pass
      - kind: unit
        ref: "tests/unit/a11yNames.test.tsx#names minimize and close from the ru locale"
        status: pass
      - kind: other
        ref: "grep gate: >=36 aria-label sites in src/**/*.tsx, none a bare string literal"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three custom menus declare aria-haspopup with a live aria-expanded, and all three close on Escape"
    requirement: QUICK-260831-xan
    verification:
      - kind: unit
        ref: "tests/unit/a11yNames.test.tsx#closes the settings menu on Escape"
        status: pass
      - kind: unit
        ref: "tests/unit/a11yNames.test.tsx#reports the source trigger as expanded once the list is open"
        status: pass
    human_judgment: true
    rationale: "The capture and audio pickers are covered by the shared keydown effect the settings-menu test exercises, but only the settings menu is asserted end to end in jsdom; confirming the other two needs the running overlay."
  - id: D3
    description: "Session state and the settled transcript are announced politely, once per settled change, with only the new tail spoken"
    requirement: QUICK-260831-xan
    verification:
      - kind: unit
        ref: "tests/unit/liveAnnouncer.test.tsx#emits once with the final value after a burst of rapid updates"
        status: pass
      - kind: unit
        ref: "tests/unit/liveAnnouncer.test.tsx#returns only the appended tail when the transcript grew"
        status: pass
      - kind: unit
        ref: "tests/unit/liveAnnouncer.test.tsx#renders a polite, atomic status region that is visually hidden"
        status: pass
      - kind: other
        ref: "grep gate: live-region attribute confined to src/components/a11y/LiveAnnouncer.tsx"
        status: pass
    human_judgment: true
    rationale: "Whether a screen reader actually speaks each transition once, and does not repeat earlier sentences, can only be observed with Narrator or NVDA against a live session."
  - id: D4
    description: "A two-tone focus indicator is visible on every keyboard-focusable element, including the ~20 inputs that set focus:outline-none"
    requirement: QUICK-260831-xan
    verification:
      - kind: other
        ref: "node gate: exactly one focus-visible rule in src/index.css, at brace depth zero"
        status: pass
    human_judgment: true
    rationale: "Contrast and clipping are visual judgements. The gate proves the rule can now win the cascade; it cannot prove the ring is legible on the amber banner or unclipped by rounded-lg overflow-hidden containers."
  - id: D5
    description: "Three custom switches report role=switch and aria-checked; two icon-only toggles report aria-pressed; the text-bearing disclosure reports aria-expanded and deliberately no label"
    requirement: QUICK-260831-xan
    verification:
      - kind: unit
        ref: "tests/unit/a11yNames.test.tsx#keeps the visible text inside the accessible name"
        status: pass
      - kind: unit
        ref: "tests/unit/a11yNames.test.tsx#leaves the text-bearing source trigger unlabelled"
        status: pass
      - kind: other
        ref: "node gate: >=3 role=switch and >=3 aria-checked sites in src/**/*.tsx"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-09-01
status: complete
---

# Quick Task 260831-xan: Accessibility Pass Summary

**The always-on-top interview overlay is now operable without a mouse and audible without eyes: 35 icon-only controls carry Russian and English accessible names, session state and the settled transcript are spoken through a purpose-built polite region, and the focus ring that had been silently losing the cascade since it was written now actually renders.**

## Performance

- **Duration:** ~28 min
- **Tasks:** 3 of 3
- **Commits:** 4 (one tracer, one expansion, one TDD RED, one TDD GREEN)
- **Files changed:** 31 (902 insertions, 13 deletions)

## Accomplishments

- **35 icon-only controls named from the locale files**, plus the screenshot lightbox dialog — 36 `aria-label` sites in total, none of them a bare string literal. Two of them (`AIResponse.tsx` expand, `StatusBar.tsx` hotkeys-modal close) had no accessible name of any kind beforehand, and two more are self-closing `<button ... />` with no content at all, previously named only by a hardcoded English `title`.
- **The focus indicator was relocated, not added.** `src/index.css` already had a `*:focus-visible` rule, but it sat inside `@layer base`, which Tailwind orders before `@layer utilities` — so it lost to every `focus:outline-none` on the ~20 inputs and every `focus-visible:ring-*` on the buttons. Moving it to top level is the whole fix. `--color-ring` was raised from 40% to 95% white and a `--color-focus-halo` added, making the ring two-tone so it reads on the near-black panel, the amber banner, and the blue and red action buttons alike.
- **Escape now closes all three custom menus.** Before this, the settings menu had no dismissal path at all for a keyboard user, and the two dropdowns only responded to a pointer.
- **The app's primary output stopped being silent.** `aria-live` appeared zero times in `src` before this pass. Two polite regions now announce settled session state (400 ms) and the newly appended transcript tail (1500 ms settle plus a prefix delta).
- **Three custom switches gained real semantics.** Always-on-top, stealth mode and opaque mode are `<button>` elements wrapping a sliding knob with their visible label in a *sibling* node, so they reported neither a name nor a state. Each now carries `role="switch"` and `aria-checked`.
- **Two new test files, 27 new tests**, asserting *computed* accessible names in English and Russian rather than attribute presence — which is what makes a hardcoded English `title` unable to satisfy the gate.

## Task Commits

1. **Task 1 (tracer): End-to-end accessibility slice — one button, all five layers** — `23da741` (feat)
2. **Task 2: Expand — name the remaining 34 icon-only controls and finish the two other menus** — `84da5db` (feat)
3. **Task 3 (TDD RED): failing tests for the live announcer** — `674b785` (test)
4. **Task 3 (TDD GREEN): announce session state and settled transcript** — `aace033` (feat)

No REFACTOR commit: the GREEN implementation needed no cleanup.

## Files Created/Modified

**Created**
- `src/components/a11y/announcements.ts` — `announcementDelta` (pure prefix delta) and `useSettledValue` (debounce hook)
- `src/components/a11y/LiveAnnouncer.tsx` — the only file in `src` permitted to carry a live-region attribute
- `src/components/a11y/index.ts` — barrel, matching the `Wizard/index.ts` convention
- `tests/unit/a11yNames.test.tsx` — 18 tests: accessible names in both locales, popup/expanded state, Escape, the D-01 label-in-name guard, and a source scan asserting every `a11y.` key referenced in `src` resolves non-empty in both locales
- `tests/unit/liveAnnouncer.test.tsx` — 9 tests: delta semantics on all four branches, fake-timer settle behaviour, and the live-region contract

**Modified (highlights)**
- `src/index.css` — focus rule relocated out of `@layer base`; `--color-ring` strengthened; `--color-focus-halo` added
- `src/i18n/locales/en.json` / `ru.json` — new `a11y` namespace: 33 label keys + 7 state keys + 2 announcement templates, 278 → 320 keys
- `src/components/UnifiedPanel/UnifiedPanel.tsx` — settings gear named and state-reporting, capture picker state-reporting, menu roles, two announcers mounted at the root
- `src/components/UnifiedPanel/useUnifiedPanelUiEffects.ts` — new Escape effect reaching all three overlay setters
- 17 further component files — one attribute each, plus a `useTranslation` import where absent
- `tests/unit/i18nParity.test.ts` — floor raised to 320, 42 new keys asserted by name

## Decisions Made

Followed the plan's four decisions (D-01 through D-04) as written. Two implementation choices were made inside the space they left open:

1. **The tracer test renders the real `UnifiedPanel`, not the documented fallback.** The plan allowed dropping back to `AudioSourceSelector` if the panel proved to need mocking. It does need mocking — but its entire external surface is `window.electronAPI`, and a `Proxy` returning an unsubscribe function for every `on*` member and a resolved promise for everything else satisfies it in eleven lines. That buys a materially stronger tracer: the settings gear, its `aria-expanded` toggle and the Escape path are all exercised through the same code path the browser uses, rather than being left to the key-resolution scan.
2. **`AIResponse.tsx:223` gets a stable label plus `aria-expanded`, not a swapping label.** The plan specified this explicitly; recording it here because the two *other* icon-only toggles in this pass do swap their labels, and the asymmetry is deliberate rather than an oversight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `MIN_KEYS` staging contradiction between Task 2 and Task 3**

- **Found during:** Task 2
- **Issue:** The plan directed Task 2 to set `MIN_KEYS` to its final value of **320** while Task 2 itself only brings the locale files to **311** keys — the remaining 9 arrive in Task 3. Task 2's own `npx vitest run` gate would therefore have failed, which conflicts with committing each task atomically with green gates.
- **Fix:** Staged the floor instead: Task 1 set it to 279, Task 2 to 311, Task 3 to the required final **320**. The invariant the plan actually cares about — that the floor ends at exactly 320, so deleting the new keys from both files cannot quietly pass — is preserved, and every intermediate commit is green.
- **Files modified:** `tests/unit/i18nParity.test.ts`
- **Verification:** `npx vitest run` green at each of the three commits; final state has 320 keys in both locales with `MIN_KEYS = 320`.
- **Committed in:** `23da741`, `84da5db`, `aace033`

**2. [Rule 3 - Blocking] Mixed CRLF/LF line endings inside single files**

- **Found during:** Task 2
- **Issue:** Several files (`StatusBar.tsx` notably) contain *both* CRLF and LF line endings. Exact-string edits keyed to either newline alone silently failed to match.
- **Fix:** Edits were applied through a line-ending-agnostic matcher (`\r?\n`) that reuses whatever newline the matched region used, keeping the diff confined to the edited lines. Confirmed by `git diff --stat`: the largest source-file diff is 8 lines.
- **Files modified:** none beyond the intended edits — this changed *how* the edits were applied, not what they were.
- **Verification:** `git diff --stat` shows 1–8 changed lines per component file, with no whole-file rewrites.
- **Committed in:** `84da5db`

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues).
**Impact on plan:** None on scope or outcome. Both were mechanical obstacles to executing the plan as written; neither changed what shipped.

## Issues Encountered

None beyond the two deviations above. No 36th qualifying control was found — the scanner-derived set of 35 held exactly, and the final `aria-label` count of 36 (35 buttons + the lightbox dialog) matches the plan's prediction precisely.

## Verification

All automated gates green:

| Gate | Result |
|---|---|
| `npx tsc --noEmit` on all three tsconfigs | clean |
| `npx vitest run` | **15 files, 237 tests** passing (baseline was 13 / 126) |
| `npx eslint .` | clean |
| Locale parity, `MIN_KEYS = 320` | 320 keys in both files, no empty values |
| Exactly one `focus-visible` rule at brace depth zero | pass |
| ≥36 `aria-label` sites, none a bare string literal | 36, none hardcoded |
| ≥3 `role="switch"` with `aria-checked` | 3 and 3 |
| Live-region attribute confined to `LiveAnnouncer.tsx` | pass |

The ConfirmDialog work from 260831-wf4 is untouched and its 6 tests still pass.

## Human Verification Outstanding

Task 3's four `<human-check>` items **were not performed** — they require running the Electron app, which this execution was explicitly instructed not to do (`npm run dev`/`start`/`build` were off-limits, and the app may be running in dev mode). They remain the only honest gate for the visual and screen-reader behaviour:

1. **Focus ring, every surface.** Tab through the overlay; confirm the ring is visible on the black panel, the amber notice banner, and the blue Solve and red Stop buttons. Watch for *clipping* — several dropdown containers use `rounded-lg overflow-hidden`, which can cut off `outline-offset`. If clipped, the container needs padding, not the ring a different colour.
2. **Focus ring on inputs.** Tab into the Settings API-key field and the app-search box in the audio dropdown. Both previously set `focus:outline-none`; both must now show the ring.
3. **Escape closes all three menus.** Settings menu, capture picker, audio picker.
4. **Screen reader, live session.** With Narrator or NVDA, start a live interview. State transitions should be spoken once each; the transcript should be spoken on speech pauses with earlier sentences *not* repeated.

**Expected side effects of D-04, not bugs:** because the new focus rule is unlayered, its `box-shadow` outranks Tailwind's `focus-visible:ring-*` utilities. The shadcn `ring-1 ring-ring` on `button.tsx` and `input.tsx` will not render while focused, and any decorative `shadow-*` on a focused element is suppressed for the duration of focus. This is the intended trade — one strong consistent indicator instead of a 40%-opacity 1px ring on some controls and nothing on others.

## Known Stubs

None. No placeholder values, no skipped tests, no unrun automated gates.

## Out of Scope (carried forward)

Recorded in the plan and still outstanding:

1. `src/components/Solutions/SolutionCommands.tsx` — clickable `<div>`s with decorative `<button>` keycaps inside. The correct fix inverts the semantics (div becomes the button, keycaps become `<kbd>`); labelling the keycaps would add eight phantom tab stops that do nothing.
2. Hardcoded English `title` attributes on roughly a dozen text-bearing buttons. Harmless as tooltips now that they are no longer the accessible name, but they do not localize.
3. `stateLabels` / `stateBadgeClasses` / `NOTICE_MAP` in `UnifiedPanel/constants.ts` — the *visible* state strings and notice text are still hardcoded English. Task 3 added a parallel localized set for speech rather than refactoring these, which would ripple through `LiveStateLane` and the debug badges.
4. Focus trapping and initial focus in the three custom menus. Escape-to-close shipped; a full roving-tabindex implementation did not.
5. `eslint-plugin-jsx-a11y` — declined with reasons in D-03, not deferred by omission.

## Self-Check: PASSED

All created files exist on disk; all four commit hashes resolve in `git log`; full suite green at HEAD.

---
*Quick task: 260831-xan*
*Completed: 2026-09-01*
