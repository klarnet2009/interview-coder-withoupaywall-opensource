# Requirements: Interview Coder SaaS

## v1 Requirements

### Authentication (AUTH)

- [x] **AUTH-01**: User can create an account with email and password
- [x] **AUTH-02**: User can log in with email and password
- [x] **AUTH-03**: User can log out from the app
- [x] **AUTH-04**: User session persists across app restarts with automatic token refresh
- [ ] **AUTH-05**: User can reset their password via email link

### Backend Infrastructure (BKND)

- [x] **BKND-01**: Backend API service is deployable with health-check endpoints
- [x] **BKND-02**: API keys (OpenAI, Gemini, Anthropic) are stored securely on the server using environment variables — never exposed to clients
- [x] **BKND-03**: AI API calls are proxied through the backend (client sends request to backend, backend calls AI provider)
- [x] **BKND-04**: API requests are rate-limited per authenticated user
- [x] **BKND-05**: Database stores users, sessions, and credit transactions with ACID guarantees

### Credits & Billing (CRED)

- [x] **CRED-01**: Users start with a set of free credits on signup (configurable amount)
- [x] **CRED-02**: Users can purchase credit packages via Stripe Checkout (one-time payment)
- [x] **CRED-03**: Each AI operation (extraction, solution, debug) deducts credits from the user's balance based on operation type
- [x] **CRED-04**: Users can view their current credit balance in the app
- [x] **CRED-05**: Users are blocked from AI operations when their credit balance reaches zero (with clear error message)
- [ ] **CRED-06**: Admin can configure credit costs per operation type via environment variables

### Payment (PAY)

- [x] **PAY-01**: Users can pay with credit card via Stripe Checkout integration
- [x] **PAY-02**: Payment confirmation triggers automatic credit addition to user account
- [ ] **PAY-03**: Users receive email confirmation after purchase
- [ ] **PAY-04**: Users can view payment history in the app

### Client Integration (CLNT)

- [ ] **CLNT-01**: Electron app shows login/signup screen on first launch (replaces wizard for API key entry)
- [ ] **CLNT-02**: Electron app sends auth token (JWT) with every backend API call
- [ ] **CLNT-03**: Electron app displays current credit balance in the UI
- [ ] **CLNT-04**: Electron app shows warnings when credits are low (threshold configurable) or depleted
- [ ] **CLNT-05**: Electron app provides a way to purchase more credits (opens Stripe Checkout or in-app redirect)
- [ ] **CLNT-06**: Electron app handles token refresh and session expiry gracefully (re-auth without losing state)

## v2 Requirements (Deferred)

- [ ] OAuth login (Google, GitHub) — deferred to reduce v1 scope
- [ ] Subscription billing model — deferred; credits-based first
- [ ] Admin dashboard for credit/invoice management — deferred
- [ ] Team/organization accounts — deferred
- [ ] Web dashboard for account management — deferred
- [ ] Multi-currency payment support — deferred (USD only for v1)
- [ ] Referral/invite credit system — deferred
- [ ] Usage analytics dashboard — deferred

## Out of Scope

- Mobile apps — desktop-only product for v1
- Free tier with unlimited usage — credits are the monetization model
- Data encryption at rest for API keys — environment variables sufficient for v1
- Real-time collaboration features — not relevant to this product
- Content moderation/censorship of AI outputs — deferred indefinitely
- Custom model fine-tuning — out of scope for SaaS transformation

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 5 | Pending |
| BKND-01 | Phase 1 | Complete |
| BKND-02 | Phase 2 | Complete |
| BKND-03 | Phase 2 | Complete |
| BKND-04 | Phase 2 | Complete |
| BKND-05 | Phase 1 | Complete |
| CRED-01 | Phase 3 | Complete |
| CRED-02 | Phase 3 | Complete |
| CRED-03 | Phase 3 | Complete |
| CRED-04 | Phase 3 | Complete |
| CRED-05 | Phase 3 | Complete |
| CRED-06 | Phase 5 | Pending |
| PAY-01 | Phase 3 | Complete |
| PAY-02 | Phase 3 | Complete |
| PAY-03 | Phase 5 | Pending |
| PAY-04 | Phase 5 | Pending |
| CLNT-01 | Phase 4 | Pending |
| CLNT-02 | Phase 4 | Pending |
| CLNT-03 | Phase 4 | Pending |
| CLNT-04 | Phase 4 | Pending |
| CLNT-05 | Phase 4 | Pending |
| CLNT-06 | Phase 4 | Pending |