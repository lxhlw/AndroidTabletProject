@echo off
setlocal

echo ============================================
echo L101 Volume Float - Local Debug Build
echo ============================================
echo.

where java >nul 2>nul
if errorlevel 1 (
    echo ERROR: Java was not found.
    echo Local builds require JDK 8.
    echo For official signed APKs, use GitHub Releases instead.
    echo.
    pause
    exit /b 1
)

java -version 2>&1
echo.

set "GRADLE_VERSION=4.10.3"
set "SCRIPT_DIR=%~dp0"
set "GRADLE_HOME=%SCRIPT_DIR%.tools\gradle-%GRADLE_VERSION%"
set "GRADLE_ZIP=%TEMP%\gradle-%GRADLE_VERSION%-bin.zip"

if not exist "%GRADLE_HOME%\bin\gradle.bat" (
    echo Gradle %GRADLE_VERSION% was not found locally.
    echo Downloading the official Gradle distribution...
    echo.

    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip' -OutFile '%GRADLE_ZIP%'"

    if errorlevel 1 (
        echo ERROR: Failed to download Gradle.
        pause
        exit /b 1
    )

    if not exist "%SCRIPT_DIR%.tools" mkdir "%SCRIPT_DIR%.tools"

    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force '%GRADLE_ZIP%' '%SCRIPT_DIR%.tools'"

    if errorlevel 1 (
        echo ERROR: Failed to extract Gradle.
        pause
        exit /b 1
    )
)

echo.
echo Building Debug APK with Gradle %GRADLE_VERSION%...
echo.

call "%GRADLE_HOME%\bin\gradle.bat" assembleDebug --no-daemon --stacktrace

if errorlevel 1 (
    echo.
    echo ============================================
    echo BUILD FAILED
    echo ============================================
    pause
    exit /b 1
)

echo.
echo ============================================
echo BUILD SUCCESS
echo ============================================
echo APK:
echo app\build\outputs\apk\debug\app-debug.apk
echo.
echo Official signed releases are published by
echo GitHub Actions to GitHub Releases.
echo.
pause
