$root = Split-Path -Parent $PSScriptRoot

Start-Process powershell -ArgumentList @(
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-Command',
  "Set-Location '$root'; .\.venv\Scripts\Activate.ps1; uvicorn backend.app.main:app --reload"
)

Start-Process powershell -ArgumentList @(
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-Command',
  "Set-Location '$root\\frontend'; npm run dev"
)
