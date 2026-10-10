<#
.SYNOPSIS
Installs Doutly Print Agent as an automated Windows background startup task.
Run in PowerShell as Administrator.
#>

$AgentFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$TaskName = "DoutlyPrintGateway"
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $NodeExe) {
    Write-Host "❌ Node.js not detected on this machine. Please install Node.js first." -ForegroundColor Red
    exit 1
}

$Action = New-ScheduledTaskAction -Execute $NodeExe -Argument "$AgentFolder\agent.js" -WorkingDirectory $AgentFolder
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings | Out-Null
    Write-Host "✅ Doutly Print Gateway successfully registered as a Windows startup service!" -ForegroundColor Green
    Write-Host "The agent will now automatically run whenever this computer turns on." -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to register task: $_" -ForegroundColor Red
}
