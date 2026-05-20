$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NotifyScript = Join-Path $ProjectRoot "codex_buddy_notify.py"
$EscapedNotifyScript = $NotifyScript.Replace("\", "\\")

Write-Host "Codex Buddy Bridge does not modify ~/.codex/config.toml automatically."
Write-Host ""
Write-Host "Add a notify entry like this to ~/.codex/config.toml:"
Write-Host ""
Write-Host "notify = [""python"", ""$EscapedNotifyScript""]"
Write-Host ""
Write-Host "Codex will append one JSON string argument when agent-turn-complete fires."
