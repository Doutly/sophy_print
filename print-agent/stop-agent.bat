@echo off
setlocal
title Stop Doutly Print Gateway
cd /d "%~dp0"

echo ========================================================
echo   Stopping Doutly Print Gateway Agent...
echo ========================================================
echo.

:: Find and terminate node process running agent.js
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*agent.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('[STOPPED] Terminated background agent PID: ' + $_.ProcessId) }"

echo.
echo Doutly Print Gateway background agent has been stopped.
timeout /t 3 >nul
