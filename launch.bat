@echo off
echo ==========================================
echo   Interview Assistant - UX Redesign 2025
echo ==========================================
echo.

REM Check if we're in the right directory
if not exist "dist-electron\main.js" (
    echo [ERROR] Build files not found!
    echo.
    echo Please build first:
    echo   npm run build
    echo.
    pause
    exit /b 1
)

echo [1/2] Starting Electron...
cd /d "%~dp0"

REM Use local electron
set ELECTRON_PATH=node_modules\.bin\electron.cmd

if not exist "%ELECTRON_PATH%" (
    echo [ERROR] Electron not found!
    echo Please run: npm install
    pause
    exit /b 1
)

echo [2/2] Launching app...
echo.
echo ==========================================
echo  HOTKEYS:
echo    Ctrl+B  - Toggle visibility
echo    Ctrl+H  - Take screenshot
echo    Ctrl+Enter - Process
echo    Ctrl+Space - Pause/Resume
echo ==========================================
echo.

"%ELECTRON_PATH%" dist-electron\main.js

if errorlevel 1 (
    echo.
    echo [ERROR] App failed to start
    echo Try running: npm run build
    pause
)
