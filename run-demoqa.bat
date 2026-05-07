@echo off
setlocal enabledelayedexpansion
title DemoQA Automation v6.1

echo =======================================================
echo     DEMOQA AUTOMATION v6.1
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

set DEMOQA_MODE=true

REM Safely capture the first argument
set TASK=%~1

if "!TASK!"=="" (
    echo [*] No task provided. Using default task.
    set TASK=Fill out the text box form
    echo     Usage: run-demoqa.bat "task prompt"
    echo.
)

echo [*] Starting DemoQA Automation...
echo     Target: https://demoqa.com
echo     Task:   !TASK!
echo.

node src/main.js --url "https://demoqa.com" --task "!TASK!" --mode demoqa
pause