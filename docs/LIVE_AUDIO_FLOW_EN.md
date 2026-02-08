# Live Audio Flow (EN)

This document describes the current real-time interview pipeline and state machine.

## Relevant Files

- Renderer control and capture: `src/components/UnifiedPanel/UnifiedPanel.tsx`
- Audio worklet: `public/pcm-capture-processor.js`
- IPC handlers: `electron/ipcHandlers.ts`
- Orchestration service: `electron/audio/LiveInterviewService.ts`
- Gemini Live transport: `electron/audio/GeminiLiveService.ts`
- Hint generation stream: `electron/audio/HintGenerationService.ts`

## End-to-End Data Path

1. Renderer selects audio source (system/microphone/application).
2. Renderer creates `AudioContext` and `AudioWorkletNode`.
3. Worklet emits PCM chunks + current level.
4. Renderer base64-encodes PCM and calls `live-interview-send-audio`.
5. Main forwards audio to `LiveInterviewService.receiveAudio(...)`.
6. `LiveInterviewService` forwards audio to `GeminiLiveService.sendAudio(...)`.
7. Gemini Live sends incremental transcript tokens.
8. Transcript accumulates in `LiveInterviewService.currentTranscript`.
9. Hint generation triggers on turn completion or silence fallback.
10. Status updates are pushed to renderer via `live-interview-status` and `live-interview-state`.

## Listening State Machine

Defined states:

- `idle`
- `connecting`
- `listening`
- `no_signal`
- `transcribing`
- `generating`
- `error`

Typical transitions:

- `idle -> connecting -> listening`
- `listening -> transcribing` when transcript tokens arrive
- `transcribing -> generating` when hint trigger conditions pass
- `generating -> listening` when hint stream completes
- `listening -> no_signal` when silence timeout is reached
- Any state -> `error` on transport/auth/service failures

## Turn Finalization Logic

Current safeguards in `LiveInterviewService`:

- Hold window in `transcribing`: `TRANSCRIBE_HOLD_MS = 2000`
- Silence auto-trigger: `HINT_TRIGGER_SILENCE_MS = 1500`
- Minimal meaningful transcript delta check before hint generation
- Queued hint generation if previous hint is still active
- Transcript clear after response silence window: `TRANSCRIPT_CLEAR_MS = 5000`

## Why "Phrase Stuck" Can Still Happen

Even with fallback logic, transcripts may appear stuck when:

- Live API does not emit a reliable `turnComplete` for a speech segment.
- Audio level remains above silence threshold due background noise.
- Transcript delta is too small to pass meaningful-character gate.
- User pauses are shorter than trigger windows during noisy capture.

## Practical Stabilization Plan

### P0: Robust End-of-Utterance Detection

1. Add dual-threshold VAD at renderer side (speech onset and speech end).
2. Track `lastNonSilentAt` and force turn end after sustained low signal.
3. Explicitly call `GeminiLiveService.endTurn()` when local VAD confirms utterance end.

### P1: Trigger Policy Hardening

1. Add max-latency failsafe: if transcript changed and no hint in `N` ms, force generation.
2. Make `MIN_MEANINGFUL_NEW_CHARS_FOR_HINT` dynamic by language.
3. Record reason codes for each trigger (`turnComplete`, `silenceFallback`, `forcedTimeout`).

### P1: Better User Feedback

1. Show per-state age timer in UI (how long state is active).
2. Show explicit "waiting for end of phrase" sub-state.
3. Surface quick action when state is stale: "Send now".

### P2: Observability

1. Emit structured logs for state transitions and trigger decisions.
2. Persist recent live-session diagnostics for postmortem.
3. Add replayable integration tests with synthetic audio/noise patterns.

## Debug Checklist

1. Verify renderer actually sends chunks while user speaks.
2. Verify audio level crosses silence threshold after user stops.
3. Verify transcript is still changing or has stabilized.
4. Verify hint trigger path executed (`turnComplete` or silence fallback).
5. Verify hint service was not already active and blocking new request.

## Acceptance Criteria for Fixes

- After user stops speaking, hint generation starts within target latency (for example <= 2.0s) in quiet conditions.
- In noisy conditions, forced turn-end logic still produces a response without manual restart.
- No duplicate hint bursts for one utterance.
- No silent hangs where transcript is non-empty but no generation starts.
