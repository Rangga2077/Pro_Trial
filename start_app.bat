@echo off
echo Starting CoCI Project...

:: Start Backend
echo Starting Backend Server...
:: Activate venv and run uvicorn in the same cmd context
start "CoCI Backend" cmd /k "cd backend && call venv\Scripts\activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Wait a moment for backend to initialize
timeout /t 10 /nobreak >nul

:: Start Frontend
echo Starting Frontend (Electron)...
start "CoCI Frontend" cmd /k "cd frontend && npm run electron:dev"

echo System services started in separate windows.
echo You can close this window if you wish, or keep it open.
pause
