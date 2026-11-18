@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .env (
  echo Не найден .env. Скопируй .env.example в .env и заполни BOT_TOKEN и WEBAPP_URL.
  pause
  exit /b 1
)
py -m pip install -r requirements.txt
py bot.py
pause
