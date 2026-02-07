# Deprecation Audit Report

Generated: 2026-02-05

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| Security Vulnerabilities | 31 | 2 critical, 10 high, 12 moderate, 7 low |
| Outdated Packages | 38 | Multiple major versions behind |
| Deprecated Code Patterns | 2 files | ScriptProcessorNode API |

---

## 🔴 Critical Security Vulnerabilities (Fix Immediately)

### 1. form-data (4.0.0 - 4.0.3) — CRITICAL
**Issue:** Uses unsafe random function for choosing boundary
**Advisory:** [GHSA-fjxv-7rqg-78g4](https://github.com/advisories/GHSA-fjxv-7rqg-78g4)
**Fix:** `npm audit fix`

### 2. screenshot-desktop (<1.15.2) — CRITICAL
**Issue:** Command Injection via `format` option
**Advisory:** [GHSA-gjx4-2c7g-fm94](https://github.com/advisories/GHSA-gjx4-2c7g-fm94)
**Fix:** `npm audit fix`

---

## 🟠 High Severity Vulnerabilities

| Package | Issue | Fix |
|---------|-------|-----|
| `tar` (<=7.5.6) | Arbitrary File Overwrite via Path Traversal | `npm audit fix --force` (breaking) |
| `glob` (10.2.0-10.4.5) | Command injection via -c/--cmd | `npm audit fix` |
| `electron` (<35.7.5) | ASAR Integrity Bypass | Upgrade to 35.7.5+ |

---

## 🟡 Moderate Vulnerabilities

| Package | Issue |
|---------|-------|
| `esbuild` (<=0.24.2) | Dev server request exposure |
| `js-yaml` (4.0.0-4.1.0) | Prototype pollution in merge |
| `lodash` (4.0.0-4.17.21) | Prototype pollution in _.unset |
| `prismjs` (<1.30.0) | DOM Clobbering (no fix available) |
| `tmp` (<=0.2.3) | Arbitrary file write via symlink |

---

## 📦 Major Package Updates Required

### Breaking Changes (Manual Migration)

| Package | Current | Latest | Breaking Changes |
|---------|---------|--------|------------------|
| `electron` | 29.4.6 | 40.1.0 | Major API changes |
| `electron-builder` | 24.13.3 | 26.7.0 | Config format changes |
| `react` | 18.3.1 | 19.2.4 | Concurrent features, new hooks |
| `react-dom` | 18.3.1 | 19.2.4 | Hydration changes |
| `eslint` | 8.57.1 | 9.39.2 | Flat config required |
| `tailwindcss` | 3.4.17 | 4.1.18 | Major config changes |
| `openai` | 4.93.0 | 6.17.0 | API restructuring |
| `vitest` | 2.1.9 | 4.0.18 | Config changes |
| `vite` | 6.2.5 | 7.3.1 | Build config changes |

### Safe Updates (Non-Breaking)

```bash
npm update axios autoprefixer dotenv electron-log electron-updater form-data postcss rimraf screenshot-desktop typescript
```

---

## ⚠️ Deprecated Code Patterns

### 1. ScriptProcessorNode (Web Audio API)

**Status:** Deprecated since 2014, removed in future browsers
**Files Affected:**
- `src/components/LiveInterview/LiveInterviewPanel.tsx:144`
- `electron/audio/AudioCaptureService.ts:149`

**Current Code:**
```typescript
const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
processor.onaudioprocess = (event) => { ... };
```

**Migration to AudioWorklet:**
```typescript
// 1. Create worklet processor file (audio-processor.js)
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0][0];
    if (input) {
      this.port.postMessage(input);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);

// 2. Use in component
await audioContext.audioWorklet.addModule('audio-processor.js');
const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
workletNode.port.onmessage = (e) => processAudio(e.data);
source.connect(workletNode);
```

**Effort:** Medium (2-4 hours)
**Priority:** P1 - Will break in future browser versions

---

## 📋 Migration Plan

### Phase 1: Critical Security (Today)
```bash
npm audit fix
npm update form-data screenshot-desktop
```

### Phase 2: High Priority (This Week)
1. Update Electron to 35.7.5+:
   ```bash
   npm install electron@35.7.5 --save-dev
   ```
2. Update glob and tar via electron-builder:
   ```bash
   npm install electron-builder@26.7.0 --save-dev
   ```

### Phase 3: Code Deprecations (Next Sprint)
1. Migrate ScriptProcessorNode → AudioWorklet
2. Test audio capture on all platforms

### Phase 4: Major Ecosystem Updates (Planned)
| Package | Migration Guide |
|---------|-----------------|
| React 19 | [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) |
| ESLint 9 | [ESLint Flat Config Migration](https://eslint.org/docs/latest/use/configure/migration-guide) |
| Tailwind 4 | [Tailwind v4 Beta](https://tailwindcss.com/blog/tailwindcss-v4-beta) |

---

## Commands Summary

```bash
# Fix critical vulnerabilities (safe)
npm audit fix

# Update non-breaking packages
npm update axios autoprefixer dotenv electron-log electron-updater form-data postcss rimraf screenshot-desktop typescript

# Check what will change with --force
npm audit fix --dry-run --force

# View full outdated list
npm outdated
```

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| ScriptProcessor deprecation | Audio stops working | Medium (2-3 years) | Migrate to AudioWorklet |
| Electron security vulnerabilities | Remote code execution | Low (requires attack) | Update to 35.7.5+ |
| form-data vulnerability | Boundary prediction | Medium | Update immediately |
