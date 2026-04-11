---
phase: 03-credits-billing
plan: 01
subsystem: credits
tags: [credits, billing, prisma, middleware, api]
requires: [02-01, 02-02]
provides: [credit-model, credit-service, credit-routes, credit-check-middleware]
affects: [backend/src/processing/processing.routes.ts, backend/src/auth/auth.service.ts, backend/src/index.ts]
tech-stack:
  added: [prisma-credit-transaction-model, credit-service-class, credit-check-middleware]
  patterns: [discriminated-union-CreditResult, transactional-credit-deduction, middleware-factory-creditCheck]
key-files:
  created:
    - backend/src/credits/credit.service.ts
    - backend/src/credits/credit.service.test.ts
    - backend/src/credits/credit.routes.ts
    - backend/src/middleware/creditCheck.ts
    - backend/src/middleware/creditCheck.test.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/config.ts
    - backend/.env.example
    - backend/src/processing/processing.routes.ts
    - backend/src/auth/auth.service.ts
    - backend/src/index.ts
    - backend/src/auth/auth.test.ts
    - backend/src/__tests__/auth.integration.test.ts
    - backend/src/__tests__/processing.integration.test.ts
    - backend/src/__tests__/health.test.ts
    - backend/src/middleware/auth.middleware.test.ts
decisions:
  - CreditService uses Prisma interactive transactions for atomic balance read-check-update to prevent race conditions
  - deductCredits returns 402 with descriptive message including current balance and required amount
  - creditCheck is a middleware factory function accepting operation cost parameter
  - Free signup credits awarded after user registration using creditService.addFreeCredits
  - Credit costs configurable via env vars (CREDITS_COST_EXTRACT=1, SOLUTION=2, DEBUG=3)
metrics:
  duration: 15m
  completed: "2026-04-11T13:44:02Z"
  tasks: 2
  files: 14
  tests_added: 16
  tests_total: 95
---

# Phase 03 Plan 01: Credits Foundation Summary

Added credit system data model, service layer, API endpoints, and credit check middleware. Every authenticated AI request now checks the user's credit balance and deducts credits on success. New users receive 10 free credits on signup.

## What Was Built

### Task 1: Prisma Schema Extension + CreditService (TDD)
- **CreditTransaction model** in Prisma schema with `amount`, `balance`, `operation`, `description` fields and proper indexes
- **User.credits** field (Float, default 0) added to User model
- **CreditService** class with dependency-injected Prisma client for testability:
  - `getBalance(userId)` — returns credit balance, 0 if user not found
  - `addCredits(userId, amount, operation, description?)` — atomic credit addition with transaction record
  - `addFreeCredits(userId)` — wrapper calling addCredits with CREDITS_FREE_ON_SIGNUP
  - `deductCredits(userId, amount, operation)` — transactional check-then-decrement preventing negative balances, returns 402 on insufficient
- **Config vars** added: CREDITS_FREE_ON_SIGNUP (default 10), CREDITS_COST_EXTRACT (1), CREDITS_COST_SOLUTION (2), CREDITS_COST_DEBUG (3)
- 11 unit tests covering all CreditService methods

### Task 2: Credit Routes, Middleware, and Wiring
- **GET /credits/balance** — authenticated endpoint returning `{ credits: number }`
- **creditCheck middleware** — factory function `creditCheck(operationCost)` that checks balance before allowing processing
- **Processing routes updated** — creditCheck middleware added before each handler, creditService.deductCredits called after successful processing
- **Auth service updated** — addFreeCredits called after registration for free signup credits
- **Credits router mounted** at `/credits` in index.ts
- 5 middleware tests for creditCheck (sufficient credits, insufficient 402, zero balance, missing user 500, exact balance)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added `credits` field to mock User objects in existing tests**
- **Found during:** Task 1 — TypeScript compilation failed after adding `User.credits` to Prisma schema
- **Issue:** All mock User objects in auth.test.ts and auth.integration.test.ts were missing the new `credits` field
- **Fix:** Added `credits: 0` or `credits: 10` to all existing mock User objects across 4 test files
- **Files modified:** backend/src/auth/auth.test.ts, backend/src/__tests__/auth.integration.test.ts
- **Commit:** 61a1d80

**2. [Rule 2 - Missing Critical Functionality] Added missing config vars and service mocks to test files**
- **Found during:** Task 2 — Test runs failed because processing.routes and index.ts now import credit service
- **Issue:** Existing integration tests (health.test.ts, auth.middleware.test.ts, processing.integration.test.ts) needed credit config vars and credit service mocks
- **Fix:** Added CREDITS_FREE_ON_SIGNUP, CREDITS_COST_EXTRACT/SOLUTION/DEBUG to all mock config objects; added creditService mock to integration tests
- **Files modified:** backend/src/__tests__/health.test.ts, backend/src/middleware/auth.middleware.test.ts, backend/src/__tests__/processing.integration.test.ts
- **Commit:** 818db99

**3. [Rule 2 - Missing Critical Functionality] Added creditService.addFreeCredits mock to auth tests**
- **Found during:** Task 2 — auth.service.ts now calls creditService.addFreeCredits on registration
- **Issue:** Auth unit and integration tests would fail without mocking the new dependency
- **Fix:** Added `vi.mock('../credits/credit.service')` with addFreeCredits mock to auth.test.ts and auth.integration.test.ts
- **Files modified:** backend/src/auth/auth.test.ts, backend/src/__tests__/auth.integration.test.ts
- **Commit:** 818db99

None — all deviations were auto-fixes for downstream impacts of the plan's changes.

## Test Results

```
✓ src/middleware/creditCheck.test.ts (5 tests) 10ms
✓ src/credits/credit.service.test.ts (11 tests) 13ms
✓ src/processing/processing.test.ts (31 tests) 17ms
✓ src/__tests__/processing.integration.test.ts (15 tests) 151ms
✓ src/middleware/rateLimit.test.ts (6 tests) 308ms
✓ src/middleware/auth.middleware.test.ts (7 tests) 88ms
✓ src/__tests__/health.test.ts (3 tests) 932ms
✓ src/__tests__/auth.integration.test.ts (3 tests) 367ms
✓ src/auth/auth.test.ts (14 tests) 1765ms

Test Files  9 passed (9)
Tests       95 passed (95)
```

TypeScript compilation: clean (0 errors)

## Requirements Verified

| Requirement | Status | How Verified |
|-------------|--------|-------------|
| CRED-01: New user receives free credits upon signup | ✅ | creditService.addFreeCredits called in authService.register, 10 credit default, tested |
| CRED-03: Per-operation credit costs configurable via env vars | ✅ | CREDITS_COST_EXTRACT=1, SOLUTION=2, DEBUG=3 in config with Zod coercion |
| CRED-04: User can query credit balance via API | ✅ | GET /credits/balance returns { credits: number } |
| CRED-05: Zero-credit user gets 402 error | ✅ | creditCheck middleware returns 402 with descriptive message |

## Self-Check: PASSED

- ✅ backend/src/credits/credit.service.ts — FOUND
- ✅ backend/src/credits/credit.routes.ts — FOUND
- ✅ backend/src/middleware/creditCheck.ts — FOUND
- ✅ backend/src/credits/credit.service.test.ts — FOUND
- ✅ backend/src/middleware/creditCheck.test.ts — FOUND
- ✅ Commit 61a1d80 — FOUND
- ✅ Commit 818db99 — FOUND