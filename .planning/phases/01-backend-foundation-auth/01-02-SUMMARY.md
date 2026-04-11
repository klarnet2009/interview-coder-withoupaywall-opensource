---
phase: 01-backend-foundation-auth
plan: 02
subsystem: api, auth, middleware
tags: [jwt, bcrypt, authentication, express, zod, result-pattern]

# Dependency graph
requires:
  - phase: 01-01
    provides: Express server, Prisma schema, Zod config, Database singleton
provides:
  - Auth service with register, login, logout, and token refresh business logic
  - Express routes for /auth/register, /login, /logout, /refresh, /me
  - JWT authentication middleware for protected routes
  - AuthResult<T> discriminated union type for error handling
affects: [01-02, all authenticated routes, credits, billing]

# Tech tracking
tech-stack:
  added: [bcryptjs, jsonwebtoken, uuid, zod-validation-in-auth]
  patterns: [jwt-access-refresh-token-pair, token-rotation-on-refresh, bcryptjs-password-hashing, discriminated-union-result-type, bearer-token-auth-middleware]

key-files:
  created:
    - backend/src/auth/auth.service.ts
    - backend/src/auth/auth.routes.ts
    - backend/src/auth/auth.test.ts
    - backend/src/middleware/auth.middleware.ts
    - backend/src/middleware/auth.middleware.test.ts
    - backend/src/__tests__/auth.integration.test.ts
  modified:
    - backend/src/index.ts
    - backend/src/auth/auth.routes.ts

key-decisions:
  - "Discriminated union AuthResult<T> type replacing optional fields pattern for better type narrowing"
  - "bcryptjs (pure JS) used for cross-platform password hashing — no native compilation needed"
  - "JWT access token expires in 15m, refresh token in 7d — configurable via environment variables"
  - "Token rotation implemented: old refresh token revoked when issuing new one (per AUTH-04)"
  - "Type assertion `as jwt.SignOptions` used for expiresIn config values to satisfy jsonwebtoken types"
  - "Auth middleware extracts Bearer token and sets req.user with { userId } on success"

patterns-established:
  - "Auth service functions return discriminated union: { success: true, data: T } | { success: false, error: string, statusCode: number }"
  - "Zod schemas validate auth input before database operations"
  - "Express routes delegate to service functions and map result to HTTP status codes"
  - "Auth middleware pattern: extract token → verify JWT → set req.user → next()"
  - "Token rotation: refresh token is revoked before issuing new one on /auth/refresh"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 17min
completed: 2026-04-11
---

# Phase 01 Plan 02: Auth Endpoints & JWT Middleware Summary

**JWT auth system with register, login, logout, refresh (token rotation) and Bearer token middleware**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-04-11T12:45:10Z
- **Completed:** 2026-04-11T13:02:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Auth service with full registration, login, logout, and token refresh business logic
- JWT access tokens (15m expiry) and refresh tokens (7d expiry) with bcryptjs password hashing
- Token rotation on refresh: old refresh token is revoked when issuing new one (per AUTH-04 security)
- Zod input validation for all auth endpoints (email format, password min 8 chars)
- Express routes for POST /auth/register, /login, /logout, /refresh, and GET /auth/me
- JWT authentication middleware protecting routes via Bearer token
- Discriminated union AuthResult<T> type for type-safe error handling
- Integration tests verifying register → authenticate → /me flow
- All 27 tests passing (3 health + 14 auth service + 7 middleware + 3 integration)

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED):** Failing tests for auth service - `b0f8064` (test)
2. **Task 1 (TDD GREEN):** Auth service and routes implementation - `b82d9b6` (feat)
3. **Task 2:** JWT middleware, /auth/me route, route wiring, integration tests - `53db227` (feat)

## Files Created/Modified

### Created
- `backend/src/auth/auth.service.ts` — Registration, login, logout, token refresh business logic with AuthResult type
- `backend/src/auth/auth.routes.ts` — Express router for /auth endpoints (register, login, refresh, logout, me)
- `backend/src/auth/auth.test.ts` — 14 unit tests for auth service covering all behaviors
- `backend/src/middleware/auth.middleware.ts` — JWT Bearer token authentication middleware
- `backend/src/middleware/auth.middleware.test.ts` — 7 tests for auth middleware (valid token, missing, malformed, expired, invalid, user not found)
- `backend/src/__tests__/auth.integration.test.ts` — 3 integration tests for register→me flow and unauthenticated access

### Modified
- `backend/src/index.ts` — Added auth router import and mounted at /auth
- `backend/src/auth/auth.routes.ts` — Added GET /auth/me protected route (modified after initial creation)

## Decisions Made
- Used discriminated union `AuthResult<T> = { success: true, data: T } | { success: false, error: string, statusCode: number }` for better TypeScript narrowing (instead of optional fields pattern)
- Chose `as jwt.SignOptions` type assertion for expiresIn values — jsonwebtoken's `StringValue` branded type from `ms` package doesn't accept plain `string`
- bcryptjs (pure JavaScript) used instead of bcrypt — no native compilation, cross-platform compatible per project constraint
- Token rotation pattern: on refresh, old token is revoked via `revokedAt` timestamp before issuing new one
- Auth middleware returns specific error messages: "Access token required", "Access token expired", "Invalid access token"
- Idempotent logout: returns success even if token not found (no information leakage about token existence)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type error with jsonwebtoken SignOptions**
- **Found during:** Task 1 implementation
- **Issue:** `config.JWT_ACCESS_EXPIRES_IN` (typed as `string`) is not assignable to jsonwebtoken's `expiresIn` parameter which expects `number | StringValue` (branded type from `ms` package)
- **Fix:** Used `as jwt.SignOptions` type assertion for the options object — runtime values ('15m', '7d') are valid, only the TypeScript types are misaligned
- **Files modified:** `backend/src/auth/auth.service.ts`
- **Commit:** `b82d9b6`

**2. [Rule 1 - Bug] TypeScript type narrowing with AuthResult optional fields**
- **Found during:** Task 1 implementation
- **Issue:** Original `AuthResult<T>` had `data?: T` and `error?: string` as optional fields, making TypeScript unable to narrow types in `if (result.success)` blocks
- **Fix:** Changed to proper discriminated union: `{ success: true; data: T } | { success: false; error: string; statusCode: number }`
- **Files modified:** `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.test.ts`
- **Commit:** `b82d9b6`

**3. [Rule 1 - Bug] TypeScript error in integration test mock**
- **Found during:** Task 2 verification (tsc --noEmit)
- **Issue:** Mock return value for `prisma.user.findUnique` in integration test was missing `passwordHash` and `updatedAt` fields required by Prisma types
- **Fix:** Added `as any` cast to the partial mock object
- **Files modified:** `backend/src/__tests__/auth.integration.test.ts`
- **Commit:** `53db227` (amended)

## Known Issues (Out of Scope)

- **EADDRINUSE in test suite:** When running all test files together, Vitest logs `EADDRINUSE` warnings because `index.ts` starts an Express server on import. This is a pre-existing issue from Plan 01-01 and doesn't affect test correctness. All tests pass. Will be fixed by conditionally starting the server (e.g., only if not in test environment) in a future plan.

## Next Phase Readiness
- Auth API fully functional with register, login, logout, refresh endpoints
- JWT middleware ready to protect any future authenticated routes
- Token rotation ensures session persistence (AUTH-04 backend foundation)
- Ready for Phase 2 (AI Proxy Service) to add authenticated AI processing routes

## Self-Check: PASSED

- All 8 created/modified files verified present on disk
- All 3 task commits verified in git history (b0f8064, b82d9b6, 53db227)
- TypeScript compiles without errors (`tsc --noEmit` clean)
- All 27 tests pass (`vitest run` - 3 health + 14 auth + 7 middleware + 3 integration)
- Auth routes exist: POST /register, POST /login, POST /refresh, POST /logout, GET /me
- Password hashing uses bcryptjs (`bcrypt.hash` and `bcrypt.compare`)
- JWT verification in middleware uses `jwt.verify`
- Auth routes mounted in server at `/auth`

---
*Phase: 01-backend-foundation-auth*
*Completed: 2026-04-11*