@echo off
setlocal
title Doutly Print Gateway - Shop Computer
cd /d "%~dp0"
cls
echo ========================================================
echo   Starting Doutly Print Gateway Agent
echo   Hardware: Dual Canon iR-ADV 4545i III [LAN] + Epson L5290
echo ========================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% equ 0 goto node_ok

echo [ERROR] Node.js is not found on this computer.
echo Please install Node.js LTS from https://nodejs.org/
echo Then run this batch file again.
echo.
pause
exit /b 1

:node_ok
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
