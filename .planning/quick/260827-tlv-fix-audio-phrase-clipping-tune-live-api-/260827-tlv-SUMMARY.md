---
phase: quick-260827-tlv
plan: 01
subsystem: audio
tags: [audio, audioworklet, gemini-live, dsp, ipc, electron, react, vad]

requires:
  - phase: existing live-interview pipeline
    provides: GeminiLiveService, LiveInterviewService, pcm-capture-processor worklet, useAudioCapture hook
provides:
  - Live API VAD tuned to interview speech rhythm (1200ms silence window, 400ms look-back) from named constants
  - Cross-module invariant test pinning the silence window below HINT_TRIGGER_SILENCE_MS
  - Removal of the dead local end-of-turn debounce apparatus
  - 10Hz main-process status emission with an immediate override on state transitions
  - Fixed 30ms / 480-sample worklet framing with per-frame RMS
  - 4th-order Butterworth anti-aliasing low-pass before 48kHz to 16kHz decimation
  - node:vm test harness that makes the AudioWorklet unit-testable without jsdom or a real AudioContext
  - Pure, node-testable renderer audio-meter throttle module
affects: [live-interview, audio-capture, transcription-quality, unified-panel]

tech-stack:
  added: []
  patterns:
    - "AudioWorklet under test via node:vm with a faked AudioWorklet scope (AudioWorkletProcessor / registerProcessor / sampleRate)"
    - "Throttles that force-emit on a state or threshold transition rather than being pure time gates"
    - "Floor-gate throttling (lastAccepted = now) over catch-up accumulators, to make post-idle bursts impossible"
    - "Extracting decision rules out of React hooks into pure modules so they are testable under a node vitest environment"

key-files:
  created:
    - public/pcm-capture-processor.js (rewritten in place)
    - src/components/UnifiedPanel/audioLevelThrottle.ts
    - tests/unit/geminiLiveSetup.test.ts
    - tests/unit/pcmCaptureProcessor.test.ts
    - tests/unit/audioLevelThrottle.test.ts
  modified:
    - electron/audio/GeminiLiveService.ts
    - electron/audio/LiveInterviewService.ts
    - src/components/UnifiedPanel/useAudioCapture.ts
    - tests/integration/liveInterviewLifecycle.integration.test.ts

key-decisions:
  - "silenceDurationMs 500 -> 1200 and prefixPaddingMs 100 -> 400, hoisted into public named constants (D-01)"
  - "startOfSpeechSensitivity / endOfSpeechSensitivity stay *_LOW - raising them trades clipped phrases for phantom turns and needs a live A/B (D-02)"
  - "GeminiLiveService.endTurn() kept as a documented zero-caller no-op; its doc comment is the record of why explicit activity control is forbidden (D-03)"
  - "480-sample / 30ms frames - ~33 sends/sec, an 11x reduction from 48kHz system audio (D-04)"
  - "4th-order Butterworth at 7000Hz as two cascaded RBJ biquads: ~19dB at 12kHz, allocation-free, no tap table (D-05)"
  - "Filter gated on resampleRatio > 1.01 so the 16kHz mic path is provably bit-exact, not merely within tolerance (D-06)"
  - "Two independent throttles, neither of which ever gates the audio path (D-07)"
  - "UI throttle extracted as a pure module because the hook is untestable under the node vitest environment (D-08)"
  - "Floor gate rather than catch-up accumulator - the accumulator accepts 33 of 33 after a 5s idle gap (D-10)"

patterns-established:
  - "node:vm worklet harness: contextify a sandbox with the three permitted AudioWorklet globals, run the file text, read cross-realm ArrayBuffers with a plain Int16Array view"
  - "Mutation-check load-bearing test cases: temporarily remove the branch under test and confirm the case fails, so the assertion is proven non-vacuous"
  - "Throttle + transition override: any throttle sitting in front of the sole publisher of a state change must force-emit on that change"

requirements-completed: [QUICK-260827-tlv]

coverage:
  - id: D1
    description: "Live API VAD widened to a 1200ms silence window and 400ms prefix padding, sourced from named constants, with the silence window pinned below HINT_TRIGGER_SILENCE_MS"
    requirement: "QUICK-260827-tlv"
    verification:
      - kind: unit
        ref: "tests/unit/geminiLiveSetup.test.ts#sends widened VAD windows with sensitivities left at their LOW values"
        status: pass
      - kind: unit
        ref: "tests/unit/geminiLiveSetup.test.ts#keeps the Live API silence window below the hint-trigger fallback window"
        status: pass
    human_judgment: false
  - id: D2
    description: "The dead local end-of-turn debounce is fully removed and no production path calls the no-op turn-ender; AUDIO_SILENCE_LEVEL and the no_signal round trip still work"
    requirement: "QUICK-260827-tlv"
    verification:
      - kind: integration
        ref: "tests/integration/liveInterviewLifecycle.integration.test.ts#never ends the turn locally - the Live API owns turn boundaries"
        status: pass
      - kind: integration
        ref: "tests/integration/liveInterviewLifecycle.integration.test.ts#still reports no_signal after prolonged silence and recovers on speech"
        status: pass
      - kind: other
        ref: "grep sweep: NO_CALLERS + DEAD_PATH_GONE gates over electron/ src/ tests/"
        status: pass
    human_judgment: false
  - id: D3
    description: "Main-process status emission throttled to 10Hz for level-only changes, with an immediate emit on a state transition inside receiveAudio"
    requirement: "QUICK-260827-tlv"
    verification:
      - kind: integration
        ref: "tests/integration/liveInterviewLifecycle.integration.test.ts#throttles audio-level-only status emission"
        status: pass
      - kind: integration
        ref: "tests/integration/liveInterviewLifecycle.integration.test.ts#emits immediately on a state transition even while the time gate is closed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Worklet emits fixed 480-sample / 960-byte / 30ms frames at both 48kHz and 16kHz input, each carrying the RMS of that exact frame"
    requirement: "QUICK-260827-tlv"
    verification:
      - kind: unit
        ref: "tests/unit/pcmCaptureProcessor.test.ts#posts exactly three 960-byte frames for 36 quanta at 48kHz"
        status: pass
      - kind: unit
        ref: "tests/unit/pcmCaptureProcessor.test.ts#posts exactly three 960-byte frames for 12 quanta at 16kHz"
        status: pass
      - kind: unit
        ref: "tests/unit/pcmCaptureProcessor.test.ts#reports the RMS of the frame actually posted, not a stale cached value"
        status: pass
    human_judgment: false
  - id: D5
    description: "System/application audio is low-passed below the 8kHz target Nyquist before decimation, while the 16kHz mic path stays bit-exact"
    requirement: "QUICK-260827-tlv"
    verification:
      - kind: unit
        ref: "tests/unit/pcmCaptureProcessor.test.ts#attenuates 12kHz far below 1kHz instead of folding it into the speech band"
        status: pass
      - kind: unit
        ref: "tests/unit/pcmCaptureProcessor.test.ts#leaves the 16kHz microphone path bit-exact - no filter, no resample"
        status: pass
    human_judgment: false
  - id: D6
    description: "Renderer audio-meter setState spaced at least 50ms apart with an immediate override on either crossing of the 0.01 threshold, never bursting after an idle gap, while every frame still reaches liveInterviewSendAudio"
    requirement: "QUICK-260827-tlv"
    verification:
      - kind: unit
        ref: "tests/unit/audioLevelThrottle.test.ts (8 cases)"
        status: pass
      - kind: other
        ref: "grep gate: SEND_PATH_INTACT over src/components/UnifiedPanel/useAudioCapture.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Phrases stop clipping at both ends and transcription quality improves against live audio through the remote Live API"
    verification: []
    human_judgment: true
    rationale: "Turn-boundary behavior and transcript accuracy are properties of live speech through a remote service. The automated gates prove the mechanism (wire config values, frame sizes, filter attenuation, absence of the dead path); only a human speaking into the running app can confirm the outcome. See the plan's <human_verification> items 1-7."

# Metrics
duration: 18min
completed: 2026-08-27
status: complete
---

# Quick Task 260827-tlv: Fix Audio Phrase Clipping / Tune Live API Summary

**Four independent defects in the renderer-worklet to Live API chain fixed together: VAD windows widened so a thinking pause no longer splits a sentence, a dead end-of-turn debounce removed, per-quantum IPC replaced with 30ms framing (~11x less traffic), and 48kHz decimation given the anti-aliasing filter it never had.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-27T21:45Z
- **Completed:** 2026-08-27T22:03Z
- **Tasks:** 3 of 3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- **Tail clipping fixed at the source.** The Live API's silence window went from 500ms to 1200ms, so a normal 0.7-1.5s interview thinking pause no longer closes the turn mid-sentence. A cross-module test pins the new value strictly below `LiveInterviewService.HINT_TRIGGER_SILENCE_MS` (1500), so `turnComplete` stays the primary hint trigger and the transcript-silence fallback stays a fallback. A future edit to either number now fails the suite instead of silently reordering the triggers.
- **Head clipping fixed.** Prefix padding went from 100ms to 400ms, enough look-back to absorb `START_SENSITIVITY_LOW`'s own detection lag on top of the first syllable.
- **~11x less IPC traffic in each direction.** The worklet now posts fixed 480-sample / 960-byte / 30ms frames (~33/sec) instead of one message per 128-sample render quantum (~375/sec on 48kHz system audio), and the main process's return path went from an emit-per-chunk to 10Hz. The frame boundary also replaced the old 50ms wall-clock level throttle, so the reported level is now the RMS of the exact frame being sent rather than a value cached across ~19 consecutive chunks.
- **Aliasing eliminated on system and application audio.** A 4th-order Butterworth at 7000Hz (two cascaded RBJ biquads, allocation-free, state carried across `process()` calls) runs before decimation. A 12kHz tone that previously folded to 4kHz as broadband hash now measures below 12% of an equal-amplitude 1kHz tone. The 16kHz microphone path is provably untouched - asserted bit-exact against the pre-change quantization with no tolerance.
- **A dead code path with real cost removed.** The local silence debounce armed a `setTimeout` on every single audio chunk only to call a method that has been a documented no-op since automatic activity detection was enabled. Gone, with an existing test that asserted the old behavior replaced by its inverse.
- **The AudioWorklet is now unit-testable.** `tests/unit/pcmCaptureProcessor.test.ts` loads the real worklet file through `node:vm` with a faked AudioWorklet scope - no jsdom, no real `AudioContext`. Frame counts, filter response, and bit-exact mic passthrough are all provable in CI.

## Task Commits

Task 1 was committed in three mandated steps (safest change first), per the plan's ordering requirement:

1. **Task 1 step 1: Tune Live API VAD** - `6b4c38f` (fix)
2. **Task 1 step 2: Remove the dead local end-of-turn path** - `0069d62` (refactor)
3. **Task 1 step 3: Throttle status emission to 10Hz** - `66aeb37` (perf)
4. **Task 2: Buffer the worklet into 30ms frames with anti-aliasing** - `19322cf` (perf)
5. **Task 3: Throttle the renderer audio meter** - `7c8124c` (perf)

**Plan metadata:** handled by the orchestrator (docs commit).

## Files Created/Modified

**Created:**

- `src/components/UnifiedPanel/audioLevelThrottle.ts` - Pure `(level, nowMs) => boolean` throttle factory with a 50ms floor gate and a threshold-crossing override. Documents the four UI call sites that compare against the same 0.01 constant.
- `tests/unit/geminiLiveSetup.test.ts` - Asserts the five `automaticActivityDetection` fields and `activityHandling` that actually reach the wire, plus the cross-module invariant against `HINT_TRIGGER_SILENCE_MS`.
- `tests/unit/pcmCaptureProcessor.test.ts` - `node:vm` harness plus six cases: frame counts at both input rates, bit-exact mic passthrough, 12kHz attenuation, per-frame level tracking, and a scope check.
- `tests/unit/audioLevelThrottle.test.ts` - Eight cases including the anti-burst case that pins the floor-gate rule.

**Modified:**

- `public/pcm-capture-processor.js` - Rewritten in place: frame buffering, per-frame RMS, cascaded biquad low-pass on the resample path only, scratch buffer bounded by `monoData.length`. Still plain AudioWorklet-scope JavaScript with no imports.
- `electron/audio/GeminiLiveService.ts` - `VAD_SILENCE_DURATION_MS` / `VAD_PREFIX_PADDING_MS` public constants wired into `sendSetup`; `endTurn()`'s doc comment now records that it has zero callers.
- `electron/audio/LiveInterviewService.ts` - Debounce apparatus deleted (field, two timestamps, two constants, the scheduling method, its call site, and start/stop bookkeeping); `STATUS_EMIT_INTERVAL_MS` throttle added to `receiveAudio` with a state-change override.
- `src/components/UnifiedPanel/useAudioCapture.ts` - Throttle ref created fresh per capture session, gating only `setLocalAudioLevel`.
- `tests/integration/liveInterviewLifecycle.integration.test.ts` - The `forces endTurn after local silence` test replaced by its inverse, plus three new cases (no_signal round trip, emission throttling, state-change override).

## Decisions Made

All decisions were pre-recorded in the plan (D-01 through D-10) and followed exactly. Three worth restating because they shaped the implementation rather than just the config:

- **The status throttle needed a state-change override, not a plain time gate.** The trailing `emitStatus()` in `receiveAudio` is the sole publisher of the `no_signal -> listening` transition, because `setState` on that path does not emit on its own. A pure time gate would have made silence recovery invisible to the renderer for up to 100ms, or missed entirely.
- **The filter writes to a preallocated scratch, never in place.** When the source is mono, `monoData` aliases the audio graph's own render-quantum buffer - filtering in place would corrupt the graph. The scratch is sized to a high-water mark, so every read from it is bounded by `monoData.length`; using `scratch.length` would drag a stale tail from a previous, longer quantum into the stream.
- **Floor gate over catch-up accumulator for the UI throttle.** The two differ only by ~3Hz in steady state, but after an idle gap the accumulator lets 33 of 33 frames through in a burst - exactly the render churn the throttle exists to prevent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint `no-unused-vars` on the fake `postMessage` transfer-list parameter**

- **Found during:** Task 2 (worklet test harness)
- **Issue:** The plan specified a fake `port.postMessage` that "accepts and ignores the transfer-list second argument". This repo's ESLint config has no `argsIgnorePattern`, so the `_transfer` parameter failed the `npx eslint tests/unit/pcmCaptureProcessor.test.ts` gate.
- **Fix:** Made the argument load-bearing instead of ignored - the harness now records each transfer list and the 48kHz frame-count case asserts every frame is handed over in the zero-copy `[frame.buffer]` form. This satisfies the linter and adds a real assertion (the plan's `<behavior>` required preserving "the same transfer-list zero-copy form the file already uses", which was otherwise unverified).
- **Files modified:** `tests/unit/pcmCaptureProcessor.test.ts`
- **Verification:** `npx eslint tests/unit/pcmCaptureProcessor.test.ts` clean; the 6 worklet cases still pass.
- **Committed in:** `19322cf` (part of the Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1x Rule 3)
**Impact on plan:** None. The fix strengthened a test rather than weakening one. No scope creep; no plan behavior was skipped or altered.

## Issues Encountered

**Gate discrimination was pre-verified, then re-verified per step.** Before touching anything, all five grep gates were run against the pre-change tree: `NO_CALLERS`, `DEAD_PATH_GONE` and `WORKLET_SCOPE_CLEAN` failed (as the plan predicted they would), while `SILENCE_LEVEL_KEPT` and `SEND_PATH_INTACT` passed as regression guards. No gate had drifted.

**Three load-bearing assertions were mutation-checked** rather than trusted, because each one is the sole proof of a claim that would otherwise be easy to get vacuously right:

1. Deleting the `stateChanged` branch from `receiveAudio` fails the state-change override test. (Confirmed - the plan explicitly warned that a naively written version of this case passes either way.)
2. Disabling `applyLowPass` fails the 12kHz attenuation test. (Confirmed.)
3. Switching the throttle to a catch-up accumulator fails both the 33Hz case and the anti-burst case. (Confirmed - the accumulator accepted 33 of 33 after the idle gap, exactly as D-10 predicted.)

Each mutation was reverted immediately and the file verified restored before proceeding.

**No `npm run dev` / `build` / `clean` was run** - the app is live in this session under `tsc -w` and vite, and those scripts would wipe `dist-electron` out from under it. Only the `--noEmit` typecheck variants and `node --check` were used, per the plan's constraint.

## User Setup Required

None - no external service configuration required. The changes take effect on the next app restart (main process rebuild plus a renderer reload to pick up the new `public/pcm-capture-processor.js`).

## Verification Results

All six plan-level gates pass:

| # | Gate | Result |
|---|------|--------|
| 1 | `npx vitest run` | 85/85 passing, 11 files (baseline 65 - 20 new cases added) |
| 2 | `npx tsc --noEmit -p tsconfig.electron.json` | clean |
| 3 | `npx tsc --noEmit -p tsconfig.json` | clean |
| 4 | `node --check public/pcm-capture-processor.js` | clean |
| 5 | `npx eslint .` | clean |
| 6 | Dead-path sweep (`NO_CALLERS`, `DEAD_PATH_GONE`) | both pass |

Per-task gates (`SILENCE_LEVEL_KEPT`, `WORKLET_SCOPE_CLEAN`, `SEND_PATH_INTACT`) all pass. No files were deleted by any commit. Working tree clean apart from this plan directory.

**What these gates do not prove:** that phrases actually stop clipping, that transcription accuracy improved, or that the meter looks right. Those are properties of live audio through a remote service - see `<human_verification>` items 1-7 in the plan, and coverage deliverable D7.

## Known Stubs

None. No placeholder values, no skipped tests, no unrun `<verify>` gates - every automated gate in the plan was executed and passed.

## Self-Check: PASSED

**Files verified present:**

- `public/pcm-capture-processor.js` - FOUND
- `src/components/UnifiedPanel/audioLevelThrottle.ts` - FOUND
- `tests/unit/geminiLiveSetup.test.ts` - FOUND
- `tests/unit/pcmCaptureProcessor.test.ts` - FOUND
- `tests/unit/audioLevelThrottle.test.ts` - FOUND

**Commits verified in git log:**

- `6b4c38f` - FOUND
- `0069d62` - FOUND
- `66aeb37` - FOUND
- `19322cf` - FOUND
- `7c8124c` - FOUND
