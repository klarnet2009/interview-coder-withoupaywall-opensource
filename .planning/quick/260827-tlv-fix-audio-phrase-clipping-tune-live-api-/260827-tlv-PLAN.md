---
phase: quick-260827-tlv
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260827-tlv]
files_modified:
  - electron/audio/GeminiLiveService.ts
  - electron/audio/LiveInterviewService.ts
  - tests/integration/liveInterviewLifecycle.integration.test.ts
  - tests/unit/geminiLiveSetup.test.ts
  - public/pcm-capture-processor.js
  - tests/unit/pcmCaptureProcessor.test.ts
  - src/components/UnifiedPanel/audioLevelThrottle.ts
  - src/components/UnifiedPanel/useAudioCapture.ts
  - tests/unit/audioLevelThrottle.test.ts

must_haves:
  truths:
    - "The Live API is told to wait 1200ms of silence before closing a turn, so a 0.7-1.5s thinking pause no longer splits a sentence into two turns."
    - "The Live API prepends 400ms of look-back audio at speech onset, so the first syllable survives START_SENSITIVITY_LOW firing late."
    - "The Live API silence window stays strictly below LiveInterviewService.HINT_TRIGGER_SILENCE_MS, so turnComplete remains the primary hint trigger and the 1500ms transcript-silence fallback stays a fallback."
    - "No code path in electron/ or src/ calls GeminiLiveService.endTurn() any more; the local silence-debounce timer that used to arm on every audio chunk is gone."
    - "AUDIO_SILENCE_LEVEL and the SILENCE_NO_SIGNAL_MS no_signal indicator still work: 4s of silence produces state no_signal, and the next non-silent chunk restores listening."
    - "Audio reaches the Live API in fixed 30ms / 480-sample frames (~33 sends/sec) instead of one websocket frame per 128-sample render quantum (~375/sec on 48kHz system audio)."
    - "The level carried with each frame is the RMS of that exact frame, not a value cached from a 50ms wall-clock throttle, so ~19 consecutive chunks no longer report an identical stale level."
    - "System and application audio is low-passed below the 8kHz target Nyquist before decimation, so content above 8kHz no longer folds back into the speech band."
    - "The 16kHz microphone path is bit-identical to before: no filter, no resample, no added latency beyond frame buffering."
    - "The renderer audio meter still visibly responds to speech - updates are spaced at least 50ms apart (so at most 20Hz, and ~17 updates/sec against the worklet's 33Hz frame rate) and always fire on the frame that crosses the 0.01 visibility threshold in either direction."
    - "Main-process status emission toward the renderer is throttled to 10Hz for audio-level-only changes, but a state transition inside receiveAudio still emits immediately."
  artifacts:
    - public/pcm-capture-processor.js
    - tests/unit/pcmCaptureProcessor.test.ts
    - src/components/UnifiedPanel/audioLevelThrottle.ts
    - tests/unit/audioLevelThrottle.test.ts
    - tests/unit/geminiLiveSetup.test.ts
  key_links:
    - "Worklet frame size (480 Int16 samples = 960 bytes) -> useAudioCapture base64 encode -> liveInterviewSendAudio IPC -> LiveInterviewService.receiveAudio -> Buffer.from(base64) -> GeminiLiveService.sendAudio. The frame must survive this chain intact; sendAudio already declares mimeType audio/pcm;rate=16000 and must keep receiving 16kHz mono s16le."
    - "Worklet per-frame RMS -> IPC level argument -> LiveInterviewService.AUDIO_SILENCE_LEVEL (0.01). The RMS scale is unchanged (sqrt of mean square of float samples in [-1,1]), so the 0.01 threshold keeps its meaning; only the averaging window changes from a cached 50ms value to the exact 30ms frame."
    - "Worklet per-frame RMS -> useAudioCapture setLocalAudioLevel -> UnifiedPanel.tsx:398 (Math.min(1, localAudioLevel * 10)), UnifiedPanel.tsx:740 and AudioSourceSelector.tsx:58/65/71 (localAudioLevel > 0.01). These are the four consumers whose responsiveness the UI throttle must not degrade."
    - "GeminiLiveService.sendSetup realtimeInputConfig -> Live API turn boundaries -> the turnComplete event -> LiveInterviewService.triggerHintGeneration. Widening the silence window moves turnComplete later, which is why it must stay under HINT_TRIGGER_SILENCE_MS."
    - "The anti-alias filter runs only inside the resampleRatio > 1.01 branch. That branch is the sole thing separating the system/application path from the mic path, which builds its AudioContext at 16000Hz (useAudioCapture.ts:95) and therefore has ratio 1."
---

<objective>
Fix audio phrase clipping in the live interview pipeline by addressing four independent defects found in an audit of the renderer-worklet -> IPC -> Live API chain: over-aggressive Live API VAD thresholds that cut both ends of a phrase, a dead local end-of-turn debounce that fires timers on every chunk into a no-op, per-render-quantum chunking that floods IPC at ~375 messages/sec in each direction, and 48kHz -> 16kHz decimation with no anti-aliasing filter.

Purpose: users lose the first syllable and the tail of a sentence during live interview transcription. The head loss comes from a 100ms prefix-padding buffer combined with a deliberately-late speech detector; the tail loss comes from a 500ms silence window that closes the turn during a normal thinking pause. Meanwhile the transport is doing ~750 IPC round trips/sec (375 up, 375 down) carrying ~85 bytes of PCM each, and everything above 8kHz in system audio aliases into the speech band as broadband hash that degrades the transcript.
Output: tuned and named VAD constants with a cross-module invariant test, removal of the dead end-of-turn apparatus, a buffering + anti-aliasing rewrite of the AudioWorklet with a `node:vm` test harness, and independently-throttled UI/status level updates.
</objective>

<execution_context>
@C:/Users/klarn/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/klarn/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/codebase/CONVENTIONS.md
@CLAUDE.md

@electron/audio/GeminiLiveService.ts
@electron/audio/LiveInterviewService.ts
@public/pcm-capture-processor.js
@src/components/UnifiedPanel/useAudioCapture.ts
@tests/integration/liveInterviewLifecycle.integration.test.ts
</context>

<research_findings>
Every claim in the audit brief was re-verified against the working tree before this plan was written. All four findings still hold at the stated locations. Additional facts that change how the work must be done:

**1. An existing test asserts the exact behavior Task 1 removes.** `tests/integration/liveInterviewLifecycle.integration.test.ts:92` is `it("forces endTurn after local silence to avoid stuck turns")` and asserts `endTurnSpy` was called. Line 35 installs a prototype spy for it in `beforeEach`. Deleting the dead path without touching this file turns a green suite red. Task 1 must replace that test with its inverse.

**2. `endTurn` has exactly one production caller.** A repo-wide grep over `electron/ src/ tests/ public/` returns only: the declaration in `GeminiLiveService.ts:425`, the dead machinery in `LiveInterviewService.ts` (lines 54, 335-347, 358-359, 444-446), and the two test references above. Nothing else. That makes a "no callers remain" grep gate exact and cheap.

**3. Widening the Live API silence window collides with a second timer.** `LiveInterviewService.HINT_TRIGGER_SILENCE_MS = 1500` (line 69) auto-triggers hint generation 1500ms after the last transcript token, as a fallback for a missed `turnComplete`. Today `silenceDurationMs = 500`, so `turnComplete` always wins. Any new value must stay strictly under 1500 or the fallback becomes the primary path and hint quality changes silently. 1200 keeps a 300ms margin; 1000-1200 was the audit's target range, so this costs nothing.

**4. `public/pcm-capture-processor.js` is explicitly eslint-ignored** (`eslint.config.mjs`, ignores list). There is no lint gate for the worklet. `node --check public/pcm-capture-processor.js` works and was confirmed against the current file, so that is the syntax gate.

**5. The worklet is testable after all, via `node:vm`.** Vitest runs `environment: 'node'`, so `node:vm` is available. Contextifying a sandbox that supplies `AudioWorkletProcessor`, `registerProcessor` and `sampleRate`, then `vm.runInContext`-ing the file text, yields the real processor class. Cross-realm `ArrayBuffer`s posted through the fake `port` are readable from the outer realm with a plain `new Int16Array(buf)` view. This makes buffering, filtering and mic-path passthrough all provable without jsdom or a real AudioContext.

**6. Buffering belongs in the worklet, not the renderer.** Buffering in `useAudioCapture` would cut IPC traffic but leave the `postMessage` flood between the audio thread and the main thread untouched, and would leave the stale-`lastLevel` problem unsolved. Buffering at the point of production fixes `postMessage`, IPC, websocket framing and RMS staleness in one place.

**7. The `currentTime` throttle disappears for free.** Once a frame is only emitted every 480 output samples, the frame boundary *is* the throttle. The `lastLevelTime` / `lastLevel` / `currentTime` block (lines 20-22, 46-57) is deleted rather than adapted, which also removes the only dynamic global the vm harness would otherwise have to fake.

**8. `emitStatus()` on every chunk is only load-bearing for `audioLevel`.** `getStatus()` returns `{ state, transcript, response, audioLevel }`. Transcript, state and hint changes each call `emitStatus()` at their own call sites (lines 149, 200, 213, 280, 286, 312, 415). The trailing `emitStatus()` in `receiveAudio` is the sole publisher of a fresh `audioLevel` - and the sole publisher of the `no_signal -> listening` transition, which calls `setState` without its own emit. That transition is why the throttle must force-emit on state change rather than being a plain time gate.

**9. Baseline is green.** `npx tsc --noEmit -p tsconfig.electron.json`, `npx tsc --noEmit -p tsconfig.json`, and `npx vitest run tests/integration/liveInterviewLifecycle.integration.test.ts` all pass on the current working tree. Gate failures during execution are attributable to this plan's changes.
</research_findings>

<decisions>
**D-01 - `silenceDurationMs = 1200`, `prefixPaddingMs = 400`.** Inside the audit's 1000-1200 / 300-500 target ranges. 1200 covers the upper half of the 0.7-1.5s interview thinking-pause band while keeping a 300ms margin under `HINT_TRIGGER_SILENCE_MS = 1500` (finding 3). 400ms prefix padding is chosen over 300 because `START_SENSITIVITY_LOW` is a deliberately late detector, so the look-back has to absorb the detector's own lag on top of the syllable.

**D-02 - `startOfSpeechSensitivity` and `endOfSpeechSensitivity` stay `*_LOW`. Deferred, on purpose.** Raising either is a distinct tuning decision with a distinct failure mode: a more eager detector triggers on keyboard clatter and room noise, which produces phantom turns rather than clipped ones. Padding and silence duration are safe to widen unilaterally because they only ever add audio; sensitivity trades one artifact for another and needs a live A/B. Recorded in `<deferred>`.

**D-03 - `GeminiLiveService.endTurn()` stays, as a documented no-op with zero callers.** Deleting it would delete the doc comment recording *why* explicit activity control is forbidden here (the 1007 "Explicit activity control is not supported when automatic activity detection is enabled" disconnect). That comment is the institutional memory that stops a future contributor from reintroducing the bug. Keeping the method costs nothing - `noUnusedLocals` is off and it is a public method - and the grep gate in Task 1 enforces that nothing calls it. The method body stays empty; only its doc comment gains a line noting it is intentionally uncalled.

**D-04 - 480-sample / 30ms frames.** 30ms sits mid-range in the audit's 20-50ms target. At 16kHz output that is 480 samples / 960 bytes / ~1280 base64 chars per frame, and ~33 sends/sec: an 11x reduction from 48kHz system audio and a 3.75x reduction from the 16kHz mic. 480 divides evenly at both source rates in aggregate (11.25 render quanta at 48kHz, 3.75 at 16kHz) so no rate needs special-casing.

**D-05 - 4th-order Butterworth low-pass at 7000Hz, as two cascaded RBJ biquads.** An FIR windowed-sinc would give linear phase but needs a tap table and a delay line; a single biquad gives only ~9dB at 12kHz, which is not enough to matter. Two cascaded biquads give ~19dB at 12kHz for 10 multiply-adds per sample and 8 floats of state - allocation-free, self-contained, and expressible in the closed-form RBJ cookbook equations with no imports. 7000Hz leaves a 1000Hz transition band below the 8kHz target Nyquist, so passband speech energy is untouched.

**D-06 - The filter runs only when `resampleRatio > 1.01`.** At 16kHz the mic path has no aliasing to prevent (its Nyquist already *is* the target Nyquist), and low-passing at 7000Hz would shave real content off mic audio. Gating on the existing resample branch means the mic path is provably byte-identical, which Task 2 asserts as bit-exact passthrough rather than as a tolerance.

**D-07 - Two independent throttles, neither of which throttles audio.** The renderer spaces `setLocalAudioLevel` at least 50ms apart (at most 20Hz; ~17/sec in practice against a 33Hz frame stream - see D-10); the main process throttles `emitStatus` to 10Hz. Neither ever gates `liveInterviewSendAudio` or `sendAudio` - every produced frame is transmitted. The renderer throttle additionally force-emits on any frame that crosses the 0.01 threshold in either direction, because that exact comparison is what four separate UI call sites use to decide whether to render the "receiving audio" affordance at all; a pure time gate could hold a first-syllable transient for up to 50ms and make the meter look dead at speech onset.

**D-08 - The UI throttle is extracted as a pure module.** `useAudioCapture` cannot be unit-tested without faking `AudioContext`, `AudioWorkletNode`, `audioWorklet.addModule` and `navigator.mediaDevices`, and the repo's vitest environment is `node`. Putting the decision rule in `src/components/UnifiedPanel/audioLevelThrottle.ts` as a pure `(level, nowMs) => boolean` factory makes the interesting logic node-testable and leaves the hook as trivial wiring.

**D-10 - The UI throttle is a floor gate (`lastAccepted = now`), not a catch-up accumulator (`lastAccepted += intervalMs`).** The two rules differ measurably. Against the worklet's 33Hz frame stream a 50ms floor gate accepts at t = 0, 60, 120 ... 960, i.e. **17 of 33** frames; the accumulator yields exactly 20. The accumulator is rejected for its burst behavior: after any idle gap (capture paused, source switched, renderer backgrounded) `lastAccepted` lags far behind the clock and every subsequent call passes until it catches up. Simulated, a 5000ms gap followed by 33 frames at 30ms accepts **33 of 33** - an unthrottled burst of React renders, precisely the failure mode this task exists to remove. Clamping the accumulator would fix that but adds a second tunable to buy a 17Hz-vs-20Hz difference no eye can resolve. The floor gate cannot burst: at most one accept per 50ms of real elapsed time, unconditionally. The plan therefore asserts a 16-18 band, and every "20Hz" claim is stated as the 50ms spacing it actually is.

**D-09 - The trailing partial frame at capture stop is dropped.** Up to 29ms of audio is discarded when the AudioContext closes. Flushing it would require a stop-signal path from the renderer into the worklet for a sub-frame of trailing audio that by definition follows the user's last word. Recorded in `<deferred>`.
</decisions>

<source_coverage_audit>
| # | Source item (audit finding) | Covered by | Status |
|---|---|---|---|
| F-1 | VAD thresholds clip both ends of a phrase (`silenceDurationMs` 500, `prefixPaddingMs` 100) | Task 1 | COVERED |
| F-1a | Do not change `startOfSpeechSensitivity` / `endOfSpeechSensitivity`; note as deferred | D-02, `<deferred>` | COVERED |
| F-2 | Remove dead local endTurn machinery from `LiveInterviewService` | Task 1 | COVERED |
| F-2a | `endTurn()` must remain a no-op; decide deliberately whether to delete it | D-03 (keep, documented, zero callers, grep-enforced) | COVERED |
| F-2b | `AUDIO_SILENCE_LEVEL` must survive - the `no_signal` path is live | Task 1 (positive grep gate + behavioral test) | COVERED |
| F-3 | Buffer 20-50ms of PCM before sending | Task 2 (D-04) | COVERED |
| F-3a | Compute RMS over the buffer actually being sent, not the cached throttled value | Task 2 (finding 7) | COVERED |
| F-3b | Throttle the UI level update independently so the meter stays smooth | Task 3 (D-07, D-08) | COVERED |
| F-3c | `emitStatus()` on every chunk floods IPC toward the renderer | Task 1 (10Hz throttle, force-emit on state change) | COVERED |
| F-4 | Anti-aliasing low-pass before decimation | Task 2 (D-05) | COVERED |
| F-4a | Do not regress the mic path (ratio 1 bypass) | Task 2 (D-06 + bit-exact passthrough test) | COVERED |
| F-4b | Filter must be self-contained, allocation-light, state carried across `process()` | Task 2 (D-05) | COVERED |

No source item is MISSING. No item is deferred without an explicit decision record.
</source_coverage_audit>

<tasks>

<!-- planner-discipline-allow: endTurn, scheduleEndTurnIfSilent, END_TURN_SILENCE_MS, END_TURN_MIN_INTERVAL_MS, lastEndTurnAt, lastNonSilentAudioAt, endTurnDebounceTimeout, currentTime, currentFrame -->
<!-- These identifiers name code being REMOVED, so an action body cannot avoid mentioning them.
     Every negative grep gate below is scoped to electron/, src/, tests/ or public/ - never .planning/ -
     so this plan file cannot satisfy or invalidate its own gates. Each affected action carries an
     explicit instruction not to leave a tombstone comment naming a removed identifier. -->

<task type="auto" tdd="true">
  <name>Task 1: Tune Live API VAD, remove the dead local end-of-turn path, throttle status emission</name>
  <files>electron/audio/GeminiLiveService.ts, electron/audio/LiveInterviewService.ts, tests/unit/geminiLiveSetup.test.ts, tests/integration/liveInterviewLifecycle.integration.test.ts</files>
  <read_first>electron/audio/GeminiLiveService.ts lines 189-226 (sendSetup) and 416-427; electron/audio/LiveInterviewService.ts lines 40-76, 328-416, 435-472; tests/integration/liveInterviewLifecycle.integration.test.ts (whole file, 105 lines)</read_first>
  <behavior>
    - The setup message sent to the Live API carries `silenceDurationMs: 1200` and `prefixPaddingMs: 400`, with `disabled: false`, both sensitivities still at their `*_LOW` values, and `activityHandling: 'NO_INTERRUPTION'` unchanged.
    - The configured silence window is strictly less than `LiveInterviewService.HINT_TRIGGER_SILENCE_MS`, asserted as a cross-module invariant so a future edit to either number fails the suite instead of silently reordering the hint triggers.
    - Feeding loud then silent audio chunks and advancing timers 5000ms results in zero calls to `GeminiLiveService.prototype.endTurn`.
    - Feeding a silent chunk and advancing 4000ms still transitions state to `no_signal`; a subsequent non-silent chunk still restores `listening`.
    - Feeding 50 chunks synchronously (no simulated time passing) emits at most 2 `status` events, down from 50.
    - The state-change override is provable in isolation: after reaching `no_signal`, one silent chunk refreshes the emit timestamp, and a non-silent chunk issued in the same millisecond still emits - the 100ms time gate is closed at that instant, so only the state-change branch can produce the event. Deleting that branch must fail this case.
  </behavior>
  <action>
**Commit in three steps, in this order, so a problem in the riskiest change cannot strand the safest one.** (1) The VAD constants - a two-value config change that fixes the reported bug on its own and cannot regress anything else. (2) The dead-path removal plus its test replacement. (3) The status throttle. Run the task's gates after each step rather than only at the end; if step 3 proves troublesome, steps 1 and 2 are already committed and independently valuable. This ordering is the mitigation for keeping all three changes in one task (see the note under `<deferred>` item 5).

In `electron/audio/GeminiLiveService.ts`, hoist the two magic numbers out of the `sendSetup` literal into `public static readonly` class constants named `VAD_SILENCE_DURATION_MS` (value 1200) and `VAD_PREFIX_PADDING_MS` (value 400), each with a JSDoc line stating what it controls and, for the silence constant, that it must stay below the hint-trigger silence window in LiveInterviewService. They are public rather than private specifically so the cross-module invariant assertion needs no cast. Reference them from the `automaticActivityDetection` object in `sendSetup`; leave `disabled`, both sensitivity fields and `activityHandling` exactly as they are (per D-02). Add one line to the doc comment above the no-op turn-ending method recording that it now has zero callers and must stay that way (per D-03) - do not restore a body, and do not name the method inside any new comment you write elsewhere in the tree.

In `electron/audio/LiveInterviewService.ts`, delete the entire dead local silence-debounce apparatus: the `endTurnDebounceTimeout` field (line 54), the `lastNonSilentAudioAt` and `lastEndTurnAt` fields (lines 58-59), the `END_TURN_SILENCE_MS` and `END_TURN_MIN_INTERVAL_MS` constants (lines 74-75), the whole `scheduleEndTurnIfSilent` method (lines 328-361), its call site inside `receiveAudio` (line 386) together with the comment above it, the `lastNonSilentAudioAt` assignment in `start()` (line 118), the debounce-timeout clear block in the stop path (lines 444-446), and the two field resets in the stop path (lines 468-469). Do not leave a tombstone comment naming any removed identifier. Keep `AUDIO_SILENCE_LEVEL` (line 73) and its `isSilent` computation - it is still the input to the `no_signal` path - and rewrite the section comment above it so it describes silence detection rather than turn finalization.

Still in `LiveInterviewService`, replace the unconditional trailing `emitStatus()` at the end of `receiveAudio` with a throttle. Add `private static readonly STATUS_EMIT_INTERVAL_MS = 100;` beside the other timing constants and `private lastStatusEmitAt: number = 0;` beside the other mutable timestamps, and reset that field to 0 in the stop path where the removed timestamp fields were reset. Capture the current state into a local at the very top of `receiveAudio`, before any silence handling can mutate it. At the end of the method, emit only when the state differs from that captured local or when at least `STATUS_EMIT_INTERVAL_MS` has elapsed since `lastStatusEmitAt`; on emit, record the timestamp first. Reuse the `now` local that the method already computes for the periodic debug log rather than calling the clock again. The state-change branch is not optional - it is the only publisher of the silence-recovery transition, which changes state without emitting on its own. Leave the direct `emitStatus()` inside the `silenceTimeout` callback exactly as it is: do not route it through the throttle and do not have it update `lastStatusEmitAt`. It is an immediate one-shot emit on entering `no_signal`, and keeping it out of the throttle's bookkeeping is what makes test case (d) below able to isolate the state-change branch.

Create `tests/unit/geminiLiveSetup.test.ts`. Mock `electron-log` with the same default-export shape the existing lifecycle integration test uses. Construct a `GeminiLiveService` with a dummy key, assign a fake socket onto its private `ws` field via an `as unknown as` cast in the idiom this repo already uses, giving the fake `readyState: 1` plus `vi.fn()` stubs for `send`, `close` and `removeAllListeners`. Invoke the private setup-sending method through the same cast style, parse the single argument captured by the `send` stub, and assert the five `automaticActivityDetection` fields and `activityHandling`. Add a second case asserting the public silence constant is strictly less than `HINT_TRIGGER_SILENCE_MS` read off `LiveInterviewService` via an `as unknown as { HINT_TRIGGER_SILENCE_MS: number }` cast. Call `disconnect()` in cleanup so the debug-stats interval started by the setup send is cleared and vitest exits.

In `tests/integration/liveInterviewLifecycle.integration.test.ts`, remove the prototype spy installed in `beforeEach` at line 35 and delete the whole `it` block at lines 92-104 that asserts the forced turn ending. Replace it with three cases against a started service: (a) a spy on the prototype turn-ending method stays uncalled after a loud chunk, a silent chunk and 5000ms of advanced timers; (b) a silent chunk plus 4000ms advanced yields `getStatus().state === 'no_signal'`, and a following chunk at level 0.2 restores `'listening'`; (c) attaching a `status` listener and then calling `receiveAudio` 50 times in a synchronous loop at a constant non-silent level fires the listener no more than twice; and (d) the state-change override in isolation, which must be built as an explicit sequence because entering silence only *arms* `silenceTimeout` and leaving it only *clears* the timer - neither changes state synchronously, so the sole synchronous transition available inside `receiveAudio` is the silence-recovery one. Build it as: feed a silent chunk, advance 4000ms so the timer callback sets `no_signal`, feed one more silent chunk (which refreshes `lastStatusEmitAt` to the current mocked clock, because the timer callback calls `emitStatus()` directly and deliberately does not touch that field), then without advancing the clock feed a non-silent chunk and assert exactly one `status` event fires on that call. Do not simply advance 4000ms and assert an emit - at that point the 100ms time gate has already elapsed and the assertion would still pass with the state-change branch deleted, making it vacuous. Keep the existing fake-timer setup and the rest of the mocks intact.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.electron.json</automated>
    <automated>npx vitest run tests/unit/geminiLiveSetup.test.ts tests/integration/liveInterviewLifecycle.integration.test.ts</automated>
    <automated>test -z "$(grep -rn 'endTurn' electron/ src/ --include='*.ts' --include='*.tsx' | grep -v 'electron/audio/GeminiLiveService.ts')" &amp;&amp; echo NO_CALLERS</automated>
    <automated>test -z "$(grep -rn 'scheduleEndTurnIfSilent\|END_TURN_SILENCE_MS\|END_TURN_MIN_INTERVAL_MS\|lastEndTurnAt\|lastNonSilentAudioAt\|endTurnDebounceTimeout' electron/ src/ tests/ --include='*.ts' --include='*.tsx')" &amp;&amp; echo DEAD_PATH_GONE</automated>
    <automated>test "$(grep -v '^\s*//' electron/audio/LiveInterviewService.ts | grep -c 'AUDIO_SILENCE_LEVEL')" -ge 2 &amp;&amp; echo SILENCE_LEVEL_KEPT</automated>
    <automated>npx eslint electron/audio/GeminiLiveService.ts electron/audio/LiveInterviewService.ts tests/unit/geminiLiveSetup.test.ts tests/integration/liveInterviewLifecycle.integration.test.ts</automated>
  </verify>
  <done>The Live API receives 1200ms silence / 400ms prefix padding from named constants; the cross-module invariant against HINT_TRIGGER_SILENCE_MS is asserted by a test; the local silence-debounce apparatus is gone with zero remaining callers of the no-op turn-ender; AUDIO_SILENCE_LEVEL and the no_signal round trip still work under test; audio-level-only status emission is 10Hz while state transitions inside receiveAudio still emit immediately; all six gates pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Buffer the worklet into 30ms frames with per-frame RMS and an anti-aliasing low-pass</name>
  <files>public/pcm-capture-processor.js, tests/unit/pcmCaptureProcessor.test.ts</files>
  <read_first>public/pcm-capture-processor.js (whole file, 102 lines); src/components/UnifiedPanel/useAudioCapture.ts lines 90-127 (how the worklet is constructed and what processorOptions it gets)</read_first>
  <behavior>
    - At 48000Hz input, feeding 36 render quanta of 128 samples produces exactly 3 posted messages, each carrying a 960-byte ArrayBuffer, instead of 36 messages of ~85 bytes.
    - At 16000Hz input, feeding 12 render quanta of 128 samples produces exactly 3 posted messages of 960 bytes.
    - At 16000Hz input (ratio 1), the emitted Int16 samples are bit-exact against the standard float-to-int16 quantization of the input ramp - proving neither the filter nor the resampler touches the microphone path.
    - At 48000Hz input, a 12000Hz sine (which would fold to 4000Hz through bare decimation) comes out at less than 35% of the RMS of a 1000Hz sine of identical amplitude, while the 1000Hz sine retains more than 85% of its expected RMS.
    - The `level` on each message is a finite number in [0, 1] that changes between a loud frame and a quiet frame - it is not repeated identically across consecutive frames of differing content.
    - The file remains valid standalone JavaScript with no imports and no references to any global beyond `AudioWorkletProcessor`, `registerProcessor` and `sampleRate`.
  </behavior>
  <action>
Rewrite `public/pcm-capture-processor.js` in place, preserving its existing structure, its `registerProcessor('pcm-capture-processor', ...)` registration, the `processorOptions.inputSampleRate` contract, the stereo mix-down block, the `resampleRatio > 1.01` branch condition, and the `resampleBuffer` leftover-sample carry. It must remain plain AudioWorklet-scope JavaScript: no import, no require, no DOM, no Node APIs, no reference to `currentTime` or `currentFrame`.

Delete the wall-clock level throttle entirely - the `lastLevelTime` and `lastLevel` fields and the whole RMS-with-throttle block. The frame boundary replaces it. Do not leave a comment naming the deleted globals or fields: the scope gate below greps this file for those identifiers and a tombstone comment would trip it. Update the file's header comment to describe frame buffering and anti-aliasing instead of the old per-quantum behavior, without naming the removed globals.

Add frame buffering. Introduce a module-level constant for the frame size at 480 samples (30ms at the 16000Hz target) with a comment naming both figures, and allocate in the constructor a reusable `Int16Array` of that length named `frameBuffer`, a fill index named **`frameFill`**, and a running sum-of-squares accumulator named `frameSumSq`. Use those names literally. Do not name the fill index `currentFrameIndex` or anything else containing `currentFrame` - the scope gate below greps this file for that substring to prove the audio-thread globals are gone, and such a field name would fail WORKLET_SCOPE_CLEAN for no reason. Replace the current "convert the whole output then post it" tail with a loop over the post-resample float samples that, for each sample: clamps to [-1, 1], adds the square of the clamped value to the accumulator, writes the standard asymmetric int16 quantization into the frame buffer at the fill index, and increments. When the fill index reaches the frame size, compute the level as the square root of the accumulator divided by the frame size, copy the frame buffer into a fresh `Int16Array` (a fresh one is required because the buffer is transferred), post it as `{ pcmBuffer, level }` with the same transfer-list zero-copy form the file already uses, then reset the fill index and the accumulator to zero. The loop must handle an output block longer than the remaining frame space by emitting more than one frame in a single `process()` call. Any partial frame at the end of a call is retained across calls in the buffer - that carry is the point (see D-09 for the trailing partial frame at stop, which is deliberately dropped).

Add the anti-aliasing low-pass. In the constructor, when and only when `resampleRatio > 1.01`, compute coefficients for a 4th-order Butterworth low-pass at 7000Hz as two cascaded RBJ-cookbook biquad sections against `this.inputRate`, using Q values 0.5411961 and 1.3065630. For each section: `w0` is two-pi times cutoff over input rate; `alpha` is `sin(w0)` over twice Q; the numerator coefficients are `(1 - cos(w0)) / 2`, `1 - cos(w0)`, `(1 - cos(w0)) / 2`; the denominator coefficients are `1 + alpha`, `-2 * cos(w0)`, `1 - alpha`; divide all five stored coefficients by the leading denominator term so it drops out of the difference equation. Store the coefficients as plain number fields (or one small `Float64Array` allocated once), and store Direct Form I state as two previous inputs and two previous outputs per section - eight numbers total, allocated once in the constructor and carried across `process()` calls exactly the way `resampleBuffer` already is. Set a boolean field recording whether the filter is active so `process()` does not re-test the ratio.

Apply the filter inside the existing resample branch, before the samples are appended for interpolation, never on the ratio-1 path. Do not filter in place into `input[0]`: when the source is mono, `monoData` aliases the graph's own render-quantum buffer. Allocate a scratch `Float32Array` once in the constructor sized for a 128-sample quantum, grow it only if a call ever presents more, and write the filtered samples there. Run the two sections in series - section one over the scratch, then section two over the same scratch - so state stays per-section and per-call ordering is preserved.

**Length discipline around the scratch buffer.** The scratch is sized to a high-water mark and is therefore frequently *longer* than the current quantum, so every consumer must be bounded by `monoData.length`, never by `scratch.length`. Concretely: size `combined` as `this.resampleBuffer.length + monoData.length` as it is sized today, and append with `combined.set(scratch.subarray(0, monoData.length), this.resampleBuffer.length)`. Passing the whole scratch would drag the stale tail of a previous, longer quantum into the stream as a burst of repeated audio, and because `set` would then overrun `combined` it would also throw a RangeError. Filter only indices `0` through `monoData.length - 1` for the same reason.

Create `tests/unit/pcmCaptureProcessor.test.ts`. Build a loader helper that reads the worklet file text with `node:fs`, creates a `node:vm` context whose sandbox supplies a minimal `AudioWorkletProcessor` base class exposing a `port` object with a `postMessage` that pushes `{ pcmBuffer, level }` onto a captured array (accepting and ignoring the transfer-list second argument), a `registerProcessor` that captures the class, and a `sampleRate` global; runs the file text in that context with `vm.runInContext`; and returns a factory that constructs the captured class with a given `processorOptions.inputSampleRate` alongside the capture array. Read posted buffers from the outer realm with a plain `new Int16Array(pcmBuffer)` view - cross-realm ArrayBuffers view fine. Add a helper that feeds N quanta by calling `process([[chunk]], [], {})` with 128-sample `Float32Array`s produced by a caller-supplied generator function of absolute sample index.

Write the six cases from `<behavior>`. For the aliasing case, generate the 12000Hz and 1000Hz sines at amplitude 0.5 against the 48000Hz input rate, feed enough quanta to yield at least six frames, discard the first frame from each run to let the filter settle, and compare the mean of the remaining per-frame `level` values; assert the 12kHz mean is below 0.35 times the 1kHz mean and that the 1kHz mean exceeds 0.30 (0.5 amplitude implies an unattenuated RMS near 0.354). For the bit-exact case, feed a deterministic non-trivial ramp at 16000Hz and compare every emitted sample against the same quantization formula applied to the input, with no tolerance.
  </action>
  <verify>
    <automated>node --check public/pcm-capture-processor.js</automated>
    <automated>npx vitest run tests/unit/pcmCaptureProcessor.test.ts</automated>
    <automated>test -z "$(grep -n 'require(\|^import \|currentTime\|currentFrame\|document\.\|window\.' public/pcm-capture-processor.js)" &amp;&amp; echo WORKLET_SCOPE_CLEAN</automated>
    <automated>npx eslint tests/unit/pcmCaptureProcessor.test.ts</automated>
  </verify>
  <done>The worklet posts fixed 480-sample / 960-byte frames at both 48kHz and 16kHz input, each carrying the RMS of that exact frame; system audio above the target Nyquist is attenuated by roughly 19dB before decimation while 1kHz passes essentially untouched; the 16kHz mic path is bit-exact against the pre-change quantization; the file still parses standalone and references no global outside the AudioWorklet scope; all four gates pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Throttle the renderer audio-meter setState without throttling audio transmission</name>
  <files>src/components/UnifiedPanel/audioLevelThrottle.ts, src/components/UnifiedPanel/useAudioCapture.ts, tests/unit/audioLevelThrottle.test.ts</files>
  <read_first>src/components/UnifiedPanel/useAudioCapture.ts lines 22-45 and 105-130; src/components/UnifiedPanel/UnifiedPanel.tsx lines 395-400 and 735-745; src/components/UnifiedPanel/AudioSourceSelector.tsx lines 55-75</read_first>
  <behavior>
    - The first level a fresh throttle sees always passes.
    - A level arriving less than 50ms after the last accepted one, on the same side of the 0.01 visibility threshold, is rejected.
    - A level arriving 50ms or more after the last accepted one is accepted.
    - A level that crosses 0.01 upward is accepted immediately regardless of elapsed time - speech onset must never wait.
    - A level that crosses 0.01 downward is accepted immediately - the "no audio" affordance must not linger.
    - Feeding a 33Hz stream of steady above-threshold levels for one simulated second yields 17 acceptances of 33 - they land at t = 0, 60, 120 ... 960 - not 33 and not 1.
    - The throttle does not burst after an idle gap: a 5000ms jump followed by 33 frames at 30ms still accepts 17, not 33. This is the property that rules out a catch-up accumulator (D-10).
    - Each throttle instance is independent: two instances do not share timestamps.
  </behavior>
  <action>
Create `src/components/UnifiedPanel/audioLevelThrottle.ts` as a dependency-free module in the repo's named-export style. Export `AUDIO_LEVEL_UI_INTERVAL_MS` (50 - a minimum spacing, so at most 20Hz and ~17Hz against the worklet's 33Hz frames; see D-10, and do not describe it as a fixed 20Hz) and `AUDIO_LEVEL_UI_THRESHOLD` (0.01) as constants, with the threshold's JSDoc naming the four consuming call sites in `UnifiedPanel.tsx` and `AudioSourceSelector.tsx` that compare against this same number so a future edit knows they must move together. Export a factory `createAudioLevelThrottle` taking an optional options object with `intervalMs` and `threshold` (defaulting to those constants) and returning a closure of shape `(level: number, nowMs: number) => boolean`. The closure holds the last accepted level and the last accepted timestamp, both starting unset. It returns true when nothing has been accepted yet, when the incoming level and the last accepted level fall on opposite sides of the threshold, or when at least `intervalMs` has elapsed since the last accepted timestamp; otherwise false. On every true it records the level and stores the timestamp as **`lastAccepted = nowMs`** - assign the observed clock value, never `lastAccepted += intervalMs`. That distinction is load-bearing, not stylistic: the accumulator form bursts after an idle gap and is rejected in D-10. Keep it pure with respect to module state - all state lives in the closure, so instances are independent.

In `src/components/UnifiedPanel/useAudioCapture.ts`, add a ref holding the throttle closure and assign a freshly created one at the top of `startAudioCapture`, so a new capture session never inherits a stale timestamp. In `processor.port.onmessage`, gate only the `setLocalAudioLevel(level)` call behind the throttle, evaluated with `performance.now()`. Leave everything else in the handler untouched and in the same order: the `isActiveRef.current` early return, the base64 encoding, and the `liveInterviewSendAudio` call must all still run on every single message. Do not move the throttle check above the early return and do not let it short-circuit the send - the throttle governs React rendering only, never the audio path. Leave the direct `setLocalAudioLevel(0)` in `stopAudioCapture` unthrottled so the meter always resets to zero on stop; clear the ref there as well.

Create `tests/unit/audioLevelThrottle.test.ts` covering the eight cases in `<behavior>`. Drive time by passing explicit `nowMs` values rather than by faking timers - the closure takes the clock as an argument precisely so the test does not need one. For the 33Hz case, loop 33 times with `nowMs` at exactly `i * 30` at a constant level of 0.2 and assert the acceptance count lands in a **16-18** band. Do not assert 19-21: with `lastAccepted = nowMs` the accepts fall at t = 0, 60, 120 ... 960, which is exactly 17. For the anti-burst case, prime the throttle at t = 0, then loop 33 times at `5000 + i * 30` and assert the count is again in the 16-18 band - under the rejected accumulator form this case returns 33, so it is the test that pins the rule.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json</automated>
    <automated>npx vitest run tests/unit/audioLevelThrottle.test.ts</automated>
    <automated>test "$(grep -c 'liveInterviewSendAudio' src/components/UnifiedPanel/useAudioCapture.ts)" -eq 1 &amp;&amp; echo SEND_PATH_INTACT</automated>
    <automated>npx eslint src/components/UnifiedPanel/audioLevelThrottle.ts src/components/UnifiedPanel/useAudioCapture.ts tests/unit/audioLevelThrottle.test.ts</automated>
  </verify>
  <done>The audio meter setState is spaced at least 50ms apart (~17 of every 33 frames) with an immediate override on either crossing of the 0.01 visibility threshold, and does not burst after an idle gap; every worklet frame still reaches liveInterviewSendAudio unthrottled; the decision rule is a pure node-testable module with eight passing cases; the meter still resets to zero on stop; all four gates pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Renderer (AudioWorklet + hook) -> Electron main via `live-interview-send-audio` | The renderer supplies an attacker-influenceable base64 string and a numeric level; main decodes the string with `Buffer.from(pcmBase64, 'base64')` and forwards the bytes to a remote websocket |
| Electron main -> `generativelanguage.googleapis.com` Live API websocket | Audio frames and a JSON setup message cross to a third party |
| Captured system/application audio -> the app | The audio content itself is untrusted media from an arbitrary source (a shared screen, another application) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-QUICK-01 | Denial of Service | `LiveInterviewService.receiveAudio` / `liveInterviewSendAudio` IPC | medium | mitigate | The frame buffering in Task 2 cuts inbound IPC calls ~11x on 48kHz sources and the Task 1 status throttle cuts the return path from ~375/sec to 10/sec, materially reducing the self-inflicted IPC pressure that this handler is subject to. Message *size* per call rises to ~1280 base64 chars, which stays far below any practical IPC payload limit. |
| T-QUICK-02 | Denial of Service | `useAudioCapture` -> React state | medium | mitigate | The 50ms-spacing throttle in Task 3 (~17Hz in practice) removes a ~375Hz `setState` that forces a render pass on the panel tree; a hostile or merely loud audio source can no longer drive render churn through the meter. |
| T-QUICK-03 | Information Disclosure | Widened `prefixPaddingMs` (100 -> 400) sends 300ms more pre-onset audio to Google per turn | low | accept | The look-back is drawn from the same stream the user has already consented to stream for transcription; it captures ambient room audio immediately preceding speech, which was already being streamed continuously - the padding only changes which slice the server attributes to the turn, not what is transmitted. |
| T-QUICK-04 | Tampering | Untrusted media content driving the new biquad filter state | low | accept | The filter is a fixed-coefficient IIR over clamped float samples with no allocation, no indexing derived from sample values, and no branch on content. Denormal-driven slowdown is the only theoretical content-dependent cost and is not reachable at these coefficients and this sample scale. Output is clamped to [-1, 1] before quantization, so IIR ringing cannot overflow the int16 conversion. |
| T-QUICK-05 | Denial of Service | `node:vm` context in `tests/unit/pcmCaptureProcessor.test.ts` | low | accept | The vm runs a first-party file from this repository, not untrusted input; it is a test-scope isolation convenience, not a security boundary, and ships in no build output. |
| T-QUICK-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no packages and adds no dependencies. `node:fs` and `node:vm` are Node built-ins; `jsdom`, `vitest` and `@testing-library/*` are already in `devDependencies` and none are newly introduced. The supply-chain surface is unchanged, so no Package Legitimacy Gate applies. |
</threat_model>

<deferred>
Explicitly out of scope for this plan, each with the reason it was excluded rather than forgotten:

1. **`startOfSpeechSensitivity` / `endOfSpeechSensitivity` remain `*_LOW`** (D-02). Raising them trades clipped phrases for phantom turns triggered by room noise and keyboard clatter. It needs a live A/B against real interview audio, not a config edit. Revisit only if human verification shows the head of a phrase is *still* clipped after 400ms of prefix padding.
2. **Explicit Live API activity control stays off** (D-03). `activityStart` / `activityEnd` are incompatible with `automaticActivityDetection` and produce a 1007 disconnect. The no-op method and its doc comment are retained as the record of that.
3. **The trailing sub-frame at capture stop is dropped** (D-09). Up to 29ms of audio following the user's last word. Flushing it needs a stop-signal path into the worklet for audio that is by definition trailing silence or a word tail already past the VAD boundary.
4. **`useAudioCapture` itself is not unit-tested.** The hook needs `AudioContext`, `AudioWorkletNode`, `audioWorklet.addModule` and `navigator.mediaDevices` faked, and the repo's vitest environment is `node`. The interesting logic was extracted to `audioLevelThrottle.ts` instead (D-08); the remaining wiring is covered by human verification item 4.
5. **Task 1 is not split into a fourth task**, despite bundling three independent changes (VAD constants, dead-path removal, status throttle) such that a throttle failure could block the trivially-safe constant change. The task budget for this quick task is hard-capped at 3, and splitting by layer - which is what keeps every task's files disjoint - is the more valuable axis. Mitigated instead by the mandatory three-step commit ordering at the top of Task 1's action, which delivers the same "safe change lands first" property without a fourth task.
6. **No change to `AUDIO_SILENCE_LEVEL` (0.01).** The RMS scale is unchanged by this plan - only the averaging window moves from a cached 50ms value to the exact 30ms frame - so the threshold keeps its meaning. Retuning it would need field data on the new per-frame distribution.
</deferred>

<verification>
Run after all three tasks:

1. `npx vitest run` - full suite green. Baseline was green before this plan, so any failure is attributable to these changes.
2. `npx tsc --noEmit -p tsconfig.electron.json` - clean.
3. `npx tsc --noEmit -p tsconfig.json` - clean.
4. `node --check public/pcm-capture-processor.js` - the worklet's only syntax gate, since `eslint.config.mjs` explicitly ignores that file.
5. `npx eslint .` - clean across everything eslint does cover.
6. Dead-path sweep: a grep for the removed silence-debounce identifiers across `electron/`, `src/` and `tests/` returns nothing, and a grep for the turn-ending method name **across production code only (`electron/` and `src/`)** returns matches only inside `electron/audio/GeminiLiveService.ts`. The caller sweep deliberately excludes `tests/`: Task 1's replacement test installs a `vi.spyOn` on that very method to prove it is never invoked, so the literal must exist in the test tree. Sweeping `tests/` would make the gate unpassable by construction.

**Do NOT run `npm run dev`, `npm run start`, `npm run build`, or `npm run clean`.** The Electron app is running in this session under `tsc -w` and `vite`; `npm run dev` and `npm run build` both begin with `npm run clean`, which deletes `dist-electron` out from under the live process. The `--noEmit` typecheck variants above are the safe equivalents and write nothing.

**Neither typecheck covers the test files.** `tsconfig.json` includes only `electron/**/*` and `src/**/*`; `tsconfig.electron.json` includes only `electron/**/*`. Verified empirically with `npx tsc -p <cfg> --listFiles --noEmit`: both programs contain **zero** files under `tests/`. So the three test files this plan creates or edits are checked by vitest (which transpiles without typechecking) and by eslint (whose config sets no `parserOptions.project`, so no type-aware rules run) - and by nothing else. The `as unknown as` cast idiom prescribed in Task 1 is therefore *unverified* by the compiler: if a cast names a field that does not exist, or the shape drifts, nothing reports it and the assertion silently reads `undefined`. Executors must not assume type coverage here. Where a test asserts against a private field or method, assert on an observable consequence too, so a broken cast fails loudly rather than comparing `undefined` to `undefined`.

**What these gates cannot prove.** None of the six gates demonstrates that phrases stop clipping, that transcription accuracy improves, or that the meter looks right - those are properties of live audio through a remote service and are covered in `<human_verification>` instead. The gates prove the mechanism (frame sizes, filter attenuation, threshold behavior, absence of the dead path, config values reaching the wire); the human items prove the outcome.
</verification>

<human_verification>
Requires the running app plus a live Gemini key. Restart the app after execution so the rebuilt main process and the new worklet file are both loaded.

1. **Tail clipping (the primary bug).** Speak a sentence with a deliberate ~1 second pause in the middle, e.g. "So my approach would be ... [pause] ... to use a hash map for the lookup." Confirm the transcript keeps it as one continuous thought and the hint fires after the full sentence, not after the first half.
2. **Head clipping.** Start speaking abruptly from silence with a hard consonant, e.g. "Kubernetes handles that." Confirm the first word arrives intact in the transcript rather than as a fragment.
3. **Aliasing on system audio.** Play a video with clear speech through the system-audio source. Compare the transcript against what you hear - the previous build folded everything above 8kHz into the speech band as broadband hash, so sibilants and consonant clarity are where a difference will show. Confirm no regression, and ideally an improvement, in consonant-heavy words.
4. **Meter responsiveness (the regression risk from buffering).** Watch the level indicator in the UnifiedPanel while speaking normally. It must move visibly and promptly - not freeze, not step in visible jumps, and not stay dark during the first word. If it looks sluggish at speech onset, the threshold-crossing override in Task 3 is not firing.
5. **No-signal round trip.** Mute or stop the audio source for more than 4 seconds and confirm the `no_signal` indicator appears; then speak and confirm it clears back to `listening` promptly.
6. **Traffic reduction (quantitative).** In the Electron log, find the `GeminiLiveService: [STATS] audioSent=` lines, which report per 3-second window. Before this change, 48kHz system audio produced roughly 1100 per window. Expect roughly 100 now. A number still in the high hundreds means the worklet frame buffering is not active - most likely the app is serving a cached copy of the old `public/pcm-capture-processor.js`, so hard-reload the renderer.
7. **Dead path silent.** Search the same log for the forced-turn-ending message that the removed debounce used to print. It must never appear.
</human_verification>

<success_criteria>
- The Live API is configured with a 1200ms silence window and 400ms prefix padding, from named constants, with a test asserting the silence window stays below `HINT_TRIGGER_SILENCE_MS`.
- The local silence-debounce apparatus is fully removed and no production code path in `electron/` or `src/` calls the no-op turn-ender (the test tree still names it, by design, to assert it is never invoked); the method and its explanatory doc comment survive as the record of why explicit activity control is forbidden.
- `AUDIO_SILENCE_LEVEL` and the `no_signal` indicator still work, proven by a behavioral test rather than by inspection.
- Audio leaves the worklet in fixed 480-sample / 960-byte / 30ms frames at both 48kHz and 16kHz input, carrying the RMS of that exact frame.
- System and application audio is attenuated ~19dB at 12kHz before decimation while 1kHz passes essentially untouched, proven by a spectral-energy assertion.
- The 16kHz microphone path is bit-exact against the pre-change quantization, proven with no tolerance.
- UI meter updates are spaced at least 50ms apart (~17 of every 33 frames, never bursting after an idle gap) with an immediate override on either crossing of the 0.01 visibility threshold, and main-process status emission is 10Hz for level-only changes while state transitions still emit immediately.
- Every produced audio frame still reaches `liveInterviewSendAudio` and `sendAudio` - neither throttle touches the audio path.
- Full suite, both typecheck targets, `node --check` on the worklet, `npx eslint .`, and both dead-path grep sweeps all pass.
</success_criteria>

<output>
Create `.planning/quick/260827-tlv-fix-audio-phrase-clipping-tune-live-api-/260827-tlv-SUMMARY.md` when done.
</output>
