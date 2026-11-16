# BSCIAMS (Experimental Enhancement)

**Barangay Senior Citizen Information and Assistance Management System** — experimental build with:

- **PostgreSQL** as the required centralized database
- Separate Administrator, Barangay Staff, and Health Worker workspaces
- Backend-enforced RBAC
- Tabler-based government admin UI (deep navy theme)

> This repository is the enhanced experimental copy. The original trial project remains separate.

## Repository layout

| Path | Contents |
|---|---|
| Repository root | Flask entry (`server.py`), `html/`, `css/`, `js/`, `database/` schemas |
| `project_resources/` | DB modules, `requirements.txt`, `Procfile`, docs, and deployment guides |

## Stack

| Layer | Technology |
|---|---|
| Backend | Flask (`server.py`) + session auth |
| Database | **PostgreSQL** via `DATABASE_URL` (`psycopg` v3) |
| Migrations | `database/migrations/` + `project_resources/pg_migrate.py` |
| Backups | `pg_dump` / SQL dump via `project_resources/pg_backup.py` |
| Frontend | HTML/CSS/JS + [Tabler](https://tabler.io/) CDN |
| Hosting | Render Web Service + Render PostgreSQL |

SQLite is only a local offline fallback when `ALLOW_SQLITE=1` and `DATABASE_URL` is unset. Do not use SQLite for the instructor/demo deployment.

## Quick start (PostgreSQL)

```powershell
cd "<path-to-BSCIAMS-Enhanced>"
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r project_resources/requirements.txt
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

Full guide: [`project_resources/RENDER_DEPLOYMENT_GUIDE.md`](project_resources/RENDER_DEPLOYMENT_GUIDE.md)

- **Root Directory:** leave empty (repository root) — `server.py` stays at root
- **Build:** `pip install -r project_resources/requirements.txt`
- **Start:** `gunicorn server:app --bind 0.0.0.0:$PORT`
- **Env:** `DATABASE_URL`, `FLASK_SECRET_KEY`, `RENDER=true`, `PYTHON_VERSION=3.12.8`

## Documentation

- [project_resources/RENDER_DEPLOYMENT_GUIDE.md](project_resources/RENDER_DEPLOYMENT_GUIDE.md) — Render dashboard settings after reorganization
- [project_resources/docs/POSTGRESQL.md](project_resources/docs/POSTGRESQL.md) — connection, migrations, backup/restore, ERD
- [project_resources/docs/PERMISSIONS.md](project_resources/docs/PERMISSIONS.md) — RBAC codes
- [project_resources/docs/DATABASE.md](project_resources/docs/DATABASE.md) — table overview
- [project_resources/docs/TABLER_UI.md](project_resources/docs/TABLER_UI.md) — Tabler theme notes

## Known limitations

- No native Electron desktop shell yet (same Flask API is the shared backend)
- Some newer module editors still use lightweight prompts
- Prefer testing `pg_restore` on a separate database before production restore
