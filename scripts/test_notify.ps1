$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NotifyScript = Join-Path $ProjectRoot "codex_buddy_notify.py"
$StatusScript = Join-Path $ProjectRoot "buddy_status.py"
$EventsLog = Join-Path $ProjectRoot "logs\events.jsonl"
$CurrentState = Join-Path $ProjectRoot "state\current_state.json"

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

$payload = [ordered]@{
    type = "agent-turn-complete"
    "thread-id" = "thread_test_codex_buddy"
    "turn-id" = "turn_test_001"
    cwd = $ProjectRoot
    "input-messages" = @("Create Codex Buddy Bridge v0.1")
    "last-assistant-message" = "Codex Buddy Bridge test event completed."
} | ConvertTo-Json -Compress

Write-Host "Sending simulated Codex notify payload..."
$payloadForNativeCommand = $payload.Replace('"', '\"')
& $PythonExe $NotifyScript $payloadForNativeCommand

if (-not (Test-Path $EventsLog)) {
    throw "Expected log file was not created: $EventsLog"
}

if (-not (Test-Path $CurrentState)) {
    throw "Expected state file was not created: $CurrentState"
}

Write-Host ""
Write-Host "Current buddy status:"
& $PythonExe $StatusScript

Write-Host ""
Write-Host "Generated files:"
Write-Host "  $EventsLog"
Write-Host "  $CurrentState"
