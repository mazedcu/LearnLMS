@echo off
echo Starting LMS Backend...
start "LMS Backend" /D "C:\Users\DEVICE NAGAR\Desktop\LMS\backend" cmd /k ".\venv\Scripts\activate && python manage.py runserver"

timeout /t 3 /nobreak

echo Starting LMS Frontend...
start "LMS Frontend" /D "C:\Users\DEVICE NAGAR\Desktop\LMS\frontend" cmd /k "npm run dev"

echo.
echo Both servers are starting...
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
pause
