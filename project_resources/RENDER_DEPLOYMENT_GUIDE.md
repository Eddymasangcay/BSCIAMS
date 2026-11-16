# Render Deployment Guide — BSCIAMS

Runtime Python modules (`database.py`, `db_enhance.py`, `permissions.py`, `pg_migrate.py`, `pg_backup.py`), `requirements.txt`, and `Procfile` live under **`project_resources/`**. The Flask entry point `server.py` and static assets (`html/`, `css/`, `js/`, `database/`) remain at the **repository root**.

`server.py` adds `project_resources/` to `sys.path` so imports continue to work.

Do not commit passwords, secret keys, or credentialed connection strings.

---

## 1. Recommended Render Web Service settings

Use the **repository root** as Root Directory so `server.py` is found without extra path tricks.

| Setting | Value |
|---|---|
| **Root Directory** | *(leave empty)* |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r project_resources/requirements.txt` |
| **Start Command** | `gunicorn server:app --bind 0.0.0.0:$PORT` |

### Alternate: Root Directory = `project_resources`

Only if you prefer Render to use the bundled Procfile:

| Setting | Value |
|---|---|
| **Root Directory** | `project_resources` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn --chdir .. server:app --bind 0.0.0.0:$PORT` |

(The `Procfile` in this folder already uses `--chdir ..`.)

---

## 2. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | Prefer Render **Internal Database URL** (same region as the web service) |
| `FLASK_SECRET_KEY` | **Yes** | Long random session secret (`RENDER=true` requires it) |
| `RENDER` | **Yes** | Set to `true` |
| `REQUIRE_POSTGRES` | Recommended | `true` |
| `PYTHON_VERSION` | Optional | `3.12.8` (also in root `.python-version`) |
| `ALLOW_SQLITE` | **No on Render** | Local offline trials only |

---

## 3. Database init

On startup, `database.init_db()` applies `database/schema.postgres.sql`, enhancements, and `database/migrations/*_postgres.sql`. No separate migrate job is required.

Verify after deploy (authenticated): `GET /api/db/status` → `usingPostgres: true`.

---

## 4. Common errors

| Symptom | Fix |
|---|---|
| `requirements.txt` not found | Use Build Command `pip install -r project_resources/requirements.txt` with empty Root Directory |
| `No module named server` | Empty Root Directory + Start `gunicorn server:app --bind 0.0.0.0:$PORT` |
| `No module named database` | Ensure `project_resources/database.py` exists; `server.py` must insert that folder on `sys.path` |
| Missing `FLASK_SECRET_KEY` / `DATABASE_URL` | Set both on the Web Service |

---

## 5. Local install

```powershell
cd <repo-root>
pip install -r project_resources/requirements.txt
copy .env.example .env
py -3 server.py
```
