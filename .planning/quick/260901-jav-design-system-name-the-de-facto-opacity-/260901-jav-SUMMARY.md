---
phase: quick-260901-jav
plan: 01
subsystem: ui
tags: [tailwind-v4, design-tokens, cva, shadcn, class-variance-authority, tailwind-merge, vitest, cascade-layers]

requires:
  - phase: quick-260831-xan
    provides: the unlayered `*:focus-visible` rule the rebuilt primitive now depends on instead of carrying its own ring
  - phase: quick-260831-wf4
    provides: ConfirmDialog, whose destructive styling became the `destructive` variant and whose test file is the only pre-existing coverage of a migrated call site
provides:
  - Nine `@theme` tokens (four `--color-surface-*`, five `--opacity-*`), each with a proven consumer
  - A button primitive whose every class emits real CSS against this project's own stylesheet
  - Eleven migrated call sites across five files, ratcheted
  - Seven standing gates in `tests/unit/designSystem.test.ts`, each verified against a deliberate break
  - Zero hex colour literals in the `.ts`/`.tsx` sources
affects: [ui, settings, wizard, unified-panel, accessibility, any future button migration]

tech-stack:
  added: []
  patterns:
    - "Token layer is the `@theme` block in `src/index.css`, and nowhere else"
    - "Named `--opacity-*` steps alias numeric modifiers rather than replacing them, so a scale can be declared without a mass rename"
    - "Gates compile candidate classes through the project's OWN stylesheet, not Tailwind defaults"
    - "A token is declared only when a consumer is wired to it in the same change"

key-files:
  created:
    - tests/unit/designSystem.test.ts
    - tests/unit/button.test.tsx
  modified:
    - src/index.css
    - src/components/ui/button.tsx
    - src/components/ui/confirm-dialog.tsx
    - src/components/ErrorBoundary.tsx
    - src/components/Header/Header.tsx
    - src/components/UpdateNotification.tsx
    - src/components/WelcomeScreen.tsx
    - .planning/codebase/CONVENTIONS.md
  deleted:
    - src/styles/design-system.ts

key-decisions:
  - "Named opacity tokens alias the numeric form rather than replacing it — no mass rename, and the equivalence is machine-proven"
  - "The 403-line unconsumed token module was deleted, not extended; a second dead token layer was the one outcome to avoid"
  - "The 75 off-scale opacity applications are grandfathered and pinned, not snapped — no automated check can tell a correct snap from a wrong one"
  - "Population floor set at 1,100 rather than the plan's 1,200, which predated the plan's own migration"
  - "`#0d1117` / `#161B22` tokenised at their current values; whether the code canvas should match the modal surface is left open"

patterns-established:
  - "No-op class gate: any styling class that compiles to nothing against `src/index.css` fails CI by name"
  - "Two-part equivalence proof: byte-identical unconditional declaration plus `var()` resolution inside the `@supports` oklab branch"
  - "Ratchets carry an anti-attrition population floor so a deletion cannot satisfy an absolute budget"

requirements-completed: [QUICK-260901-jav]

coverage:
  - id: D1
    description: "Four `--color-surface-*` tokens declared once in `@theme`; all 22 component hex literals replaced losslessly"
    requirement: "QUICK-260901-jav"
    verification:
      - kind: unit
        ref: "tests/unit/designSystem.test.ts#token equivalence > gives each colour token the exact value of the literal it replaced"
        status: pass
      - kind: unit
        ref: "tests/unit/designSystem.test.ts#token equivalence > compiles each colour token utility to a real rule"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zero hex colour literals remain in the `.ts` and `.tsx` sources, down from 36"
    requirement: "QUICK-260901-jav"
    verification:
      - kind: unit
        ref: "tests/unit/designSystem.test.ts#colour values live in exactly one file > has no hex colour literal anywhere in the .ts and .tsx sources"
        status: pass
    human_judgment: false
  - id: D3
    description: "Five named opacity steps proven computed-equivalent to the numbers they alias"
    requirement: "QUICK-260901-jav"
    verification:
      - kind: unit
        ref: "tests/unit/designSystem.test.ts#token equivalence > proves each named opacity step is the number it aliases"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every class in `buttonVariants` emits real CSS against this project's own stylesheet; fourteen previously emitted nothing"
    requirement: "QUICK-260901-jav"
    verification:
      - kind: unit
        ref: "tests/unit/designSystem.test.ts#the button primitive emits real CSS > compiles every class in buttonVariants to a rule against src/index.css"
        status: pass
      - kind: unit
        ref: "tests/unit/button.test.tsx#Button > renders a default button whose classes produce a real background"
        status: pass
    human_judgment: false
  - id: D5
    description: "All nine declared tokens have at least one consumer in `src`"
    requirement: "QUICK-260901-jav"
    verification:
      - kind: unit
        ref: "tests/unit/designSystem.test.ts#every declared token is load-bearing > finds at least one consumer for each surface and opacity token"
        status: pass
    human_judgment: false
  - id: D6
    description: "Primitive API preserved: six variants, four sizes, `forwardRef`, `asChild`, caller `className` wins via twMerge"
    requirement: "QUICK-260901-jav"
    verification:
      - kind: unit
        ref: "tests/unit/button.test.tsx#Button (six cases)"
        status: pass
      - kind: unit
        ref: "tests/unit/confirmDialog.test.tsx (6 tests, passing unchanged)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Opacity scale ratcheted at 75 off-scale across both notations, with a 1,100 population floor"
    requirement: "QUICK-260901-jav"
    verification:
      - kind: unit
        ref: "tests/unit/designSystem.test.ts#the white-opacity scale > has not grown its off-scale population"
        status: pass
    human_judgment: false
  - id: D8
    description: "Button adoption ratcheted at 11 usages across 5 importing files"
    requirement: "QUICK-260901-jav"
    verification:
      - kind: unit
        ref: "tests/unit/designSystem.test.ts#button primitive adoption > keeps at least eleven call sites across at least five files"
        status: pass
    human_judgment: false
  - id: D9
    description: "Both previously-shipped cascade bugs stay fixed: one unlayered `focus-visible` rule at brace depth zero, no property declared outside `@theme`, no property declared twice"
    requirement: "QUICK-260901-jav"
    verification:
      - kind: unit
        ref: "tests/unit/designSystem.test.ts#cascade invariants in src/index.css (3 tests)"
        status: pass
    human_judgment: false
  - id: D10
    description: "The six visual outcomes this work changes: base radius on the pre-existing call sites, Header ghost button size, UpdateNotification dismiss text weight, ErrorBoundary palette shift off zinc, ConfirmDialog footer rebuild, focus ring on all eleven migrated buttons — plus pixel-identity of the tokenised surfaces and the `/debug-live` route"
    requirement: "QUICK-260901-jav"
    verification: []
    human_judgment: true
    rationale: "Nothing in this plan renders a pixel. Every gate here proves a class compiles, a value is unchanged or a count has not grown; none proves the screen looks right. The six checks in Task 3 are the only real gate on visual outcome and require the app running."

duration: 22min
completed: 2026-09-01
status: complete
---

# quick-260901-jav: Name the de-facto opacity scale, make the button primitive emit CSS, and move every colour into one file Summary

**The button primitive was inert — fourteen of its classes compiled to nothing in this project — and a 403-line design-token module had zero importers; both were fixed by declaring nine tokens in `@theme` with proven consumers, rebuilding `buttonVariants` in the app's measured dark-glass vocabulary, and adding seven gates that compile against this project's own stylesheet rather than Tailwind's defaults.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-01T21:09Z
- **Completed:** 2026-09-01T21:31Z
- **Tasks:** 3 of 3
- **Files modified:** 21 (2 created, 18 modified, 1 deleted)

## Accomplishments

- **Proved, rather than asserted, why nobody used `<Button>`.** Compiling each `buttonVariants` class against the project's real `src/index.css` showed fourteen emitting no rule at all — `bg-primary`, `bg-secondary`, `bg-destructive`, `bg-accent`, `border-input`, `bg-background`, their foreground pairs and all three `hover:` opacity variants — because this project's `@theme` declared only `--font-sans`, `--color-ring` and `--color-focus-halo`. The default variant painted a bare `shadow` around no fill, no border and no text colour. A negative probe confirmed the new gate catches all fourteen, and also catches a misspelled opacity token, which fails in exactly the same silent way.
- **Named the white-opacity scale without renaming anything.** Tailwind v4's `--opacity-*` namespace feeds the colour opacity modifier, so `bg-white/glass` and `bg-white/10` emit a byte-identical unconditional `background-color`. The gate proves it in two parts, because the forms are computed-equivalent rather than textually identical: the unconditional declaration is compared byte-for-byte, and inside the `@supports` oklab branch `var(--opacity-glass)` is resolved against its `@theme` value before comparing. A naive whole-rule comparison fails on all five tokens.
- **Deleted the dead token layer instead of joining it.** `src/styles/design-system.ts` was 403 lines, 13 exports, 14 hex literals and zero importers across `src`, `electron` and `tests`. The dead-token gate would have failed it on all thirteen exports; it now guards the nine replacements.
- **Colour values live in exactly one file.** All 36 hex literals in `src/**/*.{ts,tsx}` are gone: 14 with the deleted module, 22 into `@theme`. The zero-hex gate is a clean zero rather than a ratchet with a maintained allowlist.
- **Migrated eleven call sites across five files** (6 → 11 usages, 3 → 5 importing files), each chosen because its `className` override collapsed to something genuinely local. `ErrorBoundary`'s three buttons were the app's only `bg-zinc-*` buttons, so that migration is a palette correction as well as an adoption proof.
- **Every gate was checked against a deliberate break before landing** — a nested `focus-visible` rule, a duplicated `--color-ring` at top level, an added off-scale `white/8`, and a removed `<Button>` all produced the intended named failure.

## Task Commits

1. **Task 1 (tracer): One token, end to end — surface colours, the dead file, and the equivalence harness** — `2223004` (refactor)
2. **Task 2: Make the primitive emit CSS — rebuild buttonVariants and prove it on eleven call sites** — `6ea996f` (feat)
3. **Task 3: Ratchet the numbers, re-assert the cascade invariants, correct the codebase map** — `564af85` (test)

## Files Created/Modified

**Created**
- `tests/unit/designSystem.test.ts` — the harness plus seven gates: token equivalence (colour and opacity), zero hex, no-op class, dead token, opacity scale ratchet, adoption ratchet, three cascade invariants. Compiles through the project's own `src/index.css` via `tailwindcss`'s `compile` export.
- `tests/unit/button.test.tsx` — variant/size/ref/`asChild`/override contract for the primitive, plus a background-emission proof that runs the *rendered* class list back through the compiler (jsdom does not apply Tailwind, so `getComputedStyle` would be vacuous here).

**Modified**
- `src/index.css` — `@theme` gains four `--color-surface-*` and five `--opacity-*` tokens; the `option` rule now references the raised-surface token by `var()`. Only file in the project where a colour value is written.
- `src/components/ui/button.tsx` — `buttonVariants` rewritten on the measured vocabulary; base radius `rounded-md` → `rounded-lg`; text size moved into the size variants; the dead `focus-visible:ring-1 ring-ring` removed.
- `src/components/ui/confirm-dialog.tsx` — footer rebuilt on the primitive; ref, click handlers, inline key hints and the whole keyboard contract untouched.
- `src/components/ErrorBoundary.tsx`, `Header/Header.tsx`, `UpdateNotification.tsx`, `WelcomeScreen.tsx` — call sites migrated.
- `src/components/{Debug/DebugView,Input/UnifiedInput,Profile/ProfileManager,Response/AIResponse,Sessions/SessionHistory,StatusBar/StatusBar,UnifiedPanel/UnifiedPanel,Wizard/WizardContainer}.tsx`, `src/_pages/{Debug,DebugLive}.tsx` — 22 hex literals replaced by token utilities, values unchanged.
- `.planning/codebase/CONVENTIONS.md` — the CSS/Styling section described a token module no code ever imported and illustrated `buttonVariants` with the inert shadcn classes. Both corrected.

**Deleted**
- `src/styles/design-system.ts`

## Decisions Made

- **Named tokens alias numbers; they do not replace them.** The 1,162 numeric and 56 arbitrary-value applications stay exactly as written. Only the primitive's own definitions use named steps, where they buy self-documentation.
- **Off-scale values are pinned, not snapped.** 75 of 1,218 applications sat off the twelve sanctioned steps at baseline (59 numeric + 16 arbitrary). Each snap is a real sub-perceptual visual change that no test can adjudicate, so they are grandfathered explicitly and the failure message says so.
- **`outline` and `secondary` carry `text-white`** beyond the plan's variant table. The census that produced that table measured *surface* classes only (`bg-white*`, `border-white*`, `bg-transparent`), so text colour was left to the executor; without it a glass button inherits whatever dimmed weight its ancestor carries.
- **`link` retargeted onto `text-white/ink-secondary` + `hover:text-white`.** No census support exists (zero occurrences), and the no-op gate is what makes the choice safe rather than arbitrary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A `*/` inside a CSS comment silently terminated the comment and broke compilation**

- **Found during:** Task 1
- **Issue:** The explanatory comment added above the surface tokens contained the glob `src/**/*.{ts,tsx}`. The `**/` closes a CSS block comment, so `*.{ts,tsx}` leaked out as CSS and Tailwind failed with `Invalid declaration: 'ts,tsx'`. `src/index.css` is in the eslint ignore list, so nothing else would have caught it.
- **Fix:** Reworded the comment to avoid the glob. The gate that caught it — the equivalence test compiling the real stylesheet — is now also a syntax check on this file.
- **Files modified:** `src/index.css`
- **Verification:** `npx vitest run tests/unit/designSystem.test.ts`
- **Committed in:** `2223004`

**2. [Rule 1 - Bug] The plan's population floor of 1,200 was arithmetically incompatible with its own Task 2**

- **Found during:** Task 3
- **Issue:** The floor exists so that deleting a large amount of code cannot satisfy the absolute off-scale budget by attrition. It was measured at 1,218 before any migration. But Task 2 routes eleven call sites through the primitive, which removes 27 numeric applications (1,162 → 1,135), leaving a population of 1,191 — below the plan's own floor. Written as specified, the gate would have failed on landing.
- **Fix:** Floor set to 1,100, with the reasoning recorded in the test rather than only here: comfortably under today's 1,191, deliberately loose enough to survive the remaining 153-button migration named in the plan's out-of-scope list, and nowhere near low enough for mass deletion to slip past. The off-scale budget itself is unchanged at 75 — the load-bearing assertion — and was independently confirmed to still measure exactly 75 after the migration.
- **Files modified:** `tests/unit/designSystem.test.ts`
- **Verification:** Counter reproduced the plan's baseline figures exactly against the pre-task commit (1,162 numeric + 56 arbitrary = 1,218, off-scale 75), then measured 1,191 / 75 at HEAD.
- **Committed in:** `564af85`

**3. [Rule 2 - Missing functionality] The Header Log Out override was not dropped to empty**

- **Found during:** Task 2
- **Issue:** D-05's prose says both Header overrides "drop to empty". Doing that to the Log Out button would have deleted `text-red-400/80 hover:text-red-400`, the only thing distinguishing it from the Settings button beside it — a silent loss of danger affordance on a destructive control.
- **Fix:** Kept the two red classes and dropped the four the `ghost` variant and `sm` size now supply. Task 2's action text — "keep only classes that are genuinely local to that call site" — governs, and a danger tint is genuinely local.
- **Files modified:** `src/components/Header/Header.tsx`
- **Verification:** `npx vitest run`; adoption ratchet still counts the call site.
- **Committed in:** `6ea996f`

**4. [Rule 3 - Blocking] Test prose tripped the plan's own dangling-reference gate**

- **Found during:** Task 1
- **Issue:** The new test file explained the deletion in a comment and a failure message that both named `src/styles/design-system.ts` verbatim, which made the plan's `! grep -rn "design-system" src electron tests` gate report a hit.
- **Fix:** Reworded to "the deleted token module under src/styles". Keeping the gate a literal zero is worth more than the exact path in a failure message, and avoids the gate rotting into one people learn to ignore.
- **Files modified:** `tests/unit/designSystem.test.ts`
- **Verification:** The gate command now exits clean.
- **Committed in:** `2223004`

---

**Total deviations:** 4 auto-fixed (2 × Rule 3 blocking, 1 × Rule 1 bug, 1 × Rule 2 missing functionality)
**Impact on plan:** No scope change. Two were mechanical unblocking, one corrected a stated threshold that the plan's own work invalidated, one preserved an affordance the plan's prose would have removed. Every measured claim in the plan was independently reproduced before being relied on.

## Issues Encountered

- **The plan's audit figures needed confirming against the right baseline.** The first measurement was taken against `722278e`, which is not the pre-task commit, and produced 1,199 / 80. Re-measured against the actual parent `782b239`: 1,162 numeric + 56 arbitrary = 1,218, off-scale 75 — the plan's figures exactly. The counter is therefore known to reproduce the planner's method, which is what makes the 75 budget meaningful rather than a coincidence.
- **Backslash escapes do not survive Git Bash heredocs reliably.** `'\\' + ch` arrived as `'\' + ch` and produced a syntax error. All files containing escape sequences were written with the file-writing tool instead. Worth knowing before writing another selector-escaping helper on this machine.
- **Line endings are mixed, sometimes inside a single file** (`DebugView.tsx` is 429 CRLF / 46 LF). Every edit was an exact-substring substitution and `button.tsx` was restored to all-CRLF after rewriting, so no file shows a whole-file ending churn in the diff.

## Verification State

| Check | Result |
|---|---|
| `npx tsc --noEmit` on all three tsconfigs | clean |
| `npx vitest run` | 17 files, 255 tests passing (baseline 15 / 237; +18 added here) |
| `npx eslint .` | clean |
| `tests/unit/confirmDialog.test.tsx` | passes **unchanged** |
| `tests/unit/i18nParity.test.ts` | passes; no strings added |
| Six human checks (Task 3) | **outstanding** — see below |

**Pending human verification.** Nothing in this work renders a pixel, and six visual outcomes are changed that no gate covers. Run the app and confirm:

1. The six pre-existing call sites (Header, UpdateNotification, WelcomeScreen) — base radius moves `rounded-md` → `rounded-lg`, the Header ghost buttons resize slightly, and the "Remind Me Later" text sits a step brighter (50% → 70%). All expected. An invisible or unreadable button is not, and means a leftover override is beating a variant.
2. The error screen — two of three buttons were the app's only `bg-zinc-*` and are now dark glass. Confirm they still read as a group and that the amber one stays distinguishable.
3. The confirmation dialog — Escape cancels, Enter confirms, focus lands on Cancel, key hints stay inside their buttons. Covered behaviourally by `confirmDialog.test.tsx`; if it looks wrong but the test passed, the defect is visual and the test needs widening.
4. Focus ring on all eleven migrated buttons — the primitive no longer carries its own ring classes, so a missing ring means the global unlayered rule has been disturbed, not the primitive.
5. The tokenised surfaces should be **pixel-identical** (debug view, profile manager, session history, hotkeys modal, wizard, unified input panel, settings popover menu). The equivalence gate proves the values did not change, so this checks that the right utility landed on the right element.
6. `/debug-live` — eleven of the 22 tokenised literals are on this page; it should look exactly as it did.

## Known Stubs

None. No placeholder values, no skipped tests, no unrun automated verification steps.

## Next Phase Readiness

Ready. The follow-up work is recorded in the plan's out-of-scope list and unchanged by this execution:

- **The other 153 buttons.** `SettingsPage.tsx` (19) and `UnifiedPanel.tsx` (12) are the next slice; `WizardContainer.tsx` (3) needs a `wizard` size added first. Note that migrating them will remove numeric opacity applications and may push the population under the 1,100 floor — that is a deliberate re-baseline, not a defect.
- **Snapping the 75 off-scale opacity values**, concentrated in `UnifiedPanel.tsx` (21), `SettingsPage.tsx` (10) and `AudioSourceSelector.tsx` (8). Needs a human comparing before and after per site.
- **Whether `UnifiedInput.tsx` should share the modal surface** rather than the GitHub-dark code canvas. Tokenised at its current value, so the decision is still open and costs one token reference to change.
- **Typography, radius, shadow and z-index tokens** return when something needs them — declaring them now would recreate the dead-token failure this task removed.

## Self-Check: PASSED

- `tests/unit/designSystem.test.ts` — present
- `tests/unit/button.test.tsx` — present
- `src/styles/design-system.ts` — confirmed deleted, no dangling reference in `src`, `electron` or `tests`
- Commits `2223004`, `6ea996f`, `564af85` — all present in history
- `git diff --name-status 782b239 HEAD` reports exactly 21 paths: 18 modified, 1 deleted, 2 added — matching the count claimed above. The only deletion is the intentional one.

---
*Quick task: 260901-jav*
*Completed: 2026-09-01*
