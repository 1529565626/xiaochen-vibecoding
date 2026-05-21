@echo off
title my-net-disk
setlocal enabledelayedexpansion

set ADMIN_URL=http://127.0.0.1:3000/#/admin
set PID_FILE=%~dp0data\server.pid

if not exist "%PID_FILE%" goto :launch

set /p SAVED_PID=<"%PID_FILE%"
tasklist /FI "PID eq !SAVED_PID!" 2>nul | find "!SAVED_PID!" >nul
if errorlevel 1 (
    echo [my-net-disk] Stale PID file found, restarting...
    del "%PID_FILE%" 2>nul
    goto :launch
)

echo [my-net-disk] Already running (PID: !SAVED_PID!)
start "" "%ADMIN_URL%"
timeout /t 2 >nul
exit

:launch
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    timeout /t 3 >nul
    exit
)

powershell -Command "Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%~dp0'"
echo [my-net-disk] Starting...
timeout /t 2 >nul

start "" "%ADMIN_URL%"
echo [my-net-disk] Started. To stop, double-click stop.bat
timeout /t 2 >nul
