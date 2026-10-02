@echo off
chcp 65001 >nul
setlocal

echo ================================
echo L101 Source Injector
echo ================================

set "ROOT=%~dp0"
set "SRC=%ROOT%app\src\main\java\com\l101\volumefloat"
set "TEMPLATE=%ROOT%source_templates"

echo.
echo This script copies the source templates into the app source folder.
echo Existing source files will NOT be overwritten automatically.
echo.

if not exist "%SRC%" mkdir "%SRC%" >nul 2>nul

call :copy_if_missing "MainActivity.java.txt" "MainActivity.java"
call :copy_if_missing "VolumeFloatService.java.txt" "VolumeFloatService.java"
call :copy_if_missing "BootReceiver.java.txt" "BootReceiver.java"
call :copy_if_missing "OrientationManager.java.txt" "OrientationManager.java"
call :copy_if_missing "FloatPermission.java.txt" "FloatPermission.java"

echo.
echo ================================
echo Injection Finished
echo ================================
echo.
echo Existing files were preserved.
echo Only missing source files were copied.
echo.

dir "%SRC%"
pause
exit /b 0

:copy_if_missing
set "TEMPLATE_FILE=%~1"
set "TARGET_FILE=%~2"

if exist "%SRC%\%TARGET_FILE%" (
    echo [SKIP] %TARGET_FILE% already exists.
    exit /b 0
)

echo [COPY] %TARGET_FILE%
copy /Y "%TEMPLATE%\%TEMPLATE_FILE%" "%SRC%\%TARGET_FILE%" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy %TARGET_FILE%.
)
exit /b 0
