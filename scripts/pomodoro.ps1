param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("start", "pause", "reset", "next", "focus", "break", "longbreak")]
    [string]$Action
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

function Repair-PomodoroState {
    param([object]$State)

    $defaults = Get-DefaultPomodoro
    foreach ($key in $defaults.Keys) {
        if (-not $State.Contains($key)) {
            $State[$key] = $defaults[$key]
        }
    }
    return $State
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

function Set-PomodoroMode {
    param([object]$State, [string]$TimerMode, [bool]$Running)

    $State.enabled = $true
    $State.mode = $TimerMode
    $State.duration_seconds = Get-DurationSeconds $State $TimerMode
    $State.remaining_seconds = $State.duration_seconds
    $State.is_running = $Running
}

function Write-JsonWithRetry {
    param(
        [object]$Payload,
        [string]$Path
    )

    $TempPath = "$Path.$PID.tmp"
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
    $state = Repair-PomodoroState (ConvertTo-OrderedHashtable (Get-Content -Raw $PomodoroState | ConvertFrom-Json))
} else {
    $state = Get-DefaultPomodoro
}

$state.remaining_seconds = Get-RemainingSeconds $state

switch ($Action) {
    "start" {
        $state.enabled = $true
        $state.is_running = $true
        if (-not $state.mode) {
            Set-PomodoroMode $state "focus" $true
        }
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
                Set-PomodoroMode $state "longbreak" $true
            } else {
                Set-PomodoroMode $state "break" $true
            }
        } else {
            Set-PomodoroMode $state "focus" $true
        }
    }
    "focus" {
        Set-PomodoroMode $state "focus" $false
    }
    "break" {
        Set-PomodoroMode $state "break" $false
    }
    "longbreak" {
        Set-PomodoroMode $state "longbreak" $false
    }
}

$state.updated_at = Get-UtcNowText
Write-JsonWithRetry $state $PomodoroState

Write-Host "Pomodoro: action=$Action mode=$($state.mode) remaining=$($state.remaining_seconds)s running=$($state.is_running)"
Write-Host "Updated $PomodoroState"
