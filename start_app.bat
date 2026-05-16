@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "BACKEND_TITLE=CoCI Backend"
set "FRONTEND_TITLE=CoCI Frontend"

title CoCI Launcher
echo Starting CoCI Project...
echo.

echo Starting Backend Server...
start "%BACKEND_TITLE%" /D "%ROOT%backend" cmd /c "title %BACKEND_TITLE% && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo Waiting for backend to initialize...
timeout /t 10 /nobreak >nul

echo Starting Frontend and Electron...
start "%FRONTEND_TITLE%" /D "%ROOT%frontend" cmd /c "title %FRONTEND_TITLE% && npm run electron:dev"

echo.
echo CoCI is running.
echo.
echo Press ENTER in this launcher window to stop backend, frontend, and Electron.
set /p "_="

echo.
echo Stopping CoCI...

call :KillWindow "%FRONTEND_TITLE%"
call :KillWindow "%BACKEND_TITLE%"
call :KillProjectProcesses

echo Done. CoCI has been stopped.
timeout /t 2 /nobreak >nul
exit /b 0

:KillWindow
set "TARGET_TITLE=%~1"
taskkill /FI "WINDOWTITLE eq %TARGET_TITLE%*" /T /F >nul 2>nul
exit /b 0

:KillProjectProcesses
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = [IO.Path]::GetFullPath($args[0]);" ^
  "$names = @('python.exe', 'pythonw.exe', 'node.exe', 'electron.exe');" ^
  "Get-CimInstance Win32_Process | Where-Object {" ^
  "  $names -contains $_.Name -and (" ^
  "    ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) -or" ^
  "    ($_.CommandLine -and $_.CommandLine.IndexOf($root, [StringComparison]::OrdinalIgnoreCase) -ge 0)" ^
  "  )" ^
  "} | ForEach-Object {" ^
  "  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue" ^
  "}" "%ROOT%" >nul 2>nul
exit /b 0
