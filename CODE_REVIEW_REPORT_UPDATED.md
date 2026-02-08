# Code Review Report: Follow-up Audit

**Date:** 2026-02-08  
**Scope:** Verification of fixes + Extended codebase audit  
**Previous Report:** CODE_REVIEW_REPORT.md

---

## Part 1: Fix Verification ✅

### Confirmed Fixes

| Issue | File | Status | Notes |
|-------|------|--------|-------|
| 1. Race condition in abort handling | `ProcessingHelper.ts` | ✅ **FIXED** | Added `signal.aborted` check on lines 165, 181 |
| 2. Memory leak in LiveInterviewService | `ipcHandlers.ts` | ✅ **FIXED** | Added `removeAllListeners()` on lines 761, 824 |
| 3. Missing error logging | `ipcHandlers.ts` | ✅ **FIXED** | Added `logger.error` on line 850 |
| 4. Typo in event constant | `preload.ts` | ✅ **FIXED** | `"processing-unauthorized"` correct on line 17 |
| 5. Async cleanup in useAudioCapture | `useAudioCapture.ts` | ✅ **FIXED** | `stopAudioCapture` is now async with `await` (line 31, 37) |
| 6. Synchronous fs calls | `screenshotPayloadLoader.ts` | ✅ **FIXED** | Now uses `fs.promises.access` and `fs.promises.readFile` |
| 7. Magic numbers | `ProcessingHelper.ts` | ✅ **FIXED** | Extracted to `INITIALIZATION_MAX_ATTEMPTS` and `INITIALIZATION_POLL_MS` |
| 8. IPC contract check timing | `ipcHandlers.ts` | ⚠️ **PARTIAL** | Still throws after registration, but acceptable for dev mode |

### Code Review: Fix Quality

**Excellent work on the fixes!** All critical issues have been properly addressed with clean implementations.

---

## Part 2: New Issues Discovered 🔍

### 🔴 HIGH PRIORITY

#### 1. Potential Memory Pressure in Audio Processing

**File:** `electron/audio/LiveInterviewService.ts` (line 400)

```typescript
public receiveAudio(pcmBase64: string, level: number): void {
    // ...
    if (this.geminiService?.isActive()) {
        const buffer = Buffer.from(pcmBase64, 'base64');  // ← Allocates on every chunk
        this.geminiService.sendAudio(buffer);
    }
}
```

**Issue:** Base64 decoding creates new Buffer allocations for every audio chunk. With 16kHz PCM audio at ~20ms chunks, this creates ~50 allocations per second, causing GC pressure.

**Recommendation:** Consider using a buffer pool or reusing buffers if possible. For now, monitor memory usage in long sessions.

---

#### 2. Unbounded Transcript Growth

**File:** `electron/audio/GeminiLiveService.ts` (line 235)

```typescript
if (serverContent.inputTranscription?.text) {
    const newText = serverContent.inputTranscription.text;
    if (newText) {
        this.currentTranscript += newText;  // ← Unbounded string concatenation
        // ...
    }
}
```

**Issue:** `currentTranscript` grows indefinitely during long sessions. With hours of transcription, this could consume significant memory.

**Recommendation:** Implement a transcript size limit or periodic truncation:
```typescript
private MAX_TRANSCRIPT_LENGTH = 100000; // ~100KB

// In handleMessage:
if (this.currentTranscript.length > this.MAX_TRANSCRIPT_LENGTH) {
    // Keep last 50% of transcript
    this.currentTranscript = this.currentTranscript.slice(-this.MAX_TRANSCRIPT_LENGTH / 2);
}
```

---

#### 3. Synchronous File Write in SecureStorage

**File:** `electron/SecureStorage.ts` (line 115)

```typescript
private save(): void {
    // ...
    fs.writeFileSync(this.filePath, JSON.stringify(encrypted, null, 2));  // ← Blocks event loop
    // ...
}
```

**Issue:** Synchronous file write blocks the main process event loop. Called on every `set()`, `delete()`, and `clear()`.

**Impact:** Brief UI freeze when saving API key or clearing storage.

**Recommendation:** Use async write with debouncing:
```typescript
private saveTimeout: ReturnType<typeof setTimeout> | null = null;

private save(): void {
    if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
        this.saveTimeout = null;
        this.performSave();
    }, 100); // Debounce 100ms
}

private async performSave(): Promise<void> {
    try {
        const encrypted: { [key: string]: string } = {};
        // ... encryption logic ...
        await fs.promises.writeFile(this.filePath, JSON.stringify(encrypted, null, 2));
    } catch (err) {
        log.error('Failed to save secure storage:', err);
    }
}
```

---

#### 4. WebSocket Reconnection Race Condition

**File:** `electron/audio/GeminiLiveService.ts` (lines 156-158)

```typescript
if (!this.intentionalDisconnect && !isAuthError && this.reconnectAttempts < this.maxReconnectAttempts) {
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);  // ← No cleanup tracking
}
```

**Issue:** If `disconnect()` is called during the reconnection delay, the reconnection still proceeds because the timeout isn't tracked or cleared.

**Recommendation:** Track and clear the reconnection timeout:
```typescript
private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

// In connect() close handler:
if (!this.intentionalDisconnect && !isAuthError && this.reconnectAttempts < this.maxReconnectAttempts) {
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.connect();
    }, 1000 * this.reconnectAttempts);
}

// In disconnect():
public disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
    }
    // ... rest of disconnect
}
```

---

### 🟡 MEDIUM PRIORITY

#### 5. Potential Prompt Injection Vulnerability

**Files:** 
- `electron/processing/controllers/QueueProcessingController.ts` (lines 276-302)
- `electron/processing/controllers/DebugProcessingController.ts` (lines 128-154)

```typescript
const promptText = `
Generate a detailed solution for the following coding problem:

PROBLEM STATEMENT:
${problemInfo.problem_statement}  // ← User-provided content injected directly

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}  // ← User content
// ...
`
```

**Issue:** Problem statement from screenshots is injected directly into the prompt without sanitization. While the source is screenshot OCR (reducing risk), a malicious problem description could attempt prompt injection.

**Recommendation:** Add basic sanitization:
```typescript
const sanitizeForPrompt = (text: string): string => {
    // Remove potential injection patterns
    return text
        .replace(/\n```/g, '\n` ` `')  // Break out of code blocks
        .slice(0, 5000); // Limit length
};
```

---

#### 6. Missing Dependency in useEffect

**File:** `src/components/UnifiedPanel/useUnifiedPanelSubscriptions.ts` (line 97)

```typescript
return () => {
    unsubStatus()
    // ... other unsubs
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [setActionNotice, setError, setStatus])  // ← Missing: isCapturing, isActive, statusState
```

**Issue:** The effect uses `isCapturing`, `isActive`, and `statusState` (line 111) but they're not in the dependency array. This could lead to stale closures.

**Recommendation:** Add missing dependencies or use a ref pattern if intentional.

---

#### 7. Type Incompatibility for Browser Environment

**File:** `electron/processing/providerTimeout.ts` (line 53)

```typescript
let timer: NodeJS.Timeout | null = null  // ← NodeJS type in shared code
```

**Issue:** `NodeJS.Timeout` type is used, but this code could theoretically run in a browser context (though currently Electron-only).

**Recommendation:** Use environment-agnostic type:
```typescript
let timer: ReturnType<typeof setTimeout> | null = null
```

---

#### 8. No Upper Bound for Screenshot Queue

**File:** `electron/ScreenshotHelper.ts` (line 18)

```typescript
private readonly MAX_SCREENSHOTS = 5;
```

While there's a max, the queue can briefly exceed this if screenshots are taken rapidly before cleanup runs. Not critical, but worth noting.

---

### 🟢 LOW PRIORITY

#### 9. Console Error in Development

**File:** `src/components/UnifiedPanel/UnifiedPanel.tsx` (line 137)

```typescript
} catch (configError) {
    console.error("Failed to load preferred audio source:", configError);  // ← console.error
}
```

**Issue:** Using `console.error` instead of the application's logger. Inconsistent with main process logging.

**Recommendation:** Use `runtimeLogger` or pass logging through IPC.

---

#### 10. String Concatenation for Binary Data

**File:** `src/components/UnifiedPanel/useAudioCapture.ts` (lines 118-120)

```typescript
const uint8Array = new Uint8Array(pcmBuffer)
const binary = String.fromCharCode(...Array.from(uint8Array))  // ← Spread on large arrays
const base64 = btoa(binary)
```

**Issue:** Spreading large Uint8Arrays can hit stack size limits. For large audio chunks, this could cause "Maximum call stack size exceeded".

**Recommendation:** Use chunk-based conversion:
```typescript
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32KB chunks
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
};
```

---

## Part 3: Architecture Observations

### Positive Patterns

1. **EventEmitter Cleanup**: `LiveInterviewService.stop()` properly cleans up all timers and listeners (lines 410-466)
2. **Graceful Degradation**: `SecureStorage` falls back to plaintext when encryption unavailable
3. **Debouncing**: `useUnifiedPanelUiEffects` properly handles click-outside with cleanup
4. **State Machines**: Clear state management in `LiveInterviewService` with `ListeningState` type

### Areas for Improvement

1. **Buffer Management**: Audio processing creates many short-lived objects
2. **Transcript Persistence**: No persistence mechanism for long transcripts
3. **Error Boundaries**: No React error boundaries for the panel components

---

## Summary

### Fix Verification: ✅ All Critical Issues Resolved

The previous fixes were implemented correctly and follow best practices.

### New Findings: 4 High, 4 Medium, 2 Low

Most new issues are related to:
- Memory management in long-running audio sessions
- Synchronous I/O blocking the event loop
- Edge cases in WebSocket lifecycle

### Recommendations Priority

**Before Production:**
1. Fix SecureStorage synchronous write (#3)
2. Add transcript size limit (#2)
3. Fix WebSocket reconnection race (#4)

**Next Sprint:**
4. Add prompt sanitization (#5)
5. Fix useEffect dependencies (#6)
6. Optimize audio buffer handling (#1, #10)

---

*Report generated by Code Review Audit*  
*Date: 2026-02-08*
