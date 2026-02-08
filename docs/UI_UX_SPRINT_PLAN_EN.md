# UI/UX Redesign Sprint Plan (English)

Date: 2026-02-07  
Project: `interview-coder-withoupaywall-opensource`  
Purpose: Execution-ready sprint board plan for delivering the redesigned UI/UX.

Related documents:
- `docs/UI_UX_AUDIT_AND_REDESIGN_MASTER_RU.md`
- `docs/UI_UX_EXECUTIVE_SUMMARY_RU.md`
- `docs/UI_UX_IMPLEMENTATION_BACKLOG_RU.md`
- `docs/UI_UX_STEP_BY_STEP_EXECUTION_PLAN_RU.md`
- `docs/UI_UX_TODO_PROGRESS_RU.md` (live progress tracker)

---

## 1. Planning Assumptions

1. Sprint length: 1 week (5 working days).
2. Team:
- Product Owner (PO)
- UX Designer
- UI Designer
- Frontend Engineer (Renderer)
- Electron/Main Engineer
- QA Engineer
3. Priority order: P0 -> P1 core -> P1 completion -> P2.
4. Target outcome: operationally reliable UX first, visual polish second.

---

## 2. Workstream Structure

1. WS-A: Product truth and consistency
- Hotkeys, security copy, logout semantics, fake validation removal.
2. WS-B: Real-time visibility and latency UX
- Processing state display, live state lane, error recovery.
3. WS-C: Core interaction redesign
- Main control panel hierarchy, target size, readability.
4. WS-D: Information architecture and legacy cleanup
- Session-first flow, remove outdated paths.
5. WS-E: QA, accessibility, release hardening
- Scenario tests, regression, rollout checks.

---

## 3. Sprint Roadmap Overview

## Sprint 1 (P0 Stabilization)
Backlog IDs:
- `UX-001`, `UX-002`, `UX-003`, `UX-004`, `UX-005`

Primary objective:
- Remove critical trust/consistency issues and make system status visible.

Definition of Done:
1. All UI hotkey references match actual shortcuts.
2. Processing stages are visible in renderer UI.
3. Security messaging is technically accurate.
4. Logout behavior is consistent from every surface.
5. Wizard tests are real or explicitly marked as simulation.

## Sprint 2 (P1 Core Experience)
Backlog IDs:
- `UX-101`, `UX-102`, `UX-103`, `UX-104`

Primary objective:
- Redesign critical interaction path and make live usage understandable under stress.

Definition of Done:
1. Main action row is simplified and high-confidence.
2. Live state lane clearly communicates listen/transcribe/generate/no-signal/error.
3. Errors include inline recovery actions (not toast-only).
4. Critical UI text and click targets meet readability/size standards.

## Sprint 3 (P1 Architecture Completion)
Backlog IDs:
- `UX-105`, `UX-106`, `UX-107`

Primary objective:
- Simplify app flow, ensure wizard/runtime consistency, remove legacy UX noise.

Definition of Done:
1. Session-first flow is clear and stable.
2. Wizard choices affect runtime behavior predictably.
3. Legacy subscription/supabase leftovers are not visible in active UX.

## Sprint 4 (P2 Enhancements + Hardening)
Backlog IDs:
- `UX-201`, `UX-202`, `UX-203`, `UX-204`

Primary objective:
- Improve response/debug workspace quality and finalize motion/system polish.

Definition of Done:
1. Response/debug outputs are easier to scan and act on.
2. Optional history/session layer is usable.
3. Motion is functional and not distracting.
4. Release passes UX + regression + accessibility checks.

---

## 4. Weekly Sprint Board Template

Use this board structure each sprint:

Columns:
1. `Backlog`
2. `Ready`
3. `In Progress`
4. `Code Review`
5. `QA`
6. `Done`
7. `Blocked`

For each ticket include:
1. Backlog ID (e.g., `UX-002`)
2. Owner
3. Scope (files/components)
4. Acceptance criteria
5. Test scenarios
6. Risk notes

---

## 5. Detailed Day-by-Day Plan

## Sprint 1 Day Plan

### Day 1 (Mon) — Alignment + Technical Entry
1. Kickoff, confirm sprint scope and risks.
2. Create implementation checklist per backlog ID.
3. Baseline capture for before/after validation.
4. Start `UX-001` and `UX-003`.

Owners:
- PO, UX, Frontend, Electron

Deliverables:
1. Sprint scope locked.
2. Copy/hotkey source-of-truth document.
3. First PR(s): hotkey text and security copy alignment.

### Day 2 (Tue) — Status Visibility
1. Implement renderer wiring for `processing-status` (`UX-002`).
2. Add visible stage + progress indicators in queue/solutions/unified panel.
3. QA smoke on screenshot flow.

Owners:
- Frontend, Electron, QA

Deliverables:
1. Processing stage visualization merged or ready for review.
2. Test checklist for waiting/latency states.

### Day 3 (Wed) — Logout and Setup Integrity
1. Normalize logout semantics (`UX-004`) across all entry points.
2. Replace fake validations or clearly label simulated checks (`UX-005` start).
3. Mid-sprint demo.

Owners:
- Frontend, Electron, PO, QA

Deliverables:
1. Unified logout behavior.
2. Wizard test behavior updated (real or explicit simulation state).

### Day 4 (Thu) — P0 Closure
1. Finalize remaining `UX-005` tasks.
2. Regression pass for launch/setup/process/logout/hotkeys.
3. Fix blockers and polish edge cases.

Owners:
- Frontend, Electron, QA

Deliverables:
1. All Sprint 1 tickets in QA or Done.
2. Regression report.

### Day 5 (Fri) — Hardening + Review
1. Final QA + bug fixes.
2. Sprint review and retrospective.
3. Prepare Sprint 2 backlog refinement.

Owners:
- Whole team

Deliverables:
1. Sprint 1 release candidate.
2. Signed-off P0 completion report.

---

## Sprint 2 Day Plan

### Day 1 (Mon)
1. UX/UI walkthrough of new control hierarchy (`UX-101`).
2. Start main panel restructure and state lane layout (`UX-102`).

### Day 2 (Tue)
1. Implement simplified action row + larger targets.
2. Integrate live state lane behavior with real events.

### Day 3 (Wed)
1. Implement inline error recovery components (`UX-103`).
2. Define and test recovery pathways for common failures.

### Day 4 (Thu)
1. Accessibility pass (`UX-104`): text sizes, contrast, hit areas.
2. Cross-flow consistency review (queue/solutions/live).

### Day 5 (Fri)
1. QA and performance checks under stress scenarios.
2. Sprint review and transition plan to Sprint 3.

---

## Sprint 3 Day Plan

### Day 1 (Mon)
1. IA simplification design lock (`UX-105`).
2. Route/state transition mapping and migration plan.

### Day 2 (Tue)
1. Implement Session-first flow.
2. Start runtime binding for wizard choices (`UX-106`).

### Day 3 (Wed)
1. Complete wizard/runtime consistency.
2. Remove or isolate legacy active UX paths (`UX-107`).

### Day 4 (Thu)
1. End-to-end QA for launch -> setup -> session -> re-entry.
2. Resolve architectural regressions.

### Day 5 (Fri)
1. Sprint review.
2. Backlog reprioritization for P2.

---

## Sprint 4 Day Plan

### Day 1 (Mon)
1. Response workspace restructuring (`UX-201`).
2. Debug workspace normalization (`UX-202`) design handoff.

### Day 2 (Tue)
1. Implement debug structure and formatting behavior.
2. Start session history layer (`UX-203`) if still in scope.

### Day 3 (Wed)
1. Continue P2 implementation.
2. Functional motion polish only (`UX-204`).

### Day 4 (Thu)
1. Full regression pass.
2. Accessibility and stability pass.

### Day 5 (Fri)
1. Release prep + rollout checklist.
2. Final review and post-release monitoring setup.

---

## 6. QA Scenarios Per Sprint

Run at minimum:
1. First launch and onboarding flow.
2. API key setup and validation path.
3. Screenshot capture -> process -> solution generation.
4. Live audio states:
- connecting
- listening
- transcribing
- generating
- no_signal
- error
5. Error recovery:
- invalid API key
- no screenshots
- processing failure
- audio permission denied
6. Logout/reset/re-entry consistency.
7. Hotkey consistency across UI text and real behavior.

---

## 7. Release Gates (Go/No-Go)

## Gate A (End of Sprint 1)
1. P0 critical issues resolved.
2. No false claims in UX copy.
3. No silent processing states.

## Gate B (End of Sprint 2)
1. Critical path is faster and clearer.
2. Error recovery is actionable.
3. Accessibility baseline met for critical screens.

## Gate C (End of Sprint 3)
1. IA simplified and stable.
2. Wizard choices reliably affect runtime.
3. Legacy UX noise removed from active flow.

## Gate D (Pre-release after Sprint 4)
1. Regression clean for high-severity scenarios.
2. Rollout checklist completed.
3. Monitoring and rollback strategy prepared.

---

## 8. KPI Tracking During Rollout

Track weekly:
1. Time to first useful answer.
2. Rate of “confused wait” events.
3. First-run setup completion rate.
4. Misclick/error rate in critical action path.
5. Error recovery success rate.

Success condition:
- KPI trend improves against baseline for at least 2 consecutive weeks.

---

## 9. RACI Snapshot

1. PO
- Owns priorities, scope, acceptance sign-off.
2. UX/UI
- Owns flow, hierarchy, states, copy intent.
3. Frontend Engineer
- Owns renderer components and interactions.
4. Electron/Main Engineer
- Owns IPC/events/shortcuts/runtime behavior.
5. QA
- Owns scenario validation and release quality signal.

---

## 10. Immediate Next Actions (Start This Week)

1. Create sprint tickets for `UX-001`..`UX-005`.
2. Assign owners and estimates.
3. Schedule Sprint 1 kickoff + Day 3 mid-sprint demo.
4. Freeze copy/source-of-truth for hotkeys and security wording.
5. Start implementation of `UX-002` first to remove silent waits early.

---

## 11. Execution Status Update (2026-02-07)

Implemented (P0):
1. `UX-001` Hotkey consistency:
- Updated wizard ready/display hints, status bar hints, and default display hotkey values to align with actual shortcut behavior (`Ctrl/Cmd + B`, `Ctrl/Cmd + H`, `Ctrl/Cmd + Enter`, etc.).
2. `UX-002` Processing visibility:
- Added renderer subscription to `"processing-status"` via preload bridge and global progress banner in app shell.
- Processing banner now auto-clears on success/error/reset/no-screenshots states.
3. `UX-003` Security copy accuracy:
- Removed hard claim of always-on OS encryption from API-key UX copy.
- Clarified local-only storage and direct provider calls wording in settings and wizard.
4. `UX-004` Logout semantics:
- Normalized logout action to: clear API key -> trigger reset -> confirmation toast -> reload.
- Applied across primary active surfaces (UnifiedPanel, SolutionCommands, Header).
5. `UX-005` Fake validation removal:
- Replaced simulated audio test with real media access checks (`getUserMedia` / `getDisplayMedia` + real level sampling).
- Replaced simulated wizard test metrics with readiness checks (API key presence, real API connectivity check, audio config/source readiness).

Validation:
1. Targeted ESLint pass for changed renderer/UI files: passed.
2. Production build (`npm run build`): passed.
3. Unit tests (`npm run test`): passed after removing unnecessary React plugin from `vitest.config.ts`.

---

## 12. Execution Status Update (2026-02-07, continued)

Implemented (Sprint 2 core):
1. `UX-101` Main action hierarchy:
- Reworked `UnifiedPanel` into explicit, high-confidence primary controls:
  - `Capture`
  - `Process`
  - `Start/Stop Live`
- Increased critical action target sizes and label readability.
2. `UX-102` Live state lane:
- Added visible lane for `connecting -> listening -> transcribing -> generating`.
- Added explicit badges for `no_signal` and `error` states.
- Added persistent in-panel status context (not only transient spinners/toasts).
3. `UX-103` Inline error-to-action recovery:
- Added inline recovery cards with direct actions in:
  - `src/components/UnifiedPanel/UnifiedPanel.tsx`
  - `src/_pages/Queue.tsx`
  - `src/_pages/Solutions.tsx`
- Recovery actions now include retry, capture screenshot, reset session, open API settings.
4. `UX-104` Accessibility baseline improvements:
- Increased key interaction text sizes in critical paths.
- Increased primary control hit areas in the unified action panel.
- Raised onboarding/support text readability in welcome and solutions flows.

Implemented (Sprint 3 completion):
1. `UX-105` IA simplification:
- Removed unused `debug` mode from active queue/solutions view contract (`setView` now session-focused).
- Simplified reset handlers in subscribed flow to reduce route/state ambiguity.
2. `UX-106` Wizard/runtime consistency:
- Runtime now loads and persists preferred audio source from config.
- Live start uses persisted source by default, with explicit source switcher.
- Wizard profile step now synchronizes profile data into config during setup.
- Runtime applies configured opacity at app initialization.
3. `UX-107` Legacy cleanup:
- Removed unused subscription/supabase renderer surfaces from active API declarations and preload bridge.
- Deleted unused legacy files: `src/_pages/SubscribePage.tsx`, `src/lib/supabase.ts`.
- Removed supabase-specific host allowlist entry in Electron window-open policy.

Validation (continued):
1. ESLint on touched app flow files: passed.
2. Build (`npm run build`): passed.
3. Tests (`npm run test`): passed.

---

## 13. Execution Status Update (2026-02-07, Sprint 4 complete)

Implemented (Sprint 4 P2):
1. `UX-201` Response Workspace v2:
- Reworked solution workspace into explicit structure: `Key Points -> Code -> Complexity -> Next Step`.
- Updated `src/_pages/Solutions.tsx` and `src/components/Response/AIResponse.tsx` for faster scanning and action handoff.
2. `UX-202` Debug Workspace v2:
- Standardized debug output model to `Issue -> Fix -> Why -> Verify`.
- Updated debug UI rendering in `src/_pages/Debug.tsx`.
- Updated provider prompts/parsing in `electron/ProcessingHelper.ts` to enforce repeatable sectioned output.
3. `UX-203` History/Session log:
- Added persistent session history storage in `electron/store.ts`.
- Added session history IPC surface (`get/delete/clear/get-item`) in `electron/ipcHandlers.ts` and `electron/preload.ts`.
- Integrated history modal in `src/_pages/Solutions.tsx` with `Use` action to restore previous solution/debug outputs.
4. `UX-204` Motion polish (functional):
- Added functional-only motion utilities and reduced-motion support in `src/index.css`.
- Applied transition polish to active state lane/notice surfaces in `src/components/UnifiedPanel/UnifiedPanel.tsx`.
- Applied functional entry motion to global processing banner in `src/App.tsx`.

Validation (Sprint 4):
1. ESLint on changed renderer/type files: passed.
2. Unit tests (`npm run test`): passed (`26/26`).
3. Build (`npm run build`): passed.
4. Technical hardening completed after Sprint 4:
- `TECH-001`: legacy strict ESLint errors in `electron/preload.ts`, `electron/ipcHandlers.ts`, `electron/ProcessingHelper.ts` were fixed.
- `TECH-002`: git metadata/pack corruption recovered; `git diff`, `git log`, and `git fsck --full` now run cleanly.

---

## 14. Execution Status Update (2026-02-07, Sprint 5 — i18n & Polish)

Implemented (Sprint 5):
1. `I18N-001` i18n infrastructure:
- Installed `react-i18next` + `i18next`.
- Created `src/i18n/` with `en.json` and `ru.json` locale files.
- Initialized i18n in `App.tsx` with language detection and React Suspense integration.
2. `I18N-002` Core component localization:
- Localized `WelcomeScreen.tsx`, `WizardContainer.tsx`, and `App.tsx` initialization text.
- Removed unused `SettingsDialog` import from App.
3. `I18N-003` AudioSettings localization:
- Replaced 30+ hardcoded strings with `t()` calls.
- Added full audio section keys (descriptions, recommended status, test phrases) to both locale files.
- Fixed Tailwind CSS lint warnings (`bg-white/[0.03]` → `bg-white/3`).
4. `I18N-004` SettingsPage Mode/Profile/Style localization:
- Replaced all hardcoded English strings in Mode, Profile, and Style sections with `t()`.
- Removed unused `RESPONSE_STYLES` and `RESPONSE_LENGTHS` constants.
- Added 38+ translation keys per locale (mode labels, profile prompts, style descriptors).
5. `I18N-005` Section transition animations:
- Added `fadeSection` keyframe + `.animate-fade-in` class to `index.css`.
- Wrapped section content in `<div key={activeSection} className="animate-fade-in">` for smooth transitions.
6. `TECH-003` ElectronAPI type deduplication:
- Identified root cause: `src/env.d.ts` had an incomplete ambient `ElectronAPI` interface shadowing the canonical one in `src/types/electron.d.ts`.
- Stripped `env.d.ts` to only Vite-specific `ImportMetaEnv`/`ImportMeta` types.
- Fixed `JSX.Element` → `React.JSX.Element` in `SettingsPage.tsx`.

Files modified:
- `src/env.d.ts` (stripped to Vite-only)
- `src/components/Settings/AudioSettings.tsx` (full i18n)
- `src/components/Settings/SettingsPage.tsx` (Mode/Profile/Style i18n, cleanup)
- `src/i18n/locales/en.json` (+70 keys)
- `src/i18n/locales/ru.json` (+70 keys)
- `src/index.css` (fade-in animation)

Validation (Sprint 5):
1. `tsc --noEmit`: passed (exit code 0). All remaining errors are pre-existing in unmodified files (`SolutionCommands.tsx`, `Solutions.tsx`, `DebugView.tsx`).
2. No new lint errors introduced by i18n changes.
