# Interview Coder SaaS

## What This Is

Interview Coder is an Electron desktop application that helps users prepare for technical coding interviews using AI assistance (screenshot analysis, solution generation, debugging). The current open-source version requires users to bring their own API keys. We are transforming it into a commercial SaaS product by building a backend service that handles authentication, credits/billing, and AI API proxying — removing the need for users to manage API keys.

## Core Value

Users can access AI-powered interview assistance through a simple credits-based system without managing their own API keys.

## Requirements

### Validated

- ✓ Desktop app captures screenshots and processes them via AI providers — existing
- ✓ Supports OpenAI, Gemini, and Anthropic as AI providers — existing
- ✓ Local config stores user preferences and API keys — existing
- ✓ Wizard flow for onboarding — existing
- ✓ Live interview mode with real-time audio — existing
- ✓ Session history stored locally — existing

### Active

- [x] User can create account and log in via the backend service — Validated in Phase 01: Backend Foundation & Auth
- [ ] User session persists across app restarts with automatic token refresh
- [x] AI API keys are stored securely on the server (never sent to client) — Validated in Phase 02: AI Proxy Service
- [x] AI processing requests are proxied through the backend — Validated in Phase 02: AI Proxy Service
- [ ] Each AI operation deducts credits from the user's balance
- [ ] Users can view their current credit balance in the app
- [ ] Users can purchase credit packages via Stripe Checkout
- [ ] Users are blocked from AI operations when credits reach zero
- [ ] Electron app integrates with backend auth (login/signup UI)
- [ ] Electron app routes all AI calls through the backend instead of direct API calls
- [ ] Users can view payment history and receipts

### Out of Scope

- Mobile apps — this is a desktop-only product for v1
- Team/organization accounts — individual users only for v1
- Free tier with unlimited usage — credits-based model only
- Social login (Google, GitHub) — email/password only for v1; OAuth deferred
- Admin dashboard for credit configuration — manual config for v1
- Data encryption at rest for API keys — environment variable storage is sufficient for v1
- Rate limiting beyond per-user credit enforcement — simple enforcement only
- Internationalization of payment flows — USD only for v1

## Context

- **Existing codebase**: Well-structured Electron + React app with TypeScript, using Vite for builds
- **Architecture**: Main process (Electron) handles AI API calls directly; IPC bridge connects to renderer
- **Current auth**: None — the app is free/open, users provide their own API keys
- **Current payment**: None
- **AI providers**: OpenAI, Google Gemini, Anthropic Claude — all called client-side with user-provided keys
- **Config**: Stored in `config.json` in user data directory via ConfigHelper
- **Processing pipeline**: ProcessingProviderOrchestrator selects provider based on config, calls APIs directly
- **IPC contract**: Well-defined in `electron/preload.ts` and `src/types/electron.d.ts`
- **Security concern**: API keys stored in plain text locally (acknowledged in AGENTS.md)
- **Tech stack**: Electron 40, React 19, TypeScript 5.4, Vite 6, TanStack Query, Radix UI, Tailwind 4

## Constraints

- **Tech stack**: Backend must be TypeScript/Node.js for team familiarity and type sharing with frontend
- **Payment**: Stripe for payment processing (industry standard, well-documented SDKs)
- **Database**: PostgreSQL for persistent storage (required for transactional billing data)
- **Deployment**: Must support cloud deployment (AWS/GCP) with Docker
- **Backward compat**: Existing desktop app users must be migrated smoothly (forced auth after update)
- **Security**: API keys must never be exposed to the client; all AI calls must go through the backend
- **Performance**: Backend AI proxy must add <500ms latency over direct API calls

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate backend service (not embedded in Electron) | Scales independently, serves web dashboard in future, standard SaaS architecture | — Pending |
| JWT-based auth with refresh tokens | Stateless auth, works well with Electron's persistent sessions | — Pending |
| Credits-based billing (not subscription) | Matches usage pattern (variable AI usage per session), simpler to implement first | — Pending |
| Stripe Checkout for payments | Industry standard, handles PCI compliance, supports one-time payments | — Pending |
| PostgreSQL for database | ACID transactions needed for credit/billing, mature, well-supported | — Pending |
| Backend as AI proxy (not just key store) | Prevents key leakage since client never sees API keys, enables usage tracking | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-11 after initialization*