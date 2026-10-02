@echo off
chcp 65001 >nul

echo ================================
echo L101 Source Injector
echo ================================


set ROOT=%~dp0


set SRC=%ROOT%app\src\main\java\com\l101\volumefloat


set TEMPLATE=%ROOT%source_templates



echo Creating java folder...

mkdir "%SRC%" 2>nul



echo Copy MainActivity...

copy "%TEMPLATE%\MainActivity.java.txt" ^
"%SRC%\MainActivity.java"



echo Copy Volume Service...

copy "%TEMPLATE%\VolumeFloatService.java.txt" ^
"%SRC%\VolumeFloatService.java"



echo Copy Boot Receiver...

copy "%TEMPLATE%\BootReceiver.java.txt" ^
"%SRC%\BootReceiver.java"



echo Copy Orientation Manager...

copy "%TEMPLATE%\OrientationManager.java.txt" ^
"%SRC%\OrientationManager.java"



echo Copy Permission Helper...

copy "%TEMPLATE%\FloatPermission.java.txt" ^
"%SRC%\FloatPermission.java"



echo.

echo ================================
echo Injection Finished
echo ================================


dir "%SRC%"


pause