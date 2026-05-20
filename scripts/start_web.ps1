$ErrorActionPreference = "Stop"

param(
    [int]$Port = 8000
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Get-PythonExe {
    $commandNames = @("python", "python3")
    foreach ($name in $commandNames) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($null -ne $command) {
            try {
                & $command.Source --version *> $null
                if ($LASTEXITCODE -eq 0) {
                    return $command.Source
                }
            } catch {
                # Ignore broken app execution aliases and keep looking.
            }
        }
    }

    $condaRoot = Join-Path $HOME ".conda\envs"
    if (Test-Path $condaRoot) {
        $condaPython = Get-ChildItem -Path (Join-Path $condaRoot "*\python.exe") -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($null -ne $condaPython) {
            return $condaPython.FullName
        }
    }

    throw "Could not find a working Python interpreter. Install Python or activate a Conda environment."
}

$PythonExe = Get-PythonExe
$Url = "http://127.0.0.1:$Port/web/"

Write-Host "Starting codex-m5stack-buddy web simulator..."
Write-Host "Project root: $ProjectRoot"
Write-Host "URL: $Url"
Write-Host "Keep this PowerShell window open. Press Ctrl+C to stop."
Write-Host ""

& $PythonExe -m http.server $Port --bind 127.0.0.1 --directory $ProjectRoot
