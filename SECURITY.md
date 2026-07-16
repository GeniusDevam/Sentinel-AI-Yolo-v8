# Security Notes

Sentinel AI is designed to be deployed as a self-hosted internal command center.
Before exposing it to the public internet **please review this checklist**.

## Required before any real deployment

1. **Rotate every seeded credential.** The seed script in `backend/server.py`
   auto-creates three demo accounts on first startup using values from
   `ADMIN_PASSWORD`, `OPERATOR_PASSWORD`, and `VIEWER_PASSWORD` env vars.
   Set strong, unique passwords in `backend/.env` **before** the very first run
   (the seed only creates accounts that don't already exist, and does not
   overwrite passwords except to keep them in sync with the env var — so choose
   your final values up-front).

2. **Set a strong `JWT_SECRET`.** Generate a 64-char random hex string:

   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

3. **Set `PRODUCTION=true`** in `backend/.env`. This flips two flags:
   - Auth cookies are issued with `Secure=True` (HTTPS-only)
   - Wildcard CORS (`*`) is refused; you must set an explicit `CORS_ORIGINS`
     allowlist.

4. **Explicit `CORS_ORIGINS`.** Comma-separated, e.g.
   `CORS_ORIGINS="https://sentinel.example.com"`. Do not leave `*` in production.

5. **Serve behind HTTPS.** Cookie-based auth relies on `Secure` and `SameSite=Lax`;
   both require TLS to function correctly across browsers.

6. **Restrict MongoDB.** The default `MONGO_URL="mongodb://localhost:27017"` is
   fine for a single-machine deploy behind a firewall. If you use a hosted DB,
   use a `mongodb+srv://` URL with a scoped user and IP allowlist. Never commit
   the URL to a public repo.

## What is *not* a secret in this repo

- `yolov8n.pt` (auto-downloaded, ~6 MB) is a public model from Ultralytics.
- The demo email addresses (`admin@sentinel.ai`, etc.) are placeholders — you
  should change them at deploy time.
- Test credentials at `memory/test_credentials.md` are gitignored and intended
  for the local Emergent testing agent only.

## Reporting a vulnerability

Please email security concerns to the repository owner rather than opening a
public issue. Do not include reproduction PoCs against production hosts.
