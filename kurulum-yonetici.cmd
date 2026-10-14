@echo off
REM ===================================================================
REM  NEXUS CHEATS - yerel alan adi kurulumu (yonetici olarak calistirin)
REM  Bu dosyaya sag tiklayip "Yonetici olarak calistir" secin.
REM ===================================================================
setlocal

set DOMAIN=nexuscheats.local
set PROJECT=%~dp0..
set CERT=%PROJECT%\data\tls\%DOMAIN%.cer

echo.
echo ============================================================
echo   NEXUS CHEATS - yerel alan adi kurulumu
echo   Alan adi: https://%DOMAIN%
echo ============================================================
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo [HATA] Bu dosya YONETICI olarak calistirilmali.
  echo        Dosyaya sag tiklayip "Yonetici olarak calistir" secin.
  echo.
  pause
  exit /b 1
)

echo [1/3] hosts dosyasina kayit ekleniyor...
findstr /C:"%DOMAIN%" "%SystemRoot%\System32\drivers\etc\hosts" >nul 2>&1
if errorlevel 1 (
  echo.>>"%SystemRoot%\System32\drivers\etc\hosts"
  echo # NEXUS CHEATS - yerel gelistirme alan adi>>"%SystemRoot%\System32\drivers\etc\hosts"
  echo 127.0.0.1    %DOMAIN%>>"%SystemRoot%\System32\drivers\etc\hosts"
  echo 127.0.0.1    www.%DOMAIN%>>"%SystemRoot%\System32\drivers\etc\hosts"
  echo       OK - 127.0.0.1 -^> %DOMAIN% eklendi
) else (
  echo       OK - kayit zaten mevcut
)

echo.
echo [2/3] Sertifika guvenilen kok deposuna ekleniyor...
if exist "%CERT%" (
  certutil -addstore -f Root "%CERT%" >nul
  if errorlevel 1 (
    echo       HATA - sertifika eklenemedi
  ) else (
    echo       OK - sertifika guvenilir olarak eklendi
  )
) else (
  echo       HATA - sertifika bulunamadi: %CERT%
  echo       Once su komutu calistirin: npm run cert -- --force
)

echo.
echo [3/3] DNS onbellegi temizleniyor...
ipconfig /flushdns >nul
echo       OK

echo.
echo ============================================================
echo   TAMAMLANDI
echo.
echo   1) Sunucuyu baslatin:  npm run https
echo   2) Chrome'da acin:     https://%DOMAIN%
echo ============================================================
echo.
pause
