# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript 5.4.2 — Main process (`electron/`) and renderer process (`src/`)

**Secondary:**
- CSS — Styling with Tailwind CSS 4.1.18

## Runtime

**Environment:**
- Electron 40.2.1 — Desktop application runtime
- Node.js 16+ (required by Electron)

**Package Manager:**
- npm — primary package manager
- bun — also supported (bun.lockb present)
- Lockfile: `package-lock.json` (npm) and `bun.lockb` (bun)

## Frameworks

**Core:**
- Electron 40.2.1 — Desktop application shell (multi-process architecture)
- React 19.2.4 — UI rendering library for renderer process
- Vite 6.2.5 — Build tool and dev server for renderer process

**State Management:**
- TanStack Query (@tanstack/react-query 5.64.0) — Async state management
- React component state — Local state via `useState`/`useEffect`

**Routing:**
- react-router-dom 7.13.0 — Client-side routing

**Styling:**
- Tailwind CSS 4.1.18 — Utility-first CSS framework
- @tailwindcss/postcss 4.1.18 — PostCSS plugin
- @tailwindcss/vite 4.1.18 — Vite plugin
- @emotion/react 11.11.0 + @emotion/styled 11.11.0 — CSS-in-JS (secondary)
- class-variance-authority 0.7.1 — Variant-based component classes
- clsx 2.1.1 + tailwind-merge 3.4.0 — Conditional class merging

**UI Components:**
- @radix-ui/react-dialog 1.1.2 — Accessible dialog primitives
- @radix-ui/react-label 2.1.0 — Accessible label primitives
- @radix-ui/react-slot 1.1.0 — Composition primitives
- @radix-ui/react-toast 1.2.2 — Toast notification primitives
- lucide-react 0.460.0 — Icon library
- react-code-blocks 0.1.6 — Code highlighting (renderer)
- react-syntax-highlighter 16.1.0 — Syntax highlighting (renderer)

**Testing:**
- Vitest 2.1.9 — Test runner and framework
- @testing-library/react 16.3.2 — React testing utilities
- @testing-library/jest-dom 6.9.1 — DOM assertion matchers
- jsdom 28.0.0 — DOM environment simulation

**Build/Dev:**
- vite-plugin-electron 0.28.4 — Electron integration for Vite
- vite-plugin-electron-renderer 0.14.6 — Renderer process Vite plugin
- @vitejs/plugin-react 5.1.3 — React Fast Refresh for Vite
- cross-env 7.0.3 — Cross-platform environment variables
- concurrently 8.2.2 — Run multiple commands concurrently
- wait-on 9.0.3 — Wait for resources before proceeding
- rimraf 6.0.1 — Cross-platform rm -rf
- electron-builder 26.7.0 — Application packaging and distribution

**Linting:**
- ESLint 9.39.2 — JavaScript/TypeScript linter (flat config format)
- @typescript-eslint/eslint-plugin 8.54.0 — TypeScript ESLint rules
- @typescript-eslint/parser 8.54.0 — TypeScript parser for ESLint
- @typescript-eslint/utils 8.54.0 — ESLint TypeScript utilities
- eslint-plugin-react-hooks 5.2.0 — React hooks lint rules
- eslint-plugin-react-refresh 0.5.0 — React Refresh lint rules
- @eslint/js 9.39.2 — Core ESLint JS rules
- @eslint/json 1.0.0 — JSON linting
- @eslint/css 0.14.1 — CSS linting
- @eslint/markdown 7.5.1 — Markdown linting

## Key Dependencies

**AI/ML SDKs:**
- openai 6.18.0 — OpenAI API client (GPT-4o, GPT-4o-mini models)
- @anthropic-ai/sdk 0.73.0 — Anthropic Claude API client (Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3 Opus)
- Google Gemini — Called via raw REST/WebSocket (no SDK; uses `axios` and `ws`)
  - Gemini models: `gemini-2.0-flash`, `gemini-2.5-flash-preview`, `gemini-3-flash-preview`, `gemini-3-pro-preview`
  - Gemini Live API via WebSocket: `gemini-2.5-flash-native-audio-preview-12-2025`

**Networking:**
- axios 1.7.7 — HTTP client (used for Gemini REST API calls, API key validation, audio transcription)
- ws 8.19.0 — WebSocket client (used for Gemini Live API real-time audio streaming)

**Electron Ecosystem:**
- electron-log 5.2.4 — Structured logging for main process
- electron-store 10.0.0 — Key-value storage (declared in package.json but replaced by custom `electron/store.ts` using `fs`)
- electron-updater 6.3.9 — Auto-update functionality using GitHub releases
- @electron/notarize 2.3.0 — macOS app notarization

**File & Data:**
- dotenv 17.2.4 — Environment variable loading from `.env` files
- form-data 4.0.1 — Multipart form data construction
- uuid 11.0.3 — UUID generation for screenshot filenames
- pdf-parse 2.4.5 — PDF text extraction for CV/resume parsing

**Internationalization:**
- i18next 25.8.4 — i18n framework
- react-i18next 16.5.4 — React bindings for i18next

**Screen Capture:**
- screenshot-desktop 1.15.0 — Cross-platform screenshot capture (fallback method on Windows)

**Text Processing:**
- diff 7.0.0 — Diff computation for code comparison

## Configuration

**TypeScript:**
- `tsconfig.json` — Renderer process (ES2020 target, bundler module resolution, JSX react-jsx)
- `tsconfig.electron.json` — Main process (ES2020 target, CommonJS module, strict null checks, no implicit any)
- `tsconfig.node.json` — Node tooling config (referenced by renderer tsconfig)

**Build:**
- `vite.config.ts` — Vite configuration with Electron plugin, path aliases, code splitting
- `postcss.config.js` — PostCSS configuration for Tailwind
- `eslint.config.mjs` — ESLint flat config with TypeScript, JSON, CSS support

**Environment:**
- `.env` — Environment variables (loaded by `dotenv` in `electron/main.ts`)
  - Development: loaded from project root `.env`
  - Production: loaded from `process.resourcesPath/.env` (bundled as extraResource)
- `GH_TOKEN` — Required for auto-updater in production (checked in `electron/autoUpdater.ts`)

**Path Aliases:**
- `@` → `src/` (configured in both `vite.config.ts` and `vitest.config.ts`)

**Vite Code Splitting:**
- `code-highlighting` chunk: react-syntax-highlighter, react-code-blocks, highlight.js, refractor
- `radix-ui` chunk: @radix-ui packages
- `react-query` chunk: @tanstack/react-query
- `i18n` chunk: react-i18next, i18next
- `react-core` chunk: react, react-dom
- `vendor` chunk: all other node_modules

## Platform Requirements

**Development:**
- Node.js 16+ for Electron 40 compatibility
- npm or bun package manager
- OS screen recording permissions (for screenshot feature)
- macOS: `xcode-select --install` for native modules

**Production:**
- Cross-platform packaging: macOS (DMG, ZIP for x64/arm64), Windows (NSIS), Linux (AppImage)
- macOS: Hardened runtime, Gatekeeper assessment disabled, notarization enabled, custom entitlements
- Custom protocol: `interview-coder://` registered on all platforms
- Auto-update via `electron-updater` with GitHub Releases provider (owner: `ibttf`, repo: `interview-coder`)

---

*Stack analysis: 2026-04-11*