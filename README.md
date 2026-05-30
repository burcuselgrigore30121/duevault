# DueVault

DueVault is a full-stack deadline, document, vehicle, payment, and email reminder app.

## Stack

- Frontend: React with Create React App and CRACO
- Backend: FastAPI
- Production database: MongoDB Atlas
- Email reminders: Resend

## Local Development

1. Create backend environment variables:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```

2. Edit `backend\.env`.

   For a quick local demo, use `USE_MEMORY_DB=true`. For MongoDB Atlas or local MongoDB, use `USE_MEMORY_DB=false` and set `MONGO_URL` plus `DB_NAME`.

3. Start the backend:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn server:app --host 0.0.0.0 --port 8000 --reload
   ```

4. Create frontend environment variables:

   ```powershell
   Copy-Item frontend\.env.example frontend\.env
   ```

5. Start the frontend:

   ```powershell
   cd frontend
   npm install
   npm start
   ```

The backend runs on `http://localhost:8000`. Create React App normally runs the frontend on `http://localhost:3000`.

## Production Deployment

### Backend on Render

Create a Python web service using the `backend` folder.

Start command:

```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Required backend environment variables:

```text
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=your_verified_sender_email
JWT_SECRET=your_long_random_jwt_secret_here
FRONTEND_URL=your_public_frontend_url
MONGO_URL=your_mongodb_atlas_connection_string_here
DB_NAME=duevault
USE_MEMORY_DB=false
NODE_ENV=production
SEED_DEMO_DATA=false
PORT=8000
```

Optional storage variables, if file storage is enabled:

```text
DUEVAULT_STORAGE_URL=your_storage_service_url
DUEVAULT_STORAGE_KEY=your_storage_service_key
```

### Frontend on Vercel

Deploy the `frontend` folder.

Required frontend environment variable:

```text
REACT_APP_API_URL=your_public_backend_url
```

Create React App exposes `REACT_APP_` variables to the browser. Never put Resend keys, JWT secrets, MongoDB connection strings, or storage keys in frontend environment variables.

### MongoDB Atlas

Use `MONGO_URL` for the Atlas connection string and `DB_NAME=duevault`. Production should use `USE_MEMORY_DB=false`.

The backend owns database access. The frontend must never receive or store MongoDB credentials.

Collections used by the backend:

- `users`
- `items`
- `vehicles`
- `renewals`
- `notification_logs`

Items cover documents, payments, reminders, and uploaded-file metadata.

## Security Notes

- Never commit `.env` files.
- Commit only `.env.example` templates.
- Rotate any API key, JWT secret, or database password that was ever exposed.
- Backend variables hold private secrets.
- Frontend variables are public browser configuration.
- Keep `SEED_DEMO_DATA=false` in production.
