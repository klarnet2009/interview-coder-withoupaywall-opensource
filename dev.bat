@echo off
echo Stopping old Electron processes...
taskkill /F /IM electron.exe 2>nul
timeout /t 1 /nobreak >nul
echo Starting dev server...
cd /d "%~dp0"
npm run dev
