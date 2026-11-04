@echo off
REM ===========================================================================
REM  askalice-setup.cmd — one file, double-click, and it works.
REM
REM  Rob, 2026-11-05: "I dont want a 5 step process that needs an ai or cl, it
REM  just needs to install and work on windows."
REM
REM  So this file does everything a person would otherwise have to be told:
REM    1. is Node here?            if not, install it with winget
REM    2. is askalice here?        if not, install it from the published tarball
REM    3. log in                   opens the browser, waits for approval
REM  Nothing to type, nothing to copy. The only human action is pressing Approve
REM  in the browser, because that is authentication and cannot be automated.
REM ===========================================================================
setlocal enabledelayedexpansion
title askalice setup
echo.
echo   askalice - a claim, its source, and the line in it.
echo.

set TARBALL=https://vvs.morpheus.nz/downloads/valiant-askalice-0.2.0.tgz
REM A tarball sitting next to this file wins, so the same script works offline or from a USB stick.
if exist "%~dp0valiant-askalice-0.2.0.tgz" set TARBALL=%~dp0valiant-askalice-0.2.0.tgz

REM ---- 1. Node -------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo   Node is not on this machine. Installing it now - this takes a minute.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo.
    echo   This needs Node and winget is not available.
    echo   Install Node LTS from https://nodejs.org  then run this file again.
    echo.
    pause
    exit /b 1
  )
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo.
    echo   The Node install did not finish. Run this file again once it has.
    pause
    exit /b 1
  )
  echo   Node installed. Close this window and run this file once more so the
  echo   new PATH is picked up.
  pause
  exit /b 0
)
for /f "delims=" %%v in ('node --version') do set NODEV=%%v
echo   Node !NODEV! - ok

REM ---- 2. askalice ---------------------------------------------------------
where askalice >nul 2>nul
if errorlevel 1 (
  echo   Installing askalice...
  npm i -g "%TARBALL%" 2>nul
  if errorlevel 1 (
    echo   The published download was not reachable; using the npm registry copy.
    npm i -g @valiant/askalice
  )
  where askalice >nul 2>nul
  if errorlevel 1 (
    echo.
    echo   The install did not complete. Nothing was changed on this machine.
    pause
    exit /b 1
  )
) else (
  echo   askalice already installed - updating it
  npm i -g "%TARBALL%" >nul 2>nul
)
echo   askalice - ok

REM ---- 3. log in -----------------------------------------------------------
askalice status >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Almost there: a browser will open. Press Approve and the window will
  echo   close by itself.
  echo.
  askalice login
  if errorlevel 1 (
    echo.
    echo   The login did not complete. Run this file again - nothing is broken.
    pause
    exit /b 1
  )
)

echo.
echo   Ready. Ask it something:
echo.
echo     askalice check https://example.com/ --claim "a | b | c"
echo.
echo   Or double-click askalice-check.cmd and paste a link when it asks.
echo.
pause
