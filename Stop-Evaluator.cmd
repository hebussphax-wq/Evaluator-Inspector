@echo off
"C:\Program Files\PowerShell\7\pwsh.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop-Evaluator.ps1"
if errorlevel 1 pause
