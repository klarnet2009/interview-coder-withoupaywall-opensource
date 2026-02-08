# Development Workflow (EN)

## Prerequisites

- Node.js 16+
- npm (or bun for install compatibility)
- OS permissions for screen/audio capture when required

## Core Commands

From `package.json`:

- `npm run dev`: clean + watch Electron TS + run Vite dev server + launch Electron
- `npm start`: development launch without `clean` step
- `npm run build`: production renderer build + Electron TS build
- `npm run run-prod`: run built Electron main
- `npm run lint`: run ESLint
- `npm test`: run Vitest once
- `npm run test:watch`: run Vitest watch mode
- `npm run test:coverage`: coverage run
- `npm run check:bundle`: enforce renderer bundle size budget on built assets
- `npm run package`: build and package via Electron Builder

## Dev Runtime Notes

- Renderer dev URL: `http://localhost:54321`
- Main and preload output: `dist-electron`
- Renderer output: `dist`
- In dev mode, window invisibility protections are relaxed for debugging.

## Typical Local Loop

1. `npm install`
2. `npm run dev`
3. Validate hotkeys, screenshot flow, and live interview flow manually
4. Run `npm run lint` and `npm test` before commit

## Build and Packaging

- mac package: `npm run package-mac`
- windows package: `npm run package-win`
- output directory: `release`

## Testing Status

Current automated tests include both unit and integration coverage.

- Unit tests:
  - `tests/unit/validation.test.ts`
  - `tests/unit/sessionRestore.test.ts`
  - `tests/unit/responseFormatters.test.ts`
- Integration tests:
  - `tests/integration/ipcContract.integration.test.ts`
  - `tests/integration/liveInterviewLifecycle.integration.test.ts`
  - `tests/integration/processingHelper.integration.test.ts`

## Troubleshooting

### Dev hotkeys appear pressed but no action

- Confirm global shortcuts were successfully registered (currently no registration-result checks).
- Confirm no OS/global app conflict on those key combinations.
- Verify Electron window exists and is not destroyed.
- Add temporary logs around `globalShortcut.register(...)` return values.

### Live interview starts but appears stalled

- Verify audio source contains actual audio track.
- Check `live-interview-status` updates in renderer.
- Confirm transcript delta is moving and hint trigger conditions are met.

### Git history/diff errors due packfile corruption

- Working commands (`status`, build, test) may still function.
- If needed, run repository maintenance/reclone outside feature branch workflow.

## Suggested Team Conventions

1. Keep IPC channel changes synchronized across `ipcHandlers`, `preload`, and `src/types/electron.d.ts` in one PR.
2. Prefer strict typing for IPC payloads and avoid `any` in new code.
3. Add regression tests whenever fixing cross-process behavior.
4. Keep docs updated when introducing channels, states, or persistence schema changes.
