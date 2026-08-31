---
phase: quick-260831-wf4
plan: 01
subsystem: renderer-ux
tags: [ux, safety, i18n, electron, radix, confirmation]
status: complete
requires:
  - src/components/ui/dialog.tsx (Radix dialog primitives)
  - src/i18n (i18next instance, en/ru resources)
provides:
  - ConfirmDialog primitive (keyboard-first destructive-action gate)
  - i18n parity gate (tests/unit/i18nParity.test.ts)
  - SettingsPageProps.onOpenWizard (re-entry into WizardContainer)
affects:
  - src/components/Settings/SettingsPage.tsx
  - src/App.tsx
  - src/_pages/Solutions.tsx
  - src/components/DevModeToggle.tsx
  - src/components/WelcomeScreen.tsx
tech-stack:
  added: []
  patterns:
    - Destructive IPC lives inside a named confirm* callback with exactly one call site
    - Component tests opt into jsdom per-file via `// @vitest-environment jsdom`, no global setup
key-files:
  created:
    - src/components/ui/confirm-dialog.tsx
    - tests/unit/i18nParity.test.ts
    - tests/unit/confirmDialog.test.tsx
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/ru.json
    - src/components/Settings/SettingsPage.tsx
    - src/App.tsx
    - src/_pages/Solutions.tsx
    - src/components/DevModeToggle.tsx
    - src/components/WelcomeScreen.tsx
decisions:
  - Three confirmations, not eighteen — classified by recoverability and frequency, not by call-site count
  - deleteScreenshot stays unconfirmed as a frequency trade, not because the loss is free
  - Enter confirms while focus rests on Cancel; the mapping is made legible with rendered Esc/Enter kbd hints
  - The no-key fix explains the block and reopens the wizard rather than enabling Save on an empty key
  - The provider key link uses the existing openLink IPC, not a bare anchor, so the app window cannot navigate away
metrics:
  duration: ~12min
  tasks: 3
  files: 10
  completed: 2026-08-31
---

# Quick Task 260831-wf4: Fix UX blockers — separate Quit from Save Summary

A keyboard-first `ConfirmDialog` now gates the three irreversible renderer actions (quit, clear-all-history, delete-one-session), Quit sits alone on the far left of the Settings footer with Cancel and Save grouped on the right, a keyless user gets a written explanation plus a provider key link and a Guided setup button back into the wizard, the dev toolbar moved to the bottom-right corner at z-40, and en/ru symmetry is now enforced by a committed test rather than by care.

## What Was Built

**Task 1 — `ConfirmDialog`, its strings, and the parity gate** (`819f471`)

`src/components/ui/confirm-dialog.tsx` composes the existing Radix primitives (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`). No second overlay, portal, or centering layer was introduced — `DialogContent` already owns all of that, including its z-50 stacking.

The keyboard contract, resolved so the three requirements do not fight each other:

- **Escape cancels.** Radix already routes Escape to `onOpenChange(false)`; nothing intercepts it.
- **Enter confirms.** An `onKeyDown` on `DialogContent` calls `preventDefault()` → `stopPropagation()` → `onConfirm()` → `onOpenChange(false)`. The `preventDefault` is load-bearing: without it the focused Cancel button would also activate on Enter and the two would race.
- **Initial focus is Cancel.** `onOpenAutoFocus` is prevented and focus is moved to a ref on the Cancel button, so a stray Space or click resolves to the safe option.

16 keys were added symmetrically to both locales (262 → 278): a new top-level `confirm` group of 12 and 4 under `settings`. `tests/unit/i18nParity.test.ts` flattens both files to dotted paths, asserts the sorted arrays are identical (naming the symmetric difference on failure rather than just counting it), asserts each of the 16 new keys explicitly in both locales, holds a floor of 278 keys, and additionally rejects empty string values. `tests/unit/confirmDialog.test.tsx` pins the five keyboard/focus behaviors under jsdom, opted in per-file.

**Task 2 — Quit isolated and confirmed; the no-key dead end opened** (`3314e58`)

The Settings footer was rebuilt. Quit is now alone on the left of the `justify-between` row; Cancel and Save are grouped on the right. Both safe actions are adjacent and the destructive one is a full footer width from Save — the red tint alone was never going to be enough, and the trap was hit during the audit session itself.

`window.electronAPI.quitApp()` now has exactly one call site in the file, inside `confirmQuit`, wired as `onConfirm={confirmQuit}`. The Quit button's press handler only opens the confirmation.

With no key configured, the footer shows `settings.apiKeyRequired.heading` and `.body`, a link to the selected provider's key page, and a Guided setup button. The disabled Save carries the same explanation as a `title` (Chromium still shows tooltips on disabled buttons). The `disabled` condition was left alone — saving an empty key is meaningless, and enabling it would be a worse bug than the one being fixed.

`SettingsPageProps` gained `onOpenWizard?`, wired in `App.tsx` to a `useCallback` that closes settings and sets `showWizard`. Before this, `showWizard` was only ever set true when the wizard had never been completed, so a user who finished or skipped it without a key could never get back in — and the app ships with no key, so that is the literal first-run path.

**Task 3 — History confirmations and the toolbar unstacked** (`c81e205`)

`Solutions.tsx` gained a boolean for the clear-all confirmation and a `string | null` for the session pending deletion. `requestClearHistory` / `requestDeleteSession` are what `SessionHistory` now receives as `onClearHistory` / `onDeleteSession`; the IPC-calling bodies were renamed to `confirmClearHistory` / `confirmDeleteSession` and moved behind `onConfirm`. Each destructive IPC still has exactly one call site, still reloads the list, and still surfaces the existing failure toast. `SessionHistory.tsx` was not touched — its prop contract is unchanged.

`DevModeToggle` moved from `fixed bottom-3 left-1/2 -translate-x-1/2 z-9999` to `fixed bottom-3 right-3 z-40 flex-row-reverse`, so the bug icon sits in the corner, the expanded panel grows inward to the left instead of off-screen, and the toolbar renders *beneath* the z-50 dialog layer instead of floating over every confirmation this task added. `WelcomeScreen`'s content column went from `pb-6` to `pb-12` — corner anchoring alone would still have left the hint and the widget on the same line at the 460px setup width, so both sides of the collision had to change.

## Destructive-Action Classification As Implemented

| Action | Confirmed? | Why |
|---|---|---|
| `quitApp` (Settings footer) | **Yes** | Unrecoverable mid-interview; was adjacent to Save |
| `clearSessionHistory` | **Yes** | Every session gone at once, from a hover-revealed button |
| `deleteSessionHistoryItem` | **Yes** | The session and its snippets are gone |
| `deleteScreenshot` (3 sites) | **No** | Frequency trade — see below |
| `deleteLastScreenshot` (Ctrl+L) | **No** | Same trade, plus it is a deliberate chord |
| `clearStore`, `resetWizard` | **No** | Preload only, no renderer call site — nothing to gate |

**On the screenshot case, honestly.** The tidy version of this rationale — "just retake it with Ctrl+H" — is wrong, and recording it would mislead whoever revisits this. Ctrl+H (`electron/shortcuts.ts:41`) captures the display *as it is now*, not the image that was deleted. A screenshot of a panel the user has since scrolled away from or closed is genuinely unrecoverable. The deciding factor is **not** that the loss is cheap; it is frequency. Screenshot capture and deletion are the highest-frequency actions in this app, and a prompt on every one of them produces a user who dismisses confirmations without reading them — which is exactly what would make the history-clear confirmation stop working on the day it matters. This is a real risk accepted on the frequent action in order to keep the rare, catastrophic one meaningful. It is a trade, not a free win, and it should be re-examined if screenshot deletion ever stops being high-frequency.

All three `deleteScreenshot` call sites (`_pages/Solutions.tsx`, `_pages/Debug.tsx`, `_pages/Queue.tsx`) are byte-identical to before; a gate asserts the count is still exactly 3.

## The Enter/Cancel-Focus Tension

Enter confirms while the focus ring rests on Cancel. That combination is only safe if the user can *see* the mapping, otherwise it is a footgun of a different shape than the one being removed — the ring says "you are on Cancel" while the keyboard says "Enter is destructive." The resolution is to render the mapping instead of implying it: a small `kbd` hint sits inside each footer button (`Esc` inside Cancel, `Enter` inside the confirm button), styled to match the existing `WelcomeScreen` shortcut hints, with both labels coming from i18n.

Whether the hints actually carry that weight in use is a judgement that can only be made by looking at the running app — human verification item 3 exists precisely to test it, and it asks specifically whether the focus ring is visible enough against the dark dialog background. If the ring reads poorly there, the hints are doing all the work alone and the ring needs strengthening. That item is not yet confirmed.

## Deviations from Plan

**1. [Rule 1 — Bug] The provider key link uses `openLink`, not an `<a href>`**
- **Found during:** Task 2
- **Issue:** The plan asked for "an anchor ... pointing at `PROVIDER_LINKS[provider].keys`". In an Electron renderer, a real `<a href>` navigates the app window away from the React app — there is no browser chrome to come back from. Every other external link in this file already goes through `window.electronAPI.openLink`.
- **Fix:** Used a button calling the file's existing `openLink(...)` helper, matching the convention already used for the signup/keys links in `renderAPI`.
- **Files modified:** `src/components/Settings/SettingsPage.tsx`
- **Commit:** `3314e58`

**2. [Rule 3 — Blocking] Added a module-level `apiKeyPageFor(provider)` helper**
- **Found during:** Task 2
- **Issue:** The component's state variable is `apiProvider`, not `provider`, so the literal expression the verification gate pins (`PROVIDER_LINKS[provider].keys`) had no natural home.
- **Fix:** Added `const apiKeyPageFor = (provider: APIProvider) => PROVIDER_LINKS[provider].keys;` next to `PROVIDER_LINKS`, called as `apiKeyPageFor(apiProvider)`. This is ordinary code rather than a gate accommodation — it names the mapping the footer needs.
- **Files modified:** `src/components/Settings/SettingsPage.tsx`
- **Commit:** `3314e58`

**3. [Layout choice offered by the plan] The no-key notice stacks above the button row**
- **Found during:** Task 2
- **Issue:** The plan allowed either an inline single line or a stacked block "if the footer gets cramped". The settings window is 660px wide (`setSetupWindowSize` at `SettingsPage.tsx:277`) and the body string is long; inline alongside Quit, Cancel and Save would have crowded badly.
- **Fix:** The footer is now a `space-y-2` column — notice row on top (only when `!apiKey`), button row beneath. Human verification item 4 should still judge readability at that size.
- **Commit:** `3314e58`

**4. [Rule 2 — Missing coverage] The parity test also rejects empty locale values**
- **Found during:** Task 1
- **Issue:** Key-set symmetry alone would pass a locale where a Russian string was added as `""`, which renders as a blank label rather than a visible failure.
- **Fix:** Added an assertion that no key in either locale holds a blank string.
- **Commit:** `819f471`

No architectural changes were needed; no authentication gates were hit.

## Known Remaining Sharp Edge

**The Ctrl+Q global shortcut still quits without confirmation.** It is registered in the main process (`electron/shortcuts.ts`), so gating it needs a main-to-renderer round trip — main asks the renderer to show a confirmation and waits for the answer, or the confirmation moves into a main-process dialog. Neither fits this task. It is a deliberate two-key chord rather than a misclick target, and the audit finding was specifically about the button adjacency, which is what got fixed. Worth revisiting if a user ever reports losing a session to a fat-fingered Ctrl+Q.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean |
| `npx tsc --noEmit -p tsconfig.electron.json` | clean |
| `npx tsc --noEmit -p tsconfig.node.json` | clean |
| `npx eslint .` | clean, no output |
| `npx vitest run` | 13 files, **126 tests passing** (baseline was 11 files / 85) |
| Locale parity script | `PASS 278 keys` |
| All 9 task gates (grep-pinned) | pass |

The 41 new tests are the 35 parity assertions plus 6 dialog behaviors. No previously passing file regressed.

The gates were confirmed discriminating: `confirmQuit`, `confirmClearHistory` and `confirmDeleteSession` did not exist before the change, and the "IPC lives inside the confirm callback" gates are what would catch a dialog rendered with `onConfirm` wired to a no-op.

## Outstanding — Human Verification Required

None of the six items in the plan's `<human_verification>` block has been confirmed; all six can only be judged by looking at the running app, and no gate was invented in their place. Briefly:

1. WelcomeScreen bottom edge — hint legible, bug icon clear of it, panel unfolds left.
2. Settings footer geometry — Quit far left, Cancel+Save far right, Quit not reading as primary.
3. Quit confirmation, keyboard only — Escape cancels, Enter quits, **and specifically whether the focus ring is visible against the dark dialog**.
4. No-key forward path — notice readable (not crowding), key link tracks the provider dropdown, Guided setup reaches the wizard.
5. History confirmations present, **and screenshot deletion still immediate with no prompt** — if a screenshot delete now prompts, the classification was implemented wrong.
6. Stacking — dev toolbar behind the dialog overlay with a confirmation open.

## Working-Tree Note

`tsconfig.node.tsbuildinfo` is present as untracked and is **not** covered by `.gitignore`. It predates this task's edits (it was already in `git status` before the first change) and is a tsc incremental artifact from the pre-dispatch typecheck. It was deliberately left uncommitted. Adding it to `.gitignore` is a reasonable follow-up but was out of scope here.

## Self-Check: PASSED

- `src/components/ui/confirm-dialog.tsx` — FOUND
- `tests/unit/i18nParity.test.ts` — FOUND
- `tests/unit/confirmDialog.test.tsx` — FOUND
- Commit `819f471` — FOUND
- Commit `3314e58` — FOUND
- Commit `c81e205` — FOUND
