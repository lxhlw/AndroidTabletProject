@echo off
setlocal

echo ============================================
echo L101 Volume Float - Release Keystore Setup
echo ============================================
echo.
echo This script creates a private Android release keystore.
echo Keep the generated .jks file and its passwords safe.
echo NEVER upload the keystore to GitHub.
echo.

where keytool >nul 2>nul
if errorlevel 1 (
    echo ERROR: keytool was not found.
    echo Please install/use JDK 8 and make sure keytool is in PATH.
    pause
    exit /b 1
)

if not exist "release-keystore" mkdir "release-keystore"

set "KEYSTORE=release-keystore\l101-volume-release.jks"

if exist "%KEYSTORE%" (
    echo A keystore already exists:
    echo %KEYSTORE%
    echo.
    choice /C YN /M "Recreate it"
    if errorlevel 2 exit /b 0
    del /q "%KEYSTORE%"
)

echo.
echo Creating release keystore...
echo You will be asked for the keystore password and key password.
echo Remember both passwords. They cannot be recovered.
echo.

keytool -genkeypair -v ^
  -keystore "%KEYSTORE%" ^
  -alias l101volume ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 10000 ^
  -storetype JKS

if errorlevel 1 (
    echo.
    echo ERROR: Keystore creation failed.
    pause
    exit /b 1
)

echo.
echo Keystore created successfully:
echo %KEYSTORE%
echo.

where powershell >nul 2>nul
if errorlevel 1 (
    echo WARNING: PowerShell was not found.
    echo Please Base64-encode the .jks file manually before adding it to GitHub Secrets.
    pause
    exit /b 0
)

powershell -NoProfile -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('%KEYSTORE%')) | Set-Content -NoNewline 'l101-volume-release-keystore-base64.txt'"

if errorlevel 1 (
    echo WARNING: Base64 export failed.
    echo The .jks file was created, but the Base64 file was not.
    pause
    exit /b 0
)

echo Base64 file created:
echo l101-volume-release-keystore-base64.txt
echo.
echo IMPORTANT:
echo 1. Keep the .jks and password(s) safe.
echo 2. Do NOT commit either file to GitHub.
echo 3. The Base64 file is also sensitive.
echo.
echo Next phase: add the keystore and passwords to GitHub Actions Secrets.
echo.
pause
