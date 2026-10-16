<#
.SYNOPSIS
Installs Doutly Print Agent as a silent 24/7 Windows background startup service.
If run as Administrator, registers a Windows Scheduled Task.
If run as standard user, automatically falls back to the Windows Startup folder.
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

$Registered = $false

try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($TriggerBoot, $TriggerLogon) -Principal $Principal -Settings $Settings -ErrorAction Stop | Out-Null
    $Registered = $true
    Write-Host "✅ Doutly Print Gateway successfully registered as a 24/7 Windows Scheduled Task!" -ForegroundColor Green
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "🚀 Background service launched successfully." -ForegroundColor Green
} catch {
    Write-Host "⚠️ Administrator rights not present for Task Scheduler ($($_.Exception.Message))." -ForegroundColor Yellow
    Write-Host "   Installing automatic background startup into Windows User Startup Folder..." -ForegroundColor Cyan

    $StartupFolder = [Environment]::GetFolderPath('Startup')
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$StartupFolder\DoutlyPrintGateway.lnk")
    $Shortcut.TargetPath = $WscriptExe
    $Shortcut.Arguments = "`"$VbsScript`""
    $Shortcut.WorkingDirectory = $AgentFolder
    $Shortcut.Description = "Doutly Print Gateway 24/7 Background Service"
    $Shortcut.Save()

    Write-Host "✅ Doutly Print Gateway registered in Windows Startup Folder:" -ForegroundColor Green
    Write-Host "   $StartupFolder\DoutlyPrintGateway.lnk" -ForegroundColor Green
    Write-Host "   The agent will now launch silently on every Windows login without needing Admin rights." -ForegroundColor Cyan

    # Launch it now
    Start-Process -FilePath $WscriptExe -ArgumentList "`"$VbsScript`"" -WorkingDirectory $AgentFolder
    Write-Host "🚀 Background service launched successfully." -ForegroundColor Green
}
