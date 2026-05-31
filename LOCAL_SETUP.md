# DueVault Local Setup

These commands assume you are starting from the project root.

```powershell
cd "D:\Proiect TD"
```

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer
- Optional MongoDB running locally on `mongodb://localhost:27017`

## Backend

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

For local testing without MongoDB, set these values in `backend\.env`:

```text
USE_MEMORY_DB=true
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
ENABLE_DEMO_SEED=true
```

Backend URL:

```text
http://localhost:8001
```

API docs:

```text
http://localhost:8001/docs
```

## Frontend

Open a second PowerShell window:

```powershell
cd frontend
Copy-Item .env.example .env
notepad .env
npm install
npm start
```

Set this value in `frontend\.env`:

```text
REACT_APP_API_URL=http://localhost:8001
```

Frontend URL:

```text
http://localhost:3000
```

## Demo Login

```text
Email: demo@duevault.app
Password: Demo123!
```

## Environment Files

- Backend example: `backend\.env.example`
- Frontend example: `frontend\.env.example`

The frontend calls the backend through:

```text
REACT_APP_API_URL=http://localhost:8001
```
