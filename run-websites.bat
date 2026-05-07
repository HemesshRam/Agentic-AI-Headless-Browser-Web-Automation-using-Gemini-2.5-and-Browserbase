@echo off
setlocal enabledelayedexpansion
title Cloud Website Automation v6.1

echo =======================================================
echo     CLOUD WEBSITE AUTOMATION v6.1
echo =======================================================
echo.

if not exist ".env" (
    echo [!] ERROR: .env file not found
    copy .env.example .env >nul
    echo [+] Created .env from template - please add your API keys!
    pause & exit /b 1
)

if not exist "node_modules" (
    echo [*] Installing dependencies...
    call npm install
)

set USE_BROWSERBASE=true
set PREFER_COMPUTER_USE=true

set URL=%~1
set TASK=%~2

if "!URL!"=="" (
    echo [*] No URL provided. Using default.
    set URL=https://example.com
    echo     Usage: run-websites.bat "https://amazon.com" "Find iPhone price"
    echo.
)

if "!TASK!"=="" (
    set TASK=Analyze page
)

echo [*] Starting Browserbase Automation...
echo     URL:  !URL!
echo     Task: !TASK!
echo.

node src/main.js --url "!URL!" --task "!TASK!"
pause