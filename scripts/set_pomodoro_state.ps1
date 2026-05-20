param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("start", "pause", "reset", "next", "set")]
    [string]$Action,

    [Parameter(Position = 1)]
    [ValidateSet("focus", "break", "longbreak")]
    [string]$TimerMode
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StateDir = Join-Path $ProjectRoot "state"
$PomodoroState = Join-Path $StateDir "pomodoro_state.json"

if (-not (Test-Path $StateDir)) {
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
}

function Get-UtcNowText {
    return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function Get-DefaultPomodoro {
    return [ordered]@{
        enabled = $false
        mode = "focus"
        duration_seconds = 25 * 60
        remaining_seconds = 25 * 60
        is_running = $false
        cycle_index = 0
        focus_minutes = 25
        short_break_minutes = 5
        long_break_minutes = 15
        long_break_every = 4
        updated_at = Get-UtcNowText
    }
}

function ConvertTo-OrderedHashtable {
    param([object]$InputObject)

    $result = [ordered]@{}
    $InputObject.PSObject.Properties | ForEach-Object {
        $result[$_.Name] = $_.Value
    }
    return $result
}

function Get-DurationSeconds {
    param([object]$State, [string]$TimerMode)

    switch ($TimerMode) {
        "break" { return [int]$State.short_break_minutes * 60 }
        "longbreak" { return [int]$State.long_break_minutes * 60 }
        default { return [int]$State.focus_minutes * 60 }
    }
}

function Get-RemainingSeconds {
    param([object]$State)

    $remaining = [int]$State.remaining_seconds
    if ($State.is_running -and $State.updated_at) {
        $updated = [DateTime]::Parse($State.updated_at).ToUniversalTime()
        $elapsed = [int]([DateTime]::UtcNow - $updated).TotalSeconds
        $remaining = [Math]::Max(0, $remaining - $elapsed)
    }
    return $remaining
}

function Set-Mode {
    param([object]$State, [string]$TimerMode)

    $State.mode = $TimerMode
    $State.duration_seconds = Get-DurationSeconds $State $TimerMode
    $State.remaining_seconds = $State.duration_seconds
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

if (Test-Path $PomodoroState) {
    $state = ConvertTo-OrderedHashtable (Get-Content -Raw $PomodoroState | ConvertFrom-Json)
} else {
    $state = Get-DefaultPomodoro
}

if (-not $state.Contains("focus_minutes")) { $state.focus_minutes = 25 }
if (-not $state.Contains("short_break_minutes")) { $state.short_break_minutes = 5 }
if (-not $state.Contains("long_break_minutes")) { $state.long_break_minutes = 15 }
if (-not $state.Contains("long_break_every")) { $state.long_break_every = 4 }

$state.remaining_seconds = Get-RemainingSeconds $state

switch ($Action) {
    "start" {
        $state.enabled = $true
        $state.is_running = $true
        if (-not $state.mode) { Set-Mode $state "focus" }
    }
    "pause" {
        $state.enabled = $true
        $state.is_running = $false
    }
    "reset" {
        $state = Get-DefaultPomodoro
    }
    "next" {
        $state.enabled = $true
        $state.is_running = $true
        if ($state.mode -eq "focus") {
            $nextCycle = [int]$state.cycle_index + 1
            $state.cycle_index = $nextCycle
            if ($nextCycle % [int]$state.long_break_every -eq 0) {
                Set-Mode $state "longbreak"
            } else {
                Set-Mode $state "break"
            }
        } else {
            Set-Mode $state "focus"
        }
    }
    "set" {
        if (-not $TimerMode) {
            throw "Use: set_pomodoro_state.ps1 set focus|break|longbreak"
        }
        $state.enabled = $true
        $state.is_running = $false
        Set-Mode $state $TimerMode
    }
}

$state.updated_at = Get-UtcNowText
Write-JsonWithRetry $state $PomodoroState

Write-Host "Pomodoro: action=$Action mode=$($state.mode) remaining=$($state.remaining_seconds)s running=$($state.is_running)"
Write-Host "Updated $PomodoroState"
