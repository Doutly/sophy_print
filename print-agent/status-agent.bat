@echo off
setlocal
title Doutly Print Gateway Status
cd /d "%~dp0"
cls

echo ========================================================
echo   Doutly Print Gateway - Background Agent Status
echo ========================================================
echo.

powershell -NoProfile -Command "$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*agent.js*' }; if ($procs) { Write-Host '🟢 STATUS: ONLINE & ACTIVE (24x7 Background Daemon)' -ForegroundColor Green; $procs | Select-Object -Property ProcessId, CreationDate, CommandLine | Format-Table -AutoSize } else { Write-Host '🔴 STATUS: STOPPED / NOT RUNNING' -ForegroundColor Red; Write-Host 'Tip: Double-click start-agent-background.vbs to start the background agent.' -ForegroundColor Yellow }"

echo.
pause
