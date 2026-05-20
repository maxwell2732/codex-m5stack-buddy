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

$payload | ConvertTo-Json -Depth 6 | Set-Content -Path $CurrentState -Encoding UTF8
Write-Host "Codex Buddy simulator state set to '$State'."
Write-Host "Updated $CurrentState"
