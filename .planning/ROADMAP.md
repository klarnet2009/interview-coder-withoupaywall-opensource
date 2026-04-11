# Roadmap: Interview Coder SaaS

## Overview

Transform Interview Coder from a free open-source desktop app (where users bring their own API keys) into a commercial SaaS product by building a backend service that handles authentication, credits/billing, and AI API proxying. The Electron app will be modified to connect to this backend instead of calling AI providers directly. The journey goes from backend foundation through auth, AI proxy, billing, and finally full client integration.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Backend Foundation & Auth** - Deployable backend with database, user accounts, and login sessions
- [ ] **Phase 2: AI Proxy Service** - Backend proxies all AI calls with secure key management and rate limiting
- [ ] **Phase 3: Credits & Billing** - Credits system, Stripe payments, and usage enforcement
- [ ] **Phase 4: Client Integration** - Electron app connects to backend for auth, AI calls, and credits
- [ ] **Phase 5: Polish & Completeness** - Password reset, payment history, admin config, and production readiness

## Phase Details

### Phase 1: Backend Foundation & Auth
**Goal**: Users can create accounts and authenticate through the backend service
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, BKND-01, BKND-05
**Success Criteria** (what must be TRUE):
  1. Backend API is deployed and responds to health-check endpoints
  2. User can create an account with email and password through the API
  3. User can log in and receive a valid JWT access token and refresh token
  4. User can make authenticated API requests using the access token
  5. User session persists when the access token is refreshed via the refresh token
**Plans**: 2 plans
- [x] 01-01-PLAN.md — Backend project setup, Prisma schema, health-check endpoints
- [x] 01-02-PLAN.md — Auth endpoints (register, login, logout, refresh), JWT middleware

### Phase 2: AI Proxy Service
**Goal**: All AI processing goes through the backend with API keys secured server-side
**Depends on**: Phase 1
**Requirements**: BKND-02, BKND-03, BKND-04
**Success Criteria** (what must be TRUE):
  1. AI provider API keys are read from server environment variables and never sent to clients
  2. Authenticated user can submit an AI processing request to the backend and receive a response proxied from the AI provider
  3. Backend rate-limits requests per user within configurable time windows
  4. Backend returns appropriate error codes for unauthenticated or rate-limited requests
**Plans**: 2 plans
- [x] 02-01-PLAN.md — AI provider service, processing types, and provider implementations (OpenAI, Gemini, Anthropic)
- [x] 02-02-PLAN.md — Rate limiting middleware, processing proxy routes, and integration tests

### Phase 3: Credits & Billing
**Goal**: Users can buy credits and every AI operation draws from their balance
**Depends on**: Phase 2
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-04, CRED-05, PAY-01, PAY-02
**Success Criteria** (what must be TRUE):
  1. New user receives free credits upon account signup
  2. User can purchase credit packages via Stripe Checkout and credits are added immediately after payment confirmation
  3. Each AI operation (extraction, solution, debug) deducts the appropriate number of credits from the user's balance
  4. User can query their current credit balance via the API
  5. User with zero credits receives a clear error when attempting an AI operation
**Plans**: 2 plans
- [x] 03-01-PLAN.md — Credit system foundation: Prisma schema, CreditService, balance API, credit check middleware
- [ ] 03-02-PLAN.md — Stripe Checkout integration: checkout sessions, webhook handler, payment confirmation
**UI hint**: yes

### Phase 4: Client Integration
**Goal**: The Electron app authenticates via the backend and routes all AI operations through it
**Depends on**: Phase 3
**Requirements**: CLNT-01, CLNT-02, CLNT-03, CLNT-04, CLNT-05, CLNT-06
**Success Criteria** (what must be TRUE):
  1. Electron app shows a login/signup screen on first launch and after session expiry
  2. Authenticated user in the Electron app can trigger AI operations that go through the backend instead of direct API calls
  3. User sees their current credit balance in the app UI
  4. User sees a warning when credits are low and a blocking message when credits are depleted
  5. User can navigate to purchase more credits from within the app
  6. Token refresh happens automatically without losing the user's current work state
**Plans**: TBD
**UI hint**: yes

### Phase 5: Polish & Completeness
**Goal**: The product is ready for real users with password recovery, payment history, and admin configurability
**Depends on**: Phase 4
**Requirements**: AUTH-05, CRED-06, PAY-03, PAY-04
**Success Criteria** (what must be TRUE):
  1. User can reset their password via an email link when they forget it
  2. Admin can adjust credit costs per operation type by changing environment variables
  3. User receives an email confirmation after each credit purchase
  4. User can view their payment history within the app
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Foundation & Auth | 2/2 | Complete | 2026-04-11 |
| 2. AI Proxy Service | 0/2 | Not started | - |
| 3. Credits & Billing | 0/2 | Not started | - |
| 4. Client Integration | 0/? | Not started | - |
| 5. Polish & Completeness | 0/? | Not started | - |