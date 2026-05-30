# DueVault Security Checklist

- [x] Secrets moved to environment variables.
- [x] `.env` files ignored; `.env.example` files kept commit-safe.
- [x] Backend `.env.example` created with placeholder values only.
- [x] Frontend `.env.example` contains only public frontend configuration.
- [x] Resend API key is backend-only and read from `RESEND_API_KEY`.
- [x] Email routes return a clean configuration error when `RESEND_API_KEY` is missing.
- [x] `JWT_SECRET` is environment-based; production fails clearly if it is missing.
- [x] CORS is restricted by environment and does not use wildcard origins.
- [x] Frontend uses a centralized API base URL.
- [x] Passwords are hashed with bcrypt.
- [x] Documents, vehicles, payments, reminders, file uploads, files, profile, and scheduler routes require authentication.
- [x] User-owned data is filtered by the authenticated JWT user id.
- [x] Production error handling avoids exposing stack traces to clients.
- [x] Known demo users are not seeded in production unless explicitly enabled.
- [x] Deployment variables are documented for Render and Vercel.

## Manual Before Public Hosting

- Rotate any API keys or JWT secrets that were ever exposed outside local `.env` files.
- Set a long random `JWT_SECRET` in Render.
- Set a verified `RESEND_FROM_EMAIL` for production Resend delivery.
- Confirm `FRONTEND_URL` matches the exact Vercel production URL.
- Confirm Vercel uses `REACT_APP_API_URL` pointing at the Render backend.
