---
phase: quick-260827-rzp
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260827-rzp]
files_modified:
  - electron/constants/geminiModels.ts
  - electron/ConfigHelper.ts
  - src/types/index.ts
  - tests/unit/geminiModels.test.ts
  - src/components/Settings/SettingsPage.tsx
  - src/components/Settings/SettingsForm.tsx
  - src/components/Wizard/WizardSteps/StepProvider.tsx
  - src/components/Wizard/WizardContainer.tsx
  - tests/integration/ipcContract.integration.test.ts
  - tests/integration/processingHelper.integration.test.ts
  - electron/audio/GeminiLiveService.ts
  - electron/audio/HintGenerationService.ts
  - electron/AudioProcessor.ts
  - electron/services/ProfileExtractorService.ts
  - electron/processing/providers/GeminiProcessingProvider.ts
  - src/_pages/DebugLive.tsx
  - backend/src/processing/providers/gemini.models.ts
  - backend/src/processing/providers/gemini.provider.ts

must_haves:
  truths:
    - "Every Gemini model id used at runtime in the desktop app is read from electron/constants/geminiModels.ts — no repeated string literal outside that module."
    - "A user whose config.json still holds a retired preview id gets a current-generation id after ConfigHelper loads the config, instead of a 404 from the Gemini API."
    - "The Gemini model picker in Settings offers only current-generation ids plus the existing Custom Model affordance."
    - "The Live API websocket model is left on its own model family and is documented as not interchangeable with generateContent ids."
    - "dist-electron/main.js remains the compiled Electron entry — the electron TypeScript program does not pull any repo src/ file into its rootDir."
  artifacts:
    - electron/constants/geminiModels.ts
    - tests/unit/geminiModels.test.ts
    - backend/src/processing/providers/gemini.models.ts
  key_links:
    - "src/types/index.ts DEFAULT_CONFIG imports electron/constants/geminiModels.ts — the cross-boundary import that must resolve under vite, vitest, and tsconfig.json typecheck."
    - "ConfigHelper.sanitizeModelSelection delegates to resolveGeminiModelId — the single chokepoint both loadConfig and updateConfig already pass through, so migration lands for free on both paths."
    - "tsconfig.electron.json inferred rootDir determines package.json main (./dist-electron/main.js) — placing the shared module under electron/ is what keeps that entry path stable."
---

<objective>
Replace the stale Gemini model ids (`gemini-3-flash-preview`, `gemini-3-pro-preview`, and the 2.0/1.5-era UI entries) with the current generation, and collapse the ~40 scattered string literals into one constants module that both the Electron main process and the renderer import.

Purpose: the app currently pins model ids that are retired preview aliases. Every new id has to be pasted into 15+ files by hand, and existing users have a retired id persisted in `config.json` that will start returning 404s.
Output: `electron/constants/geminiModels.ts` as the single source of truth, a forward-migration path for persisted legacy ids, refreshed UI pickers, and updated tests.
</objective>

<execution_context>
@C:/Users/klarn/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/klarn/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/codebase/CONVENTIONS.md
@CLAUDE.md

@electron/ConfigHelper.ts
@src/types/index.ts
@electron/audio/GeminiLiveService.ts
</context>

<research_findings>
Two claims in the task brief do not match the code. Both were verified by grep before this plan was written; follow the plan, not the brief, where they differ.

1. **There is no `allowedModels` array.** `grep -rn "allowedModels" electron/ src/` returns nothing. The only model gate is `ConfigHelper.sanitizeModelSelection` (electron/ConfigHelper.ts:237), which checks non-empty and otherwise returns the string untouched. So unknown models are **not** silently reset today — but they are also not validated at all, and the raw string is interpolated straight into a URL path (`models/${model}:generateContent`). The plan adds the missing gate in the right shape (see Decision 3) rather than editing an array that does not exist.

2. **`RESPONSE_MODEL` in GeminiLiveService has zero consumers.** `grep -rn "RESPONSE_MODEL" electron src` matches only its own declaration (electron/audio/GeminiLiveService.ts:57). It is a generateContent-family id that was exported for future use, so it is safe to repoint. The *actual* Live socket model is `DEFAULT_MODEL` on line 55.

**Module placement (this is the load-bearing constraint).** `tsconfig.electron.json` sets `include: ["electron/**/*"]`, `outDir: "dist-electron"`, and **no explicit `rootDir`**. TypeScript therefore infers rootDir as the common directory of all program files, which today is `electron/` — which is why `electron/main.ts` compiles to `dist-electron/main.js` and matches `package.json` `"main": "./dist-electron/main.js"`. If any electron file imports from `src/`, the inferred common root becomes the repo root and every output shifts down one level to `dist-electron/electron/main.js`, silently breaking the app entry point.

Consequence: **the shared module must live under `electron/`, not `src/`.** The renderer can import it (renderer `tsconfig.json` already has `include: ["electron/**/*", "src/**/*"]`, and vite resolves relative paths outside `src/` fine) as long as the module stays pure constants with no `electron`/node imports.

**No `@shared`-style alias exists.** Adding one would require parallel edits to `vite.config.ts`, `vitest.config.ts`, and `tsconfig.json` `paths` for zero functional gain, so renderer files use relative imports (`../../../electron/constants/geminiModels`).

**The backend cannot share the module.** `backend/tsconfig.json` sets `"rootDir": "./src"` and `backend/` is a separate package with its own `package.json`. A true single module would require promoting a shared workspace package, which is out of scope here. The backend therefore gets a small mirror file that names the desktop module as source of truth in a header comment.
</research_findings>

<decisions>
**D-01 — Live API model is deliberately NOT changed.** `DEFAULT_MODEL` (electron/audio/GeminiLiveService.ts:55) drives the `BidiGenerateContent` websocket. The Live API accepts a narrower, separately-versioned model family; a generateContent id is not valid there. It moves into the constants module as `GEMINI_MODELS.LIVE` with its value unchanged and a comment recording that it must be checked against the Live API docs before any future edit. `RESPONSE_MODEL` on line 57 is a generateContent id (unused — see research findings) and *is* repointed.

**D-02 — Migration hook is `sanitizeModelSelection`.** Both `loadConfig` (ConfigHelper.ts:345+) and `updateConfig` (ConfigHelper.ts:470+) already funnel through it, so one edit covers read-time and write-time. Existing users get the remap on the very next config load; the remapped value is persisted on the next save. No reset, no blank field.

**D-03 — Soft gate, not a hard allowlist.** The Settings picker already offers a `{ id: "custom", name: "Custom Model..." }` entry for Gemini, so rejecting ids outside a known list would break a shipped feature. Instead `resolveGeminiModelId` does: trim → legacy remap → URL-path-safety check (`[A-Za-z0-9._-]` only) → fall back to `DEFAULT` if the shape is unsafe. Known-list membership is exported separately (`GEMINI_MODEL_IDS`) for the picker only. The charset check is gemini-only because custom-provider ids legitimately contain `/` (e.g. the DeepSeek default).

**D-04 — Role→model assignment.**
| Role | Model | Why |
|------|-------|-----|
| DEFAULT / EXTRACTION / SOLUTION / DEBUG / HINT / AUDIO | `gemini-3.7-flash` | Released 2026-08-13, best for code/agentic work, introductory pricing through 2026-12-31 |
| PROFILE | `gemini-3.6-flash` | CV/JD parsing is long-input structured extraction; 3.6's token efficiency beats flash-lite's latency optimization here, and it is cheaper than 3.5 Flash |
| LIVE | unchanged (`gemini-2.5-flash-native-audio-preview-12-2025`) | See D-01 |
Picker list: `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro`, plus the existing Custom entry.
</decisions>

<tasks>

<!-- planner-discipline-allow: gemini-3-flash-preview -->
<!-- planner-discipline-allow: gemini-3-pro-preview -->
<!-- planner-discipline-allow: gemini-2.0-flash -->
<!-- planner-discipline-allow: gemini-2.0-pro-exp-02-05 -->
<!-- planner-discipline-allow: gemini-1.5-pro -->

<task type="tracer" tdd="true">
  <name>Task 1: Constants module + ConfigHelper migration, proven end-to-end</name>
  <files>electron/constants/geminiModels.ts, electron/ConfigHelper.ts, src/types/index.ts, tests/unit/geminiModels.test.ts</files>
  <read_first>electron/ConfigHelper.ts (lines 146-180 defaultConfig, 234-248 sanitizeModelSelection, 250-290 migrateConfig, 317-380 loadConfig, 450-480 provider-switch reset, 1018-1032 testGeminiKey), src/types/index.ts (lines 276-290 DEFAULT_CONFIG), tests/unit/sessionRestore.test.ts (relative-import precedent from tests/ into src/)</read_first>
  <behavior>
    - `resolveGeminiModelId("gemini-3-flash-preview")` returns `GEMINI_MODELS.DEFAULT`
    - `resolveGeminiModelId("gemini-3-pro-preview")` returns `gemini-3.1-pro`
    - `resolveGeminiModelId("gemini-2.0-flash")` returns `gemini-3.6-flash`
    - `resolveGeminiModelId("gemini-1.5-pro")` and `resolveGeminiModelId("gemini-2.0-pro-exp-02-05")` return `gemini-3.1-pro`
    - `resolveGeminiModelId("")` and `resolveGeminiModelId("   ")` return `GEMINI_MODELS.DEFAULT`
    - `resolveGeminiModelId("../../v1beta/models/x")` returns `GEMINI_MODELS.DEFAULT` (path-traversal shape rejected)
    - `resolveGeminiModelId("some-fine-tuned-model-1")` returns it unchanged (unknown-but-safe ids pass through, preserving the Custom Model feature)
    - Every entry in `GEMINI_SELECTABLE_MODELS` has an `id` that survives `resolveGeminiModelId` unchanged (no selectable id is itself legacy)
    - `DEFAULT_CONFIG.extractionModel` from `src/types/index.ts` strictly equals `GEMINI_MODELS.EXTRACTION` (this assertion is what proves the cross-boundary import resolves)
  </behavior>
  <action>
Create `electron/constants/geminiModels.ts`. It must contain ONLY plain data and pure functions — no `electron`, no node builtins, no imports at all — because the renderer bundles it through vite. Per CONVENTIONS.md use UPPER_SNAKE_CASE for the constant objects, camelCase for functions, and `as const` assertions.

Export, in this order:
- `GEMINI_MODELS` — an `as const` object keyed by role: `DEFAULT`, `EXTRACTION`, `SOLUTION`, `DEBUG`, `HINT`, `AUDIO`, `PROFILE`, `LIVE`. Values per the D-04 table.
- A block comment directly above the `LIVE` key recording that it targets the BidiGenerateContent websocket, belongs to a different model family than the generateContent roles above it, is not interchangeable with them, and must be re-checked against the Live API model list at ai.google.dev/gemini-api/docs/live before anyone edits it.
- `GEMINI_SELECTABLE_MODELS` — an `as const` array of `{ id, name }` for the Settings picker: `gemini-3.7-flash` / "Gemini 3.7 Flash", `gemini-3.6-flash` / "Gemini 3.6 Flash", `gemini-3.5-flash-lite` / "Gemini 3.5 Flash Lite", `gemini-3.1-pro` / "Gemini 3.1 Pro". Do NOT include the Custom entry here — call sites append their own, since only SettingsPage offers it.
- `GEMINI_MODEL_IDS` — a `readonly string[]` derived from `GEMINI_SELECTABLE_MODELS.map(m => m.id)`. Derived, never hand-written.
- `LEGACY_GEMINI_MODEL_MAP` — a `Record<string, string>` mapping retired ids forward. Entries: `gemini-3-flash-preview` and `gemini-3-flash` → `GEMINI_MODELS.DEFAULT`; `gemini-3-pro-preview` → `gemini-3.1-pro`; `gemini-2.0-flash` → `gemini-3.6-flash`; `gemini-2.0-pro-exp-02-05` → `gemini-3.1-pro`; `gemini-1.5-pro` → `gemini-3.1-pro`. This is the ONE place the retired ids are allowed to appear as data.
- `isKnownGeminiModel(id: string): boolean` — membership test against `GEMINI_MODEL_IDS`, for UI hinting only.
- `resolveGeminiModelId(model: string | undefined | null): string` — trim; empty/non-string → `GEMINI_MODELS.DEFAULT`; look up `LEGACY_GEMINI_MODEL_MAP` and return the mapped id if hit; then require the id to match `/^[A-Za-z0-9._-]+$/` (it is interpolated into a URL path segment) and return `GEMINI_MODELS.DEFAULT` if it does not; otherwise return the trimmed id unchanged.

In `electron/ConfigHelper.ts`, import from `./constants/geminiModels` (relative path per CONVENTIONS.md main-process rule) and replace every hardcoded Gemini id:
- `defaultConfig` (~line 158): the three model fields use the EXTRACTION / SOLUTION / DEBUG roles.
- `sanitizeModelSelection` (~line 237): keep the existing openai / anthropic / custom fallbacks exactly as they are. For the gemini branch, and for gemini only, delegate the whole body to `resolveGeminiModelId(model)` — this is the migration chokepoint (D-02), so it must run on *every* gemini value, not just empty ones. Non-gemini providers keep their current trim-and-return path untouched.
- `migrateConfig` (~lines 262-266): the three `config.X || "…"` fallbacks use the role constants.
- Provider-switch reset block (~lines 464-466): the gemini `else` branch uses the role constants.
- `testGeminiKey` (~line 1026): the fallback becomes `resolveGeminiModelId(model)` so a stale persisted id does not make the key test fail against a retired endpoint.

In `src/types/index.ts`, import `GEMINI_MODELS` via the relative path `../../electron/constants/geminiModels` and set the three `DEFAULT_CONFIG` model fields from the role constants. Do not add a path alias.

Create `tests/unit/geminiModels.test.ts` covering every case in `<behavior>`. Follow the file style of `tests/unit/sessionRestore.test.ts`: `/// <reference types="vitest/globals" />`, explicit `import { describe, expect, it } from "vitest"`, relative imports (`../../electron/constants/geminiModels` and `../../src/types`).
  </action>
  <verify>
    <automated>npx vitest run tests/unit/geminiModels.test.ts</automated>
    <automated>npx tsc -p tsconfig.electron.json --noEmit</automated>
    <automated>test "$(npx tsc -p tsconfig.electron.json --noEmit --listFiles | grep -v node_modules | grep -icE '[\\/]src[\\/]')" = "0"</automated>
  </verify>
  <done>All behavior cases pass. The electron program typechecks clean and contains zero repo `src/` files, so the inferred rootDir stays at `electron/` and `dist-electron/main.js` remains the entry.</done>
  <reversibility rating="reversible">Pure additive module plus in-place literal swaps; revert is a single git revert.</reversibility>
</task>

<task type="auto">
  <name>Task 2: Repoint renderer pickers, wizard defaults, and integration test fixtures</name>
  <files>src/components/Settings/SettingsPage.tsx, src/components/Settings/SettingsForm.tsx, src/components/Wizard/WizardSteps/StepProvider.tsx, src/components/Wizard/WizardContainer.tsx, tests/integration/ipcContract.integration.test.ts, tests/integration/processingHelper.integration.test.ts</files>
  <read_first>electron/constants/geminiModels.ts (created in Task 1), src/components/Settings/SettingsPage.tsx (lines 12-27 PROVIDER_META and MODELS, 130-140 useState defaults, ~1032 prompt-preview label), src/components/Settings/SettingsForm.tsx (lines 7-27), src/components/Wizard/WizardSteps/StepProvider.tsx (lines 42-56), src/components/Wizard/WizardContainer.tsx (lines 48-56)</read_first>
  <action>
All four renderer files import from `../../../electron/constants/geminiModels` (Settings and WizardSteps depth) or `../../electron/constants/geminiModels` (WizardContainer depth) — count the directory levels per file rather than copying one path.

`src/components/Settings/SettingsPage.tsx`:
- `PROVIDER_META.gemini.model` uses `GEMINI_MODELS.DEFAULT`. Leave the openai / anthropic / custom entries alone.
- `MODELS.gemini` becomes a spread of `GEMINI_SELECTABLE_MODELS` followed by the existing `{ id: "custom", name: "Custom Model..." }` entry, which must be preserved. `MODELS` is typed `Record<APIProvider, { id: string; name: string }[]>` and `GEMINI_SELECTABLE_MODELS` is `as const`, so spread into a fresh mutable array; if TS complains about readonly, widen with an explicit `{ id: string; name: string }[]` annotation rather than casting away the const.
- The three `useState` initializers around lines 135-137 use the EXTRACTION / SOLUTION / DEBUG roles.
- The prompt-preview label near line 1032 renders a hardcoded model name in parentheses; make it interpolate `GEMINI_MODELS.HINT` so it can never drift from what HintGenerationService actually calls.

`src/components/Settings/SettingsForm.tsx` (reached via SettingsDialog in overlay mode): `PROVIDER_DEFAULTS.gemini.model` uses `GEMINI_MODELS.DEFAULT`; `MODELS.gemini` becomes the spread of `GEMINI_SELECTABLE_MODELS`. This file has no Custom entry today — do not add one.

`src/components/Wizard/WizardSteps/StepProvider.tsx`: in `handleSelectProvider`, the three nested ternaries each end in a gemini fallback branch; replace those three trailing literals with the EXTRACTION / SOLUTION / DEBUG roles. Leave the openai / anthropic / custom branches untouched.

`src/components/Wizard/WizardContainer.tsx`: the three model fields in the `useState` config seed use the role constants. Note this file already imports `DEFAULT_CONFIG` from types — prefer reading the roles from the constants module directly so the intent is explicit at the call site.

Both integration tests use the ids only as mock-config fixtures (no assertions on the literals). Point their `extractionModel` / `solutionModel` / `debuggingModel` fixture fields at the role constants via `../../electron/constants/geminiModels`, so the fixtures track the source of truth instead of pinning a value that will go stale again. In `ipcContract.integration.test.ts` the fixture lives inside a `vi.hoisted` factory — module-scope imports are available there, but if the hoisting order causes a TDZ error, fall back to inlining the current-generation literal in that one factory and leave a `// NOTE:` explaining the hoisting constraint.
  </action>
  <verify>
    <automated>npx vitest run tests/integration/ipcContract.integration.test.ts tests/integration/processingHelper.integration.test.ts</automated>
    <automated>npx tsc -p tsconfig.json --noEmit</automated>
    <automated>npx eslint src/components/Settings src/components/Wizard</automated>
  </verify>
  <done>Both integration suites pass, the renderer typechecks clean, and the Gemini picker in both Settings surfaces lists only current-generation ids while SettingsPage keeps its Custom Model entry.</done>
</task>

<task type="auto">
  <name>Task 3: Repoint service-layer and backend call sites, isolating the Live API model</name>
  <files>electron/audio/GeminiLiveService.ts, electron/audio/HintGenerationService.ts, electron/AudioProcessor.ts, electron/services/ProfileExtractorService.ts, electron/processing/providers/GeminiProcessingProvider.ts, src/_pages/DebugLive.tsx, backend/src/processing/providers/gemini.models.ts, backend/src/processing/providers/gemini.provider.ts</files>
  <read_first>electron/constants/geminiModels.ts (created in Task 1), electron/audio/GeminiLiveService.ts (lines 53-58), electron/AudioProcessor.ts (lines 29-60), electron/processing/providers/GeminiProcessingProvider.ts (lines 70-200 — three fetch URLs), backend/src/processing/providers/gemini.provider.ts (lines 60-70, 130-140, 180-190)</read_first>
  <action>
`electron/audio/GeminiLiveService.ts` — this is the D-01 decision, implement it exactly. Keep the module-level `DEFAULT_MODEL` binding and its current *value*, but source it from `GEMINI_MODELS.LIVE` so the value lives in one place.

The two-line comment immediately above that binding (around line 53-54) is **already wrong** and must be corrected, not extended: it claims `gemini-live-2.5-flash-preview` supports TEXT response modality natively, but the constant on the next line has never held that id. Rewrite the comment so it (a) names the id the constant actually resolves to rather than a stale unrelated one, (b) states that the Live socket accepts a narrower model family than generateContent and that dropping in a Flash generateContent id would break the connection, and (c) points at ai.google.dev/gemini-api/docs/live as the list to check before editing. If you cannot confirm the TEXT-modality claim from the docs, drop that claim rather than carrying it forward — do not restate an assertion you have not verified.

Repoint the exported `RESPONSE_MODEL` to `GEMINI_MODELS.DEFAULT` — it is a generateContent id with no current consumers, so keep the export (in case anything downstream picks it up) but stop pinning a retired value.

`src/_pages/DebugLive.tsx` — its module-level Live model constant currently duplicates the GeminiLiveService value; source it from `GEMINI_MODELS.LIVE` via a relative import so the debug page and the service can never disagree. This is a Live id, so the same do-not-swap reasoning applies; do not change its value.

`electron/audio/HintGenerationService.ts` — the module-level hint model constant is sourced from `GEMINI_MODELS.HINT`. This service posts to generativelanguage.googleapis.com over `https`, so it is a generateContent-family caller and the swap is safe.

`electron/AudioProcessor.ts` — two sites. The constructor fallback (~line 32) uses `GEMINI_MODELS.AUDIO`. Inside `transcribe` (~line 57) there is a second, *shadowing* local that hardcodes the model and overrides whatever the constructor resolved; replace that literal with `GEMINI_MODELS.AUDIO` and drop the stale "fallback to stable model" comment, since the two values now agree by construction. Do not silently change which of the two wins — keep the existing local-variable structure.

`electron/services/ProfileExtractorService.ts` — the module-level model constant uses `GEMINI_MODELS.PROFILE` (see D-04: 3.6 Flash, not the default, because CV/JD parsing is long-input structured extraction).

`electron/processing/providers/GeminiProcessingProvider.ts` — three `fetch` template literals each embed `request.model || "<literal>"`. Replace each with `resolveGeminiModelId(request.model)`. This is the security-relevant edit: it is the point where a config-sourced string reaches a URL path segment (T-QUICK-01), and `resolveGeminiModelId` charset-guards it.

`backend/src/processing/providers/gemini.models.ts` — new file. The backend cannot import the desktop module (`backend/tsconfig.json` pins `rootDir: "./src"`, separate package). Create a minimal mirror exporting `GEMINI_MODELS` with just the `DEFAULT` role and a `resolveGeminiModelId` with the same trim → legacy-remap → charset-guard → fallback semantics. Open the file with a header comment naming `electron/constants/geminiModels.ts` as the source of truth, stating that this file is a deliberate duplicate forced by the rootDir boundary, and that both files must be updated together. Use backend conventions (CommonJS-compatible named exports, no semicolon-style change — match the surrounding backend files).

`backend/src/processing/providers/gemini.provider.ts` — three `request.model || '<literal>'` sites (~lines 67, 135, 185) each become `resolveGeminiModelId(request.model)` importing from `./gemini.models`.
  </action>
  <verify>
    <automated>npx tsc -p tsconfig.electron.json --noEmit &amp;&amp; npx tsc -p tsconfig.json --noEmit</automated>
    <automated>cd backend &amp;&amp; npx tsc --noEmit</automated>
    <automated>npx vitest run</automated>
    <automated>test -z "$(grep -rn -E 'gemini-3-flash\b|gemini-3-pro-preview|gemini-2\.0-flash|gemini-2\.0-pro-exp|gemini-1\.5-pro' --include=*.ts --include=*.tsx src electron tests backend/src | grep -v 'electron/constants/geminiModels.ts' | grep -v 'backend/src/processing/providers/gemini.models.ts')"</automated>
    <automated>test "$(grep -r -F 'gemini-2.5-flash-native-audio-preview-12-2025' --include=*.ts --include=*.tsx electron src | wc -l | tr -d ' ')" = "1"</automated>
  </verify>
  <done>Desktop and backend both typecheck, the full vitest suite passes, no retired Gemini id survives outside the two constants modules, and the Live API model id exists in exactly one place (the constants module) with its value unchanged.</done>
  <reversibility rating="reversible">Literal-for-constant substitutions plus one additive backend file.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `config.json` on disk → Electron main | A user- or malware-writable JSON file supplies the model id string |
| Electron main → generativelanguage.googleapis.com | The model id is interpolated into a URL **path segment** (`models/{id}:generateContent`), not a query value or body field |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-QUICK-01 | Tampering | `GeminiProcessingProvider` / `AudioProcessor` / `testGeminiKey` URL construction fed by `config.json` | medium | mitigate | `resolveGeminiModelId` enforces `/^[A-Za-z0-9._-]+$/` before the id can reach a URL path segment, falling back to `GEMINI_MODELS.DEFAULT`; applied at the three `fetch` sites in Task 3 and at the ConfigHelper chokepoint in Task 1. Guard is gemini-only so custom-provider ids containing `/` still work. |
| T-QUICK-02 | Denial of Service | Existing installs with a retired preview id persisted in `config.json` | medium | mitigate | `LEGACY_GEMINI_MODEL_MAP` remaps forward inside `sanitizeModelSelection`, which both `loadConfig` and `updateConfig` already call — retired ids never reach the API. |
| T-QUICK-03 | Information Disclosure | `AudioProcessor` logs an API-key prefix alongside the model on every transcription | low | accept | Pre-existing behavior, out of scope for a model-id change; logged only via the scoped logger, prefix only. Noted for a future pass rather than expanded here. |
| T-QUICK-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no packages and adds no dependencies — the supply-chain surface is unchanged, so no Package Legitimacy Gate applies. |
</threat_model>

<verification>
1. `npx vitest run` — full suite green (unit + all three integration suites).
2. `npx tsc -p tsconfig.electron.json --noEmit` and `npx tsc -p tsconfig.json --noEmit` — both clean.
3. `cd backend && npx tsc --noEmit` — clean.
4. rootDir guard: the electron program lists zero repo `src/` files, so `dist-electron/main.js` stays the entry named by `package.json`.
5. Stale-id sweep across `src`, `electron`, `tests`, `backend/src` returns nothing outside the two constants modules.
6. Live-id uniqueness: `gemini-2.5-flash-native-audio-preview-12-2025` appears exactly once in the desktop tree, in `electron/constants/geminiModels.ts`, with its value unchanged.

Do NOT run `npm run dev` — the app is already running in this session, and `npm run dev` starts with `npm run clean`, which would wipe `dist-electron` out from under the live process.
</verification>

<success_criteria>
- `electron/constants/geminiModels.ts` is the only place a Gemini model id is written as a literal in the desktop app (the backend mirror is the one documented exception).
- The default Gemini model across defaults, wizard, settings, and services is `gemini-3.7-flash`.
- A `config.json` holding `gemini-3-flash-preview` resolves to `gemini-3.7-flash` on the next load, with no reset and no blank field — proven by a unit test, not by inspection.
- The Live API websocket model value is byte-identical to what shipped, and its constant carries a comment explaining why.
- Settings offers only current-generation Gemini ids, and SettingsPage keeps its Custom Model entry working.
- Full test suite and all three typecheck targets pass.
</success_criteria>

<output>
Create `.planning/quick/260827-rzp-update-gemini-model-ids-to-current-gener/260827-rzp-SUMMARY.md` when done.
</output>
