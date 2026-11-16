# BSCIAMS (Experimental Enhancement)

**Barangay Senior Citizen Information and Assistance Management System** — experimental build with:

- **PostgreSQL** as the required centralized database
- Separate Administrator, Barangay Staff, and Health Worker workspaces
- Backend-enforced RBAC
- Tabler-based government admin UI (deep navy theme)

> This repository is the enhanced experimental copy. The original trial project remains separate.

## Stack

| Layer | Technology |
|---|---|
| Backend | Flask (`server.py`) + session auth |
| Database | **PostgreSQL** via `DATABASE_URL` (`psycopg` v3) |
| Migrations | `database/migrations/` + `pg_migrate.py` |
| Backups | `pg_dump` / SQL dump via `pg_backup.py` |
| Frontend | HTML/CSS/JS + [Tabler](https://tabler.io/) CDN |
| Hosting | Render Web Service + Render PostgreSQL |

SQLite is only a local offline fallback when `DATABASE_URL` is unset and the app is not on Render. Do not use SQLite for the instructor/demo deployment.

## Quick start (PostgreSQL)

```powershell
cd "F:\Windows Files\Desktop\PROJECTS\BSCIAMS-Enhanced"
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL instance
py -3 server.py
```

Open `http://127.0.0.1:5000`.

## Demo accounts

| Username | Password | Role |
|---|---|---|
| emasangcay | Admin@123 | Administrator |
| jencampi | Admin@123 | Administrator |
| jecab | Staff@123 | Barangay Staff |
| kmorta | Staff@123 | Barangay Staff |
| vrosalita | Health@123 | Health Worker |

## Render settings (recap)

- Build: `pip install -r requirements.txt`
- Start: `gunicorn server:app --bind 0.0.0.0:$PORT`
- Env: `DATABASE_URL`, `FLASK_SECRET_KEY`, `RENDER=true`, `PYTHON_VERSION=3.12.8`

## Documentation

- [docs/POSTGRESQL.md](docs/POSTGRESQL.md) — connection, migrations, backup/restore, ERD
- [docs/PERMISSIONS.md](docs/PERMISSIONS.md) — RBAC codes
- [docs/DATABASE.md](docs/DATABASE.md) — table overview
- [docs/TABLER_UI.md](docs/TABLER_UI.md) — Tabler theme notes

## Known limitations

- No native Electron desktop shell yet (same Flask API is the shared backend)
- Some newer module editors still use lightweight prompts
- Prefer testing `pg_restore` on a separate database before production restore
