@echo off
title my-net-disk - stop

echo [my-net-disk] Looking for service on port 3000...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /C:":3000 " ^| findstr "LISTENING"') do (
    echo [my-net-disk] Stopping PID %%a ...
    taskkill /PID %%a /F
    goto :done
)

echo [my-net-disk] No running service found
goto :cleanup

:done
echo [my-net-disk] Stopped

:cleanup
del "%~dp0data\server.pid" 2>nul
timeout /t 2 >nul
