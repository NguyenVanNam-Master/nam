@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title FINCHI Launcher

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"
set "APP_URL=http://localhost:%PORT%/"

echo.
echo ============================================
echo           FINCHI GAME LAUNCHER
echo ============================================
echo.

echo [1/3] Checking Java...
where java >nul 2>nul
if errorlevel 1 goto no_java

where javac >nul 2>nul
if errorlevel 1 goto no_javac

echo [OK] Java and javac were found.
echo.
echo [2/3] Compiling source...
if exist out rmdir /s /q out
mkdir out >nul 2>nul
javac -encoding UTF-8 -d out src\main\java\com\finchi\FinchiApplication.java
if errorlevel 1 goto compile_error

echo [OK] Compile completed.
echo.
echo [3/3] Starting server...
echo Game URL: %APP_URL%
echo Health:   http://localhost:%PORT%/api/health
echo.
echo Open the URL above in your browser.
echo To stop the server later, return to this window and press Ctrl + C.
echo.
java -cp out;src\main\resources com.finchi.FinchiApplication %PORT%
if errorlevel 1 goto server_error

goto done

:no_java
echo [ERROR] Java was not found.
echo Please install JDK 21 and make sure the java command is available in PATH.
goto end

:no_javac
echo [ERROR] javac was not found.
echo Please install JDK 21 and make sure the javac command is available in PATH.
goto end

:compile_error
echo [ERROR] Compile failed.
echo Please take a screenshot of this window and send it to ChatGPT.
goto end

:server_error
echo [ERROR] The server stopped unexpectedly.
echo Please take a screenshot of this window and send it to ChatGPT.
goto end

:done
echo.
echo [OK] Server stopped.

:end
pause
endlocal
