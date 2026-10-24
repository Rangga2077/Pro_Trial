@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "BACKEND_TITLE=CoCI Backend"
set "FRONTEND_TITLE=CoCI Frontend"
set "OLLAMA_TITLE=CoCI Ollama"

title CoCI Launcher
echo Starting CoCI Project...
echo.

rem Ask Jenny needs Ollama. Start it before the backend so the backend can
rem warm the model up at startup. If it already runs, it is left alone.
echo Checking Ollama for Ask Jenny...
curl.exe -s -o nul -m 2 http://127.0.0.1:11434/api/tags && (
    echo Ollama is already running.
    goto OllamaReady
)
set "OLLAMA_EXE=ollama"
where ollama >nul 2>nul || set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not "%OLLAMA_EXE%"=="ollama" if not exist "%OLLAMA_EXE%" (
    echo Ollama not found - CoCI runs without Ask Jenny answers. Install it from https://ollama.com
    goto OllamaReady
)
echo Starting Ollama...
start "%OLLAMA_TITLE%" /min cmd /c "title %OLLAMA_TITLE% && "%OLLAMA_EXE%" serve"
set /a OLLAMA_WAITED=0
:WaitOllama
curl.exe -s -o nul -m 2 http://127.0.0.1:11434/api/tags && (
    echo Ollama is up.
    goto OllamaReady
)
set /a OLLAMA_WAITED+=1
if %OLLAMA_WAITED% GEQ 30 (
    echo Ollama did not answer after 30 s - continuing; Ask Jenny answers once it is up.
    goto OllamaReady
)
timeout /t 1 /nobreak >nul
goto WaitOllama
:OllamaReady
echo.

echo Starting Backend Server...
rem 127.0.0.1: reachable from this PC only, not from the rest of the network.
start "%BACKEND_TITLE%" /D "%ROOT%backend" cmd /c "title %BACKEND_TITLE% && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

echo Waiting for backend to answer on port 8000 (up to 90 s; first start loads YOLO, MediaPipe and Vosk)...
set /a WAITED=0
:WaitBackend
curl.exe -s -o nul -m 2 http://127.0.0.1:8000/ && (
    echo Backend is up.
    goto BackendReady
)
set /a WAITED+=1
if %WAITED% GEQ 90 (
    echo Backend did not answer after 90 s - starting the frontend anyway; it keeps retrying.
    goto BackendReady
)
timeout /t 1 /nobreak >nul
goto WaitBackend
:BackendReady

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
rem Only closes Ollama if this launcher started it (frees the GPU memory).
call :KillWindow "%OLLAMA_TITLE%"
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
