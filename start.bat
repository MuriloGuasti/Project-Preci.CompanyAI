@echo off
title preci. - Launcher
echo ======================================================
echo    Iniciando ecossistema preci. (Backend + Frontend)
echo ======================================================

start "preci. Backend (FastAPI + Agendador)" /D "%~dp0backend" cmd /k "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

start "preci. Frontend (Vite)" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo Servidores iniciados com sucesso!
echo - Backend:   http://127.0.0.1:8000
echo - Swagger:   http://127.0.0.1:8000/docs
echo - Frontend:  http://localhost:5173
echo - Agendador: Integrado em memoria no Backend (checagem a cada 60s)
echo ======================================================
pause
