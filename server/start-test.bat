@echo off
echo ========================================
echo   Donut Runner Server Load Test
echo ========================================
echo.
echo Starting test sequence...
echo.

REM Check if server is running
curl -s http://localhost:3000/api/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Server not running. Starting server...
    start cmd /k "npm start"
    echo Waiting for server to start...
    timeout /t 5 >nul
)

echo [+] Running load test...
echo.
node load-test.js

pause