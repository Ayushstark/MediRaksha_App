Set-Location $PSScriptRoot

$pythonCandidates = @()
if ($env:PYTHON_EXE) {
    $pythonCandidates += $env:PYTHON_EXE
}
$pythonCandidates += Join-Path $PSScriptRoot "venv\Scripts\python.exe"
$pythonCandidates += "python"
$pythonCandidates += "py"

$pythonCommand = $null
$pythonArgs = @()

foreach ($candidate in $pythonCandidates) {
    if ($candidate -eq "py") {
        $command = Get-Command py -ErrorAction SilentlyContinue
        if ($command) {
            & py -3 --version *> $null
            if ($LASTEXITCODE -ne 0) {
                continue
            }
            $pythonCommand = "py"
            $pythonArgs = @("-3")
            break
        }
        continue
    }

    if ((Test-Path $candidate) -or (Get-Command $candidate -ErrorAction SilentlyContinue)) {
        & $candidate --version *> $null
        if ($LASTEXITCODE -ne 0) {
            continue
        }
        $pythonCommand = $candidate
        break
    }
}

if (-not $pythonCommand) {
    Write-Error "Python was not found. Add Python 3.10 to PATH, fix the venv, or run: `$env:PYTHON_EXE='C:\Users\Ayush Kumar Pal\AppData\Local\Programs\Python\Python310\python.exe'; .\start-backend.ps1"
    exit 1
}

try {
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" } |
        Select-Object -First 1 -ExpandProperty IPAddress)
} catch {
    $lanIp = $null
}

Write-Host "Starting MediRaksha backend on all interfaces: http://0.0.0.0:8000"
Write-Host "Local test URL: http://127.0.0.1:8000/api/health"
if ($lanIp) {
    Write-Host "Expo Go URL: http://${lanIp}:8000/api/health"
}
& $pythonCommand @pythonArgs -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
