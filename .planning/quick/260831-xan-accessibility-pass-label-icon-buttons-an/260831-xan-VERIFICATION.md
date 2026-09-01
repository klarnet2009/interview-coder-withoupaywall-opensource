---
phase: quick-260831-xan
verified: 2026-09-01T14:05:00Z
status: gaps_found
score: 5/7 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "The focus indicator is legible on every surface in the overlay — the near-black panel, the amber notice banner, the blue and red action buttons — because it is a two-tone ring (light core over a dark halo) rather than a single color chosen to suit one background."
    status: partial
    reason: >-
      The dark halo landed and works. The LIGHT CORE did not: `--color-ring` was
      raised to `rgba(255, 255, 255, 0.95)` inside `@theme`, but a pre-existing,
      UNLAYERED `:root { --color-ring: rgba(255, 255, 255, 0.4) }` at
      src/index.css:71-73 was left in place. Tailwind emits `@theme` variables
      inside `@layer theme`; unlayered declarations outrank every layered one, so
      the 0.4 value wins and the 0.95 bump has no effect at runtime. This is the
      same cascade-layer defect class that D-04 was written to fix — the rule was
      relocated correctly but the token it reads was left shadowed. Verified by
      compiling src/index.css through @tailwindcss/postcss 4.1.18: the 0.95
      declaration is emitted at out.css:108 inside `@layer theme`, the 0.4
      declaration at out.css:3445-3447 with no enclosing layer.
    artifacts:
      - path: "src/index.css"
        issue: "Lines 71-73 declare an unlayered `:root { --color-ring: rgba(255, 255, 255, 0.4) }` that shadows the `@theme` value at line 5. Also degrades `focus-visible:ring-ring` in ui/button.tsx and ui/input.tsx, which read the same token."
    missing:
      - "Delete the unlayered `:root { --color-ring: ... }` block at src/index.css:71-73 so the `@theme` value at line 5 is the only declaration, OR move the 0.95 value into that unlayered block."
      - "Add a gate that fails when a `@theme` token is shadowed by an unlayered `:root` declaration of the same name — the existing brace-depth gate only inspects `focus-visible` rules and is blind to this."
behavior_unverified_items:
  - truth: "Every focusable element in the app shows a focus indicator when reached by keyboard, including the ~20 inputs that set focus:outline-none."
    test: "Tab through the working overlay, the Settings API-key field, and the app-search box inside the audio dropdown."
    expected: "A visible ring on every stop, not clipped. Several dropdown containers use `rounded-lg overflow-hidden`, which can cut off `outline-offset: 2px`."
    why_human: >-
      The cascade position is provable statically and was proven (the rule is
      unlayered in the compiled output, so it outranks all 33 `focus:outline-none`
      utilities). Whether the ring is actually painted and not clipped by an
      ancestor's overflow is a rendering fact no static check or jsdom test can
      observe.
human_verification:
  - test: "Tab through the overlay: black panel, amber notice banner, blue Solve button, red Stop button, Settings API-key field, audio-dropdown search box."
    expected: "A visible, unclipped focus ring at every stop."
    why_human: "Rendering and clipping cannot be observed statically. NOTE: run this AFTER closing the --color-ring gap above, or the observation will be of the wrong ring."
  - test: "Open the capture-source picker and the audio-source picker in turn and press Escape on each."
    expected: "Each closes; its trigger reports aria-expanded=false."
    why_human: "Only the settings menu is asserted end-to-end in jsdom. The other two share the same handler and the same real setters (verified by inspection), but the dropdown open/close path itself is not exercised by a test."
  - test: "With Narrator or NVDA running, start a live interview session and let the interviewer speak in several bursts."
    expected: "Each session-state transition is spoken once. The transcript is spoken on speech pauses and earlier sentences are NOT repeated when new speech arrives."
    why_human: "Screen-reader utterance count and repetition cannot be observed from vitest. Additionally, no test exercises the UnifiedPanel composition (status.transcript -> useSettledValue -> announcementDelta -> lastAnnouncedRef -> LiveAnnouncer); only the two primitives are unit-tested."
---

# Quick Task 260831-xan: Accessibility Pass — Verification Report

**Task Goal:** Make an Electron interview overlay usable without sight or without a mouse — every icon-only control reports a human-readable accessible name in both locales, live transcript and session-state changes are announced to screen readers without re-reading on every token, focus rings are actually visible, and keyboard navigation works.

**Verified:** 2026-09-01
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 35 icon-only controls report a locale-sourced accessible name; 3 are switches with `role`/`aria-checked`; 2 are self-closing | VERIFIED | Independent scanner (mine, not the plan's): 164 `<button>` tokens in `src`, 0 unpaired — matches the plan exactly. 35 carry `aria-label`, all 35 resolve through `t('a11y.label.*')`, 0 hardcoded literals. All 33 label keys defined and non-empty in `en` + `ru`, 0 orphans in either direction. |
| 2 | Three custom menus declare `aria-haspopup` + live `aria-expanded`, and every one closes on Escape | VERIFIED | `UnifiedPanel.tsx:488-489` (`menu`), `UnifiedPanel.tsx:591-592` (`listbox`), `AudioSourceSelector.tsx:59-60` (`listbox`), each bound to real state. `useUnifiedPanelUiEffects.ts:76-100` registers one `keydown` handler calling all three setters unconditionally; the setters are the real `useState` setters (`UnifiedPanel.tsx:72/74/89`) threaded at the call site (`:113-126`). The settings-menu path is proven end-to-end by a passing jsdom test. |
| 3 | Session state transitions are spoken politely, once per settled transition, from a visually hidden region | VERIFIED | `useSettledValue(status.state, 400)` at `UnifiedPanel.tsx:424`, fed to `<LiveAnnouncer>` at `:457`. `useSettledValue` is behaviourally tested with fake timers: 5 rapid updates produce exactly one emission carrying the final value (`liveAnnouncer.test.tsx`). Region is `role="status" aria-live="polite" aria-atomic="true" class="sr-only"`. |
| 4 | The transcript is announced only after speech settles, only the newly appended tail; the whole transcript is never re-read; the visible node is never a live region | VERIFIED | Settle (1500ms) at `:433` AND delta at `:438`, with `lastAnnouncedRef.current = settledTranscript` — the ref is advanced to the full settled string, not the delta, so the next delta is correct. `announcementDelta` matches `getUnprocessedTranscriptDelta` (`LiveInterviewService.ts:481-488`) branch-for-branch including empty-`previous`. Confinement gate: `aria-live` appears exactly once in all of `src`, in `LiveAnnouncer.tsx`. Never `assertive`, no `role="alert"`. |
| 5 | Every focusable element shows a focus indicator, including the inputs that set `focus:outline-none` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Cascade position proven by compiling the real stylesheet: the `*:focus-visible` rule is emitted **unlayered** (out.css:3586, no enclosing `@layer`), so it outranks all 33 `focus:outline-none` utilities in `@layer utilities`. Whether the ring is painted unclipped by `overflow-hidden` ancestors is a rendering fact — see human verification. |
| 6 | The focus indicator is legible on every surface because it is a two-tone ring (light core over a dark halo) | ✗ FAILED | The halo landed (`--color-focus-halo` is unshadowed). The **light core did not**: an unlayered `:root { --color-ring: rgba(255,255,255,0.4) }` at `src/index.css:71-73` shadows the `@theme` bump to `0.95`. See Gaps Summary. |
| 7 | No button that already shows visible text gains an `aria-label` | VERIFIED | Independent scan of all 35 labelled buttons: **zero** raw text nodes. The 4 with expression children are conditionals whose every branch is an element (`isActive ? <Mic/> : <MicOff/>` etc.). Text-bearing controls correctly left alone, including the two the plan named: `StatusBar.tsx:203` (hotkeys, `hidden sm:inline` span) and `AudioSourceSelector.tsx:53` (source trigger). |

**Score:** 5/7 truths verified (1 present, behaviour-unverified; 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/components/a11y/LiveAnnouncer.tsx` | Only file in `src` with a live-region attribute | VERIFIED | 27 lines. `role="status" aria-live="polite" aria-atomic="true" className="sr-only"`, always mounted. Grep across `src/**/*.{ts,tsx}` returns exactly one `aria-live`, in this file. |
| `src/components/a11y/announcements.ts` | `useSettledValue` + pure `announcementDelta` | VERIFIED | 56 lines. Delta is pure, no React. Hook holds one timer, clears on change and on unmount. Both wired into `UnifiedPanel.tsx`. |
| `src/index.css` | Focus rule relocated out of `@layer base`; `--color-ring` strengthened; `--color-focus-halo` added | ⚠️ PARTIAL | Relocation VERIFIED (old rule at 128-132 deleted, one rule at brace depth 0). `--color-focus-halo` VERIFIED. `--color-ring` strengthening **INEFFECTIVE** — shadowed (see gap). |
| `src/i18n/locales/{en,ru}.json` | `a11y` namespace holding every spoken string | VERIFIED | 320 keys each, identical sets, no empty values. 42 new: 33 labels + 7 states + 2 templates. |
| `tests/unit/a11yNames.test.tsx` | Accessible-name assertions in en and ru | VERIFIED | 324 lines, 18 tests, all passing. Asserts *computed* names via `getByRole({name})` in both locales, plus the D-01 guards. Not vacuous. |
| `tests/unit/liveAnnouncer.test.tsx` | Debounce, delta and live-region assertions | VERIFIED | 140 lines, 9 tests, all passing. Covers all four delta branches including empty-`previous`, fake-timer emission counting, and `is never assertive`. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `status.state` | `LiveAnnouncer` | `useSettledValue(400)` | WIRED | `UnifiedPanel.tsx:424 -> 425-427 -> 457`. Settled value, not raw. |
| `status.transcript` | `LiveAnnouncer` | `useSettledValue(1500)` + `announcementDelta` | WIRED | `:433 -> :438 -> :441 -> :458`. Both mechanisms present; ref advanced to the full settled string. |
| `useUnifiedPanelUiEffects` keydown | 3 setters | Escape handler | WIRED | All three setters called; all three are real `useState` setters passed at `UnifiedPanel.tsx:113-126`. |
| `@theme --color-ring` | `*:focus-visible` outline | `var(--color-ring)` | **BROKEN** | Intercepted by unlayered `:root` at `index.css:71-73`. |
| `index.css` unlayered rule | Tailwind `@layer utilities` | cascade-layer precedence | WIRED | Compiled output confirms the rule sits outside every layer. |
| `a11y.*` keys | `i18nParity.test.ts` MIN_KEYS | floor = 320 | WIRED | Final floor is exactly 320 and both locales hold exactly 320 keys. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `LiveAnnouncer` (state) | `stateAnnouncement` | `status.state` from `onLiveInterviewStatus` IPC, via settle + `t()` | Yes | FLOWING |
| `LiveAnnouncer` (transcript) | `transcriptAnnouncement` | `status.transcript` from the same IPC stream, via settle + delta | Yes | FLOWING |
| 35 labelled controls | `t('a11y.label.*')` | `en.json` / `ru.json` | Yes — every key resolves non-empty in both locales, 0 orphans | FLOWING |
| `*:focus-visible` outline colour | `var(--color-ring)` | `@theme` (line 5) — **intercepted** by `:root` (line 72) | Resolves, but to the OLD value | ⚠️ STATIC |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Independent button census | custom brace-matching scanner over `src/**/*.tsx` | 164 buttons, 0 unpaired, 35 labelled, 0 labelled-with-text | PASS |
| Unlabelled icon-only leftovers | classifier over the 129 unlabelled buttons | 0 — every one is text-bearing or an excluded `SolutionCommands` keycap | PASS |
| `--color-ring` effective value | compile `src/index.css` via `@tailwindcss/postcss` 4.1.18, inspect layer nesting | 0.95 at out.css:108 inside `@layer theme`; **0.4 at out.css:3445 unlayered** | **FAIL** |
| Focus-rule brace depth | plan's node gate | `occurrences 1, depths 0` | PASS |
| Focus-rule gate is not blind | mutation test — reinserted a nested rule in `@layer base` | `depths 1,0` -> gate throws | PASS |
| i18n parity per commit | replayed the parity assertions against each of the 4 commits' locale files + that commit's own MIN_KEYS/key lists | 279/279, 311/311, 311/311, 320/320 — all GREEN | PASS |
| Line-ending churn | byte-level CRLF/LF census of blobs before vs after | Committed blobs are LF-normalized at both ends; no EOL rewrite entered history | PASS |
| `npx tsc --noEmit` x3 configs | app / electron / node | exit 0, 0, 0 | PASS |
| `npx vitest run` | full suite, run once | **15 files, 237 tests passed** | PASS |
| `npx eslint .` | — | exit 0 | PASS |
| Plan gate: >=36 `aria-label`, none literal | verbatim | `ok 36` | PASS |
| Plan gate: >=3 `role="switch"` + `aria-checked` | verbatim | `ok 3 3` | PASS |
| Plan gate: live region confined | verbatim | `ok` | PASS |

### Scrutiny Items Requested

**1. The 35 + 1 = 36 count, re-derived independently.** My own brace-matching scanner (written without reference to the plan's) reports **164 buttons, 0 unpaired** — identical to the plan's figure. Exactly **35** carry an `aria-label`; the 36th `aria-label` site is the lightbox `<div role="dialog">` at `ScreenshotItem.tsx:104-106`. Stripping tags and JSX comments from each labelled button's inner content leaves **zero non-whitespace text in all 35**. The four whose children are expressions (`LiveTranscription:165`, `AIResponse:217`, `AIResponse:226`, `StepApiKey:178`) are conditionals with element-only branches. Two are self-closing with no content at all (`SettingsPage:1102`, `WelcomeScreen:47`). **No D-01 regression: no button rendering visible text gained an accessible name.** Conversely, of the 129 unlabelled buttons, every one either renders a raw text node (64) or a text-bearing expression (65) — including the four `SolutionCommands` `{COMMAND_KEY}` keycaps, correctly excluded. No 36th qualifying control was missed.

**2. `ResponseSection.tsx:42`.** Carries `aria-expanded={!isResponseCollapsed}` at line 44 and **nothing else** — no `aria-label`, no `role`. Its visible `<span>AI Suggestions</span>` at line 51 is untouched, so the computed accessible name still contains it. Two tests guard this: `getByRole('button', { expanded, name: /AI Suggestions/ })` (which uses the computed name) and an explicit `hasAttribute('aria-label') === false` containment assertion.

**3. Focus-visible relocation.** Exactly one `focus-visible` rule in `src/index.css`, at brace depth 0. The old `@layer base` rule at 128-132 is genuinely deleted — the git diff shows it as a `-` hunk, and the depth gate reports a single occurrence. I mutation-tested the gate by reinserting a nested copy inside `@layer base`: the gate reports `depths 1,0` and throws. **The depth check would catch a leftover.** Compiled output independently confirms the surviving rule is emitted with no enclosing `@layer`. *However*, see the gap: the relocated rule now reads a shadowed token.

**4. The live announcer.** It does **not** re-announce the whole transcript per token, by two independent constructions. `LiveInterviewService` replaces `status.transcript` wholesale on every partial event; `useSettledValue(…, 1500)` suppresses everything until the stream goes quiet (unit-tested: 5 rapid updates -> exactly 1 emission), and `announcementDelta(lastAnnouncedRef.current, settled)` then returns only the appended tail. The ref is advanced to the **full settled string**, not the delta — the ordering that makes the next delta correct. `announcementDelta` agrees with `getUnprocessedTranscriptDelta` (`LiveInterviewService.ts:481-488`) on all four branches: empty-`next` -> `''`, **empty-`previous` -> whole string**, prefix -> slice, non-prefix -> whole string. Politeness is `polite`; the file contains no `assertive` and no `role="alert"`, and a test asserts `not.toBe('assertive')`. `aria-live` appears exactly once in all of `src` and only in `LiveAnnouncer.tsx`; the visible transcript node was not touched. Residual risk (routed to human): no test exercises the UnifiedPanel composition itself, only the two primitives.

**5. The three switches.** `SettingsPage.tsx:935` (`role="switch"` :941, `aria-checked={alwaysOnTop}` :942, name from `settings.window.alwaysOnTop`), `SettingsPage.tsx:958` (:964/:965, `stealthMode`), `DebugLive.tsx:309` (:315/:316, `opaqueMode`, name from `a11y.label.opaqueMode`). In all three, `aria-checked` is bound to **the same boolean that drives the knob's `translate-x` transform** — not a constant. Name and state both reported.

**6a. MIN_KEYS staging (279 -> 311 -> 320).** Sound, and the executor's stated reason is correct: the plan's Task 2 instruction to set the floor to 320 while Task 2 only reaches 311 keys would have made Task 2's own `vitest run` gate red. I replayed every parity assertion (key-set symmetry, count >= floor, every named key present in both locales, no empty values) against each commit's own test file and locale files: `23da741` 279/279 GREEN, `84da5db` 311/311 GREEN, `674b785` 311/311 GREEN, `aace033` 320/320 GREEN. **The final floor is exactly 320 and both locales hold exactly 320 keys**, so the invariant the plan cared about — deleting the new keys from both files cannot quietly pass — is intact.

**6b. The `\r?\n` matcher.** Sound. `git diff --stat 3f6a07c..HEAD` shows 1-8 changed lines per component file (largest: `ScreenshotItem.tsx`, 8). Total 902 insertions / 13 deletions across 31 files, of which 5 are new files and the 13 deletions are the 5-line focus rule plus a no-newline-at-EOF fixup in `index.css`. **No whole-file rewrite in any commit.** Byte-level check: the committed blobs are LF-normalized both before and after (`core.autocrlf=true`), so no line-ending churn entered history. The mixed CRLF/LF the executor hit exists only in the working tree, as it did before the task.

**7. i18n and Russian quality.** 320 keys in each file, key sets identical, no empty values, 42 new `a11y` keys (33 + 7 + 2). I read every new Russian string. **They are idiomatic Russian, not transliteration and not machine word order.** Correct case government throughout (`Обновить список источников захвата` — genitive plural; `Назад к списку сессий` — dative). Correct domain terminology rather than calques: `буфер обмена` for clipboard, `горячие клавиши` for hotkeys, `мастер настройки` for wizard, `Свернуть окно` for minimize, `инструменты разработчика` for devtools. `ё` used correctly (`Идёт прослушивание`). The remove/delete distinction is preserved (`Убрать снимок экрана` vs `Удалить снимок экрана`), matching the English. `Сделать профиль активным` is a natural rendering rather than a literal "Установить как активный профиль". One cosmetic nit, not a defect: `a11y.state.idle` = `Готов` (masculine short adjective) would read more naturally as `Готово` for an impersonal system state.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/index.css` | 71-73 | Duplicate unlayered `:root` token shadowing a `@theme` token | 🛑 Blocker | Nullifies the `--color-ring` strengthening; see gap |
| — | — | `TODO` / `FIXME` / `TBD` / `XXX` / `PLACEHOLDER` in files touched by this task | — | None found |
| — | — | Stub returns, empty handlers, hardcoded empty props | — | None found |

No debt markers were introduced. No skipped tests. No `.only`. No new dependencies (D-03 honoured).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| QUICK-260831-xan | 260831-xan-PLAN.md | Accessibility pass: label icon buttons, announce state and transcript, restore focus rings, keyboard-dismissable menus | PARTIAL | 5 of 7 truths verified; naming, announcing and keyboard dismissal all land; the focus-ring *strength* does not |

### Human Verification Required

#### 1. Focus ring on every surface

**Test:** Tab through the working overlay — black panel, amber notice banner, blue Solve button, red Stop button — then into the Settings API-key field and the app-search box inside the audio dropdown.
**Expected:** A visible, unclipped ring at every stop. Watch for clipping by `rounded-lg overflow-hidden` dropdown containers, which can cut off `outline-offset: 2px`.
**Why human:** Painting and clipping cannot be observed statically or in jsdom.
**Sequencing:** Close the `--color-ring` gap first, or you will be judging a 40%-white core that was never the intended design.

#### 2. Escape closes the capture and audio pickers

**Test:** Open the capture-source picker, press Escape. Repeat for the audio-source picker.
**Expected:** Each closes; its trigger reports `aria-expanded=false`.
**Why human:** Only the settings menu is asserted end-to-end in jsdom. The other two share the identical handler and the identical real setters (verified by reading the call site), but the dropdown open/close path is not exercised by a test.

#### 3. Screen reader, live session

**Test:** With Narrator or NVDA running, start a live interview session and let the interviewer speak in several bursts separated by pauses.
**Expected:** Each session-state transition is spoken exactly once. The transcript is spoken on speech pauses, and earlier sentences are NOT repeated when new speech arrives.
**Why human:** Utterance count and repetition are unobservable from vitest. Additionally, no test covers the UnifiedPanel composition (`status.transcript -> useSettledValue -> announcementDelta -> lastAnnouncedRef -> LiveAnnouncer`); only the two primitives are unit-tested. Repetition would mean the ref-advance ordering is wrong.

### Gaps Summary

**One gap, one line, high leverage.**

The task's headline framing is that a focus rule already existed and had never taken effect because `@layer base` loses to `@layer utilities`. That diagnosis was right and the relocation is correct — the rule is now unlayered and provably outranks all 33 `focus:outline-none` utilities. But the same task also raised `--color-ring` from 40% to 95% white, and **that half did not take effect, for the same reason in mirror image**: `src/index.css:71-73` holds a pre-existing, *unlayered* `:root { --color-ring: rgba(255, 255, 255, 0.4) }`, and Tailwind emits `@theme` variables inside `@layer theme`. Unlayered beats layered. The 0.95 value is dead.

I verified this rather than inferred it, by compiling the real stylesheet through `@tailwindcss/postcss` 4.1.18 and locating both declarations in the output: `--color-ring: rgba(255,255,255,0.95)` at line 108, enclosed by `@layer theme {`; `--color-ring: rgba(255,255,255,0.4)` at line 3445, enclosed by nothing.

Consequences:

- The "two-tone ring" ships as a near-black halo with a **mid-grey core** (40% white composited over the 0.9-black halo beneath it), not the light core the design calls for. The indicator is still discernible on every surface — the halo carries the contrast — so this degrades rather than destroys the outcome.
- `focus-visible:ring-ring` in `ui/button.tsx` and `ui/input.tsx` reads the same token, so the improvement D-04 promised those components also did not happen. (Those rings are suppressed by the unlayered `box-shadow` anyway, per D-04's stated trade.)
- The SUMMARY's claim "`--color-ring` was raised from 40% to 95% white" is true of the source text and false of the rendered result.

**Fix:** delete `src/index.css:71-73`. The `@theme` declaration at line 5 then becomes the only one. Consider adding a gate for shadowed theme tokens — the existing brace-depth gate is scoped to `focus-visible` rules and is structurally blind to this class of defect, which is now the second instance of it in this file.

Everything else in the task holds up under independent re-derivation: the button census, the D-01 non-regression, the delta/settle design, the switch semantics, the Escape wiring, the MIN_KEYS staging, the absence of file rewrites, and the Russian.

---

*Verified: 2026-09-01*
*Verifier: Claude (gsd-verifier)*
