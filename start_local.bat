@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Открываю приложение на http://localhost:8080
echo Чтобы остановить сервер, нажми Ctrl+C.
start "" http://localhost:8080
py -m http.server 8080
