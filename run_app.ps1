# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location ""C:\Users\DEVICE NAGAR\Desktop\LMS\backend""; .\venv\Scripts\activate; python manage.py runserver"

Start-Sleep -Seconds 2

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location ""C:\Users\DEVICE NAGAR\Desktop\LMS\frontend""; npm run dev"
