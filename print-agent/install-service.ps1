<#
.SYNOPSIS
Installs Doutly Print Agent as a silent 24/7 Windows background startup service.
Run in PowerShell as Administrator.
#>

$AgentFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$TaskName = "DoutlyPrintGateway"
$VbsScript = "$AgentFolder\start-agent-background.vbs"

if (-not (Test-Path "$AgentFolder\agent.js")) {
    Write-Host "❌ agent.js not found in: $AgentFolder" -ForegroundColor Red
    exit 1
}

$WscriptExe = "$env:SystemRoot\System32\wscript.exe"
$Action = New-ScheduledTaskAction -Execute $WscriptExe -Argument "`"$VbsScript`"" -WorkingDirectory $AgentFolder

# Triggers: Run at computer boot (startup) and on any user logon
$TriggerBoot = New-ScheduledTaskTrigger -AtStartup
$TriggerLogon = New-ScheduledTaskTrigger -AtLogOn

$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650)

try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($TriggerBoot, $TriggerLogon) -Principal $Principal -Settings $Settings | Out-Null
    Write-Host "✅ Doutly Print Gateway successfully registered as a 24/7 Windows background startup service!" -ForegroundColor Green
    Write-Host "   The agent will run silently in the background whenever this computer turns on." -ForegroundColor Cyan
    Write-Host "   Zero CMD windows will remain open." -ForegroundColor Cyan
    
    # Start it right now
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "🚀 Background service launched successfully." -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to register task: $_" -ForegroundColor Red
}
