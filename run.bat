@echo off
setlocal enabledelayedexpansion
title Web Automation v6.1

echo =======================================================
echo     INDUSTRIAL WEB AUTOMATION PRO v6.1
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

REM Use %~1 to grab arguments safely, stripping surrounding quotes
set URL=%~1
set TASK=%~2
set STEPS=%~3

REM Apply defaults if arguments are missing
if "!URL!"=="" set URL=https://example.com
if "!TASK!"=="" set TASK=Analyze page
if "!STEPS!"=="" set STEPS=10

echo [*] Starting automation...
echo     URL:   !URL!
echo     Task:  !TASK!
echo     Steps: !STEPS!
echo.

node src/main.js --url "!URL!" --task "!TASK!" --steps !STEPS!
pause