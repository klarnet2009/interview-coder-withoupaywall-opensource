# 🚀 Launch Interview Assistant

## Quick Start (Windows)

### Option 1: Run from source
```bash
# 1. Install dependencies
npm install

# 2. Build the application
npm run build

# 3. Launch
launch.bat
```

### Option 2: Run in dev mode
```bash
npm run dev
```

## Build Production Package

```bash
# Windows installer
npm run package-win

# macOS DMG
npm run package-mac
```

## What's New (UX Redesign 2025)

### ✅ Implemented Features

1. **Wizard Onboarding**
   - Quick Start (3 steps) - Get started in 60 seconds
   - Advanced Setup (8 steps) - Full customization
   - Provider selection (Gemini/OpenAI/Anthropic)
   - API key testing with connection status
   - Profile creation with CV upload
   - Interview mode configuration
   - Audio setup with VU meter
   - Display & stealth mode settings

2. **New UI Components**
   - `StatusBar` - Provider, latency, status, language
   - `UnifiedInput` - Screenshots + text input
   - `AIResponse` - AI answers with quick actions
   - `ControlBar` - Pause, clear, style selector
   - `DebugView` - Pipeline logs, test input
   - `ProfileManager` - CRUD profiles, CV upload
   - `SessionHistory` - Interview history, snippets

3. **Technical Improvements**
   - Full TypeScript support
   - Design system with consistent styling
   - Extended ConfigHelper with profiles
   - New IPC handlers for wizard
   - Debug mode with pipeline visualization

## Hotkeys

| Action | Hotkey |
|--------|--------|
| Toggle visibility | Ctrl + ` |
| Pause/Resume | Ctrl + Space |
| Take screenshot | Ctrl + H |
| Delete last screenshot | Ctrl + L |
| Process screenshots | Ctrl + Enter |
| Reset view | Ctrl + R |
| Copy last answer | Ctrl + Shift + C |

## Configuration

Config file location:
- Windows: `%APPDATA%/interview-coder-v1/config.json`
- macOS: `~/Library/Application Support/interview-coder-v1/config.json`
