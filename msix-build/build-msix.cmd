@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================
echo LoveMemo MSIX Build Script (MakeAppx.exe)
echo ============================================================
echo.

REM --- Configuration ---
set "PROJECT_DIR=E:\old-new\backup\BNU_leaning\LoveMemo"
set "INSTALL_DIR=C:\Program Files\LoveMemo"
set "PACKAGE_DIR=%PROJECT_DIR%\msix-build\package"
set "MANIFEST=%PROJECT_DIR%\msix-build\AppxManifest.xml"
set "ICONS_DIR=%PROJECT_DIR%\src-tauri\icons"
set "OUTPUT_MSIX=%PROJECT_DIR%\msix-build\LoveMemo_1.0.0.0_x64.msix"

REM --- Step 1: Find MakeAppx.exe ---
echo [1/5] Searching for MakeAppx.exe...
set "MAKEAPPX="
for /f "usebackq delims=" %%i in (`dir /b /s "C:\Program Files (x86)\Windows Kits\10\bin\MakeAppx.exe" 2^>nul`) do (
    echo %%i | findstr /i "x64" >nul && (
        if not defined MAKEAPPX set "MAKEAPPX=%%i"
    )
)
if not defined MAKEAPPX (
    for /f "usebackq delims=" %%i in (`dir /b /s "C:\Program Files\Windows Kits\10\bin\MakeAppx.exe" 2^>nul`) do (
        echo %%i | findstr /i "x64" >nul && (
            if not defined MAKEAPPX set "MAKEAPPX=%%i"
        )
    )
)
if not defined MAKEAPPX (
    echo [X] MakeAppx.exe not found!
    echo     Please install Windows SDK from:
    echo     https://developer.microsoft.com/windows/downloads/windows-sdk/
    echo     Or install via Visual Studio Installer:
    echo     "Desktop development with C++" workload
    pause
    exit /b 1
)
echo     Found: %MAKEAPPX%
echo.

REM --- Step 2: Clean and create package directory ---
echo [2/5] Preparing package directory...
if exist "%PACKAGE_DIR%" rmdir /s /q "%PACKAGE_DIR%"
mkdir "%PACKAGE_DIR%"
mkdir "%PACKAGE_DIR%\Assets"
echo     Done.
echo.

REM --- Step 3: Copy LoveMemo installed files ---
echo [3/5] Copying LoveMemo files from C:\Program Files\LoveMemo...
if not exist "%INSTALL_DIR%\LoveMemo.exe" (
    echo [X] LoveMemo.exe not found in %INSTALL_DIR%
    echo     Please install LoveMemo MSI first.
    pause
    exit /b 1
)
xcopy "%INSTALL_DIR%\*" "%PACKAGE_DIR%\" /E /I /Q /Y >nul
echo     Copied files.
echo.

REM --- Step 4: Copy AppxManifest.xml and icons ---
echo [4/5] Copying AppxManifest.xml and icons...
copy /Y "%MANIFEST%" "%PACKAGE_DIR%\AppxManifest.xml" >nul

REM Copy needed icons to Assets
for %%f in (StoreLogo.png Square44x44Logo.png Square150x150Logo.png Square71x71Logo.png Square310x310Logo.png Wide310x150Logo.png SplashScreen.png) do (
    if exist "%ICONS_DIR%\%%f" (
        copy /Y "%ICONS_DIR%\%%f" "%PACKAGE_DIR%\Assets\%%f" >nul
        echo     Copied: %%f
    ) else (
        echo     [!] Missing: %%f (will skip)
    )
)

REM If Wide310x150Logo missing, copy from Square150x150
if not exist "%PACKAGE_DIR%\Assets\Wide310x150Logo.png" (
    if exist "%ICONS_DIR%\Square150x150Logo.png" (
        copy /Y "%ICONS_DIR%\Square150x150Logo.png" "%PACKAGE_DIR%\Assets\Wide310x150Logo.png" >nul
        echo     Created Wide310x150Logo from Square150x150
    )
)
REM If SplashScreen missing, copy from StoreLogo
if not exist "%PACKAGE_DIR%\Assets\SplashScreen.png" (
    if exist "%ICONS_DIR%\icon.png" (
        copy /Y "%ICONS_DIR%\icon.png" "%PACKAGE_DIR%\Assets\SplashScreen.png" >nul
        echo     Created SplashScreen from icon.png
    )
)
echo.

REM --- Step 5: Build MSIX ---
echo [5/5] Building MSIX package...
if exist "%OUTPUT_MSIX%" del /f /q "%OUTPUT_MSIX%"

"%MAKEAPPX%" pack /d "%PACKAGE_DIR%" /p "%OUTPUT_MSIX%" /o /v

if %ERRORLEVEL% neq 0 (
    echo.
    echo [X] MSIX build failed! Error code: %ERRORLEVEL%
    pause
    exit /b 1
)

echo.
echo ============================================================
echo [OK] MSIX package created successfully!
echo ============================================================
echo.
echo Output: %OUTPUT_MSIX%
echo.
dir "%OUTPUT_MSIX%"
echo.
echo Next steps:
echo   1. Double-click the .msix to test install
echo   2. Upload to Partner Center (delete old MSI URL package first)
echo   3. Run validation check
echo   4. Submit for certification
echo.
pause
