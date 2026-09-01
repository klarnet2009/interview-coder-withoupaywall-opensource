---
phase: quick-260901-jav
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QUICK-260901-jav]
files_modified:
  - src/index.css
  - src/styles/design-system.ts
  - src/components/ui/button.tsx
  - src/components/ui/confirm-dialog.tsx
  - src/components/Header/Header.tsx
  - src/components/UpdateNotification.tsx
  - src/components/WelcomeScreen.tsx
  - src/components/ErrorBoundary.tsx
  - src/components/Debug/DebugView.tsx
  - src/components/Input/UnifiedInput.tsx
  - src/components/Profile/ProfileManager.tsx
  - src/components/Response/AIResponse.tsx
  - src/components/Sessions/SessionHistory.tsx
  - src/components/StatusBar/StatusBar.tsx
  - src/components/UnifiedPanel/UnifiedPanel.tsx
  - src/components/Wizard/WizardContainer.tsx
  - src/_pages/Debug.tsx
  - src/_pages/DebugLive.tsx
  - tests/unit/designSystem.test.ts
  - tests/unit/button.test.tsx
  - .planning/codebase/CONVENTIONS.md

must_haves:
  truths:
    - "The de-facto white-opacity scale has a written definition (twelve steps: 3, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90) and a ratchet gate that reads BOTH notations the codebase actually uses. The audit reported 1,148 numeric `white/NN` applications; the measured figure is 1,162, and there are also 56 arbitrary-value applications written `white/[0.03]` which a numeric-only scan cannot see. Verified against the installed Tailwind 4.1.18, `bg-white/[0.05]` and `bg-white/5` compile to the identical declaration — they are the same scale in a second notation. Real total is 1,162 + 56 = 1,218; off-scale under the twelve steps is 75 (59 numeric + 16 arbitrary). The gate pins 75 and forbids growth. It does not snap the existing 75."
    - "Nine tokens are declared in `@theme` and a gate proves every one of them has at least one consumer in `src`. This is the exact property `src/styles/design-system.ts` lacked: 403 lines, 13 exports, and `grep -rn design-system src electron tests` returns nothing. It was a design token layer that no code has ever read. It is deleted rather than extended, because a second unconsumed token file is the one outcome this task must not produce."
    - "Replacing the 22 raw hex literals with tokens is provably lossless rather than assumed lossless. For each replacement the gate asserts the `@theme` declaration equals the literal it replaced, and that the token utility compiles to a real rule against the project's own stylesheet. For the opacity tokens the proof is stronger still, and precise about its own shape: `bg-white/glass` and `bg-white/10` emit a byte-identical unconditional `background-color`, while inside the `@supports` oklab branch the named form emits `var(--opacity-glass)` where the numeric emits `10%`. They are computed-equivalent rather than textually identical, and the gate proves it by comparing the unconditional declaration byte-for-byte and resolving `var(--opacity-NAME)` against its `@theme` value before comparing the branch. The var indirection is not a weakness in the proof — it is the aliasing the token exists to buy."
    - "`src/**/*.{ts,tsx}` contains zero hex colour literals. All 36 are accounted for: 14 disappear with the dead token file, 22 move into `@theme`. Colour values are written in exactly one file."
    - "Every class name in `buttonVariants` emits real CSS when compiled against this project's `src/index.css`. Before this change fourteen of them emitted nothing at all — this project's `@theme` declares only `--font-sans`, `--color-ring` and `--color-focus-halo`, so `bg-primary`, `bg-secondary`, `bg-destructive`, `bg-accent`, `border-input`, `bg-background`, their foreground pairs and all three of their `hover:` opacity variants are undefined and generate no rule. shadcn's `default` variant rendered a button with no fill, no border and no text colour — the base `shadow` does emit, so what paints is a bare box-shadow around nothing. That, measured rather than inferred, is why the primitive has 6 call sites against 164 buttons: every caller had to hand-write the surface in `className`."
    - "The primitive's variants are the app's measured vocabulary, not invented. Each variant is the most frequent surface signature in a census of all 164 buttons: ghost 32 occurrences, secondary 18, outline 12, default 7, destructive taken verbatim from the ConfirmDialog that landed yesterday."
    - "Eleven button call sites across five files render through the primitive, chosen because in each one the `className` override collapses to something genuinely local. Adoption moves 6 -> 11 usages and 3 -> 5 importing files, and a ratchet gate holds it there. The remaining 153 buttons are named as follow-up, not silently dropped."
    - "Neither Tailwind cascade trap is reintroduced. `src/index.css` still has exactly one `focus-visible` rule at brace depth zero (the 260831-xan fix), carries no unlayered top-level custom-property block (the `--color-ring` duplication fix), and declares no custom property twice. All three are gated."
  artifacts:
    - "src/index.css — `@theme` gains four `--color-surface-*` and five `--opacity-*` tokens; after this task it is the only file in the project where a colour value is written"
    - "src/components/ui/button.tsx — `buttonVariants` rewritten in the app's measured dark-glass language on those tokens; the dead `focus-visible:ring-1 ring-ring` removed"
    - "tests/unit/designSystem.test.ts — token equivalence, dead-token, no-op-class, zero-hex, scale ratchet, adoption ratchet and cascade-invariant gates"
    - "tests/unit/button.test.tsx — variant/size/ref/asChild/className-override contract for the primitive"
    - "src/styles/design-system.ts — deleted"
    - ".planning/codebase/CONVENTIONS.md — the CSS/Styling section corrected; it currently documents the deleted file as if components read it"
  key_links:
    - "`@theme` -> Tailwind's `@layer theme` -> utility generation. Tokens must be declared inside `@theme` and nowhere else. A plain top-level custom-property block is unlayered and therefore outranks the layered copy — the precise bug that made `--color-ring` render the wrong value an hour ago. Adding nine tokens is nine chances to repeat it, which is why the single-declaration gate exists."
    - "`--opacity-NAME` -> `bg-white/NAME`. The entire no-mass-rename strategy rests on Tailwind v4's named opacity modifier. Verified against the installed 4.1.18: with `--opacity-glass: 10%`, `bg-white/glass` emits `color-mix(in srgb, #fff 10%, transparent)` — identical to `bg-white/10`. If a token name is misspelled the utility silently emits nothing, which is exactly how the shadcn variants died unnoticed. The no-op gate is the only thing that catches it."
    - "`buttonVariants` class strings -> the project's real `src/index.css`. The no-op gate must compile against this stylesheet, not against Tailwind's defaults. `bg-primary` is a perfectly valid class in a project that declares `--color-primary`; it is a no-op here. A gate compiled against defaults would pass and prove nothing."
    - "migrated call sites -> `cn` / `twMerge`. WelcomeScreen and UpdateNotification currently look right because their `className` beats a variant that emits nothing. Once the variant emits real CSS, twMerge conflict resolution is the only thing keeping them unchanged — which is why those overrides are deleted rather than left to collide."
    - "`*:focus-visible` (unlayered, `src/index.css`) -> `button.tsx`. The primitive's own `focus-visible:ring-1 ring-ring` has been dead since 260831-xan moved the global rule out of `@layer base` so it wins on layer order. Removing it from the base string is a cleanup, not a regression — but the global rule must stay at brace depth zero or all eleven migrated buttons lose their focus ring."
---

<objective>
Turn three related pieces of undeclared design intent into declared, enforced ones: name the white-opacity scale the app has been using for a year without saying so, rebuild the button primitive in the language the app actually speaks so that reaching for it stops being a downgrade, and move every hex colour literal out of components into the one file that should hold them.

Purpose: the audit framed this as design drift. It is not. The distribution is already a scale — nine values carry 89% of 1,218 applications — and the reason nobody uses `<Button/>` turns out to be mechanical rather than aesthetic: fourteen of its variant classes compile to nothing in this project, so the primitive paints a bare box-shadow around no fill, no border and no text colour. Meanwhile a 403-line design token file sits in `src/styles/` with zero importers. This codebase does not need more design assertions. It needs the assertions it already makes to be true, consumed and enforced.

Output: nine tokens in `@theme` each with a proven consumer, a button primitive whose every class emits real CSS, eleven migrated call sites, zero hex literals in `src/**/*.{ts,tsx}`, one deleted dead file, and seven gates — one of which proves the tokenisation is visually lossless rather than merely present.
</objective>

<execution_context>
@C:/Users/klarn/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/klarn/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/codebase/CONVENTIONS.md
@CLAUDE.md

The stylesheet whose cascade layering has been the source of two bugs in the last hour. Read the comment block at the end before touching it:
@src/index.css

The primitive being rebuilt, and the three files that already import it:
@src/components/ui/button.tsx
@src/components/Header/Header.tsx
@src/components/UpdateNotification.tsx
@src/components/WelcomeScreen.tsx

Landed in the last day; both establish patterns this builds on. Do not undo either:
@src/components/ui/confirm-dialog.tsx
@.planning/quick/260831-xan-accessibility-pass-label-icon-buttons-an/260831-xan-PLAN.md
</context>

<decisions>

Six judgement calls, settled here so the executor does not relitigate them mid-task. Every number below was measured against the working tree during planning, not estimated.

### D-01 — What "naming the scale" can mean in Tailwind v4, and why it does not require a mass rename

The brief forbids find-and-replacing `white/10` across the 1,148 sites it counted — 1,162 by measurement — and it is right to. But the constraint that made that seem like the only option does not hold here.

**Measured against the installed Tailwind 4.1.18:** the `--opacity-*` theme namespace feeds the colour opacity *modifier*, not just the `opacity-*` utility. With `--opacity-glass: 10%` declared in `@theme`, the class `bg-white/glass` compiles to `background-color: color-mix(in srgb, #fff 10%, transparent)` — the identical declaration `bg-white/10` produces. Tailwind also emits an `@supports` oklab branch, and there the two differ textually: the named form carries `var(--opacity-glass)` where the numeric carries `10%`. They are computed-equivalent, not byte-identical, and the gate in Task 2 is written to that distinction rather than around it. `hover:bg-white/glass`, `border-white/glass` and `text-white/ink-secondary` all compile the same way. This was verified by driving the project's own `tailwindcss` `compile` export over the project's own `src/index.css`; it is not read off documentation.

Three consequences, and they are the whole reason this task is tractable:

1. **The named form and the numeric form coexist.** Declaring a token does not invalidate `bg-white/10`. There is no forced migration and therefore no unreviewable diff.
2. **Adoption can be bounded to where it earns something** — the primitive, whose variants become self-documenting — while the other 1,200-odd sites are governed by a *constraint* rather than a rename.
3. **The equivalence is machine-checkable.** A gate can compile both forms and assert the declarations match. That converts "this token replacement is visually safe" from a claim into a proof, for the token work specifically.

**A second notation the audit did not see.** The audit reports 1,148 numeric `white/NN` applications across 21 distinct values; the measured figure is **1,162** across those same 21 values. There are also **56 arbitrary-value applications** written `white/[0.03]`, spread over roughly twenty files, in five distinct values: `0.03` (32), `0.02` (14), `0.05` (8), `0.08` (1), `0.04` (1). Compiled, `bg-white/[0.05]` and `bg-white/5` are byte-identical — this is the same scale in a second notation. So the true population is **1,162 + 56 = 1,218**, and any gate written against `\d+` alone would leave 56 sites free to drift in a form it cannot read. The gate in Task 3 parses both.

**The sanctioned scale is twelve steps: 3, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90.** Derivation, and it differs by role — which is itself the finding that justifies role-scoped token names rather than one name per number:

| role | measured distribution | band |
|---|---|---|
| `bg-white/N` (329) | 10 (127), 5 (106), 20 (34), 3 (18), 90 (12), 15 (11), tail 21 | 3–20, plus 90 for the white fill's hover |
| `border-white/N` (276) | 10 (145), 30 (39), 20 (34), 5 (30), 15 (12), tail 16 | 5–30 |
| `text-white/N` (551) | 40 (107), 70 (99), 60 (81), 80 (79), 50 (73), 30 (53), 90 (18), tail 41 | 30–90 |

Those three roles account for 1,156 of the 1,162; the remaining 6 are `ring-white/N` (5) and a single `border-t-white/N`, too few to form a band.

`15` is included despite being a minor step: it has 24 uses and documented intent — the dead token file records `accent.selected` at 0.15, so it is the app's "selected" state, not drift. `8` (14 uses), `25` (7), `35` (8), `45` (7), `75` (6), `85` (7), `2` (5+14 arbitrary), `6` (4), `4` (1+1) are excluded as drift.

**Off-scale baseline: 75 of 1,218 (6.2%)** — 59 numeric plus 16 arbitrary. **These 75 are not snapped in this task.** Each would be a real, sub-perceptual visual change (8 to 10, 85 to 80, 25 to 20 or 30) across 22 files, and there is no automated check that can tell a correct snap from a wrong one. Snapping them is a separate, human-reviewed pass; see `<out_of_scope>`. What this task does is pin the number so it cannot grow.

### D-02 — The nine tokens, and the rule that keeps them alive

`src/styles/design-system.ts` is 403 lines exporting 13 token objects — colours, typography, spacing, radii, shadows, transitions, z-index, component styles. `grep -rn "design-system" src electron tests` returns **nothing**. Not one line of shipped code has ever read it. `CONVENTIONS.md` nonetheless states "Components reference these tokens directly in style objects or Tailwind classes", which is simply false and has been misinforming every codebase-map consumer since April.

That file is the cautionary tale this task exists downstream of, and the rule it implies is the governing constraint on the token set: **a token is declared only if this task also wires a consumer to it.** Nine tokens, each earning its place:

| token | value | consumers after this task |
|---|---|---|
| `--color-surface-base` | the near-black modal/panel surface | 8 sites across 6 files (AIResponse ×3, plus DebugView, ProfileManager, SessionHistory, StatusBar, WizardContainer) |
| `--color-surface-raised` | the popover/menu surface | 2 (UnifiedPanel menu, the `option` rule in `index.css`) |
| `--color-surface-code` | the GitHub-dark code canvas | 10 (Debug diff panel, UnifiedInput panel, DebugLive ×8) |
| `--color-surface-code-raised` | the GitHub-dark raised panel | 3 (DebugLive) |
| `--opacity-glass-subtle` | 5% | `outline` variant hover |
| `--opacity-glass` | 10% | `secondary` surface, `ghost` hover |
| `--opacity-glass-hover` | 20% | `secondary` hover, `outline` border |
| `--opacity-ink-secondary` | 70% | `ghost` resting text |
| `--opacity-solid-hover` | 90% | `default` variant hover |

`glass-*` names the white veil over near-black; `ink-*` names text weight; `surface-*` names an opaque background. Two roles may share a number today (`bg-white/glass` and `border-white/glass` are both 10%) and diverge later without a rename — that divergence being available is most of what a token layer buys.

Note a harmless side effect worth knowing rather than discovering: declaring `--opacity-glass` also generates a standalone `opacity-glass` utility. Nothing uses it; it is namespace cost, not a bug.

### D-03 — Hex literals: which move, which were already correct, and where the values live

All 36 hex literals in `src/**/*.{ts,tsx}`, comments stripped. 14 are inside the file D-02 deletes. The other 22:

| literal | sites | disposition |
|---|---|---|
| `#0a0a0a` | DebugView 185, ProfileManager 454, AIResponse 155/176/189, SessionHistory 93, StatusBar 228, WizardContainer 119 | -> `--color-surface-base`. One value, eight independent spellings across six files of the same modal surface — the clearest case in the file. |
| `#1a1a1a` | UnifiedPanel 501 | -> `--color-surface-raised`. Also duplicated by the `option` rule in `index.css`, which switches to the token. |
| `#0d1117` | Debug 187, UnifiedInput 119 | -> `--color-surface-code`. **The brief was right to warn here**: this is the GitHub-dark canvas, and on the Debug diff panel a code-canvas colour is correct rather than drift. UnifiedInput is the code/text entry panel, so the same canvas is coherent there too. Both are tokenised **at their current value** — the colour does not change. Whether the input panel *should* match the modals instead is a design question, deliberately not answered here. |
| `#0D1117` ×8, `#161B22` ×3 | `_pages/DebugLive.tsx` | -> `--color-surface-code` / `--color-surface-code-raised`. This is the dev-only `/debug-live` route, styled as GitHub dark on purpose. Tokenising it buys nothing aesthetically, but it is 11 of the 22 and taking it lets the gate be a clean zero instead of a ratchet-with-exceptions. A zero gate needs no maintained allowlist and cannot rot. |

Values are recorded here, in this table, rather than in the task actions — deliberately, so that no executor copies one into a source comment where the zero-hex gate would find it.

Three hex literals stay in `src/index.css` and are correct there: the `select` background and the two fully-transparent stops in the `.auth-button` gradient. The file holds four today; the fourth is the `option` background, which becomes a `var()` reference to the raised-surface token. None is a component colour and the gate does not cover `.css` files.

### D-04 — Why the primitive is unused: fourteen of its classes compile to nothing

The audit reads the low adoption as a language mismatch — stock shadcn keyed to `bg-primary` / `bg-accent` / `bg-secondary` in an app built from `bg-white/10`. That is the right diagnosis but it understates the severity, and the difference matters for what the fix has to be.

**Measured by compiling each class in `buttonVariants` against the project's real `src/index.css`:**

| emits CSS | emits nothing |
|---|---|
| `ring-ring`, `shadow`, `shadow-sm`, `rounded-md`, `disabled:opacity-50`, `disabled:pointer-events-none`, `focus-visible:outline-none`, `focus-visible:ring-1`, `hover:underline`, `underline-offset-4` | `bg-primary`, `text-primary-foreground`, `text-primary`, `hover:bg-primary/90`, `bg-secondary`, `text-secondary-foreground`, `hover:bg-secondary/80`, `bg-destructive`, `text-destructive-foreground`, `hover:bg-destructive/90`, `hover:bg-accent`, `hover:text-accent-foreground`, `border-input`, `bg-background` |

This project's `@theme` declares three properties: `--font-sans`, `--color-ring`, `--color-focus-halo`. There is no `--color-primary`, no `--color-accent`, no `--color-secondary`, no `--color-destructive`, no `--color-input`, no `--color-background` — and Tailwind v4 generates no rule for a colour utility whose theme key is absent. **`<Button>` with default props renders no fill, no border and no text colour.** The base `shadow` does emit, so what actually paints is a bare box-shadow around nothing — worse than invisible, because it reads as a rendering glitch rather than a missing style. Every one of the six existing call sites had to reconstruct the surface in `className`; that is not developers ignoring a primitive, it is developers routing around a broken one.

So the fix is not to "add app-flavoured variants alongside". It is to replace variant definitions that are inert, and to add the gate that would have caught this on day one: **every class token in `buttonVariants` must compile to a rule against this project's own stylesheet.** That gate is the single most valuable artifact in this plan, because it is a genuinely meaningful automated check on a category of defect — silently-inert styling — that is otherwise invisible until someone looks at the screen.

**The replacement vocabulary, from a census of all 164 buttons** (surface signature = the sorted set of `bg-white*` / `border-white*` / `bg-transparent` classes on each button):

| variant | classes | census support |
|---|---|---|
| `default` | white fill, black text, `hover:bg-white/solid-hover` | 7 (`bg-white hover:bg-white/90` ×5 plus 2 template variants) |
| `secondary` | `bg-white/glass` + `hover:bg-white/glass-hover` | 18 |
| `ghost` | `text-white/ink-secondary` + `hover:text-white` + `hover:bg-white/glass` | 32 |
| `outline` | `bg-transparent` + `border-white/glass-hover` + `hover:bg-white/glass-subtle` | 12 |
| `destructive` | copied verbatim from `confirm-dialog.tsx` — red-tinted fill, red border, red text | the app's danger idiom is a tinted glass chip, not a saturated red fill |
| `link` | unchanged in spirit, retargeted off the absent primary colour onto a class the executor picks | 0 in the census, so there is no measured answer to copy. Executor discretion is deliberate and safe here: the no-op gate forces whatever is chosen to be a class that actually emits, which is the only property that matters for a variant nothing currently uses. Kept so the variant union does not narrow. |

Sizes follow the same census: `rounded-lg` (62 occurrences) beats `rounded-md` (32) as the base radius, and `px-3 py-1.5 text-xs h-8` is the dominant size (`px-3` 61, `py-1.5` 29, `h-8` 18, `text-xs` dominant), so it becomes `default` rather than shadcn's `h-9 px-4 py-2 text-sm`.

**`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` is removed from the base string.** It has been dead since 260831-xan relocated `*:focus-visible` out of `@layer base`: an unlayered rule beats every utility regardless of specificity, so the global two-tone ring already overrides the shadcn ring's `box-shadow`. That prior task documented this explicitly as the intended outcome. Deleting the dead classes makes the primitive honest; it must not be accompanied by any change to the global rule.

### D-05 — The migration slice: eleven buttons, five files, and why not the other 153

Migrating 164 buttons is not a quick task and is not attempted. The slice below is chosen on one criterion — **the `className` override must collapse to something genuinely local** — because that, and only that, demonstrates the primitive now fits. A migration that trades a hand-written surface for a variant plus an equally long override proves nothing.

| file | buttons | why it qualifies |
|---|---|---|
| `UpdateNotification.tsx` | 3 | Already imports Button. The two action buttons carry `bg-white text-black hover:bg-white/90 border-transparent` on top of `variant="outline"` — a full reconstruction of a variant that emits nothing. Override drops to empty. |
| `Header.tsx` | 2 | Already imports Button. `variant="ghost"` plus `text-white/70 hover:text-white hover:bg-white/10` — a verbatim restatement of what `ghost` will now mean. Override drops to empty. |
| `WelcomeScreen.tsx` | 1 | Already imports Button. Ten classes reconstructing the default variant; drops to the two that are genuinely local (full width, press scale). |
| `ErrorBoundary.tsx` | 3 | Raw `<button>`s, and the app's only `bg-zinc-800 hover:bg-zinc-700` buttons — off-palette in a dark-glass app. Migrating them is both an adoption proof and a real palette correction. |
| `confirm-dialog.tsx` | 2 | The strongest proof available: a primitive currently built from raw buttons, whose destructive styling *is* the source of the new `destructive` variant, and which already has behavioural coverage in `tests/unit/confirmDialog.test.tsx`. The migration is therefore the only one in the set with an existing test asserting it still works. `cancelRef` requires `ref` forwarding, which `Button` provides. |

Deliberately excluded, with reasons rather than by omission:

- **`WizardContainer.tsx` (3)** — `rounded-xl`, `px-6 py-2.5`, and a bespoke disabled treatment (`bg-white/20 text-white/40`). Migrating needs an override as long as the original. It is a candidate for a `wizard` size, not for this slice.
- **`SettingsPage.tsx` (19), `UnifiedPanel.tsx` (12)** — the two largest concentrations, and the two files with the most off-scale opacity values (10 and 21). Touching them means a large diff in the app's two most important screens, which is exactly the unreviewable change the brief rules out.
- **`SolutionCommands.tsx` (10)** — eight are decorative keycaps with no handler; the real click target is the parent div. 260831-xan already recorded this as a semantics rebuild.

Adoption after this task: **6 -> 11 usages, 3 -> 5 files.** That is 6.7% of the app's buttons. Stated plainly: this does not migrate the app. It makes the primitive adoptable, proves it on eleven sites, and ratchets the number so the next person starts from 11 rather than from 6.

### D-06 — What the gates prove, and what they do not

Every visual outcome in this task is unverifiable by automated test, and the gates are written to be honest about which side of that line they sit on.

**Gates that prove something real about correctness:**

- *No-op class gate.* Compiling every `buttonVariants` class against the project's own stylesheet and requiring a rule proves the primitive produces CSS. This is a real correctness property and it is exactly the defect that has been live in this file since it was added.
- *Token equivalence gate.* For the colour tokens, asserting the `@theme` declaration equals the literal it replaced proves the 22 hex replacements changed no value. For the opacity tokens, asserting that `bg-white/glass` and `bg-white/10` are computed-equivalent — byte-identical unconditional declaration, and equal after resolving `var(--opacity-glass)` inside the `@supports` branch — proves the named form is a pure alias. Built in Task 2, once the tokens it compares exist.
- *Dead-token gate.* Requiring every declared token to have a consumer proves the token layer is load-bearing. The deleted file would have failed this on all 13 exports.
- *Cascade-invariant gates.* Brace-depth zero for the focus rule, no unlayered top-level property block, no property declared twice — these prove two known, previously-shipped bugs have not been reintroduced.

**Gates that prove only presence or non-regression, and are not evidence the UI is correct:**

- The scale ratchet proves the off-scale count did not grow. It says nothing about whether any given opacity is the right one.
- The adoption ratchet proves eleven call sites use the primitive. It says nothing about whether they look right.
- The zero-hex gate proves no literal remains. It says nothing about whether the token it became is the right colour.

**Nothing in this plan renders a pixel.** Six specific visual outcomes are changed by this work and none of them is covered by any gate: the base border radius on the six pre-existing call sites, the Header ghost buttons' size, the UpdateNotification dismiss button's text weight, the ErrorBoundary palette shift off zinc, the ConfirmDialog footer rebuild, and the focus ring on all eleven migrated buttons. Those are the six items in the Task 3 human check, and that check is the only real gate on them.

</decisions>

<tasks>

<task type="tracer">
  <name>Task 1: One token, end to end — surface colours, the dead file, and the equivalence harness</name>
  <precondition>`node_modules/tailwindcss/index.css` exists and `require('tailwindcss/package.json').version` reports 4.1.x — the gate harness compiles through the project's installed Tailwind and every claim in D-01 and D-04 was measured against 4.1.18.</precondition>
  <files>src/index.css, src/styles/design-system.ts, src/components/Debug/DebugView.tsx, src/components/Input/UnifiedInput.tsx, src/components/Profile/ProfileManager.tsx, src/components/Response/AIResponse.tsx, src/components/Sessions/SessionHistory.tsx, src/components/StatusBar/StatusBar.tsx, src/components/UnifiedPanel/UnifiedPanel.tsx, src/components/Wizard/WizardContainer.tsx, src/_pages/Debug.tsx, src/_pages/DebugLive.tsx, tests/unit/designSystem.test.ts</files>
  <action>
Wire one complete path — theme declaration, Tailwind compilation, component consumption, automated proof — for the surface colour family, so that if any layer of the token strategy does not work it is discovered now rather than after the primitive has been rebuilt on top of it.

Add the four `--color-surface-*` tokens named in the D-03 table to the existing `@theme` block in `src/index.css`, taking each value from that table. Declare them inside `@theme` and nowhere else: per D-01 and the key_links, a duplicate declaration at top level is unlayered and silently wins over the `@theme` copy, which is the defect that made the focus ring token render wrong an hour ago. Do not add a second top-level property block for any reason.

Replace all 22 raw hex literals listed in the D-03 table with the corresponding token utility. Each is a single class-string substitution: an arbitrary-value background utility becomes the named background utility, and where an opacity modifier is attached it stays attached unchanged. Change no value, no modifier and no other class. In `src/index.css`, switch the `option` rule's background to the raised-surface token by `var()` reference so the popover colour is stated once.

Delete `src/styles/design-system.ts` entirely. Per D-02 it has no importers anywhere in `src`, `electron` or `tests`; confirm that with a grep before deleting rather than trusting this sentence, then delete the file. Do not port any of its 13 exports — the four values worth keeping are the surface colours already being added above, and re-homing the rest would recreate exactly the unconsumed token layer this task exists to remove.

Create `tests/unit/designSystem.test.ts`. It runs under the project's default `node` vitest environment, so it needs no environment pragma. Build a small shared helper in this file that compiles a class list against the project's real stylesheet: read `src/index.css`, call the `compile` export of `tailwindcss` with the stylesheet text and an options object carrying `base` set to the repo root and a `loadStylesheet` callback returning an object with `path`, `base` and `content` for `node_modules/tailwindcss/index.css` — `src/index.css` has exactly one import, so the callback can ignore its arguments — then call `build` on the result with the class list. If importing `tailwindcss` statically fails under vitest, use a dynamic import inside the test body; if that also fails, run the compile in a child process via `execFileSync` on `process.execPath` and parse the stdout. Do not work around it by compiling against Tailwind defaults, which per key_links would make the whole harness vacuous.

Add two gates to that file now:

*Token equivalence.* Hold the token-name-to-literal mapping from the D-03 table in the test. For each entry, parse the `@theme` block, assert the token is declared exactly once, assert its declared value equals the mapped literal compared case-insensitively (one source literal is upper-case), and assert that compiling the corresponding background utility against the real stylesheet emits a rule. This proves the 22 replacements changed no value.

*Zero hex literals.* Walk `src` for `.ts` and `.tsx` files, strip block comments and line comments before matching, and assert no six-or-three-digit hex colour literal remains. The baseline before this task is 36 and the target is exactly zero, which is only reachable because the dead file goes and all 22 component literals move; state that in the failure message so a future regression reports what it means rather than just a count.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/designSystem.test.ts</automated>
    <automated>npx tsc --noEmit -p tsconfig.json &amp;&amp; npx tsc --noEmit -p tsconfig.electron.json &amp;&amp; npx tsc --noEmit -p tsconfig.node.json</automated>
    <automated>npx vitest run</automated>
    <automated>npx eslint .</automated>
    <automated>test ! -e src/styles/design-system.ts &amp;&amp; ! grep -rn "design-system" src electron tests --include=*.ts --include=*.tsx</automated>
    <automated>node -e "const fs=require('fs');const c=fs.readFileSync('src/index.css','utf8');const names=c.split(/[;{}]/).map(x=>(x.match(/(--[a-z0-9-]+)\s*:/)||[])[1]).filter(Boolean);const dup=names.filter((n,i)=>names.indexOf(n)!==i);if(dup.length)throw new Error('custom property declared more than once: '+[...new Set(dup)].join(', '));const surf=names.filter(n=>n.startsWith('--color-surface-'));if(surf.length!==4)throw new Error('expected 4 surface tokens, found '+surf.length+': '+surf.join(', '));console.log('ok',names.length,'properties,',surf.length,'surface tokens')"</automated>
  </verify>
  <done>Four surface tokens are declared once each inside `@theme`; all 22 component hex literals are gone and `src/**/*.{ts,tsx}` carries none; `src/styles/design-system.ts` is deleted with no dangling reference; `tests/unit/designSystem.test.ts` compiles through the project's own Tailwind and its equivalence gate proves each replacement kept its value; three typechecks, full `vitest run` and `eslint` clean.</done>
</task>

<task type="auto">
  <name>Task 2: Make the primitive emit CSS — rebuild buttonVariants on the app's measured vocabulary and prove it on eleven call sites</name>
  <files>src/index.css, src/components/ui/button.tsx, src/components/ui/confirm-dialog.tsx, src/components/Header/Header.tsx, src/components/UpdateNotification.tsx, src/components/WelcomeScreen.tsx, src/components/ErrorBoundary.tsx, tests/unit/designSystem.test.ts, tests/unit/button.test.tsx</files>
  <behavior>
    - Rendering `Button` with no props produces an element carrying at least one background declaration that resolves to a non-empty value — the property that fails today.
    - Each of the six variant names and four size names still type-checks and renders.
    - `ref` reaches the underlying element, so `confirm-dialog` can keep focusing Cancel on open.
    - `asChild` still renders the child element rather than a nested button.
    - A `className` passed by a caller still wins over the variant class for the same CSS property, via `twMerge`.
    - The existing ConfirmDialog keyboard contract is unchanged: Escape cancels, Enter confirms, focus starts on Cancel.
  </behavior>
  <action>
Add the five `--opacity-*` tokens from the D-02 table to the `@theme` block in `src/index.css`, alongside the surface tokens from Task 1 and under the same single-declaration rule.

Rewrite `buttonVariants` in `src/components/ui/button.tsx` using the variant and size table in D-04. Keep the exported names `Button` and `buttonVariants`, the `ButtonProps` interface, `asChild`, `forwardRef` and the full existing variant and size unions — narrowing either union would break callers and the migration below depends on `ghost`, `outline` and the default continuing to exist. Express every white surface and text weight through the opacity tokens rather than through a bare number, so the variant definitions read as intent; the red values in the destructive variant stay as they are, copied from the ConfirmDialog, because the scale in D-01 governs white veils only. Move the text size out of the base string into the size variants per the census. Delete the three focus-related classes from the base string for the reason given in D-04, and change nothing about the global focus rule in `src/index.css`.

Extend the equivalence harness from Task 1 to cover the opacity tokens, which did not exist when it was written. For each of the five named/numeric pairs — `glass`/10, `glass-subtle`/5, `glass-hover`/20, `ink-secondary`/70, `solid-hover`/90 — compile `bg-white/<name>` and `bg-white/<number>` against the real stylesheet and assert they are computed-equivalent in the two-part sense established in D-01: the unconditional `background-color` declarations must match byte-for-byte, and in the `@supports` oklab branch the named form's `var(--opacity-<name>)` must be resolved against its `@theme` value before comparing. A naive byte comparison of the whole rule fails on all five and is the wrong assertion. This is the gate that makes D-01's no-mass-rename strategy defensible rather than merely asserted: it is the proof that a named token and the number it aliases are the same colour, and therefore that the overwhelming majority of sites, which keep the numeric form, are not drifting away from the handful that now carry the named one.

Add the *no-op class gate* to `tests/unit/designSystem.test.ts`, using the compile helper built in Task 1. Read `src/components/ui/button.tsx`, extract every class token from the string literals inside the `cva` call, compile the whole list in one pass against the project's real stylesheet, and assert that each class produces a selector in the output. When building the selector to search for, escape every character outside `[A-Za-z0-9_-]` rather than an enumerated list: Tailwind also escapes `#`, `(`, `)`, `,`, `%` and `&`, so any future arbitrary-value or opacity-modifier class would otherwise produce a false failure and teach the next person to distrust this gate. Fail with the offending class names listed. Per D-06 this is the gate that would have caught the current defect, so it must fail loudly and name what is inert rather than reporting a count.

Add the *dead-token gate* to the same file. For every `--opacity-*` and `--color-surface-*` property declared in `@theme`, search `src` for a consumer — the token stem appearing after a slash in an opacity modifier, or as the tail of a colour utility, or inside a `var()` reference in `src/index.css` — and fail naming any token with zero consumers. Nine tokens are declared and all nine must resolve.

Migrate the eleven call sites in the five files named in the D-05 table. In each, replace the hand-written surface with the variant that now means the same thing and delete the classes the variant supplies; keep only classes that are genuinely local to that call site, such as full width, flex sizing or a press transform. `ErrorBoundary.tsx` uses raw button elements and needs the import added. `confirm-dialog.tsx` keeps its ref, its click handlers, its inline key hints and its whole keyboard contract untouched — only the two elements' styling moves onto the primitive, and its existing test file must still pass unchanged.

Create `tests/unit/button.test.tsx` with a jsdom environment pragma on the first line, asserting the six behaviours listed above.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/button.test.tsx tests/unit/confirmDialog.test.tsx tests/unit/designSystem.test.ts</automated>
    <automated>npx tsc --noEmit -p tsconfig.json &amp;&amp; npx tsc --noEmit -p tsconfig.electron.json &amp;&amp; npx tsc --noEmit -p tsconfig.node.json</automated>
    <automated>npx vitest run</automated>
    <automated>npx eslint .</automated>
    <automated>node -e "const fs=require('fs');const s=fs.readFileSync('src/components/ui/button.tsx','utf8');if(!s.includes('cva('))throw new Error('cva call removed');if(!s.includes('forwardRef'))throw new Error('ref forwarding removed - confirm-dialog focuses Cancel through it');if(!s.includes('asChild'))throw new Error('asChild removed');if(s.includes('ring-ring'))throw new Error('dead shadcn ring still present (D-04)');console.log('ok')"</automated>
    <!-- The variant and size unions are held by tests/unit/button.test.tsx rendering all six variants and all four sizes, plus tsc on tsconfig.json. A shell-level regex over the union names is deliberately not used: backslash escapes in a node -e one-liner do not survive every shell identically, and a gate that fails for escaping reasons trains people to ignore it. -->
  </verify>
  <done>All five named opacity tokens are proven computed-equivalent to the numbers they alias, by byte comparison of the unconditional declaration and by `var()` resolution inside the `@supports` branch; every class in `buttonVariants` compiles to a rule against the project's own stylesheet; all nine tokens have a proven consumer; the six variant and four size names, `forwardRef` and `asChild` survive; eleven call sites across five files render through the primitive with only genuinely local classes left in their overrides; `confirmDialog.test.tsx` passes unchanged; three typechecks, full `vitest run` and `eslint` clean.</done>
</task>

<task type="auto">
  <name>Task 3: Ratchet the numbers, re-assert the cascade invariants, correct the codebase map</name>
  <files>tests/unit/designSystem.test.ts, .planning/codebase/CONVENTIONS.md</files>
  <action>
Add the three remaining gates to `tests/unit/designSystem.test.ts`.

*Opacity scale ratchet.* Walk `src` for `.ts` and `.tsx`, and count white-opacity applications in **both** notations per D-01: the numeric form, and the arbitrary decimal form which must be multiplied by one hundred before comparison because they are the same scale written two ways. Assert the total off-scale count against the twelve sanctioned steps does not exceed 75. Also assert the total population is at least 1,200, so that a refactor which deletes half the app cannot make the ratchet pass by attrition. The failure message must state that the sanctioned steps are a written scale, list the off-scale sites, and say plainly that the existing 75 are grandfathered rather than approved.

*Button adoption ratchet.* Assert at least eleven usages of the primitive across at least five importing files in `src`. Count import statements and element usages separately so that deleting a call site cannot be masked by adding one elsewhere in an already-counted file.

*Cascade invariants.* Re-assert the invariant 260831-xan established and add the two this task's token work puts at risk: `src/index.css` contains exactly one `focus-visible` rule and it sits at brace depth zero after comments are stripped; the file contains no unlayered top-level custom-property block, since a copy outside `@theme` would silently outrank the layered declarations; and no custom property is declared more than once. Each failure message must name which of the two previously-shipped cascade bugs it is preventing, because a bare assertion failure here reads as noise to someone who was not present for them.

Then correct `.planning/codebase/CONVENTIONS.md`. Its CSS/Styling section states that a design token module exports a token system and that components reference it — false since April and now doubly so. Replace that subsection with what is true after this task: the token layer is the `@theme` block in `src/index.css` and is the only place a colour value is written; the white-opacity scale is the twelve steps from D-01, enforced by ratchet rather than by rename; the button primitive speaks the app's dark-glass language and every one of its classes is gated to emit real CSS. Keep the section the same shape and length as its neighbours; do not expand it into a design-system document.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/designSystem.test.ts</automated>
    <automated>npx tsc --noEmit -p tsconfig.json &amp;&amp; npx tsc --noEmit -p tsconfig.electron.json &amp;&amp; npx tsc --noEmit -p tsconfig.node.json</automated>
    <automated>npx vitest run</automated>
    <automated>npx eslint .</automated>
    <automated>node -e "const fs=require('fs');const css=fs.readFileSync('src/index.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');const d=[...css.matchAll(/focus-visible/g)].map(m=>{const p=css.slice(0,m.index);return p.split('{').length-p.split('}').length});if(!d.length)throw new Error('the focus-visible rule from 260831-xan is gone');if(d.length!==1)throw new Error('more than one focus-visible rule; the duplicate is the bug 260831-xan fixed');if(d[0]!==0)throw new Error('the focus-visible rule is nested in an at-rule block again and will lose to every focus:outline-none utility');console.log('ok')"</automated>
    <automated>node -e "const fs=require('fs');const c=fs.readFileSync('.planning/codebase/CONVENTIONS.md','utf8');if(/design-system/.test(c))throw new Error('CONVENTIONS.md still points at the deleted token module');if(!/@theme/.test(c))throw new Error('CONVENTIONS.md does not name the replacement token layer');console.log('ok')"</automated>
    <human-check>
      Per D-06 no gate in this plan renders a pixel, and these six outcomes are the only ones a person can judge. Run the app as you normally would and confirm each.

      1. **The three files that already used the primitive.** Open the Settings/Log Out buttons in the header, the update notification, and the welcome screen. All six buttons previously supplied their own surface on top of a variant that emitted nothing; they now get it from the variant. Look for: the base radius moving from `rounded-md` to `rounded-lg`, the header ghost buttons resizing slightly, and the update notification's "Remind Me Later" text sitting a step brighter than before. Any of those is expected. A button that has become invisible, transparent or unreadable is not, and means a variant class is being beaten by a leftover override.
      2. **The error screen.** Trigger the error boundary. Two of its three buttons were the app's only `bg-zinc-*` buttons and are now dark-glass. Confirm the three buttons still read as a group and that the amber "reset" one is still distinguishable from the neutral one.
      3. **The confirmation dialog.** Trigger any destructive action. Escape must cancel, Enter must confirm, focus must land on Cancel, and the inline key hints must still sit inside their buttons. This is the one migration with existing test coverage, so a failure here should already have shown up in `confirmDialog.test.tsx` — if it looks wrong but the test passed, the defect is visual and the test needs widening.
      4. **Focus ring on migrated buttons.** Tab to each of the eleven migrated buttons. The two-tone ring from 260831-xan must still appear. The primitive no longer carries its own ring classes (D-04), so if the ring is missing here the global unlayered rule has been disturbed — check it before assuming the primitive is at fault.
      5. **Tokenised surfaces, which should be pixel-identical.** The equivalence gate proves the values did not change, so this is a check that the right utility landed on the right element, not that the colour is right: open the debug view, the profile manager, the session history, the hotkeys modal, the wizard, the unified input panel and the settings popover menu. Any surface that has gone black, transparent or the wrong shade means a substitution hit the wrong class.
      6. **The dev route.** Visit `/debug-live`. Eleven of the 22 tokenised literals are on this page; it should look exactly as it did.
    </human-check>
  </verify>
  <done>Off-scale white-opacity applications are pinned at no more than 75 across both notations with the population floor asserted; primitive adoption is pinned at eleven usages across five files; the single unlayered `focus-visible` rule, the absence of a duplicate top-level property block and the no-duplicate-property invariant all hold with failure messages that name the bug each prevents; `CONVENTIONS.md` no longer points at the deleted module and names `@theme` as the token layer; three typechecks, full `vitest run` and `eslint` clean; all six human checks confirmed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build-time stylesheet -> rendered overlay | `src/index.css` is compiled into the always-on-top window; a rule that silently fails to emit produces an invisible control rather than an error |
| test harness -> filesystem and Tailwind compiler | `tests/unit/designSystem.test.ts` reads source files and drives the compiler in-process during CI |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-jav-01 | Denial of service | `buttonVariants` in `src/components/ui/button.tsx` | medium | mitigate | A class that emits no CSS renders a transparent control the user cannot see or aim at — the live defect this task fixes, and on an interview overlay an unclickable control is a functional outage. The no-op class gate in Task 2 compiles every class against the project's real stylesheet and fails on any that produce nothing. |
| T-jav-02 | Tampering | `@theme` in `src/index.css` | medium | mitigate | A token redeclared outside `@theme` is unlayered and silently overrides the layered value — a shipped bug in this file within the last hour. Task 1 and Task 3 gate on no duplicate property declaration and no unlayered top-level property block. |
| T-jav-03 | Elevation of privilege | `*:focus-visible` in `src/index.css` | medium | mitigate | Nine new `@theme` entries are nine chances to disturb the unlayered focus rule that keyboard operability depends on. Task 3 re-asserts the brace-depth-zero and single-rule invariants from 260831-xan rather than trusting that this task left them alone. |
| T-jav-04 | Information disclosure | deletion of `src/styles/design-system.ts` | low | accept | The file contains only inert colour, spacing and typography literals — no credentials, endpoints or logic. Zero importers was confirmed by grep across `src`, `electron` and `tests`, and Task 1 re-runs that grep as a gate before deleting. Recoverable from git in any case. |
| T-jav-05 | Tampering | `tests/unit/designSystem.test.ts` reading source and driving the compiler | low | accept | The test only reads files inside the repo and calls the already-installed Tailwind compiler in-process. It writes nothing, spawns nothing beyond an optional same-runtime child process, and takes no network path. |
| T-jav-SC | Tampering | npm/pip/cargo installs | high | mitigate | Not applicable — this plan installs no packages. Every capability it relies on comes from `tailwindcss@4.1.18`, `class-variance-authority`, `tailwind-merge` and `@testing-library/react`, all already present. No package legitimacy gate is triggered. |
</threat_model>

<verification>
Baseline that must survive intact:

- `npx tsc --noEmit` clean on all three of `tsconfig.json`, `tsconfig.electron.json`, `tsconfig.node.json`
- `npx vitest run` — 15 existing test files and 237 tests still pass, plus the two files added here
- `npx eslint .` clean
- `tests/unit/i18nParity.test.ts` still passes with `MIN_KEYS` at 320, both locales at identical key sets and no empty values. This task adds no user-facing strings, so parity should be untouched; it is listed because the ErrorBoundary and ConfirmDialog migrations sit next to translated text.
- `tests/unit/confirmDialog.test.tsx` passes **unchanged** — it is the only pre-existing behavioural coverage of a migrated call site
- No `npm run dev`, `start`, `build` or `clean` is invoked by any gate

New gates introduced, all in `tests/unit/designSystem.test.ts` unless noted:

- *Token equivalence* — each colour token's `@theme` value equals the literal it replaced, case-insensitively, and its utility compiles to a rule; each of the five opacity tokens is computed-equivalent to the number it aliases, proven by byte comparison of the unconditional `background-color` plus `var()` resolution inside the `@supports` oklab branch, where the named form legitimately differs textually
- *Zero hex literals* — no hex colour literal in `src/**/*.{ts,tsx}` after comments are stripped, down from 36
- *No-op class* — every class in `buttonVariants` compiles to a rule against this project's own `src/index.css`, not against Tailwind defaults
- *Dead token* — all nine declared tokens have at least one consumer in `src`
- *Opacity scale ratchet* — off-scale applications across both notations do not exceed 75, with a population floor of 1,200 so attrition cannot satisfy it
- *Button adoption ratchet* — at least 11 usages across at least 5 importing files, counted independently
- *Cascade invariants* — exactly one `focus-visible` rule at brace depth zero, no unlayered top-level custom-property block, no property declared twice
- *Codebase map* — `.planning/codebase/CONVENTIONS.md` no longer references the deleted module and names `@theme` as the token layer
- Six human checks in Task 3, which are the only gate on any visual outcome
</verification>

<success_criteria>
- The white-opacity scale is written down as twelve steps and enforced by a ratchet that reads both notations in use, covering all 1,218 applications rather than the 1,162 a numeric-only scan sees; the 75 off-scale sites are grandfathered explicitly, not silently
- Nine tokens live in `@theme`, each with a proven consumer, and the 403-line token module with zero importers is gone rather than joined by a second one
- Zero hex colour literals remain in `src/**/*.{ts,tsx}`; every replacement is proven value-preserving by compilation rather than assumed
- Every class in `buttonVariants` emits real CSS, up from a state where fourteen of them emitted nothing and the default variant painted a bare box-shadow around no fill, border or text colour
- The primitive's variants are the measured vocabulary of the app's 164 buttons; eleven call sites across five files use it with only genuinely local overrides; the three files that already imported it keep working and their API is unchanged
- Both Tailwind cascade bugs fixed in the last hour stay fixed, gated rather than assumed
- Baseline typechecks, all 237 existing tests and lint remain clean; 260831-xan's focus rule and 260831-wf4's ConfirmDialog behaviour are untouched
- The plan states plainly which gates prove correctness and which prove only non-regression, and does not imply visual coverage it does not have
</success_criteria>

<out_of_scope>
Recorded explicitly so none of it is lost. None is dropped for difficulty; each is either unreviewable at this size, visually unverifiable, or a separate concern.

1. **Snapping the 75 off-scale opacity values onto the scale.** 59 numeric plus 16 arbitrary across 22 files, concentrated in `UnifiedPanel.tsx` (21), `SettingsPage.tsx` (10) and `AudioSourceSelector.tsx` (8). Each is a real sub-perceptual visual change that no test can adjudicate, so it needs a human comparing before and after per site. The ratchet stops it growing in the meantime.
2. **Normalising the 56 arbitrary-value applications to the numeric notation.** Provably lossless — `bg-white/[0.05]` and `bg-white/5` compile identically — but 56 edits across roughly twenty files is formatting churn with no design content. The Task 3 gate reads both notations, so nothing hides in the second one; there is no correctness argument for doing it now.
3. **The other 153 buttons.** Named in D-05 with the specific reason each cluster was excluded. `SettingsPage.tsx` (19) and `UnifiedPanel.tsx` (12) are the largest and the most valuable next slice; `WizardContainer.tsx` (3) needs a `wizard` size added to the primitive first; `SolutionCommands.tsx` (10) is a semantics rebuild already recorded by 260831-xan.
4. **The 193 inline `px-N py-N` pairs.** A spacing scale is a second, independent design system and merging it into this task would produce exactly the unreviewable diff the brief rules out. It is also the one area where the deleted module had a defensible answer worth reviving deliberately rather than by accident.
5. **Whether `UnifiedInput.tsx` should share the modal surface instead of the code canvas.** Tokenised at its current value per D-03 so no colour changes. Deciding it is a design question that needs eyes on the running overlay, not a planner.
6. **Typography, radius, shadow and z-index tokens.** The deleted module had all four. None has a consumer this task creates, so declaring them would reproduce the dead-token failure the D-02 gate exists to prevent. They return when something needs them.
7. **A `@utility` layer for composite classes** such as a named panel or hairline surface. Tailwind v4 supports it and it is the natural next step after the primitive proves out, but it is a second migration surface and one is enough for one task.
</out_of_scope>

<output>
Create `.planning/quick/260901-jav-design-system-name-the-de-facto-opacity-/260901-jav-SUMMARY.md` when done
</output>
