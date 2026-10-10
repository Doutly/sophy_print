@echo off
title Doutly Print Gateway - Shop Computer
cls
echo ========================================================
echo   Starting Doutly Print Gateway Agent
echo ========================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on this computer.
    echo Please install Node.js from https://nodejs.org/ (LTS version)
    echo Then run this batch file again.
    pause
    exit /b
)

:: Check if node_modules exists
if not exist node_modules (
    echo [SETUP] Installing required agent dependencies...
    call npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies. Check your internet connection.
        pause
        exit /b
    )
)

echo [STARTING] Launching print listener and machine heartbeat...
echo.
node agent.js

echo.
echo Gateway stopped.
pause
