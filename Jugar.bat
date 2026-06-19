@echo off
title Servidor de Juego - Runescape Retro
echo Iniciando servidor local y abriendo juego en el navegador...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_server.ps1"
pause
