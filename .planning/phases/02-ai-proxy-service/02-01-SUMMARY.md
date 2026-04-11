---
phase: 02-ai-proxy-service
plan: 01
subsystem: api, processing
tags: [openai, gemini, anthropic, processing, provider, zod, discriminated-union]

# Dependency graph
requires:
  - phase: 01-backend-foundation-auth
    provides: Express server, Zod config, AuthResult discriminated union pattern
provides:
  - ProcessingResult discriminated union type for AI processing responses
  - ProcessingProvider interface with three provider implementations
  - ProcessingService orchestrator for provider selection
  - Config with optional AI provider API key env vars
affects: [02-02, processing-routes, credits]

# Tech tracking
tech-stack:
  added: [openai, @anthropic-ai/sdk, axios]
  patterns: [provider-strategy-pattern, discriminated-union-ProcessingResult, server-side-api-key-management, error-status-code-mapping]

key-files:
  created:
    - backend/src/processing/types.ts
    - backend/src/processing/providers/openai.provider.ts
    - backend/src/processing/providers/gemini.provider.ts
    - backend/src/processing/providers/anthropic.provider.ts
    - backend/src/processing/providers/index.ts
    - backend/src/processing/processing.service.ts
    - backend/src/processing/processing.test.ts
  modified:
    - backend/src/config.ts
    - backend/.env.example
    - backend/package.json

key-decisions:
  - "ProcessingResult uses discriminated union matching AuthResult pattern for type-safe error handling"
  - "ProcessingService constructor accepts explicit apiKeys for dependency injection/testing"
  - "Provider error handling maps API-specific errors to HTTP status codes (401, 429, 502, 503)"
  - "API keys are optional with empty-string defaults — service works with any subset of providers configured"

patterns-established:
  - "ProcessingResult<T>: { success: true; data: T } | { success: false; error: string; statusCode: number }"
  - "Provider strategy pattern: each AI provider implements ProcessingProvider interface"
  - "isConfigured() check pattern: providers return false without API key, methods return 503 errors"
  - "Error mapping pattern: API errors → standardized statusCodes for consistent HTTP responses"

requirements-completed: [BKND-02, BKND-03]

# Metrics
duration: 16min
completed: 2026-04-11
---

# Phase 02 Plan 01: Processing Types & Provider Implementations Summary

**AI processing infrastructure with ProcessingResult discriminated union, three provider implementations (OpenAI, Gemini, Anthropic), and ProcessingService orchestrator — API keys stored server-side only**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-04-11T13:38:00Z
- **Completed:** 2026-04-11T13:54:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- ProcessingResult discriminated union type matching AuthResult pattern for type-safe error handling
- Three ProcessingProvider implementations (OpenAI, Gemini, Anthropic) with identical prompts to Electron versions
- ProcessingService orchestrator with provider selection by string type and descriptive error messages
- Config updated with optional OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY (never exposed to clients)
- Provider error handling maps API-specific errors to HTTP status codes (401, 429, 502, 503)
- 31 comprehensive tests covering discriminated union narrowing, provider isConfigured, unconfigured errors, and service delegation

## Task Commits

Each task was committed atomically:

1. **Task 1: Define processing types and implement provider classes** - `b33eeb4` (feat)
2. **Task 2: Implement processing service orchestrator with provider selection** - `4fda2f0` (feat)

## Files Created/Modified

### Created
- `backend/src/processing/types.ts` — ProcessingResult discriminated union, ProcessingProvider interface, request/response types
- `backend/src/processing/providers/openai.provider.ts` — OpenAI GPT-4o provider with identical prompts to Electron version
- `backend/src/processing/providers/gemini.provider.ts` — Gemini REST API provider with gemini-3-flash-preview default model
- `backend/src/processing/providers/anthropic.provider.ts` — Anthropic Claude 3.7 Sonnet provider with multimodal support
- `backend/src/processing/providers/index.ts` — Barrel export for all providers
- `backend/src/processing/processing.service.ts` — ProcessingService orchestrator with provider selection and method delegation
- `backend/src/processing/processing.test.ts` — 31 tests for ProcessingResult, providers, and ProcessingService

### Modified
- `backend/src/config.ts` — Added OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY to Zod schema and Config interface
- `backend/.env.example` — Added AI provider API key placeholders
- `backend/package.json` — Added openai, @anthropic-ai/sdk, axios, @types/axios dependencies

## Decisions Made
- ProcessingResult uses discriminated union `{ success: true; data: T } | { success: false; error: string; statusCode: number }` matching AuthResult pattern from Phase 01 for type narrowing
- ProcessingService constructor accepts explicit `apiKeys` parameter for dependency injection and testing, with singleton defaulting to config values
- Provider isConfigured() returns false for empty/missing API keys, and all methods return `{ success: false, error: "...not configured...", statusCode: 503 }` — consistent UX regardless of which provider is selected
- Error mapping standardizes API-specific errors: 401 (unauthorized), 429 (rate limited), 502 (bad gateway/upstream error), 503 (not configured or network failure)
- Gemini provider uses REST API directly with axios instead of a dedicated SDK (matching Electron implementation)
- Anthropic provider handles payload-too-large errors (413) as 502 status — consistent proxy behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript AxiosError import issue**
- **Found during:** Task 1 implementation
- **Issue:** `AxiosError` not exported as named export from axios module in CommonJS context
- **Fix:** Changed Gemini provider error handling to use duck-typing check (`'isAxiosError' in error`) instead of `instanceof AxiosError`
- **Files modified:** `backend/src/processing/providers/gemini.provider.ts`
- **Verification:** `tsc --noEmit` passes clean, all tests pass
- **Committed in:** `b33eeb4`

**2. [Rule 3 - Blocking] Config module throws without env vars in tests**
- **Found during:** Task 2 test execution
- **Issue:** ProcessingService imports config which validates required env vars (DATABASE_URL, JWT_SECRET, etc.) at module level, causing tests to fail
- **Fix:** Added `vi.mock('../config', ...)` to test file and ProcessingService accepts explicit `apiKeys` parameter for testing/injection
- **Files modified:** `backend/src/processing/processing.test.ts`, `backend/src/processing/processing.service.ts`
- **Verification:** All 58 tests pass (31 new + 27 existing)
- **Committed in:** `4fda2f0`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None — AI provider API keys are optional. The service works with any subset of providers configured. To enable specific providers, set the corresponding environment variables (OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY).

## Next Phase Readiness
- Processing infrastructure complete, ready for Plan 02-02 (Express routes for processing endpoints)
- ProcessingResult discriminated union ready for use in route handlers
- ProcessingService singleton ready for import in route modules
- Provider error statusCodes map directly to HTTP response codes

## Self-Check: PASSED

- All 10 created/modified files verified present on disk ✓
- Both task commits verified in git history (b33eeb4, 4fda2f0) ✓
- TypeScript compiles without errors (`tsc --noEmit` clean) ✓
- All 58 tests pass (`vitest run` — 31 processing + 27 auth/health) ✓
- Config has OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY fields ✓
- ProcessingService orchestrates provider selection with descriptive errors ✓
- API keys only read from config (environment variables), never from request bodies ✓

---
*Phase: 02-ai-proxy-service*
*Completed: 2026-04-11*