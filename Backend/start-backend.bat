@echo off
cd /d "%~dp0"

set "PY_CMD="
if defined PYTHON_EXE if exist "%PYTHON_EXE%" set "PY_CMD=%PYTHON_EXE%"
if not defined PY_CMD if exist "%~dp0venv\Scripts\python.exe" "%~dp0venv\Scripts\python.exe" --version >nul 2>nul && set "PY_CMD=%~dp0venv\Scripts\python.exe"
if not defined PY_CMD where python >nul 2>nul && python --version >nul 2>nul && set "PY_CMD=python"
if defined PY_CMD goto start

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 --version >nul 2>nul
  if not %errorlevel%==0 goto missing
  echo Starting MediRaksha backend on all interfaces: http://0.0.0.0:8000
  echo Local test URL: http://127.0.0.1:8000/api/health
  py -3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
  exit /b %errorlevel%
)

:missing
echo Python was not found. Add Python 3.10 to PATH, fix the venv, or set PYTHON_EXE to your python.exe path.
exit /b 1

:start
echo Starting MediRaksha backend on all interfaces: http://0.0.0.0:8000
echo Local test URL: http://127.0.0.1:8000/api/health
"%PY_CMD%" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
