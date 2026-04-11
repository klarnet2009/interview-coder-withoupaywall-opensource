---
phase: 03-credits-billing
plan: 02
subsystem: stripe
tags: [stripe, checkout, webhook, credits, payment, billing]
requires: [03-01]
provides: [stripe-service, stripe-checkout-routes, stripe-webhook-handler, credit-packages-api]
affects: [backend/src/config.ts, backend/src/index.ts, backend/src/credits/credit.routes.ts]
tech-stack:
  added: [stripe-sdk-v22, stripe-checkout-sessions, stripe-webhook-signature-verification]
  patterns: [discriminated-union-StripeResult, raw-body-middleware-for-webhooks, per-route-auth-middleware]
key-files:
  created:
    - backend/src/stripe/stripe.service.ts
    - backend/src/stripe/stripe.service.test.ts
    - backend/src/stripe/stripe.routes.ts
    - backend/src/stripe/stripe.routes.test.ts
  modified:
    - backend/src/config.ts
    - backend/.env.example
    - backend/src/index.ts
    - backend/src/credits/credit.routes.ts
    - backend/src/credits/credit.service.test.ts
    - backend/src/__tests__/health.test.ts
    - backend/src/__tests__/auth.integration.test.ts
    - backend/src/__tests__/processing.integration.test.ts
    - backend/src/auth/auth.test.ts
    - backend/src/middleware/auth.middleware.test.ts
    - backend/src/middleware/rateLimit.test.ts
    - backend/src/processing/processing.test.ts
decisions:
  - StripeResult uses discriminated union matching CreditResult/AuthResult pattern for type-safe error handling
  - Webhook route mounted before express.json() with express.raw() to receive raw body for signature verification
  - Credit packages configurable via CREDIT_PACKAGES env var with "credits:priceInCents" format
  - Checkout and packages routes mounted at /credits path; webhook at /stripe path
  - CreditsRouter authenticate middleware moved from global to per-route to allow public /credits/packages endpoint
  - Stripe API version uses default from SDK (2026-03-25.dahlia) rather than pinning to a specific version
  - Webhook event data typed as generic object with metadata rather than Stripe.Checkout.Session for SDK compatibility
metrics:
  duration: 20m
  completed: "2026-04-11T18:55:00Z"
  tasks: 2
  files: 16
  tests_added: 14
  tests_total: 109
---

# Phase 03 Plan 02: Stripe Checkout & Webhook Summary

Added Stripe Checkout integration enabling users to purchase credit packages via Stripe. After payment confirmation via webhook, credits are automatically added to the user's account.

## What Was Built

### Task 1: StripeService with Checkout Session Creation and Webhook Handling (TDD)
- **StripeService** class with three core methods:
  - `getCreditPackages()` — returns parsed packages from `CREDIT_PACKAGES` config string
  - `createCheckoutSession(userId, packageId)` — validates package, creates Stripe Checkout session, returns session URL
  - `handleWebhookEvent(payload, signature)` — verifies Stripe webhook signature, processes `checkout.session.completed` events, calls `creditService.addCredits`
- **StripeResult discriminated union** type matching the established error handling pattern
- **CreditPackage** interface with `id`, `credits`, `priceInCents`, `name` fields
- Packages parsed from `CREDIT_PACKAGES` env var (`50:500,150:1200,500:4000` format)
- **Config additions**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `CREDIT_PACKAGES`
- Updated all existing test mocks to include new Stripe configuration fields
- 6 unit tests covering checkout session creation, invalid package rejection, webhook processing, signature verification, and non-checkout event handling

### Task 2: Stripe Routes and Express Server Wiring
- **checkoutRouter** (`/credits`):
  - `POST /credits/checkout` — authenticated endpoint, validates `packageId` via Zod, creates Checkout session
  - `GET /credits/packages` — public endpoint, returns available credit packages
- **stripeWebhookRouter** (`/stripe`):
  - `POST /stripe/webhook` — unauthenticated endpoint, receives Stripe webhook events with raw body, verifies signature, adds credits on payment confirmation
- **Express server updated**:
  - Webhook route mounted **before** `express.json()` with `express.raw({ type: 'application/json' })` for signature verification
  - Checkout routes mounted at `/credits` alongside existing credits routes
  - Moved `creditsRouter` authenticate middleware from global to per-route (auth only on `/balance`)
- 8 integration tests covering all endpoints (authenticated checkout, invalid packages, packages listing, webhook processing, missing/invalid signature)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Updated all existing test mocks with new Stripe config fields**
- **Found during:** Task 1 — TypeScript and test failures after adding required Stripe config vars
- **Issue:** Adding `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, etc. as required fields in config schema caused existing test mocks to be incomplete
- **Fix:** Added all 5 new Stripe config fields to config mocks in credit.service.test.ts, health.test.ts, auth.integration.test.ts, processing.integration.test.ts, auth.test.ts, auth.middleware.test.ts, rateLimit.test.ts, and processing.test.ts
- **Files modified:** 8 test files
- **Commit:** f6b70b5

**2. [Rule 1 - Bug] Moved creditsRouter authenticate from global middleware to per-route**
- **Found during:** Task 2 — GET /credits/packages returned 401 (unauthorized) instead of 200
- **Issue:** `creditsRouter.use(authenticate)` applied auth to ALL routes under `/credits`, including the new public `/packages` endpoint from checkoutRouter which is also mounted at `/credits`
- **Fix:** Changed `creditsRouter.use(authenticate)` to per-route `authenticate` middleware on the `/balance` route only
- **Files modified:** backend/src/credits/credit.routes.ts
- **Commit:** b73b9cb

**3. [Rule 3 - Blocking Issue] Used ReturnType inference for Stripe webhook event type**
- **Found during:** Task 1 — TypeScript errors with `Stripe.Event` and `Stripe.Checkout.Session` types
- **Issue:** Stripe SDK v22 exports types under `StripeConstructor.Stripe` namespace, not directly from the default import, causing `Namespace 'StripeConstructor' has no exported member 'Event'` errors
- **Fix:** Used `ReturnType<typeof stripe.webhooks.constructEvent>` for event type and inline intersection type for metadata access instead of `Stripe.Checkout.Session`
- **Files modified:** backend/src/stripe/stripe.service.ts
- **Commit:** f6b70b5

**4. [Rule 3 - Blocking Issue] Split stripe routes into two routers for correct mounting**
- **Found during:** Task 2 — Tests failing with 404 for `/credits/checkout` and 401 for `/credits/packages`
- **Issue:** The original single `stripeRouter` couldn't be mounted at both `/credits` (for checkout/packages) and `/stripe` (for webhook) simultaneously, especially with the raw body middleware requirement
- **Fix:** Split into `checkoutRouter` (mounted at `/credits`) and `stripeWebhookRouter` (mounted at `/stripe` with raw body middleware)
- **Files modified:** backend/src/stripe/stripe.routes.ts, backend/src/index.ts
- **Commit:** b73b9cb

## Test Results

```
✓ src/stripe/stripe.service.test.ts (6 tests) 24ms
✓ src/stripe/stripe.routes.test.ts (8 tests) 148ms
✓ src/middleware/creditCheck.test.ts (5 tests) 9ms
✓ src/credits/credit.service.test.ts (11 tests) 22ms
✓ src/processing/processing.test.ts (31 tests) 20ms
✓ src/middleware/rateLimit.test.ts (6 tests) 353ms
✓ src/__tests__/processing.integration.test.ts (15 tests) 230ms
✓ src/middleware/auth.middleware.test.ts (7 tests) 96ms
✓ src/__tests__/health.test.ts (3 tests) 1819ms
✓ src/__tests__/auth.integration.test.ts (3 tests) 869ms
✓ src/auth/auth.test.ts (14 tests) 2510ms

Test Files  11 passed (11)
Tests       109 passed (109)
```

TypeScript compilation: clean (0 errors)

## Requirements Verified

| Requirement | Status | How Verified |
|-------------|--------|-------------|
| CRED-02: Users can purchase credit packages via Stripe Checkout | ✅ | POST /credits/checkout creates Checkout session, GET /credits/packages lists packages |
| PAY-01: POST /credits/checkout creates Stripe Checkout session | ✅ | Integration test verifies session URL returned for valid packageId, 400 for invalid |
| PAY-02: Webhook adds credits on successful payment | ✅ | Unit + integration tests verify checkout.session.completed adds credits via creditService.addCredits |
| Invalid webhook signatures rejected with 400 | ✅ | Unit + integration tests verify signature verification returns 400 |
| Credits added immediately on payment confirmation | ✅ | Webhook handler calls creditService.addCredits synchronously on checkout.session.completed |
| Authenticated endpoints return 401 without token | ✅ | Integration test confirms POST /credits/checkout returns 401 without auth header |

## Self-Check: PASSED

- ✅ backend/src/stripe/stripe.service.ts — FOUND
- ✅ backend/src/stripe/stripe.service.test.ts — FOUND
- ✅ backend/src/stripe/stripe.routes.ts — FOUND
- ✅ backend/src/stripe/stripe.routes.test.ts — FOUND
- ✅ backend/src/config.ts — FOUND (STRIPE_SECRET_KEY present)
- ✅ backend/src/index.ts — FOUND (stripeWebhookRouter and checkoutRouter mounted)
- ✅ Commit f6b70b5 — FOUND
- ✅ Commit b73b9cb — FOUND