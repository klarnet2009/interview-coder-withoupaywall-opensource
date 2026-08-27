<!-- GSD:project-start source:PROJECT.md -->
## Project

**Interview Coder SaaS**

Interview Coder is an Electron desktop application that helps users prepare for technical coding interviews using AI assistance (screenshot analysis, solution generation, debugging). The current open-source version requires users to bring their own API keys. We are transforming it into a commercial SaaS product by building a backend service that handles authentication, credits/billing, and AI API proxying — removing the need for users to manage API keys.

**Core Value:** Users can access AI-powered interview assistance through a simple credits-based system without managing their own API keys.

### Constraints

- **Tech stack**: Backend must be TypeScript/Node.js for team familiarity and type sharing with frontend
- **Payment**: Stripe for payment processing (industry standard, well-documented SDKs)
- **Database**: PostgreSQL for persistent storage (required for transactional billing data)
- **Deployment**: Must support cloud deployment (AWS/GCP) with Docker
- **Backward compat**: Existing desktop app users must be migrated smoothly (forced auth after update)
- **Security**: API keys must never be exposed to the client; all AI calls must go through the backend
- **Performance**: Backend AI proxy must add <500ms latency over direct API calls
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
