@echo off
chcp 65001 >nul
REM Ātrā pārbaude no datora: palaiž serveri un izveido drošu (https) saiti telefonam.
cd /d "%~dp0"
where node >nul 2>nul || (echo Vajag Node.js: https://nodejs.org ^(LTS versija^) & pause & exit /b 1)
start "Medibu serveris" cmd /k node server.js
timeout /t 2 >nul
where cloudflared >nul 2>nul
if %errorlevel%==0 (
  echo.
  echo ^>^>^> Atver telefona adresi, kas beidzas ar .trycloudflare.com ^(paradisies zemak^)
  echo.
  cloudflared tunnel --url http://localhost:8080
) else (
  echo.
  echo Serveris darbojas: http://localhost:8080
  echo Lai atvertu telefona, vajag https saiti. Uzinstale cloudflared:
  echo    winget install --id Cloudflare.cloudflared
  echo un palaid so failu velreiz.
  pause
)
