---
phase: quick-260827-wsj
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260827-wsj]
files_modified:
  - electron/constants/geminiModels.ts
  - electron/constants/liveModelProfiles.ts
  - electron/audio/liveSetupMessage.ts
  - electron/audio/customVocabulary.ts
  - electron/audio/GeminiLiveService.ts
  - electron/audio/LiveInterviewService.ts
  - electron/ipcHandlers.ts
  - backend/src/processing/providers/gemini.models.ts
  - public/pcm-capture-processor.js
  - src/components/UnifiedPanel/audioLevelThrottle.ts
  - tests/unit/geminiModels.test.ts
  - tests/unit/liveSetupMessage.test.ts
  - tests/unit/geminiLiveSetup.test.ts
  - tests/unit/geminiLiveTranscripts.test.ts
  - tests/unit/geminiLiveRotation.test.ts
  - tests/unit/customVocabulary.test.ts
  - tests/unit/pcmCaptureProcessor.test.ts
  - tests/integration/liveInterviewLifecycle.integration.test.ts

must_haves:
  truths:
    - "The live websocket setup names `models/gemini-3.5-transcribe-live` and requests `responseModalities: ['TEXT']`, not the native-audio model with an AUDIO response nothing plays."
    - "Selecting the `native-audio` rollback profile produces a setup message byte-equivalent to the pre-migration one — AUDIO modality, temperature/maxOutputTokens, systemInstruction, empty inputAudioTranscription, no customVocabulary — so the rollback branch is a working session and not just a swapped model string."
    - "The rollback is reachable without a rebuild: GEMINI_LIVE_PROFILE=native-audio in .env, or the profile/model id typed into the DebugLive model field, both select it."
    - "The model picker no longer offers a model id that does not exist on the API; the id that DOES exist (`gemini-3.1-pro-preview`) is offered in its place, in the desktop constants, the backend mirror, and the legacy remap table."
    - "No live session is allowed to reach the documented 10-minute server cap: a successor socket is opened at 9:00 and promoted at the first turnComplete boundary after that, or unconditionally by 9:30."
    - "No audio frame is dropped across a rotation — every buffer handed to sendAudio reaches exactly one OPEN socket, proven by a frame-accounting assertion against a fake websocket."
    - "A rotation preserves the accumulated transcript: no reset, no duplication, and no reordering between the predecessor's drained tail and the successor's first output."
    - "The successor socket receives zero audio frames while it is not the primary, so a rotation never doubles audio-token spend."
    - "`interimInputTranscription` is consumed as a REPLACEMENT tail held separately from the finalized transcript; speculative text never enters the finalized buffer, and it is dropped on final/turnComplete/rotation."
    - "Hints can start on a partial: an early hint fires once per turn from `finalized + interim` text after 600ms of quiet, gated on a meaningful-character threshold, and only on a profile that emits interim transcripts."
    - "The setup message carries at most 100 deduplicated custom-vocabulary phrases derived from the active profile and parsed job description, with free-text fields (CV prose, job description body, talking points) excluded by construction."
    - "Audio leaves the worklet in fixed 1600-sample / 3200-byte / 100ms frames at both 48kHz and 16kHz input, still carrying the RMS of that exact frame, still low-passed before decimation, and still bit-exact on the 16kHz mic path."
    - "Task 260827-tlv's work survives: the tuned VAD windows still reach the wire (now per-profile), the silence window is still strictly below HINT_TRIGGER_SILENCE_MS, the removed end-of-turn debounce apparatus stays removed, endTurn() still has zero callers, and the anti-aliasing low-pass and per-frame RMS are intact."
  artifacts:
    - electron/constants/liveModelProfiles.ts
    - electron/audio/liveSetupMessage.ts
    - electron/audio/customVocabulary.ts
    - tests/unit/liveSetupMessage.test.ts
    - tests/unit/geminiLiveTranscripts.test.ts
    - tests/unit/geminiLiveRotation.test.ts
    - tests/unit/customVocabulary.test.ts
  key_links:
    - "GEMINI_LIVE_PROFILE env var / liveInterviewStart({modelName}) -> LiveInterviewConfig.model -> GeminiLiveConfig.model -> resolveLiveModelProfile() -> LiveModelProfile -> buildLiveSetupMessage() -> the setup frame on the wire. This is the single chain the rollback flag travels; every capability that differs between the two models (response modality, system instruction, generation tuning, VAD tuning, custom vocabulary, interim transcripts, rotation schedule) is a field ON the profile, so one resolution decides all of them together."
    - "ConfigHelper active UserProfile + active CompanyContext -> ipcHandlers `live-interview-start` -> buildCustomVocabulary() -> LiveInterviewConfig.customVocabulary -> GeminiLiveConfig.customVocabulary -> setup.inputAudioTranscription.customVocabulary. GeminiLiveService holds the array on its config, so a rotated successor's setup carries the same vocabulary with no extra plumbing."
    - "serverContent.interimInputTranscription -> GeminiLiveService.interimTranscript (replacement) -> TranscriptUpdate.interimText -> LiveInterviewService.interimTranscript -> ListeningStatus.transcript (= currentTranscript + interimTranscript) -> live-interview-status IPC -> UnifiedPanel.tsx:815 and DebugLive.tsx:379. The finalized buffer is a separate field on the same event, so speculative text reaches the display without ever reaching the hint prompt's finalized baseline."
    - "GeminiLiveService.primary/successor socket handles -> sendAudio routes to primary only -> promoteSuccessor() swaps them synchronously after asserting the successor is OPEN -> the predecessor becomes `retiring` and keeps delivering transcripts for DRAIN_MS while the new primary's transcripts are queued. The swap being synchronous and OPEN-gated is what makes 'no dropped frame' true; the queue is what makes 'no reordering' true."
    - "Worklet FRAME_SIZE (1600 Int16 = 3200 bytes) -> useAudioCapture base64 -> liveInterviewSendAudio IPC -> LiveInterviewService.receiveAudio -> GeminiLiveService.sendAudio -> mimeType audio/pcm;rate=16000. The frame must stay 16kHz mono s16le; only its length changes. At 10 frames/sec both throttles added by 260827-tlv (50ms UI floor gate, 100ms status gate) become transparent — they are retained as guards, not removed."
---

<objective>
Migrate live interview transcription from the `gemini-2.5-flash-native-audio-preview-12-2025` Live API session to the purpose-built `gemini-3.5-transcribe-live` model, and build the four capabilities that model makes available or makes mandatory: session rotation before its hard 10-minute cap, custom vocabulary seeded from the parsed CV/job description, interim (speculative) transcripts consumed for faster hints, and a rollback flag that returns to the current model as a genuinely working session rather than a swapped string. Also correct a model id in the Settings picker that does not exist on the API.

Purpose: the app currently asks a conversational native-audio model for an AUDIO response that nothing ever plays, purely as a side effect of getting `inputTranscription` back. That is the wrong tool: it costs audio-output tokens for discarded audio, it cannot be given domain vocabulary, and it emits no speculative partials, so the earliest possible hint is gated behind a full 1.2s end-of-speech pause. `gemini-3.5-transcribe-live` is a transcription-only model on the same websocket endpoint with a TEXT response, a `customVocabulary` field, and an `interimInputTranscription` stream — but it also has a documented hard 10-minute session cap, which the current code has no concept of, so a long interview would simply die mid-sentence.
Output: a per-model capability profile that makes the two models interchangeable through one resolution point, a pure setup-message builder with a parity assertion against the pre-migration message, a socket-handle rotation mechanism with frame-accounting and ordering tests against a fake websocket, a pure vocabulary builder, interim transcript handling, an early-hint path, and 100ms audio framing.
</objective>

<execution_context>
@C:/Users/klarn/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/klarn/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/codebase/CONVENTIONS.md
@CLAUDE.md
@.planning/quick/260827-tlv-fix-audio-phrase-clipping-tune-live-api-/260827-tlv-PLAN.md

@electron/audio/GeminiLiveService.ts
@electron/audio/LiveInterviewService.ts
@electron/constants/geminiModels.ts
@public/pcm-capture-processor.js
@tests/unit/geminiLiveSetup.test.ts
@tests/unit/pcmCaptureProcessor.test.ts
@tests/integration/liveInterviewLifecycle.integration.test.ts
</context>

<research_findings>
The orchestrator's live probe against the user's real key is the authority for what exists on the API. Everything below was additionally verified against the working tree before this plan was written.

**1. Baseline is green.** `npx vitest run` passes 85 tests across 11 files. `npx tsc --noEmit` is clean on all three projects: `tsconfig.electron.json`, `tsconfig.json`, and `backend/tsconfig.json`. Any gate failure during execution is attributable to this plan's changes.

**2. The AUDIO response is genuinely dead weight today.** `GeminiLiveService.sendSetup` requests `responseModalities: ['AUDIO']` with `temperature: 0.7` and `maxOutputTokens: 50`, and the system instruction asks the model to reply "Heard." after each turn. `LiveInterviewService` line 203 registers a `response` listener whose entire body is a comment saying to do nothing. So the app pays for a generated acknowledgment it discards. Switching to `responseModalities: ['TEXT']` on a transcription-only model removes that whole limb.

**3. The nonexistent id has four occurrences in the desktop constants and three in the backend mirror.** `electron/constants/geminiModels.ts` lists it once in `GEMINI_SELECTABLE_MODELS` (the picker) and three times as a *target* in `LEGACY_GEMINI_MODEL_MAP` — so three retired ids currently remap forward onto a model that does not exist, which is worse than not remapping at all. `backend/src/processing/providers/gemini.models.ts` is a deliberate duplicate (documented as such in its header) carrying the same three remap targets, and `tests/unit/geminiModels.test.ts` asserts all of them at lines 19, 27, 28 and 50. All eight sites must move together.

**4. `GEMINI_MODELS.LIVE` has exactly two consumers.** `GeminiLiveService.ts:59` (`const DEFAULT_MODEL`) and `src/_pages/DebugLive.tsx:41`. DebugLive seeds a free-text model field with it and passes the result through `liveInterviewStart({ modelName })`. That means the DebugLive field is already a usable manual override channel for the rollback profile — no UI work is needed to make the flag reachable from the debug page.

**5. `liveInterviewStart` is called with NO arguments from the real UI.** `UnifiedPanel.tsx:226` calls `window.electronAPI.liveInterviewStart()` bare. So `config.modelName` is undefined on the production path and the profile must resolve from a default plus an environment override. `electron/main.ts:492/498` already calls `dotenv.config()` against `.env` in dev and `process.resourcesPath/.env` in prod, so a `process.env` read in the main process is a working, already-supported operator channel.

**6. The message handler is fully testable with no socket.** `handleMessage(data: string)` is private but reachable through the repo's existing `as unknown as` cast idiom, takes a plain string, and communicates only by `emit`. Interim/final/turnComplete merge behavior can therefore be pinned exactly without any network.

**7. The socket, by contrast, is NOT testable today.** `connect()` hard-codes `new WebSocket(url)`. Rotation cannot be tested without a factory seam. Adding `socketFactory?: (url: string) => WebSocket` to `GeminiLiveConfig` is the minimum viable injection point and matches the dependency-injection convention already used across the main process (`IProcessingHelperDeps`, `IIpcHandlerDeps`).

**8. Neither typecheck covers `tests/`.** Verified empirically in the 260827-tlv plan and still true: `tsconfig.json` includes only `electron/**/*` and `src/**/*`, `tsconfig.electron.json` only `electron/**/*`. Test files are transpiled by vitest without typechecking and linted by an eslint config that sets no `parserOptions.project`. Every `as unknown as` cast in a test is therefore unverified by the compiler — if it names a field that no longer exists the assertion silently compares `undefined`. Every such cast in this plan is paired with a guard assertion on the cast's own result.

**9. `public/pcm-capture-processor.js` is eslint-ignored** (`eslint.config.mjs` ignores list). `node --check` is its only syntax gate. Its `node:vm` harness in `tests/unit/pcmCaptureProcessor.test.ts` carries a local `FRAME_SIZE = 480` constant and derives `FRAME_BYTES` from it, so a frame-size change is a constant edit plus a recount of the quanta fed in each case.

**10. `status.transcript` is rendered raw in two places** — `UnifiedPanel.tsx:815` and `DebugLive.tsx:379`. Making `getStatus().transcript` return finalized-plus-interim therefore delivers live speculative partials to both surfaces with zero renderer changes.

**11. The active profile and company objects available at the IPC boundary are richer than the types the audio layer sees.** `ipcHandlers.ts:834-835` resolves the full `UserProfile` and `CompanyContext` out of `configHelper.loadConfig()`, which carry `requiredSkills`, `niceToHaveSkills`, `certifications`, `projects[].tech` and `education` — none of which exist on the narrower `HintUserProfile` / `HintCompanyContext` types that `LiveInterviewConfig` declares. Neither `UserProfile` nor `CompanyContext` is exported from `ConfigHelper.ts`. So the vocabulary builder must declare its own all-optional structural input types and be called at the IPC boundary where the full-fidelity objects are in scope, not inside `LiveInterviewService` where they have already been narrowed.

**12. Both throttles added by 260827-tlv become transparent at 100ms framing.** The renderer floor gate spaces `setLocalAudioLevel` at ≥50ms and the main-process status gate at ≥100ms; at 10 frames/sec every frame clears both. They are kept — they are correctness guards that re-engage the moment frame size shrinks — but their comments, which describe a 33Hz frame stream, become wrong and must be corrected rather than left to mislead.
</research_findings>

<decisions>
**D-01 — Capabilities live on a profile record, not on scattered conditionals.** The brief is explicit that a rollback flag which only swaps the model string produces a broken session on one branch. The two models differ on at least seven axes: response modality, whether a system instruction is accepted, whether generation tuning is accepted, whether `customVocabulary` is accepted, whether interim transcripts are emitted, whether hints may fire on partials, and what session cap applies. Encoding those as seven `if (model === ...)` tests scattered across two services guarantees that a future edit updates six of them. Instead `electron/constants/liveModelProfiles.ts` holds a `LiveModelProfile` record per model and ONE resolution point returns it. The flag then cannot half-apply.

**D-02 — `resolveLiveModelProfile` accepts a profile id, a known model id, or an unknown model id.** Profile id (`transcribe`, `native-audio`) is the operator-facing form; a known model id is what DebugLive already sends; an unknown id falls back to the default profile with the model substituted after a charset guard, and logs that its capabilities are assumed. Rejecting unknown ids outright would break the existing custom-model affordance; silently trusting them would reintroduce the exact bug the brief warns about, which is why the assumption is logged rather than hidden.

**D-03 — The rollback channel is an environment variable plus a one-line constant, not a settings toggle.** `GEMINI_LIVE_PROFILE=native-audio` in `.env` (already loaded by `electron/main.ts`) is the operator path; `DEFAULT_LIVE_MODEL_PROFILE_ID` in the profiles module is the code path; the DebugLive model field is the ad-hoc path. A Settings UI toggle would need a `Config` field, a validation rule, a preload/`electron.d.ts`/`ipcHandlers` triad and a form control — four files of surface area for a control whose purpose is to be used once, in an emergency, by the developer. Recorded in `<deferred>`.

**D-04 — The VAD tuning constants move from `GeminiLiveService` onto the profile, and the cross-module invariant gets STRONGER, not weaker.** 260827-tlv established `VAD_SILENCE_DURATION_MS = 1200` / `VAD_PREFIX_PADDING_MS = 400` and a test asserting the silence window stays under `HINT_TRIGGER_SILENCE_MS = 1500`. Those values and that reasoning are preserved verbatim in the profile's JSDoc; what changes is that the invariant is now asserted over EVERY profile rather than over one static, so adding a third model cannot smuggle in a silence window that quietly promotes the fallback hint trigger to primary. This is an extension of 260827-tlv, not a revert of it.

**D-05 — VAD tuning is sent to `gemini-3.5-transcribe-live`, behind a per-profile `includeVadTuning` switch.** The probe could not confirm that the transcribe model accepts `silenceDurationMs` / `prefixPaddingMs`; only `automaticActivityDetection.disabled` is documented on its page. But `AutomaticActivityDetection` is a field of the shared BidiGenerateContent setup proto, not a per-model message, and dropping the tuning would silently undo 260827-tlv's phrase-clipping fix on the new default path. So the tuning is sent, and the one-line escape hatch (`includeVadTuning: false`, which makes the builder omit `realtimeInputConfig` entirely) is built and unit-tested up front so that a 1007 on first contact is a config flip rather than a debugging session. Human verification item 1 is the check.

**D-06 — Rotation is implemented inside `GeminiLiveService` as a primary/successor socket pair, not as a wrapper that swaps whole services.** `currentTranscript`, the interim buffer, the debug counters and the event contract all live in `GeminiLiveService`. A wrapper that swapped service instances would have to migrate all of that across the seam, which is precisely where transcript loss would occur. Owning two sockets inside one service means the transcript is never handed over at all — it simply is not touched by the rotation.

**D-07 — "Seamless" is defined as four specific, individually testable properties, not as a vibe.** (a) `sendAudio` never observes a window with no OPEN socket, because promotion is synchronous and gated on the successor already being OPEN — so zero frames are dropped, asserted by counting `realtimeInput` sends across both sockets against frames offered. (b) Cutover is preferentially aligned to a `turnComplete`, which by definition is a 1.2s speech gap, so no phrase is split. (c) The accumulated transcript is not reset, re-emitted or reordered — the predecessor keeps delivering for a bounded drain window while the successor's output is QUEUED, then the queue is replayed in arrival order. (d) A hard deadline forces cutover even with no boundary, and that case emits `rotated` with `atBoundary: false` so the one situation where a seam is possible is recorded rather than hidden.

**D-08 — The successor receives NO audio before promotion.** The tempting alternative is to dual-send during the overlap so the successor holds the in-flight phrase. It was rejected: dual-sending means both sessions transcribe the same audio, so a boundary cutover — the common case — produces a duplicated tail in the shared transcript buffer, and it doubles audio-token spend for the whole overlap. Keeping the successor silent makes the common case exactly correct and confines the imperfection to the forced-cutover case, where the phrase is split across two sessions but both halves still land in the same buffer in order.

**D-09 — Rotation schedule: open the successor at 9:00, force cutover at 9:30, against a 10:00 cap.** The lead time is deliberately short. A longer lead (opening at 8:00) leaves a socket idle for two minutes, and the Live API closes idle connections — which would turn rotation into a reconnect storm. Thirty seconds of boundary-hunting is ample: `turnComplete` fires after 1.2s of silence, so a speaker who does not produce a single boundary in 30 seconds is monologuing continuously. Thirty further seconds of margin sit between the forced cutover and the cap, which comfortably covers the 1.5s drain. A successor whose socket closes before promotion is discarded and reopened — that is a real, tested case, not a theoretical one.

**D-10 — Interim transcripts use REPLACEMENT semantics, in a buffer the finalized transcript never sees.** Every mainstream streaming-ASR interim protocol emits the full current hypothesis per message, and the docs describe these as "speculative partials" finalized later by a separate field, which is the same shape. Replacement is therefore the right default. Crucially, the failure mode if that assumption is wrong is chosen to be benign: because interim text is held in its own buffer and never merged into `currentTranscript`, an incremental-shaped interim stream degrades the DISPLAYED tail to the latest fragment and nothing else — the finalized transcript, the hint prompt baseline and the rotation-safe buffer are all untouched. Human verification item 2 distinguishes the two cases, and the switch is a single function.

**D-11 — The early hint sets its `lastHintTranscript` baseline to the FINALIZED text, not to the combined text it was generated from.** Otherwise `getUnprocessedTranscriptDelta`'s prefix match fails the moment the phrase finalizes (finalized text does not start with a string containing speculative tokens), the delta collapses to the entire transcript, and the turnComplete hint regenerates against everything. Anchoring the baseline to finalized-only text yields the intended two-stage behavior instead: a fast provisional hint mid-phrase, then a normal refined hint on the real delta at turnComplete.

**D-12 — Exactly one early hint per turn, gated at 60 meaningful new characters and 600ms of quiet.** Without the once-per-turn latch an interim stream fires a hint on every partial. Without the character gate a two-word filler fragment triggers a full generation. 600ms is half the Live API's 1200ms end-of-speech window, so the early hint lands meaningfully before `turnComplete` would have fired while still requiring an actual pause. The latch resets on `turnComplete`.

**D-13 — Custom vocabulary is built at the IPC boundary from short, structured fields only.** Per finding 11 the full-fidelity objects only exist in `ipcHandlers`. The builder takes explicitly-typed all-optional structural inputs so it stays a pure, node-testable module independent of `ConfigHelper`'s unexported interfaces. Free-text fields — CV prose, `aiSummary`, `achievements`, `jobDescription`, `talkingPoints`, `responsibilities` — are excluded by construction, not merely truncated: they are sentences, they make poor vocabulary entries, and they are the fields carrying the most personal narrative. Terms over 40 characters or 4 words are dropped for the same two reasons at once.

**D-14 — Cap at 100 terms in the builder, 1000 in the setup builder.** The docs allow 1000 and recommend ~100. The vocabulary module caps at the recommendation because that is the quality-optimal number; the setup builder independently slices at the API maximum as a pure safety net so that a future caller passing a raw list cannot produce a rejected setup frame.

**D-15 — `languageCodes` is sent as the documented empty array (auto-detect).** The probe verified the exact documented shape `languageCodes: []`. The app's `spokenLanguage` values are bare ISO-639-1 codes (`en`, `ru`, `lv`, `de`) and the field's expected format (bare vs BCP-47 `en-US`) could not be probed. Sending an unverified-format value into a strict setup proto risks a 1007 on every session for a marginal gain over auto-detection. Recorded in `<deferred>`.

**D-16 — 1600-sample frames, and both 260827-tlv throttles are kept despite becoming transparent.** 1600 samples is exactly the documented 100ms at 16kHz and divides evenly at both source rates in aggregate. At the resulting 10 frames/sec the 50ms renderer floor gate and the 100ms main-process status gate both pass every frame. Deleting them would be undoing 260827-tlv for a saving of nothing; they are guards that re-engage the instant frame size is reduced. Their comments, which currently describe a 33Hz stream and "~17 of 33", are corrected — a stale comment that misdescribes live behavior is worse than no comment.
</decisions>

<source_coverage_audit>
| # | Source item | Covered by | Status |
|---|---|---|---|
| S-1 | Base migration: model -> `gemini-3.5-transcribe-live` | Task 1 (profile + `GEMINI_MODELS.LIVE`) | COVERED |
| S-1a | `responseModalities: ['TEXT']` | Task 1 (profile field, asserted in the builder test) | COVERED |
| S-1b | 100ms audio chunks | Task 3 (`FRAME_SIZE` 480 -> 1600) | COVERED |
| S-2 | Session rotation before the 10-minute cap | Task 2 | COVERED |
| S-2a | Seamless — no phrase dropped at the seam | Task 2 (D-07: frame accounting, boundary-aligned cutover, drain queue) | COVERED |
| S-2b | Testable without a live socket | Task 2 (`socketFactory` seam + fake websocket) | COVERED |
| S-3 | `customVocabulary` seeded from parsed JD/profile | Task 3 (`buildCustomVocabulary` + ipcHandlers wiring) | COVERED |
| S-3a | ~100 terms, capped | Task 3 (D-14) | COVERED |
| S-4 | `interimInputTranscription` consumed | Task 1 (handler + separate buffer) | COVERED |
| S-4a | Hints can start on partials | Task 3 (early-hint path, D-11/D-12) | COVERED |
| S-5 | Rollback flag to the native-audio model | Task 1 (profile + env var + resolver) | COVERED |
| S-5a | Both branches genuinely interchangeable (modality AND transcript fields) | Task 1 (profile carries all seven axes; parity assertion vs the pre-migration message) | COVERED |
| S-6 | Fix the broken `gemini-3.1-pro` id in the picker | Task 1 (picker + legacy map + backend mirror + test) | COVERED |
| C-1 | Do not undo 260827-tlv: VAD constants | Task 1 (moved to profile, values and JSDoc preserved, invariant strengthened — D-04) | COVERED |
| C-2 | Do not undo 260827-tlv: endTurn stays a no-op with zero callers | Task 2 (grep gate) | COVERED |
| C-3 | Do not undo 260827-tlv: anti-aliasing filter + per-frame RMS + vm harness | Task 3 (filter gate + harness recount) | COVERED |
| C-4 | No `npm run dev/start/build/clean` in any gate | All tasks (`npx tsc --noEmit`, `npx vitest run`, `npx eslint`, `node --check` only) | COVERED |
| C-5 | No vacuous gates requiring a live socket | `<human_verification>` (8 items) | COVERED |

No source item is MISSING. No item is deferred without an explicit decision record in `<decisions>` or `<deferred>`.
</source_coverage_audit>

<tasks>

<!-- planner-discipline-allow: gemini-3.1-pro, responseModalities, endTurn, scheduleEndTurnIfSilent, END_TURN_SILENCE_MS, END_TURN_MIN_INTERVAL_MS, lastEndTurnAt, lastNonSilentAudioAt, endTurnDebounceTimeout, currentTime, currentFrame -->
<!-- These identifiers name either a value being REMOVED from source or a field being MOVED out of a
     specific file, so the action bodies cannot avoid naming them. Every negative grep gate below is
     scoped to electron/, src/, backend/src/, tests/ or public/ - never .planning/ - so this plan file
     cannot satisfy or invalidate its own gates. Each affected action carries an explicit instruction
     not to leave a tombstone comment naming a removed or relocated identifier in the gated file. -->

<task type="tracer" tdd="true">
  <name>Task 1: Live model capability profiles, pure setup-message builder, interim transcript handling, and the nonexistent model id</name>
  <files>electron/constants/geminiModels.ts, electron/constants/liveModelProfiles.ts, electron/audio/liveSetupMessage.ts, electron/audio/GeminiLiveService.ts, backend/src/processing/providers/gemini.models.ts, tests/unit/geminiModels.test.ts, tests/unit/liveSetupMessage.test.ts, tests/unit/geminiLiveSetup.test.ts, tests/unit/geminiLiveTranscripts.test.ts</files>
  <read_first>electron/constants/geminiModels.ts (whole file, 118 lines); electron/audio/GeminiLiveService.ts lines 11-105 and 209-250 and 280-380; backend/src/processing/providers/gemini.models.ts (whole file, 56 lines); tests/unit/geminiModels.test.ts (whole file); tests/unit/geminiLiveSetup.test.ts (whole file, 123 lines)</read_first>
  <behavior>
    - Resolving with no input returns the transcribe profile, whose model is `gemini-3.5-transcribe-live`.
    - Resolving the string `native-audio`, or the literal native-audio model id, returns the rollback profile whose model is `gemini-2.5-flash-native-audio-preview-12-2025`.
    - Resolving an unrecognized but charset-safe id returns the default profile with that model substituted; resolving an id containing a path or query character returns the default profile with its own model, unsubstituted.
    - The setup message built for the transcribe profile has `setup.model` equal to `models/gemini-3.5-transcribe-live`, `generationConfig.responseModalities` equal to a one-element TEXT array, NO `systemInstruction` key, NO temperature or maxOutputTokens key, and `inputAudioTranscription.languageCodes` equal to an empty array.
    - The setup message built for the native-audio profile deep-equals a literal snapshot of the pre-migration message transcribed into the test — AUDIO modality, temperature 0.7, maxOutputTokens 50, a systemInstruction parts array, the tuned automaticActivityDetection block, activityHandling NO_INTERRUPTION, and an empty `inputAudioTranscription` object with no vocabulary key.
    - Passing a non-empty vocabulary array adds `inputAudioTranscription.customVocabulary` on the transcribe profile and does NOT add it on the native-audio profile; passing an empty array adds no such key on either.
    - Passing more than 1000 vocabulary terms truncates to exactly 1000 in the built message.
    - Setting `includeVadTuning` false on a profile omits the whole `realtimeInputConfig` key from the built message and changes nothing else.
    - Every profile's VAD silence window is strictly less than `LiveInterviewService.HINT_TRIGGER_SILENCE_MS`.
    - Feeding the message handler a serverContent carrying `interimInputTranscription` emits a transcript update whose `text` is the unchanged finalized buffer, whose `interimText` is the interim payload, and whose `isInterim` is true.
    - Feeding two interim messages in a row REPLACES rather than appends: the second update's `interimText` equals only the second payload.
    - Feeding a final `inputTranscription` after an interim clears `interimText` to empty and appends the final payload to `text`.
    - Feeding turnComplete after an interim emits a final update whose `interimText` is empty and whose `text` is the finalized buffer with no speculative content in it.
    - `clearTranscript()` empties both buffers.
    - Neither the picker list, the legacy remap table, the backend mirror, nor the model-id test names a Gemini 3.1 Pro id without the preview suffix.
  </behavior>
  <action>
**Commit in three steps so the riskiest change cannot strand the safest.** (1) The model-id correction across the four files — a pure string fix that is independently valuable and cannot regress the live path. (2) The profiles module and the setup builder with their tests, still unwired. (3) Wiring `GeminiLiveService` to the builder plus the interim transcript handling. Run the task's gates after each step.

Governing decisions for this task: **D-01** (capabilities live on a profile record, never on scattered conditionals), **D-02** (resolver accepts profile id, known model id, or charset-guarded unknown id), **D-03** (rollback travels an env var plus a module constant, not a Settings toggle), **D-04** (the VAD constants move onto the profile and the invariant is asserted over every profile), **D-05** (VAD tuning IS sent to the transcribe model, behind a per-profile escape hatch), **D-10** (interim transcripts use replacement semantics in a buffer the finalized transcript never sees) and **D-15** (`languageCodes` stays the documented empty array). Read those before writing code — several of them exist specifically to forbid a simpler-looking implementation.

**Step 1 — the nonexistent model id.** In `electron/constants/geminiModels.ts`, replace the bare Gemini 3.1 Pro id with `gemini-3.1-pro-preview` in all four places it occurs: the `GEMINI_SELECTABLE_MODELS` entry (leave its display name as "Gemini 3.1 Pro" — the human-readable name is correct, only the id was wrong) and the three `LEGACY_GEMINI_MODEL_MAP` targets. Apply the same three-target correction to `backend/src/processing/providers/gemini.models.ts`, which its own header declares a deliberate duplicate that must move in lockstep. Update the five assertions in `tests/unit/geminiModels.test.ts` (lines 19, 27, 28 and both halves of line 50) to the corrected id. Do not add a comment anywhere naming the old id — a negative sweep below greps these trees for it and a tombstone would trip the gate.

Still in `electron/constants/geminiModels.ts`, change `GEMINI_MODELS.LIVE` to `gemini-3.5-transcribe-live` and add a sibling `LIVE_NATIVE_AUDIO` key holding the current value `gemini-2.5-flash-native-audio-preview-12-2025`. Rewrite the block comment above `LIVE` so it says what is now true: the Live socket accepts a narrower, separately-versioned family than generateContent; `LIVE` is the transcription-only default and `LIVE_NATIVE_AUDIO` is the conversational rollback target; the authoritative capability differences between them live in `liveModelProfiles.ts` and a bare id swap between the two is NOT sufficient to switch models.

**Step 2 — the profiles module.** Create `electron/constants/liveModelProfiles.ts`. Like `geminiModels.ts` it is imported by both processes, so it must stay pure data and pure functions with no imports except from `geminiModels.ts`. Export a `LiveModelProfileId` union of `'transcribe' | 'native-audio'` and a `LiveModelProfile` interface with these fields, every one of which exists because the two models genuinely differ on it: `id`; `model`; `responseModalities` as a readonly string array; `includeSystemInstruction`; `temperature` and `maxOutputTokens` as optional numbers, present only where the model accepts generation tuning; `includeVadTuning`; `startOfSpeechSensitivity` and `endOfSpeechSensitivity` as strings; `vadPrefixPaddingMs` and `vadSilenceDurationMs` as numbers; `supportsCustomVocabulary`; `supportsInterimTranscription`; `hintOnInterim`; and the rotation schedule as `rotateAfterMs`, `hardRotateAtMs` and `sessionMaxMs`.

Export `LIVE_MODEL_PROFILES` as a record keyed by id. The transcribe profile: the LIVE model id, a TEXT modality array, no system instruction, no generation tuning, VAD tuning on, both sensitivities at their existing LOW values, 400ms prefix padding and 1200ms silence, custom vocabulary supported, interim supported, hints on interim enabled, and the rotation schedule 540000 / 570000 / 600000. The native-audio profile: the LIVE_NATIVE_AUDIO id, an AUDIO modality array, system instruction on, temperature 0.7 and maxOutputTokens 50, VAD tuning on with the identical sensitivities and windows, custom vocabulary NOT supported, interim NOT supported, hints on interim disabled, and the same rotation schedule.

Carry the reasoning for the VAD numbers forward verbatim from where 260827-tlv put it — as JSDoc on the two fields in the interface, stating that the silence window was widened from 500ms so a normal 0.7-1.5s thinking pause no longer splits a sentence, that it MUST stay strictly below `LiveInterviewService.HINT_TRIGGER_SILENCE_MS` or the fallback hint trigger silently becomes the primary one, that the invariant is asserted in `tests/unit/geminiLiveSetup.test.ts`, and that the 400ms look-back exists to absorb the deliberately-late LOW start detector's own lag on top of the first syllable. Add a JSDoc line on the rotation fields recording that the 10-minute cap is documented only for the transcribe model, that the native-audio family's cap is undocumented, and that both profiles carry the same conservative schedule deliberately so that one code path serves both branches and rotation is exercised on the rollback branch too.

Export `DEFAULT_LIVE_MODEL_PROFILE_ID` set to the transcribe id, and `LIVE_MODEL_PROFILE_ENV_VAR` set to the string `GEMINI_LIVE_PROFILE`, with JSDoc on the latter stating that it is the operator rollback channel, that `electron/main.ts` already loads `.env` into `process.env` in both dev and prod, and that flipping `DEFAULT_LIVE_MODEL_PROFILE_ID` is the code-level equivalent.

Export `resolveLiveModelProfile(input?: string | null): LiveModelProfile`. Trim the input; empty or non-string yields the default profile. An exact match against a profile id yields that profile. An exact match against any profile's `model` yields that profile. Anything else is tested against the same URL-path charset guard already used by `resolveGeminiModelId` — reuse that regular expression's shape rather than inventing a second one — and on success returns a shallow copy of the default profile with `model` replaced, on failure returns the default profile unchanged. The unknown-id branch must be reachable without importing electron-log (this module is loaded in the renderer too), so it returns a plain value and does not log; record in its JSDoc that an unknown id inherits the DEFAULT profile's capability flags, that this assumption is what makes a custom id usable at all, and that a custom id whose real capabilities differ will produce a broken session — which is precisely why the two supported models are named profiles rather than bare strings.

**Step 3a — the setup builder.** Create `electron/audio/liveSetupMessage.ts`, importing only the profile type. Export `CUSTOM_VOCABULARY_API_MAX_TERMS` set to 1000 with JSDoc citing it as the documented API ceiling and noting that ~100 is the documented quality optimum enforced separately by the vocabulary builder. Export `buildLiveSetupMessage(options)` taking `profile`, optional `systemInstruction`, optional readonly `customVocabulary`, and optional readonly `languageCodes`, and returning the setup object. Build it in this order so the shape is stable and diffable: `setup.model` as the string `models/` concatenated with `profile.model`; `setup.generationConfig` with the modality array copied out of the profile, plus temperature and maxOutputTokens each added only when the profile defines them; `setup.systemInstruction` as a parts array added only when the profile enables it AND a non-empty instruction was supplied; `setup.realtimeInputConfig` with the automaticActivityDetection block and `activityHandling: 'NO_INTERRUPTION'`, added only when the profile enables VAD tuning; and `setup.inputAudioTranscription`, which is an empty object when the profile does not support custom vocabulary, and otherwise an object carrying a `languageCodes` array (the supplied one or an empty array) plus a `customVocabulary` key added only when the supplied array has at least one entry after slicing to the API ceiling. Return a plain object literal; do not JSON-stringify here — the caller owns serialization.

**Step 3b — wire the service and add interim handling.** In `electron/audio/GeminiLiveService.ts`, delete the module-level default-model constant and the two static VAD constants, whose values now live on the profile; leave no comment in this file naming either constant. Add `profile?: string` documentation to `GeminiLiveConfig` — keep the existing `model` field as the raw input rather than adding a parallel one — and add `customVocabulary?: readonly string[]`. In the constructor, resolve and store `private readonly profile: LiveModelProfile` from `resolveLiveModelProfile(config.model ?? process.env[LIVE_MODEL_PROFILE_ENV_VAR])`, and set `this.config.model` to the resolved profile's model so the existing connection log lines keep printing the id actually used. Add one info-level log at construction naming the resolved profile id and model, because with a silent env-var override the log is the only way an operator confirms which branch is live.

Replace the whole inline setup literal in `sendSetup` with a call to the builder passing the stored profile, `this.config.systemInstruction`, `this.config.customVocabulary` and no language codes, then stringify and send exactly as before. The token naming the response modality field must not remain anywhere in this file, in code OR in a comment — a scoped sweep below asserts that the modality decision now lives only on the profile.

Extend `GeminiLiveMessage.serverContent` with an optional `interimInputTranscription` carrying a `text` string. Extend `TranscriptUpdate` with `interimText: string` and `isInterim: boolean` — additive only; `text`, `isFinal` and `timestamp` keep their exact current meanings so no existing consumer breaks. Add `private interimTranscript: string = ''`.

In `handleMessage`, add an interim branch BEFORE the existing final-transcription branch. On interim: if the profile does not support interim transcription, ignore the field entirely and return from the branch, so the rollback path cannot change behavior on a stray field. Otherwise assign — do not append — the payload to the interim buffer, and emit a transcript update carrying the unchanged finalized buffer as `text`, the interim buffer as `interimText`, `isInterim` true and `isFinal` false. In the existing final branch, clear the interim buffer to empty before appending the new final text, and add `interimText` as empty and `isInterim` false to the emitted update; leave the existing max-length trimming exactly where it is. In the turnComplete branch, clear the interim buffer before emitting the final update and add the same two fields to it. Add the interim buffer to `clearTranscript()` and to the reset performed by `disconnect()`. Extend the message-type debug label so an interim message is distinguishable in the log from a final one — that label is the fastest signal during human verification that the new stream is arriving at all.

**Tests.** Create `tests/unit/liveSetupMessage.test.ts` covering the eight builder and resolver behaviors above. The native-audio parity case is the most important one in this plan: write the pre-migration setup object out as an explicit literal in the test file — model string, AUDIO modality array, temperature, maxOutputTokens, systemInstruction parts, the five automaticActivityDetection fields, activityHandling, and an empty inputAudioTranscription object — and assert deep equality against the builder's output for that profile. That literal is the contract that the rollback branch still produces a working session; do not derive it from the profile or from the builder, because a snapshot derived from the thing under test proves nothing.

Rewrite `tests/unit/geminiLiveSetup.test.ts` so it no longer reaches into the private socket field or invokes the private setup sender — that machinery is refactored in Task 2 and a test coupled to it would break. Keep only the cross-module invariant, restated over the profile record: iterate every entry of `LIVE_MODEL_PROFILES` and assert each one's VAD silence window is strictly less than `HINT_TRIGGER_SILENCE_MS`, read off `LiveInterviewService` through the existing `as unknown as` cast. Keep the guard assertions on the cast's own result (that it is a number and greater than zero) so a renamed constant fails loudly rather than comparing against `undefined`. Add a case asserting each profile's prefix padding and silence window equal 400 and 1200, so the 260827-tlv tuning cannot be lost in a future profile edit.

Create `tests/unit/geminiLiveTranscripts.test.ts`. Mock electron-log with the same default-export shape the other tests use. Construct a service per case, reach the private message handler through an `as unknown as` cast whose result is guarded by asserting it is a function before use, collect `transcript` events off the emitter, and drive the five interim/final/turnComplete/clear behaviors listed above. Add a sixth case constructing a service on the native-audio profile and feeding it an interim message, asserting zero transcript events — that is the assertion proving the rollback branch is untouched by the new field. Call `disconnect()` in cleanup so no debug-stats interval is left open.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.electron.json</automated>
    <automated>npx tsc --noEmit -p tsconfig.json</automated>
    <automated>npx tsc --noEmit -p backend/tsconfig.json</automated>
    <automated>npx vitest run tests/unit/geminiModels.test.ts tests/unit/liveSetupMessage.test.ts tests/unit/geminiLiveSetup.test.ts tests/unit/geminiLiveTranscripts.test.ts</automated>
    <automated>test -z "$(grep -rn 'gemini-3\.1-pro\([^-]\|$\)' electron/ src/ backend/src/ tests/ --include='*.ts' --include='*.tsx')" &amp;&amp; echo NO_NONEXISTENT_PRO_ID</automated>
    <automated>test -z "$(grep -n 'responseModalities' electron/audio/GeminiLiveService.ts)" &amp;&amp; echo MODALITY_LIVES_ON_PROFILE</automated>
    <automated>test "$(grep -v '^\s*[/*]' electron/constants/liveModelProfiles.ts | grep -c 'vadSilenceDurationMs')" -ge 3 &amp;&amp; echo VAD_TUNING_PRESERVED</automated>
    <automated>npx eslint electron/constants/geminiModels.ts electron/constants/liveModelProfiles.ts electron/audio/liveSetupMessage.ts electron/audio/GeminiLiveService.ts backend/src/processing/providers/gemini.models.ts tests/unit/geminiModels.test.ts tests/unit/liveSetupMessage.test.ts tests/unit/geminiLiveSetup.test.ts tests/unit/geminiLiveTranscripts.test.ts</automated>
  </verify>
  <done>The live socket defaults to the transcription model with a TEXT response and no discarded audio limb; the native-audio rollback profile reproduces the pre-migration setup message under a deep-equality assertion against an independently written literal; the rollback is selectable by env var, by profile id and by model id through one resolution point that carries all seven capability axes together; interim transcripts are consumed as a replacement tail in a buffer the finalized transcript never sees, and are inert on the rollback profile; the 260827-tlv VAD tuning reaches the wire from the profile with its invariant now asserted over every profile; no Gemini 3.1 Pro id without the preview suffix survives in the desktop constants, the backend mirror or the tests; all eight gates pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Seamless session rotation before the 10-minute cap, proven against a fake websocket</name>
  <files>electron/audio/GeminiLiveService.ts, tests/unit/geminiLiveRotation.test.ts</files>
  <read_first>electron/audio/GeminiLiveService.ts (whole file as it stands after Task 1, paying particular attention to connect(), the four socket event handlers, sendAudio, disconnect and isActive); tests/integration/liveInterviewLifecycle.integration.test.ts lines 17-55 (the prototype-spy mocking idiom this task's test must not collide with)</read_first>
  <behavior>
    - Nothing rotates before the schedule: advancing to one millisecond before the open-successor deadline creates exactly one socket.
    - At the open-successor deadline a second socket is created and, once it opens, receives a setup message. The first socket remains the primary and is not closed.
    - While the successor exists but is not promoted, `sendAudio` sends every frame to the first socket and ZERO frames to the second.
    - A turnComplete from the primary after the successor is ready promotes the successor: subsequent `sendAudio` calls go to the second socket only, the first socket is NOT yet closed, and a `rotated` event fires with `atBoundary` true.
    - Frame accounting across the whole timeline: with N buffers handed to `sendAudio` spanning before, during and after the rotation, the total count of sent messages carrying a realtime-input payload across BOTH sockets equals N exactly — no frame is duplicated and none is lost.
    - During the drain window a late final transcription arriving on the retired predecessor is still appended to the accumulated transcript and emitted.
    - During the drain window a final transcription arriving on the NEW primary emits nothing yet.
    - When the drain window elapses, the predecessor is closed and had its listeners removed, and the queued successor transcript is emitted then — after the predecessor's tail, so the accumulated text reads predecessor-then-successor with no reset and no duplication.
    - With no turnComplete at all, the hard deadline forces promotion anyway and the `rotated` event carries `atBoundary` false.
    - If the successor's socket never opens, the hard deadline does NOT promote: the primary is still the send target afterwards, no frames are lost, and a replacement successor is opened on the retry interval.
    - If the successor's socket closes before promotion, it is discarded and a replacement is opened.
    - The predecessor closing as part of rotation does not trigger the reconnect path — no third socket appears from a retirement.
    - `disconnect()` closes both sockets and leaves zero pending timers.
  </behavior>
  <action>
This task's whole point is that rotation is the piece most likely to be faked. Everything below is written so that each guarantee is an assertion against a fake socket rather than a comment.

Governing decisions: **D-06** (rotation lives inside `GeminiLiveService` as a socket pair, not as a service-swapping wrapper, so the transcript is never handed across the seam at all), **D-07** (the four-part definition of seamless that the tests assert), **D-08** (the successor receives NO audio before promotion — dual-send was considered and rejected) and **D-09** (the 9:00 / 9:30 / 10:00 schedule and why the lead time is deliberately short). Do not shorten the drain, do not dual-send, and do not lengthen the lead without reading why.

**Add the injection seam.** Add `socketFactory?: (url: string) => WebSocket` to `GeminiLiveConfig`, documented as existing solely so rotation is testable without a network, and defaulting in the constructor to a function returning a real `WebSocket` for the url. Every socket construction in this file must go through it.

**Replace the single socket field with a pair of handles.** Define a module-local `LiveSession` interface holding the socket, a monotonically increasing `index`, an `openedAt` timestamp, a `setupSent` boolean, and a `role` of `'primary' | 'successor' | 'retiring'`. Replace the `ws` field with `primary` and `successor`, both nullable and both of that type. Update `sendAudio`, `sendText`, `sendSetup`, `isActive` and the debug-stats socket-state log to read the primary handle's socket; `sendAudio` must keep its existing behavior of warning and returning when there is no open socket, and must keep incrementing the audio counter only on a successful send. Do not leave a comment in this file naming the removed field.

**Extract socket opening.** Factor the body of `connect()` into a private `openSession(role)` returning a promise of a `LiveSession`. It creates the socket through the factory, wires the four handlers with the session captured in their closures, sends the setup on open and marks `setupSent`, and resolves on open. `connect()` becomes: open a session in the primary role, assign it, set connected, emit `connected`, and arm the rotation schedule. The existing reconnect-on-close logic, the auth-error 1007/1008 branch and the close-before-established rejection all stay, but every one of them must first check the session's role and do nothing for a `retiring` session — a socket we deliberately closed must never trigger a reconnect, and a test below asserts no third socket appears from a retirement. A `successor` session that errors or closes before promotion must likewise not touch the global reconnect counter; it is discarded and rescheduled by the rotation logic instead.

**Arm the schedule.** On primary open, set a timer at the profile's `rotateAfterMs` that calls a private `openSuccessorSession`, and a second timer at the profile's `hardRotateAtMs` that calls `promoteSuccessor(false)`. `openSuccessorSession` returns immediately if a successor already exists; otherwise it opens a session in the successor role, and on failure schedules a retry at a `SUCCESSOR_RETRY_MS` constant of 5000. Add a hoisted `DRAIN_MS` constant of 1500 with JSDoc explaining it is the window in which a retired session's in-flight final transcription still lands.

**Promotion — the core.** Write one private `promoteSuccessor(atBoundary: boolean)`. It returns immediately, doing nothing, unless a successor exists whose socket readyState is OPEN and whose `setupSent` is true; log a warning on that early return, because the primary is still valid until the session cap and a failed promotion is a recoverable condition, not an error. Otherwise, in this exact order: mark the current primary's role `retiring` and keep the handle in a `draining` field; move the successor handle into `primary` and set its role, clearing the successor field; clear the interim transcript buffer, because a speculative tail describes audio whose continuation is going to a different session; reset the rotation timers against the new primary's open time; set a `drainQueue` array and a `draining` flag; start a drain timer at `DRAIN_MS`; increment a session counter; and emit `rotated` carrying the new session index and the supplied `atBoundary`. **Do not touch the accumulated finalized transcript.** Add an explicit line of JSDoc on this method stating that the finalized buffer is deliberately not migrated, reset or re-emitted, because not touching it is exactly what makes the transcript survive the seam.

Because promotion is synchronous and gated on the successor already being OPEN, there is no instant at which `sendAudio` has no open socket. State that as a sentence of JSDoc on `promoteSuccessor` too — it is the definition of seamless that the frame-accounting test asserts.

**Message routing across the seam.** `handleMessage` gains the session as its first argument. A message on a `successor` session is ignored except for an error payload, which is logged and causes the successor to be discarded and rescheduled — never surfaced as a session error, since the primary is healthy. A message on a `retiring` session is processed normally, so its in-flight tail still lands. A message on the `primary` session is processed normally UNLESS the draining flag is set, in which case the raw string is pushed onto the drain queue instead. When the drain timer fires: clear the draining flag, remove the retiring session's listeners and close its socket, null the draining field, then replay every queued string through `handleMessage` against the current primary in arrival order, and clear the queue. Ordering matters and is asserted: the predecessor's tail describes audio that strictly precedes the successor's, so replaying after the drain is what keeps the transcript monotonic.

**Boundary-triggered promotion.** In the existing turnComplete handling, after the current emissions, promote when a successor is ready — that is, call `promoteSuccessor(true)`. Guard it so it only runs for a message on the primary session and only when a successor exists; do not add a second timer for it.

**Cleanup.** `disconnect()` must clear the rotation, hard-rotation, retry and drain timers, close and de-listen the primary, the successor and any retiring session, empty the drain queue, and reset the draining flag along with the existing transcript resets. A test asserts zero pending timers afterwards, so nothing may be left armed.

**Test.** Create `tests/unit/geminiLiveRotation.test.ts`. Mock electron-log with the established default-export shape. Build a `FakeSocket` class holding `readyState` initialized to 1, a handler map populated by `on`, a `fire(event, ...args)` helper invoking them, `send` as a vi mock, `close` as a vi mock that sets readyState to 3, and `removeAllListeners` as a vi mock that empties the map. Build a factory that pushes each constructed fake into a `sockets` array and hands it to the service through an `as unknown as WebSocket` cast; guard that cast by asserting `sockets.length` grew before every use, so a broken seam fails loudly instead of yielding `undefined`.

Use fake timers. The connection helper is: call `connect()` without awaiting, assert one socket now exists, fire `open` on it, then await the returned promise — handlers are attached synchronously inside the promise executor, so the socket and its handlers exist the moment `connect()` returns. Add two small helpers: one that fires a serverContent message on a chosen socket by stringifying an object, and one that counts, for a given fake, how many `send` calls carry a realtime-input payload (parse each argument and test for the key) so audio sends are counted separately from setup and text sends.

Write all thirteen behaviors above as cases. Three of them carry the load and must not be weakened into smoke tests. The frame-accounting case must hand a specific number of buffers to `sendAudio` at points spread across the timeline — before the successor opens, while it is open but unpromoted, immediately after promotion, and after the drain — and assert the summed realtime-input send counts across every fake equal that number exactly, with a separate assertion that the successor's count was zero at the pre-promotion checkpoint. The ordering case must assert the final accumulated transcript string equals predecessor-text-then-successor-text concatenated, taken from the last emitted transcript update, and must assert the intermediate state where the successor's message had been fed but nothing was emitted for it yet. The failed-promotion case must leave the successor's readyState at 0 and assert that after the hard deadline `sendAudio` still reaches the first socket — a rotation that promotes a socket that is not open would drop every subsequent frame, and this is the case that catches it.

Finally, do not disturb `tests/integration/liveInterviewLifecycle.integration.test.ts`: it mocks `connect` and `disconnect` on the prototype, so it never reaches the socket factory. Run it as a gate to prove the refactor is invisible from above.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.electron.json</automated>
    <automated>npx vitest run tests/unit/geminiLiveRotation.test.ts tests/unit/geminiLiveSetup.test.ts tests/unit/geminiLiveTranscripts.test.ts tests/unit/liveSetupMessage.test.ts tests/integration/liveInterviewLifecycle.integration.test.ts</automated>
    <automated>test -z "$(grep -rn 'endTurn' electron/ src/ --include='*.ts' --include='*.tsx' | grep -v 'electron/audio/GeminiLiveService.ts')" &amp;&amp; echo NO_ENDTURN_CALLERS</automated>
    <automated>test "$(grep -v '^\s*[/*]' electron/audio/GeminiLiveService.ts | grep -c 'socketFactory')" -ge 2 &amp;&amp; echo FACTORY_SEAM_PRESENT</automated>
    <automated>npx eslint electron/audio/GeminiLiveService.ts tests/unit/geminiLiveRotation.test.ts</automated>
  </verify>
  <done>A live session opens a successor socket at 9:00, promotes it at the first turn boundary after that or unconditionally at 9:30, and never reaches the documented 10:00 cap; promotion is synchronous and gated on the successor already being OPEN, so frame accounting across a full rotation timeline balances exactly with zero frames sent to an unpromoted successor; the predecessor keeps delivering for a bounded 1.5s drain while the new primary's output is queued and replayed in arrival order, so the accumulated transcript survives without reset, duplication or reordering; a successor that fails to open or closes early is discarded, retried, and never promoted; a retired socket never triggers reconnect; disconnect leaves no timer armed; 260827-tlv's zero-caller no-op turn-ender is still uncalled; all five gates pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: 100ms audio framing, custom vocabulary from the parsed CV and job description, and hints that start on partials</name>
  <files>public/pcm-capture-processor.js, tests/unit/pcmCaptureProcessor.test.ts, electron/audio/customVocabulary.ts, tests/unit/customVocabulary.test.ts, electron/audio/LiveInterviewService.ts, electron/ipcHandlers.ts, src/components/UnifiedPanel/audioLevelThrottle.ts, tests/integration/liveInterviewLifecycle.integration.test.ts</files>
  <read_first>public/pcm-capture-processor.js lines 1-60 and 180-213; tests/unit/pcmCaptureProcessor.test.ts (whole file, 256 lines); electron/audio/LiveInterviewService.ts lines 20-80 and 141-200 and 289-340; electron/ipcHandlers.ts lines 820-850; src/components/UnifiedPanel/audioLevelThrottle.ts (whole file); electron/ConfigHelper.ts lines 17-58 (the full UserProfile and CompanyContext field lists the vocabulary builder draws from)</read_first>
  <behavior>
    - At 48000Hz input, feeding 120 render quanta of 128 samples produces exactly 3 posted messages, each carrying a 3200-byte ArrayBuffer.
    - At 16000Hz input, feeding 40 render quanta produces exactly 3 posted messages of 3200 bytes.
    - At 16000Hz the emitted samples remain bit-exact against the standard quantization of the input, with no tolerance — the microphone path is still untouched by filter or resampler.
    - At 48000Hz a 12000Hz sine still comes out below 35% of the RMS of an equal-amplitude 1000Hz sine, and the 1000Hz sine still retains more than 0.30 RMS — the anti-aliasing filter is intact at the new frame size.
    - Each posted level still equals the RMS of that exact frame's samples and still differs between loud and quiet frames.
    - The vocabulary builder returns an empty array for null, undefined, and empty inputs.
    - It draws company name, job title, tech stack, required skills, profile skills, nice-to-have skills, employer names from work history, certifications and project technologies — and draws nothing from CV prose, AI summary, achievements, job description body, responsibilities or talking points.
    - It deduplicates case-insensitively, keeping the first-seen casing, and preserves priority order.
    - It drops entries longer than 40 characters and entries of more than 4 whitespace-separated words.
    - It caps the result at 100 entries even when far more are available, and the entries kept are the highest-priority ones.
    - Feeding interim transcript updates and advancing 600ms triggers exactly one hint generation whose prompt text contains the interim tail; advancing further in the same turn triggers no second early hint.
    - An interim tail below the meaningful-character threshold triggers no early hint.
    - On a profile with hints-on-interim disabled, interim updates trigger no early hint at all.
    - After an early hint, a turnComplete still triggers a hint for the newly finalized delta rather than regenerating the whole transcript.
    - `getStatus().transcript` equals the finalized text concatenated with the current interim tail, and the tail disappears once the text finalizes.
  </behavior>
  <action>
**Commit in three steps: framing, then vocabulary, then the early-hint path.** Each is independently valuable and independently gated.

Governing decisions: **D-16** (1600-sample frames, and both 260827-tlv throttles are KEPT despite becoming transparent — deleting them would be undoing that task for no gain), **D-13** (vocabulary is built at the IPC boundary from short structured fields only, with free narrative excluded by construction as a privacy decision), **D-14** (100 terms in the builder, 1000 in the setup builder), **D-11** (the early hint baselines on finalized text) and **D-12** (one early hint per turn, gated at 60 characters and 600ms).

**Step 1 — 100ms frames.** In `public/pcm-capture-processor.js` change the frame-size constant from 480 to 1600 and update its inline comment to state 1600 samples = 100ms at the 16000Hz target, which is the chunk size the transcribe-live documentation asks for. Change nothing else: the anti-aliasing constants, the two Butterworth sections, the low-pass helper, the scratch buffer and its length discipline, the per-frame sum-of-squares RMS, the fresh-copy-then-transfer post, and the partial-frame carry across calls all stay exactly as they are. Update the file's header comment where it names the old frame duration and the old traffic-reduction multiple; at 100ms framing the reduction against a raw 48kHz render quantum is roughly 37x, and the send rate is 10 per second. The file must remain plain AudioWorklet-scope JavaScript with no imports and no reference to any global beyond the three it already uses.

In `tests/unit/pcmCaptureProcessor.test.ts` change the local frame-size constant to 1600 — the byte constant derives from it and needs no edit — and recount the quanta in each case so the expected frame counts still hold. Use exactly these numbers, which were computed against the resampler's actual output length rather than estimated: the 48kHz three-frame case feeds 120 quanta (15360 input samples, 5120 output, 3 full frames with 320 carried); the 16kHz three-frame case and the bit-exact case each feed 40 quanta (5120 samples, 3 full frames with 320 carried); the anti-aliasing helper feeds 300 quanta at 48kHz (12800 output samples, 8 frames, comfortably past the six the case requires); and the per-frame-level case feeds 80 quanta at 16kHz (10240 samples, 6 frames) with its loud-sample boundary still expressed as three times the frame-size constant so frames 0-2 are loud and 3-5 quiet. Update each case's title where it names the old byte count. Leave the scope case alone.

In `src/components/UnifiedPanel/audioLevelThrottle.ts`, correct only the comments and JSDoc: the worklet now emits 10 frames per second, so the 50ms floor gate passes every frame and is retained as a guard that re-engages if frame size is ever reduced, not as an active throttle. Do not change the interval constant, the threshold constant, the factory, the floor-gate rule, or anything else — the module's tests drive it with explicit timestamps and must keep passing untouched. Apply the same correction to the comment above the status-emit interval constant in `electron/audio/LiveInterviewService.ts`, which likewise describes a 33-per-second arrival rate that is no longer true.

**Step 2 — custom vocabulary.** Create `electron/audio/customVocabulary.ts` as a dependency-free pure module. Per finding 11 the config-layer profile and company interfaces are not exported, so declare local input types here with every field optional: a vocabulary-profile type with `skills`, `certifications`, `workHistory` (entries carrying `company`), and `projects` (entries carrying `tech`); and a vocabulary-company type with `companyName`, `jobTitle`, `techStack`, `requiredSkills` and `niceToHaveSkills`. Both are structural, so the richer config objects satisfy them at the call site with no cast.

Export `CUSTOM_VOCABULARY_MAX_TERMS` set to 100, `CUSTOM_VOCABULARY_MAX_TERM_CHARS` set to 40 and `CUSTOM_VOCABULARY_MAX_TERM_WORDS` set to 4, each with JSDoc: 100 is the documented quality optimum against an API ceiling of 1000; the character and word limits exist because the fields being harvested occasionally contain a sentence, and a sentence is a bad vocabulary entry.

Export `buildCustomVocabulary(profile, company)` returning a string array. Gather candidates in strict priority order, because the cap discards from the tail: company name, job title, tech stack, required skills, profile skills, nice-to-have skills, employer names from work history, certifications, then project technologies. Then normalize: trim each; drop empties; drop anything over the character limit or over the word limit; deduplicate case-insensitively keeping the first-seen casing; and slice to the term cap. Add a JSDoc block on the function recording exactly which fields are deliberately NOT harvested — CV prose, AI summary, achievements, job description body, responsibilities and talking points — and why: they are free narrative rather than terminology, they would consume the cap with sentences, and they carry the most personal detail of anything in the profile. That exclusion list is a privacy decision, so it belongs in the code as a comment and not only in this plan.

Wire it. Add `customVocabulary?: readonly string[]` to `LiveInterviewConfig` in `electron/audio/LiveInterviewService.ts` and pass it straight through to the `GeminiLiveService` constructor alongside the existing fields. In `electron/ipcHandlers.ts`, in the live-interview-start handler immediately after the active profile and active company are resolved, import the builder and compute the array, then pass it in the service config; log the resulting term count at info level, since a silently empty vocabulary and a working one are otherwise indistinguishable from the outside. Use a dynamic import consistent with how the service itself is imported a few lines above, or a static top-of-file import if that matches the surrounding style better — but do not import from `ConfigHelper` for types.

Create `tests/unit/customVocabulary.test.ts` covering the six builder behaviors. Build the cap case from more than 100 generated skill entries plus a known high-priority company name and assert both that the length is exactly 100 and that the high-priority entry survived while a low-priority generated one did not — a length-only assertion would pass for a builder that truncated from the wrong end. Build the exclusion case by supplying a profile and company whose free-text fields contain a distinctive sentence, and assert no returned entry contains it.

**Step 3 — hints on partials.** In `electron/audio/LiveInterviewService.ts` add `private interimTranscript: string = ''`, updated from the new `interimText` field on every transcript event. Change `getStatus()` to return `transcript` as the finalized text concatenated with the interim tail, leaving every other status field alone; this is what puts live partials on screen at `UnifiedPanel.tsx:815` and `DebugLive.tsx:379` with no renderer change. Reset the interim field in `stop()` beside the other resets.

Add three constants beside the existing timing constants: `INTERIM_HINT_QUIET_MS` at 600, `INTERIM_HINT_MIN_NEW_CHARS` at 60, and a boolean field `earlyHintFiredThisTurn` initialized false. Add JSDoc explaining that 600ms is half the Live API's end-of-speech window so an early hint lands meaningfully before turnComplete would have fired, and that the character floor exists so a two-word filler fragment cannot trigger a full generation.

In the transcript listener, when the update is an interim one AND the resolved profile enables hints on interim, do not run the existing final-transcript machinery on it; instead reset a dedicated early-hint timer to `INTERIM_HINT_QUIET_MS`. When that timer fires, do nothing if an early hint already fired this turn, if a hint is already in flight, or if the combined finalized-plus-interim text has fewer than `INTERIM_HINT_MIN_NEW_CHARS` meaningful new characters beyond the last hint baseline. Otherwise set the latch, generate a hint from the combined text, and — this is the part that must not be simplified — set the last-hint baseline to the FINALIZED text only, never to the combined text. Per D-11, baselining on combined text breaks the prefix match the moment the phrase finalizes and makes the turnComplete hint regenerate against the entire transcript. Clear the latch and the early-hint timer in the turnComplete handling and in `clearHintTimers`, and clear the timer in `stop()`.

The profile flag must be readable from `LiveInterviewService`. It already constructs the `GeminiLiveService`; add a small public accessor on that service returning its resolved profile (or just the two booleans the caller needs) rather than re-resolving the model string in a second place — one resolution point is the whole premise of D-01, and a second one is exactly how a rollback flag half-applies.

Extend `tests/integration/liveInterviewLifecycle.integration.test.ts` with the five hint and status behaviors above. The existing prototype mocks already stub hint generation, so assert against the `generateHint` spy's call arguments. Keep every existing case in that file passing untouched — in particular the no-signal round trip and the status-throttle cases, which are 260827-tlv's regression guards.
  </action>
  <verify>
    <automated>node --check public/pcm-capture-processor.js</automated>
    <automated>npx tsc --noEmit -p tsconfig.electron.json</automated>
    <automated>npx tsc --noEmit -p tsconfig.json</automated>
    <automated>npx vitest run</automated>
    <automated>test "$(grep -c 'FRAME_SIZE = 1600' public/pcm-capture-processor.js)" -eq 1 &amp;&amp; echo FRAME_SIZE_100MS</automated>
    <automated>test "$(grep -v '^\s*[/*]' public/pcm-capture-processor.js | grep -c 'applyLowPass')" -ge 2 &amp;&amp; echo ANTIALIAS_FILTER_KEPT</automated>
    <automated>test -z "$(grep -rn 'scheduleEndTurnIfSilent\|END_TURN_SILENCE_MS\|END_TURN_MIN_INTERVAL_MS\|lastEndTurnAt\|lastNonSilentAudioAt\|endTurnDebounceTimeout' electron/ src/ tests/ --include='*.ts' --include='*.tsx')" &amp;&amp; echo TLV_DEAD_PATH_STILL_GONE</automated>
    <automated>npx eslint .</automated>
  </verify>
  <done>Audio reaches the Live API in the documented 100ms / 1600-sample / 3200-byte frames at both source rates, with the anti-aliasing low-pass, the per-frame RMS, the bit-exact microphone path and the node:vm harness all intact; the setup message carries up to 100 deduplicated, priority-ordered vocabulary terms drawn only from structured fields, with free narrative excluded by construction and the exclusion recorded in the code; an early hint fires once per turn from finalized-plus-interim text after 600ms of quiet above a meaningful-character floor, baselined on finalized text so the turnComplete hint still sees a correct delta, and is inert on the rollback profile; live partials appear in both transcript surfaces with no renderer change; the full suite, both typechecks, the worklet syntax check, the framing and filter gates, 260827-tlv's dead-path sweep and a whole-tree lint all pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `.env` / `process.env` -> `GeminiLiveService` model resolution | An environment value selects a model id that is interpolated into the setup message as a path segment |
| ConfigHelper-persisted CV and job-description data -> the Gemini Live setup frame | Personal career data crosses to a third party as `customVocabulary` |
| Renderer AudioWorklet -> Electron main via `live-interview-send-audio` | Attacker-influenceable base64 decoded with `Buffer.from` and forwarded to a remote socket |
| Electron main -> `generativelanguage.googleapis.com` websocket(s) | Now up to two concurrent sockets per session rather than one |
| Gemini Live server -> `handleMessage` | Untrusted JSON drives transcript accumulation, hint prompts and rotation decisions |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-WSJ-01 | Information Disclosure | `buildCustomVocabulary` -> `setup.inputAudioTranscription.customVocabulary` | medium | mitigate | Harvest only short structured fields (skills, tech stack, employer names, certifications, job title, company name). CV prose, AI summary, achievements, job-description body, responsibilities and talking points are excluded in code with the reason recorded as JSDoc, and a unit case asserts a distinctive sentence planted in those fields never reaches the output. The 40-character and 4-word filters bound any single leaked entry even if a new source field is added carelessly. |
| T-WSJ-02 | Denial of Service | Rotation socket lifecycle in `GeminiLiveService` | high | mitigate | Exactly one successor may exist at a time, enforced by an early return in the opener. Retirement is bounded by a single drain timer that unconditionally closes and de-listens the predecessor. Retiring and successor sessions are excluded from the reconnect path, so a deliberate close cannot start a reconnect loop. `disconnect()` closes primary, successor and draining sessions and clears all four timers, asserted by a zero-pending-timers test. |
| T-WSJ-03 | Denial of Service (cost) | Two concurrent Live sessions during the rotation overlap | medium | mitigate | The successor receives zero audio frames before promotion (D-08), asserted directly, so the overlap costs a setup frame and nothing else. The overlap is bounded to 30 seconds by the schedule (D-09). Dual-send was considered and rejected partly for this reason. |
| T-WSJ-04 | Tampering | `GEMINI_LIVE_PROFILE` / `modelName` -> `models/${id}` in the setup frame | medium | mitigate | `resolveLiveModelProfile` passes any unrecognized id through the same URL-path charset guard already used by `resolveGeminiModelId`; a failing id yields the default profile's own model rather than an interpolated attacker string. Recognized ids resolve to a fixed record and are never taken from input. |
| T-WSJ-05 | Spoofing / Elevation | Unknown model id inherits the default profile's capability flags | medium | mitigate | Documented in the resolver's JSDoc and surfaced as the named reason the two supported models are profiles rather than strings. The two ids a user can realistically reach — the picker list and the DebugLive default — are both exact profile matches, so the assumed-capability branch is only reachable by deliberately typing a third id. |
| T-WSJ-06 | Information Disclosure | API key carried in the websocket URL query string, now on two sockets | medium | accept | Pre-existing and unchanged in kind: this is Google's documented auth mechanism for the BidiGenerateContent endpoint and the key already travels this way today. Rotation doubles the number of times the same secret crosses the same TLS channel to the same host, which does not change the exposure class. |
| T-WSJ-07 | Tampering | Server-controlled `interimInputTranscription` text | low | mitigate | Interim text is confined to its own buffer, never merged into the finalized transcript, and cleared on final, on turnComplete and on promotion — so a hostile or malformed interim stream cannot corrupt the finalized record or persist past a turn. It does reach a hint prompt via the early-hint path, which is the same trust level the finalized transcript already has. |
| T-WSJ-08 | Denial of Service | 3200-byte frames over the `live-interview-send-audio` IPC | low | accept | Payload size rises to roughly 4270 base64 characters per call while call frequency falls to 10 per second — an aggregate reduction in IPC pressure against the current 30ms framing, and far below any practical IPC payload limit. |
| T-WSJ-09 | Repudiation | Which model branch actually ran is invisible after the fact | low | mitigate | The resolved profile id and model are logged at construction, `rotated` events are logged with their boundary flag and session index, and the vocabulary term count is logged at start — so a support log can reconstruct which branch ran, how many rotations occurred and whether vocabulary was actually supplied. |
| T-WSJ-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no packages and adds no dependencies. `node:fs` and `node:vm` are Node built-ins already used by the existing worklet harness; `ws`, `vitest` and `electron-log` are already present. The supply-chain surface is unchanged, so no Package Legitimacy Gate applies. |
</threat_model>

<deferred>
Explicitly out of scope, each with the reason it was excluded rather than forgotten:

1. **`languageCodes` stays an empty array (auto-detect)** (D-15). The documented example shows exactly `languageCodes: []`, and the field's expected format for a non-empty value — bare ISO-639-1 versus BCP-47 — could not be probed. Mapping the app's `spokenLanguage` into it is a one-line change once a single live session can confirm the format. Revisit at the same time as human verification item 1.
2. **Session resumption is not attempted.** The verified facts state the resumption mechanism is not documented for this model. Rotation via a fresh session is the mechanism that exists. If `sessionResumption` handles turn out to be supported, they would let the successor inherit server-side context and would make even the forced-cutover case seamless — that is the natural follow-up, not a gap in this plan.
3. **Push-to-talk / explicit activity control stays off.** 260827-tlv established that explicit activity messages 1007-disconnect while automatic detection is enabled, and the transcribe-live documentation confirms automatic VAD is the default. The no-op turn-ender and its explanatory comment are retained untouched as the record of that, and a gate asserts it still has zero callers.
4. **Dual-sending audio to the successor during the overlap** (D-08). Rejected: it doubles audio-token cost for the whole overlap and produces a duplicated tail in the shared transcript on the common (boundary) cutover path. The cost is a possible word-boundary artifact in the forced-cutover case only, which requires nine minutes of continuous speech with no 1.2s pause.
5. **`gemini-3.5-transcribe` (the batch `generateContent` sibling) is not used.** It exists and would suit offline re-transcription of a saved session, but this task is about the live path.
6. **No Settings UI toggle for the rollback flag** (D-03). Three reachable channels already exist — the env var, the module constant and the DebugLive model field — for a control whose purpose is emergency use by the developer. A UI toggle would cost a Config field, a validation rule, the preload/type/handler triad and a form control.
7. **The VAD tuning fields on the transcribe model remain unverified** (D-05). They are sent, and `includeVadTuning: false` on the profile is the built-and-tested one-line retreat if the first live session 1007s. This is the single largest unverified assumption in the plan and is human verification item 1.
8. **Interim replacement-versus-append semantics remain unverified** (D-10). Replacement is chosen because the failure mode is benign — a degraded displayed tail and nothing else. Human verification item 2 distinguishes the two, and the switch is one function.
9. **The early hint doubles hint generations per turn in the best case.** A provisional hint mid-phrase plus a refined one at turnComplete is the intended behavior, bounded by the once-per-turn latch and the 60-character floor. If cost proves unacceptable in practice, raising the floor is the tuning knob; no structural change is needed.
10. **No change to `AUDIO_SILENCE_LEVEL`, `SILENCE_NO_SIGNAL_MS`, or either 260827-tlv throttle interval.** The RMS scale is unchanged by moving from a 30ms to a 100ms averaging window, so the 0.01 threshold keeps its meaning. Retuning would need field data on the new per-frame distribution.
</deferred>

<verification>
Run after all three tasks:

1. `npx vitest run` — full suite green. Baseline was 85 tests across 11 files, all passing, so any failure is attributable to these changes.
2. `npx tsc --noEmit -p tsconfig.electron.json` — clean.
3. `npx tsc --noEmit -p tsconfig.json` — clean.
4. `npx tsc --noEmit -p backend/tsconfig.json` — clean. Verified to run and pass from the repo root against the current tree, so the backend mirror edit is genuinely covered.
5. `node --check public/pcm-capture-processor.js` — the worklet's only syntax gate, since `eslint.config.mjs` explicitly ignores that file.
6. `npx eslint .` — clean across everything eslint does cover.
7. Model-id sweep: a grep across `electron/`, `src/`, `backend/src/` and `tests/` for a Gemini 3.1 Pro id NOT followed by a hyphen returns nothing, proving the corrected id replaced the nonexistent one everywhere including the three legacy remap targets and the backend duplicate.
8. 260827-tlv regression sweep: the removed silence-debounce identifiers return nothing across `electron/`, `src/` and `tests/`, and the no-op turn-ender has no caller outside its own declaring file.

**Do NOT run `npm run dev`, `npm run start`, `npm run build`, or `npm run clean`.** The Electron app is running in this session under `tsc -w` and `vite`; `npm run dev` and `npm run build` both begin with `npm run clean`, which deletes `dist-electron` out from under the live process. The `--noEmit` typecheck variants above are the safe equivalents and write nothing.

**Neither renderer nor electron typecheck covers `tests/`** (finding 8). Test files are transpiled by vitest without typechecking and linted without type-aware rules. Every `as unknown as` cast in this plan's tests is therefore unverified by the compiler, which is why each one is paired with a guard assertion on its own result — that the socket array grew, that the handler is a function, that the constant read back is a positive number — so a drifted shape fails loudly instead of comparing `undefined` to `undefined`.

**What these gates cannot prove.** No gate here touches the real API; the key has no credits and every request returns 429 while every socket closes 1011. So nothing above demonstrates that `gemini-3.5-transcribe-live` accepts the setup message, that it emits interim transcripts in the assumed shape, that custom vocabulary improves recognition, or that a real rotation is inaudible. The gates prove the mechanism — which message is built for which profile, that frame accounting balances across a simulated rotation, that transcript ordering holds across a simulated drain, that the vocabulary builder excludes what it claims to exclude, that frames are 100ms. The `<human_verification>` items prove the outcome, and every one of them is blocked on the account having credits. Do not convert any of them into a gate: a socket test against a dead key passes vacuously.
</verification>

<human_verification>
All items require the running app plus a Gemini key with credits. Restart the app after execution so the rebuilt main process and the new worklet are both loaded, and hard-reload the renderer so the old cached `pcm-capture-processor.js` is not served.

1. **The setup message is accepted at all — the single largest unverified risk.** Start a live session and watch the log for the construction line naming the resolved profile, then for the setup-sent line, then for transcripts. A close with code 1007 immediately after setup means the transcribe model rejected a field. The prime suspect is the VAD tuning (D-05): set `includeVadTuning: false` on the transcribe profile in `electron/constants/liveModelProfiles.ts`, restart, and retry. If that fixes it, record it — the phrase-clipping tuning from 260827-tlv then applies only to the rollback branch and the transcribe branch relies on the model's default VAD.
2. **Interim semantics.** Speak a long sentence slowly and watch the transcript area. Expect the tail to grow smoothly as a hypothesis that lengthens and occasionally self-corrects. If instead the tail flickers between single short fragments, interim is incremental rather than replacement and the interim branch in `handleMessage` must append instead of assign (D-10). The finalized transcript is correct either way — only the live display and the early-hint input are affected.
3. **Hints start on partials.** Speak a substantial question and stop talking without a long pause. A hint should appear noticeably sooner than before — roughly 600ms after you stop rather than after the full 1.2s end-of-speech window plus generation. Confirm you get at most one early hint per utterance, and that a second, refined hint follows at turn completion rather than a regeneration of the whole transcript.
4. **Custom vocabulary.** With a parsed job description loaded, say two or three distinctive terms from its tech stack aloud — framework names, internal product names, unusual acronyms. Check the log line reporting the vocabulary term count is non-zero, then compare the transcript against a session run with no active company selected. This is the item most likely to show a subtle rather than dramatic difference; judge it on the specific seeded terms, not on overall accuracy.
5. **Rotation, the long-run check.** Run a session past twelve minutes with intermittent speech. In the log expect a successor-opened line at about nine minutes, a rotation line shortly after carrying a boundary flag of true, and no disconnect, no error and no state change visible in the UI. Read the transcript across the rotation timestamp: it must be continuous with no missing phrase and no repeated phrase at the seam. Confirm a second rotation occurs at about eighteen minutes — a rotation that only works once means the schedule is not being re-armed against the new primary.
6. **Rotation under a monologue.** Speak continuously past the nine-and-a-half-minute mark with no pause longer than a second. Expect a rotation line with a boundary flag of false. A word-boundary artifact at the seam is the documented, accepted cost of that case (D-08); a lost sentence is not, and would mean the drain window is too short.
7. **Rollback.** Put `GEMINI_LIVE_PROFILE=native-audio` in `.env`, restart, and confirm the construction log names the native-audio profile and model, that transcription works exactly as it did before this task, and that no early hints fire. Then remove the variable and confirm the default returns to the transcribe profile. A rollback branch that connects but never transcribes means the profile's capability flags are wrong, not the model id.
8. **Meter responsiveness at 10Hz framing, and traffic.** Watch the level indicator while speaking; at ten updates per second it should still track speech visibly, though it will be perceptibly steppier than before. Then find the `[STATS] audioSent=` lines in the log, which report per five-second window: expect roughly 50, down from roughly 165 at the previous 30ms framing. A number in the hundreds means the old worklet is still being served and the renderer needs a hard reload.
9. **The corrected picker id.** Open Settings, select the Gemini 3.1 Pro entry, and run a screenshot extraction. It must succeed rather than fail with a model-not-found error, which is what the previous id produced.
</human_verification>

<success_criteria>
- The live websocket connects to `gemini-3.5-transcribe-live` with a TEXT response modality, and the discarded-audio limb (AUDIO modality, generation tuning, acknowledgment system instruction) is gone from the default path.
- Selecting the `native-audio` profile — by env var, by profile id or by model id — produces a setup message that deep-equals an independently written literal of the pre-migration message, so the rollback branch is a working session and not a swapped string.
- All seven capability axes on which the two models differ resolve together through one function, and every one of them is a field on the profile record rather than a conditional in a service.
- No live session reaches the documented 10-minute cap: a successor is opened at 9:00 and promoted at the first turn boundary after that or unconditionally at 9:30, with a second rotation correctly scheduled against the new primary.
- Frame accounting balances exactly across a full simulated rotation timeline, with zero frames delivered to an unpromoted successor and zero frames lost at the seam.
- The accumulated transcript survives rotation with no reset, no duplication and no reordering, proven by a drain-queue ordering assertion.
- A successor that fails to open, or closes before promotion, is discarded and retried, and is never promoted; a retired socket never triggers the reconnect path; `disconnect()` leaves no timer armed.
- `interimInputTranscription` is consumed as a replacement tail in a buffer the finalized transcript never sees, is cleared on final, turnComplete and promotion, and is inert on the rollback profile.
- An early hint fires at most once per turn from finalized-plus-interim text after 600ms of quiet above a 60-character floor, baselined on finalized text so the turnComplete hint still computes a correct delta.
- The setup message carries at most 100 deduplicated, priority-ordered vocabulary phrases drawn only from structured fields, with CV prose, AI summary, achievements, job-description body, responsibilities and talking points excluded in code and asserted absent by test.
- Audio leaves the worklet in 1600-sample / 3200-byte / 100ms frames at both 48kHz and 16kHz, still carrying the RMS of that exact frame, still low-passed before decimation, still bit-exact on the microphone path, still passing the `node:vm` harness.
- 260827-tlv is intact: the 1200ms/400ms VAD tuning still reaches the wire with its invariant now asserted over every profile, the removed silence-debounce identifiers are still absent, the no-op turn-ender still has zero callers, and both throttles are retained with corrected comments.
- No Gemini 3.1 Pro id without the preview suffix survives in the desktop constants, the picker, the three legacy remap targets, the backend mirror or the tests.
- Full suite, all three typechecks, `node --check` on the worklet, `npx eslint .`, and all four grep sweeps pass.
</success_criteria>

<output>
Create `.planning/quick/260827-wsj-migrate-live-transcription-to-gemini-3-5/260827-wsj-SUMMARY.md` when done.
</output>
