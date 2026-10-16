@echo off
setlocal EnableDelayedExpansion
title Doutly Print Gateway - Shop Computer
cd /d "%~dp0"
cls
echo ========================================================
echo   Starting Doutly Print Gateway Agent
echo   Dual Canon [LAN] + Epson L5290
echo ========================================================
echo.

:: Check Node.js in PATH and standard installation directories
where node >nul 2>nul
if %errorlevel% equ 0 goto node_ok

if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;!PATH!"
    goto node_ok
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "PATH=%ProgramFiles(x86)%\nodejs;!PATH!"
    goto node_ok
)

echo [ERROR] Node.js is not found on this computer.
echo Please install Node.js LTS from https://nodejs.org/
echo Then run this batch file again.
echo.
pause
exit /b 1

:node_ok
:: Ensure config.json has no UTF-8 BOM
if exist config.json (
    powershell -NoProfile -Command "$bytes = [System.IO.File]::ReadAllBytes('config.json'); if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { $clean = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3); [System.IO.File]::WriteAllText('config.json', $clean, (New-Object System.Text.UTF8Encoding $false)); }" >nul 2>nul
)

:: Check if node_modules exists
if exist node_modules goto start_agent

echo [SETUP] Installing required agent dependencies...
call npm install --no-audit --no-fund
if %errorlevel% equ 0 goto start_agent

echo [ERROR] Failed to install dependencies. Check your internet connection.
echo.
pause
exit /b 1

:start_agent
echo [STARTING] Launching print listener and machine heartbeat...
echo.
node agent.js

echo.
echo Gateway stopped.
pause
