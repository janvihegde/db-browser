@echo off
title DB Browser - Local Setup
echo Starting DB Browser local setup...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
echo Window will stay open - press any key to close it.
pause >nul