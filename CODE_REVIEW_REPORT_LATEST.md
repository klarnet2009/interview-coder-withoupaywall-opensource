# Code Review Report: Latest Audit

**Date:** 2026-02-08  
**Scope:** New findings after fix verification  
**Previous Issues Status:** All 8 critical issues from previous report - **FIXED**

---

## Summary

Previous critical issues have been resolved. This report contains **new findings** from extended codebase audit.

**New Issues Found:** 4 High Priority, 4 Medium Priority, 2 Low Priority

---

## 🔴 HIGH PRIORITY

### 1. Synchronous File Write Blocks Event Loop

**File:** `electron/SecureStorage.ts` (line 115)

```typescript
private save(): void {
    // ...
    fs.writeFileSync(this.filePath, JSON.stringify(encrypted, null, 2));  // ← BLOCKING
    // ...
}
```

**Issue:** Synchronous file write blocks the main process event loop. Called on every `set()`, `delete()`, and `clear()`.

**Impact:** Brief UI freeze when saving API key or clearing storage.

**Recommendation:** Use async write with debouncing:
```typescript
private saveTimeout: ReturnType<typeof setTimeout> | null = null;

private save(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
        this.saveTimeout = null;
        this.performSave();
    }, 100);
}

private async performSave(): Promise<void> {
    const encrypted: { [key: string]: string } = {};
    // ... encryption logic ...
    await fs.promises.writeFile(this.filePath, JSON.stringify(encrypted, null, 2));
}
```

---

### 2. Unbounded Transcript Growth (Memory Leak)

**File:** `electron/audio/GeminiLiveService.ts` (line 235)

```typescript
if (serverContent.inputTranscription?.text) {
    const newText = serverContent.inputTranscription.text;
    if (newText) {
        this.currentTranscript += newText;  // ← Grows indefinitely
        // ...
    }
}
```

**Issue:** `currentTranscript` grows indefinitely during long sessions. With hours of transcription, this consumes significant memory.

**Recommendation:** Implement transcript size limit:
```typescript
private MAX_TRANSCRIPT_LENGTH = 100000; // ~100KB

// In handleMessage:
if (this.currentTranscript.length > this.MAX_TRANSCRIPT_LENGTH) {
    this.currentTranscript = this.currentTranscript.slice(-this.MAX_TRANSCRIPT_LENGTH / 2);
}
```

---

### 3. WebSocket Reconnection Race Condition

**File:** `electron/audio/GeminiLiveService.ts` (lines 156-158)

```typescript
if (!this.intentionalDisconnect && !isAuthError && this.reconnectAttempts < this.maxReconnectAttempts) {
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);  // ← Not tracked
}
```

**Issue:** If `disconnect()` is called during reconnection delay, reconnection still proceeds.

**Recommendation:** Track and clear timeout:
```typescript
private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

// In close handler:
this.reconnectTimeout = setTimeout(() => {
    this.reconnectTimeout = null;
    this.connect();
}, 1000 * this.reconnectAttempts);

// In disconnect():
if (this.reconnectTimeout) {
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
}
```

---

### 4. Memory Pressure from Frequent Buffer Allocations

**File:** `electron/audio/LiveInterviewService.ts` (line 400)

```typescript
public receiveAudio(pcmBase64: string, level: number): void {
    // ...
    if (this.geminiService?.isActive()) {
        const buffer = Buffer.from(pcmBase64, 'base64');  // ← 50+ allocs/second
        this.geminiService.sendAudio(buffer);
    }
}
```

**Issue:** Base64 decoding creates new Buffer for every audio chunk (~50 allocations/second).

**Recommendation:** Monitor memory usage in long sessions. Consider buffer pooling for optimization.

---

## 🟡 MEDIUM PRIORITY

### 5. Potential Prompt Injection Risk

**Files:** 
- `electron/processing/controllers/QueueProcessingController.ts` (lines 276-302)
- `electron/processing/controllers/DebugProcessingController.ts` (lines 128-154)

```typescript
const promptText = `
PROBLEM STATEMENT:
${problemInfo.problem_statement}  // ← User content injected directly
CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}
`
```

**Issue:** Problem statement from screenshots injected into prompt without sanitization.

**Recommendation:** Add basic sanitization:
```typescript
const sanitizeForPrompt = (text: string): string => {
    return text
        .replace(/\n```/g, '\n` ` `')  // Break out of code blocks
        .slice(0, 5000); // Limit length
};
```

---

### 6. Missing React Hook Dependencies

**File:** `src/components/UnifiedPanel/useUnifiedPanelSubscriptions.ts` (line 97)

```typescript
}, [setActionNotice, setError, setStatus])  // ← Missing: isCapturing, isActive, statusState
```

**Issue:** Effect uses `isCapturing`, `isActive`, `statusState` (line 111) but not in deps array.

**Recommendation:** Add missing dependencies or document why they're excluded.

---

### 7. NodeJS-Specific Type in Shared Code

**File:** `electron/processing/providerTimeout.ts` (line 53)

```typescript
let timer: NodeJS.Timeout | null = null  // ← Not browser-compatible
```

**Recommendation:** Use `ReturnType<typeof setTimeout>` instead.

---

### 8. Stack Overflow Risk in Binary Conversion

**File:** `src/components/UnifiedPanel/useAudioCapture.ts` (lines 118-120)

```typescript
const uint8Array = new Uint8Array(pcmBuffer)
const binary = String.fromCharCode(...Array.from(uint8Array))  // ← Spread on large arrays
const base64 = btoa(binary)
```

**Issue:** Large audio chunks can exceed call stack size.

**Recommendation:** Use chunked conversion:
```typescript
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
};
```

---

## 🟢 LOW PRIORITY

### 9. Inconsistent Error Logging

**File:** `src/components/UnifiedPanel/UnifiedPanel.tsx` (line 137)

```typescript
} catch (configError) {
    console.error("Failed to load preferred audio source:", configError);  // ← console.error
}
```

Use application's logger instead of console.

---

### 10. No Upper Bound Protection for Queue

**File:** `electron/ScreenshotHelper.ts` (line 18)

While `MAX_SCREENSHOTS = 5` exists, rapid screenshot-taking can briefly exceed this before cleanup.

---

## Positive Findings

1. ✅ **EventEmitter Cleanup**: `LiveInterviewService.stop()` properly cleans up all timers
2. ✅ **Graceful Degradation**: `SecureStorage` falls back to plaintext when encryption unavailable  
3. ✅ **Debouncing**: Click-outside handler properly cleaned up
4. ✅ **State Management**: Clear state machines with `ListeningState` type

---

## Action Items

### Before Production:
1. [ ] Fix SecureStorage synchronous write (#1)
2. [ ] Add transcript size limit (#2)
3. [ ] Fix WebSocket reconnection race (#3)

### Next Sprint:
4. [ ] Add prompt sanitization (#5)
5. [ ] Fix useEffect dependencies (#6)
6. [ ] Optimize buffer handling (#4, #8)

### Technical Debt:
7. [ ] Replace NodeJS.Timeout type (#7)
8. [ ] Replace console.error with logger (#9)

---

*Report generated: 2026-02-08*
