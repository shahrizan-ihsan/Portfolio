@echo off
cd /d "%~dp0"
if not defined ANTHROPIC_API_KEY (
    echo.
    echo WARNING: ANTHROPIC_API_KEY is not set.
    echo The chat feature will not work until you set it.
    echo Run this once to save it permanently:
    echo   setx ANTHROPIC_API_KEY "your-key-here"
    echo.
    pause
)
echo Starting IT Support Dashboard...
echo Open http://localhost:5000 in your browser.
echo Press Ctrl+C to stop.
echo.
python dashboard\app.py
pause
