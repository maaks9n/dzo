@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo installing dependencies...
  call npm install
)
if not exist .env (
  copy .env.example .env >nul
  echo copied .env.example to .env
)
call npx dzo hunt
