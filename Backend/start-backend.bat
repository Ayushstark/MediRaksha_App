@echo off
cd /d "%~dp0"
echo Starting MediRaksha Express backend: http://0.0.0.0:3000
echo Health check: http://127.0.0.1:3000/api/health
npm.cmd start
