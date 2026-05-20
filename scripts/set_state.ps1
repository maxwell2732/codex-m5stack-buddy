param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("idle", "running", "waiting", "done", "error", "research", "break", "longbreak")]
    [string]$State
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StateDir = Join-Path $ProjectRoot "state"
$CurrentState = Join-Path $StateDir "current_state.json"

if (-not (Test-Path $StateDir)) {
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
}

function Write-JsonWithRetry {
    param(
        [object]$Payload,
        [string]$Path
    )

    $TempPath = "$Path.tmp"
    $Payload | ConvertTo-Json -Depth 6 | Set-Content -Path $TempPath -Encoding UTF8

    for ($attempt = 1; $attempt -le 5; $attempt++) {
        try {
            Move-Item -LiteralPath $TempPath -Destination $Path -Force
            return
        } catch {
            if ($attempt -eq 5) {
                throw
            }
            Start-Sleep -Milliseconds (80 * $attempt)
        }
    }
}

$payload = [ordered]@{
    source = "manual"
    state = $State
    event_type = "manual-state-change"
    thread_id = "simulator"
    turn_id = "manual_$State"
    cwd = $ProjectRoot
    last_assistant_message = "Simulator state set to $State."
    input_messages = @("set_state.ps1 $State")
    updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

Write-JsonWithRetry $payload $CurrentState
Write-Host "Codex Buddy simulator state set to '$State'."
Write-Host "Updated $CurrentState"
