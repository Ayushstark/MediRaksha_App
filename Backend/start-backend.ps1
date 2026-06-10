Set-Location $PSScriptRoot
Write-Host "Starting MediRaksha Express backend: http://0.0.0.0:3000"
Write-Host "Health check: http://127.0.0.1:3000/api/health"
npm.cmd start
