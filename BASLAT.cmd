@echo off
REM ===================================================================
REM  NEXUS CHEATS - TEK TIKLAMA BASLATICI
REM  Bu dosyaya CIFT TIKLAYIN. Gerisini o halleder.
REM ===================================================================
setlocal EnableDelayedExpansion

set "PROJECT=%~dp0"
set "DOMAIN=nexuscheats.local"
set "HTTPS_PORT=9443"
set "HTTP_PORT=9080"

title NEXUS CHEATS

echo.
echo  ============================================================
echo    NEXUS CHEATS
echo    Profesyonel FPS Egitim Platformu
echo  ============================================================
echo.

cd /d "%PROJECT%"

REM ---------- Node.js ----------
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" (
  where node >nul 2>&1
  if errorlevel 1 (
    echo  [HATA] Node.js bulunamadi. https://nodejs.org
    pause
    exit /b 1
  )
  set "NODE=node"
)

REM ---------- Bagimliliklar ----------
if not exist "node_modules" (
  echo  Bagimliliklar kuruluyor...
  call npm install
)

REM ---------- Veritabani ----------
if not exist "data\nexus.db" (
  echo  Veritabani hazirlaniyor...
  call npm run seed
)

REM ---------- Sertifika ----------
echo  Sertifika kontrol ediliyor...
call "%NODE%" scripts\generate-cert.js --cn=%DOMAIN%
if errorlevel 1 (
  echo  [HATA] Sertifika uretilemedi.
  pause
  exit /b 1
)

REM ---------- Eski sunuculari kapat ----------
set "NS=%SystemRoot%\System32\netstat.exe"
set "TK=%SystemRoot%\System32\taskkill.exe"
for %%P in (%HTTPS_PORT% %HTTP_PORT%) do (
  for /f "tokens=5" %%i in ('"%NS%" -ano ^| findstr ":%%P" ^| findstr LISTENING') do (
    "%TK%" /F /PID %%i >nul 2>&1
  )
)
timeout /t 1 /nobreak >nul

REM ---------- hosts kontrolu ----------
findstr /C:"%DOMAIN%" "%SystemRoot%\System32\drivers\etc\hosts" >nul 2>&1
if errorlevel 1 (
  echo.
  echo  NOT: %DOMAIN% adi hosts dosyasinda yok.
  echo       https://localhost:%HTTPS_PORT% adresini kullanin.
)

REM ---------- Ortam ----------
set "SESSION_SECRET=nexus-gelistirme-anahtari-degistir-32-karakterden-uzun-olmali"
set "HTTPS_PORT=%HTTPS_PORT%"
set "HTTP_PORT=%HTTP_PORT%"
set "HOST=0.0.0.0"
set "NODE_ENV=development"

echo.
echo  ============================================================
echo    SUNUCU HAZIR
echo.
echo    Chrome'da acin:
echo      https://%DOMAIN%:%HTTPS_PORT%
echo      https://localhost:%HTTPS_PORT%
echo.
echo    Kapatmak icin: Ctrl+C
echo  ============================================================
echo.

start "" "https://localhost:%HTTPS_PORT%"

"%NODE%" src\https-server.js

echo.
echo  Sunucu durdu.
pause
